# Author Ecosystem Roadmap & Key Language (SSoT)

**Status:** Single source of truth for product vision, terminology, phased delivery, tiers, and target system states.  
**Companion tracker:** Operational repo ↔ pillar mapping lives in `docs/PILLAR_PROGRESS.md` (update both when scope shifts).

**Production URL:** **https://elphiesyntax.com**

**Shared engine:** MSGF (guardrails, Pulse, Vault/Hall) — **https://elphiesgatedai.elphiesyntax.com** — see [`MSGF_V1_ROADMAP.md`](./MSGF_V1_ROADMAP.md) and [`MONOREPO_PRODUCTS.md`](./MONOREPO_PRODUCTS.md).

**Last updated:** 2026-05-15

---

## 1. Core Vision: The Creative Integrity Flywheel

ElphieSyntax is a sovereign narrative infrastructure that transitions authors from **“Protecting the Work”** (Sovereignty) to **“Perfecting the Work”** (Professionalism).

---

## 2. Key Terminology (The “Sovereign” Lexicon)

| Term | Definition | Legal / Technical Impact |
| :--- | :--- | :--- |
| **HAL Ledger** | Human Authorship Ledger. Telemetry-based proof of biometric interaction. | Defends copyright via “Chain of Origin.” |
| **Vault Seal** | The bilateral NDA / Pact enforcing zero-training and no-human-browsing. | Contractual data sovereignty. |
| **Cool Down Lock** | A mandatory read-only period (2 / 4 / 6 weeks) after a draft is finished. | Forces professional distance; triggers audit. |
| **Bicameral Audit** | Dual-AI review (Librarian for logic, Critic for sensitivity). | Provides a logic audit receipt for publishers. |
| **Publisher Hub** | Anonymized WIP feed showing HAL scores, blurbs, and genre. | Proof-based scouting without IP exposure. |

**Implementation note (engineering):** Tiered manuscript locks today use **4w / 6w / 8w** `lock_tier` values in `p4_manuscripts` plus a separate **24h planning-sync cooldown** (`COOLDOWN_LOCKED`) for Apprentice/Guild gates. Product copy and pricing should converge on this SSOT over time.

---

## 3. Development Phases

### Phase 1: The Foundation (Current WIP)

| Feature | Description |
| :--- | :--- |
| **HAL v2 Certificate** | Telemetry summary + Vault Seal + Lore-Git chain (exportable proof bundle). |
| **Author RAG Model** | Sidekick for continuity and outline adherence. |
| **Progress Tracking** | Word count + outline percentage. |
| **Unified Registration** | Atomic transaction (Auth + Profile + Pact + Legacy). |

### Phase 2: Professionalization (Immediate Focus)

| Feature | Description |
| :--- | :--- |
| **Cool Down Revision Lock** | Read-only state gate with timer-based unlocks. |
| **Revision Reports** | Automated insights on continuity, plot holes, and market appeal. |
| **Editor Suite** | Dashboard for human editors to view HAL scores and revision history. |
| **Community Guild** | Marketplace for verified human translators, artists, and VAs. |

### Phase 3: Scaling & Sovereignty

| Feature | Description |
| :--- | :--- |
| **Author Growth Tracking** | Vocabulary and craft analytics. |
| **Multimedia Vault** | Video / audio uploads (Patreon-style or Stripe-gated). |
| **Graph Comparison** | Sales data vs. multimedia engagement vs. AI insights. |
| **Personality Lore Bots** | Character-specific RAG models for fan interaction (non-spoiler). |

---

## 4. Tiers & Encryption Levels

### Author Tiers

| Tier | Price | Capabilities (SSoT) |
| :--- | :--- | :--- |
| **Tier 1 (Free)** | — | Extension + HAL (biometric only) + 1 WIP. |
| **Tier 2** | **$29.99** | Dashboard + 2 WIP + Guild access (Level 1 editors). |
| **Tier 3** | **$79.99** | 5 WIP + 1 Lore Bot + Guild access (Level 2 editors). |
| **Tier 4** | **$109.99** | 10 WIP + 3 Lore Bots + Manual sales tracking + Video (3–5). |
| **Tier 5** | **$199.99** | 20 WIP + 7 Lore Bots + Automated sales tracking + Courses. |

**Reconciliation:** Legacy `msgf_legacy_tiers` seeds and BFF defaults may still reflect older counts or prices until migrations and product rules are aligned to this table.

### Publisher Encryption Keys

| Level | Scope |
| :--- | :--- |
| **Level 1** | Core HAL average (Free). |
| **Level 2** | Chapter-level timestamps and general metrics. |
| **Level 3** | In-depth session-level audit trail. |
| **Level 4** | Full forensic audit trail (max detail). |

---

## 5. System Enforcement (MSGF States)

Target lifecycle vocabulary (product / guardrail layer). Map to `p4_manuscripts.revision_status`, BFF gates, and HAL/Vault policies as implementations mature.

| State | Meaning |
| :--- | :--- |
| **`STATE_SOVEREIGN`** | Vault Pact signed; HAL active. |
| **`STATE_COOLDOWN`** | Manuscript locked; revision logic active. |
| **`STATE_AUDIT`** | Librarian / Critic generating revision reports (bicameral audit path). |
| **`STATE_DISCOVERY`** | Manuscript (anonymized) visible in Publisher Hub. |

**Today (partial mapping):** `DRAFTING`, `LOCKED`, `COOLDOWN_LOCKED`, `AUDITING`, `READY_FOR_EDITOR`, etc., cover slices of the above; explicit `STATE_*` enums in application config may land later without renaming database enums prematurely.

---

## Changelog (SSoT only)

| Date | Change |
| :--- | :--- |
| 2026-05-15 | Linked production URL (elphiesyntax.com), MSGF engine (elphiesgatedai.elphiesyntax.com), and monorepo/MSGF 1.0 companion docs. |
| 2026-05-13 | Initial SSoT: Creative Integrity Flywheel, Sovereign Lexicon, three phases, five author tiers, four publisher key levels, MSGF state model. |
