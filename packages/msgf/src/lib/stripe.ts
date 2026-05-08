import Stripe from "stripe";

/** Pinned to the API version shipped with the installed `stripe` package (see `node_modules/stripe/esm/apiVersion.d.ts`). */
const STRIPE_API_VERSION = "2026-04-22.dahlia" as const;

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
  apiVersion: STRIPE_API_VERSION,
  typescript: true,
});
