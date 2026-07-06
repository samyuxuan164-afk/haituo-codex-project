# Main Userscript Pure Module Split Design

Date: 2026-07-06
Status: approved-for-planning
Scope: `src/dianxiaomi-automation-v1-merged-new.user.js`

## Goal

Split the main Dianxiaomi userscript into testable pure modules without changing live business behavior. The browser-installed artifact must remain a Tampermonkey-compatible single userscript until a later build pipeline is proven safe.

## Current Constraints

- The main script is about 12,047 lines / 576 KB and mixes business rules, DOM automation, panel UI, storage reads, and save controls.
- The project has no `package.json` or unified `npm test`.
- Existing safe verification is `node --check`, JSON parsing, and hand-written Node `assert` tests such as `tools/aliexpress-evidence-policy.test.js`.
- This development task must not open or operate Dianxiaomi business pages and must not collect, claim, edit, save, publish, or one-click publish.
- Current business rules in `AGENT.md`, `TASK.md`, `docs/exception-rules.md`, related skills, and `docs/current-status.md` remain authoritative.

## Recommended Approach

Use a two-layer source shape:

1. Keep `src/dianxiaomi-automation-v1-merged-new.user.js` as the installable userscript artifact for now.
2. Add `src/dxm-automation-core/` for pure CommonJS modules that can run under Node without `window`, `document`, `localStorage`, network, or browser page state.
3. Migrate only low-risk deterministic helpers first:
   - platform text cleaning and title/description helpers;
   - numeric price, dimension, and weight calculations;
   - PC detail HTML construction and image-count analysis where parsing can be done without live DOM.
4. Keep DOM selectors, Ant dropdown interaction, WebBridge, page preflight readback, native save, and panel UI in the userscript adapter.
5. Add focused `tools/dxm-automation-core.test.js` with Node `assert`.
6. Add a temporary parity bridge in the userscript only after pure modules exist and pass tests. The first implementation should avoid a new bundler unless a later plan proves it is worth the toolchain cost.

## Module Boundaries

### `text-rules.js`

Owns:

- `plainTextFromHtml`
- `normalizeSpaces`
- `sanitizePlatformText`
- `sanitizePlatformTextDeep`
- `findPlatformTextIssues`
- brand candidate collection
- forbidden commerce term stripping
- compliant title and description generation

Must not own:

- DOM parsing through `document.createElement`
- panel input defaults
- live page state

### `pricing-rules.js`

Owns:

- `toNumber`
- `round2`
- `positiveNumber`
- `parseDimensionInches`
- `dimensionsInToCm`
- `parseWeightKg`
- `calculateSupplyPriceCny(sourcePriceUsd, exchangeRate, multiplier)`
- `priceEqualsExpected`

Must not own:

- `getTaskExchangeRate`
- `getTaskPriceMultiplier`
- localStorage price-store reads
- current edit-page ASIN discovery

### `pc-detail-rules.js`

Owns:

- HTML escaping
- text-to-detail body HTML
- image URL normalization
- current-product image selection
- PC detail web generation
- image-first and current-image count analysis using string parsing

Must not own:

- CKEditor writes
- hidden detail field updates
- live readback polling
- marketing image generation clicks

## Adapter Rules

The userscript adapter may call pure modules or copied pure helpers, but browser effects remain isolated:

- DOM read/write functions keep their current behavior unless explicitly covered by a test and plan.
- Save buttons remain guarded by existing preflight.
- Publish and one-click publish behavior are out of scope.
- Any future bundling must preserve the userscript metadata block exactly enough for Tampermonkey install/update.

## Testing

Initial tests should cover:

- special character cleanup: quotes, smart quotes, `in.` and inch symbols;
- title removal of brand/platform terms and 80-character max;
- description minimum length and forbidden term removal;
- USD x exchange-rate x multiplier price formula;
- inch-to-cm and weight conversions;
- PC detail output puts images before text;
- PC detail image analysis counts only current product images.

Expected commands:

```powershell
node tools\dxm-automation-core.test.js
node --check src\dianxiaomi-automation-v1-merged-new.user.js
git ls-files "*.js" "*.mjs" | ForEach-Object { node --check $_ }
```

## Documentation Drift Control

This task adds a standing principle: after each development task, update documentation that describes the changed behavior, verification surface, or current project state.

For this task that means:

- update `docs/current-status.md` with the module split status;
- update `docs/test-plan.md` and `docs/test-results.md` when new tests exist;
- update `README.md` / `README.zh-CN.md` only if commands or architecture claims change;
- update `DEVELOPMENT_LOG.md` with a concise implementation and verification entry;
- do not leave docs claiming there is only one explicit JS test after adding `tools/dxm-automation-core.test.js`.

## Acceptance Criteria

- Pure modules can be required from Node.
- New tests pass without browser access.
- The main userscript still parses with `node --check`.
- No live Dianxiaomi business page action is executed.
- Documentation reflects the new module/test surface before the task is marked complete.
