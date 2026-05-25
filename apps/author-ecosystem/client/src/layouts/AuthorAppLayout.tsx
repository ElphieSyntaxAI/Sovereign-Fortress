import { Outlet } from "react-router-dom";

import { AuthorSentinelBugButton } from "../components/AuthorSentinelBugButton";
import { AuthorAdminNav, AuthorAdminNavMobile } from "../components/admin/AuthorAdminNav";
import { AuthorTopNav } from "../components/AuthorTopNav";
import { AuthorRoleProvider } from "../context/AuthorRoleContext";
import { AuthorWorkspaceLensProvider, useAuthorWorkspaceLens } from "../context/AuthorWorkspaceLensContext";
import { NarrativeProvider } from "../context/NarrativeContext";
import { OnboardingGate } from "../components/onboarding/OnboardingGate";

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
      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6">
        <AuthorAdminNav />
        <div className="min-w-0 flex-1">
          <AuthorAdminNavMobile />
          <main className="py-2">
            <Outlet />
          </main>
        </div>
      </div>
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
          <OnboardingGate>
            <AuthorAppShell />
          </OnboardingGate>
        </NarrativeProvider>
      </AuthorWorkspaceLensProvider>
    </AuthorRoleProvider>
  );
}
