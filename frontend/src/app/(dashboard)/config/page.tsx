"use client";
import { useState, useEffect } from "react";
import { tenantsApi, usersApi, costCentersApi } from "@/lib/api";
import { getStoredUser, getActiveTenantId } from "@/lib/auth";

type Tab = "tenants" | "cost_centers" | "users" | "account";

export default function ConfigPage() {
  const [tab, setTab]         = useState<Tab>("tenants");
  const [tenants, setTenants] = useState<any[]>([]);
  const [users, setUsers]     = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast]     = useState<{ msg: string; type: "success"|"error" } | null>(null);
  const user = getStoredUser();

  // Tenant form
  const [tForm, setTForm] = useState({ name: "", slug: "" });
  const [editTenant, setEditTenant] = useState<any>(null);
  const [tS3, setTS3] = useState({ storage_url: "", s3_endpoint: "", s3_bucket: "", s3_access_key: "", s3_secret_key: "", s3_prefix: "" });
  const [showLegacyS3, setShowLegacyS3] = useState(false);

  // Cost Centers
  const [selectedTenantForCC, setSelectedTenantForCC] = useState<number | null>(null);
  const [costCenters, setCostCenters] = useState<any[]>([]);
  const [ccForm, setCcForm] = useState({ name: "", type: "person" as "person" | "category", color: "#6C63FF" });

  // User form
  const [uForm, setUForm] = useState({ name: "", email: "", password: "", is_superadmin: false, active: true, tenant_roles: [] as any[] });
  const [editUser, setEditUser] = useState<any>(null);

  // Account
  const [newPwd, setNewPwd]     = useState("");
  const [savingPwd, setSavPwd]  = useState(false);

  function showToast(msg: string, type: "success"|"error" = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  async function loadCostCenters(tid: number) {
    if (!tid) return;
    try {
      const data = await costCentersApi.list(tid, undefined, false);
      setCostCenters(data);
    } catch (e: any) {
      showToast("Erro ao carregar centros de custo: " + e.message, "error");
    }
  }

  useEffect(() => {
    if (selectedTenantForCC) {
      loadCostCenters(selectedTenantForCC);
    }
  }, [selectedTenantForCC]);

  async function createCostCenter() {
    if (!selectedTenantForCC || !ccForm.name.trim()) return;
    try {
      await costCentersApi.create(selectedTenantForCC, ccForm);
      setCcForm(f => ({ ...f, name: "" }));
      showToast("Item adicionado!");
      loadCostCenters(selectedTenantForCC);
    } catch (e: any) {
      showToast(e.message, "error");
    }
  }

  async function deleteCostCenter(id: number) {
    if (!selectedTenantForCC || !confirm("Excluir este item?")) return;
    try {
      await costCentersApi.delete(id);
      showToast("Item excluído.");
      loadCostCenters(selectedTenantForCC);
    } catch (e: any) {
      showToast(e.message, "error");
    }
  }

  async function loadAll() {
    setLoading(true);
    try {
      const [ts, us] = await Promise.all([tenantsApi.list(), usersApi.list()]);
      setTenants(ts);
      setUsers(us);
      const activeTid = getActiveTenantId();
      if (activeTid && ts.some((t: any) => t.id === activeTid)) {
        setSelectedTenantForCC(activeTid);
      } else if (ts.length > 0) {
        setSelectedTenantForCC(ts[0].id);
      }
    } catch (e: any) {
      showToast("Erro ao carregar dados: " + e.message, "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, []);

  // ── Tenant ──────────────────────────────────────────────
  async function createTenant() {
    try {
      await tenantsApi.create(tForm);
      setTForm({ name: "", slug: "" });
      showToast("Tenant criado!");
      loadAll();
    } catch (e: any) { showToast(e.message, "error"); }
  }

  async function updateTenantS3() {
    if (!editTenant) return;
    try {
      await tenantsApi.update(editTenant.id, tS3);
      showToast("S3 salvo!");
      setEditTenant(null);
      loadAll();
    } catch (e: any) { showToast(e.message, "error"); }
  }

  async function testS3(id: number) {
    try {
      const r = await tenantsApi.testS3(id);
      showToast(r.message, r.ok ? "success" : "error");
    } catch (e: any) { showToast(e.message, "error"); }
  }

  async function deleteTenant(id: number) {
    if (!confirm("Excluir este tenant? Todos os dados serão removidos!")) return;
    try { await tenantsApi.delete(id); loadAll(); showToast("Tenant excluído."); }
    catch (e: any) { showToast(e.message, "error"); }
  }

  // ── Users ────────────────────────────────────────────────
  async function createUser() {
    try {
      await usersApi.create(uForm);
      setUForm({ name: "", email: "", password: "", is_superadmin: false, active: true, tenant_roles: [] });
      showToast("Usuário criado!");
      loadAll();
    } catch (e: any) { showToast(e.message, "error"); }
  }

  async function deleteUser(id: number) {
    if (!confirm("Excluir usuário?")) return;
    try { await usersApi.delete(id); loadAll(); showToast("Usuário excluído."); }
    catch (e: any) { showToast(e.message, "error"); }
  }

  // ── Account ──────────────────────────────────────────────
  async function savePassword() {
    if (newPwd.length < 6) { showToast("Senha deve ter ao menos 6 caracteres.", "error"); return; }
    setSavPwd(true);
    try {
      await fetch("/api/users/me/password", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
        body: JSON.stringify({ password: newPwd }),
      });
      setNewPwd("");
      showToast("Senha alterada!");
    } catch (e: any) { showToast(e.message, "error"); }
    finally { setSavPwd(false); }
  }

  if (!user?.is_superadmin) {
    return (
      <div className="container" style={{ paddingTop: 40, textAlign: "center" }}>
        <div style={{ fontSize: "3rem" }}>🔒</div>
        <h2 style={{ marginTop: "16px" }}>Acesso Restrito</h2>
        <p>Apenas administradores podem acessar as configurações.</p>
      </div>
    );
  }

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: "tenants",      label: "Tenants",          icon: "🏢" },
    { key: "cost_centers", label: "Centros de Custo", icon: "🏷️" },
    { key: "users",        label: "Usuários",         icon: "👥" },
    { key: "account",      label: "Minha Conta",      icon: "👤" },
  ];

  return (
    <div className="container" style={{ paddingTop: "20px", paddingBottom: "32px" }}>
      <h1 style={{ marginBottom: "20px" }}>⚙️ Configurações</h1>

      {/* Tabs */}
      <div style={{
        display: "flex", gap: "4px",
        background: "var(--bg-elevated)",
        borderRadius: "var(--radius-md)",
        padding: "4px",
        marginBottom: "24px",
        border: "1px solid var(--border)",
      }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              flex: 1, padding: "8px 4px",
              borderRadius: "var(--radius-sm)",
              border: "none", cursor: "pointer",
              background: tab === t.key ? "var(--accent)" : "transparent",
              color: tab === t.key ? "#fff" : "var(--text-muted)",
              fontSize: "0.8rem", fontWeight: tab === t.key ? 600 : 400,
              transition: "var(--transition)",
              display: "flex", flexDirection: "column", alignItems: "center", gap: "2px",
            }}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : (
        <>
          {/* ── TENANTS ── */}
          {tab === "tenants" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className="card">
                <h3 style={{ marginBottom: "16px" }}>Novo Tenant</h3>
                <div className="grid-2" style={{ marginBottom: "12px" }}>
                  <div className="form-group">
                    <label className="form-label">Nome</label>
                    <input className="form-input" value={tForm.name}
                      onChange={e => setTForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Ex: Sogros" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Slug</label>
                    <input className="form-input" value={tForm.slug}
                      onChange={e => setTForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/\s/g, "-") }))}
                      placeholder="sogros" />
                  </div>
                </div>
                <button className="btn btn-primary" onClick={createTenant}
                  disabled={!tForm.name || !tForm.slug}>
                  + Criar Tenant
                </button>
              </div>

              {tenants.map(t => (
                <div key={t.id} className="card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{t.name}</div>
                      <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontFamily: "monospace" }}>/{t.slug}</div>
                    </div>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button className="btn btn-secondary btn-sm"
                        onClick={() => {
                          setEditTenant(t);
                          setTS3({
                            storage_url: t.storage_url || "",
                            s3_endpoint: t.s3_endpoint || "",
                            s3_bucket: t.s3_bucket || "",
                            s3_access_key: "",
                            s3_secret_key: "",
                            s3_prefix: t.s3_prefix || "",
                          });
                          setShowLegacyS3(false);
                        }}>
                        📦 Storage
                      </button>
                      <button className="btn btn-secondary btn-sm" onClick={() => testS3(t.id)}>
                        🧪 Testar
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => deleteTenant(t.id)}>
                        🗑️
                      </button>
                    </div>
                  </div>
                  {t.storage_url ? (
                    <div style={{ fontSize: "0.78rem", color: "var(--accent)", display: "flex", alignItems: "center", gap: "6px" }}>
                      <span>🟢</span>
                      <span>URL Pré-autenticada (PAR) ativa</span>
                    </div>
                  ) : t.s3_bucket ? (
                    <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis" }}>
                      Bucket: {t.s3_bucket} · Prefix: {t.s3_prefix || "(raiz)"}
                    </div>
                  ) : (
                    <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                      ⚠️ Storage não configurado
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── CENTROS DE CUSTO (CONCEITO DUPLO) ── */}
          {tab === "cost_centers" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* Seletor de Tenant */}
              <div className="card" style={{ padding: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "1.1rem" }}>🏷️ Centros de Custo & Responsáveis</h3>
                    <p style={{ margin: "4px 0 0", fontSize: "0.82rem", color: "var(--text-muted)" }}>
                      Organize as contas por Pessoa Responsável (ex: Sogro, Sogra) e por Categoria (ex: Farmácia, Mercado).
                    </p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Família:</span>
                    <select
                      className="form-input"
                      style={{ padding: "6px 12px", width: "auto" }}
                      value={selectedTenantForCC || ""}
                      onChange={e => setSelectedTenantForCC(Number(e.target.value))}
                    >
                      {tenants.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Formulário Novo CC */}
              <div className="card">
                <h4 style={{ marginBottom: "14px" }}>+ Adicionar Item</h4>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 140px 70px auto", gap: "10px", alignItems: "flex-end" }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Nome</label>
                    <input
                      className="form-input"
                      value={ccForm.name}
                      onChange={e => setCcForm(f => ({ ...f, name: e.target.value }))}
                      placeholder={ccForm.type === "person" ? "Ex: Sogro, Sogra, Ambos" : "Ex: Farmácia, Mercado, Luz"}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Tipo</label>
                    <select
                      className="form-input"
                      value={ccForm.type}
                      onChange={e => setCcForm(f => ({ ...f, type: e.target.value as any }))}
                    >
                      <option value="person">👤 Pessoa</option>
                      <option value="category">📁 Categoria</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Cor</label>
                    <input
                      type="color"
                      className="form-input"
                      style={{ padding: "2px", height: "40px", cursor: "pointer" }}
                      value={ccForm.color}
                      onChange={e => setCcForm(f => ({ ...f, color: e.target.value }))}
                    />
                  </div>
                  <button
                    className="btn btn-primary"
                    onClick={createCostCenter}
                    disabled={!ccForm.name.trim() || !selectedTenantForCC}
                    style={{ height: "40px" }}
                  >
                    Adicionar
                  </button>
                </div>
              </div>

              {/* Listas Divididas: Pessoas vs Categorias */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
                {/* Pessoas */}
                <div className="card">
                  <h4 style={{ marginBottom: "12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span>👤 Pessoas / Responsáveis</span>
                    <span style={{ fontSize: "0.75rem", background: "var(--bg-elevated)", padding: "2px 8px", borderRadius: "10px" }}>
                      {costCenters.filter(c => c.type === "person").length}
                    </span>
                  </h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {costCenters.filter(c => c.type === "person").map(cc => (
                      <div
                        key={cc.id}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          padding: "8px 12px", background: "var(--bg-elevated)", borderRadius: "var(--radius-md)"
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ width: 12, height: 12, borderRadius: "50%", background: cc.color || "#6C63FF", flexShrink: 0 }} />
                          <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{cc.name}</span>
                        </div>
                        <button
                          className="btn btn-danger btn-sm"
                          style={{ padding: "3px 8px", fontSize: "0.75rem" }}
                          onClick={() => deleteCostCenter(cc.id)}
                          title="Excluir"
                        >
                          🗑️
                        </button>
                      </div>
                    ))}
                    {costCenters.filter(c => c.type === "person").length === 0 && (
                      <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", margin: "8px 0" }}>
                        Nenhuma pessoa cadastrada (ex: Sogro, Sogra, Ambos).
                      </p>
                    )}
                  </div>
                </div>

                {/* Categorias */}
                <div className="card">
                  <h4 style={{ marginBottom: "12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span>📁 Categorias de Gasto</span>
                    <span style={{ fontSize: "0.75rem", background: "var(--bg-elevated)", padding: "2px 8px", borderRadius: "10px" }}>
                      {costCenters.filter(c => c.type === "category").length}
                    </span>
                  </h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {costCenters.filter(c => c.type === "category").map(cc => (
                      <div
                        key={cc.id}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          padding: "8px 12px", background: "var(--bg-elevated)", borderRadius: "var(--radius-md)"
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ width: 12, height: 12, borderRadius: "50%", background: cc.color || "#6C63FF", flexShrink: 0 }} />
                          <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{cc.name}</span>
                        </div>
                        <button
                          className="btn btn-danger btn-sm"
                          style={{ padding: "3px 8px", fontSize: "0.75rem" }}
                          onClick={() => deleteCostCenter(cc.id)}
                          title="Excluir"
                        >
                          🗑️
                        </button>
                      </div>
                    ))}
                    {costCenters.filter(c => c.type === "category").length === 0 && (
                      <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", margin: "8px 0" }}>
                        Nenhuma categoria cadastrada (ex: Farmácia, Mercado, Luz).
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── USERS ── */}
          {tab === "users" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className="card">
                <h3 style={{ marginBottom: "16px" }}>Novo Usuário</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Nome</label>
                      <input className="form-input" value={uForm.name}
                        onChange={e => setUForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome completo" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Email</label>
                      <input type="email" className="form-input" value={uForm.email}
                        onChange={e => setUForm(f => ({ ...f, email: e.target.value }))} placeholder="email@example.com" />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Senha Inicial</label>
                    <input type="password" className="form-input" value={uForm.password}
                      onChange={e => setUForm(f => ({ ...f, password: e.target.value }))} placeholder="Mínimo 6 caracteres" />
                  </div>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.85rem", cursor: "pointer" }}>
                    <input type="checkbox" checked={uForm.is_superadmin}
                      onChange={e => setUForm(f => ({ ...f, is_superadmin: e.target.checked }))} />
                    Superadmin
                  </label>
                  <div>
                    <label className="form-label">Tenants de acesso</label>
                    {tenants.map(t => (
                      <label key={t.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 0", fontSize: "0.85rem", cursor: "pointer" }}>
                        <input type="checkbox"
                          checked={uForm.tenant_roles.some((r: any) => r.tenant_id === t.id)}
                          onChange={e => {
                            setUForm(f => ({
                              ...f,
                              tenant_roles: e.target.checked
                                ? [...f.tenant_roles, { tenant_id: t.id, role: "user" }]
                                : f.tenant_roles.filter((r: any) => r.tenant_id !== t.id),
                            }));
                          }} />
                        {t.name}
                        {uForm.tenant_roles.some((r: any) => r.tenant_id === t.id) && (
                          <select
                            style={{ marginLeft: "auto", background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)", borderRadius: "4px", padding: "2px 6px", fontSize: "0.75rem" }}
                            value={uForm.tenant_roles.find((r: any) => r.tenant_id === t.id)?.role || "user"}
                            onChange={e => setUForm(f => ({ ...f, tenant_roles: f.tenant_roles.map((r: any) => r.tenant_id === t.id ? { ...r, role: e.target.value } : r) }))}
                            onClick={ev => ev.stopPropagation()}
                          >
                            <option value="user">Visualizador</option>
                            <option value="admin">Admin</option>
                          </select>
                        )}
                      </label>
                    ))}
                  </div>
                  <button className="btn btn-primary" onClick={createUser}
                    disabled={!uForm.name || !uForm.email || !uForm.password}>
                    + Criar Usuário
                  </button>
                </div>
              </div>

              {users.map(u => (
                <div key={u.id} className="card" style={{ padding: "12px 14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{u.name}</div>
                      <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{u.email}</div>
                      <div style={{ display: "flex", gap: "4px", marginTop: "4px", flexWrap: "wrap" }}>
                        {u.is_superadmin && <span className="badge badge-accent" style={{ fontSize: "0.65rem" }}>Superadmin</span>}
                        {!u.active && <span className="badge" style={{ fontSize: "0.65rem", background: "var(--bg-hover)" }}>Inativo</span>}
                        {u.tenants?.map((t: any) => (
                          <span key={t.tenant.id} className="badge badge-info" style={{ fontSize: "0.65rem" }}>
                            {t.tenant.name} ({t.role})
                          </span>
                        ))}
                      </div>
                    </div>
                    <button className="btn btn-danger btn-sm" onClick={() => deleteUser(u.id)}>🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── ACCOUNT ── */}
          {tab === "account" && (
            <div className="card">
              <h3 style={{ marginBottom: "16px" }}>Alterar Senha</h3>
              <div className="form-group" style={{ marginBottom: "16px" }}>
                <label className="form-label">Nova Senha</label>
                <input type="password" className="form-input" value={newPwd}
                  onChange={e => setNewPwd(e.target.value)}
                  placeholder="Mínimo 6 caracteres" />
              </div>
              <button className="btn btn-primary" onClick={savePassword} disabled={savingPwd || newPwd.length < 6}>
                {savingPwd ? "Salvando..." : "💾 Alterar Senha"}
              </button>
            </div>
          )}
        </>
      )}

      {/* Storage / PAR Modal */}
      {editTenant && (
        <div className="modal-overlay" onClick={() => setEditTenant(null)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: "560px" }}>
            <h2 style={{ marginBottom: "8px" }}>📦 Armazenamento — {editTenant.name}</h2>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "20px" }}>
              Cole a URL Pré-autenticada gerada no Oracle Object Storage para upload e visualização das notas fiscais e comprovantes.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600, color: "var(--text-base)" }}>
                  URL Pré-autenticada (PAR) da Oracle
                </label>
                <textarea
                  className="form-input"
                  rows={3}
                  value={tS3.storage_url}
                  onChange={e => setTS3(s => ({ ...s, storage_url: e.target.value }))}
                  placeholder="https://objectstorage.sa-saopaulo-1.oraclecloud.com/p/.../n/.../b/.../o/"
                  style={{ fontSize: "0.82rem", fontFamily: "monospace", resize: "vertical" }}
                />
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px", lineHeight: "1.4" }}>
                  💡 <b>Como obter no Oracle Cloud:</b> Vá no seu Bucket ➔ menu lateral <b>Pre-Authenticated Requests</b> ➔ clique em <b>Create</b> ➔ Selecione <b>Bucket</b> e marque <b>Permit object reads and writes</b> ➔ Cole a URL inteira aqui.
                </span>
              </div>

              {/* Opções S3 Legadas */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowLegacyS3(!showLegacyS3)}
                  style={{
                    background: "none", border: "none", color: "var(--text-muted)",
                    fontSize: "0.8rem", cursor: "pointer", textDecoration: "underline", padding: 0
                  }}
                >
                  {showLegacyS3 ? "▲ Ocultar opções legadas S3" : "▼ Ou configurar via credenciais S3 legadas (Access/Secret Key)"}
                </button>
              </div>

              {showLegacyS3 && (
                <div style={{
                  display: "flex", flexDirection: "column", gap: "12px",
                  padding: "14px", background: "var(--bg-elevated)", borderRadius: "var(--radius-md)"
                }}>
                  <div className="form-group">
                    <label className="form-label">Endpoint S3</label>
                    <input className="form-input" value={tS3.s3_endpoint}
                      onChange={e => setTS3(s => ({ ...s, s3_endpoint: e.target.value }))}
                      placeholder="https://xyz.compat.objectstorage.sa-saopaulo-1.oraclecloud.com" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Bucket</label>
                    <input className="form-input" value={tS3.s3_bucket}
                      onChange={e => setTS3(s => ({ ...s, s3_bucket: e.target.value }))}
                      placeholder="nome-do-bucket" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Access Key</label>
                    <input className="form-input" value={tS3.s3_access_key}
                      onChange={e => setTS3(s => ({ ...s, s3_access_key: e.target.value }))}
                      placeholder="Deixe vazio para não alterar" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Secret Key</label>
                    <input type="password" className="form-input" value={tS3.s3_secret_key}
                      onChange={e => setTS3(s => ({ ...s, s3_secret_key: e.target.value }))}
                      placeholder="Deixe vazio para não alterar" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Prefix (pasta)</label>
                    <input className="form-input" value={tS3.s3_prefix}
                      onChange={e => setTS3(s => ({ ...s, s3_prefix: e.target.value }))}
                      placeholder="Ex: organizar/sogros" />
                  </div>
                </div>
              )}

              <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
                <button className="btn btn-primary" style={{ flex: 2 }} onClick={updateTenantS3}>
                  💾 Salvar Armazenamento
                </button>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => testS3(editTenant.id)}>
                  🧪 Testar
                </button>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setEditTenant(null)}>
                  Fechar
                </button>
              </div>
            </div>
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
