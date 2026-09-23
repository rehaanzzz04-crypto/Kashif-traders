# Bizora ERP SaaS Architecture

## Absolute separation
Bizora ERP uses only `BIZORA_DATABASE_URL`. It does not read `DATABASE_URL` and must never be pointed at the Kashif Traders production database.

## Two login planes
1. **Bizora Super Admin** — controls companies, plans, renewal and suspension.
2. **Company Workspace** — Company Code + Company User credentials.

The cookies are separate. A Super Admin session does not become a company session.

## Tenant authorization rule
Every ERP API derives `company_id` from the signed HttpOnly company session and then validates the user, company status and latest subscription in the database. A browser-supplied company_id is never used for authorization.

Every current ERP table carries `company_id NOT NULL`, including users, suppliers, clients, products, warehouses, supplier/client bills and payments.

## Subscription enforcement
- Active/trial subscription + active company → normal write access.
- Expired/missing subscription → read-only access.
- Suspended/closed company → workspace blocked.
- Warehouse creation obeys the current plan's warehouse limit.
- User creation/reactivation obeys the current plan's active-user limit.
- Only Company Admin can manage Company Users.

## Accounting foundation
Tenant-scoped tables now exist for:
- Supplier Bills
- Supplier Payments
- Client Bills
- Client Payments

Current dashboard balances are:
- Supplier Payable = Supplier Opening Balances + Supplier Bills - Supplier Payments
- Client Receivable = Client Opening Balances + Client Bills - Client Payments

Payment allocation to individual invoices is not inferred yet. That will be a separate accounting workflow so historical balances are not fabricated.

## Audit
Super Admin and Company Workspace create/status actions generate tenant-aware audit events.

## Next phase
- invoice payment allocation and running statements
- supplier/client PDF statements
- inventory stock/movements and GRN
- PostgreSQL RLS defense-in-depth
- tenant-specific PDF/Excel branding
- SaaS billing/payment history

## Deployment
`vercel.json` keeps automatic Git deployments disabled while Vercel quota is exhausted.
