import { LoginModule, PillarBadge } from "@elphie-syntax/ui";

export default function App() {
  return (
    <div className="dark min-h-screen bg-zinc-950 p-8 text-zinc-100">
      <h1 className="mb-6 text-xl font-semibold">Syntax Educates</h1>
      <PillarBadge lineageLabel="P4" pillar="P4" />
      <div className="mt-8 flex justify-center">
        <LoginModule
          title="Educator login"
          onSubmit={(v) => console.log("login", v.email)}
        />
      </div>
    </div>
  );
}
