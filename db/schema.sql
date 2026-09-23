-- Bizora ERP SaaS tenant/accounting foundation
-- IMPORTANT: run only against BIZORA_DATABASE_URL, never Kashif Traders DATABASE_URL.

CREATE TABLE bizora_admins (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ
);

CREATE TABLE companies (
  id BIGSERIAL PRIMARY KEY,
  company_code TEXT NOT NULL UNIQUE,
  company_name TEXT NOT NULL,
  logo_url TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended','trial','closed')),
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
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE subscriptions (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  plan_id BIGINT NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
  starts_on DATE NOT NULL,
  expires_on DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('trial','active','expired','suspended','cancelled')),
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK(billing_cycle IN ('monthly','yearly','custom')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE company_users (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  user_code TEXT NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'company_admin',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ,
  UNIQUE(company_id,user_code)
);
CREATE UNIQUE INDEX company_users_company_email_uidx ON company_users(company_id,lower(email)) WHERE email IS NOT NULL;

CREATE TABLE erp_warehouses (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  warehouse_code TEXT NOT NULL,
  warehouse_name TEXT NOT NULL,
  address TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by_user_id BIGINT REFERENCES company_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id,warehouse_code)
);

CREATE TABLE erp_suppliers (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  supplier_code TEXT NOT NULL,
  business_name TEXT NOT NULL,
  contact_person TEXT,
  mobile_number TEXT,
  opening_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')),
  created_by_user_id BIGINT REFERENCES company_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id,supplier_code)
);

CREATE TABLE erp_clients (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  client_code TEXT NOT NULL,
  business_name TEXT NOT NULL,
  contact_person TEXT,
  mobile_number TEXT,
  credit_limit NUMERIC(14,2) NOT NULL DEFAULT 0,
  opening_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')),
  created_by_user_id BIGINT REFERENCES company_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id,client_code)
);

CREATE TABLE erp_products (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  sku TEXT NOT NULL,
  barcode TEXT,
  product_name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'pcs',
  purchase_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  sale_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by_user_id BIGINT REFERENCES company_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id,sku),
  UNIQUE(company_id,barcode)
);

CREATE TABLE erp_supplier_invoices (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  supplier_id BIGINT NOT NULL REFERENCES erp_suppliers(id) ON DELETE RESTRICT,
  invoice_number TEXT NOT NULL,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  amount NUMERIC(14,2) NOT NULL CHECK(amount>=0),
  status TEXT NOT NULL DEFAULT 'unpaid' CHECK(status IN ('unpaid','partial','paid','cancelled')),
  notes TEXT,
  created_by_user_id BIGINT REFERENCES company_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id,supplier_id,invoice_number)
);

CREATE TABLE erp_supplier_payments (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  supplier_id BIGINT NOT NULL REFERENCES erp_suppliers(id) ON DELETE RESTRICT,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC(14,2) NOT NULL CHECK(amount>0),
  payment_method TEXT NOT NULL DEFAULT 'CASH',
  reference_number TEXT,
  notes TEXT,
  created_by_user_id BIGINT REFERENCES company_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE erp_client_invoices (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  client_id BIGINT NOT NULL REFERENCES erp_clients(id) ON DELETE RESTRICT,
  invoice_number TEXT NOT NULL,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  amount NUMERIC(14,2) NOT NULL CHECK(amount>=0),
  status TEXT NOT NULL DEFAULT 'unpaid' CHECK(status IN ('unpaid','partial','paid','cancelled')),
  notes TEXT,
  created_by_user_id BIGINT REFERENCES company_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id,invoice_number)
);

CREATE TABLE erp_client_receipts (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  client_id BIGINT NOT NULL REFERENCES erp_clients(id) ON DELETE RESTRICT,
  receipt_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC(14,2) NOT NULL CHECK(amount>0),
  payment_method TEXT NOT NULL DEFAULT 'CASH',
  reference_number TEXT,
  notes TEXT,
  created_by_user_id BIGINT REFERENCES company_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_events (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT REFERENCES companies(id) ON DELETE RESTRICT,
  actor_admin_id BIGINT REFERENCES bizora_admins(id) ON DELETE SET NULL,
  actor_company_user_id BIGINT REFERENCES company_users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX subscriptions_company_idx ON subscriptions(company_id,expires_on DESC);
CREATE INDEX company_users_company_idx ON company_users(company_id,active);
CREATE INDEX erp_warehouses_company_idx ON erp_warehouses(company_id,active);
CREATE INDEX erp_suppliers_company_idx ON erp_suppliers(company_id,status);
CREATE INDEX erp_clients_company_idx ON erp_clients(company_id,status);
CREATE INDEX erp_products_company_idx ON erp_products(company_id,active);
CREATE INDEX erp_supplier_invoices_company_idx ON erp_supplier_invoices(company_id,invoice_date DESC);
CREATE INDEX erp_supplier_payments_company_idx ON erp_supplier_payments(company_id,payment_date DESC);
CREATE INDEX erp_client_invoices_company_idx ON erp_client_invoices(company_id,invoice_date DESC);
CREATE INDEX erp_client_receipts_company_idx ON erp_client_receipts(company_id,receipt_date DESC);
CREATE INDEX audit_events_company_idx ON audit_events(company_id,created_at DESC);
