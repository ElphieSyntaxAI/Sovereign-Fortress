import type { AdminDashboardSession } from "./msgf-admin-api";

/** LOCAL DEV ONLY — unlocks global ops UI; never enabled in production builds. */
export const DEV_ADMIN_SESSION: AdminDashboardSession = {
  operator_role: "GLOBAL_ADMIN",
  dashboard_view: "tenant_health",
  can_promote_to_global: true,
};

const STORAGE_KEY = "msgf-dashboard-dev-admin-v1";

export function devAdminCredentials(): { email: string; password: string } {
  return {
    email: import.meta.env.VITE_DEV_ADMIN_EMAIL?.trim() ?? "",
    password: import.meta.env.VITE_DEV_ADMIN_PASSWORD ?? "",
  };
}

export function isDevAdminLoginEnabled(): boolean {
  const { email, password } = devAdminCredentials();
  return import.meta.env.DEV && Boolean(email && password);
}

export function validateDevAdminLogin(email: string, password: string): boolean {
  const expected = devAdminCredentials();
  if (!expected.email || !expected.password) return false;
  return email.trim() === expected.email && password === expected.password;
}

export function loadDevAdminSession(): AdminDashboardSession | null {
  if (!import.meta.env.DEV) return null;
  try {
    if (sessionStorage.getItem(STORAGE_KEY) === "1") return DEV_ADMIN_SESSION;
  } catch {
    /* private mode / blocked storage */
  }
  return null;
}

export function persistDevAdminSession(): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function clearDevAdminSession(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** When dev-authenticated, UI always uses GLOBAL_ADMIN tenant_health (API session is merged underneath). */
export function mergeDashboardSession(
  devAuthed: boolean,
  fromApi: AdminDashboardSession | null
): AdminDashboardSession | null {
  if (devAuthed) {
    return { ...fromApi, ...DEV_ADMIN_SESSION };
  }
  return fromApi;
}
