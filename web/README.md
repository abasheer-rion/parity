# Dashboard

The public front page (`index.html`), the sign-in pages (`login/`, `signup/`, `reset/`, `verify/`) and the research app (`app/`, served at `/app/`). Run it with `make web` from the repo root; `npm run build` makes both parts. Only signed-in people can fetch `/app/` and `/data/` (`functions/_middleware.ts`); sign-in is explained in [auth/README.md](../auth/README.md). Deployed to Cloudflare Pages by `.github/workflows/deploy-web.yml`. Design notes are in [REF-0001](../docs/reference/0001-architecture.md).
