import { Link } from "react-router-dom";

import { useAuthorWorkspaceLens } from "../context/AuthorWorkspaceLensContext";

export function CreativePageHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  const { meta } = useAuthorWorkspaceLens();

  return (
    <header>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-400/90">{meta.label} lens</p>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-zinc-400">
        {description}{" "}
        <Link to="/manuscripts" className="text-violet-300 underline underline-offset-2 hover:text-violet-100">
          Manuscripts
        </Link>
      </p>
    </header>
  );
}
