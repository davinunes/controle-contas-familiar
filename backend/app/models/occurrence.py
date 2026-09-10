from sqlalchemy import (Column, Integer, String, DateTime, Date,
                        ForeignKey, Enum, Text, Numeric)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum


class OccurrenceStatus(str, enum.Enum):
    pending = "pending"
    paid    = "paid"


class Occurrence(Base):
    __tablename__ = "expense_occurrences"

    id                 = Column(Integer, primary_key=True, index=True)
    expense_id         = Column(Integer, ForeignKey("expenses.id", ondelete="CASCADE"), nullable=False)
    tenant_id          = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    reference_month    = Column(Date, nullable=False, comment="YYYY-MM-01")
    installment_number = Column(Integer, nullable=True)
    value              = Column(Numeric(10, 2), nullable=False)
    due_date           = Column(Date, nullable=False, index=True)
    nf_url             = Column(Text, nullable=True)
    status             = Column(Enum("pending", "paid"), nullable=False, default="pending", index=True)
    paid_at            = Column(DateTime, nullable=True)
    notes              = Column(Text, nullable=True)
    created_at         = Column(DateTime, server_default=func.now())
    updated_at         = Column(DateTime, server_default=func.now(), onupdate=func.now())

    expense     = relationship("Expense", back_populates="occurrences")
    tenant      = relationship("Tenant", back_populates="occurrences")
    attachments = relationship("Attachment", back_populates="occurrence", cascade="all, delete-orphan")
