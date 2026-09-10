"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { expensesApi, occurrencesApi, costCentersApi } from "@/lib/api";

const MONTHS_PT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function formatBRL(v: number | string) {
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function ExpenseDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router  = useRouter();
  const [expense, setExpense]       = useState<any>(null);
  const [occurrences, setOccs]      = useState<any[]>([]);
  const [persons, setPersons]       = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
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
          person_id: exp.person_id ? String(exp.person_id) : "",
          cost_center_id: exp.cost_center_id ? String(exp.cost_center_id) : "",
          recurrence_day: exp.recurrence_day || "",
          recurring_value: exp.recurring_value != null ? String(exp.recurring_value) : "",
          recurrence_period: exp.recurrence_period || "monthly",
          recurrence_month: exp.recurrence_month ? String(exp.recurrence_month) : "1",
          important_details: exp.important_details || [],
        });
        // Carrega ocorrências e centros de custo do tenant
        const { getActiveTenantId } = await import("@/lib/auth");
        const tid = exp.tenant_id || getActiveTenantId();
        if (tid) {
          costCentersApi.list(tid, "person").then(setPersons).catch(() => {});
          costCentersApi.list(tid, "category").then(setCategories).catch(() => {});
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

  function addDetail() {
    setEditData((d: any) => ({
      ...d,
      important_details: [...(d.important_details || []), { label: "", value: "" }],
    }));
  }

  function updateDetail(index: number, field: "label" | "value", val: string) {
    setEditData((d: any) => {
      const copy = [...(d.important_details || [])];
      copy[index] = { ...copy[index], [field]: val };
      return { ...d, important_details: copy };
    });
  }

  function removeDetail(index: number) {
    setEditData((d: any) => ({
      ...d,
      important_details: (d.important_details || []).filter((_: any, i: number) => i !== index),
    }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const filteredDetails = (editData.important_details || [])
        .filter((d: any) => d.label?.trim() && d.value?.trim())
        .map((d: any) => ({ label: d.label.trim(), value: d.value.trim() }));

      const payload: any = {
        title: editData.title?.trim(),
        description: editData.description?.trim() || null,
        person_id: editData.person_id ? Number(editData.person_id) : null,
        cost_center_id: editData.cost_center_id ? Number(editData.cost_center_id) : null,
        important_details: filteredDetails,
      };
      if (editData.recurrence_day !== "" && editData.recurrence_day != null) {
        payload.recurrence_day = Number(editData.recurrence_day);
      } else {
        payload.recurrence_day = null;
      }
      if (expense.type === "recurring") {
        payload.recurrence_period = editData.recurrence_period || "monthly";
        payload.recurrence_month = editData.recurrence_period === "yearly" ? (Number(editData.recurrence_month) || 1) : null;
        payload.recurring_value = editData.recurring_value ? Number(editData.recurring_value) : null;
      }
      await expensesApi.update(Number(id), payload);
      const updated = await expensesApi.get(Number(id));
      setExpense(updated);
      setEditData({
        title: updated.title,
        description: updated.description || "",
        person_id: updated.person_id ? String(updated.person_id) : "",
        cost_center_id: updated.cost_center_id ? String(updated.cost_center_id) : "",
        recurrence_day: updated.recurrence_day || "",
        recurring_value: updated.recurring_value != null ? String(updated.recurring_value) : "",
        recurrence_period: updated.recurrence_period || "monthly",
        recurrence_month: updated.recurrence_month ? String(updated.recurrence_month) : "1",
        important_details: updated.important_details || [],
      });
      setEditing(false);
    } catch (err: any) {
      alert(err.message || "Erro ao salvar alterações da despesa");
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
          {expense.person && (
            <span style={{
              padding: "4px 12px", borderRadius: "var(--radius-full)",
              background: "rgba(255,255,255,0.06)", border: `1px solid ${expense.person.color || "var(--border)"}`,
              color: "var(--text-primary)", fontSize: "0.8rem", fontWeight: 600,
              display: "flex", alignItems: "center", gap: "6px",
            }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: expense.person.color || "var(--accent)" }} />
              👤 {expense.person.name}
            </span>
          )}
          {expense.cost_center && (
            <span style={{
              padding: "4px 12px", borderRadius: "var(--radius-full)",
              background: "rgba(255,255,255,0.06)", border: `1px solid ${expense.cost_center.color || "var(--border)"}`,
              color: "var(--text-primary)", fontSize: "0.8rem", fontWeight: 600,
              display: "flex", alignItems: "center", gap: "6px",
            }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: expense.cost_center.color || "var(--accent)" }} />
              📁 {expense.cost_center.name}
            </span>
          )}
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

        {expense.type === "recurring" && (
          <div className="grid-2">
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Periodicidade / Vencimento</div>
              <div style={{ fontWeight: 700 }}>
                {expense.recurrence_period === "yearly"
                  ? `📅 Anual (${MONTHS_PT[(expense.recurrence_month || 1) - 1]}) · Dia ${expense.recurrence_day || 1}`
                  : `🔄 Mensal · Todo dia ${expense.recurrence_day || 1}`}
              </div>
            </div>
            {expense.recurring_value != null && Number(expense.recurring_value) > 0 && (
              <div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Valor Inicial / Fixo</div>
                <div style={{ fontWeight: 700, color: "var(--accent)" }}>{formatBRL(expense.recurring_value)}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Detalhes importantes */}
      <div className="card" style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
          <h3 style={{ margin: 0, fontSize: "0.95rem" }}>📌 Detalhes Importantes</h3>
          <button className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>
            ✏️ Editar Detalhes
          </button>
        </div>
        {expense.important_details?.length > 0 ? (
          expense.important_details.map((d: any, i: number) => (
            <div key={i} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "8px 0",
              borderBottom: i < expense.important_details.length - 1 ? "1px solid var(--border)" : "none",
            }}>
              <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>{d.label}</span>
              <span style={{ fontSize: "0.85rem", fontWeight: 600, fontFamily: "monospace" }}>{d.value}</span>
            </div>
          ))
        ) : (
          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontStyle: "italic" }}>
            Nenhum código ou detalhe adicional cadastrado (ex: Código do cliente, UC, link, etc).
          </div>
        )}
      </div>

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
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">👤 Responsável / Pessoa</label>
                  <select
                    className="form-input"
                    value={editData.person_id || ""}
                    onChange={e => setEditData((d: any) => ({ ...d, person_id: e.target.value ? Number(e.target.value) : null }))}
                  >
                    <option value="">Geral / Compartilhado</option>
                    {persons.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">📁 Centro de Custo / Categoria</label>
                  <select
                    className="form-input"
                    value={editData.cost_center_id || ""}
                    onChange={e => setEditData((d: any) => ({ ...d, cost_center_id: e.target.value ? Number(e.target.value) : null }))}
                  >
                    <option value="">Nenhuma Categoria</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              {expense.type === "recurring" && (
                <>
                  <div className="form-group">
                    <label className="form-label">Periodicidade da Recorrência</label>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                      <button
                        type="button"
                        onClick={() => setEditData((d: any) => ({ ...d, recurrence_period: "monthly" }))}
                        style={{
                          padding: "8px 12px",
                          borderRadius: "var(--radius-md)",
                          border: `2px solid ${editData.recurrence_period === "monthly" ? "var(--accent)" : "var(--border)"}`,
                          background: editData.recurrence_period === "monthly" ? "var(--accent-dim)" : "var(--bg-elevated)",
                          color: editData.recurrence_period === "monthly" ? "var(--accent-light)" : "var(--text-secondary)",
                          fontWeight: 600, fontSize: "0.85rem", cursor: "pointer",
                        }}
                      >
                        🔄 Mensal
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditData((d: any) => ({ ...d, recurrence_period: "yearly" }))}
                        style={{
                          padding: "8px 12px",
                          borderRadius: "var(--radius-md)",
                          border: `2px solid ${editData.recurrence_period === "yearly" ? "var(--accent)" : "var(--border)"}`,
                          background: editData.recurrence_period === "yearly" ? "var(--accent-dim)" : "var(--bg-elevated)",
                          color: editData.recurrence_period === "yearly" ? "var(--accent-light)" : "var(--text-secondary)",
                          fontWeight: 600, fontSize: "0.85rem", cursor: "pointer",
                        }}
                      >
                        📅 Anual
                      </button>
                    </div>
                  </div>

                  <div className="grid-2">
                    {editData.recurrence_period === "yearly" && (
                      <div className="form-group">
                        <label className="form-label">Mês de Vencimento</label>
                        <select
                          className="form-input"
                          value={editData.recurrence_month || "1"}
                          onChange={e => setEditData((d: any) => ({ ...d, recurrence_month: e.target.value }))}
                        >
                          {["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"].map((m, idx) => (
                            <option key={idx + 1} value={idx + 1}>{m}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className="form-group">
                      <label className="form-label">Dia de Vencimento</label>
                      <input type="number" className="form-input" min={1} max={31}
                        value={editData.recurrence_day}
                        onChange={e => setEditData((d: any) => ({ ...d, recurrence_day: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Valor Inicial / Fixo (R$)</label>
                      <input type="number" step="0.01" min="0" className="form-input"
                        placeholder="Ex: 150.00"
                        value={editData.recurring_value}
                        onChange={e => setEditData((d: any) => ({ ...d, recurring_value: e.target.value }))} />
                    </div>
                  </div>
                </>
              )}

              {expense.type === "single" && (
                <div className="form-group">
                  <label className="form-label">Dia de Vencimento</label>
                  <input type="number" className="form-input" min={1} max={31}
                    value={editData.recurrence_day}
                    onChange={e => setEditData((d: any) => ({ ...d, recurrence_day: e.target.value }))} />
                </div>
              )}

              {/* Detalhes Importantes */}
              <div className="form-group">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                  <label className="form-label" style={{ margin: 0 }}>
                    📌 Detalhes Importantes
                  </label>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={addDetail}>
                    + Adicionar
                  </button>
                </div>
                <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "8px" }}>
                  Ex: Código do cliente, Unidade Consumidora, link para 2ª via, etc.
                </p>
                {(editData.important_details || []).map((d: any, i: number) => (
                  <div key={i} style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                    <input
                      className="form-input" placeholder="Rótulo (ex: Código)"
                      style={{ flex: 1 }}
                      value={d.label} onChange={e => updateDetail(i, "label", e.target.value)}
                    />
                    <input
                      className="form-input" placeholder="Valor"
                      style={{ flex: 1 }}
                      value={d.value} onChange={e => updateDetail(i, "value", e.target.value)}
                    />
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      style={{ padding: "0 10px" }}
                      onClick={() => removeDetail(i)}
                    >✕</button>
                  </div>
                ))}
                {(!editData.important_details || editData.important_details.length === 0) && (
                  <div style={{
                    border: "1px dashed var(--border)", borderRadius: "var(--radius-md)",
                    padding: "12px", textAlign: "center", color: "var(--text-muted)", fontSize: "0.8rem",
                  }}>
                    Nenhum detalhe adicionado
                  </div>
                )}
              </div>

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
