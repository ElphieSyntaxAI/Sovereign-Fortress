"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  PERSONAS_BY_PLATFORM,
  PLATFORM_COMING_SOON,
  type PlatformId,
} from "msgf/lib/platform-persona-auth";

import { cn } from "../lib/cn";

const loginSchema = z.object({
  email: z.string().min(1, "Required").email("Enter a valid email"),
  password: z.string().min(8, "At least 8 characters"),
});

export type PlatformLoginFormValues = z.infer<typeof loginSchema>;

export type PlatformLoginSubmitPayload = PlatformLoginFormValues & {
  platform: PlatformId;
  persona: string;
};

export type PlatformLoginMatrixProps = {
  className?: string;
  /** POST handler — typically `/api/auth/login` on the author BFF or MSGF auth bridge. */
  onSubmit: (payload: PlatformLoginSubmitPayload) => void | Promise<void>;
  title?: string;
  subtitle?: string;
};

const PLATFORM_TABS: {
  id: PlatformId;
  label: string;
  tagline: string;
}[] = [
  {
    id: "author",
    label: "Author Ecosystem",
    tagline: "Ethical AI for Creators",
  },
  {
    id: "education",
    label: "Syntax Education",
    tagline: "Ethical AI for Schools",
  },
  {
    id: "gatedai",
    label: "MSGF",
    tagline: "AI gateway for software teams",
  },
];

function submitButtonClass(platform: PlatformId): string {
  if (platform === "education") return "platform-login-btn-purple";
  if (platform === "gatedai") return "platform-login-btn-mint";
  return "platform-login-btn-emerald";
}

export function PlatformLoginMatrix({
  className,
  onSubmit,
  title = "Elphie Syntax",
  subtitle = "Unified access across Elphie Syntax products",
}: PlatformLoginMatrixProps) {
  const [platform, setPlatform] = useState<PlatformId>("author");
  const personas = PERSONAS_BY_PLATFORM[platform];
  const [persona, setPersona] = useState(personas[0]?.id ?? "");
  const comingSoon = PLATFORM_COMING_SOON[platform];

  useEffect(() => {
    const first = PERSONAS_BY_PLATFORM[platform][0]?.id ?? "";
    setPersona(first);
  }, [platform]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PlatformLoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const activeTabMeta = useMemo(
    () => PLATFORM_TABS.find((t) => t.id === platform) ?? PLATFORM_TABS[0],
    [platform]
  );

  return (
    <div className={cn("platform-login-root flex flex-col items-center justify-center px-4 py-12", className)}>
      <div className="mb-8 max-w-lg text-center">
        <p className="text-xs font-medium uppercase tracking-[0.28em] text-emerald-400/80">
          Platform Selection Matrix
        </p>
        <h1 className="mt-3 font-serif text-3xl font-light tracking-tight text-[#f5f0e8] sm:text-4xl">
          {title}
        </h1>
        <p className="mt-2 text-sm text-[#c9c4bc]">{subtitle}</p>
      </div>

      <div className="platform-login-panel w-full max-w-md rounded-2xl p-6 sm:p-8">
        <div
          className="platform-login-segment mb-6 grid grid-cols-1 gap-1 rounded-xl p-1 sm:grid-cols-3"
          role="tablist"
          aria-label="Select platform"
        >
          {PLATFORM_TABS.map((tab) => {
            const active = platform === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setPlatform(tab.id)}
                className={cn(
                  "rounded-lg px-2 py-2.5 text-left transition-all duration-200",
                  active ? "platform-login-segment-active" : "opacity-75 hover:opacity-100"
                )}
              >
                <span className="block text-[11px] font-semibold leading-tight text-[#f5f0e8] sm:text-xs">
                  {tab.label}
                </span>
                <span className="mt-0.5 block text-[10px] leading-snug text-[#c9c4bc] sm:text-[11px]">
                  {tab.tagline}
                </span>
              </button>
            );
          })}
        </div>

        {comingSoon ? (
          <div
            className={
              platform === "education"
                ? "platform-login-banner-purple mb-5 rounded-lg px-4 py-2.5 text-center text-sm font-medium tracking-wide"
                : "platform-login-banner-emerald mb-5 rounded-lg px-4 py-2.5 text-center text-sm font-medium tracking-wide"
            }
            role="status"
          >
            Coming Soon
          </div>
        ) : null}

        <form
          className={cn("space-y-5", comingSoon && "pointer-events-none opacity-45")}
          noValidate
          onSubmit={handleSubmit(async (values) => {
            if (comingSoon) return;
            await onSubmit({ ...values, platform, persona });
          })}
        >
          <div className="space-y-1.5">
            <label
              htmlFor="elphie-platform-persona"
              className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-400/90"
            >
              Persona — {activeTabMeta.label}
            </label>
            <select
              id="elphie-platform-persona"
              value={persona}
              disabled={comingSoon}
              onChange={(e) => setPersona(e.target.value)}
              className="platform-login-input platform-login-select w-full rounded-lg px-3 py-2.5 text-sm"
            >
              {personas.map((p) => (
                <option key={p.id} value={p.id} className="bg-[#120a21] text-[#f5f0e8]">
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="elphie-platform-email"
                className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#c9c4bc]"
              >
                Email
              </label>
              <input
                id="elphie-platform-email"
                type="email"
                autoComplete="email"
                disabled={comingSoon}
                placeholder="you@sovereign.workspace"
                className="platform-login-input w-full rounded-lg px-3 py-2.5 text-sm"
                {...register("email")}
              />
              {errors.email ? (
                <p className="text-xs text-red-400" role="alert">
                  {errors.email.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="elphie-platform-password"
                className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#c9c4bc]"
              >
                Password
              </label>
              <input
                id="elphie-platform-password"
                type="password"
                autoComplete="current-password"
                disabled={comingSoon}
                placeholder="••••••••"
                className="platform-login-input w-full rounded-lg px-3 py-2.5 text-sm"
                {...register("password")}
              />
              {errors.password ? (
                <p className="text-xs text-red-400" role="alert">
                  {errors.password.message}
                </p>
              ) : null}
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || comingSoon}
            className={cn(
              "w-full rounded-lg py-3 text-sm font-semibold tracking-wide transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50",
              submitButtonClass(platform)
            )}
          >
            {isSubmitting ? "Entering…" : "Enter Ecosystem"}
          </button>

          <p className="text-center text-[10px] leading-relaxed text-[#c9c4bc]/80">
            Session cookies are scoped to{" "}
            <span className="text-emerald-400/90">.elphiesyntax.com</span> when configured. Your
            persona maps to P3 Entity Profile fields on sign-in.
          </p>
        </form>
      </div>
    </div>
  );
}
