from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from datetime import date, datetime
from app.timezone import sp_now, sp_today

from app.database import get_db
from app.models.expense import Expense
from app.models.user import User, UserTenant
from app.models.occurrence import Occurrence
from app.routers.auth import get_current_user
from app.schemas.expense import ExpenseCreate, ExpenseUpdate, ExpenseOut, QuickQrCreate
from app.services.occurrence_service import generate_occurrences_for_month

router = APIRouter(prefix="/expenses", tags=["expenses"])


def _check_tenant_access(db: Session, user: User, tenant_id: int):
    if user.is_superadmin:
        return
    link = db.query(UserTenant).filter(
        UserTenant.user_id == user.id,
        UserTenant.tenant_id == tenant_id,
    ).first()
    if not link:
        raise HTTPException(status_code=403, detail="Sem acesso a este tenant")


@router.get("", response_model=list[ExpenseOut])
def list_expenses(
    tenant_id: int = Query(...),
    active_only: bool = Query(True),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _check_tenant_access(db, current_user, tenant_id)
    q = db.query(Expense).filter(Expense.tenant_id == tenant_id)
    if active_only:
        q = q.filter(Expense.active == True)
    return q.order_by(Expense.title).all()


@router.post("", response_model=ExpenseOut, status_code=status.HTTP_201_CREATED)
def create_expense(
    payload: ExpenseCreate,
    tenant_id: int = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _check_tenant_access(db, current_user, tenant_id)

    data = payload.model_dump()
    # Serializa important_details para list of dicts
    if data.get("important_details"):
        data["important_details"] = [d.model_dump() if hasattr(d, "model_dump") else d for d in data["important_details"]]

    expense = Expense(tenant_id=tenant_id, **data)
    db.add(expense)
    db.commit()
    db.refresh(expense)

    # Para parceladas: gera todas as ocorrências imediatamente
    if expense.type == "installment" and expense.first_due_date:
        today = sp_today()
        _generate_installment_occurrences(db, expense)

    # Para avulsas: gera 1 ocorrência no mês atual
    elif expense.type == "single":
        today = sp_today()
        ref_month = date(today.year, today.month, 1)
        from calendar import monthrange
        day = expense.recurrence_day or today.day
        last_day = monthrange(today.year, today.month)[1]
        occ = Occurrence(
            expense_id=expense.id,
            tenant_id=tenant_id,
            reference_month=ref_month,
            value=0,
            due_date=date(today.year, today.month, min(day, last_day)),
        )
        db.add(occ)
        db.commit()

    # Para recorrentes: gera ocorrência se for mensal ou se for o mês anual correspondente
    elif expense.type == "recurring":
        today = sp_today()
        period = getattr(expense, "recurrence_period", "monthly") or "monthly"
        rec_month = getattr(expense, "recurrence_month", None)

        should_generate = True
        if period == "yearly" and rec_month and rec_month != today.month:
            should_generate = False

        if should_generate:
            ref_month = date(today.year, today.month, 1)
            from calendar import monthrange
            day = expense.recurrence_day or 1
            last_day = monthrange(today.year, today.month)[1]
            init_val = expense.recurring_value or 0
            occ = Occurrence(
                expense_id=expense.id,
                tenant_id=tenant_id,
                reference_month=ref_month,
                value=init_val,
                due_date=date(today.year, today.month, min(day, last_day)),
            )
            db.add(occ)
            db.commit()

    return expense


def _generate_installment_occurrences(db: Session, expense: Expense):
    """Gera todas as N parcelas de uma despesa parcelada."""
    from calendar import monthrange

    first = expense.first_due_date
    for i in range(expense.total_installments):
        month = first.month + i
        year  = first.year + (month - 1) // 12
        month = (month - 1) % 12 + 1
        ref_month = date(year, month, 1)
        last_day  = monthrange(year, month)[1]
        due       = date(year, month, min(first.day, last_day))

        existing = db.query(Occurrence).filter(
            Occurrence.expense_id == expense.id,
            Occurrence.reference_month == ref_month,
        ).first()
        if not existing:
            occ = Occurrence(
                expense_id=expense.id,
                tenant_id=expense.tenant_id,
                reference_month=ref_month,
                installment_number=i + 1,
                value=expense.installment_value or 0,
                due_date=due,
            )
            db.add(occ)
    db.commit()


@router.get("/{expense_id}", response_model=ExpenseOut)
def get_expense(
    expense_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Despesa não encontrada")
    _check_tenant_access(db, current_user, expense.tenant_id)
    return expense


@router.patch("/{expense_id}", response_model=ExpenseOut)
def update_expense(
    expense_id: int,
    payload: ExpenseUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Despesa não encontrada")
    _check_tenant_access(db, current_user, expense.tenant_id)

    data = payload.model_dump(exclude_none=True)
    if "important_details" in data:
        if data["important_details"]:
            data["important_details"] = [
                d.model_dump() if hasattr(d, "model_dump") else (d if isinstance(d, dict) else {"label": getattr(d, "label", ""), "value": getattr(d, "value", "")})
                for d in data["important_details"]
            ]
        else:
            data["important_details"] = []

    for field, value in data.items():
        setattr(expense, field, value)
    db.commit()
    db.refresh(expense)
    return expense


@router.delete("/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_expense(
    expense_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Despesa não encontrada")
    _check_tenant_access(db, current_user, expense.tenant_id)
    db.delete(expense)
    db.commit()


@router.post("/quick-qr", response_model=dict, status_code=status.HTTP_201_CREATED)
def create_expense_from_quick_qr(
    payload: QuickQrCreate,
    tenant_id: int = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _check_tenant_access(db, current_user, tenant_id)
    qr_url = payload.qr_url.strip()

    # Proteção contra duplicidade de QR Code no tenant
    existing_occ = (
        db.query(Occurrence)
        .options(joinedload(Occurrence.expense))
        .filter(
            Occurrence.tenant_id == tenant_id,
            Occurrence.nf_url == qr_url,
        )
        .first()
    )
    if existing_occ:
        expense_title = existing_occ.expense.title if existing_occ.expense else "Despesa existente"
        due_str = existing_occ.due_date.strftime("%d/%m/%Y")
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": f"Este QR Code já foi cadastrado anteriormente na despesa '{expense_title}' (Vencimento: {due_str}).",
                "expense_id": existing_occ.expense_id,
                "occurrence_id": existing_occ.id,
            }
        )

    # Criação imediata da despesa avulsa genérica
    now = sp_now()
    title = f"Nota Fiscal - {now.strftime('%d/%m/%Y %H:%M')}"
    expense = Expense(
        tenant_id=tenant_id,
        title=title,
        type="single",
        recurrence_day=now.day,
        active=True,
    )
    db.add(expense)
    db.commit()
    db.refresh(expense)

    ref_month = date(now.year, now.month, 1)
    occ = Occurrence(
        expense_id=expense.id,
        tenant_id=tenant_id,
        reference_month=ref_month,
        value=0,
        due_date=now.date(),
        nf_url=qr_url,
        status="pending",
    )
    db.add(occ)
    db.commit()
    db.refresh(occ)

    return {
        "message": "Despesa criada com sucesso a partir do QR Code",
        "expense_id": expense.id,
        "occurrence_id": occ.id,
        "title": expense.title,
    }
