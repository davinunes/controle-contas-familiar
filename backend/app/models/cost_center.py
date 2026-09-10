from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum


class CostCenterType(str, enum.Enum):
    person   = "person"     # Responsável / Pessoa (ex: Sogro, Sogra, Ambos)
    category = "category"   # Categoria / Tipo de Gasto (ex: Mercado, Saúde, Luz)


class CostCenter(Base):
    __tablename__ = "cost_centers"

    id         = Column(Integer, primary_key=True, index=True)
    tenant_id  = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    name       = Column(String(100), nullable=False)
    type       = Column(Enum("person", "category"), nullable=False, default="category")
    color      = Column(String(20), nullable=True, default="#6C63FF")
    active     = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    tenant = relationship("Tenant", back_populates="cost_centers")
