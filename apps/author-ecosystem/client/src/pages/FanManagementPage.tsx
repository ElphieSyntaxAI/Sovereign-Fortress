import { FanManagementHub } from "../components/FanManagementHub";

export default function FanManagementPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-amber-50">Fan management</h1>
        <p className="mt-1 text-sm text-amber-100/60">
          Design the fan-facing hub: templates, colors, fan art slots, engagement modules, one-way fan mail, and
          preview what fans will see.
        </p>
      </header>
      <FanManagementHub />
    </div>
  );
}
