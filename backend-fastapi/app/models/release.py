import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.base import Base


class Release(Base):
    """Uma versão publicada do CRM, com as notas do que mudou."""
    __tablename__ = "releases"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    version = Column(String(50), nullable=False, unique=True)
    released_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    notes = relationship(
        "ReleaseNote", back_populates="release",
        order_by="ReleaseNote.sort_order", cascade="all, delete-orphan",
    )


class ReleaseNote(Base):
    """Uma linha do changelog: sistema + descrição da mudança."""
    __tablename__ = "release_notes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    release_id = Column(UUID(as_uuid=True), ForeignKey("releases.id", ondelete="CASCADE"), nullable=False)
    system_name = Column(String(255), nullable=False)
    description = Column(String(4000), nullable=False)
    sort_order = Column(Integer, default=0, nullable=False)

    release = relationship("Release", back_populates="notes")


class ReleaseRead(Base):
    """Marca que um usuário já viu/fechou o modal de uma release."""
    __tablename__ = "release_reads"
    __table_args__ = (UniqueConstraint("release_id", "user_id", name="uk_release_read"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    release_id = Column(UUID(as_uuid=True), ForeignKey("releases.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    read_at = Column(DateTime, default=datetime.utcnow, nullable=False)
