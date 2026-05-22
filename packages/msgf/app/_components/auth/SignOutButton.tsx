"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { createClient } from "@/utils/supabase/client";

type Props = {
  className?: string;
  label?: string;
};

export function SignOutButton({
  className = "rounded-full border border-violet-500/25 bg-violet-500/10 px-4 py-2 text-sm font-medium text-violet-200 transition hover:border-violet-400/40 hover:bg-violet-500/20 disabled:opacity-60",
  label = "Sign out",
}: Props) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  const signOut = useCallback(async () => {
    setSigningOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.refresh();
    } catch {
      window.location.assign("/sign-in");
    } finally {
      setSigningOut(false);
    }
  }, [router]);

  return (
    <button type="button" onClick={() => void signOut()} disabled={signingOut} className={className}>
      {signingOut ? "Signing out…" : label}
    </button>
  );
}
