from __future__ import annotations
from pydantic import BaseModel, Field, field_validator
from datetime import datetime, date
from typing import Optional, List, Any
from decimal import Decimal


from app.schemas.cost_center import CostCenterBrief


# ── Expense ──────────────────────────────────────────────────
class ImportantDetail(BaseModel):
    label: str
    value: str


class ExpenseCreate(BaseModel):
    title:              str  = Field(..., min_length=2, max_length=200)
    description:        Optional[str] = None
    type:               str  = Field(..., pattern="^(single|installment|recurring)$")
    cost_center_id:     Optional[int] = None
    person_id:          Optional[int] = None
    total_installments: Optional[int] = None
    installment_value:  Optional[Decimal] = None
    first_due_date:     Optional[date] = None
    recurrence_day:     Optional[int] = Field(None, ge=1, le=31)
    important_details:  Optional[List[ImportantDetail]] = None


    @field_validator("cost_center_id", "person_id", "recurrence_day", mode="before")
    @classmethod
    def empty_str_to_none(cls, v):
        if v == "" or v is None:
            return None
        return v


class ExpenseUpdate(BaseModel):
    title:              Optional[str] = None
    description:        Optional[str] = None
    cost_center_id:     Optional[int] = None
    person_id:          Optional[int] = None
    total_installments: Optional[int] = None
    installment_value:  Optional[Decimal] = None
    first_due_date:     Optional[date] = None
    recurrence_day:     Optional[int] = Field(None, ge=1, le=31)
    important_details:  Optional[List[ImportantDetail]] = None
    active:             Optional[bool] = None

    @field_validator("cost_center_id", "person_id", "recurrence_day", mode="before")
    @classmethod
    def empty_str_to_none(cls, v):
        if v == "" or v is None:
            return None
        return v


class ExpenseOut(BaseModel):
    id:                 int
    tenant_id:          int
    title:              str
    description:        Optional[str] = None
    type:               str
    cost_center_id:     Optional[int] = None
    person_id:          Optional[int] = None
    cost_center:        Optional[CostCenterBrief] = None
    person:             Optional[CostCenterBrief] = None
    total_installments: Optional[int] = None
    installment_value:  Optional[Decimal] = None
    first_due_date:     Optional[date] = None
    recurrence_day:     Optional[int] = None
    important_details:  Optional[List[Any]] = None
    active:             bool = True
    created_at:         datetime
    updated_at:         datetime

    model_config = {"from_attributes": True}


# ── Occurrence ───────────────────────────────────────────────
class OccurrenceCreate(BaseModel):
    expense_id:         int
    reference_month:    date        # YYYY-MM-01
    installment_number: Optional[int] = None
    value:              Decimal
    due_date:           date
    nf_url:             Optional[str] = None
    notes:              Optional[str] = None


class OccurrenceUpdate(BaseModel):
    value:   Optional[Decimal] = None
    due_date: Optional[date]   = None
    nf_url:  Optional[str]     = None
    status:  Optional[str]     = Field(None, pattern="^(pending|paid)$")
    paid_at: Optional[datetime] = None
    notes:   Optional[str]     = None


class AttachmentBrief(BaseModel):
    id:                int
    type:              str
    original_filename: str
    s3_url:            Optional[str] = None
    uploaded_at:       datetime

    model_config = {"from_attributes": True}


class OccurrenceOut(BaseModel):
    id:                 int
    expense_id:         int
    tenant_id:          int
    reference_month:    date
    installment_number: Optional[int] = None
    value:              Decimal
    due_date:           date
    nf_url:             Optional[str] = None
    status:             str
    paid_at:            Optional[datetime] = None
    notes:              Optional[str] = None
    attachments:        List[AttachmentBrief] = []
    expense:            Optional[ExpenseOut] = None
    created_at:         datetime
    updated_at:         datetime

    model_config = {"from_attributes": True}


# ── Dashboard ────────────────────────────────────────────────
class DashboardSummary(BaseModel):
    month:           str            # YYYY-MM
    total_pending:   Decimal
    total_paid:      Decimal
    overdue_count:   int
    overdue_total:   Decimal
    current_count:   int


class FiadoData(BaseModel):
    total_debt:      Decimal
    total_paid:      Decimal
    balance:         Decimal
    monthly_series:  List[dict]     # [{month, pending, paid}]


class ResumoItem(BaseModel):
    occurrence_id:     int
    expense_id:        int
    expense_title:     str
    value:             Decimal
    due_date:          date
    status:            str
    is_overdue:        bool
    reference_month:   date
    has_boleto:        bool
    has_danfe:         bool
    has_comprovante:   bool
    person_id:         Optional[int] = None
    person_name:       Optional[str] = None
    person_color:      Optional[str] = None
    cost_center_id:    Optional[int] = None
    cost_center_name:  Optional[str] = None
    cost_center_color: Optional[str] = None
