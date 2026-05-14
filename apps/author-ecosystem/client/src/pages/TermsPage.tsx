import { Link, useParams } from "react-router-dom";

import { TermsMarkdown } from "../legal/TermsMarkdown";
import { getTermsDocument, TERMS_DOCUMENTS, TERMS_LAST_UPDATED_ISO } from "../legal/termsRegistry";

export default function TermsPage() {
  const { slug } = useParams<{ slug?: string }>();
  const doc = getTermsDocument(slug);

  return (
    <div className="dark min-h-screen bg-zinc-950 p-6 text-zinc-100">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-zinc-800 pb-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Author Ecosystem</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Terms &amp; Conditions</h1>
            <p className="mt-2 text-sm text-zinc-400">
              Last updated: <time dateTime={TERMS_LAST_UPDATED_ISO}>{TERMS_LAST_UPDATED_ISO}</time>
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <Link to="/" className="text-zinc-400 underline underline-offset-2 hover:text-white">
              Home
            </Link>
            <span className="text-zinc-600" aria-hidden>
              ·
            </span>
            <Link to="/dashboard" className="text-zinc-400 underline underline-offset-2 hover:text-white">
              Dashboard
            </Link>
            <span className="text-zinc-600" aria-hidden>
              ·
            </span>
            <Link to="/nda" className="text-zinc-400 underline underline-offset-2 hover:text-white">
              NDAs
            </Link>
            <span className="text-zinc-600" aria-hidden>
              ·
            </span>
            <Link to="/vault-pact" className="text-zinc-400 underline underline-offset-2 hover:text-white">
              Vault Pact
            </Link>
          </div>
        </header>

        <nav className="mb-8 flex flex-wrap gap-2" aria-label="Terms documents">
          {TERMS_DOCUMENTS.map((d) => (
            <Link
              key={d.id}
              to={`/terms/${d.slug}`}
              className={
                doc?.id === d.id
                  ? "rounded-full border border-violet-500/70 bg-violet-950/50 px-3 py-1.5 text-xs font-medium text-violet-100"
                  : "rounded-full border border-zinc-700 bg-zinc-900/60 px-3 py-1.5 text-xs font-medium text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
              }
            >
              {d.navLabel}
            </Link>
          ))}
        </nav>

        {doc ? (
          <article className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-6">
            <h2 className="sr-only">{doc.title}</h2>
            <TermsMarkdown markdown={doc.markdown} />
          </article>
        ) : (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-6 text-sm text-zinc-400">
            <p className="text-zinc-300">Choose a document above, or open one below.</p>
            <ul className="mt-3 list-disc pl-5">
              {TERMS_DOCUMENTS.map((d) => (
                <li key={d.id}>
                  <Link to={`/terms/${d.slug}`} className="text-violet-300 underline underline-offset-2 hover:text-violet-200">
                    {d.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        <footer className="mt-10 border-t border-zinc-800 pt-6 text-xs text-zinc-500">
          <p>
            Same documents are served at <code className="text-zinc-400">GET /api/legal/terms</code> (JSON bundle) and{" "}
            <code className="text-zinc-400">GET /api/legal/terms/:slug</code> (markdown) for other clients.{" "}
            <Link to="/nda" className="text-zinc-400 underline hover:text-zinc-200">
              Non-Disclosure Agreements
            </Link>
            {" · "}
            <Link to="/vault-pact" className="text-zinc-400 underline hover:text-zinc-200">
              Vault Pact
            </Link>
            . Not legal advice.
          </p>
        </footer>
      </div>
    </div>
  );
}
