import { Link } from "react-router-dom";

/** In-app link to `/admin/sign-in` (forwards to MSGF operator auth). */
export function OperatorAdminLink({ className = "" }) {
  return (
    <Link
      to="/admin/sign-in"
      className={
        className ||
        "text-xs text-violet-300/90 underline-offset-2 hover:text-violet-200 hover:underline"
      }
    >
      Platform operator sign-in
    </Link>
  );
}
