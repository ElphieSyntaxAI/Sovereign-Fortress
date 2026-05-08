-- 1. Setup UUID support
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create the missing Tenants table
CREATE TABLE IF NOT EXISTS tenants (
  id SERIAL PRIMARY KEY,
  domain_name TEXT UNIQUE NOT NULL,
  author_name TEXT NOT NULL,
  schema_name TEXT NOT NULL DEFAULT 'public',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Create the HAL Ledger table
CREATE TABLE IF NOT EXISTS hal_ledger (
    hal_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    author_id UUID, 
    content_hash TEXT NOT NULL,
    keystroke_data JSONB,
    session_start TIMESTAMP WITH TIME ZONE,
    session_end TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Seed the local environment data
INSERT INTO tenants (domain_name, author_name, schema_name)
VALUES ('localhost:3002', 'Dev Author', 'public')
ON CONFLICT (domain_name) DO NOTHING;