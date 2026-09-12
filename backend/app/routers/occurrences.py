from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from datetime import date, datetime, timezone
from app.timezone import sp_now_naive, sp_today
from typing import Optional

from app.database import get_db
from app.models.occurrence import Occurrence
from app.models.expense import Expense
from app.models.user import User, UserTenant
from app.routers.auth import get_current_user
from app.schemas.expense import OccurrenceCreate, OccurrenceUpdate, OccurrenceOut

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

    q = (
        db.query(Occurrence)
        .options(joinedload(Occurrence.attachments), joinedload(Occurrence.expense))
        .filter(Occurrence.tenant_id == tenant_id)
    )

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
    """Retorna ocorrências pendentes de meses anteriores."""
    _check_access(db, current_user, tenant_id)
    today = sp_today()
    current_month = date(today.year, today.month, 1)

    return (
        db.query(Occurrence)
        .options(joinedload(Occurrence.attachments), joinedload(Occurrence.expense))
        .filter(
            Occurrence.tenant_id == tenant_id,
            Occurrence.status == "pending",
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
    return occ


@router.get("/{occurrence_id}", response_model=OccurrenceOut)
def get_occurrence(
    occurrence_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    occ = (
        db.query(Occurrence)
        .options(joinedload(Occurrence.attachments), joinedload(Occurrence.expense))
        .filter(Occurrence.id == occurrence_id)
        .first()
    )
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
    return occ


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
