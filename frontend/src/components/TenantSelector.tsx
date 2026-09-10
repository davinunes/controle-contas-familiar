"use client";
import { useState } from "react";
import { getStoredUser, setActiveTenant, getActiveTenantId } from "@/lib/auth";
import { logout } from "@/lib/auth";

interface TenantSelectorProps {
  onTenantChange: (id: number) => void;
}

export default function TenantSelector({ onTenantChange }: TenantSelectorProps) {
  const user       = getStoredUser();
  const [open, setOpen] = useState(false);
  const activeTid  = getActiveTenantId();

  const tenants = user?.tenants?.map(t => t.tenant) || [];
  const active  = tenants.find(t => t.id === activeTid) || tenants[0];

  function select(id: number) {
    setActiveTenant(id);
    onTenantChange(id);
    setOpen(false);
  }

  if (tenants.length <= 1) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <div style={{
          width: 8, height: 8, borderRadius: "50%",
          background: "var(--success)", boxShadow: "0 0 6px var(--success)",
        }} />
        <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>{active?.name || "—"}</span>
      </div>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)",
          padding: "6px 12px",
          color: "var(--text-primary)",
          fontSize: "0.9rem",
          fontWeight: 600,
          display: "flex", alignItems: "center", gap: "8px",
          cursor: "pointer",
        }}
      >
        <div style={{
          width: 8, height: 8, borderRadius: "50%",
          background: "var(--accent)", boxShadow: "0 0 6px var(--accent)",
        }} />
        {active?.name || "—"}
        <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>▼</span>
      </button>

      {open && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 99 }}
            onClick={() => setOpen(false)}
          />
          <div style={{
            position: "absolute", top: "calc(100% + 8px)", left: 0,
            zIndex: 100, minWidth: "180px",
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            boxShadow: "var(--shadow-lg)",
            overflow: "hidden",
          }}>
            {tenants.map(t => (
              <button
                key={t.id}
                onClick={() => select(t.id)}
                style={{
                  width: "100%", textAlign: "left",
                  padding: "10px 16px",
                  background: t.id === activeTid ? "var(--accent-dim)" : "transparent",
                  border: "none",
                  color: t.id === activeTid ? "var(--accent-light)" : "var(--text-primary)",
                  fontSize: "0.9rem",
                  cursor: "pointer",
                  display: "flex", alignItems: "center", gap: "8px",
                  transition: "var(--transition)",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-hover)")}
                onMouseLeave={e => (e.currentTarget.style.background = t.id === activeTid ? "var(--accent-dim)" : "transparent")}
              >
                {t.id === activeTid && <span>✓</span>}
                {t.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
