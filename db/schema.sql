-- Bizora ERP SaaS foundation
-- Separate from Kashif Traders production database.
-- Do not run against the Kashif Traders database.

CREATE TABLE companies (
  id BIGSERIAL PRIMARY KEY,
  company_code TEXT NOT NULL UNIQUE,
  company_name TEXT NOT NULL,
  logo_url TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','trial','closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE plans (
  id BIGSERIAL PRIMARY KEY,
  plan_code TEXT NOT NULL UNIQUE,
  plan_name TEXT NOT NULL,
  monthly_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  yearly_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  user_limit INT,
  warehouse_limit INT,
  features JSONB NOT NULL DEFAULT '{}'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE subscriptions (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  plan_id BIGINT NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
  starts_on DATE NOT NULL,
  expires_on DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('trial','active','expired','suspended','cancelled')),
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly','yearly','custom')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT REFERENCES companies(id) ON DELETE RESTRICT,
  user_code TEXT NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id,user_code)
);

CREATE TABLE audit_events (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT REFERENCES companies(id) ON DELETE RESTRICT,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Operational ERP tables added in Phase 2 must include company_id NOT NULL
-- and every server-side query must scope by the authenticated company session.
CREATE INDEX subscriptions_company_idx ON subscriptions(company_id,expires_on DESC);
CREATE INDEX users_company_idx ON users(company_id,active);
CREATE INDEX audit_events_company_idx ON audit_events(company_id,created_at DESC);
