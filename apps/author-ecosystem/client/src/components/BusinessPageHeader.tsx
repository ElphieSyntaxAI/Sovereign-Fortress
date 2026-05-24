import { Link } from "react-router-dom";

import { BusinessCreativeToggle } from "./BusinessCreativeToggle";
import { useAuthorWorkspaceLens } from "../context/AuthorWorkspaceLensContext";

export function BusinessPageHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  const { meta } = useAuthorWorkspaceLens();

  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-400/90">{meta.label} lens</p>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-400">
          {description}{" "}
          <Link to="/manuscripts" className="text-amber-300 underline underline-offset-2 hover:text-amber-100">
            Manuscripts
          </Link>
        </p>
      </div>
      <BusinessCreativeToggle />
    </header>
  );
}
