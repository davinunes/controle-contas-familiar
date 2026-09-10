"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { isLoggedIn, logout, getStoredUser, getActiveTenantId } from "@/lib/auth";
import TenantSelector from "@/components/TenantSelector";

const NAV = [
  { href: "/resumo",    icon: "🏠", label: "Resumo"    },
  { href: "/despesas",  icon: "📋", label: "Despesas"  },
  { href: "/dashboard", icon: "📊", label: "Dashboard" },
  { href: "/config",    icon: "⚙️", label: "Config"    },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [tenantId, setTenantId] = useState<number | null>(null);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/");
      return;
    }
    setTenantId(getActiveTenantId());
  }, [router]);

  const user = getStoredUser();

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100dvh" }}>
      {/* Header */}
      <header style={{
        height: "var(--header-h)",
        background: "var(--bg-surface)",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 16px",
        position: "sticky", top: 0, zIndex: 50,
        backdropFilter: "blur(10px)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "1.4rem" }}>💰</span>
          <TenantSelector onTenantChange={id => setTenantId(id)} />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {user?.is_superadmin && (
            <span style={{
              fontSize: "0.7rem", padding: "2px 8px",
              background: "var(--accent-dim)", color: "var(--accent)",
              borderRadius: "var(--radius-full)", border: "1px solid var(--accent-glow)",
              fontWeight: 600,
            }}>ADMIN</span>
          )}
          <button
            onClick={logout}
            className="btn btn-secondary btn-sm"
            title="Sair"
          >
            Sair
          </button>
        </div>
      </header>

      {/* Content */}
      <main style={{
        flex: 1,
        paddingBottom: "calc(var(--nav-h) + 8px)",
        overflowX: "hidden",
      }}>
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav style={{
        height: "var(--nav-h)",
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
        background: "var(--bg-surface)",
        borderTop: "1px solid var(--border)",
        display: "flex",
        backdropFilter: "blur(10px)",
      }}>
        {NAV.map(item => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "2px",
                padding: "8px 4px",
                color: isActive ? "var(--accent)" : "var(--text-muted)",
                transition: "var(--transition)",
                textDecoration: "none",
              }}
            >
              <span style={{
                fontSize: "1.3rem",
                filter: isActive ? "none" : "grayscale(0.5) opacity(0.7)",
                transition: "var(--transition)",
              }}>{item.icon}</span>
              <span style={{
                fontSize: "0.65rem",
                fontWeight: isActive ? 600 : 400,
                letterSpacing: "0.03em",
              }}>{item.label}</span>
              {isActive && (
                <div style={{
                  position: "absolute",
                  top: 0,
                  width: "40px", height: "2px",
                  background: "var(--accent)",
                  borderRadius: "0 0 2px 2px",
                }} />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
