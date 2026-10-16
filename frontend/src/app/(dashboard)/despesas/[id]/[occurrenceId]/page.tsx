"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { occurrencesApi, costCentersApi } from "@/lib/api";
import NfUrlPanel from "@/components/NfUrlPanel";
import AttachmentUpload from "@/components/AttachmentUpload";
import ArtifactStatusBadges from "@/components/ArtifactStatusBadges";
import QRScanner from "@/components/QRScanner";
import MoneyInput from "@/components/MoneyInput";
import { formatCurrencyFromNumber, parseCurrency } from "@/lib/money";

function formatBRL(v: number | string) {
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(d: string | null | undefined) {
  if (!d) return "";
  const [y, m, day] = d.split("T")[0].split("-");
  return `${day}/${m}/${y}`;
}

export default function OccurrencePage({
  params,
}: {
  params: { id: string; occurrenceId: string };
}) {
  const { id, occurrenceId } = params;
  const router  = useRouter();
  const [occ, setOcc]               = useState<any>(null);
  const [loading, setLoading]       = useState(true);
  const [showScanner, setShow]      = useState(false);
  const [editingValue, setEditV]    = useState(false);
  const [valueInput, setValIn]      = useState("");
  const [notes, setNotes]           = useState("");
  const [savingNotes, setSavNotes]  = useState(false);
  const [toast, setToast]           = useState<{ msg: string; type: "success"|"error" } | null>(null);

  // Centros de custo para compras de cartão
  const [persons, setPersons]       = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);

  // Modal Pagamento Parcial / Amortização
  const [showPayModal, setShowPayModal]   = useState(false);
  const [payAmount, setPayAmount]         = useState("");
  const [payDate, setPayDate]             = useState(() => new Date().toISOString().split("T")[0]);
  const [payMethod, setPayMethod]         = useState("pix");
  const [payNotes, setPayNotes]           = useState("");
  const [savingPay, setSavingPay]         = useState(false);

  // Modal Compra de Cartão
  const [showItemModal, setShowItemModal] = useState(false);
  const [itemDesc, setItemDesc]           = useState("");
  const [itemAmount, setItemAmount]       = useState("");
  const [itemDate, setItemDate]           = useState(() => new Date().toISOString().split("T")[0]);
  const [itemPersonId, setItemPersonId]   = useState("");
  const [itemCatId, setItemCatId]         = useState("");
  const [itemNotes, setItemNotes]         = useState("");
  const [savingItem, setSavingItem]       = useState(false);

  function showToast(msg: string, type: "success"|"error" = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  const load = useCallback(async () => {
    try {
      const data = await occurrencesApi.get(Number(occurrenceId));
      setOcc(data);
      setNotes(data.notes || "");
      setValIn(formatCurrencyFromNumber(data.value));

      // Se for do tipo credit_card, carrega pessoas e categorias do tenant se ainda não carregados
      if (data.expense?.tenant_id) {
        costCentersApi.list(data.expense.tenant_id, "person").then(setPersons).catch(() => {});
        costCentersApi.list(data.expense.tenant_id, "category").then(setCategories).catch(() => {});
      }
    } catch (e: any) {
      showToast(e.message || "Erro ao carregar ocorrência", "error");
    } finally {
      setLoading(false);
    }
  }, [occurrenceId]);

  useEffect(() => { load(); }, [load]);

  // Pagamento integral rápido
  async function handleMarkPaid() {
    try {
      const rem = Number(occ.remaining_amount > 0 ? occ.remaining_amount : occ.value);
      // Se tiver valor a quitar, registra pagamento do saldo
      if (rem > 0) {
        await occurrencesApi.addPayment(Number(occurrenceId), {
          amount: rem,
          payment_method: "total",
          notes: "Quitação integral",
        });
      } else {
        await occurrencesApi.update(Number(occurrenceId), { status: "paid" });
      }
      showToast("Marcado como pago! ✅");
      load();
    } catch (e: any) {
      showToast(e.message, "error");
    }
  }

  // Reverter pagamento
  async function handleMarkPending() {
    try {
      // Se houver pagamentos na tabela, avisa ou remove
      if (occ?.payments?.length > 0) {
        if (!confirm("Reverter para pendente irá remover o histórico de pagamentos desta conta. Confirmar?")) return;
        for (const p of occ.payments) {
          await occurrencesApi.deletePayment(Number(occurrenceId), p.id);
        }
      }
      await occurrencesApi.update(Number(occurrenceId), { status: "pending", paid_at: null });
      showToast("Revertido para pendente.");
      load();
    } catch (e: any) {
      showToast(e.message, "error");
    }
  }

  // Submeter Pagamento Parcial
  async function handleSavePayment(e: React.FormEvent) {
    e.preventDefault();
    const val = parseCurrency(payAmount);
    if (!val || val <= 0) {
      showToast("Informe um valor válido maior que zero", "error");
      return;
    }
    setSavingPay(true);
    try {
      await occurrencesApi.addPayment(Number(occurrenceId), {
        amount: val,
        paid_at: payDate ? `${payDate}T12:00:00` : undefined,
        payment_method: payMethod,
        notes: payNotes.trim() || undefined,
      });
      showToast("Pagamento registrado! 💵");
      setShowPayModal(false);
      setPayAmount("");
      setPayNotes("");
      load();
    } catch (err: any) {
      showToast(err.message || "Erro ao registrar pagamento", "error");
    } finally {
      setSavingPay(false);
    }
  }

  // Excluir um pagamento específico
  async function handleDeletePayment(paymentId: number) {
    if (!confirm("Excluir este pagamento registrado?")) return;
    try {
      await occurrencesApi.deletePayment(Number(occurrenceId), paymentId);
      showToast("Pagamento removido!");
      load();
    } catch (err: any) {
      showToast(err.message, "error");
    }
  }

  // Submeter Compra de Cartão
  async function handleSaveItem(e: React.FormEvent) {
    e.preventDefault();
    const val = parseCurrency(itemAmount);
    if (!val || val <= 0) {
      showToast("Informe um valor válido", "error");
      return;
    }
    if (!itemDesc.trim()) {
      showToast("Informe a descrição da compra", "error");
      return;
    }
    setSavingItem(true);
    try {
      await occurrencesApi.addInvoiceItem(Number(occurrenceId), {
        description: itemDesc.trim(),
        amount: val,
        purchase_date: itemDate,
        cost_center_id: itemCatId ? Number(itemCatId) : null,
        person_id: itemPersonId ? Number(itemPersonId) : null,
        notes: itemNotes.trim() || undefined,
      });
      showToast("Compra adicionada à fatura! 💳");
      setShowItemModal(false);
      setItemDesc("");
      setItemAmount("");
      setItemNotes("");
      load();
    } catch (err: any) {
      showToast(err.message || "Erro ao adicionar compra", "error");
    } finally {
      setSavingItem(false);
    }
  }

  // Excluir Compra da Fatura
  async function handleDeleteItem(itemId: number) {
    if (!confirm("Remover este item da fatura?")) return;
    try {
      await occurrencesApi.deleteInvoiceItem(Number(occurrenceId), itemId);
      showToast("Item removido da fatura!");
      load();
    } catch (err: any) {
      showToast(err.message, "error");
    }
  }

  async function handleSaveNfUrl(url: string) {
    await occurrencesApi.update(Number(occurrenceId), { nf_url: url });
    showToast("URL da NF salva! 🔗");
    load();
  }

  async function handleSaveValue() {
    const v = parseCurrency(valueInput);
    if (v === null || v < 0) return;
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
  const isPartial = occ.status === "partially_paid";
  const isCreditCard = occ.expense?.type === "credit_card";
  const totalVal = Number(occ.value || 0);
  const paidVal = Number(occ.paid_amount || 0);
  const remainingVal = Number(occ.remaining_amount || 0);
  const percentPaid = totalVal > 0 ? Math.min(100, Math.round((paidVal / totalVal) * 100)) : (isPaid ? 100 : 0);

  return (
    <div className="container" style={{ paddingTop: "20px", paddingBottom: "32px" }}>
      {showScanner && (
        <QRScanner
          onDetect={url => { setShow(false); handleSaveNfUrl(url); }}
          onClose={() => setShow(false)}
        />
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
        <button className="btn btn-secondary btn-sm" onClick={() => router.back()}>← Voltar</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <h1 style={{ fontSize: "1.2rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0 }}>
              {occ.expense?.title || "Ocorrência"}
            </h1>
            {isCreditCard && (
              <span style={{ fontSize: "0.75rem", background: "rgba(59,130,246,0.15)", color: "#3b82f6", padding: "2px 8px", borderRadius: "var(--radius-full)", fontWeight: 600 }}>
                💳 Fatura
              </span>
            )}
          </div>
          <p style={{ fontSize: "0.82rem", marginTop: "2px", textTransform: "capitalize", color: "var(--text-muted)" }}>{refLabel}</p>
        </div>
      </div>

      {/* Card Principal: Resumo Financeiro da Conta */}
      <div className="card" style={{ marginBottom: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "4px" }}>Vencimento</div>
            <div style={{ fontWeight: 600, fontSize: "1.05rem" }}>
              {new Date(occ.due_date + "T00:00:00").toLocaleDateString("pt-BR")}
            </div>
            {occ.expense?.person && (
              <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "4px", display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: occ.expense.person.color || "var(--accent)" }} />
                <span>👤 {occ.expense.person.name}</span>
              </div>
            )}
          </div>

          {/* Valor Total */}
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "4px" }}>
              {isCreditCard ? "Total da Fatura" : "Valor Nominal"}
            </div>
            {editingValue && !isCreditCard ? (
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                <MoneyInput
                  style={{ width: "130px", padding: "6px 10px 6px 36px" }}
                  value={valueInput}
                  onChange={setValIn}
                  autoFocus
                />
                <button className="btn btn-primary btn-sm" onClick={handleSaveValue}>✓</button>
                <button className="btn btn-secondary btn-sm" onClick={() => setEditV(false)}>✕</button>
              </div>
            ) : (
              <div
                style={{
                  fontWeight: 800, fontSize: "1.45rem",
                  cursor: isCreditCard ? "default" : "pointer",
                  color: "var(--text-primary)",
                }}
                onClick={() => { if (!isCreditCard) { setValIn(formatCurrencyFromNumber(occ.value)); setEditV(true); } }}
                title={isCreditCard ? "Calculado pela soma dos lançamentos" : "Clique para editar o valor"}
              >
                {formatBRL(occ.value)}
                {!isCreditCard && <span style={{ fontSize: "0.7rem", marginLeft: "4px", color: "var(--text-muted)" }}>✏️</span>}
              </div>
            )}
          </div>
        </div>

        {/* Indicador de Baixas / Pagamentos Parciais */}
        <div style={{ marginTop: "16px", padding: "12px", background: "var(--bg-elevated)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", fontSize: "0.85rem" }}>
            <span style={{ color: "var(--text-muted)" }}>Status do Pagamento:</span>
            {isPaid ? (
              <span className="badge badge-paid">✅ Quitado Integral</span>
            ) : isPartial ? (
              <span style={{
                fontSize: "0.75rem", fontWeight: 700, padding: "3px 10px", borderRadius: "var(--radius-full)",
                background: "rgba(234, 179, 8, 0.15)", color: "#ca8a04", border: "1px solid rgba(234, 179, 8, 0.3)"
              }}>
                ⏳ Parcialmente Pago ({percentPaid}%)
              </span>
            ) : (
              <span className="badge badge-pending">⏳ Pendente</span>
            )}
          </div>

          {/* Barra de progresso */}
          <div style={{ width: "100%", height: "8px", background: "rgba(255,255,255,0.08)", borderRadius: "4px", overflow: "hidden", marginBottom: "10px" }}>
            <div style={{
              width: `${percentPaid}%`, height: "100%",
              background: isPaid ? "var(--success)" : "linear-gradient(90deg, #eab308, var(--success))",
              transition: "width 0.3s ease",
            }} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "0.85rem" }}>
            <div>
              <span style={{ color: "var(--text-muted)", fontSize: "0.75rem", display: "block" }}>Total Amortizado / Pago</span>
              <strong style={{ color: paidVal > 0 ? "var(--success)" : "var(--text-muted)" }}>{formatBRL(paidVal)}</strong>
            </div>
            <div style={{ textAlign: "right" }}>
              <span style={{ color: "var(--text-muted)", fontSize: "0.75rem", display: "block" }}>Saldo Pendente</span>
              <strong style={{ color: remainingVal > 0 ? "var(--danger)" : "var(--text-muted)" }}>
                {formatBRL(remainingVal)}
              </strong>
            </div>
          </div>
        </div>

        {/* Botões de Ação de Pagamento */}
        <div style={{ display: "flex", gap: "8px", marginTop: "16px", flexWrap: "wrap" }}>
          {!isPaid && (
            <>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setPayAmount(formatCurrencyFromNumber(remainingVal > 0 ? remainingVal : totalVal));
                  setShowPayModal(true);
                }}
                style={{ flex: 1, minWidth: "140px", padding: "9px 12px", fontWeight: 600 }}
              >
                💵 Registrar Pagamento
              </button>
              <button
                className="btn btn-success btn-sm"
                onClick={handleMarkPaid}
                style={{ padding: "9px 14px", fontWeight: 600 }}
                title="Quitar todo o saldo restante de uma vez"
              >
                ✓ Quitar Tudo
              </button>
            </>
          )}

          {isPaid && (
            <button className="btn btn-secondary btn-sm" onClick={handleMarkPending} style={{ flex: 1 }}>
              ↩️ Reverter para Pendente
            </button>
          )}
        </div>
      </div>

      {/* Histórico de Pagamentos / Baixas Realizadas */}
      {occ.payments?.length > 0 && (
        <div className="card" style={{ marginBottom: "20px" }}>
          <h3 style={{ fontSize: "0.95rem", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
            <span>📋 Histórico de Pagamentos</span>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 400 }}>
              ({occ.payments.length} baixa{occ.payments.length !== 1 ? "s" : ""})
            </span>
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {occ.payments.map((p: any) => (
              <div
                key={p.id}
                style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "10px 12px", background: "var(--bg-elevated)",
                  borderRadius: "var(--radius-md)", border: "1px solid var(--border)",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--success)" }}>
                    {formatBRL(p.amount)}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "2px" }}>
                    Pago em {formatDate(p.paid_at)} {p.payment_method ? `· ${p.payment_method.toUpperCase()}` : ""}
                  </div>
                  {p.notes && (
                    <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "4px" }}>
                      📝 {p.notes}
                    </div>
                  )}
                </div>
                <button
                  className="btn btn-danger btn-sm btn-icon"
                  onClick={() => handleDeletePayment(p.id)}
                  title="Excluir este pagamento"
                  style={{ width: 28, height: 28, padding: 0 }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SEÇÃO ESPECÍFICA: Lançamentos da Fatura de Cartão */}
      {isCreditCard && (
        <div className="card" style={{ marginBottom: "20px", border: "1px solid rgba(59,130,246,0.3)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
            <div>
              <h3 style={{ fontSize: "1rem", margin: 0, display: "flex", alignItems: "center", gap: "6px" }}>
                <span>💳 Compras desta Fatura</span>
              </h3>
              <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", margin: "2px 0 0" }}>
                {occ.invoice_items?.length || 0} compras registradas · Total: {formatBRL(occ.value || 0)}
              </p>
            </div>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                setItemDate(new Date().toISOString().split("T")[0]);
                setShowItemModal(true);
              }}
              style={{ fontWeight: 600, padding: "8px 12px" }}
            >
              + Adicionar Compra
            </button>
          </div>

          {occ.invoice_items?.length === 0 ? (
            <div style={{
              textAlign: "center", padding: "28px 16px",
              border: "1px dashed var(--border)", borderRadius: "var(--radius-md)",
              color: "var(--text-muted)", fontSize: "0.85rem",
            }}>
              <div style={{ fontSize: "1.8rem", marginBottom: "8px" }}>🛒</div>
              Nenhuma compra lançada nesta fatura ainda.
              <div style={{ marginTop: "8px" }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowItemModal(true)}
                >
                  + Lançar primeira compra
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {occ.invoice_items.map((item: any) => (
                <div
                  key={item.id}
                  style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "10px 12px", background: "var(--bg-elevated)",
                    borderRadius: "var(--radius-md)", border: "1px solid var(--border)",
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1, paddingRight: "10px" }}>
                    <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{item.description}</div>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center", marginTop: "4px", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      <span>📅 {formatDate(item.purchase_date)}</span>
                      {item.person && (
                        <span style={{
                          padding: "1px 6px", borderRadius: "var(--radius-full)",
                          background: "rgba(255,255,255,0.06)", border: `1px solid ${item.person.color || "var(--border)"}`,
                          color: "var(--text-primary)", fontWeight: 600,
                        }}>
                          👤 {item.person.name}
                        </span>
                      )}
                      {item.cost_center && (
                        <span style={{
                          padding: "1px 6px", borderRadius: "var(--radius-full)",
                          background: "rgba(255,255,255,0.06)", border: `1px solid ${item.cost_center.color || "var(--border)"}`,
                          color: "var(--text-primary)", fontWeight: 600,
                        }}>
                          📁 {item.cost_center.name}
                        </span>
                      )}
                    </div>
                    {item.notes && (
                      <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: "4px" }}>
                        💬 {item.notes}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>{formatBRL(item.amount)}</span>
                    <button
                      className="btn btn-danger btn-sm btn-icon"
                      onClick={() => handleDeleteItem(item.id)}
                      title="Excluir compra"
                      style={{ width: 28, height: 28, padding: 0 }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Detalhes importantes da despesa (ex: código do cliente, UC) */}
      {occ.expense?.important_details?.length > 0 && (
        <div className="card" style={{ marginBottom: "20px" }}>
          <h4 style={{ marginBottom: "8px", fontSize: "0.85rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            📌 Dados da Conta / Concessionária
          </h4>
          {occ.expense.important_details.map((d: any, i: number) => (
            <div key={i} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "6px 0",
              borderBottom: i < occ.expense.important_details.length - 1 ? "1px solid var(--border)" : "none",
            }}>
              <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>{d.label}</span>
              <span style={{ fontSize: "0.85rem", fontWeight: 600, fontFamily: "monospace" }}>{d.value}</span>
            </div>
          ))}
        </div>
      )}

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
        <label className="form-label">Observações Gerais</label>
        <textarea
          className="form-input"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Anotações sobre este mês..."
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

      {/* MODAL: Registrar Pagamento / Baixa Parcial */}
      {showPayModal && (
        <div className="modal-overlay" onClick={() => setShowPayModal(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <h2 style={{ marginBottom: "16px", fontSize: "1.2rem" }}>💵 Registrar Pagamento</h2>
            <form onSubmit={handleSavePayment} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className="form-group">
                <label className="form-label">Valor do Pagamento (R$) *</label>
                <MoneyInput
                  value={payAmount}
                  onChange={setPayAmount}
                  placeholder="0,00"
                  required
                  autoFocus
                />
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
                  Saldo restante: {formatBRL(remainingVal)}
                </span>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Data do Pagamento *</label>
                  <input
                    type="date"
                    className="form-input"
                    value={payDate}
                    onChange={e => setPayDate(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Forma de Pagamento</label>
                  <select
                    className="form-input"
                    value={payMethod}
                    onChange={e => setPayMethod(e.target.value)}
                  >
                    <option value="pix">Pix</option>
                    <option value="dinheiro">Dinheiro</option>
                    <option value="debito">Cartão de Débito</option>
                    <option value="ted">Transferência / TED</option>
                    <option value="outro">Outro</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Observação (opcional)</label>
                <input
                  type="text"
                  className="form-input"
                  value={payNotes}
                  onChange={e => setPayNotes(e.target.value)}
                  placeholder="Ex: Pago por Fulano, adiantamento, etc."
                />
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowPayModal(false)}
                  style={{ flex: 1 }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={savingPay}
                  style={{ flex: 1 }}
                >
                  {savingPay ? "Salvando..." : "Confirmar Baixa"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Adicionar Compra na Fatura de Cartão */}
      {showItemModal && (
        <div className="modal-overlay" onClick={() => setShowItemModal(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <h2 style={{ marginBottom: "16px", fontSize: "1.2rem" }}>💳 Nova Compra na Fatura</h2>
            <form onSubmit={handleSaveItem} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className="form-group">
                <label className="form-label">Descrição da Compra *</label>
                <input
                  type="text"
                  className="form-input"
                  value={itemDesc}
                  onChange={e => setItemDesc(e.target.value)}
                  placeholder="Ex: Supermercado, Farmácia, Uber, Tênis..."
                  required
                  autoFocus
                />
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Valor (R$) *</label>
                  <MoneyInput
                    value={itemAmount}
                    onChange={setItemAmount}
                    placeholder="0,00"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Data da Compra *</label>
                  <input
                    type="date"
                    className="form-input"
                    value={itemDate}
                    onChange={e => setItemDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">👤 Quem gastou?</label>
                  <select
                    className="form-input"
                    value={itemPersonId}
                    onChange={e => setItemPersonId(e.target.value)}
                  >
                    <option value="">Geral / Compartilhado</option>
                    {persons.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">📁 Categoria</label>
                  <select
                    className="form-input"
                    value={itemCatId}
                    onChange={e => setItemCatId(e.target.value)}
                  >
                    <option value="">Nenhuma Categoria</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Observações / Detalhes (opcional)</label>
                <input
                  type="text"
                  className="form-input"
                  value={itemNotes}
                  onChange={e => setItemNotes(e.target.value)}
                  placeholder="Ex: Parcelado em 3x no app, compra da farmácia do centro..."
                />
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowItemModal(false)}
                  style={{ flex: 1 }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={savingItem}
                  style={{ flex: 1 }}
                >
                  {savingItem ? "Salvando..." : "Adicionar Compra"}
                </button>
              </div>
            </form>
          </div>
        </div>
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
