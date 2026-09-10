"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { expensesApi, costCentersApi } from "@/lib/api";
import { getActiveTenantId } from "@/lib/auth";
import QRScanner from "@/components/QRScanner";

interface Detail { label: string; value: string; }

export default function NovaDespesaPage() {
  const router   = useRouter();
  const tenantId = getActiveTenantId();

  const [type, setType]   = useState<"single"|"installment"|"recurring">("single");
  const [title, setTitle] = useState("");
  const [description, setDesc] = useState("");
  const [personId, setPersonId] = useState("");
  const [costCenterId, setCostCenterId] = useState("");
  const [persons, setPersons] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [recurrenceDay, setRecDay]     = useState("");
  const [totalInst, setTotalInst]      = useState("");
  const [instValue, setInstValue]      = useState("");
  const [firstDue, setFirstDue]        = useState("");
  const [details, setDetails]          = useState<Detail[]>([]);
  const [nfUrl, setNfUrl]              = useState("");
  const [showScanner, setShowScanner]  = useState(false);
  const [saving, setSaving]            = useState(false);
  const [error, setError]              = useState("");

  useEffect(() => {
    if (tenantId) {
      costCentersApi.list(tenantId, "person").then(setPersons).catch(() => {});
      costCentersApi.list(tenantId, "category").then(setCategories).catch(() => {});
    }
  }, [tenantId]);

  function addDetail()         { setDetails(d => [...d, { label: "", value: "" }]); }
  function removeDetail(i: number) { setDetails(d => d.filter((_, idx) => idx !== i)); }
  function updateDetail(i: number, field: "label" | "value", v: string) {
    setDetails(d => d.map((x, idx) => idx === i ? { ...x, [field]: v } : x));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tenantId) return;
    setSaving(true);
    setError("");
    try {
      const payload: any = {
        title: title.trim(),
        description: description.trim() || null,
        type,
        person_id: personId ? parseInt(personId) : null,
        cost_center_id: costCenterId ? parseInt(costCenterId) : null,
      };
      if (type === "installment") {
        payload.total_installments = parseInt(totalInst);
        payload.installment_value  = parseFloat(instValue);
        payload.first_due_date     = firstDue || null;
      }
      if (type === "recurring") {
        payload.recurrence_day    = parseInt(recurrenceDay) || 1;
        payload.important_details = details.filter(d => d.label && d.value);
      }
      if (type === "single") {
        payload.recurrence_day = parseInt(recurrenceDay) || new Date().getDate();
      }
      await expensesApi.create(tenantId, payload);
      router.push("/despesas");
    } catch (err: any) {
      setError(err.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="container" style={{ paddingTop: "20px", paddingBottom: "32px" }}>
      {showScanner && (
        <QRScanner
          onDetect={url => { setNfUrl(url); setShowScanner(false); }}
          onClose={() => setShowScanner(false)}
        />
      )}

      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
        <button className="btn btn-secondary btn-sm" onClick={() => router.back()}>← Voltar</button>
        <h1 style={{ fontSize: "1.3rem" }}>Nova Despesa</h1>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

        {/* Tipo */}
        <div className="form-group">
          <label className="form-label">Tipo</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
            {(["single","installment","recurring"] as const).map(t => (
              <button
                key={t} type="button"
                onClick={() => setType(t)}
                style={{
                  padding: "10px 6px",
                  borderRadius: "var(--radius-md)",
                  border: `2px solid ${type === t ? "var(--accent)" : "var(--border)"}`,
                  background: type === t ? "var(--accent-dim)" : "var(--bg-elevated)",
                  color: type === t ? "var(--accent-light)" : "var(--text-secondary)",
                  fontWeight: type === t ? 700 : 400,
                  fontSize: "0.8rem",
                  cursor: "pointer",
                  textAlign: "center",
                  transition: "var(--transition)",
                }}
              >
                {t === "single"      && <><div>⚡</div>Avulsa</>}
                {t === "installment" && <><div>📦</div>Parcelada</>}
                {t === "recurring"   && <><div>🔄</div>Recorrente</>}
              </button>
            ))}
          </div>
        </div>

        {/* Nome */}
        <div className="form-group">
          <label className="form-label">Nome da Despesa *</label>
          <input
            className="form-input" required
            value={title} onChange={e => setTitle(e.target.value)}
            placeholder="Ex: Conta de Luz, Plano de Saúde..."
          />
        </div>

        {/* Descrição */}
        <div className="form-group">
          <label className="form-label">Descrição (opcional)</label>
          <textarea
            className="form-input"
            value={description} onChange={e => setDesc(e.target.value)}
            placeholder="Observações adicionais..."
            rows={2}
          />
        </div>

        {/* Conceito Duplo: Responsável (Pessoa) e Categoria (Centro de Custo) */}
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">👤 Responsável / Pessoa</label>
            <select
              className="form-input"
              value={personId}
              onChange={e => setPersonId(e.target.value)}
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
              value={costCenterId}
              onChange={e => setCostCenterId(e.target.value)}
            >
              <option value="">Nenhuma Categoria</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Campos condicionais */}
        {type === "single" && (
          <div className="form-group">
            <label className="form-label">Dia de Vencimento</label>
            <input
              type="number" className="form-input" min={1} max={31}
              value={recurrenceDay} onChange={e => setRecDay(e.target.value)}
              placeholder="Dia do mês (1-31)"
            />
          </div>
        )}

        {type === "installment" && (
          <>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Nº de Parcelas *</label>
                <input
                  type="number" className="form-input" min={1} required
                  value={totalInst} onChange={e => setTotalInst(e.target.value)}
                  placeholder="Ex: 10"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Valor por Parcela *</label>
                <input
                  type="number" className="form-input" step="0.01" min={0} required
                  value={instValue} onChange={e => setInstValue(e.target.value)}
                  placeholder="Ex: 150.00"
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Data de Vencimento da 1ª Parcela</label>
              <input
                type="date" className="form-input"
                value={firstDue} onChange={e => setFirstDue(e.target.value)}
              />
            </div>
          </>
        )}

        {type === "recurring" && (
          <>
            <div className="form-group">
              <label className="form-label">Dia de Vencimento Mensal *</label>
              <input
                type="number" className="form-input" min={1} max={31} required
                value={recurrenceDay} onChange={e => setRecDay(e.target.value)}
                placeholder="Ex: 15"
              />
            </div>

            {/* Detalhes Importantes */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                <label className="form-label" style={{ margin: 0 }}>
                  📌 Detalhes Importantes
                </label>
                <button type="button" className="btn btn-secondary btn-sm" onClick={addDetail}>
                  + Adicionar
                </button>
              </div>
              <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "12px" }}>
                Ex: Código da concessionária, Unidade Consumidora, site para baixar boleto, etc.
              </p>
              {details.map((d, i) => (
                <div key={i} style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                  <input
                    className="form-input" placeholder="Rótulo (ex: Código cliente)"
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
                    className="btn btn-danger btn-sm btn-icon"
                    onClick={() => removeDetail(i)}
                  >✕</button>
                </div>
              ))}
              {details.length === 0 && (
                <div style={{
                  border: "1px dashed var(--border)", borderRadius: "var(--radius-md)",
                  padding: "16px", textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem",
                }}>
                  Nenhum detalhe adicionado
                </div>
              )}
            </div>
          </>
        )}

        {error && (
          <div style={{
            background: "var(--danger-dim)", border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: "var(--radius-md)", padding: "12px", color: "var(--danger)", fontSize: "0.85rem",
          }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          className="btn btn-primary btn-full btn-lg"
          disabled={saving || !title.trim()}
        >
          {saving ? "Salvando..." : "💾 Salvar Despesa"}
        </button>
      </form>
    </div>
  );
}
