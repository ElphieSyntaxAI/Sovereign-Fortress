/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * This source code and associated documentation are the exclusive property of
 * Elphie Syntax LLC. Unauthorized copying, distribution, publication, or
 * reverse-engineering — including decompilation, disassembly, or derivative
 * works — is strictly prohibited without prior written consent.
 *
 * Distribution Build ID: MSGF-2d8d295-20260516T002421Z-internal
 */
import Stripe from "stripe";

/** Pinned to the API version shipped with the installed `stripe` package (see `node_modules/stripe/esm/apiVersion.d.ts`). */
const STRIPE_API_VERSION = "2026-04-22.dahlia" as const;

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
  apiVersion: STRIPE_API_VERSION,
  typescript: true,
});
