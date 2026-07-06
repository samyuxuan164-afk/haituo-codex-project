# Local Validation Runbook

## Goal

Verify that the engineer framework can run local checks after a merge without touching Dianxiaomi.

## Pre-check

Confirm the working directory is a clean repository checkout for the intended branch:

```text
git status --short --branch
git branch --show-current
git log -1 --oneline
```

Do not run this from the legacy local project directory unless the task explicitly says to do so.

## Safe Commands

Run only commands that are local and do not open a browser:

```text
node tools/dxm-automation-core.test.js
node tools/aliexpress-evidence-policy.test.js
<python-3.10-or-newer> tools/build-save-payload-dry-run.py --sample-payload <sample-payload-json> --out <local-output-dir>
<python-3.10-or-newer> tools/validate-product-understanding.py <product-understanding-json>
node tools/aliexpress-evidence-preflight-check.js local --asins <comma-separated-asins>
git diff --check
```

Use the local Codex bundled Python runtime or another Python 3.10+ runtime for scripts that use Python 3.10 syntax.

Do not record the absolute runtime path in committed reports.

## Expected Output

- Unit tests print their passed message.
- Dry-run payload generation writes local artifacts only.
- Product-understanding validation returns `passed: true` for valid fixtures.
- AliExpress evidence local preflight returns a local store summary.
- Sensitive-data scan finds no credential values in generated artifacts.

## Stop Conditions

Stop and report instead of continuing if:

- A command opens or tries to control a browser.
- A command attempts Dianxiaomi collection, claim, edit, save, publish, or one-click publish.
- A report contains local private paths or credential-like values.
- Python runtime incompatibility blocks a local validation command.
- Required fixture files are missing.
