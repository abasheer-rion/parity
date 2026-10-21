# Contributing

How the three of us work on this repo. Short version: branch, small pull request, checks green, one review, squash merge.

## Branches and pull requests

- Never push to `main` directly. Branch from it: `ayan/hyp-0003-lead-lag`, `amanda/dashboard-ic-chart`.
- Keep pull requests small enough to review in ten minutes.
- One other person reviews before merging. Squash merge so `main` reads as one line per change.
- The pull request template asks which docs you touched. Code that changes results needs an experiment doc. A change of approach needs a decision doc.

## Commit messages and pull request titles

```text
<type>(<optional scope>): <summary in plain words>
```

Types: `feat`, `fix`, `docs`, `data`, `research`, `exp`, `test`, `refactor`, `ci`, `chore`. Example: `research(hyp-0003): measure oil to CAD lead-lag`. The commit-msg hook and CI check this (`scripts/commit_msg.py`).

## Checks

`make check` runs what CI runs: engine lint and tests, the dashboard type check and build, and the docs check. The pre-commit hook runs the docs check and lint on every commit once `make setup` has turned hooks on.

## Docs

Follow [GDE-0003](docs/guides/0003-writing-docs.md). Add a log entry at the end of a working session. Record every experiment, including the ones that failed, because failed trials count toward the deflated Sharpe ratio.

## Code style

- Python: `ruff` with the settings in `engine/pyproject.toml`, 100 character lines.
- TypeScript: strict mode, checked by `npm run typecheck`.
- Comments explain why, not what. Docstrings say what a function returns and anything surprising about it.
- No real data or outputs in git. They are reproducible from code.

## Secrets

Never commit keys. Locally, keep them in the macOS Keychain or in an ignored `.env` file. In CI, they are GitHub Actions secrets. The ones the workflows expect are listed in `.github/workflows/`.

## Changelog

Add a line under "Unreleased" in [CHANGELOG.md](CHANGELOG.md) for any change someone else would notice.
