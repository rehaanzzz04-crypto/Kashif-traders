# Bizora ERP SaaS Architecture

## Absolute separation
Bizora ERP uses only `BIZORA_DATABASE_URL`. It does not read `DATABASE_URL` and must never be pointed at the Kashif Traders production database.

## Two login planes
1. **Bizora Super Admin** — controls companies, plans, renewal and suspension.
2. **Company Workspace** — Company Code + Company User credentials.

The cookies are separate. A Super Admin session does not become a company session.

## Tenant authorization rule
Every ERP API derives `company_id` from the signed HttpOnly company session and then validates the user, company status and latest subscription in the database. A browser-supplied company_id is never used for authorization.

All current ERP base tables carry `company_id NOT NULL`:
- erp_suppliers
- erp_clients
- erp_products
- erp_warehouses

Codes and barcodes are unique **inside a company**, not globally.

## Subscription gate
- Active/trial subscription + active company → normal write access.
- Expired/missing subscription → read-only access so company data is retained and visible.
- Suspended/closed company → workspace blocked.
- Warehouse creation obeys the current plan's warehouse limit.

## Company onboarding
Super Admin Add Company creates:
- Company tenant
- Subscription
- Company Admin (`ADMIN001`)
- Main Warehouse (`MAIN`)

## Audit
Super Admin actions and Company Workspace create actions write tenant-aware audit events.

## Next phase
- Company user management with plan user limits
- Supplier bills/payments
- Client bills/payments
- inventory stock/movements and GRN
- stronger PostgreSQL RLS defense-in-depth
- billing/payment history
- tenant-specific PDF/Excel branding

## Deployment
`vercel.json` keeps automatic Git deployments disabled while Vercel quota is exhausted.
