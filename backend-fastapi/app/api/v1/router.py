from fastapi import APIRouter
from app.api.v1.endpoints import auth, users, sectors, clients, systems, tasks, access, dashboard, audit_logs, portal, documents, notifications, search, sessions, system_tracking

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/usuarios", tags=["usuarios"])
api_router.include_router(sectors.router, prefix="/setores", tags=["setores"])
api_router.include_router(clients.router, prefix="/clientes", tags=["clientes"])
api_router.include_router(systems.router, prefix="/sistemas", tags=["sistemas"])
api_router.include_router(tasks.router, prefix="/tarefas", tags=["tarefas"])
api_router.include_router(access.router, prefix="/acessos", tags=["acessos"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(notifications.router, prefix="/notificacoes", tags=["notificacoes"])
api_router.include_router(audit_logs.router, prefix="/auditoria", tags=["auditoria"])
api_router.include_router(portal.router, prefix="/portal", tags=["portal"])
api_router.include_router(documents.router, tags=["documentos"])
api_router.include_router(search.router, prefix="/search", tags=["search"])
api_router.include_router(sessions.router, prefix="/sessoes", tags=["sessoes"])
api_router.include_router(system_tracking.router, prefix="/tracking", tags=["tracking"])
