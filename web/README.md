# Dashboard

The public front page (`index.html`), the sign-in pages (`login/`, `signup/`, `reset/`, `verify/`) and the research app (`app/`, served at `/app/`). Run it with `make web` from the repo root; `npm run build` makes both parts. Only signed-in people can fetch `/app/` and `/data/` (`functions/_middleware.ts`); sign-in is explained in [auth/README.md](../auth/README.md). Deployed to Cloudflare Pages by `.github/workflows/deploy-web.yml`. Design notes are in [REF-0001](../docs/reference/0001-architecture.md).

Addresses that do not exist get `404.html` with status 404 (Cloudflare Pages serves it because it sits at the top of the build). A missing path under an app folder, such as `/app/strategies`, opens that app at `#/strategies`, and each app shows a "not found" view for a hash it does not know. `npm run dev` answers the same way (`plugins/notFound.ts`). See [DEC-0055](../docs/decisions/0055-addresses-that-do-not-exist-get-a-real-404-and-each-app-says-not-found.md).
