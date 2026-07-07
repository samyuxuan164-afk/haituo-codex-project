# Main Userscript Business Gates Design

Date: 2026-07-06
Status: approved-for-implementation
Scope: `src/dianxiaomi-automation-v1-merged-new.user.js`, `src/dxm-automation-core/`

## Problem

The main Dianxiaomi userscript still mixes deterministic business decisions with DOM side effects. This makes collection contamination, price filtering, AliExpress category evidence, freight template, Ships From, SKU, and stock failures difficult to diagnose before a page action is attempted.

## Goal

Add one pure business-gate layer that converts already-read snapshots into a machine decision:

```text
plain snapshot -> pure gate -> { allowed, blockers, warnings, nextAction, normalized }
```

The browser adapter remains responsible for reading the page and performing DOM actions. The gate owns only deterministic classification.

## Chosen Approach

Use the current CommonJS core pattern and add `src/dxm-automation-core/business-gates.js`.

The first implementation covers:

- crawlbox contamination and safe claim subset decisions;
- trusted Amazon displayed-price and current task formula readiness;
- AliExpress / learned-rule category evidence readiness;
- exact freight template `111` readback;
- Ships From / Origin United States readback;
- fixed merchant stock `15` and SKU=current-ASIN readback;
- edit-save readiness composition.

The main userscript should make the smallest safe adapter change: after its existing readonly/save preflight collects visible risks, normalize those risks through the same blocker vocabulary before deciding whether save is allowed. DOM dropdown handling, category modal clicks, WebBridge, native save, and publish controls stay unchanged.

## Alternatives Considered

1. **Only add more inline checks in the userscript.** This is the fastest edit, but it repeats the same structural problem: business policy remains hidden inside page-control functions.
2. **Introduce a bundler and import core modules into the userscript.** This is the cleanest long-term runtime shape, but it changes the Tampermonkey installation path before parity coverage is broad enough.
3. **Add pure core gates now and wire one adapter seam.** This keeps the runtime artifact stable while giving offline tests a single policy surface. This is the recommended path.

## Interfaces

`businessGates.evaluateCrawlboxClaimGate(input)`:

- Input: `targetAsins`, `rows`, `priceRange`.
- Output: detects duplicate rows, non-target rows, missing target rows, invalid prices, and safe claim ASINs.

`businessGates.evaluatePriceGate(input)`:

- Input: trusted Amazon displayed price status and task formula fields.
- Output: blocks missing price, untrusted price, missing formula, and out-of-range price.

`businessGates.evaluateCategoryEvidenceGate(input)`:

- Input: evidence status, confidence tier, DXM candidate category, safe-adjacent flag.
- Output: allows `aliexpress_verified`, `conditional_verified`, `detail_verified`, and `learned_rule_matched` only when a DXM candidate or safe adjacent category exists.

`businessGates.evaluateTemplateGate(input)`:

- Input: freight/postage readback text.
- Output: allows only committed selected template `111`; `copy 111` or typed input text does not pass.

`businessGates.evaluateShipsFromGate(input)`:

- Input: Ships From / Origin readback text or selected labels.
- Output: allows United States equivalents and blocks Mainland China fallback.

`businessGates.evaluateEditSaveGate(input)`:

- Input: category, price, freight, Ships From, SKU/stock identity, and existing preflight blockers.
- Output: one final save decision with normalized blocker order and next action.

## Testing

Extend `tools/dxm-automation-core.test.js` with offline assertions for the five gates. Required regressions:

- 10 target ASINs with 16 crawlbox rows returns duplicate-row contamination and only the price-valid safe subset.
- Missing Amazon displayed price blocks before edit/save.
- Missing AliExpress evidence blocks category selection/save.
- Freight template placeholder, typed `111`, and `copy 111` block until committed readback is exactly `111`.
- Ships From blocks empty, Mainland China, and non-US values; United States equivalents pass.
- SKU/stock blocks until every variation row uses the current Amazon ASIN and merchant stock `15`.
- Composed edit-save decision allows save only when all gates pass and no normalized preflight blockers remain.

## Safety Boundary

This task must not open or operate Dianxiaomi business pages. It must not collect, claim, edit, save, move to wait publish, publish, or one-click publish.

## Documentation

Update `docs/current-status.md`, `docs/test-plan.md`, `docs/test-results.md`, and `DEVELOPMENT_LOG.md` after implementation. Mention that the installed runtime artifact is still a single userscript and that the new gate is source-level/offline-tested.
