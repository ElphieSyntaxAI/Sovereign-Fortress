/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MODULAR_TENANTS_JSON?: string;
  /** Override default Vortex health probe URL (default: http://localhost:3010/api/health). */
  readonly VITE_VORTEX_CLIENT_HEALTH_URL?: string;
  /** Override MSGF API origin (default in prod build: Cloud Run URL in msgf-admin-api.ts). */
  readonly VITE_MSGF_API_BASE_URL?: string;
  /** Dev-only operator gate (`import.meta.env.DEV`). */
  readonly VITE_DEV_ADMIN_EMAIL?: string;
  readonly VITE_DEV_ADMIN_PASSWORD?: string;
  readonly VITE_MSGF_ADMIN_BEARER_TOKEN?: string;
  readonly VITE_MSGF_OPERATOR_USER_ID?: string;
  /** Tenant id for Local Law Book panel (company dashboard). */
  readonly VITE_MSGF_LAW_BOOK_TENANT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
