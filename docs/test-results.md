# Test Results

## Latest Local Baseline - 2026-07-06

Environment:

```text
Node.js: v24.14.1
Python: 3.13.7
Branch: codex/userscript-pure-modules
Worktree: isolated local worktree; absolute path intentionally omitted from public docs
```

Commands run:

| Command | Result | Notes |
|---|---|---|
| `node tools\aliexpress-evidence-policy.test.js` | PASS | Printed `aliexpress-evidence-policy.test.js passed` |
| `node tools\dxm-automation-core.test.js` | PASS | Printed `dxm-automation-core.test.js passed` |
| `node --check src\dxm-automation-core\text-rules.js` | PASS | Syntax check only |
| `node --check src\dxm-automation-core\pricing-rules.js` | PASS | Syntax check only |
| `node --check src\dxm-automation-core\pc-detail-rules.js` | PASS | Syntax check only |
| `node --check src\dxm-automation-core\index.js` | PASS | Syntax check only |
| `node --check tools\dxm-automation-core.test.js` | PASS | Syntax check only |
| `node --check src\dianxiaomi-automation-v1-merged-new.user.js` | PASS | Syntax check only |
| `node --check src\dianxiaomi-amazon-crawlbox-v1.user.js` | PASS | Syntax check only |
| `git ls-files "*.js" "*.mjs" | ForEach-Object { node --check $_ }` | PASS | JavaScript/MJS syntax sweep |
| Python AST parse over `git ls-files "*.py"` | PASS | 11 Python files parsed |
| JSON parse over `git ls-files "*.json"` | PASS | 117 JSON files parsed |
| `git diff --check` | PASS | No whitespace errors; Git reported CRLF conversion warnings only |
| Stale version scan over active docs | PASS | No legacy source-version pattern or stale 3x10 phrase in active entry docs |
| PNG architecture asset check | PASS | `docs/assets/architecture-overview-en.png` and `docs/assets/architecture-overview-zh.png` are present and non-empty |
| Mermaid source check | PASS | `docs/diagrams/workflow-en.mmd` and `docs/diagrams/workflow-zh.mmd` start with `flowchart LR` and include live-gate nodes |
| ASCII architecture check | PASS | English and Chinese ASCII maps have no tab characters and lines <= 100 chars |
| Markdown fence check | PASS | `README.md`, `README.zh-CN.md`, `docs/architecture.md`, and `docs/architecture.zh-CN.md` have balanced code fences |

## What This Proves

- The AliExpress evidence policy and selected capture behaviors covered by `tools/aliexpress-evidence-policy.test.js` still pass locally.
- The extracted userscript core modules for text rules, pricing/dimensions, and PC detail image analysis pass deterministic Node assertions.
- The current main DXM automation userscript parses under Node syntax checking.
- The current Amazon crawlbox userscript parses under Node syntax checking.
- All tracked JavaScript/MJS files parse under `node --check`.
- All tracked Python files parse as Python AST.
- All tracked JSON files parse as JSON.
- The rewritten active docs are free of known stale source-visible version strings.
- The bilingual SVG, Mermaid, and ASCII architecture assets are present and pass basic structural checks.

## What This Does Not Prove

- It does not prove browser-installed Tampermonkey versions are current.
- It does not prove Dianxiaomi page selectors still match live UI.
- It does not prove save-to-wait-publish works.
- It does not authorize any collection, claim, edit, save, publish, or one-click publish action.
- It does not provide coverage for the full main userscript; only the first extracted pure modules are directly covered.
- It does not prove GitHub's Mermaid renderer will lay out every diagram identically to local expectations.

## Discovered Test Surface

Explicit Node assertion tests:

```text
tools/aliexpress-evidence-policy.test.js
tools/dxm-automation-core.test.js
```

Related pure modules and candidates for future tests:

```text
src/dxm-automation-core/text-rules.js
src/dxm-automation-core/pricing-rules.js
src/dxm-automation-core/pc-detail-rules.js
tools/aliexpress-evidence-policy.js
tools/aliexpress-evidence-capture.js
tools/candidate-manifest.js
tools/product-risk-filter.js
tools/exception-queue.js
```

## Recommended Next Tests

1. Add a manifest with a conservative `test` script that runs the current safe local checks only.
2. Continue splitting pure logic out of the large main userscript so category, attribute, and preflight rules can be tested without a browser.
3. Add fixture tests for product risk filtering and candidate manifest routing.
4. Add schema validation fixtures for `config/aliexpress-evidence.schema.json` and product-understanding outputs.
5. Keep browser/live validation as a separate gated procedure.
