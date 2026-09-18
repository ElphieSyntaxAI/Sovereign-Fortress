import type { MsgfGuardSettings } from "./settingsTypes";
import {
  MSGF_AGENT_ID_HEADER,
  MSGF_AGENT_ROLE_HEADER,
  MSGF_MANDATE_HASH_HEADER,
  MSGF_PARENT_AGENT_ID_HEADER,
} from "./constants";

export type SwarmHeaderSettings = Pick<
  MsgfGuardSettings,
  "agentId" | "parentAgentId" | "agentRole" | "mandateHash"
>;

export function resolvePulseAgentRole(settings: SwarmHeaderSettings): "primary" | "secondary" | "system_heal" {
  const raw = settings.agentRole?.trim().toLowerCase() ?? "";
  if (raw === "secondary" || raw === "system_heal" || raw === "primary") return raw;
  return settings.parentAgentId?.trim() ? "secondary" : "primary";
}

/** Forwards swarm identity on Pulse. Missing headers stay primary (server default). */
export function appendSwarmPulseHeaders(
  headers: Record<string, string>,
  settings: SwarmHeaderSettings,
  entityId: string
): void {
  const agentId = settings.agentId?.trim() || entityId.trim();
  if (agentId) headers[MSGF_AGENT_ID_HEADER] = agentId;

  const parent = settings.parentAgentId?.trim();
  if (parent) headers[MSGF_PARENT_AGENT_ID_HEADER] = parent;

  const role = resolvePulseAgentRole(settings);
  if (parent || settings.agentRole?.trim()) {
    headers[MSGF_AGENT_ROLE_HEADER] = role;
  }

  const mandate = settings.mandateHash?.trim().toLowerCase();
  if (mandate) headers[MSGF_MANDATE_HASH_HEADER] = mandate;
}
