"""Fila assíncrona + watcher de pasta."""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from pathlib import Path

from .config import settings
from .dominio import Repositorio, Storage
from .processamento import processar_recibo

logger = logging.getLogger("recibo.fila")


@dataclass
class TarefaRecibo:
    caminho: Path
    tenant_id: str
    raiz: Path


def caminho_dentro(caminho: Path, raiz: Path) -> bool:
    """Confirma que o arquivo está mesmo sob a pasta monitorada.

    Symlink ou junction dentro da pasta poderia apontar para qualquer lugar do
    servidor; sem esta checagem o worker leria e subiria para o bucket um
    arquivo que nada tem a ver com recibo.
    """
    try:
        return caminho.resolve().is_relative_to(raiz.resolve())
    except (OSError, ValueError):
        return False


class FilaRecibos:
    """Workers assíncronos com debounce por caminho.

    O debounce existe porque o evento de criação chega quando o Domínio ainda
    pode estar escrevendo o arquivo — processar cedo lê PDF truncado.
    """

    def __init__(self, repo: Repositorio, storage: Storage, n_workers: int | None = None):
        self._repo = repo
        self._storage = storage
        self._q: asyncio.Queue[TarefaRecibo] = asyncio.Queue()
        self._pendentes: dict[Path, asyncio.TimerHandle] = {}
        self._n_workers = n_workers or settings.WORKERS
        self._workers: list[asyncio.Task] = []
        self._loop: asyncio.AbstractEventLoop | None = None

    async def iniciar(self) -> None:
        self._loop = asyncio.get_running_loop()
        self._workers = [
            asyncio.create_task(self._worker(i)) for i in range(self._n_workers)
        ]
        logger.info("fila iniciada com %d workers", self._n_workers)

    async def parar(self) -> None:
        for handle in self._pendentes.values():
            handle.cancel()
        self._pendentes.clear()
        for w in self._workers:
            w.cancel()
        await asyncio.gather(*self._workers, return_exceptions=True)

    def agendar(self, caminho: Path, tenant_id: str, raiz: Path) -> None:
        """Chamado pela thread do watchdog. Debounce + enfileira."""
        if self._loop is None:
            return
        self._loop.call_soon_threadsafe(self._agendar_interno, caminho, tenant_id, raiz)

    def _agendar_interno(self, caminho: Path, tenant_id: str, raiz: Path) -> None:
        if caminho in self._pendentes:
            self._pendentes[caminho].cancel()
        assert self._loop is not None
        handle = self._loop.call_later(
            settings.DEBOUNCE_SEGUNDOS, self._enfileirar, caminho, tenant_id, raiz
        )
        self._pendentes[caminho] = handle

    def _enfileirar(self, caminho: Path, tenant_id: str, raiz: Path) -> None:
        self._pendentes.pop(caminho, None)
        self._q.put_nowait(TarefaRecibo(caminho, tenant_id, raiz))

    async def _worker(self, idx: int) -> None:
        while True:
            tarefa = await self._q.get()
            try:
                await self._processar(tarefa)
            except asyncio.CancelledError:
                raise
            except Exception:
                # Falha de um recibo nunca derruba o worker.
                logger.exception("erro processando recibo (worker %d)", idx)
            finally:
                self._q.task_done()

    async def _processar(self, tarefa: TarefaRecibo) -> None:
        caminho = tarefa.caminho

        if not caminho_dentro(caminho, tarefa.raiz):
            logger.warning("arquivo fora da pasta monitorada, ignorado")
            return

        if caminho.suffix.lower() not in settings.EXTENSOES:
            return

        if not caminho.is_file():
            return

        tamanho = caminho.stat().st_size
        if tamanho == 0:
            return
        if tamanho > settings.MAX_ARQUIVO_BYTES:
            logger.warning("arquivo grande demais (%d bytes), ignorado", tamanho)
            return

        # Leitura em thread: o watcher não pode travar o event loop num
        # compartilhamento de rede lento.
        conteudo = await asyncio.to_thread(caminho.read_bytes)

        resultado = await processar_recibo(
            conteudo, caminho.name, tarefa.tenant_id, self._repo, self._storage
        )
        logger.info("resultado=%s", resultado)


def montar_observer(fila: FilaRecibos, pasta: str, tenant_id: str):
    """Observer do watchdog para uma pasta.

    Cada tenant tem a sua pasta e o seu observer: o `tenant_id` vem da
    configuração da pasta, NUNCA do conteúdo do arquivo. Um recibo não escolhe
    a que escritório pertence.
    """
    from watchdog.events import FileSystemEventHandler
    from watchdog.observers import Observer

    raiz = Path(pasta)

    class Handler(FileSystemEventHandler):
        def on_created(self, event):
            if not event.is_directory:
                fila.agendar(Path(event.src_path), tenant_id, raiz)

        def on_moved(self, event):
            if not event.is_directory:
                fila.agendar(Path(event.dest_path), tenant_id, raiz)

        def on_modified(self, event):
            # Cópia em rede costuma emitir modified sem created.
            if not event.is_directory:
                fila.agendar(Path(event.src_path), tenant_id, raiz)

    observer = Observer()
    observer.schedule(Handler(), pasta, recursive=False)
    return observer
