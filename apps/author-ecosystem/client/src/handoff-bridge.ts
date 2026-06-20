import { createClient } from "@supabase/supabase-js";

type HandoffConfig = {
  supabaseUrl: string;
  supabasePublishableKey: string;
  accessToken: string;
  refreshToken: string;
  returnTo: string;
  finishUrl: string;
};

function readConfig(): HandoffConfig {
  const el = document.getElementById("handoff-config");
  if (!el?.textContent?.trim()) {
    throw new Error("Missing handoff configuration.");
  }
  return JSON.parse(el.textContent) as HandoffConfig;
}

function fail(statusEl: HTMLElement, msg: string): void {
  statusEl.textContent = msg;
  statusEl.className = "err";
}

async function main(): Promise<void> {
  const statusEl = document.getElementById("status");
  if (!statusEl) return;

  const cfg = readConfig();
  const supabase = createClient(cfg.supabaseUrl, cfg.supabasePublishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });

  const { data, error } = await supabase.auth.setSession({
    access_token: cfg.accessToken,
    refresh_token: cfg.refreshToken,
  });
  if (error || !data.session) {
    fail(statusEl, error?.message ?? "Could not establish session.");
    return;
  }

  const fin = await fetch(cfg.finishUrl, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${data.session.access_token}`,
    },
    body: JSON.stringify({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    }),
  });
  if (!fin.ok) {
    const t = await fin.text().catch(() => "");
    fail(statusEl, t || "Could not finalize Author session.");
    return;
  }

  window.location.replace(cfg.returnTo);
}

void main().catch((e: unknown) => {
  const statusEl = document.getElementById("status");
  if (statusEl && statusEl.className !== "err") {
    fail(statusEl, e instanceof Error ? e.message : "Handoff failed.");
  }
});
