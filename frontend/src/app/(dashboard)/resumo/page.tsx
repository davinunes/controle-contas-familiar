"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { dashboardApi, occurrencesApi } from "@/lib/api";
import { getActiveTenantId } from "@/lib/auth";
import ArtifactStatusBadges from "@/components/ArtifactStatusBadges";

const MONTHS_PT = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"
];

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
}

function formatBRL(v: number | string) {
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(d: string) {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

export default function ResumoPage() {
  const router = useRouter();
  const [month, setMonth]         = useState(currentMonth());
  const [items, setItems]         = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [copying, setCopying]     = useState(false);
  const [toast, setToast]         = useState<{ msg: string; type: "success"|"error" } | null>(null);
  const [marking, setMarking]     = useState<number | null>(null);

  const tenantId = getActiveTenantId();

  function showToast(msg: string, type: "success"|"error" = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const data = await dashboardApi.resumo(tenantId, month);
      setItems(data);
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setLoading(false);
    }
  }, [tenantId, month]);

  useEffect(() => { load(); }, [load]);

  async function handleCopyWhatsApp() {
    if (!tenantId) return;
    setCopying(true);
    try {
      const { text } = await dashboardApi.whatsapp(tenantId, month);
      await navigator.clipboard.writeText(text);
      showToast("Copiado para a área de transferência! 📋");
    } catch (e: any) {
      showToast("Erro ao copiar: " + e.message, "error");
    } finally {
      setCopying(false);
    }
  }

  async function handleMarkPaid(occId: number) {
    setMarking(occId);
    try {
      await occurrencesApi.update(occId, { status: "paid" });
      showToast("Marcado como pago! ✅");
      load();
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setMarking(null);
    }
  }

  // Separa vencidas vs. do mês
  const [y, m] = month.split("-").map(Number);
  const refDate = new Date(y, m - 1, 1);
  const overdue = items.filter(i => {
    const ref = new Date(i.reference_month);
    return ref < refDate && i.status === "pending";
  });
  const current = items.filter(i => {
    const ref = new Date(i.reference_month);
    return ref >= refDate;
  });

  const totalPending = items
    .filter(i => i.status === "pending")
    .reduce((s, i) => s + Number(i.value), 0);

  const monthLabel = `${MONTHS_PT[m - 1]}/${y}`;

  // Navegação de meses
  function prevMonth() {
    const d = new Date(y, m - 2, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`);
  }
  function nextMonth() {
    const d = new Date(y, m, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`);
  }

  return (
    <div className="container" style={{ paddingTop: "20px", paddingBottom: "24px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
        <h1 style={{ fontSize: "1.4rem" }}>Resumo</h1>
        <Link href="/despesas/nova" className="btn btn-primary btn-sm">
          + Nova
        </Link>
      </div>

      {/* Navegação de meses */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: "16px",
        background: "var(--bg-card)", borderRadius: "var(--radius-lg)",
        padding: "12px 16px", marginBottom: "20px",
        border: "1px solid var(--border)",
      }}>
        <button className="btn btn-secondary btn-sm btn-icon" onClick={prevMonth}>◀</button>
        <span style={{ fontWeight: 700, fontSize: "1.05rem", minWidth: "160px", textAlign: "center" }}>
          {monthLabel}
        </span>
        <button className="btn btn-secondary btn-sm btn-icon" onClick={nextMonth}>▶</button>
      </div>

      {/* Card totais */}
      {!loading && (
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px",
          marginBottom: "20px",
        }}>
          <div className="stat-card danger">
            <div className="stat-label">Pendente</div>
            <div className="stat-value" style={{ fontSize: "1.3rem", color: "var(--danger)" }}>
              {formatBRL(totalPending)}
            </div>
          </div>
          <div className="stat-card success">
            <div className="stat-label">Vencidas anteriores</div>
            <div className="stat-value" style={{ fontSize: "1.3rem", color: "var(--warning)" }}>
              {overdue.length} conta{overdue.length !== 1 ? "s" : ""}
            </div>
          </div>
        </div>
      )}

      {/* Botão WhatsApp */}
      <button
        className="btn btn-full"
        onClick={handleCopyWhatsApp}
        disabled={copying || loading}
        style={{
          background: "#25D366", color: "#fff",
          borderRadius: "var(--radius-md)",
          marginBottom: "24px",
          fontWeight: 600,
        }}
      >
        {copying ? "Copiando..." : "📋 Copiar resumo para WhatsApp"}
      </button>

      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: "3rem" }}>🎉</div>
          <h3 style={{ marginTop: "12px", color: "var(--text-secondary)" }}>Nenhuma conta este mês</h3>
          <p style={{ marginTop: "8px", fontSize: "0.85rem" }}>
            Adicione despesas ou aguarde a geração automática.
          </p>
        </div>
      ) : (
        <>
          {/* Vencidas */}
          {overdue.length > 0 && (
            <section style={{ marginBottom: "24px" }}>
              <h3 style={{
                display: "flex", alignItems: "center", gap: "8px",
                color: "var(--danger)", marginBottom: "12px", fontSize: "0.9rem",
                textTransform: "uppercase", letterSpacing: "0.08em",
              }}>
                ⚠️ Vencidas de meses anteriores
              </h3>
              {overdue.map(item => (
                <ExpenseCard
                  key={item.occurrence_id}
                  item={item}
                  overdue
                  marking={marking}
                  onPay={handleMarkPaid}
                />
              ))}
            </section>
          )}

          {/* Mês atual */}
          {current.length > 0 && (
            <section>
              <h3 style={{
                color: "var(--text-muted)", marginBottom: "12px", fontSize: "0.9rem",
                textTransform: "uppercase", letterSpacing: "0.08em",
              }}>
                📋 {monthLabel}
              </h3>
              {current.map(item => (
                <ExpenseCard
                  key={item.occurrence_id}
                  item={item}
                  overdue={false}
                  marking={marking}
                  onPay={handleMarkPaid}
                />
              ))}
            </section>
          )}
        </>
      )}

      {/* Toast */}
      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type}`}>{toast.msg}</div>
        </div>
      )}
    </div>
  );
}

// ── Sub-componente de card de despesa ──────────────────────
function ExpenseCard({
  item, overdue, marking, onPay,
}: {
  item: any;
  overdue: boolean;
  marking: number | null;
  onPay: (id: number) => void;
}) {
  const isPaid = item.status === "paid";
  const router = useRouter();

  const attachments = [
    ...(item.has_boleto      ? [{ type: "boleto" }]      : []),
    ...(item.has_danfe       ? [{ type: "danfe" }]       : []),
    ...(item.has_comprovante ? [{ type: "comprovante" }] : []),
  ];

  return (
    <div
      className="card"
      style={{
        marginBottom: "10px",
        borderLeft: `3px solid ${isPaid ? "var(--success)" : overdue ? "var(--danger)" : "var(--accent)"}`,
        cursor: "pointer",
        padding: "14px 16px",
      }}
      onClick={() => router.push(`/despesas/${item.expense_id}/${item.occurrence_id}`)}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontWeight: 600, fontSize: "0.95rem",
            color: isPaid ? "var(--text-muted)" : "var(--text-primary)",
            textDecoration: isPaid ? "line-through" : "none",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {item.expense_title}
          </div>
          <div style={{ display: "flex", gap: "8px", marginTop: "4px", alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
              Vence {formatDate(item.due_date)}
            </span>
            {overdue && (
              <span style={{
                fontSize: "0.7rem", padding: "1px 6px",
                background: "var(--danger-dim)", color: "var(--danger)",
                borderRadius: "var(--radius-full)", fontWeight: 600,
              }}>
                {new Date(item.reference_month).toLocaleDateString("pt-BR", { month: "short", year: "numeric" })}
              </span>
            )}
            <ArtifactStatusBadges attachments={attachments} size="sm" />
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px" }}>
          <span style={{
            fontWeight: 700, fontSize: "1rem",
            color: isPaid ? "var(--success)" : overdue ? "var(--danger)" : "var(--text-primary)",
          }}>
            {formatBRL(item.value)}
          </span>

          {!isPaid && (
            <button
              className="btn btn-success btn-sm"
              onClick={e => { e.stopPropagation(); onPay(item.occurrence_id); }}
              disabled={marking === item.occurrence_id}
              style={{ fontSize: "0.75rem", padding: "4px 10px" }}
            >
              {marking === item.occurrence_id ? "..." : "✅ Pagar"}
            </button>
          )}
          {isPaid && (
            <span className="badge badge-paid" style={{ fontSize: "0.7rem" }}>Pago</span>
          )}
        </div>
      </div>
    </div>
  );
}
