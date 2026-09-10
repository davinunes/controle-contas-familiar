from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from datetime import date
from decimal import Decimal
from typing import Optional

from app.database import get_db
from app.models.occurrence import Occurrence
from app.models.attachment import Attachment
from app.models.expense import Expense
from app.models.user import User
from app.routers.auth import get_current_user
from app.schemas.expense import DashboardSummary, FiadoData, ResumoItem

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _has_attachment(db: Session, occurrence_id: int, att_type: str) -> bool:
    return db.query(Attachment).filter(
        Attachment.occurrence_id == occurrence_id,
        Attachment.type == att_type,
    ).first() is not None


@router.get("/resumo", response_model=list[ResumoItem])
def get_resumo(
    tenant_id: int = Query(...),
    month: str = Query(..., description="YYYY-MM"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Retorna a lista consolidada para o resumo:
    - Ocorrências do mês selecionado (pendentes e pagas)
    - Ocorrências vencidas de meses anteriores (pendentes)
    """
    try:
        ref_month = date.fromisoformat(f"{month}-01")
    except ValueError:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Formato inválido. Use YYYY-MM")

    # Ocorrências do mês
    current_occs = (
        db.query(Occurrence)
        .filter(
            Occurrence.tenant_id == tenant_id,
            Occurrence.reference_month == ref_month,
        )
        .order_by(Occurrence.due_date)
        .all()
    )

    # Vencidas de meses anteriores (apenas pendentes)
    overdue_occs = (
        db.query(Occurrence)
        .filter(
            Occurrence.tenant_id == tenant_id,
            Occurrence.status == "pending",
            Occurrence.reference_month < ref_month,
        )
        .order_by(Occurrence.due_date)
        .all()
    )

    today = date.today()
    items = []

    for occ in overdue_occs + current_occs:
        expense = db.query(Expense).filter(Expense.id == occ.expense_id).first()
        items.append(ResumoItem(
            occurrence_id=occ.id,
            expense_title=expense.title if expense else "—",
            value=occ.value,
            due_date=occ.due_date,
            status=occ.status,
            is_overdue=occ.status == "pending" and occ.due_date < today,
            reference_month=occ.reference_month,
            has_boleto=_has_attachment(db, occ.id, "boleto"),
            has_danfe=_has_attachment(db, occ.id, "danfe"),
            has_comprovante=_has_attachment(db, occ.id, "comprovante"),
        ))

    return items


@router.get("/whatsapp")
def get_whatsapp_text(
    tenant_id: int = Query(...),
    month: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Gera texto formatado para copiar no WhatsApp."""
    from calendar import month_name
    import locale

    try:
        ref_month = date.fromisoformat(f"{month}-01")
    except ValueError:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Formato inválido. Use YYYY-MM")

    month_pt = [
        "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
        "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"
    ][ref_month.month - 1]

    today = date.today()

    # Vencidas
    overdue = (
        db.query(Occurrence)
        .filter(
            Occurrence.tenant_id == tenant_id,
            Occurrence.status == "pending",
            Occurrence.reference_month < ref_month,
        )
        .order_by(Occurrence.due_date)
        .all()
    )

    # Mês atual
    current = (
        db.query(Occurrence)
        .filter(
            Occurrence.tenant_id == tenant_id,
            Occurrence.reference_month == ref_month,
        )
        .order_by(Occurrence.due_date)
        .all()
    )

    lines = [f"📊 *Contas – {month_pt}/{ref_month.year}*"]

    total_pending = Decimal("0")

    if overdue:
        lines.append("\n⚠️ *Vencidas de meses anteriores:*")
        for occ in overdue:
            expense = db.query(Expense).filter(Expense.id == occ.expense_id).first()
            title = expense.title if expense else "—"
            ref_label = occ.reference_month.strftime("%b").capitalize()
            lines.append(f"  • {title} ({ref_label}) — R$ {occ.value:,.2f}".replace(",", "X").replace(".", ",").replace("X", "."))
            total_pending += occ.value

    if current:
        lines.append(f"\n📋 *{month_pt}/{ref_month.year}:*")
        pending_this = [o for o in current if o.status == "pending"]
        paid_this    = [o for o in current if o.status == "paid"]

        for occ in pending_this:
            expense = db.query(Expense).filter(Expense.id == occ.expense_id).first()
            title = expense.title if expense else "—"
            due_label = occ.due_date.strftime("%d/%m")
            lines.append(f"  • {title} — R$ {occ.value:,.2f} | Vence {due_label}".replace(",", "X").replace(".", ",").replace("X", "."))
            total_pending += occ.value

        for occ in paid_this:
            expense = db.query(Expense).filter(Expense.id == occ.expense_id).first()
            title = expense.title if expense else "—"
            lines.append(f"  • {title} ✅ (pago)")

    lines.append(f"\n💰 *Total pendente: R$ {total_pending:,.2f}*".replace(",", "X").replace(".", ",").replace("X", "."))

    return {"text": "\n".join(lines)}


@router.get("/fiado", response_model=FiadoData)
def get_fiado(
    tenant_id: int = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Calcula o total de débito acumulado vs reembolsado."""
    today = date.today()

    # Total pendente (todos os meses, até hoje)
    total_pending = db.query(func.sum(Occurrence.value)).filter(
        Occurrence.tenant_id == tenant_id,
        Occurrence.status == "pending",
        Occurrence.due_date <= today,
    ).scalar() or Decimal("0")

    # Total pago (histórico)
    total_paid = db.query(func.sum(Occurrence.value)).filter(
        Occurrence.tenant_id == tenant_id,
        Occurrence.status == "paid",
    ).scalar() or Decimal("0")

    # Série mensal (últimos 6 meses)
    monthly_series = []
    for i in range(5, -1, -1):
        m = today.month - i
        y = today.year
        while m <= 0:
            m += 12
            y -= 1
        ref = date(y, m, 1)

        p = db.query(func.sum(Occurrence.value)).filter(
            Occurrence.tenant_id == tenant_id,
            Occurrence.reference_month == ref,
            Occurrence.status == "pending",
        ).scalar() or 0

        pd = db.query(func.sum(Occurrence.value)).filter(
            Occurrence.tenant_id == tenant_id,
            Occurrence.reference_month == ref,
            Occurrence.status == "paid",
        ).scalar() or 0

        monthly_series.append({
            "month": ref.strftime("%Y-%m"),
            "pending": float(p),
            "paid": float(pd),
        })

    return FiadoData(
        total_debt=total_pending,
        total_paid=total_paid,
        balance=total_pending,
        monthly_series=monthly_series,
    )


@router.post("/generate-occurrences")
def trigger_generate(
    year: int = Query(...),
    month: int = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Endpoint manual para gerar ocorrências de um mês específico (admin)."""
    if not current_user.is_superadmin:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Apenas superadmin")
    from app.services.occurrence_service import generate_occurrences_for_month
    count = generate_occurrences_for_month(db, year, month)
    return {"created": count}
