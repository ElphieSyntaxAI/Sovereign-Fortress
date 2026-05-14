import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";

import { bffCredentials } from "../lib/bffFetch";
import { NDA_DOCUMENTS } from "../legal/ndaRegistry";
import { TERMS_DOCUMENTS } from "../legal/termsRegistry";
import { VAULT_PACT_ATTESTATION_PHRASE } from "../legal/vaultPactAttestation";

const registerSchema = z.object({
  username: z.string().min(2, "At least 2 characters").max(64),
  email: z.string().min(1, "Required").email("Enter a valid email"),
  password: z.string().min(8, "At least 8 characters"),
  terms_role: z.enum(["author", "editor", "fan", "publisher"], {
    message: "Select your account role",
  }),
  vault_pact_signature: z
    .string()
    .trim()
    .refine((s) => s === VAULT_PACT_ATTESTATION_PHRASE, {
      message: `Type exactly: ${VAULT_PACT_ATTESTATION_PHRASE}`,
    }),
});

export type RegisterFormValues = z.infer<typeof registerSchema>;

export function RegisterForm(props: { onError: (msg: string | null) => void }) {
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      terms_role: "author",
      vault_pact_signature: "",
    },
  });

  const termsRole = watch("terms_role");

  useEffect(() => {
    setValue("vault_pact_signature", "");
  }, [termsRole, setValue]);

  const termsDoc = TERMS_DOCUMENTS.find((d) => d.slug === termsRole);
  const ndaDoc = NDA_DOCUMENTS.find((d) => d.slug === termsRole);

  const onSubmit = async (values: RegisterFormValues) => {
    props.onError(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        ...bffCredentials,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: values.username.trim(),
          email: values.email.trim(),
          password: values.password,
          terms_role: values.terms_role,
          vault_pact_signature: values.vault_pact_signature.trim(),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
      if (!res.ok) {
        props.onError(json.message || json.error || res.statusText);
        return;
      }
      navigate("/dashboard", { replace: true });
    } catch (e) {
      props.onError(e instanceof Error ? e.message : "Registration request failed");
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="w-full max-w-sm space-y-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-8 text-zinc-100 shadow-xl"
      noValidate
    >
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight text-zinc-50">Create account</h2>
        <p className="text-sm text-zinc-500">
          Read the <strong className="text-zinc-300">Vault Seal</strong> (ElphieSyntax ↔ Author), choose your role schedule, then execute the pact by typing the attestation phrase below.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <label
            htmlFor="elphie-register-username"
            className="text-xs font-medium uppercase tracking-wider text-zinc-500"
          >
            Username
          </label>
          <input
            id="elphie-register-username"
            type="text"
            autoComplete="username"
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600"
            placeholder="Display name"
            {...register("username")}
          />
          {errors.username ? (
            <p className="text-xs text-red-400" role="alert">
              {errors.username.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="elphie-register-email" className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Email
          </label>
          <input
            id="elphie-register-email"
            type="email"
            autoComplete="email"
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600"
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
            htmlFor="elphie-register-password"
            className="text-xs font-medium uppercase tracking-wider text-zinc-500"
          >
            Password
          </label>
          <input
            id="elphie-register-password"
            type="password"
            autoComplete="new-password"
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

        <div className="space-y-1.5">
          <label htmlFor="elphie-register-role" className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Account role (schedules)
          </label>
          <select
            id="elphie-register-role"
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600"
            {...register("terms_role")}
          >
            {TERMS_DOCUMENTS.map((d) => (
              <option key={d.id} value={d.slug}>
                {d.title}
              </option>
            ))}
          </select>
          {errors.terms_role ? (
            <p className="text-xs text-red-400" role="alert">
              {errors.terms_role.message}
            </p>
          ) : null}
          <p className="text-[11px] leading-relaxed text-zinc-500">
            Role-specific schedules:{" "}
            <Link
              to={`/terms/${termsRole}`}
              className="text-violet-400 underline underline-offset-2 hover:text-violet-300"
              target="_blank"
              rel="noopener noreferrer"
            >
              {termsDoc?.navLabel ?? "Terms"}
            </Link>
            {" · "}
            <Link
              to={`/nda/${termsRole}`}
              className="text-sky-400 underline underline-offset-2 hover:text-sky-300"
              target="_blank"
              rel="noopener noreferrer"
            >
              {ndaDoc?.navLabel ?? "NDA"}
            </Link>
          </p>
        </div>

        <div className="rounded-lg border border-emerald-900/50 bg-emerald-950/20 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-400/90">Sign the Vault Pact</p>
          <p className="mt-2 text-sm leading-relaxed text-zinc-300">
            Open the{" "}
            <Link to="/vault-pact" className="font-medium text-emerald-300 underline underline-offset-2 hover:text-emerald-200" target="_blank" rel="noopener noreferrer">
              Vault Seal
            </Link>
            . To execute it as your electronic signature, type{" "}
            <strong className="rounded bg-zinc-900 px-1.5 py-0.5 font-mono text-emerald-200">
              {VAULT_PACT_ATTESTATION_PHRASE}
            </strong>{" "}
            exactly (case and spacing as shown). Changing role clears this field.
          </p>
          <label htmlFor="elphie-vault-pact-signature" className="mt-3 block text-xs font-medium text-zinc-500">
            Attestation (electronic signature)
          </label>
          <input
            id="elphie-vault-pact-signature"
            type="text"
            autoComplete="off"
            spellCheck={false}
            className="mt-1 w-full rounded-lg border border-emerald-900/60 bg-zinc-950 px-3 py-2 font-mono text-sm text-emerald-100 outline-none placeholder:text-zinc-600 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
            placeholder={VAULT_PACT_ATTESTATION_PHRASE}
            aria-describedby="vault-pact-hint"
            {...register("vault_pact_signature")}
          />
          <p id="vault-pact-hint" className="mt-1 text-[11px] text-zinc-500">
            This replaces checkbox acceptance: the typed phrase is the binding Vault Pact execution token for registration.
          </p>
          {errors.vault_pact_signature ? (
            <p className="mt-2 text-xs text-red-400" role="alert">
              {errors.vault_pact_signature.message}
            </p>
          ) : null}
        </div>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-lg bg-zinc-100 py-2.5 text-sm font-medium text-zinc-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "…" : "Create account"}
      </button>
    </form>
  );
}
