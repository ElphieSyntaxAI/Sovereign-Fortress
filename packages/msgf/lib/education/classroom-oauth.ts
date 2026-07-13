/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * Distribution Build ID: MSGF-a7aa881-20260620T084430Z-internal
 */
/**
 * Google Classroom OAuth (Classroom-first host) — start + callback helpers.
 */
import { createHash, randomBytes } from "crypto";

import { launchFromGoogleClassroom } from "@/lib/education/classroom-launch";
import type { MilestoneTemplateId } from "@/lib/education/milestone-gate";
import type { SupabaseClient } from "@supabase/supabase-js";

const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO = "https://www.googleapis.com/oauth2/v3/userinfo";

export function classroomOAuthConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLASSROOM_CLIENT_ID?.trim() &&
      process.env.GOOGLE_CLASSROOM_CLIENT_SECRET?.trim() &&
      process.env.GOOGLE_CLASSROOM_REDIRECT_URI?.trim()
  );
}

export function buildClassroomOAuthStartUrl(input: {
  state: string;
  scopes?: string[];
}): string {
  const clientId = process.env.GOOGLE_CLASSROOM_CLIENT_ID?.trim();
  const redirectUri = process.env.GOOGLE_CLASSROOM_REDIRECT_URI?.trim();
  if (!clientId || !redirectUri) {
    throw new Error("GOOGLE_CLASSROOM_CLIENT_ID / REDIRECT_URI not configured");
  }

  const scopes = (
    input.scopes ?? [
      "openid",
      "email",
      "profile",
      "https://www.googleapis.com/auth/classroom.courses.readonly",
      "https://www.googleapis.com/auth/classroom.coursework.me",
    ]
  ).join(" ");

  const url = new URL(GOOGLE_AUTH);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scopes);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", input.state);
  url.searchParams.set("prompt", "consent");
  return url.toString();
}

export function mintOAuthState(payload: Record<string, string>): string {
  const nonce = randomBytes(16).toString("hex");
  const body = Buffer.from(JSON.stringify({ ...payload, nonce }), "utf8").toString(
    "base64url"
  );
  const sig = createHash("sha256")
    .update(`${body}:${process.env.GOOGLE_CLASSROOM_CLIENT_SECRET ?? "dev"}`)
    .digest("base64url")
    .slice(0, 16);
  return `${body}.${sig}`;
}

export function parseOAuthState(state: string): Record<string, string> | null {
  const [body, sig] = state.split(".");
  if (!body || !sig) return null;
  const expected = createHash("sha256")
    .update(`${body}:${process.env.GOOGLE_CLASSROOM_CLIENT_SECRET ?? "dev"}`)
    .digest("base64url")
    .slice(0, 16);
  if (sig !== expected) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Record<
      string,
      string
    >;
  } catch {
    return null;
  }
}

export async function exchangeClassroomCode(code: string): Promise<{
  accessToken: string;
  idToken?: string;
}> {
  const clientId = process.env.GOOGLE_CLASSROOM_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLASSROOM_CLIENT_SECRET?.trim();
  const redirectUri = process.env.GOOGLE_CLASSROOM_REDIRECT_URI?.trim();
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Google Classroom OAuth env incomplete");
  }

  const res = await fetch(GOOGLE_TOKEN, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token exchange failed: ${res.status} ${text.slice(0, 400)}`);
  }
  const json = (await res.json()) as {
    access_token?: string;
    id_token?: string;
  };
  if (!json.access_token) throw new Error("Google token response missing access_token");
  return { accessToken: json.access_token, idToken: json.id_token };
}

export async function fetchGoogleSub(accessToken: string): Promise<string> {
  const res = await fetch(GOOGLE_USERINFO, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Google userinfo failed: ${res.status}`);
  }
  const json = (await res.json()) as { sub?: string };
  if (!json.sub) throw new Error("Google userinfo missing sub");
  return json.sub;
}

export async function completeClassroomOAuthLaunch(params: {
  admin: SupabaseClient;
  code: string;
  statePayload: Record<string, string>;
}): Promise<{
  entityToken: string;
  anonymousDisplayToken: string;
  assignmentInstanceId: string;
  wire: unknown;
  educationAppRedirect: string;
}> {
  const tokens = await exchangeClassroomCode(params.code);
  const googleSub = await fetchGoogleSub(tokens.accessToken);

  const tenantId = params.statePayload.tenantId || "syntax_education";
  const assignmentId = params.statePayload.assignmentId;
  const courseId = params.statePayload.courseId || "unknown-course";
  const courseWorkId = params.statePayload.courseWorkId || "unknown-work";
  if (!assignmentId) throw new Error("OAuth state missing assignmentId");

  const result = await launchFromGoogleClassroom({
    admin: params.admin,
    tenantId,
    googleSub,
    courseId,
    courseWorkId,
    assignmentId,
    gradeCohort: params.statePayload.gradeBand || "4_6",
    milestoneTemplateId: (params.statePayload.milestoneTemplateId ||
      "generic_sections") as MilestoneTemplateId,
    resourceContextId: params.statePayload.resourceContextId || null,
    role: (params.statePayload.role as "student" | "teacher") || "student",
  });

  const appBase =
    process.env.EDUCATION_APP_URL?.replace(/\/+$/, "") ||
    "http://127.0.0.1:5175";
  const educationAppRedirect = `${appBase}/sandbox?assignmentInstanceId=${encodeURIComponent(
    result.assignmentInstance.assignmentInstanceId
  )}&entityToken=${encodeURIComponent(result.entityToken)}`;

  return {
    entityToken: result.entityToken,
    anonymousDisplayToken: result.anonymousDisplayToken,
    assignmentInstanceId: result.assignmentInstance.assignmentInstanceId,
    wire: result.wire,
    educationAppRedirect,
  };
}
