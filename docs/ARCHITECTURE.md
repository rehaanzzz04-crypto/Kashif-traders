# Bizora ERP SaaS Architecture

## Absolute separation
Bizora ERP uses only `BIZORA_DATABASE_URL`. It does not read `DATABASE_URL` and must never be pointed at the Kashif Traders production database.

## Super Admin control plane
Bizora Technologies Super Admin can create tenants, assign plans, renew subscriptions, suspend/activate a company and review SaaS-level audit events.

## Tenant rule
Each company is identified by `company_id`. In the Company Workspace phase, the backend will derive company_id from the authenticated company session. Browser-provided company_id values are never accepted as authorization.

## Subscription gate
Company status and the latest subscription determine access. Expired or suspended accounts should retain data but lose normal write access until renewed/reactivated.

## Phase status
Implemented in code:
- Super Admin login/session
- first-admin bootstrap via private environment variables
- Companies
- Basic / Standard / Premium plans
- company onboarding with first Company Admin
- renewal
- activate/suspend
- SaaS audit events
- separate DB environment guard

Next:
- Company Workspace login
- tenant-scoped ERP tables/APIs
- PostgreSQL RLS defense-in-depth
- plan feature/limit enforcement
- billing history and payment receipts

## Deployment
`vercel.json` currently disables automatic Git deployments. This prevents Bizora work from consuming deployment quota while the limit is exhausted.
