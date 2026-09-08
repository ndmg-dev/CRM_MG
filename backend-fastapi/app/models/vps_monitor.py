"""Fase 3 do monitoramento da VPS — persistência.

Duas tabelas alimentadas por um poller em background (app/services/vps_poller.py):

  - vps_metric_snapshots  → uma linha por coleta (série além da janela da
                            Hostinger, pros gráficos de tendência de longo prazo)
  - vps_insight_events    → alertas com estado (aberto/reconhecido/resolvido),
                            pra não notificar o mesmo problema toda coleta

Criadas por Base.metadata.create_all no lifespan (o projeto não usa migrations).
"""

import uuid
from datetime import datetime

from sqlalchemy import BigInteger, Boolean, Column, DateTime, Float, Integer, String
from sqlalchemy.dialects.postgresql import UUID

from app.db.base import Base


class VpsMetricSnapshot(Base):
    __tablename__ = "vps_metric_snapshots"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    coletado_em = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)
    fonte = Column(String(20), nullable=False, default="hostinger")  # hostinger | coletores

    cpu_pct = Column(Float, nullable=True)
    ram_pct = Column(Float, nullable=True)
    ram_bytes = Column(BigInteger, nullable=True)
    disk_pct = Column(Float, nullable=True)
    disk_bytes = Column(BigInteger, nullable=True)
    net_in_bytes = Column(BigInteger, nullable=True)
    net_out_bytes = Column(BigInteger, nullable=True)

    load1 = Column(Float, nullable=True)          # node-exporter, quando disponível
    container_count = Column(Integer, nullable=True)


class VpsInsightEvent(Base):
    __tablename__ = "vps_insight_events"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    insight_key = Column(String(64), nullable=False, index=True)   # disk | ram | bandwidth | ...
    severity = Column(String(16), nullable=False)                  # critical | warning | info
    titulo = Column(String(255), nullable=False)
    detalhe = Column(String(1000), nullable=False)
    valor = Column(String(32), nullable=True)

    status = Column(String(16), nullable=False, default="aberto")  # aberto | reconhecido | resolvido
    aberto_em = Column(DateTime, nullable=False, default=datetime.utcnow)
    atualizado_em = Column(DateTime, nullable=False, default=datetime.utcnow)
    resolvido_em = Column(DateTime, nullable=True)
    reconhecido_por = Column(UUID(as_uuid=True), nullable=True)
    reconhecido_em = Column(DateTime, nullable=True)

    notificado = Column(Boolean, nullable=False, default=False)
