"use client";
import { useRef, useState } from "react";
import { attachmentsApi } from "@/lib/api";

interface AttachmentUploadProps {
  occurrenceId: number;
  type: "boleto" | "danfe" | "comprovante";
  label: string;
  existing?: { id: number; original_filename: string; s3_url?: string } | null;
  onUploaded: (att: any) => void;
  onDeleted?:  () => void;
}

const LABELS: Record<string, string> = {
  boleto:      "📄 Boleto / Fatura",
  danfe:       "🧾 DANFE / Nota Fiscal",
  comprovante: "✅ Comprovante de Pagamento",
};

export default function AttachmentUpload({
  occurrenceId, type, label, existing, onUploaded, onDeleted,
}: AttachmentUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress]   = useState(0);
  const [error, setError]         = useState("");

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    setProgress(20);
    try {
      const result = await attachmentsApi.upload(occurrenceId, type, file);
      setProgress(100);
      onUploaded(result);
    } catch (err: any) {
      setError(err.message || "Falha no upload");
    } finally {
      setUploading(false);
      setTimeout(() => setProgress(0), 1000);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleDelete() {
    if (!existing || !confirm("Remover este arquivo?")) return;
    try {
      await attachmentsApi.delete(existing.id);
      onDeleted?.();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div style={{
      border: `1px solid ${existing ? "rgba(34,197,94,0.3)" : "var(--border)"}`,
      borderRadius: "var(--radius-md)",
      overflow: "hidden",
      background: existing ? "var(--success-dim)" : "var(--bg-elevated)",
      transition: "var(--transition)",
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 14px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "1.2rem" }}>
            {existing ? "✅" : "⬜"}
          </span>
          <div>
            <div style={{ fontSize: "0.85rem", fontWeight: 600, color: existing ? "var(--success)" : "var(--text-secondary)" }}>
              {LABELS[type] || label}
            </div>
            {existing && (
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "2px" }}>
                {existing.original_filename}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: "6px" }}>
          {existing?.s3_url && (
            <a
              href={existing.s3_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary btn-sm"
            >
              👁️
            </a>
          )}
          {existing && onDeleted && (
            <button className="btn btn-danger btn-sm" onClick={handleDelete} title="Remover">
              🗑️
            </button>
          )}
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? "..." : existing ? "Trocar" : "Upload"}
          </button>
        </div>
      </div>

      {/* Progress bar */}
      {uploading && (
        <div style={{ height: 3, background: "var(--bg-base)" }}>
          <div style={{
            height: "100%", background: "var(--accent)",
            width: `${progress}%`,
            transition: "width 0.3s ease",
          }} />
        </div>
      )}

      {error && (
        <div style={{
          padding: "8px 14px", fontSize: "0.8rem",
          color: "var(--danger)", background: "var(--danger-dim)",
        }}>
          {error}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,image/*"
        style={{ display: "none" }}
        onChange={handleFile}
      />
    </div>
  );
}
