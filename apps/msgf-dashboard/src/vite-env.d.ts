/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MODULAR_TENANTS_JSON?: string;
  /** Override default Vortex health probe URL (default: http://localhost:3010/api/health). */
  readonly VITE_VORTEX_CLIENT_HEALTH_URL?: string;
  readonly VITE_MSGF_API_BASE_URL?: string;
  readonly VITE_MSGF_ADMIN_BEARER_TOKEN?: string;
  readonly VITE_MSGF_OPERATOR_USER_ID?: string;
  /** Tenant id for Local Law Book panel (company dashboard). */
  readonly VITE_MSGF_LAW_BOOK_TENANT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
