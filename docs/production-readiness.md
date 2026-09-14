# Production readiness

- Configure `SPACE_SALES_AUTH_SECRET` (32+ random characters) and `SPACE_SALES_ACCESS_TOKEN` (16+ random characters) as server-only Vercel secrets.
- Apply `supabase/space-sales-app-state.sql` before enabling coaching mutations.
- Confirm `/health` reports `configured`, then verify login, calls pagination, one canonical call detail, outcome review, and coaching transition.
- Do not expose the application publicly before replacing the initial admin token with the organization identity provider and role mapping.
- Outcome review is rate-limited per meeting in the application process. Production multi-region deployments should move counters to a shared store.
