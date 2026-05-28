import { BugReporter } from "@elphie-syntax/ui";

const DEFAULT_REPORT_URL = "http://localhost:3000/api/msgf/report-issue";

export default function App() {
  const reportUrl =
    import.meta.env.VITE_MSGF_REPORT_ISSUE_URL?.trim() ||
    import.meta.env.VITE_MSGF_INCIDENT_REPORT_URL?.trim() ||
    DEFAULT_REPORT_URL;

  return (
    <div className="min-h-screen bg-zinc-950 p-8 text-zinc-100">
      <header className="mx-auto max-w-2xl space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Client Vortex</h1>
        <p className="text-sm text-zinc-400">
          Health API runs on the server workspace; this shell hosts the MSGF bug
          reporter. Set{" "}
          <code className="rounded bg-zinc-900 px-1 text-zinc-300">
            VITE_MSGF_REPORT_ISSUE_URL
          </code>{" "}
          if your Next app is not on port 3000.
        </p>
      </header>

      <BugReporter reportEndpointUrl={reportUrl} />
    </div>
  );
}
