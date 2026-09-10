"use client";
import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { expensesApi, occurrencesApi } from "@/lib/api";

const MONTHS_PT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function formatBRL(v: number | string) {
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function ExpenseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router  = useRouter();
  const [expense, setExpense]       = useState<any>(null);
  const [occurrences, setOccs]      = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [editing, setEditing]       = useState(false);
  const [editData, setEditData]     = useState<any>({});
  const [saving, setSaving]         = useState(false);
  const [deleting, setDeleting]     = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const exp = await expensesApi.get(Number(id));
        setExpense(exp);
        setEditData({
          title: exp.title,
          description: exp.description || "",
          recurrence_day: exp.recurrence_day || "",
          important_details: exp.important_details || [],
        });
        // Carrega ocorrências
        const { getActiveTenantId } = await import("@/lib/auth");
        const tid = getActiveTenantId();
        if (tid) {
          const occs = await occurrencesApi.list(tid, { expense_id: Number(id) });
          setOccs(occs.sort((a: any, b: any) =>
            new Date(b.reference_month).getTime() - new Date(a.reference_month).getTime()
          ));
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  async function handleSave() {
    setSaving(true);
    try {
      await expensesApi.update(Number(id), editData);
      const updated = await expensesApi.get(Number(id));
      setExpense(updated);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Excluir a despesa "${expense?.title}"? Todas as ocorrências serão removidas.`)) return;
    setDeleting(true);
    try {
      await expensesApi.delete(Number(id));
      router.push("/despesas");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;
  if (!expense) return <div className="container" style={{ paddingTop: 20 }}>Despesa não encontrada.</div>;

  return (
    <div className="container" style={{ paddingTop: "20px", paddingBottom: "32px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
        <button className="btn btn-secondary btn-sm" onClick={() => router.back()}>← Voltar</button>
        <h1 style={{ fontSize: "1.3rem", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {expense.title}
        </h1>
        <button className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>✏️</button>
        <button className="btn btn-danger btn-sm" onClick={handleDelete} disabled={deleting}>
          {deleting ? "..." : "🗑️"}
        </button>
      </div>

      {/* Info card */}
      <div className="card" style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "12px" }}>
          <span style={{
            padding: "4px 12px", borderRadius: "var(--radius-full)",
            background: "var(--accent-dim)", color: "var(--accent-light)",
            fontSize: "0.8rem", fontWeight: 600,
          }}>
            {expense.type === "single" ? "⚡ Avulsa" : expense.type === "installment" ? "📦 Parcelada" : "🔄 Recorrente"}
          </span>
          {!expense.active && (
            <span className="badge" style={{ background: "var(--bg-hover)", color: "var(--text-muted)" }}>
              Inativa
            </span>
          )}
        </div>

        {expense.description && (
          <p style={{ fontSize: "0.9rem", marginBottom: "12px" }}>{expense.description}</p>
        )}

        {expense.type === "installment" && (
          <div className="grid-2">
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Parcelas</div>
              <div style={{ fontWeight: 700 }}>{expense.total_installments}×</div>
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Valor/Parcela</div>
              <div style={{ fontWeight: 700 }}>{formatBRL(expense.installment_value || 0)}</div>
            </div>
          </div>
        )}

        {expense.type === "recurring" && expense.recurrence_day && (
          <div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Vencimento</div>
            <div style={{ fontWeight: 700 }}>Todo dia {expense.recurrence_day}</div>
          </div>
        )}
      </div>

      {/* Detalhes importantes */}
      {expense.important_details?.length > 0 && (
        <div className="card" style={{ marginBottom: "24px" }}>
          <h3 style={{ marginBottom: "12px", fontSize: "0.9rem" }}>📌 Detalhes Importantes</h3>
          {expense.important_details.map((d: any, i: number) => (
            <div key={i} style={{
              display: "flex", justifyContent: "space-between",
              padding: "8px 0",
              borderBottom: i < expense.important_details.length - 1 ? "1px solid var(--border)" : "none",
            }}>
              <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>{d.label}</span>
              <span style={{ fontSize: "0.85rem", fontWeight: 600, fontFamily: "monospace" }}>{d.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Ocorrências */}
      <h2 style={{ fontSize: "1rem", marginBottom: "12px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
        Histórico de Ocorrências
      </h2>

      {occurrences.length === 0 ? (
        <div style={{ textAlign: "center", padding: "24px", color: "var(--text-muted)", fontSize: "0.85rem" }}>
          Nenhuma ocorrência gerada ainda.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {occurrences.map(occ => {
            const ref = new Date(occ.reference_month);
            const label = `${MONTHS_PT[ref.getMonth()]}/${ref.getFullYear()}`;
            const isPaid = occ.status === "paid";
            return (
              <div
                key={occ.id}
                className="card"
                style={{
                  padding: "12px 14px", cursor: "pointer",
                  borderLeft: `3px solid ${isPaid ? "var(--success)" : "var(--accent)"}`,
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}
                onClick={() => router.push(`/despesas/${id}/${occ.id}`)}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{label}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "2px" }}>
                    Vence {new Date(occ.due_date + "T00:00:00").toLocaleDateString("pt-BR")}
                    {occ.installment_number ? ` · Parcela ${occ.installment_number}` : ""}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
                  <span style={{ fontWeight: 700 }}>{formatBRL(occ.value)}</span>
                  <span className={`badge badge-${isPaid ? "paid" : "pending"}`} style={{ fontSize: "0.7rem" }}>
                    {isPaid ? "Pago" : "Pendente"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de edição */}
      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <h2 style={{ marginBottom: "20px" }}>Editar Despesa</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className="form-group">
                <label className="form-label">Nome</label>
                <input className="form-input" value={editData.title}
                  onChange={e => setEditData((d: any) => ({ ...d, title: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Descrição</label>
                <textarea className="form-input" value={editData.description}
                  onChange={e => setEditData((d: any) => ({ ...d, description: e.target.value }))} />
              </div>
              {expense.type !== "installment" && (
                <div className="form-group">
                  <label className="form-label">Dia de Vencimento</label>
                  <input type="number" className="form-input" min={1} max={31}
                    value={editData.recurrence_day}
                    onChange={e => setEditData((d: any) => ({ ...d, recurrence_day: e.target.value }))} />
                </div>
              )}
              <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave} disabled={saving}>
                  {saving ? "Salvando..." : "Salvar"}
                </button>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setEditing(false)}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
