"use client";

import { useEffect, useState } from "react";

import { TokenSavingsFeaturesPanel } from "@/app/_components/dashboard/TokenSavingsFeaturesPanel";

export function TokenSavingsRouteSection({
  tenantId,
  operatorView = false,
}: {
  tenantId: string;
  operatorView?: boolean;
}) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const sync = () => {
      setActive(window.location.hash === "#token-savings");
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  if (!active) return null;

  return (
    <div className="scroll-mt-24">
      <TokenSavingsFeaturesPanel tenantId={tenantId} operatorView={operatorView} />
    </div>
  );
}
