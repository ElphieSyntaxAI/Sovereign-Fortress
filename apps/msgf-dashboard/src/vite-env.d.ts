/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MODULAR_TENANTS_JSON?: string;
  /** Override default Vortex health probe URL (default: http://localhost:3010/api/health). */
  readonly VITE_VORTEX_CLIENT_HEALTH_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
