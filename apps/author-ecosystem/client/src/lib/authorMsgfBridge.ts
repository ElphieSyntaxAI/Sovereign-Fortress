import { MsgfBridge } from "msgf/connector";

let bridge: MsgfBridge | null = null;

/**
 * Browser MsgfBridge for Author — BFF proxy + tenant silo `author_ecosystem`.
 */
export function getAuthorMsgfBridge(): MsgfBridge {
  if (!bridge) {
    bridge = new MsgfBridge({
      tenantId:
        import.meta.env.VITE_MSGF_TENANT_ID?.trim() || "author_ecosystem",
      licenseKey: "author-bff",
      baseUrl:
        typeof window !== "undefined"
          ? window.location.origin
          : "http://127.0.0.1:5173",
      sessionPersistence: true,
    });
  }
  return bridge;
}
