import React from "react";
import {
  ConsensusView,
  LoginModule,
  PillarBadge,
} from "@elphie-syntax/ui";
import HALTracker from "./components/HALTracker.jsx";

function App() {
  return (
    <div className="dark min-h-screen bg-zinc-950 p-6 text-zinc-100">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="space-y-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            Author Ecosystem
          </h1>
          <p className="text-sm text-zinc-400">
            Shared UI from <code className="text-zinc-300">@elphie-syntax/ui</code>{" "}
            (Tailwind v4 + React 19).
          </p>
          <div className="flex flex-wrap gap-2">
            <PillarBadge lineageLabel="MSGF_V3_STRICT.constraint_ledger.1.0.0" />
            <PillarBadge lineageLabel="MSGF_V3_STRICT.constraint_ledger.1.1.0" />
            <PillarBadge lineageLabel="MSGF_V3_STRICT.constraint_ledger.1.1.1" />
          </div>
        </header>

        <ConsensusView
          heading="Consensus (sample)"
          modelA={{
            name: "Gemini",
            content: '{"verdict":"HUMAN","reason":"Natural rhythm"}',
            footer: "Flash · low temperature",
          }}
          modelB={{
            name: "Claude",
            content: '{"verdict":"HUMAN","reason":"Consistent dwell"}',
            footer: "Sonnet · low temperature",
          }}
        />

        <div className="flex justify-center">
          <LoginModule
            title="Session"
            submitLabel="Sign in"
            onSubmit={(values) => {
              console.log("login", values.email);
            }}
          />
        </div>

        <main>
          <HALTracker />
        </main>
      </div>
    </div>
  );
}

export default App;
