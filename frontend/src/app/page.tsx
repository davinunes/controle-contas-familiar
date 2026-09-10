"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { login, isLoggedIn } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  useEffect(() => {
    if (isLoggedIn()) router.replace("/resumo");
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login(email, password);
      router.replace("/resumo");
    } catch (err: any) {
      setError(err.message || "Credenciais inválidas");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100dvh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      background: "radial-gradient(ellipse at 60% 20%, rgba(108,99,255,0.15) 0%, transparent 60%), var(--bg-base)",
    }}>
      <div style={{ width: "100%", maxWidth: "400px" }}>
        {/* Logo / Brand */}
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <div style={{
            width: 64, height: 64, borderRadius: "16px",
            background: "var(--accent)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px",
            boxShadow: "var(--shadow-glow)",
            fontSize: "28px",
          }}>💰</div>
          <h1 style={{ fontSize: "1.6rem", marginBottom: "6px" }}>Organizar</h1>
          <p style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>
            Controle de contas familiar
          </p>
        </div>

        {/* Card */}
        <div className="card" style={{ padding: "32px" }}>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div className="form-group">
              <label className="form-label">E-mail</label>
              <input
                type="email"
                className="form-input"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                autoComplete="email"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Senha</label>
              <input
                type="password"
                className="form-input"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div style={{
                background: "var(--danger-dim)",
                border: "1px solid rgba(239,68,68,0.3)",
                borderRadius: "var(--radius-md)",
                padding: "10px 14px",
                fontSize: "0.85rem",
                color: "var(--danger)",
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-full btn-lg"
              disabled={loading}
            >
              {loading ? <span className="spinner" style={{ width: 18, height: 18 }} /> : null}
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
