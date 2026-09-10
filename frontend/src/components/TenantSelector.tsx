"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { getStoredUser, setActiveTenant, getActiveTenantId, Tenant } from "@/lib/auth";
import { auth as authApi } from "@/lib/api";

interface TenantSelectorProps {
  onTenantChange: (id: number) => void;
}

export default function TenantSelector({ onTenantChange }: TenantSelectorProps) {
  const [open, setOpen] = useState(false);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [activeTid, setActiveTid] = useState<number | null>(null);

  // Carrega e sincroniza tenants do usuário
  useEffect(() => {
    const user = getStoredUser();
    const initialList = user?.tenants?.map((t: any) => t.tenant) || [];
    setTenants(initialList);

    const savedTid = getActiveTenantId();
    if (savedTid) {
      setActiveTid(savedTid);
    } else if (initialList.length > 0) {
      setActiveTid(initialList[0].id);
      setActiveTenant(initialList[0].id);
    }

    // Busca dados atualizados da API (/auth/me) para atualizar a lista
    authApi.me().then(me => {
      if (me?.tenants) {
        localStorage.setItem("user", JSON.stringify(me));
        const list = me.tenants.map((t: any) => t.tenant);
        setTenants(list);

        const currentActive = getActiveTenantId();
        if (!currentActive || !list.some((t: any) => t.id === currentActive)) {
          if (list.length > 0) {
            setActiveTid(list[0].id);
            setActiveTenant(list[0].id);
            onTenantChange(list[0].id);
          }
        } else {
          setActiveTid(currentActive);
        }
      }
    }).catch(() => {});
  }, []);

  const active = tenants.find(t => t.id === activeTid) || tenants[0];

  function select(id: number) {
    if (id === activeTid) {
      setOpen(false);
      return;
    }
    setActiveTid(id);
    setActiveTenant(id);
    onTenantChange(id);
    setOpen(false);
    // Recarrega a página para atualizar todos os dados do novo tenant
    window.location.reload();
  }

  // Se ainda não tiver nenhum tenant cadastrado
  if (tenants.length === 0) {
    return (
      <Link
        href="/config"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "4px 10px",
          background: "rgba(255, 170, 0, 0.15)",
          border: "1px solid rgba(255, 170, 0, 0.4)",
          borderRadius: "var(--radius-md)",
          color: "#ffaa00",
          fontSize: "0.82rem",
          fontWeight: 600,
          textDecoration: "none",
        }}
        title="Criar o primeiro tenant em Configurações"
      >
        <span>⚠️ Criar Tenant</span>
      </Link>
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
          display: "flex",
          alignItems: "center",
          gap: "8px",
          cursor: "pointer",
          transition: "var(--transition)",
        }}
        title="Clique para alternar de Tenant / Família"
      >
        <div style={{
          width: 8, height: 8, borderRadius: "50%",
          background: "var(--accent)", boxShadow: "0 0 8px var(--accent)",
        }} />
        <span style={{ maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {active?.name || "Selecionar..."}
        </span>
        <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginLeft: "2px" }}>
          {open ? "▲" : "▼"}
        </span>
      </button>

      {open && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 99 }}
            onClick={() => setOpen(false)}
          />
          <div style={{
            position: "absolute", top: "calc(100% + 8px)", left: 0,
            zIndex: 100, minWidth: "220px",
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            boxShadow: "var(--shadow-lg)",
            overflow: "hidden",
          }}>
            <div style={{
              padding: "8px 14px",
              fontSize: "0.72rem",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "var(--text-muted)",
              borderBottom: "1px solid var(--border)",
              background: "var(--bg-elevated)",
              fontWeight: 600,
            }}>
              Família / Tenant Ativo
            </div>

            <div style={{ maxHeight: "240px", overflowY: "auto" }}>
              {tenants.map(t => {
                const isCurrent = t.id === activeTid;
                return (
                  <button
                    key={t.id}
                    onClick={() => select(t.id)}
                    style={{
                      width: "100%", textAlign: "left",
                      padding: "10px 14px",
                      background: isCurrent ? "var(--accent-dim)" : "transparent",
                      border: "none",
                      color: isCurrent ? "var(--accent-light)" : "var(--text-primary)",
                      fontSize: "0.88rem",
                      fontWeight: isCurrent ? 600 : 400,
                      cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      transition: "var(--transition)",
                    }}
                    onMouseEnter={e => {
                      if (!isCurrent) e.currentTarget.style.background = "var(--bg-hover)";
                    }}
                    onMouseLeave={e => {
                      if (!isCurrent) e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span>🏢</span>
                      <span>{t.name}</span>
                    </div>
                    {isCurrent && <span style={{ color: "var(--accent)", fontSize: "0.9rem" }}>✓</span>}
                  </button>
                );
              })}
            </div>

            <div style={{
              borderTop: "1px solid var(--border)",
              padding: "8px 12px",
              background: "var(--bg-elevated)",
            }}>
              <Link
                href="/config"
                onClick={() => setOpen(false)}
                style={{
                  fontSize: "0.78rem",
                  color: "var(--text-muted)",
                  textDecoration: "none",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <span>⚙️</span>
                <span>Gerenciar Tenants...</span>
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
