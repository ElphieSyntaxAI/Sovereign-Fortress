import { Link } from "react-router-dom";

import { AUTHOR_ROADMAP_AS_OF, authorRoadmapHeroBlurb } from "@elphie-syntax/core";
import { AuthorRoadmapDeepDive } from "@elphie-syntax/ui/author-roadmap";
import { PlatformRoadmapExplorer } from "@elphie-syntax/ui/platform-roadmap";

const GATED_AI_HOST =
  import.meta.env.VITE_MSGF_APP_URL || "https://elphiesgatedai.elphiesyntax.com";

const HUB_MESH = {
  backgroundColor: "#0a0612",
  backgroundImage: [
    "radial-gradient(ellipse 80% 50% at 18% -10%, rgba(16, 185, 129, 0.12), transparent 55%)",
    "radial-gradient(ellipse 70% 45% at 85% 12%, rgba(168, 85, 247, 0.32), transparent 50%)",
    "radial-gradient(ellipse 60% 40% at 50% 100%, rgba(245, 158, 11, 0.1), transparent 50%)",
  ].join(", "),
};

export default function AuthorRoadmapPage() {
  return (
    <div className="min-h-screen text-slate-100" style={HUB_MESH}>
      <header className="border-b border-violet-500/10 bg-slate-950/40 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <Link to="/sign-in" className="text-sm font-semibold text-violet-200 hover:text-violet-100">
            ← Author sign in
          </Link>
          <nav className="flex items-center gap-2 text-xs">
            <Link
              to="/beta"
              className="rounded-full border border-violet-500/40 bg-violet-500/20 px-4 py-2 font-semibold text-violet-50 hover:bg-violet-500/30"
            >
              Join foundational testing
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-14 px-5 py-12 sm:py-16">
        <section className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-violet-300/90">
            Author Ecosystem · Foundational testing
          </p>
          <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">
            <span
              className="bg-gradient-to-r bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  "linear-gradient(135deg, #c4b5fd 0%, #e879f9 45%, #a855f7 100%)",
              }}
            >
              The Creative Integrity Flywheel
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">
            {authorRoadmapHeroBlurb()}
          </p>
          <p className="mt-3 text-[11px] text-slate-600">Roadmap snapshot · {AUTHOR_ROADMAP_AS_OF}</p>
        </section>

        <PlatformRoadmapExplorer
          variant="embedded"
          initialProductId="author"
          productPageBaseUrl={GATED_AI_HOST}
        />

        <AuthorRoadmapDeepDive />

        <section
          className="rounded-2xl border border-slate-700/50 p-5 text-sm text-slate-300"
          style={{
            background: "rgba(15, 23, 42, 0.45)",
            backdropFilter: "blur(16px)",
          }}
        >
          <h2 className="text-base font-semibold text-slate-100">Ready to test?</h2>
          <p className="mt-2 text-xs text-slate-400">
            Foundational testing runs on production authorecosystem — staging is for operators only.
            MSGF token savings and governance bridge use tenant{" "}
            <code className="text-violet-300">author_ecosystem</code> on elphiesgatedai.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              to="/beta"
              className="rounded-full border border-violet-500/40 bg-violet-500/20 px-5 py-2 text-sm font-semibold text-violet-50 hover:bg-violet-500/30"
            >
              Join waitlist
            </Link>
            <a
              href={`${GATED_AI_HOST}/roadmap`}
              target="_blank"
              rel="noreferrer noopener"
              className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-5 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/20"
            >
              MSGF platform roadmap ↗
            </a>
          </div>
        </section>
      </main>

      <footer className="border-t border-violet-500/10 py-8 text-center text-xs text-slate-500">
        <p>© {new Date().getFullYear()} Elphie Syntax LLC · SSOT docs/author-ecosystem/AUTHOR_ECOSYSTEM_ROADMAP.md</p>
      </footer>
    </div>
  );
}
