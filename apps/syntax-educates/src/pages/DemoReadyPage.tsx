/**
 * QA launcher — bootstrap demo + open sandbox / mock Classroom launch.
 */
import { useState } from "react";

import { PillarBadge } from "@elphie-syntax/ui";

import { msgfBaseUrl, msgfFetch } from "../lib/msgfClient";

type DemoResult = {
  assignmentId: string;
  assignmentInstanceId: string;
  entityToken: string;
  resourceContextId: string;
  sandboxPath: string;
  disclosureAccepted: boolean;
  vaultStrengthSeeded?: boolean;
  oauthConfigured?: boolean;
};

export function DemoReadyPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demo, setDemo] = useState<DemoResult | null>(null);
  const [mockUrl, setMockUrl] = useState<string | null>(null);
  const [assignLink, setAssignLink] = useState<string | null>(null);

  async function bootstrap(acceptDisclosure: boolean) {
    setBusy(true);
    setError(null);
    setMockUrl(null);
    try {
      const json = await msgfFetch<{
        demo: DemoResult;
      }>("/api/msgf/education/demo/bootstrap", {
        method: "POST",
        persona: "admin",
        body: JSON.stringify({ acceptDisclosure }),
      });
      setDemo(json.demo);
      window.localStorage.setItem("edu_entity_token", json.demo.entityToken);

      const link = await msgfFetch<{
        oauthStartUrl: string;
        mockLaunch: { url: string; body: Record<string, unknown> };
      }>(
        `/api/msgf/education/teacher/classroom-assign-link?assignmentId=${encodeURIComponent(
          json.demo.assignmentId
        )}&resourceContextId=${encodeURIComponent(json.demo.resourceContextId)}`
      );
      setAssignLink(link.oauthStartUrl);

      const mock = await msgfFetch<{ sandboxUrl?: string }>(
        "/api/education/classroom/mock-launch",
        {
          method: "POST",
          persona: "teacher",
          body: JSON.stringify(link.mockLaunch.body),
        }
      );
      if (mock.sandboxUrl) setMockUrl(mock.sandboxUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-6 py-6">
      <header className="mb-6 flex items-center gap-3">
        <PillarBadge lineageLabel="QA" pillar="P1" />
        <h1 className="text-xl font-semibold">Test-ready demo launcher</h1>
      </header>
      <p className="mb-4 max-w-2xl text-sm text-zinc-400">
        One click seeds catalog + lesson + student instance. Requires{" "}
        <code className="text-zinc-300">EDUCATION_DEMO_BOOTSTRAP=1</code> (and migrations)
        on MSGF at <code className="text-zinc-300">{msgfBaseUrl()}</code>.
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void bootstrap(true)}
          className="rounded border border-emerald-600 bg-emerald-600/20 px-4 py-2 text-sm text-emerald-200 disabled:opacity-40"
        >
          {busy ? "Bootstrapping…" : "Bootstrap demo (disclosure pre-accepted)"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void bootstrap(false)}
          className="rounded border border-amber-700 bg-amber-700/20 px-4 py-2 text-sm text-amber-200 disabled:opacity-40"
        >
          Bootstrap + force disclosure UX
        </button>
      </div>

      {error && (
        <p className="mb-3 text-sm text-rose-400">
          {error}
          {/disabled/i.test(error)
            ? " — set EDUCATION_DEMO_BOOTSTRAP=1 and EDUCATION_OPEN_LESSON_API=1 on MSGF."
            : ""}
        </p>
      )}

      {demo && (
        <div className="max-w-2xl space-y-3 rounded border border-zinc-800 bg-zinc-900/50 p-4 text-sm">
          <p className="text-emerald-300">Demo ready</p>
          <p className="font-mono text-xs text-zinc-400">assignment {demo.assignmentId}</p>
          <p className="font-mono text-xs text-zinc-500">
            instance {demo.assignmentInstanceId}
          </p>
          <p className="font-mono text-xs text-zinc-500">entity {demo.entityToken}</p>
          <p className="text-xs text-zinc-500">
            Disclosure: {demo.disclosureAccepted ? "pre-accepted" : "must accept in sandbox"}
          </p>
          <p className="text-xs text-zinc-500">
            Vault strength seed:{" "}
            {demo.vaultStrengthSeeded ? "yes (Socratic can bridge)" : "no / skipped"}
          </p>
          <p className="text-xs text-zinc-500">
            Classroom OAuth:{" "}
            {demo.oauthConfigured
              ? "configured — use Real Classroom OAuth start"
              : "not configured — set GOOGLE_CLASSROOM_* (mock launch still works)"}
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <a
              className="text-sky-300 underline"
              href={demo.sandboxPath}
              onClick={(e) => {
                e.preventDefault();
                window.history.pushState({}, "", demo.sandboxPath);
                window.dispatchEvent(new PopStateEvent("popstate"));
              }}
            >
              Open sandbox
            </a>
            <a className="text-sky-300 underline" href="/teacher">
              Teacher board
            </a>
            <a className="text-sky-300 underline" href="/lessons">
              Lesson builder
            </a>
            {assignLink && (
              <a className="text-sky-300 underline" href={assignLink}>
                Real Classroom OAuth start
              </a>
            )}
            {mockUrl && (
              <a className="text-sky-300 underline" href={mockUrl}>
                Mock Classroom sandbox URL
              </a>
            )}
          </div>
          <ol className="list-decimal space-y-1 pl-5 text-zinc-400">
            <li>Sandbox: accept disclosure (if forced) → write CER draft</li>
            <li>Ask tutor about evidence while stuck — should cite weather-sorting strength</li>
            <li>Docs add-on: Sync HAL Lite → Check milestones → Turn in (certificate stub)</li>
            <li>Teacher board: paste spikes / milestone stuck flags / certificate link</li>
            <li>Parent digest: entity token lookup</li>
          </ol>
        </div>
      )}
    </div>
  );
}
