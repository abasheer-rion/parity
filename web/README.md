# Dashboard

The research dashboard. Run it with `make web` from the repo root. With no Supabase settings it reads `engine/output/latest.json`; with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` set (see `.env.example`) it reads published runs after sign-in. Deployed to Cloudflare Pages by `.github/workflows/deploy-web.yml`. Design notes are in [REF-0001](../docs/reference/0001-architecture.md).
