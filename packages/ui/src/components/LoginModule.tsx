"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { HTMLAttributes } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { cn } from "../lib/cn";

const loginSchema = z.object({
  email: z.string().min(1, "Required").email("Enter a valid email"),
  password: z.string().min(8, "At least 8 characters"),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

export type LoginModuleProps = Omit<
  HTMLAttributes<HTMLFormElement>,
  "onSubmit" | "children"
> & {
  onSubmit: (values: LoginFormValues) => void | Promise<void>;
  title?: string;
  submitLabel?: string;
};

export function LoginModule({
  onSubmit,
  title = "Sign in",
  submitLabel = "Continue",
  className,
  ...rest
}: LoginModuleProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className={cn(
        "w-full max-w-sm space-y-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-8 text-zinc-100 shadow-xl",
        className
      )}
      noValidate
      {...rest}
    >
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight text-zinc-50">
          {title}
        </h2>
        <p className="text-sm text-zinc-500">
          Minimal credentials. No decorative chrome.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <label
            htmlFor="elphie-login-email"
            className="text-xs font-medium uppercase tracking-wider text-zinc-500"
          >
            Email
          </label>
          <input
            id="elphie-login-email"
            type="email"
            autoComplete="email"
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none ring-0 transition placeholder:text-zinc-600 focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600"
            placeholder="you@example.com"
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
            htmlFor="elphie-login-password"
            className="text-xs font-medium uppercase tracking-wider text-zinc-500"
          >
            Password
          </label>
          <input
            id="elphie-login-password"
            type="password"
            autoComplete="current-password"
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600"
            placeholder="••••••••"
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
        disabled={isSubmitting}
        className="w-full rounded-lg bg-zinc-100 py-2.5 text-sm font-medium text-zinc-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "…" : submitLabel}
      </button>
    </form>
  );
}
