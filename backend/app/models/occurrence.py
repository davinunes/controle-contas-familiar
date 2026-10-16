from sqlalchemy import (Column, Integer, String, DateTime, Date,
                        ForeignKey, Enum, Text, Numeric, desc, asc)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
from decimal import Decimal
import enum


class OccurrenceStatus(str, enum.Enum):
    pending        = "pending"
    partially_paid = "partially_paid"
    paid           = "paid"


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
    status             = Column(Enum("pending", "partially_paid", "paid"), nullable=False, default="pending", index=True)
    paid_at            = Column(DateTime, nullable=True)
    notes              = Column(Text, nullable=True)
    created_at         = Column(DateTime, server_default=func.now())
    updated_at         = Column(DateTime, server_default=func.now(), onupdate=func.now())

    expense       = relationship("Expense", back_populates="occurrences")
    tenant        = relationship("Tenant", back_populates="occurrences")
    attachments   = relationship("Attachment", back_populates="occurrence", cascade="all, delete-orphan")
    payments      = relationship("OccurrencePayment", back_populates="occurrence", cascade="all, delete-orphan", order_by="desc(OccurrencePayment.paid_at)")
    invoice_items = relationship("InvoiceItem", back_populates="occurrence", cascade="all, delete-orphan", order_by="asc(InvoiceItem.purchase_date)")

    @property
    def paid_amount(self):
        """Retorna a soma de pagamentos registrados ou o valor total se for paid legado sem registros."""
        if self.payments:
            return sum((p.amount for p in self.payments), Decimal("0"))
        if self.status == "paid":
            return self.value or Decimal("0")
        return Decimal("0")

    @property
    def remaining_amount(self):
        """Retorna o saldo restante a pagar."""
        if self.status == "paid":
            return Decimal("0")
        val = self.value or Decimal("0")
        rem = val - self.paid_amount
        return rem if rem > Decimal("0") else Decimal("0")

