# Bizora Technologies — Bizora ERP SaaS

Separate multi-company subscription ERP foundation. This branch does not modify the Kashif Traders production ERP.

## Current build
### Bizora Super Admin
- secure Super Admin login/session
- Companies / tenants
- Basic, Standard and Premium plans
- Add Company creates subscription, first Company Admin and Main Warehouse
- Renew subscription
- Activate / Suspend company
- SaaS audit events

### Company Workspace
- Company Code + User ID/Email + Password login
- company_id comes only from the secure server session
- subscription gate: active = write, expired = read-only, suspended = blocked
- Dashboard
- Suppliers
- Clients
- Products
- Warehouses
- tenant-scoped create/list APIs
- warehouse limit enforcement from subscription plan
- company-user audit events

## Database safety
The code reads **only** `BIZORA_DATABASE_URL`. It never falls back to Kashif Traders `DATABASE_URL`.

Required private environment variables:
- `BIZORA_DATABASE_URL`
- `BIZORA_SESSION_SECRET` (32+ characters)
- `BIZORA_BOOTSTRAP_EMAIL`
- `BIZORA_BOOTSTRAP_PASSWORD` (10+ characters)

## Deployment safety
Automatic Vercel Git deployments remain disabled in `vercel.json` while deployment quota is exhausted.
