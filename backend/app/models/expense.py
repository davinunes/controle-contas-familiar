from sqlalchemy import (Column, Integer, String, DateTime, Date,
                        ForeignKey, Enum, Text, Boolean, JSON, Numeric)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum


class ExpenseType(str, enum.Enum):
    single      = "single"       # Avulsa (não se repete)
    installment = "installment"  # Parcelada (N×valor fixo)
    recurring   = "recurring"    # Recorrente (mensal, valor variável)


class Expense(Base):
    __tablename__ = "expenses"

    id                 = Column(Integer, primary_key=True, index=True)
    tenant_id          = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    title              = Column(String(200), nullable=False)
    description        = Column(Text, nullable=True)
    type               = Column(Enum("single", "installment", "recurring"), nullable=False, default="single")

    # Parceladas
    total_installments = Column(Integer, nullable=True)
    installment_value  = Column(Numeric(10, 2), nullable=True)
    first_due_date     = Column(Date, nullable=True)

    # Recorrentes e avulsas
    recurrence_day     = Column(Integer, nullable=True)

    # Detalhes importantes (ex: código concessionária, UC, site)
    important_details  = Column(JSON, nullable=True)  # List[{label: str, value: str}]

    active             = Column(Boolean, default=True)
    created_at         = Column(DateTime, server_default=func.now())
    updated_at         = Column(DateTime, server_default=func.now(), onupdate=func.now())

    tenant      = relationship("Tenant", back_populates="expenses")
    occurrences = relationship("Occurrence", back_populates="expense", cascade="all, delete-orphan")
