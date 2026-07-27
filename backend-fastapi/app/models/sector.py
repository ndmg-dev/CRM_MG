import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.db.base import Base
from app.enums.visibilidade_sistemas import VisibilidadeSistemas

class Setor(Base):
    __tablename__ = "setores"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # `codigo` é o valor persistido em usuarios.setor, tarefas.setor_origem e
    # sistemas.setor — as comparações do sistema continuam sendo por string.
    codigo = Column(String(50), nullable=False, unique=True)
    nome = Column(String(100), nullable=False)
    cor = Column(String(30), nullable=True)
    ativo = Column(Boolean, nullable=False, default=True)
    # Política de visualização do catálogo de sistemas para quem está no setor.
    visibilidade_sistemas = Column(
        String(20), nullable=False, default=VisibilidadeSistemas.PROPRIO.value
    )
    # Códigos de outros setores visíveis — usado apenas em PERSONALIZADO.
    setores_visiveis = Column(JSONB, nullable=False, default=list)
    data_criacao = Column(DateTime, nullable=False, default=datetime.utcnow)
