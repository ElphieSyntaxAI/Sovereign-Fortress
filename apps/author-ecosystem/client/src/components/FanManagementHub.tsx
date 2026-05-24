import { useCallback, useEffect, useState } from "react";

import { useNarrative } from "../context/NarrativeContext";
import { getPreferredBffBearer } from "../lib/authAccessToken";
import { bffAuthHeaders, bffCredentials, bffUrl } from "../lib/bffFetch";
import { FAN_PAGE_TEMPLATES, templateById } from "../lib/fanPageTemplates";

type FanModules = {
  polls: boolean;
  games: boolean;
  fan_rag: boolean;
  progress_bar: { enabled: boolean; shared: boolean };
  fan_mail: boolean;
  quizzes: boolean;
  fan_art_slots: number;
};

type FanMail = {
  id: string;
  fan_display_name: string | null;
  subject: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

type FanHubPayload = {
  config: {
    template_id: string;
    theme: { primary: string; accent: string; background: string };
    modules: FanModules;
  };
  fan_mail: FanMail[];
};

const MODULE_LABELS: { key: keyof FanModules | "progress_bar"; label: string; hint: string }[] = [
  { key: "polls", label: "Fan polls", hint: "Community votes on lore-safe questions." },
  { key: "games", label: "Fan games", hint: "Light interactive mini-games in the hub." },
  { key: "fan_rag", label: "Fan RAG models", hint: "Persona bots grounded in published canon only." },
  { key: "progress_bar", label: "Progress bar", hint: "Optional shared drafting milestone (author-controlled)." },
  { key: "fan_mail", label: "Fan mail", hint: "One-way messages to the author (no reply thread)." },
  { key: "quizzes", label: "Fan quizzes", hint: "Consistency quizzes from published lore." },
];

export function FanManagementHub() {
  const { selection } = useNarrative();
  const [hub, setHub] = useState<FanHubPayload | null>(null);
  const [templateId, setTemplateId] = useState("aurora");
  const [primary, setPrimary] = useState("#8b5cf6");
  const [accent, setAccent] = useState("#f59e0b");
  const [modules, setModules] = useState<FanModules | null>(null);
  const [fanArtSlots, setFanArtSlots] = useState(3);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"design" | "modules" | "mail" | "preview">("design");

  const load = useCallback(async () => {
    if (!selection?.manuscriptId) {
      setHub(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const token = await getPreferredBffBearer();
      const res = await fetch(bffUrl(`/api/fan-hub/${encodeURIComponent(selection.manuscriptId)}`), {
        ...bffCredentials,
        headers: { ...bffAuthHeaders(token) },
      });
      const json = (await res.json().catch(() => ({}))) as FanHubPayload & { error?: string };
      if (!res.ok) throw new Error(json.error || res.statusText);
      setHub(json);
      setTemplateId(json.config.template_id);
      setPrimary(String(json.config.theme?.primary ?? "#8b5cf6"));
      setAccent(String(json.config.theme?.accent ?? "#f59e0b"));
      setModules(json.config.modules);
      setFanArtSlots(Number(json.config.modules?.fan_art_slots ?? 3));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [selection?.manuscriptId]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!selection?.manuscriptId || !modules) return;
    setSaving(true);
    setError(null);
    try {
      const token = await getPreferredBffBearer();
      const res = await fetch(bffUrl(`/api/fan-hub/${encodeURIComponent(selection.manuscriptId)}`), {
        method: "PUT",
        ...bffCredentials,
        headers: { ...bffAuthHeaders(token), "Content-Type": "application/json" },
        body: JSON.stringify({
          template_id: templateId,
          theme: { primary, accent, background: templateById(templateId).defaultTheme.background },
          modules: { ...modules, fan_art_slots: fanArtSlots },
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error || res.statusText);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const markMailRead = async (mailId: string) => {
    if (!selection?.manuscriptId) return;
    const token = await getPreferredBffBearer();
    await fetch(
      bffUrl(
        `/api/fan-hub/${encodeURIComponent(selection.manuscriptId)}/mail/${encodeURIComponent(mailId)}/read`
      ),
      { method: "PATCH", ...bffCredentials, headers: { ...bffAuthHeaders(token) } }
    );
    await load();
  };

  if (!selection) {
    return (
      <p className="rounded-lg border border-amber-900/40 bg-amber-950/25 px-4 py-3 text-sm text-amber-100/90">
        Select an active manuscript on Manuscripts to configure the fan-facing hub.
      </p>
    );
  }

  const tpl = templateById(templateId);

  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap gap-2" aria-label="Fan management sections">
        {(
          [
            ["design", "Page design"],
            ["modules", "Engagement"],
            ["mail", "Fan mail"],
            ["preview", "Preview"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={[
              "rounded-full border px-3 py-1.5 text-xs font-medium",
              tab === id
                ? "border-amber-500/60 bg-amber-600/30 text-amber-50"
                : "border-zinc-700 text-zinc-400 hover:border-zinc-600",
            ].join(" ")}
          >
            {label}
          </button>
        ))}
      </nav>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading fan hub…</p>
      ) : error ? (
        <p className="text-sm text-red-400">{error}</p>
      ) : null}

      {tab === "design" && modules ? (
        <section className="space-y-4">
          <p className="text-xs text-zinc-500">
            Choose a fan page template and colors. Fan art slots appear as decorative frames on the published hub.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FAN_PAGE_TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setTemplateId(t.id);
                  setPrimary(t.defaultTheme.primary);
                  setAccent(t.defaultTheme.accent);
                }}
                className={[
                  "rounded-xl border p-3 text-left transition",
                  templateId === t.id
                    ? "border-amber-500/60 bg-amber-950/30"
                    : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-600",
                ].join(" ")}
              >
                <p className="text-sm font-medium text-zinc-100">{t.name}</p>
                <p className="mt-1 text-[11px] text-zinc-500">{t.description}</p>
                <div className="mt-2 flex gap-1">
                  <span
                    className="h-4 w-4 rounded-full border border-zinc-700"
                    style={{ background: t.defaultTheme.primary }}
                  />
                  <span
                    className="h-4 w-4 rounded-full border border-zinc-700"
                    style={{ background: t.defaultTheme.accent }}
                  />
                </div>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="text-xs text-zinc-400">
              Primary
              <input
                type="color"
                value={primary}
                onChange={(e) => setPrimary(e.target.value)}
                className="ml-2 align-middle"
              />
            </label>
            <label className="text-xs text-zinc-400">
              Accent
              <input
                type="color"
                value={accent}
                onChange={(e) => setAccent(e.target.value)}
                className="ml-2 align-middle"
              />
            </label>
            <label className="text-xs text-zinc-400">
              Fan art slots
              <input
                type="number"
                min={0}
                max={12}
                value={fanArtSlots}
                onChange={(e) => setFanArtSlots(Number(e.target.value))}
                className="ml-2 w-14 rounded border border-zinc-800 bg-zinc-950 px-1 py-0.5"
              />
            </label>
          </div>
        </section>
      ) : null}

      {tab === "modules" && modules ? (
        <section className="space-y-3">
          {MODULE_LABELS.map((m) => {
            if (m.key === "progress_bar") {
              const pb = modules.progress_bar;
              return (
                <div
                  key={m.key}
                  className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-zinc-800 p-3"
                >
                  <div>
                    <p className="text-sm font-medium text-zinc-200">{m.label}</p>
                    <p className="text-xs text-zinc-500">{m.hint}</p>
                  </div>
                  <div className="flex flex-col gap-1 text-xs">
                    <label className="flex items-center gap-2 text-zinc-300">
                      <input
                        type="checkbox"
                        checked={pb.enabled}
                        onChange={(e) =>
                          setModules({
                            ...modules,
                            progress_bar: { ...pb, enabled: e.target.checked },
                          })
                        }
                      />
                      Show progress bar
                    </label>
                    <label className="flex items-center gap-2 text-zinc-300">
                      <input
                        type="checkbox"
                        disabled={!pb.enabled}
                        checked={pb.shared}
                        onChange={(e) =>
                          setModules({
                            ...modules,
                            progress_bar: { ...pb, shared: e.target.checked },
                          })
                        }
                      />
                      Share with fans
                    </label>
                  </div>
                </div>
              );
            }
            const key = m.key as keyof Omit<FanModules, "progress_bar" | "fan_art_slots">;
            if (key === "fan_art_slots") return null;
            return (
              <label
                key={m.key}
                className="flex cursor-pointer items-start justify-between gap-2 rounded-lg border border-zinc-800 p-3"
              >
                <div>
                  <p className="text-sm font-medium text-zinc-200">{m.label}</p>
                  <p className="text-xs text-zinc-500">{m.hint}</p>
                </div>
                <input
                  type="checkbox"
                  checked={Boolean(modules[key])}
                  onChange={(e) => setModules({ ...modules, [key]: e.target.checked })}
                  className="mt-1"
                />
              </label>
            );
          })}
          <p className="text-[11px] text-zinc-600">
            Polls, games, RAG personas, and quizzes will publish to the fan hub when those modules ship — toggles
            are saved now so layout is ready.
          </p>
        </section>
      ) : null}

      {tab === "mail" ? (
        <section className="space-y-3">
          <p className="text-xs text-zinc-500">
            One-way fan mail — fans cannot receive author replies in-thread (reduces harassment surface).
          </p>
          {(hub?.fan_mail ?? []).length === 0 ? (
            <p className="text-sm text-zinc-500">No fan mail yet.</p>
          ) : (
            <ul className="space-y-2">
              {hub!.fan_mail.map((m) => (
                <li
                  key={m.id}
                  className={[
                    "rounded-xl border p-4",
                    m.read_at ? "border-zinc-800" : "border-amber-700/40 bg-amber-950/15",
                  ].join(" ")}
                >
                  <div className="flex justify-between gap-2">
                    <p className="text-sm font-medium text-zinc-100">
                      {m.fan_display_name || "Fan"} — {m.subject}
                    </p>
                    {!m.read_at ? (
                      <button
                        type="button"
                        onClick={() => void markMailRead(m.id)}
                        className="text-[10px] text-amber-200 underline"
                      >
                        Mark read
                      </button>
                    ) : null}
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-300">{m.body}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {tab === "preview" ? (
        <section
          className="rounded-xl border border-zinc-700 p-6"
          style={{
            background: tpl.defaultTheme.background,
            borderColor: `${primary}44`,
          }}
        >
          <p className="text-[10px] uppercase tracking-wider" style={{ color: accent }}>
            Fan hub preview · {tpl.name}
          </p>
          <h2 className="mt-2 text-xl font-semibold" style={{ color: primary }}>
            {selection.title?.trim() || "Your world"}
          </h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {Array.from({ length: fanArtSlots }).map((_, i) => (
              <div
                key={i}
                className="flex h-20 items-center justify-center rounded-lg border border-dashed text-[10px] opacity-70"
                style={{ borderColor: accent, color: accent }}
              >
                Fan art {i + 1}
              </div>
            ))}
          </div>
          <ul className="mt-4 flex flex-wrap gap-2 text-[11px]" style={{ color: primary }}>
            {modules?.polls ? <li className="rounded-full border px-2 py-0.5">Polls</li> : null}
            {modules?.games ? <li className="rounded-full border px-2 py-0.5">Games</li> : null}
            {modules?.fan_rag ? <li className="rounded-full border px-2 py-0.5">Fan RAG</li> : null}
            {modules?.quizzes ? <li className="rounded-full border px-2 py-0.5">Quizzes</li> : null}
            {modules?.progress_bar?.enabled && modules.progress_bar.shared ? (
              <li className="rounded-full border px-2 py-0.5">Shared progress</li>
            ) : null}
            {modules?.fan_mail ? <li className="rounded-full border px-2 py-0.5">Fan mail</li> : null}
          </ul>
        </section>
      ) : null}

      {modules ? (
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="rounded-full border border-amber-500/50 bg-amber-600 px-5 py-2 text-xs font-semibold text-amber-950 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save fan hub"}
        </button>
      ) : null}
    </div>
  );
}
