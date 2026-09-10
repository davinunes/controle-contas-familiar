from sqlalchemy import Column, Integer, String, DateTime, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Tenant(Base):
    __tablename__ = "tenants"

    id            = Column(Integer, primary_key=True, index=True)
    name          = Column(String(100), nullable=False)
    slug          = Column(String(50), unique=True, nullable=False)
    storage_url   = Column(Text, nullable=True)  # URL Pré-autenticada (PAR) da Oracle
    s3_endpoint   = Column(String(255), nullable=True)
    s3_bucket     = Column(String(100), nullable=True)
    s3_access_key = Column(String(255), nullable=True)
    s3_secret_key = Column(String(255), nullable=True)
    s3_prefix     = Column(String(100), nullable=True, default="")
    created_at    = Column(DateTime, server_default=func.now())
    updated_at    = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relacionamentos
    expenses     = relationship("Expense", back_populates="tenant", cascade="all, delete-orphan")
    occurrences  = relationship("Occurrence", back_populates="tenant", cascade="all, delete-orphan")
    user_links   = relationship("UserTenant", back_populates="tenant", cascade="all, delete-orphan")
    cost_centers = relationship("CostCenter", back_populates="tenant", cascade="all, delete-orphan")
