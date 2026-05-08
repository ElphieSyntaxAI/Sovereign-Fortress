-- TIER DATA SEEDING
-- Defines the access levels for both Fans and Authors.

INSERT INTO tiers (
    name,
    description,
    price_monthly,
    max_storage_mb,
    can_use_lore_bot,
    can_use_strategy_ai,
    can_use_custom_domain
) VALUES
-- TIER 1: The Basic Fan/Subscriber
(
    'Tier 1: Fan Access',
    'Grants basic access to interactive content, fan tools, and the Persona Bot chat.',
    2.99,
    0, -- Fans don't get storage for product uploads
    FALSE,
    FALSE,
    FALSE
),
-- TIER 2: The Core/Pro Author
(
    'Tier 2: Core Author',
    'Access to core business features including Progress Tracking, Basic Analytics, and Social Automation.',
    19.99,
    1024, -- 1 GB for content storage
    FALSE, -- Lore Bot is premium (Tier 3)
    FALSE, -- Strategy AI is premium (Tier 3)
    FALSE -- Custom domain is premium (Tier 3)
),
-- TIER 3: The Premium/Expert Author
(
    'Tier 3: Premium Author',
    'Full access to all features, including advanced analytics, Lore Guardian Bot, and custom domains.',
    49.99,
    5120, -- 5 GB for content storage
    TRUE, -- Lore Guardian Bot (Phase 5)
    TRUE, -- Syntax/Strategy AI (Phase 5)
    TRUE -- Custom Domain Routing (Phase 3)
)
ON CONFLICT (name) DO NOTHING;
-- ON CONFLICT DO NOTHING prevents errors if you run the seed script multiple times.