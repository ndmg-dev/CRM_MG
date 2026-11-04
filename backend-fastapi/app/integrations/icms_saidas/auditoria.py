"""Auditoria das chamadas que ALTERAM o motor, na trilha do CRM (logs_auditoria). Nunca grava corpo, arquivo nem chave."""
from __future__ import annotations

import logging

from app.db.session import AsyncSessionLocal
from app.models.audit_log import LogAuditoria
from app.models.user import Usuario

log = logging.getLogger("icms_saidas")


async def auditar(usuario: Usuario, metodo: str, caminho: str, empresa: str | None, status: int) -> None:
    """A ação no motor já aconteceu: falha ao auditar é registrada no log, mas não derruba a resposta ao usuário."""
    try:
        async with AsyncSessionLocal() as db:
            db.add(LogAuditoria(usuario_id=usuario.id, acao="ICMS_SAIDAS", alvo=f"{metodo} {caminho}"[:255], detalhes={"empresa": empresa, "status": status}))
            await db.commit()
    except Exception:
        log.exception("Falha ao gravar a auditoria de %s %s", metodo, caminho)
