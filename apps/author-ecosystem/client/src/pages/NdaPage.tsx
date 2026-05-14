import { Link, useParams } from "react-router-dom";

import { TermsMarkdown } from "../legal/TermsMarkdown";
import { getNdaDocument, NDA_DOCUMENTS, NDA_LAST_UPDATED_ISO } from "../legal/ndaRegistry";

export default function NdaPage() {
  const { slug } = useParams<{ slug?: string }>();
  const doc = getNdaDocument(slug);

  return (
    <div className="dark min-h-screen bg-zinc-950 p-6 text-zinc-100">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-zinc-800 pb-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Author Ecosystem</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Non-Disclosure Agreements</h1>
            <p className="mt-2 text-sm text-zinc-400">
              Last updated: <time dateTime={NDA_LAST_UPDATED_ISO}>{NDA_LAST_UPDATED_ISO}</time>
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
            <Link to="/vault-pact" className="text-zinc-400 underline underline-offset-2 hover:text-white">
              Vault Pact
            </Link>
            <span className="text-zinc-600" aria-hidden>
              ·
            </span>
            <Link to="/dashboard" className="text-zinc-400 underline underline-offset-2 hover:text-white">
              Dashboard
            </Link>
          </div>
        </header>

        <nav className="mb-8 flex flex-wrap gap-2" aria-label="NDA documents">
          {NDA_DOCUMENTS.map((d) => (
            <Link
              key={d.id}
              to={`/nda/${d.slug}`}
              className={
                doc?.id === d.id
                  ? "rounded-full border border-sky-500/70 bg-sky-950/50 px-3 py-1.5 text-xs font-medium text-sky-100"
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
              {NDA_DOCUMENTS.map((d) => (
                <li key={d.id}>
                  <Link to={`/nda/${d.slug}`} className="text-sky-300 underline underline-offset-2 hover:text-sky-200">
                    {d.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        <footer className="mt-10 border-t border-zinc-800 pt-6 text-xs text-zinc-500">
          <p>
            Same documents are served at <code className="text-zinc-400">GET /api/legal/nda</code> (JSON bundle) and{" "}
            <code className="text-zinc-400">GET /api/legal/nda/:slug</code> (markdown). See also{" "}
            <Link to="/terms" className="text-zinc-400 underline hover:text-zinc-200">
              Terms &amp; Conditions
            </Link>
            . Not legal advice.
          </p>
        </footer>
      </div>
    </div>
  );
}
