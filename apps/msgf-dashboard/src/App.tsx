import { MultiTenantStatusBar } from "./components/MultiTenantStatusBar";
import { AlertsCenter } from "./components/AlertsCenter";
import { BrainPushQueue } from "./components/BrainPushQueue";
import { MOCK_LOGIC_ALERTS } from "./data/mockAlerts";

export default function App() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <MultiTenantStatusBar />

      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">MSGF master admin</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Cross-tenant health, Jira bridge–filtered alerts, and core “brain” approvals.
          </p>
        </div>

        <AlertsCenter alerts={MOCK_LOGIC_ALERTS} />
        <BrainPushQueue />
      </main>
    </div>
  );
}
