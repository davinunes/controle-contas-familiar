// API client centralizado
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

function getHeaders(): HeadersInit {
  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
  const tenantId = typeof window !== "undefined" ? localStorage.getItem("active_tenant_id") : null;
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(tenantId ? { "X-Tenant-ID": tenantId } : {}),
  };
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...getHeaders(),
      ...(options.headers || {}),
    },
  });

  if (res.status === 401) {
    // Tenta refresh
    const refreshed = await tryRefresh();
    if (refreshed) {
      return request<T>(path, options);
    }
    window.location.href = "/";
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    let msg = `HTTP ${res.status}`;
    if (typeof err.detail === "string") {
      msg = err.detail;
    } else if (Array.isArray(err.detail)) {
      msg = err.detail.map((d: any) => `${d.loc?.slice(1).join('.') || 'campo'}: ${d.msg}`).join("; ");
    }
    throw new Error(msg);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

async function tryRefresh(): Promise<boolean> {
  const refreshToken = localStorage.getItem("refresh_token");
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    localStorage.setItem("access_token", data.access_token);
    localStorage.setItem("refresh_token", data.refresh_token);
    return true;
  } catch {
    return false;
  }
}

// Auth
export const auth = {
  login: (email: string, password: string) =>
    request<any>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<any>("/auth/me"),
};

// Tenants
export const tenantsApi = {
  list: ()                => request<any[]>("/tenants"),
  create: (data: any)     => request<any>("/tenants", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: any) => request<any>(`/tenants/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: number)    => request<void>(`/tenants/${id}`, { method: "DELETE" }),
  testS3: (id: number)    => request<any>(`/tenants/${id}/test-s3`, { method: "POST" }),
};

// Users
export const usersApi = {
  list: ()                        => request<any[]>("/users"),
  create: (data: any)             => request<any>("/users", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: any) => request<any>(`/users/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: number)            => request<void>(`/users/${id}`, { method: "DELETE" }),
};

// Cost Centers (Conceito Duplo: person e category)
export const costCentersApi = {
  list: (tenantId: number, type?: "person" | "category", activeOnly = true) => {
    const q = new URLSearchParams({ tenant_id: String(tenantId), active_only: String(activeOnly) });
    if (type) q.append("type", type);
    return request<any[]>(`/cost-centers?${q}`);
  },
  create: (tenantId: number, data: any) =>
    request<any>(`/cost-centers?tenant_id=${tenantId}`, { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: any) =>
    request<any>(`/cost-centers/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: number) =>
    request<void>(`/cost-centers/${id}`, { method: "DELETE" }),
};

// Expenses
export const expensesApi = {
  list: (tenantId: number, activeOnly = true) =>
    request<any[]>(`/expenses?tenant_id=${tenantId}&active_only=${activeOnly}`),
  get: (id: number) =>
    request<any>(`/expenses/${id}`),
  create: (tenantId: number, data: any) =>
    request<any>(`/expenses?tenant_id=${tenantId}`, { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: any) =>
    request<any>(`/expenses/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: number) =>
    request<void>(`/expenses/${id}`, { method: "DELETE" }),
  quickQr: (tenantId: number, qrUrl: string) =>
    request<any>(`/expenses/quick-qr?tenant_id=${tenantId}`, {
      method: "POST",
      body: JSON.stringify({ qr_url: qrUrl }),
    }),
};

// Occurrences
export const occurrencesApi = {
  list: (tenantId: number, params: { month?: string; expense_id?: number; status?: string } = {}) => {
    const q = new URLSearchParams({ tenant_id: String(tenantId), ...params as any });
    return request<any[]>(`/occurrences?${q}`);
  },
  overdue: (tenantId: number) =>
    request<any[]>(`/occurrences/overdue?tenant_id=${tenantId}`),
  get: (id: number)  =>
    request<any>(`/occurrences/${id}`),
  create: (tenantId: number, data: any) =>
    request<any>(`/occurrences?tenant_id=${tenantId}`, { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: any) =>
    request<any>(`/occurrences/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: number) =>
    request<void>(`/occurrences/${id}`, { method: "DELETE" }),
};

// Attachments
export const attachmentsApi = {
  upload: (occurrenceId: number, type: string, file: File) => {
    const token = localStorage.getItem("access_token");
    const tenantId = localStorage.getItem("active_tenant_id");
    const formData = new FormData();
    formData.append("file", file);
    return fetch(
      `${API_BASE}/attachments/occurrences/${occurrenceId}?attachment_type=${type}`,
      {
        method: "POST",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(tenantId ? { "X-Tenant-ID": tenantId } : {}),
        },
        body: formData,
      }
    ).then(async (r) => {
      if (!r.ok) throw new Error((await r.json()).detail || "Upload falhou");
      return r.json();
    });
  },
  delete: (id: number) =>
    request<any>(`/attachments/${id}`, { method: "DELETE" }),
};

// Dashboard
export const dashboardApi = {
  resumo: (tenantId: number, month: string) =>
    request<any[]>(`/dashboard/resumo?tenant_id=${tenantId}&month=${month}`),
  whatsapp: (tenantId: number, month: string, personId?: number | null) => {
    const q = new URLSearchParams({ tenant_id: String(tenantId), month });
    if (personId) q.append("person_id", String(personId));
    return request<{ text: string }>(`/dashboard/whatsapp?${q}`);
  },
  fiado: (tenantId: number) =>
    request<any>(`/dashboard/fiado?tenant_id=${tenantId}`),
};
