import Link from "next/link";

import { ResetPasswordClient } from "@/app/_components/auth/ResetPasswordClient";
import { AuthLandingNav } from "@/app/_components/landing/AuthLandingNav";

export default function ResetPasswordPage() {
  return (
    <div className="landing-mesh min-h-screen text-slate-100">
      <AuthLandingNav />
      <main className="mx-auto flex max-w-md flex-col gap-6 px-5 py-12 sm:py-16">
        <ResetPasswordClient />
      </main>
    </div>
  );
}
