import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID
from app.db.base import Base

class Documento(Base):
    __tablename__ = "documentos"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cliente_id = Column(UUID(as_uuid=True), ForeignKey("clientes.id", ondelete="CASCADE"), nullable=False)
    nome_arquivo = Column(String(255), nullable=False)
    tamanho_bytes = Column(Integer, nullable=False, default=0)
    tipo_mime = Column(String(100), nullable=True)
    caminho_storage = Column(String(1024), nullable=False)
    enviado_por = Column(String(50), nullable=False, default="CLIENTE") # CLIENTE ou USUARIO
    status = Column(String(50), nullable=False, default="RECEBIDO") # RECEBIDO, REJEITADO
    competencia = Column(String(7), nullable=True) # MM/YYYY
    data_envio = Column(DateTime, nullable=False, default=datetime.utcnow)
