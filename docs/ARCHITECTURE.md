# Bizora ERP SaaS Architecture

## Separation
Bizora ERP is developed separately from the Kashif Traders production ERP.

## Tenant rule
Every company is a tenant. The backend derives company_id from the authenticated session. Browser-provided company_id values are never trusted for authorization.

## Super Admin
Bizora Technologies Super Admin can:
- create companies
- assign plans
- activate, suspend and renew subscriptions
- view high-level tenant usage
- never mix company operational records

## Company Admin
A company admin only manages users and records for that company.

## Database isolation
All operational tables will include company_id and server APIs will filter by that company. Cross-company reads/writes are blocked at the application layer and should later be reinforced with PostgreSQL Row Level Security.

## Deployment
Automatic Git deployments are disabled on this branch while Vercel quota is exhausted. When quota is available, Bizora ERP should be connected to a separate Vercel project and separate SaaS database.
