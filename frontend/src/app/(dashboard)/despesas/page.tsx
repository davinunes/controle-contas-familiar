"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { expensesApi } from "@/lib/api";
import { getActiveTenantId } from "@/lib/auth";
import QRScanner from "@/components/QRScanner";

const TYPE_LABELS: Record<string, string> = {
  single:      "⚡ Avulsa",
  installment: "📦 Parcelada",
  recurring:   "🔄 Recorrente",
};

export default function DespesasPage() {
  const router = useRouter();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [qrProcessing, setQrProcessing]   = useState(false);

  const tenantId = getActiveTenantId();

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const data = await expensesApi.list(tenantId, !showInactive);
      setExpenses(data);
    } finally {
      setLoading(false);
    }
  }, [tenantId, showInactive]);

  useEffect(() => { load(); }, [load]);

  const filtered = expenses.filter(e =>
    e.title.toLowerCase().includes(search.toLowerCase())
  );

  async function toggleActive(exp: any, e: React.MouseEvent) {
    e.stopPropagation();
    await expensesApi.update(exp.id, { active: !exp.active });
    load();
  }

  async function handleQuickQr(qrUrl: string) {
    if (!tenantId) return;
    setShowQrScanner(false);
    setQrProcessing(true);
    try {
      const res = await expensesApi.quickQr(tenantId, qrUrl);
      router.push(`/despesas/${res.expense_id}/${res.occurrence_id}`);
    } catch (err: any) {
      alert(err.message || "Erro ao processar QR Code.");
    } finally {
      setQrProcessing(false);
    }
  }

  return (
    <div className="container" style={{ paddingTop: "20px" }}>
      {showQrScanner && (
        <QRScanner
          onDetect={handleQuickQr}
          onClose={() => setShowQrScanner(false)}
        />
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
        <h1 style={{ fontSize: "1.4rem" }}>Despesas</h1>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setShowQrScanner(true)}
            disabled={qrProcessing || loading}
          >
            📷 {qrProcessing ? "..." : "Ler QR Code"}
          </button>
          <Link href="/despesas/nova" className="btn btn-primary btn-sm">
            + Nova
          </Link>
        </div>
      </div>

      {/* Busca */}
      <input
        type="search"
        className="form-input"
        placeholder="🔍 Buscar despesa..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ marginBottom: "12px" }}
      />

      <label style={{
        display: "flex", alignItems: "center", gap: "8px",
        fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "20px", cursor: "pointer",
      }}>
        <input
          type="checkbox"
          checked={showInactive}
          onChange={e => setShowInactive(e.target.checked)}
        />
        Mostrar inativas
      </label>

      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: "3rem" }}>📋</div>
          <h3 style={{ marginTop: "12px", color: "var(--text-secondary)" }}>Nenhuma despesa cadastrada</h3>
          <Link href="/despesas/nova" className="btn btn-primary" style={{ marginTop: "16px" }}>
            + Cadastrar primeira despesa
          </Link>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {filtered.map(exp => (
            <div
              key={exp.id}
              className="card"
              style={{
                padding: "14px 16px",
                cursor: "pointer",
                opacity: exp.active ? 1 : 0.5,
                borderLeft: `3px solid ${
                  exp.type === "recurring" ? "var(--info)" :
                  exp.type === "installment" ? "var(--warning)" : "var(--accent)"
                }`,
              }}
              onClick={() => router.push(`/despesas/${exp.id}`)}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, marginBottom: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {exp.title}
                  </div>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                    <span style={{
                      fontSize: "0.75rem", padding: "2px 8px",
                      background: "var(--bg-elevated)",
                      borderRadius: "var(--radius-full)",
                      color: "var(--text-muted)",
                    }}>
                      {TYPE_LABELS[exp.type]}
                    </span>
                    {exp.type === "installment" && exp.total_installments && (
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        {exp.total_installments}×
                        {Number(exp.installment_value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </span>
                    )}
                    {exp.type === "recurring" && exp.recurrence_day && (
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        Todo dia {exp.recurrence_day}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={e => toggleActive(exp, e)}
                  className="btn btn-secondary btn-sm"
                  style={{ marginLeft: "8px" }}
                  title={exp.active ? "Desativar" : "Ativar"}
                >
                  {exp.active ? "⏸" : "▶"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
