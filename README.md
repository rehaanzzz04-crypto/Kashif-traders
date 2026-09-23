# Bizora Technologies — Bizora ERP SaaS

Separate multi-company subscription ERP foundation. This branch does not modify the Kashif Traders production ERP.

## Current build
- Super Admin authentication with secure HttpOnly session
- Companies / tenants
- Basic, Standard and Premium plans
- Add Company creates subscription + first Company Admin
- Renew subscription
- Activate / Suspend company
- SaaS audit events
- Dashboard summary
- Mobile-friendly Super Admin UI

## Database safety
The code reads **only** `BIZORA_DATABASE_URL`. It never falls back to Kashif Traders `DATABASE_URL`.

Required private environment variables:
- `BIZORA_DATABASE_URL`
- `BIZORA_SESSION_SECRET` (32+ characters)
- `BIZORA_BOOTSTRAP_EMAIL`
- `BIZORA_BOOTSTRAP_PASSWORD` (10+ characters)

The bootstrap email/password create the first Super Admin only when no Bizora admin exists.

## Deployment safety
Automatic Vercel Git deployments are disabled in `vercel.json` while the deployment quota is exhausted.
