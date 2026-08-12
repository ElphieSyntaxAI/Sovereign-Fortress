import { useState } from "react";
import { Link } from "react-router-dom";

import { bffFetch, formatBffFetchError } from "../lib/bffFetch";

export default function AuthorBetaPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(/** @type {string | null} */ (null));
  const [success, setSuccess] = useState(/** @type {string | null} */ (null));

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await bffFetch("/api/beta-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product: "author",
          email: email.trim(),
          name: name.trim() || null,
          note: note.trim() || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        throw new Error(json.error || res.statusText);
      }
      setSuccess(json.message || "You're on the list.");
    } catch (err) {
      setError(formatBffFetchError(err, "/api/beta-signup"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen text-slate-100" style={{ background: "#0a0612" }}>
      <header className="border-b border-violet-500/10 px-5 py-4">
        <Link to="/" className="text-sm font-semibold text-violet-200 hover:text-violet-100">
          ← Elphie Syntax picker
        </Link>
      </header>
      <main className="mx-auto max-w-lg px-5 py-12">
        <div
          className="rounded-2xl border border-violet-500/25 p-6 sm:p-8"
          style={{
            background: "rgba(15, 23, 42, 0.45)",
            backdropFilter: "blur(16px)",
          }}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-300/90">
            Foundational testing
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">Join Author Ecosystem testing</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            Author is live on authorecosystem for foundational testers. Registration is
            invite-only — join the list and we&apos;ll email you when a seat opens.{" "}
            <Link to="/roadmap" className="font-medium text-violet-300 hover:underline">
              Explore the full roadmap →
            </Link>
          </p>

          <form onSubmit={(e) => void onSubmit(e)} className="mt-6 space-y-4">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-400">Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-700/80 bg-slate-950/60 px-4 py-2.5 text-sm text-slate-100"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-400">Name (optional)</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-slate-700/80 bg-slate-950/60 px-4 py-2.5 text-sm text-slate-100"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-400">Project note (optional)</span>
              <textarea
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full rounded-xl border border-slate-700/80 bg-slate-950/60 px-4 py-2.5 text-sm text-slate-100"
              />
            </label>
            {error ? (
              <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {error}
              </p>
            ) : null}
            {success ? (
              <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
                {success}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={loading || Boolean(success)}
              className="w-full rounded-full border border-violet-500/40 bg-violet-500/20 px-6 py-3 text-sm font-semibold text-violet-50 hover:bg-violet-500/30 disabled:opacity-60"
            >
              {loading ? "Submitting…" : "Join foundational testing list"}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-slate-500">
            Already invited?{" "}
            <Link to="/sign-in" className="text-violet-300 hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
