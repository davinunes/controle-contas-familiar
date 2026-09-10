"use client";
import { auth as authApi } from "./api";

export interface Tenant {
  id: number;
  name: string;
  slug: string;
  role: string;
}

export interface CurrentUser {
  id: number;
  name: string;
  email: string;
  is_superadmin: boolean;
  tenants: { tenant: Tenant; role: string }[];
}

export function getStoredUser(): CurrentUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("user");
  return raw ? JSON.parse(raw) : null;
}

export function getActiveTenantId(): number | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem("active_tenant_id");
  return v ? parseInt(v) : null;
}

export function setActiveTenant(id: number) {
  localStorage.setItem("active_tenant_id", String(id));
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

export async function login(email: string, password: string): Promise<CurrentUser> {
  const data = await authApi.login(email, password);
  localStorage.setItem("access_token", data.access_token);
  localStorage.setItem("refresh_token", data.refresh_token);
  localStorage.setItem("user", JSON.stringify(data.user));

  // Define o primeiro tenant como ativo
  if (data.user.tenants?.length > 0) {
    const tid = data.user.tenants[0].tenant.id;
    if (!localStorage.getItem("active_tenant_id")) {
      setActiveTenant(tid);
    }
  }

  return data.user;
}

export function logout() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("user");
  window.location.href = "/";
}

export function isLoggedIn(): boolean {
  return !!getAccessToken();
}

export function isSuperAdmin(): boolean {
  return !!getStoredUser()?.is_superadmin;
}

export function isTenantAdmin(tenantId?: number | null): boolean {
  const user = getStoredUser();
  if (!user) return false;
  if (user.is_superadmin) return true;
  const tid = tenantId ?? getActiveTenantId();
  if (!tid) return false;
  return user.tenants?.some(t => t.tenant.id === tid && t.role === "admin") ?? false;
}

export function hasAdminAccess(): boolean {
  const user = getStoredUser();
  if (!user) return false;
  if (user.is_superadmin) return true;
  return user.tenants?.some(t => t.role === "admin") ?? false;
}
