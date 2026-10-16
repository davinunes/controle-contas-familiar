from sqlalchemy import (Column, Integer, String, DateTime,
                        ForeignKey, Text, Numeric)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class OccurrencePayment(Base):
    __tablename__ = "occurrence_payments"

    id             = Column(Integer, primary_key=True, index=True)
    occurrence_id  = Column(Integer, ForeignKey("expense_occurrences.id", ondelete="CASCADE"), nullable=False, index=True)
    tenant_id      = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    amount         = Column(Numeric(10, 2), nullable=False)
    paid_at        = Column(DateTime, nullable=False, server_default=func.now())
    payment_method = Column(String(50), nullable=True)  # ex: pix, dinheiro, debito, ted
    notes          = Column(Text, nullable=True)
    created_at     = Column(DateTime, server_default=func.now())
    updated_at     = Column(DateTime, server_default=func.now(), onupdate=func.now())

    occurrence = relationship("Occurrence", back_populates="payments")
    tenant     = relationship("Tenant")
