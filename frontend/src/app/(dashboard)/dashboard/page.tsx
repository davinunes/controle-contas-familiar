"use client";
import { useState, useEffect, useCallback } from "react";
import { dashboardApi } from "@/lib/api";
import { getActiveTenantId } from "@/lib/auth";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";

function formatBRL(v: number | string) {
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const MONTHS_PT: Record<string, string> = {
  "01":"Jan","02":"Fev","03":"Mar","04":"Abr","05":"Mai","06":"Jun",
  "07":"Jul","08":"Ago","09":"Set","10":"Out","11":"Nov","12":"Dez",
};

export default function DashboardPage() {
  const [data, setData]     = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const tenantId = getActiveTenantId();

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const d = await dashboardApi.fiado(tenantId);
      setData(d);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;

  const series = (data?.monthly_series || []).map((s: any) => ({
    ...s,
    name: `${MONTHS_PT[s.month.split("-")[1]]}/${s.month.split("-")[0].slice(2)}`,
  }));

  return (
    <div className="container" style={{ paddingTop: "20px", paddingBottom: "32px" }}>
      <h1 style={{ marginBottom: "24px" }}>Dashboard Fiado</h1>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
        <div className="stat-card danger">
          <div className="stat-label">Total Pendente</div>
          <div className="stat-value" style={{ color: "var(--danger)", fontSize: "1.4rem" }}>
            {formatBRL(data?.total_debt || 0)}
          </div>
          <div className="stat-sub">Débito acumulado</div>
        </div>
        <div className="stat-card success">
          <div className="stat-label">Total Reembolsado</div>
          <div className="stat-value" style={{ color: "var(--success)", fontSize: "1.4rem" }}>
            {formatBRL(data?.total_paid || 0)}
          </div>
          <div className="stat-sub">Histórico pago</div>
        </div>
      </div>

      <div className="stat-card accent" style={{ marginBottom: "28px" }}>
        <div className="stat-label">Saldo Devedor Atual</div>
        <div className="stat-value" style={{ color: "var(--accent)", fontSize: "1.8rem" }}>
          {formatBRL(data?.balance || 0)}
        </div>
        <div className="stat-sub">Valor total ainda em aberto</div>
      </div>

      {/* Gráfico */}
      <div className="card">
        <h3 style={{ marginBottom: "20px", fontSize: "0.9rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          📊 Últimos 6 meses
        </h3>

        {series.length > 0 ? (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={series} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                axisLine={false} tickLine={false}
              />
              <YAxis
                tick={{ fill: "var(--text-muted)", fontSize: 10 }}
                axisLine={false} tickLine={false}
                tickFormatter={v => `R$${v >= 1000 ? (v/1000).toFixed(0)+"k" : v}`}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  fontSize: "0.85rem",
                }}
                labelStyle={{ color: "var(--text-primary)", fontWeight: 600 }}
                formatter={(v: any) => formatBRL(v)}
              />
              <Legend
                wrapperStyle={{ fontSize: "0.8rem", paddingTop: "12px" }}
                formatter={(v) => v === "pending" ? "Pendente" : "Pago"}
              />
              <Bar dataKey="pending" name="pending" fill="var(--danger)"  radius={[4,4,0,0]} fillOpacity={0.85} />
              <Bar dataKey="paid"    name="paid"    fill="var(--success)" radius={[4,4,0,0]} fillOpacity={0.85} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
            Sem dados suficientes para exibir o gráfico.
          </div>
        )}
      </div>

      <button
        className="btn btn-secondary btn-full"
        style={{ marginTop: "20px" }}
        onClick={load}
      >
        🔄 Atualizar
      </button>
    </div>
  );
}
