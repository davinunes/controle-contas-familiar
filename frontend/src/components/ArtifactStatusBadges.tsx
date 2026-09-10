"use client";

interface Attachment { type: string; }

interface ArtifactStatusBadgesProps {
  attachments: Attachment[];
  size?: "sm" | "md";
}

const TYPES = [
  { key: "boleto",      label: "Boleto",      icon: "📄" },
  { key: "danfe",       label: "DANFE",       icon: "🧾" },
  { key: "comprovante", label: "Comprovante", icon: "✅" },
];

export default function ArtifactStatusBadges({ attachments, size = "sm" }: ArtifactStatusBadgesProps) {
  const has = (type: string) => attachments.some(a => a.type === type);

  return (
    <div style={{ display: "flex", gap: "4px" }}>
      {TYPES.map(t => {
        const ok = has(t.key);
        return (
          <div
            key={t.key}
            title={`${t.label}: ${ok ? "OK" : "Pendente"}`}
            style={{
              display: "flex", alignItems: "center", gap: "3px",
              padding: size === "sm" ? "2px 6px" : "4px 10px",
              borderRadius: "var(--radius-full)",
              fontSize: size === "sm" ? "0.7rem" : "0.8rem",
              fontWeight: 500,
              background: ok ? "var(--success-dim)" : "rgba(255,255,255,0.05)",
              color: ok ? "var(--success)" : "var(--text-muted)",
              border: `1px solid ${ok ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.08)"}`,
              transition: "var(--transition)",
            }}
          >
            <span>{t.icon}</span>
            {size === "md" && <span>{t.label}</span>}
          </div>
        );
      })}
    </div>
  );
}
