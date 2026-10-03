"""Monitoramento da VPS — Fase 4: ações de escrita na Hostinger.

Só as ações de NÍVEL-VPS entram nesta leva (decisão de produto):
restart / recreate / recovery (entrar e sair) / restaurar snapshot /
restaurar backup. Todas reiniciam a VPS inteira — CRM + satélites ficam fora
por 1-2 min e o operador não vê o resultado até voltar.

Proteção (travada com o usuário):
  - require_roles(["ADMIN"])  — só perfil ADMIN
  - confirmação digitada      — o corpo tem que trazer `confirm` == a palavra
                                exata da ação (ex. "REINICIAR")
  - audit_log                 — toda tentativa vira uma linha em logs_auditoria
  - actions_lock              — recusa se a Hostinger já está processando algo

As ações da Hostinger são ASSÍNCRONAS: a resposta traz (ou não) um id de
ação; o frontend dá poll em GET /vps/actions/{id} até `state` sair de
in_progress.

Fora desta leva (Fase 4 seguinte): criar/apagar snapshot, editar firewall,
redeploy pelo Coolify.
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.endpoints.vps_monitor import (
    _get_vm,
    _vm_path,
    bust_cache,
    hostinger_write,
)
from app.core.security import require_roles
from app.db.session import get_db
from app.models.audit_log import LogAuditoria
from app.models.user import Usuario

router = APIRouter()
logger = logging.getLogger(__name__)

_admin = Depends(require_roles(["ADMIN"]))


class _Action:
    def __init__(self, method: str, suffix: str, confirm: str, label: str, descricao: str, *, needs_backup_id: bool = False):
        self.method = method
        self.suffix = suffix
        self.confirm = confirm
        self.label = label
        self.descricao = descricao
        self.needs_backup_id = needs_backup_id


# A palavra de confirmação é comparada em maiúsculas, sem acento no lado do
# servidor não importa — o frontend mostra exatamente esta string.
ACTIONS: dict[str, _Action] = {
    "restart": _Action(
        "POST", "/restart", "REINICIAR", "Reiniciar a VPS",
        "Reinicia o servidor inteiro. CRM e satélites ficam fora ~1-2 min.",
    ),
    "recreate": _Action(
        "POST", "/recreate", "RECRIAR", "Recriar a VPS",
        "Reprovisiona o sistema operacional. TUDO que não está em volume/backup é perdido. Use só em último caso.",
    ),
    "recovery-enter": _Action(
        "POST", "/recovery", "RECUPERACAO", "Entrar no modo de recuperação",
        "Sobe a VPS num sistema mínimo (rescue) pra manutenção. Os serviços normais não sobem até sair.",
    ),
    "recovery-exit": _Action(
        "DELETE", "/recovery", "SAIR DA RECUPERACAO", "Sair do modo de recuperação",
        "Reinicia a VPS de volta no sistema normal.",
    ),
    "restore-snapshot": _Action(
        "POST", "/snapshot/restore", "RESTAURAR SNAPSHOT", "Restaurar o snapshot",
        "Volta o disco inteiro para o estado do snapshot manual. Tudo depois dele é perdido.",
    ),
    "restore-backup": _Action(
        "POST", "/backups/{backup_id}/restore", "RESTAURAR BACKUP", "Restaurar um backup",
        "Volta o disco inteiro para o estado do backup escolhido. Tudo depois dele é perdido.",
        needs_backup_id=True,
    ),
}


class ActionBody(BaseModel):
    confirm: str
    backup_id: int | None = None
    root_password: str | None = None


@router.get("/action-catalog")
async def actions_catalog(_: Usuario = _admin) -> Any:
    """Palavras de confirmação + descrições, pro frontend não hardcodar."""
    return {
        "actions": [
            {
                "key": k,
                "label": a.label,
                "descricao": a.descricao,
                "confirm": a.confirm,
                "needsBackupId": a.needs_backup_id,
            }
            for k, a in ACTIONS.items()
        ]
    }


@router.post("/actions/{action_key}/run")
async def run_action(
    action_key: str,
    body: ActionBody,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = _admin,
) -> Any:
    action = ACTIONS.get(action_key)
    if not action:
        raise HTTPException(status_code=404, detail="Ação desconhecida.")

    # Toda tentativa de um ADMIN de disparar uma ação de nível-VPS é auditada,
    # inclusive as rejeitadas — é destrutiva o bastante pra valer o rastro.
    audit = LogAuditoria(
        usuario_id=current_user.id,
        acao=f"vps.{action_key}",
        alvo=_vm_path().lstrip("/"),
        detalhes={"backup_id": body.backup_id},
    )
    db.add(audit)

    async def _reject(status: int, detail: str) -> HTTPException:
        audit.detalhes = {**(audit.detalhes or {}), "erro": detail, "status": status}
        await db.commit()
        return HTTPException(status_code=status, detail=detail)

    if body.confirm.strip().upper() != action.confirm:
        raise await _reject(400, f"Confirmação incorreta. Digite exatamente: {action.confirm}")

    if action.needs_backup_id and not body.backup_id:
        raise await _reject(400, "backup_id é obrigatório para restaurar um backup.")

    # actions_lock: não deixa disparar duas.
    vm = await _get_vm()
    if vm and vm.get("actions_lock") == "locked":
        raise await _reject(409, "A VPS já tem uma ação em andamento. Aguarde concluir.")

    suffix = action.suffix.format(backup_id=body.backup_id) if action.needs_backup_id else action.suffix
    payload: dict[str, Any] | None = None
    if action_key == "recovery-enter" and body.root_password:
        payload = {"root_password": body.root_password}

    await db.commit()

    try:
        result = await hostinger_write(action.method, _vm_path(suffix), payload)
    except HTTPException as exc:
        audit.detalhes = {**(audit.detalhes or {}), "erro": exc.detail, "status": exc.status_code}
        await db.commit()
        raise

    bust_cache()

    action_obj = result.get("action") if isinstance(result, dict) else None
    action_id = None
    if isinstance(action_obj, dict):
        action_id = action_obj.get("id")
    elif isinstance(result, dict):
        action_id = result.get("id")

    audit.detalhes = {**(audit.detalhes or {}), "actionId": action_id, "ok": True}
    await db.commit()

    logger.warning(
        "vps-actions: %s executada por %s (action_id=%s)", action_key, current_user.email, action_id
    )
    return {
        "ok": True,
        "actionKey": action_key,
        "actionId": action_id,
        "raw": result,
        "message": "Ação enviada. A VPS pode ficar indisponível por 1-2 min; acompanhe em Ações & Auditoria.",
    }
