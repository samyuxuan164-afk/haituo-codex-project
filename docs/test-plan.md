# Test Plan

## Current Reality

The repository does not currently provide a package manifest or a unified test command. Testing is command-driven and must be split into safe local layers and gated browser/live layers.

Do not treat live Dianxiaomi behavior as an ordinary automated test. Collection, claim, edit, save, publish, and one-click publish can mutate business state and require explicit task authorization.

## Test Layers

| Layer | Purpose | Safe locally | Current command examples |
|---|---|---:|---|
| Static syntax | Catch parse errors in userscripts/tools | Yes | `node --check <file>` |
| Pure policy tests | Test deterministic Node modules | Yes | `node tools\aliexpress-evidence-policy.test.js`; `node tools\dxm-automation-core.test.js` |
| JSON/schema validation | Validate config, thresholds, product-understanding outputs | Yes | `python tools\validate-product-understanding.py <fixture>` when fixtures are available |
| Offline payload analysis | Diff or inspect saved payload bundles | Yes | `python tools\diff-save-payload.py ...` when fixtures are available |
| Read-only browser preflight | Read page state without mutating Dianxiaomi | Gated | `tools/dxm-live-edit-helper.js readonly` with current task approval |
| Dry-run payload/report | Build reports without save/publish | Gated | Single-submit or main script dry-run entrypoints |
| Live validation | Save to wait-publish and read back | Explicitly gated | Only when `TASK.md` and user confirmation allow it |

## Minimum Local Baseline

Run these before publishing documentation or touching source:

```powershell
node tools\aliexpress-evidence-policy.test.js
node tools\dxm-automation-core.test.js
node --check src\dianxiaomi-automation-v1-merged-new.user.js
node --check src\dianxiaomi-amazon-crawlbox-v1.user.js
git diff --check
```

## Broader Static Sweep

When changing JavaScript broadly, run syntax checks across tracked JS/MJS files:

```powershell
git ls-files "*.js" "*.mjs" | ForEach-Object { node --check $_ }
```

If this fails on a historical browser-only userscript because the file depends on Tampermonkey globals, record the file and error in `docs/test-results.md` instead of hiding it.

## Documentation Drift Checks

Before finishing a docs pass, verify active entry docs do not reintroduce known stale versions:

```powershell
rg -n "1\.1\.14|1\.1\.43|0\.1\.15" README.md docs\install.md docs\architecture.md docs\test-plan.md docs\test-results.md
rg -n 'only\s+one\s+explicit|Only\s+one\s+explicit|one\s+explicit' README.md README.zh-CN.md docs\test-plan.md docs\test-results.md docs\current-status.md
```

Expected result for current docs: no matches.

## Encoding Checks

Historical documents mention Windows terminal mojibake. For high-priority Markdown and skill files, scan for common replacement or mojibake markers:

```powershell
rg -n "�|Ã|â|鈥|鉁|馃|锔|涓|绗" README.md AGENT.md AGENTS.md TASK.md TODO.md DELIVERABLE.md CHANGELOG.md VERSION_HISTORY.md docs skills -g "*.md" -g "*.json"
```

Interpretation:

- Hits inside documents that discuss mojibake as a known issue are not file corruption by themselves.
- Direct replacement-character hits in active docs or skills should be fixed or isolated.
- Always verify suspicious files in a UTF-8-aware editor before rewriting Chinese content.

## Test Coverage Gaps

Known gaps as of 2026-07-06:

1. Two explicit Node assertion tests exist: `tools/aliexpress-evidence-policy.test.js` and `tools/dxm-automation-core.test.js`.
2. No manifest exposes `npm test`, `pnpm test`, `pytest`, or similar.
3. The largest userscript still has limited direct test coverage beyond the first extracted pure modules.
4. Browser/live validation relies on run reports and explicit gated procedures.
5. Screenshot cleanup is documented, but evidence retention should be audited after each task.
