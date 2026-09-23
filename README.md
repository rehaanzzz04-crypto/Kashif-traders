# Bizora Technologies — SaaS ERP

This branch is a **separate SaaS product foundation**. It does not modify the Kashif Traders production ERP.

## Product
- Company: Bizora Technologies
- Product: Bizora ERP
- Model: Multi-company subscription SaaS
- Isolation: Every business record is scoped by company_id
- Control: Super Admin manages companies, plans, subscriptions and access

## Safety
Automatic Vercel Git deployments are disabled on this branch while the deployment quota is exhausted. Kashif Traders production remains untouched.

## Phase 1
1. Super Admin shell
2. Companies
3. Subscription plans
4. Company onboarding
5. Tenant-aware login
6. Database schema with company isolation
