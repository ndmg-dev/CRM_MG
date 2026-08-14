"""Entrada do worker.

Sobe a fila, liga um observer por pasta monitorada e mantém a lista de pastas
atualizada sem reiniciar o processo. Expõe apenas /health — a interface de
revisão é a tela do módulo, que fala direto com o Supabase sob RLS.
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
from pathlib import Path

from fastapi import FastAPI

from .config import settings
from .fila import FilaRecibos, montar_observer
from .repositorio import RepositorioPostgres, criar_pool
from .storage import StorageSupabase

logging.basicConfig(
    level=settings.LOG_LEVEL,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("recibo")


class Supervisor:
    """Mantém um observer por pasta ativa, reagindo a mudanças na tabela."""

    def __init__(self, repo: RepositorioPostgres, fila: FilaRecibos) -> None:
        self._repo = repo
        self._fila = fila
        self._observers: dict[tuple[str, str], object] = {}

    async def sincronizar(self) -> None:
        try:
            pastas = await self._repo.pastas_monitoradas()
        except Exception:
            logger.exception("falha ao ler pasta_monitorada")
            return

        desejadas = set(pastas)
        atuais = set(self._observers)

        for chave in atuais - desejadas:
            observer = self._observers.pop(chave)
            observer.stop()  # type: ignore[attr-defined]
            logger.info("parou de monitorar uma pasta")

        for chave in desejadas - atuais:
            tenant_id, caminho = chave
            if not Path(caminho).is_dir():
                # Compartilhamento fora do ar não é motivo para derrubar o
                # worker; tenta de novo na próxima sincronização.
                logger.warning("pasta configurada não está acessível")
                continue
            observer = montar_observer(self._fila, caminho, tenant_id)
            observer.start()
            self._observers[chave] = observer
            logger.info("monitorando nova pasta (tenant=%s)", tenant_id[:8])

    async def loop(self) -> None:
        while True:
            await self.sincronizar()
            await asyncio.sleep(settings.RECARGA_PASTAS_SEGUNDOS)

    def parar(self) -> None:
        for observer in self._observers.values():
            observer.stop()  # type: ignore[attr-defined]
            observer.join(timeout=5)  # type: ignore[attr-defined]
        self._observers.clear()


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    pool = await criar_pool(settings.DATABASE_URL)
    repo = RepositorioPostgres(pool)
    storage = StorageSupabase(
        settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY, settings.STORAGE_BUCKET
    )

    fila = FilaRecibos(repo, storage)
    await fila.iniciar()

    supervisor = Supervisor(repo, fila)
    tarefa = asyncio.create_task(supervisor.loop())

    app.state.supervisor = supervisor
    logger.info("worker de baixa por recibo iniciado")

    try:
        yield
    finally:
        tarefa.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await tarefa
        supervisor.parar()
        await fila.parar()
        await pool.close()
        logger.info("worker encerrado")


app = FastAPI(title=settings.PROJECT_NAME, lifespan=lifespan)


@app.get("/health")
async def health() -> dict[str, object]:
    supervisor: Supervisor = app.state.supervisor
    return {"status": "ok", "pastas_monitoradas": len(supervisor._observers)}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8090)
