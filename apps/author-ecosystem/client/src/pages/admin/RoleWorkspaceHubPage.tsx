import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import {
  AUTHOR_ROLE_OPTIONS,
  type AuthorRoleId,
  useAuthorRole,
} from "../../context/AuthorRoleContext";
import { useAuthorWorkspaceLens } from "../../context/AuthorWorkspaceLensContext";
import { ROLE_WORKSPACE_HOME } from "../../lib/authorAdminNavConfig";
import { isAuthorFanHubEnabled, isAuthorHelperEnabled } from "../../lib/postMvpGates";
import { PostMvpPlaceholder } from "../PostMvpPlaceholder";

const VALID_ROLES = new Set<string>(AUTHOR_ROLE_OPTIONS.map((r) => r.id));

export default function RoleWorkspaceHubPage() {
  const { roleId } = useParams<{ roleId: string }>();
  const navigate = useNavigate();
  const { user, switchPersona } = useAuthorRole();
  const { setLens } = useAuthorWorkspaceLens();
  const [message, setMessage] = useState<string | null>(null);

  const role = (roleId?.toLowerCase() ?? "") as AuthorRoleId;
  const helperGated = role === "helper" && !isAuthorHelperEnabled();
  const fanGated = role === "fan" && !isAuthorFanHubEnabled();
  const home = VALID_ROLES.has(role) ? ROLE_WORKSPACE_HOME[role] : null;
  const label = AUTHOR_ROLE_OPTIONS.find((r) => r.id === role)?.label ?? role;

  useEffect(() => {
    if (helperGated || fanGated || !home) return;

    void (async () => {
      if (role === "fan") {
        setMessage(
          "Fan & Chronicler workspace opens from Fan management. Activate the role in Global settings when community terms ship."
        );
        setLens(home.lens);
        navigate(home.path, { replace: true });
        return;
      }

      const activated = user?.activated_personas?.includes(role) ?? user?.persona === role;
      if (!activated) {
        setMessage(`Activate the ${label} role in Global settings before opening this dashboard.`);
        return;
      }

      if (user?.persona !== role) {
        const result = await switchPersona(role);
        if (!result.ok) {
          setMessage(result.message ?? "Could not switch role.");
          return;
        }
      }

      setLens(home.lens);
      navigate(home.path, { replace: true });
    })();
  }, [
    helperGated,
    fanGated,
    home,
    role,
    user?.persona,
    user?.activated_personas,
    switchPersona,
    setLens,
    navigate,
    label,
  ]);

  if (helperGated) {
    return (
      <PostMvpPlaceholder
        title="Helper guild"
        body="Helper seats and the Creative Guild are deferred until after the Author three-seat launch."
      />
    );
  }
  if (fanGated) {
    return (
      <PostMvpPlaceholder
        title="Fan hub"
        body="Fan management is deferred until after the Author three-seat launch."
      />
    );
  }

  if (!home) {
    return (
      <p className="text-sm text-red-300">
        Unknown role.{" "}
        <Link to="/admin" className="underline">
          Back to admin
        </Link>
      </p>
    );
  }

  return (
    <div className="space-y-4 py-12 text-center">
      <p className="text-sm text-zinc-400">Opening {label} dashboard…</p>
      {message ? (
        <p className="mx-auto max-w-md text-sm text-amber-200/90">
          {message}{" "}
          <Link to="/admin/settings" className="underline">
            Global settings
          </Link>
        </p>
      ) : null}
      <Link to={home.path} className="text-xs text-violet-300 underline">
        Continue to {home.label}
      </Link>
    </div>
  );
}
