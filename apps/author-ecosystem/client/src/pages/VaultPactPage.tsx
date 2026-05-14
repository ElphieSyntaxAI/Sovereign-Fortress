import { Link } from "react-router-dom";

import { TermsMarkdown } from "../legal/TermsMarkdown";
import { VAULT_PACT_LAST_UPDATED_ISO, VAULT_PACT_MARKDOWN } from "../legal/vaultPactRegistry";

export default function VaultPactPage() {
  return (
    <div className="dark min-h-screen bg-zinc-950 p-6 text-zinc-100">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-zinc-800 pb-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Author Ecosystem</p>
            <p className="mt-2 text-sm text-zinc-400">
              <span className="font-medium text-emerald-400/90">Vault Seal</span> — ElphieSyntax ↔ Author · Last updated{" "}
              <time dateTime={VAULT_PACT_LAST_UPDATED_ISO}>{VAULT_PACT_LAST_UPDATED_ISO}</time>
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <Link to="/" className="text-zinc-400 underline underline-offset-2 hover:text-white">
              Home
            </Link>
            <span className="text-zinc-600" aria-hidden>
              ·
            </span>
            <Link to="/terms" className="text-zinc-400 underline underline-offset-2 hover:text-white">
              Terms
            </Link>
            <span className="text-zinc-600" aria-hidden>
              ·
            </span>
            <Link to="/nda" className="text-zinc-400 underline underline-offset-2 hover:text-white">
              NDAs
            </Link>
          </div>
        </header>

        <article className="rounded-xl border border-emerald-900/40 bg-emerald-950/10 p-6">
          <TermsMarkdown markdown={VAULT_PACT_MARKDOWN} />
        </article>

        <footer className="mt-10 border-t border-zinc-800 pt-6 text-xs text-zinc-500">
          <p>
            API: <code className="text-zinc-400">GET /api/legal/vault-pact</code> (JSON). Registration requires typing the
            attestation phrase exactly as published. Not legal advice.
          </p>
        </footer>
      </div>
    </div>
  );
}
