from sqlalchemy import (Column, Integer, String, DateTime, Date,
                        ForeignKey, Text, Numeric)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class InvoiceItem(Base):
    __tablename__ = "invoice_items"

    id             = Column(Integer, primary_key=True, index=True)
    occurrence_id  = Column(Integer, ForeignKey("expense_occurrences.id", ondelete="CASCADE"), nullable=False, index=True)
    tenant_id      = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    description    = Column(String(200), nullable=False)
    amount         = Column(Numeric(10, 2), nullable=False)
    purchase_date  = Column(Date, nullable=False)
    cost_center_id = Column(Integer, ForeignKey("cost_centers.id", ondelete="SET NULL"), nullable=True, index=True)
    person_id      = Column(Integer, ForeignKey("cost_centers.id", ondelete="SET NULL"), nullable=True, index=True)
    notes          = Column(Text, nullable=True)
    created_at     = Column(DateTime, server_default=func.now())
    updated_at     = Column(DateTime, server_default=func.now(), onupdate=func.now())

    occurrence  = relationship("Occurrence", back_populates="invoice_items")
    tenant      = relationship("Tenant")
    cost_center = relationship("CostCenter", foreign_keys=[cost_center_id])
    person      = relationship("CostCenter", foreign_keys=[person_id])
