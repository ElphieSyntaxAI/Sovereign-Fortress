-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-2d8d295-20260516T002421Z-internal
-- =============================================================================
-- P4 State Ledger legal defensibility:
-- Track which Terms & Conditions version the user agreed to at Pulse time.

alter table public.state_beats
add column if not exists legal_version text not null default 'unknown';

-- Optional: keep the default for safety; audits prefer explicit writes.
