from datetime import date, timedelta
from calendar import monthrange
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.models.expense import Expense, ExpenseType
from app.models.occurrence import Occurrence


def _first_of_month(year: int, month: int) -> date:
    return date(year, month, 1)


def _due_date_for_month(day: int, year: int, month: int) -> date:
    """Retorna a data de vencimento ajustada ao último dia do mês se necessário."""
    last_day = monthrange(year, month)[1]
    return date(year, month, min(day, last_day))


def generate_occurrences_for_month(db: Session, year: int, month: int) -> int:
    """
    Gera as ocorrências do mês para todas as despesas ativas de todos os tenants.
    Chamado pelo APScheduler no dia 1º de cada mês.
    Retorna o número de ocorrências criadas.
    """
    reference_month = _first_of_month(year, month)
    created = 0

    expenses: list[Expense] = (
        db.query(Expense)
        .filter(Expense.active == True)
        .all()
    )

    for expense in expenses:
        # Verifica se já existe ocorrência para este mês
        existing = db.query(Occurrence).filter(
            and_(
                Occurrence.expense_id == expense.id,
                Occurrence.reference_month == reference_month,
            )
        ).first()

        if existing:
            continue

        if expense.type == ExpenseType.recurring:
            period = getattr(expense, "recurrence_period", "monthly") or "monthly"
            if period == "yearly":
                rec_month = getattr(expense, "recurrence_month", None)
                # Se for anual e tiver mês configurado, só gera se for o mês correto
                if rec_month and rec_month != month:
                    continue

            # Recorrente: usa o valor inicial/fixo cadastrado ou 0
            day = expense.recurrence_day or 1
            init_val = expense.recurring_value or 0
            occ = Occurrence(
                expense_id=expense.id,
                tenant_id=expense.tenant_id,
                reference_month=reference_month,
                value=init_val,
                due_date=_due_date_for_month(day, year, month),
            )
            db.add(occ)
            created += 1

        elif expense.type == ExpenseType.installment and expense.first_due_date:
            # Parcelada: descobre qual parcela corresponde a este mês
            first = expense.first_due_date
            first_ref = _first_of_month(first.year, first.month)
            delta_months = (year - first_ref.year) * 12 + (month - first_ref.month) + 1

            if 1 <= delta_months <= (expense.total_installments or 0):
                day = first.day
                occ = Occurrence(
                    expense_id=expense.id,
                    tenant_id=expense.tenant_id,
                    reference_month=reference_month,
                    installment_number=delta_months,
                    value=expense.installment_value or 0,
                    due_date=_due_date_for_month(day, year, month),
                )
                db.add(occ)
                created += 1

        # Avulsas (single) não são geradas automaticamente

    db.commit()
    return created


def get_pending_overdue(db: Session, tenant_id: int) -> list[Occurrence]:
    """Retorna ocorrências pendentes com due_date anterior ao mês atual."""
    today = date.today()
    current_month = _first_of_month(today.year, today.month)
    return (
        db.query(Occurrence)
        .filter(
            and_(
                Occurrence.tenant_id == tenant_id,
                Occurrence.status == "pending",
                Occurrence.reference_month < current_month,
            )
        )
        .order_by(Occurrence.due_date)
        .all()
    )
