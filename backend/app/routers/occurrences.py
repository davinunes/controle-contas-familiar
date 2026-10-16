from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload, selectinload
from datetime import date, datetime, timezone
from app.timezone import sp_now_naive, sp_today
from typing import Optional
from decimal import Decimal

from app.database import get_db
from app.models.occurrence import Occurrence
from app.models.expense import Expense
from app.models.user import User, UserTenant
from app.models.payment import OccurrencePayment
from app.models.invoice_item import InvoiceItem
from app.routers.auth import get_current_user
from app.schemas.expense import (
    OccurrenceCreate, OccurrenceUpdate, OccurrenceOut,
    OccurrencePaymentCreate, OccurrencePaymentOut,
    InvoiceItemCreate, InvoiceItemUpdate, InvoiceItemOut
)

router = APIRouter(prefix="/occurrences", tags=["occurrences"])


def _check_access(db: Session, user: User, tenant_id: int):
    if user.is_superadmin:
        return
    link = db.query(UserTenant).filter(
        UserTenant.user_id == user.id,
        UserTenant.tenant_id == tenant_id,
    ).first()
    if not link:
        raise HTTPException(status_code=403, detail="Sem acesso")


def _sync_occurrence_payment_status(db: Session, occ: Occurrence):
    """Atualiza o status da ocorrência com base na soma de pagamentos."""
    payments = db.query(OccurrencePayment).filter(OccurrencePayment.occurrence_id == occ.id).all()
    total_paid = sum((p.amount for p in payments), Decimal("0"))
    val = occ.value or Decimal("0")

    if total_paid >= val and val > 0:
        occ.status = "paid"
        latest = max(payments, key=lambda p: p.paid_at) if payments else None
        if latest:
            occ.paid_at = latest.paid_at
    elif total_paid > 0:
        occ.status = "partially_paid"
        occ.paid_at = None
    else:
        if occ.status == "partially_paid":
            occ.status = "pending"
            occ.paid_at = None
    db.commit()
    db.refresh(occ)


def _sync_credit_card_occurrence_value(db: Session, occ: Occurrence):
    """Atualiza o valor da ocorrência para faturas de cartão com base na soma dos itens."""
    expense = db.query(Expense).filter(Expense.id == occ.expense_id).first()
    if expense and expense.type == "credit_card":
        items = db.query(InvoiceItem).filter(InvoiceItem.occurrence_id == occ.id).all()
        total = sum((item.amount for item in items), Decimal("0"))
        occ.value = total
        db.commit()
        db.refresh(occ)
        _sync_occurrence_payment_status(db, occ)


def _occurrence_query(db: Session):
    return (
        db.query(Occurrence)
        .options(
            joinedload(Occurrence.attachments),
            joinedload(Occurrence.expense),
            selectinload(Occurrence.payments),
            selectinload(Occurrence.invoice_items).joinedload(InvoiceItem.cost_center),
            selectinload(Occurrence.invoice_items).joinedload(InvoiceItem.person),
        )
    )


@router.get("", response_model=list[OccurrenceOut])
def list_occurrences(
    tenant_id: int = Query(...),
    month: Optional[str] = Query(None, description="YYYY-MM"),
    expense_id: Optional[int] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _check_access(db, current_user, tenant_id)

    q = _occurrence_query(db).filter(Occurrence.tenant_id == tenant_id)

    if month:
        try:
            ref = date.fromisoformat(f"{month}-01")
            q = q.filter(Occurrence.reference_month == ref)
        except ValueError:
            raise HTTPException(status_code=400, detail="Formato de mês inválido. Use YYYY-MM")

    if expense_id:
        q = q.filter(Occurrence.expense_id == expense_id)

    if status_filter:
        q = q.filter(Occurrence.status == status_filter)

    return q.order_by(Occurrence.due_date).all()


@router.get("/overdue", response_model=list[OccurrenceOut])
def list_overdue(
    tenant_id: int = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retorna ocorrências pendentes ou parcialmente pagas de meses anteriores."""
    _check_access(db, current_user, tenant_id)
    today = sp_today()
    current_month = date(today.year, today.month, 1)

    return (
        _occurrence_query(db)
        .filter(
            Occurrence.tenant_id == tenant_id,
            Occurrence.status.in_(["pending", "partially_paid"]),
            Occurrence.reference_month < current_month,
        )
        .order_by(Occurrence.due_date)
        .all()
    )


@router.post("", response_model=OccurrenceOut, status_code=status.HTTP_201_CREATED)
def create_occurrence(
    payload: OccurrenceCreate,
    tenant_id: int = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _check_access(db, current_user, tenant_id)
    expense = db.query(Expense).filter(
        Expense.id == payload.expense_id,
        Expense.tenant_id == tenant_id,
    ).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Despesa não encontrada")

    occ = Occurrence(tenant_id=tenant_id, **payload.model_dump())
    db.add(occ)
    db.commit()
    db.refresh(occ)
    return get_occurrence(occ.id, current_user, db)


@router.get("/{occurrence_id}", response_model=OccurrenceOut)
def get_occurrence(
    occurrence_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    occ = _occurrence_query(db).filter(Occurrence.id == occurrence_id).first()
    if not occ:
        raise HTTPException(status_code=404, detail="Ocorrência não encontrada")
    _check_access(db, current_user, occ.tenant_id)
    return occ


@router.patch("/{occurrence_id}", response_model=OccurrenceOut)
def update_occurrence(
    occurrence_id: int,
    payload: OccurrenceUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    occ = db.query(Occurrence).filter(Occurrence.id == occurrence_id).first()
    if not occ:
        raise HTTPException(status_code=404, detail="Ocorrência não encontrada")
    _check_access(db, current_user, occ.tenant_id)

    data = payload.model_dump(exclude_none=True)

    # Se marcando como pago e não forneceu paid_at
    if data.get("status") == "paid" and "paid_at" not in data:
        data["paid_at"] = sp_now_naive()
    elif data.get("status") == "pending":
        data["paid_at"] = None

    for field, value in data.items():
        setattr(occ, field, value)
    db.commit()
    db.refresh(occ)
    return get_occurrence(occ.id, current_user, db)


@router.delete("/{occurrence_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_occurrence(
    occurrence_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    occ = db.query(Occurrence).filter(Occurrence.id == occurrence_id).first()
    if not occ:
        raise HTTPException(status_code=404, detail="Ocorrência não encontrada")
    _check_access(db, current_user, occ.tenant_id)
    db.delete(occ)
    db.commit()


# ── Occurrence Payments ───────────────────────────────────────
@router.get("/{occurrence_id}/payments", response_model=list[OccurrencePaymentOut])
def list_occurrence_payments(
    occurrence_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    occ = db.query(Occurrence).filter(Occurrence.id == occurrence_id).first()
    if not occ:
        raise HTTPException(status_code=404, detail="Ocorrência não encontrada")
    _check_access(db, current_user, occ.tenant_id)
    return db.query(OccurrencePayment).filter(
        OccurrencePayment.occurrence_id == occurrence_id
    ).order_by(OccurrencePayment.paid_at.desc()).all()


@router.post("/{occurrence_id}/payments", response_model=OccurrencePaymentOut, status_code=status.HTTP_201_CREATED)
def create_occurrence_payment(
    occurrence_id: int,
    payload: OccurrencePaymentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    occ = db.query(Occurrence).filter(Occurrence.id == occurrence_id).first()
    if not occ:
        raise HTTPException(status_code=404, detail="Ocorrência não encontrada")
    _check_access(db, current_user, occ.tenant_id)

    data = payload.model_dump()
    if not data.get("paid_at"):
        data["paid_at"] = sp_now_naive()

    payment = OccurrencePayment(
        occurrence_id=occ.id,
        tenant_id=occ.tenant_id,
        **data
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)

    _sync_occurrence_payment_status(db, occ)
    return payment


@router.delete("/{occurrence_id}/payments/{payment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_occurrence_payment(
    occurrence_id: int,
    payment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    payment = db.query(OccurrencePayment).filter(
        OccurrencePayment.id == payment_id,
        OccurrencePayment.occurrence_id == occurrence_id
    ).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Pagamento não encontrado")
    _check_access(db, current_user, payment.tenant_id)

    occ = db.query(Occurrence).filter(Occurrence.id == occurrence_id).first()
    db.delete(payment)
    db.commit()

    if occ:
        _sync_occurrence_payment_status(db, occ)


# ── Invoice Items (Fatura de Cartão) ──────────────────────────
@router.get("/{occurrence_id}/invoice-items", response_model=list[InvoiceItemOut])
def list_invoice_items(
    occurrence_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    occ = db.query(Occurrence).filter(Occurrence.id == occurrence_id).first()
    if not occ:
        raise HTTPException(status_code=404, detail="Ocorrência não encontrada")
    _check_access(db, current_user, occ.tenant_id)
    return db.query(InvoiceItem).options(
        joinedload(InvoiceItem.cost_center),
        joinedload(InvoiceItem.person)
    ).filter(
        InvoiceItem.occurrence_id == occurrence_id
    ).order_by(InvoiceItem.purchase_date.asc(), InvoiceItem.id.asc()).all()


@router.post("/{occurrence_id}/invoice-items", response_model=InvoiceItemOut, status_code=status.HTTP_201_CREATED)
def create_invoice_item(
    occurrence_id: int,
    payload: InvoiceItemCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    occ = db.query(Occurrence).filter(Occurrence.id == occurrence_id).first()
    if not occ:
        raise HTTPException(status_code=404, detail="Ocorrência não encontrada")
    _check_access(db, current_user, occ.tenant_id)

    item = InvoiceItem(
        occurrence_id=occ.id,
        tenant_id=occ.tenant_id,
        **payload.model_dump()
    )
    db.add(item)
    db.commit()
    db.refresh(item)

    _sync_credit_card_occurrence_value(db, occ)
    return db.query(InvoiceItem).options(
        joinedload(InvoiceItem.cost_center),
        joinedload(InvoiceItem.person)
    ).filter(InvoiceItem.id == item.id).first()


@router.patch("/{occurrence_id}/invoice-items/{item_id}", response_model=InvoiceItemOut)
def update_invoice_item(
    occurrence_id: int,
    item_id: int,
    payload: InvoiceItemUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    item = db.query(InvoiceItem).filter(
        InvoiceItem.id == item_id,
        InvoiceItem.occurrence_id == occurrence_id
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item não encontrado")
    _check_access(db, current_user, item.tenant_id)

    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(item, k, v)
    db.commit()
    db.refresh(item)

    occ = db.query(Occurrence).filter(Occurrence.id == occurrence_id).first()
    if occ:
        _sync_credit_card_occurrence_value(db, occ)

    return db.query(InvoiceItem).options(
        joinedload(InvoiceItem.cost_center),
        joinedload(InvoiceItem.person)
    ).filter(InvoiceItem.id == item.id).first()


@router.delete("/{occurrence_id}/invoice-items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_invoice_item(
    occurrence_id: int,
    item_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    item = db.query(InvoiceItem).filter(
        InvoiceItem.id == item_id,
        InvoiceItem.occurrence_id == occurrence_id
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item não encontrado")
    _check_access(db, current_user, item.tenant_id)

    occ = db.query(Occurrence).filter(Occurrence.id == occurrence_id).first()
    db.delete(item)
    db.commit()

    if occ:
        _sync_credit_card_occurrence_value(db, occ)
