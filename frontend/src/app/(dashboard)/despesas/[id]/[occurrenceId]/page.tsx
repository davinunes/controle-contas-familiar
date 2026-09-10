"use client";
import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { occurrencesApi } from "@/lib/api";
import NfUrlPanel from "@/components/NfUrlPanel";
import AttachmentUpload from "@/components/AttachmentUpload";
import ArtifactStatusBadges from "@/components/ArtifactStatusBadges";
import QRScanner from "@/components/QRScanner";

function formatBRL(v: number | string) {
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function OccurrencePage({
  params,
}: {
  params: Promise<{ id: string; occurrenceId: string }>;
}) {
  const { id, occurrenceId } = use(params);
  const router  = useRouter();
  const [occ, setOcc]           = useState<any>(null);
  const [loading, setLoading]   = useState(true);
  const [showScanner, setShow]  = useState(false);
  const [editingValue, setEditV] = useState(false);
  const [valueInput, setValIn]  = useState("");
  const [notes, setNotes]       = useState("");
  const [savingNotes, setSavNotes] = useState(false);
  const [toast, setToast]       = useState<{ msg: string; type: "success"|"error" } | null>(null);

  function showToast(msg: string, type: "success"|"error" = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  async function load() {
    setLoading(true);
    try {
      const data = await occurrencesApi.get(Number(occurrenceId));
      setOcc(data);
      setNotes(data.notes || "");
      setValIn(String(Number(data.value)));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [occurrenceId]);

  async function handleMarkPaid() {
    try {
      await occurrencesApi.update(Number(occurrenceId), { status: "paid" });
      showToast("Marcado como pago! ✅");
      load();
    } catch (e: any) {
      showToast(e.message, "error");
    }
  }

  async function handleMarkPending() {
    try {
      await occurrencesApi.update(Number(occurrenceId), { status: "pending", paid_at: null });
      showToast("Revertido para pendente.");
      load();
    } catch (e: any) {
      showToast(e.message, "error");
    }
  }

  async function handleSaveNfUrl(url: string) {
    await occurrencesApi.update(Number(occurrenceId), { nf_url: url });
    showToast("URL da NF salva! 🔗");
    load();
  }

  async function handleSaveValue() {
    const v = parseFloat(valueInput);
    if (isNaN(v) || v < 0) return;
    await occurrencesApi.update(Number(occurrenceId), { value: v });
    setEditV(false);
    load();
  }

  async function handleSaveNotes() {
    setSavNotes(true);
    try {
      await occurrencesApi.update(Number(occurrenceId), { notes });
      showToast("Observações salvas.");
    } finally {
      setSavNotes(false);
    }
  }

  function getAttachment(type: string) {
    return occ?.attachments?.find((a: any) => a.type === type) || null;
  }

  function handleAttachmentUploaded() { load(); }
  function handleAttachmentDeleted()  { load(); }

  const refDate = occ ? new Date(occ.reference_month) : null;
  const refLabel = refDate
    ? refDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
    : "";

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;
  if (!occ)    return <div className="container" style={{ paddingTop: 20 }}>Ocorrência não encontrada.</div>;

  const isPaid = occ.status === "paid";

  return (
    <div className="container" style={{ paddingTop: "20px", paddingBottom: "32px" }}>
      {showScanner && (
        <QRScanner
          onDetect={url => { setShow(false); handleSaveNfUrl(url); }}
          onClose={() => setShow(false)}
        />
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
        <button className="btn btn-secondary btn-sm" onClick={() => router.back()}>← Voltar</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: "1.2rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {occ.expense?.title || "Ocorrência"}
          </h1>
          <p style={{ fontSize: "0.82rem", marginTop: "2px", textTransform: "capitalize" }}>{refLabel}</p>
        </div>
      </div>

      {/* Status + Valor */}
      <div className="card" style={{ marginBottom: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "4px" }}>Vencimento</div>
            <div style={{ fontWeight: 600 }}>
              {new Date(occ.due_date + "T00:00:00").toLocaleDateString("pt-BR")}
            </div>
          </div>

          {/* Valor editável */}
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "4px" }}>Valor</div>
            {editingValue ? (
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                <input
                  type="number" step="0.01" min="0"
                  className="form-input" style={{ width: "120px", padding: "6px 10px" }}
                  value={valueInput}
                  onChange={e => setValIn(e.target.value)}
                  autoFocus
                />
                <button className="btn btn-primary btn-sm" onClick={handleSaveValue}>✓</button>
                <button className="btn btn-secondary btn-sm" onClick={() => setEditV(false)}>✕</button>
              </div>
            ) : (
              <div
                style={{
                  fontWeight: 800, fontSize: "1.5rem", cursor: "pointer",
                  color: isPaid ? "var(--success)" : "var(--text-primary)",
                }}
                onClick={() => { setValIn(String(Number(occ.value))); setEditV(true); }}
                title="Clique para editar o valor"
              >
                {formatBRL(occ.value)}
                <span style={{ fontSize: "0.7rem", marginLeft: "4px", color: "var(--text-muted)" }}>✏️</span>
              </div>
            )}
          </div>
        </div>

        <div className="divider" />

        {/* Status + ação */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <span className={`badge badge-${isPaid ? "paid" : "pending"}`}>
              {isPaid ? "✅ Pago" : "⏳ Pendente"}
            </span>
            {isPaid && occ.paid_at && (
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
                em {new Date(occ.paid_at).toLocaleDateString("pt-BR")}
              </div>
            )}
          </div>
          {isPaid ? (
            <button className="btn btn-secondary btn-sm" onClick={handleMarkPending}>
              Reverter
            </button>
          ) : (
            <button className="btn btn-success" onClick={handleMarkPaid}>
              ✅ Marcar como Pago
            </button>
          )}
        </div>
      </div>

      {/* Artefatos */}
      <h3 style={{ marginBottom: "12px", fontSize: "0.85rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
        Artefatos
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "24px" }}>
        {(["boleto","danfe","comprovante"] as const).map(type => (
          <AttachmentUpload
            key={type}
            occurrenceId={Number(occurrenceId)}
            type={type}
            label={type}
            existing={getAttachment(type)}
            onUploaded={handleAttachmentUploaded}
            onDeleted={handleAttachmentDeleted}
          />
        ))}
      </div>

      {/* URL da NF */}
      <div style={{ marginBottom: "24px" }}>
        <NfUrlPanel
          nfUrl={occ.nf_url}
          onSave={handleSaveNfUrl}
          onScan={() => setShow(true)}
        />
      </div>

      {/* Observações */}
      <div className="form-group" style={{ marginBottom: "24px" }}>
        <label className="form-label">Observações</label>
        <textarea
          className="form-input"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Anotações sobre este pagamento..."
          rows={3}
        />
        <button
          className="btn btn-secondary btn-sm"
          style={{ alignSelf: "flex-end", marginTop: "8px" }}
          onClick={handleSaveNotes}
          disabled={savingNotes}
        >
          {savingNotes ? "Salvando..." : "💾 Salvar observações"}
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type}`}>{toast.msg}</div>
        </div>
      )}
    </div>
  );
}
