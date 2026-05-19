declare module "msgf/lib/platform-persona-auth" {
  export const PLATFORM_IDS: readonly ["author", "education", "gatedai"];
  export type PlatformId = (typeof PLATFORM_IDS)[number];
  export type PersonaOption = { id: string; label: string };
  export const PERSONAS_BY_PLATFORM: Record<PlatformId, PersonaOption[]>;
  export const PLATFORM_TENANT_ID: Record<PlatformId, string>;
  export const PLATFORM_COMING_SOON: Record<PlatformId, boolean>;
  export const ELPHIE_PLATFORM_COOKIE: string;
  export const ELPHIE_PERSONA_COOKIE: string;
  export type PlatformLoginBody = {
    email: string;
    password: string;
    platform: PlatformId;
    persona: string;
  };
  export function isPlatformId(v: unknown): v is PlatformId;
  export function isPersonaValidForPlatform(platform: PlatformId, persona: string): boolean;
  export function personaToProfileRole(platform: PlatformId, persona: string): string;
  export function resolvePostLoginRedirect(platform: PlatformId): string;
  export function parsePlatformLoginBody(body: Record<string, unknown>): PlatformLoginBody | null;
}
