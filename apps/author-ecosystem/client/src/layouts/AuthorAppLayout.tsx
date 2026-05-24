import { Outlet } from "react-router-dom";

import { AuthorSentinelBugButton } from "../components/AuthorSentinelBugButton";
import { AuthorTopNav } from "../components/AuthorTopNav";
import { AuthorRoleProvider } from "../context/AuthorRoleContext";
import { AuthorWorkspaceLensProvider, useAuthorWorkspaceLens } from "../context/AuthorWorkspaceLensContext";
import { NarrativeProvider } from "../context/NarrativeContext";

function AuthorAppShell() {
  const { lens } = useAuthorWorkspaceLens();

  return (
    <div
      data-author-lens={lens}
      className={[
        "dark min-h-screen text-zinc-100",
        "lens-creative:bg-zinc-950 lens-business:bg-[#0c0a08]",
        "lens-creative:[--author-accent:theme(colors.violet.500)]",
        "lens-business:[--author-accent:theme(colors.amber.500)]",
      ].join(" ")}
    >
      <AuthorTopNav />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
      {lens === "creative" ? <AuthorSentinelBugButton /> : null}
    </div>
  );
}

/**
 * Authenticated Author shell — role + Creative/Business lens + horizontal nav.
 */
export default function AuthorAppLayout() {
  return (
    <AuthorRoleProvider>
      <AuthorWorkspaceLensProvider>
        <NarrativeProvider>
          <AuthorAppShell />
        </NarrativeProvider>
      </AuthorWorkspaceLensProvider>
    </AuthorRoleProvider>
  );
}
