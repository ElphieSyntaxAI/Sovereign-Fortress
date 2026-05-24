import { Link } from "react-router-dom";

export function ManuscriptRequiredBanner() {
  return (
    <p className="rounded-lg border border-amber-900/40 bg-amber-950/25 px-4 py-3 text-sm text-amber-100/90">
      Select a manuscript on{" "}
      <Link to="/manuscripts" className="font-medium text-amber-200 underline underline-offset-2">
        Manuscripts
      </Link>{" "}
      to use this view.
    </p>
  );
}
