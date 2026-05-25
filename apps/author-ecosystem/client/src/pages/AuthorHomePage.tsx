import { Link } from "react-router-dom";

import { BusinessCreativeToggle } from "../components/BusinessCreativeToggle";
import { useAuthorRole } from "../context/AuthorRoleContext";
import { useAuthorWorkspaceLens } from "../context/AuthorWorkspaceLensContext";
import { CREATIVE_NAV, BUSINESS_NAV } from "../lib/authorNavConfig";
import { MsgfConnectionStatus } from "../components/MsgfConnectionStatus";

export default function AuthorHomePage() {
  const { user, loading } = useAuthorRole();
  const { lens, meta, setLens } = useAuthorWorkspaceLens();
  const persona = user?.persona ?? "author";

  const links = lens === "business" ? BUSINESS_NAV : CREATIVE_NAV;
  const otherLens = lens === "business" ? "creative" : "business";

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p
            className={[
              "text-[10px] font-semibold uppercase tracking-[0.2em]",
              lens === "business" ? "text-amber-400/90" : "text-violet-400/90",
            ].join(" ")}
          >
            {meta.label} lens
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-50">
            {loading ? "Welcome back" : `Welcome, ${persona}`}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400">{meta.description}</p>
        </div>
        <BusinessCreativeToggle />
      </section>

      <p className="text-xs text-zinc-500">
        Platform admin, role dashboards, and global settings live in the{" "}
        <Link to="/admin" className="text-violet-300 underline">
          Admin nav
        </Link>{" "}
        (left rail).
      </p>
      <MsgfConnectionStatus />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {links.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={[
              "rounded-xl border bg-zinc-950/60 p-4 transition",
              lens === "business"
                ? "border-zinc-800 hover:border-amber-500/35 hover:bg-amber-950/15"
                : "border-zinc-800 hover:border-violet-500/35 hover:bg-violet-950/20",
            ].join(" ")}
          >
            <h2
              className={
                lens === "business" ? "text-sm font-semibold text-amber-100" : "text-sm font-semibold text-violet-100"
              }
            >
              {item.label}
            </h2>
          </Link>
        ))}
      </section>

      <button
        type="button"
        onClick={() => setLens(otherLens)}
        className={[
          "w-full rounded-xl border border-dashed p-4 text-left text-sm transition",
          lens === "business"
            ? "border-violet-700/40 text-violet-200/80 hover:bg-violet-950/20"
            : "border-amber-700/40 text-amber-200/80 hover:bg-amber-950/20",
        ].join(" ")}
      >
        Switch to {otherLens === "business" ? "Business" : "Creative"} lens →
      </button>
    </div>
  );
}
