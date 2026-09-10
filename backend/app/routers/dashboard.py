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

from app.services.occurrence_service import generate_occurrences_for_month

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

    # Garante que despesas recorrentes ativas tenham ocorrência criada para o mês visualizado
    try:
        generate_occurrences_for_month(db, ref_month.year, ref_month.month)
    except Exception:
        pass

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
            expense_id=occ.expense_id,
            expense_title=expense.title if expense else "—",
            value=occ.value,
            due_date=occ.due_date,
            status=occ.status,
            is_overdue=occ.status == "pending" and occ.due_date < today,
            reference_month=occ.reference_month,
            has_boleto=_has_attachment(db, occ.id, "boleto"),
            has_danfe=_has_attachment(db, occ.id, "danfe"),
            has_comprovante=_has_attachment(db, occ.id, "comprovante"),
            person_id=expense.person_id if expense else None,
            person_name=expense.person.name if expense and expense.person else None,
            person_color=expense.person.color if expense and expense.person else None,
            cost_center_id=expense.cost_center_id if expense else None,
            cost_center_name=expense.cost_center.name if expense and expense.cost_center else None,
            cost_center_color=expense.cost_center.color if expense and expense.cost_center else None,
        ))

    return items


@router.get("/whatsapp")
def get_whatsapp_text(
    tenant_id: int = Query(...),
    month: str = Query(...),
    person_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Gera texto formatado para copiar no WhatsApp (opcionalmente filtrado por responsável)."""
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

    def fmt_brl(v: Decimal) -> str:
        return f"R$ {v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

    # Filtro base
    q_overdue = (
        db.query(Occurrence)
        .join(Expense, Occurrence.expense_id == Expense.id)
        .filter(
            Occurrence.tenant_id == tenant_id,
            Occurrence.status == "pending",
            Occurrence.reference_month < ref_month,
        )
    )
    q_current = (
        db.query(Occurrence)
        .join(Expense, Occurrence.expense_id == Expense.id)
        .filter(
            Occurrence.tenant_id == tenant_id,
            Occurrence.reference_month == ref_month,
        )
    )

    person_label = ""
    if person_id:
        from app.models.cost_center import CostCenter
        person_cc = db.query(CostCenter).filter(CostCenter.id == person_id).first()
        if person_cc:
            person_label = f" ({person_cc.name})"
        q_overdue = q_overdue.filter(Expense.person_id == person_id)
        q_current = q_current.filter(Expense.person_id == person_id)

    overdue = q_overdue.order_by(Occurrence.due_date).all()
    current = q_current.order_by(Occurrence.due_date).all()

    lines = [f"📊 *Contas{person_label} – {month_pt}/{ref_month.year}*"]

    total_pending = Decimal("0")
    person_totals: dict[str, Decimal] = {}

    if overdue:
        lines.append("\n⚠️ *Vencidas de meses anteriores:*")
        for occ in overdue:
            expense = db.query(Expense).filter(Expense.id == occ.expense_id).first()
            title = expense.title if expense else "—"
            p_tag = f" [{expense.person.name}]" if (expense and expense.person and not person_id) else ""
            ref_label = occ.reference_month.strftime("%b").capitalize()
            lines.append(f"  • {title}{p_tag} ({ref_label}) — {fmt_brl(occ.value)}")
            total_pending += occ.value
            p_name = expense.person.name if (expense and expense.person) else "Geral"
            person_totals[p_name] = person_totals.get(p_name, Decimal("0")) + occ.value

    if current:
        lines.append(f"\n📋 *{month_pt}/{ref_month.year}:*")
        pending_this = [o for o in current if o.status == "pending"]
        paid_this    = [o for o in current if o.status == "paid"]

        for occ in pending_this:
            expense = db.query(Expense).filter(Expense.id == occ.expense_id).first()
            title = expense.title if expense else "—"
            p_tag = f" [{expense.person.name}]" if (expense and expense.person and not person_id) else ""
            due_label = occ.due_date.strftime("%d/%m")
            lines.append(f"  • {title}{p_tag} — {fmt_brl(occ.value)} | Vence {due_label}")
            total_pending += occ.value
            p_name = expense.person.name if (expense and expense.person) else "Geral"
            person_totals[p_name] = person_totals.get(p_name, Decimal("0")) + occ.value

        for occ in paid_this:
            expense = db.query(Expense).filter(Expense.id == occ.expense_id).first()
            title = expense.title if expense else "—"
            p_tag = f" [{expense.person.name}]" if (expense and expense.person and not person_id) else ""
            lines.append(f"  ✓ ~{title}{p_tag}~ — {fmt_brl(occ.value)} (Pago)")

    lines.append(f"\n💰 *Total Pendente:* {fmt_brl(total_pending)}")

    # Se geral e tiver mais de um responsável, mostra subtotais
    if not person_id and len(person_totals) > 1:
        lines.append("\n👥 *Subtotais por Responsável:*")
        for p_name, p_tot in sorted(person_totals.items()):
            lines.append(f"  • {p_name}: {fmt_brl(p_tot)}")

    lines.append("\n_Enviado pelo app Organizar_")
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
