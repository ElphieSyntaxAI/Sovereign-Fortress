const { getSupabaseAdmin } = require("../lib/supabaseAdmin");

const PRODUCT_LABEL = {
  msgf: "MSGF — Gated AI (beta testing)",
  author: "Author Ecosystem (foundational testing)",
  education: "Syntax Education (in development)",
};

function parseAdminEmails() {
  const raw =
    process.env.MSGF_GLOBAL_ADMIN_EMAILS?.trim() ||
    process.env.NEXT_PUBLIC_MSGF_GLOBAL_ADMIN_EMAILS?.trim() ||
    "";
  return raw
    .split(/[,;\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

async function sendResendEmail({ to, subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from =
    process.env.MSGF_TRANSACTIONAL_FROM?.trim() ||
    process.env.RESEND_FROM?.trim() ||
    "";
  if (!apiKey || !from) return { ok: false, skipped: true };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      text,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: json.message || `Resend HTTP ${res.status}` };
  return { ok: true };
}

async function betaSignup(req, res) {
  try {
    const product = req.body?.product;
    const email = String(req.body?.email ?? "")
      .trim()
      .toLowerCase();
    const name =
      typeof req.body?.name === "string" && req.body.name.trim()
        ? req.body.name.trim()
        : null;
    const note =
      typeof req.body?.note === "string" && req.body.note.trim()
        ? req.body.note.trim()
        : null;

    if (!["msgf", "author", "education"].includes(product)) {
      return res.status(400).json({ ok: false, error: "Invalid product." });
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ ok: false, error: "Enter a valid email address." });
    }

    const admin = getSupabaseAdmin();
    const { data: existing } = await admin
      .from("beta_waitlist")
      .select("id")
      .eq("product", product)
      .ilike("email", email)
      .maybeSingle();

    if (existing?.id) {
      return res.json({
        ok: true,
        reused: true,
        message: "You're already on the list — we'll email you when a seat opens.",
      });
    }

    const { data, error } = await admin
      .from("beta_waitlist")
      .insert({ product, email, name, note, status: "pending" })
      .select("id")
      .single();

    if (error || !data?.id) {
      return res.status(400).json({ ok: false, error: error?.message ?? "Could not save signup." });
    }

    const admins = parseAdminEmails();
    const msgfOrigin =
      process.env.MSGF_APP_URL?.trim() ||
      process.env.NEXT_PUBLIC_MSGF_APP_URL?.trim() ||
      "https://elphiesgatedai.elphiesyntax.com";
    const adminUrl = `${msgfOrigin.replace(/\/$/, "")}/admin/ops#beta-waitlist?product=${product}`;

    if (admins.length) {
      void sendResendEmail({
        to: admins,
        subject: `[Elphie] ${PRODUCT_LABEL[product]} signup — ${email}`,
        html: `<p>New waitlist signup for <strong>${PRODUCT_LABEL[product]}</strong>.</p><p>Email: ${email}</p><p><a href="${adminUrl}">Review in MSGF ops →</a></p>`,
      }).then(() =>
        admin
          .from("beta_waitlist")
          .update({ admin_notified_at: new Date().toISOString() })
          .eq("id", data.id)
      );
    }

    void sendResendEmail({
      to: email,
      subject: `You're on the ${PRODUCT_LABEL[product]} list`,
      html: `<p>Thanks for your interest in <strong>${PRODUCT_LABEL[product]}</strong>. We'll email you when a seat opens.</p>`,
      text: `Thanks — you're on the ${PRODUCT_LABEL[product]} waitlist.`,
    });

    return res.json({
      ok: true,
      reused: false,
      message: "You're on the list. We'll email you when a seat opens.",
    });
  } catch (e) {
    console.error("[bff/beta-signup]", e);
    return res.status(500).json({
      ok: false,
      error: e instanceof Error ? e.message : "Beta signup failed.",
    });
  }
}

module.exports = { betaSignup };
