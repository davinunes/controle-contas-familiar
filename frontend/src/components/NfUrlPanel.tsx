"use client";
import { useState } from "react";

interface NfUrlPanelProps {
  nfUrl:    string | null;
  onSave:   (url: string) => Promise<void>;
  onScan?:  () => void;
  readOnly?: boolean;
}

export default function NfUrlPanel({ nfUrl, onSave, onScan, readOnly = false }: NfUrlPanelProps) {
  const [editing, setEditing]   = useState(false);
  const [draft, setDraft]       = useState(nfUrl || "");
  const [saving, setSaving]     = useState(false);
  const [copied, setCopied]     = useState(false);

  async function handleSave() {
    if (!draft.trim()) return;
    setSaving(true);
    try {
      await onSave(draft.trim());
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  function handleCopy() {
    if (!nfUrl) return;
    navigator.clipboard.writeText(nfUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{
      background: "var(--bg-elevated)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius-lg)",
      padding: "16px",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
        <h4 style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          🔗 URL da Nota Fiscal
        </h4>
        {!readOnly && (
          <div style={{ display: "flex", gap: "6px" }}>
            {onScan && (
              <button className="btn btn-secondary btn-sm" onClick={onScan}>
                📷 Escanear
              </button>
            )}
            <button className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>
              ✏️ {nfUrl ? "Editar" : "Inserir"}
            </button>
          </div>
        )}
      </div>

      {editing ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <input
            type="url"
            className="form-input"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="https://www.nfe.fazenda.gov.br/..."
            autoFocus
          />
          <div style={{ display: "flex", gap: "8px" }}>
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving || !draft.trim()}>
              {saving ? "Salvando..." : "Salvar"}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => setEditing(false)}>
              Cancelar
            </button>
          </div>
        </div>
      ) : nfUrl ? (
        <>
          <div style={{
            background: "var(--bg-base)",
            borderRadius: "var(--radius-sm)",
            padding: "10px 12px",
            fontSize: "0.8rem",
            color: "var(--text-secondary)",
            wordBreak: "break-all",
            marginBottom: "12px",
            fontFamily: "monospace",
          }}>
            {nfUrl}
          </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <a
              href={nfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary btn-sm"
            >
              🌐 Abrir NF no navegador
            </a>
            <button className="btn btn-secondary btn-sm" onClick={handleCopy}>
              {copied ? "✅ Copiado!" : "📋 Copiar URL"}
            </button>
          </div>

          <div style={{
            marginTop: "12px",
            padding: "10px 12px",
            background: "var(--accent-dim)",
            borderRadius: "var(--radius-sm)",
            fontSize: "0.8rem",
            color: "var(--accent-light)",
            lineHeight: 1.5,
          }}>
            💡 <strong>Para obter a DANFE:</strong> Abra a URL acima, passe pela verificação e baixe o PDF. Em seguida, faça upload abaixo como "DANFE".
          </div>
        </>
      ) : (
        <div style={{
          textAlign: "center", padding: "24px",
          color: "var(--text-muted)", fontSize: "0.85rem",
        }}>
          <div style={{ fontSize: "2rem", marginBottom: "8px" }}>🔗</div>
          Nenhuma URL de nota fiscal registrada.
          {!readOnly && (
            <div style={{ marginTop: "8px", display: "flex", gap: "8px", justifyContent: "center" }}>
              {onScan && (
                <button className="btn btn-primary btn-sm" onClick={onScan}>
                  📷 Escanear QR
                </button>
              )}
              <button className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>
                ✏️ Inserir URL
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
