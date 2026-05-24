import { Link } from "react-router-dom";

import { BusinessCreativeToggle } from "../components/BusinessCreativeToggle";
import { useAuthorRole } from "../context/AuthorRoleContext";
import { useAuthorWorkspaceLens } from "../context/AuthorWorkspaceLensContext";
import type { AuthorWorkspaceLens } from "../lib/authorWorkspaceLens";

type ReportCard = {
  id: string;
  title: string;
  desc: string;
  roles: string[];
  lens: AuthorWorkspaceLens | "both";
  href: string;
};

const REPORT_CATALOG: ReportCard[] = [
  {
    id: "hal",
    title: "HAL authorship report",
    desc: "Biometric rhythm summary, ledger packets, and MSGF pulse sync receipts.",
    roles: ["author", "editor", "helper", "publisher"],
    lens: "creative",
    href: "/dashboard",
  },
  {
    id: "bicameral",
    title: "Bicameral revision report",
    desc: "Librarian continuity breaks, outline adherence, and vault seal after cooldown.",
    roles: ["author", "editor", "publisher"],
    lens: "creative",
    href: "/dashboard",
  },
  {
    id: "fan",
    title: "Fan engagement report",
    desc: "Chronicler activity, signal feed, and community correlation (publisher view).",
    roles: ["author", "publisher", "fan"],
    lens: "business",
    href: "/analytics",
  },
  {
    id: "editor",
    title: "Editor / helper deliverables",
    desc: "Helper-proof milestones, guild verification, and human-flow attestation.",
    roles: ["editor", "helper", "author"],
    lens: "creative",
    href: "/dashboard",
  },
  {
    id: "pillar",
    title: "Six-pillar health export",
    desc: "Stoplight grid and logic-drift trajectory for Sentinel attachments.",
    roles: ["author", "editor", "helper", "publisher"],
    lens: "creative",
    href: "/dashboard",
  },
];

export default function ReportsPage() {
  const { user } = useAuthorRole();
  const { lens, meta } = useAuthorWorkspaceLens();
  const persona = user?.persona ?? "author";

  const visible = REPORT_CATALOG.filter(
    (r) => r.roles.includes(persona) && (r.lens === "both" || r.lens === lens)
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p
            className={[
              "text-[10px] font-semibold uppercase tracking-wider",
              lens === "business" ? "text-amber-400/80" : "text-violet-400/80",
            ].join(" ")}
          >
            {meta.label} lens
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Role-aware library for <span className={lens === "business" ? "text-amber-200" : "text-violet-200"}>{persona}</span>
            . Toggle lens to see creative vs business deliverables.
          </p>
        </div>
        <BusinessCreativeToggle />
      </header>

      <ul className="grid gap-3 sm:grid-cols-2">
        {visible.map((r) => (
          <li key={r.id}>
            <Link
              to={r.href}
              className={[
                "block rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 transition",
                lens === "business" ? "hover:border-amber-500/30" : "hover:border-violet-500/30",
              ].join(" ")}

            >
              <h2 className="text-sm font-semibold text-zinc-100">{r.title}</h2>
              <p className="mt-1 text-xs text-zinc-500">{r.desc}</p>
            </Link>
          </li>
        ))}
      </ul>

      {visible.length === 0 ? (
        <p className="text-sm text-zinc-500">No reports for this role yet — switch role in the nav or activate one in Settings.</p>
      ) : null}
    </div>
  );
}
