# Safe Test Boundary

## Current Stage

The current engineer-framework test line is limited to local validation.

## Allowed Now

- Read repository files.
- Run local unit tests.
- Run local dry-run commands that do not submit network requests to Dianxiaomi.
- Run local validate or preflight commands in local-only mode.
- Generate reports under `runs/`.
- Create documentation under this directory.

## Not Allowed Now

- Opening Dianxiaomi pages for business execution.
- Clicking Dianxiaomi collection, claim, edit, save, wait-publish, publish, or one-click publish controls.
- Running batch pipelines unless the exact command is confirmed to be local dry-run only.
- Syncing evidence into a live browser page.
- Reading or submitting cookies, sessions, tokens, passwords, API keys, browser profiles, or private account data.
- Writing local machine paths such as user-home paths into committed project documents.

## Stage Gate

Before moving beyond local validation, a test report must explicitly confirm:

- Commands executed.
- Files changed.
- Whether browser access was used.
- Whether any real execution risk existed.
- Whether all sensitive-data checks passed.

Readonly browser testing requires a new written test plan before execution.

Live Dianxiaomi business execution requires a separate explicit user authorization and must not be inferred from this test line.
