import { useCallback, useMemo, useState } from "react";

import {
  devAdminCredentials,
  isDevAdminLoginEnabled,
  persistDevAdminSession,
  validateDevAdminLogin,
} from "../lib/dev-admin-auth";

type Props = {
  onAuthenticated: () => void;
};

export function DevAdminLogin({ onAuthenticated }: Props) {
  const defaults = useMemo(() => devAdminCredentials(), []);
  const [email, setEmail] = useState(defaults.email);
  const [password, setPassword] = useState(defaults.password);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(() => {
    if (!validateDevAdminLogin(email, password)) {
      setError("Invalid dev credentials. Check VITE_DEV_ADMIN_EMAIL / VITE_DEV_ADMIN_PASSWORD.");
      return;
    }
    setError(null);
    persistDevAdminSession();
    onAuthenticated();
  }, [email, password, onAuthenticated]);

  const fillDevAdmin = useCallback(() => {
    setEmail(defaults.email);
    setPassword(defaults.password);
    setError(null);
  }, [defaults.email, defaults.password]);

  if (!isDevAdminLoginEnabled()) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-6">
        <h1 className="text-xl font-semibold text-zinc-50">MSGF dashboard</h1>
        <p className="text-sm text-amber-300/90">
          Dev admin login is not configured. Set{" "}
          <code className="text-amber-200">VITE_DEV_ADMIN_EMAIL</code> and{" "}
          <code className="text-amber-200">VITE_DEV_ADMIN_PASSWORD</code> in{" "}
          <code className="text-amber-200">.env.development</code>.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6">
      <div className="space-y-1 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-violet-400/90">Local development</p>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-50">MSGF operator sign-in</h1>
        <p className="text-sm text-zinc-500">
          Grants a seeded <span className="text-zinc-300">GLOBAL_ADMIN</span> dashboard session (tenant health view).
        </p>
      </div>
      <form
        className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label className="block space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Email</span>
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-violet-500/40 focus:border-violet-500 focus:ring-2"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Password</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-violet-500/40 focus:border-violet-500 focus:ring-2"
          />
        </label>
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={fillDevAdmin}
            className="rounded-lg border border-zinc-600 px-3 py-2 text-sm font-medium text-zinc-200 hover:border-zinc-500 hover:bg-zinc-800/80"
          >
            Fill dev admin
          </button>
          <button
            type="submit"
            className="flex-1 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-500"
          >
            Continue to dashboard
          </button>
        </div>
      </form>
      <p className="text-center text-xs text-zinc-600">
        Development only. Production builds ignore this gate.
      </p>
    </main>
  );
}
