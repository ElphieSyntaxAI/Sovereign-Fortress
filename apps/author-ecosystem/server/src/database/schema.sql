
DROP TABLE IF EXISTS user_subscriptions CASCADE;
DROP TABLE IF EXISTS custom_domains CASCADE;
DROP TABLE IF EXISTS author_progress CASCADE;
DROP TABLE IF EXISTS sales_data CASCADE;
DROP TABLE IF EXISTS content_items CASCADE;
DROP TABLE IF EXISTS hal_ledger CASCADE;
DROP TABLE IF EXISTS rag_chunks CASCADE;
DROP TABLE IF EXISTS rag_sources CASCADE;
DROP TABLE IF EXISTS author_profiles CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS tenants CASCADE;

-- Drop core tables
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS tiers CASCADE; 

-- Drop function
DROP FUNCTION IF EXISTS update_updated_at_column CASCADE;
-- --- END CLEANUP ---
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create tiers table
CREATE TABLE tiers (
    tier_id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    price_monthly DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    max_storage_mb INTEGER NOT NULL DEFAULT 0,
    can_use_lore_bot BOOLEAN NOT NULL DEFAULT FALSE,
    can_use_strategy_ai BOOLEAN NOT NULL DEFAULT FALSE,
    can_use_custom_domain BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- Create users table
CREATE TABLE users (
  user_id UUID PRIMARY KEY default uuid_generate_v4(),
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  tier_id INTEGER REFERENCES tiers(tier_id) ON DELETE RESTRICT NOT NULL,
  password_hash CHAR(60) NOT NULL,
  user_role VARCHAR(20) NOT NULL default 'fan',
  preferred_theme VARCHAR(20) NOT NULL default 'Pleasure',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_user_email ON users (email);

-- Author profile/settings (template-driven)
-- Domain is required per author; theme/persona are stored as JSON so new authors can be provisioned by config.
CREATE TABLE author_profiles (
  author_user_id UUID PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
  domain_name VARCHAR(255) UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  theme_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  persona_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Projects (Manuscripts / Works-in-progress)
CREATE TABLE projects (
  project_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_user_id UUID REFERENCES users(user_id) ON DELETE CASCADE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'wip' CHECK (status IN ('wip', 'draft_complete', 'published')),
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  target_word_count INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_projects_author_created ON projects (author_user_id, created_at DESC);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_update_users_timestamp
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

--Domain table
CREATE TABLE custom_domains(
  domain_id SERIAL PRIMARY KEY,
  author_user_id UUID REFERENCES users(user_id) ON DELETE CASCADE NOT NULL,
  domain_name VARCHAR(255) UNIQUE NOT NULL,
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX idx_domain_name ON custom_domains (domain_name);

--Content table
CREATE TABLE content_items (
    item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_user_id UUID REFERENCES users(user_id) ON DELETE CASCADE NOT NULL,
    title VARCHAR(255) NOT NULL,
    item_type VARCHAR(50) NOT NULL CHECK (item_type IN ('book', 'video', 'game_asset')), -- Content type validation
    storage_url TEXT NOT NULL,
    minimum_tier_required INTEGER REFERENCES tiers(tier_id) ON DELETE RESTRICT NOT NULL,
    is_public BOOLEAN DEFAULT FALSE, -- If content is viewable without login
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast lookup by author
CREATE INDEX IF NOT EXISTS idx_content_author ON content_items (author_user_id);

--User Subscriptions table
CREATE TABLE user_subscriptions (
    subscription_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fan_user_id UUID REFERENCES users(user_id) ON DELETE CASCADE NOT NULL,
    -- Tracks access to a specific piece of content, or a legacy external tier
    content_tier_name VARCHAR(100), 
    external_subscriber_id VARCHAR(255) UNIQUE, -- e.g., Patreon ID, for linking
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE author_progress (
    progress_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_user_id UUID REFERENCES users(user_id) ON DELETE CASCADE NOT NULL,
    item_id UUID REFERENCES content_items(item_id) ON DELETE CASCADE, -- Link to a specific book/project being tracked (optional)
    date_recorded DATE NOT NULL DEFAULT CURRENT_DATE,
    word_count INTEGER DEFAULT 0,
    revision_phase VARCHAR(50), 
    notes TEXT,
    -- Ensure an author only records one entry per project per day
    UNIQUE (author_user_id, item_id, date_recorded),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
-- ... (rest of your tables above)

CREATE TABLE IF NOT EXISTS hal_ledger (
    hal_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- Consistent with your users table
    author_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    content_hash TEXT NOT NULL,
    keystroke_data JSONB,
    is_ai_generated BOOLEAN DEFAULT FALSE,
    session_start TIMESTAMP WITH TIME ZONE,
    session_end TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_hal_author_session ON hal_ledger (author_id, created_at DESC);

-- --- RAG (Lore Librarian) ---
-- Canon sources are stored locally; access control is enforced in the API layer.
-- Audience rules:
-- - fan: ONLY spoiler-free World Bible + Character Bible (used by fan-facing chatbots)
-- - author: can include Story Outline + Theme Sheet (author-only librarian)

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rag_source_type') THEN
    CREATE TYPE rag_source_type AS ENUM ('world_bible', 'character_bible', 'story_outline', 'theme_sheet');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rag_audience') THEN
    CREATE TYPE rag_audience AS ENUM ('fan', 'author');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS rag_sources (
  source_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_user_id UUID REFERENCES users(user_id) ON DELETE CASCADE NOT NULL,
  project_id UUID NULL,
  source_type rag_source_type NOT NULL,
  audience rag_audience NOT NULL,
  title TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Gemini embedding models commonly use 768 dims (e.g., text-embedding-004).
CREATE TABLE IF NOT EXISTS rag_chunks (
  chunk_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID REFERENCES rag_sources(source_id) ON DELETE CASCADE NOT NULL,
  author_user_id UUID REFERENCES users(user_id) ON DELETE CASCADE NOT NULL,
  project_id UUID NULL,
  audience rag_audience NOT NULL,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  embedding vector(768) NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_rag_chunks_dedupe
  ON rag_chunks (author_user_id, project_id, audience, content_hash);

CREATE INDEX IF NOT EXISTS idx_rag_chunks_author_project_audience
  ON rag_chunks (author_user_id, project_id, audience, created_at DESC);

-- Requires enough rows to be effective; still safe to create for MVP.
CREATE INDEX IF NOT EXISTS idx_rag_chunks_embedding_ivfflat
  ON rag_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE TABLE IF NOT EXISTS tenants (
  id SERIAL PRIMARY KEY,
  domain_name TEXT UNIQUE NOT NULL,
  author_name TEXT NOT NULL,
  schema_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
); 

INSERT INTO tenants (domain_name, author_name, schema_name)
VALUES ('localhost:3002', 'Dev Author', 'public')
ON CONFLICT (domain_name) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_progress_author_date ON author_progress (author_user_id, date_recorded DESC);

--function that throws an error if anyone tries to UPDATE or DELETE the HAL ledger
CREATE OR REPLACE FUNCTION protect_hal_ledger()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'HAL Ledger is immutable. Records cannot be modified or deleted.';
END;
$$ LANGUAGE plpgsql;

-- Guard to the hal_ledger table
DROP TRIGGER IF EXISTS lock_hal_ledger ON hal_ledger;
CREATE TRIGGER lock_hal_ledger
BEFORE UPDATE OR DELETE ON hal_ledger
FOR EACH ROW EXECUTE FUNCTION protect_hal_ledger();