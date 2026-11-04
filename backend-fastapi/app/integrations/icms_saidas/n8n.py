"""Pastas das empresas no Drive: pede ao workflow n8n "Motor ICMS – Preparar pastas" que crie as que faltam.

A URL do webhook e o token são configuração do servidor (ICMS_N8N_URL_PASTAS / ICMS_N8N_TOKEN, as duas juntas ou nenhuma); o token
vai no cabeçalho X-Painel-Token e nunca aparece em resposta, log ou auditoria. Disparos são AGRUPADOS: no máximo um por INTERVALO
segundos (o workflow só cria o que falta, mas duas execuções simultâneas poderiam duplicar pastas no Drive). Um pedido dentro da
janela é agendado para o fim dela e pedidos seguidos viram um só. Falha do n8n nunca afeta o cadastro da empresa: o workflow também
roda de hora em hora como rede de segurança. Estado em memória: vale por processo (o CRM roda com um worker).
"""
from __future__ import annotations

import asyncio
import logging
import time
from collections.abc import Awaitable, Callable
from typing import Literal

import httpx

from app.core.config import settings

log = logging.getLogger("icms_saidas.n8n")

INTERVALO = 60.0
TIMEOUT = httpx.Timeout(10.0)
CABECALHO_AUTENTICACAO = "X-Painel-Token"

Situacao = Literal["disparado", "agendado"]


class Disparador:
    def __init__(
        self,
        cliente: httpx.AsyncClient,
        *,
        intervalo: float = INTERVALO,
        relogio: Callable[[], float] = time.monotonic,
        dormir: Callable[[float], Awaitable[None]] = asyncio.sleep,
    ) -> None:
        self.cliente = cliente
        self.intervalo = intervalo
        self.relogio = relogio
        self.dormir = dormir
        self._ultimo: float | None = None
        self._agendado: asyncio.Task[bool] | None = None

    @staticmethod
    def configurado() -> bool:
        return bool(settings.ICMS_N8N_URL_PASTAS and settings.ICMS_N8N_TOKEN)

    async def solicitar(self, usuario: str, motivo: str) -> tuple[Situacao, bool]:
        """Dispara agora (devolve se o n8n aceitou) ou agenda para o fim da janela (devolve True)."""
        if self._agendado is not None and not self._agendado.done():
            return "agendado", True
        espera = 0.0 if self._ultimo is None else self._ultimo + self.intervalo - self.relogio()
        if espera <= 0:
            return "disparado", await self._disparar(usuario, motivo)
        self._agendado = asyncio.create_task(self._depois(espera, usuario, motivo))
        return "agendado", True

    async def solicitar_sem_falhar(self, usuario: str, motivo: str) -> None:
        """Para o cadastro de empresa (em segundo plano): nunca levanta erro e, sem configuração, não faz nada."""
        if not self.configurado():
            return
        try:
            await self.solicitar(usuario, motivo)
        except (OSError, RuntimeError) as exc:  # o cadastro já foi feito; a rodada horária cobre
            log.error("Erro ao pedir as pastas ao n8n: %s", type(exc).__name__)

    async def _depois(self, espera: float, usuario: str, motivo: str) -> bool:
        await self.dormir(espera)
        return await self._disparar(usuario, motivo)

    async def _disparar(self, usuario: str, motivo: str) -> bool:
        if not self.configurado():
            return False
        self._ultimo = self.relogio()
        status: int | None = None
        try:
            resp = await self.cliente.post(
                settings.ICMS_N8N_URL_PASTAS,
                json={"motivo": motivo, "solicitado_por": usuario},
                headers={CABECALHO_AUTENTICACAO: settings.ICMS_N8N_TOKEN},
                timeout=TIMEOUT,
            )
            status = resp.status_code
        except httpx.HTTPError as exc:
            log.warning("Falha ao chamar o n8n (preparar pastas): %s", type(exc).__name__)
        else:
            if not resp.is_success:
                log.warning("n8n recusou o pedido de preparar pastas: HTTP %s", status)
        log.info("Pastas do Drive pedidas ao n8n por %s (%s): HTTP %s", usuario, motivo, status)
        return status is not None and 200 <= status < 300
