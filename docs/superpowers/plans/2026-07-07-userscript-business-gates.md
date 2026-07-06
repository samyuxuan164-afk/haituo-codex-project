# Userscript Business Gates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a pure business-gate layer that standardizes collection contamination, price, category evidence, freight template, and Ships From save blockers before DOM side effects execute.

**Architecture:** Add `src/dxm-automation-core/business-gates.js` as a CommonJS pure module and export it from `src/dxm-automation-core/index.js`. Extend `tools/dxm-automation-core.test.js` with offline assertions, then make a minimal userscript adapter change to reuse the same normalized preflight blocker vocabulary in readonly/save preflight output. No live Dianxiaomi action is part of this plan.

**Tech Stack:** JavaScript CommonJS, Node built-in `assert`, existing Tampermonkey single-file userscript, PowerShell verification commands.

---

## File Structure

- Create `src/dxm-automation-core/business-gates.js`: deterministic business gates and normalized blocker decisions.
- Modify `src/dxm-automation-core/index.js`: export `businessGates`.
- Modify `tools/dxm-automation-core.test.js`: add TDD assertions for each gate.
- Modify `src/dianxiaomi-automation-v1-merged-new.user.js`: add a tiny adapter-side blocker normalizer equivalent at readonly preflight aggregation only.
- Modify `docs/current-status.md`, `docs/test-plan.md`, `docs/test-results.md`, and `DEVELOPMENT_LOG.md`: document the new pure gate surface and verification.

## Task 1: Write Failing Business Gate Tests

**Files:**
- Modify: `tools/dxm-automation-core.test.js`

- [ ] **Step 1: Add failing import and assertions**

Add the following block before the final `process.stdout.write(...)` line:

```javascript
const { businessGates } = require('../src/dxm-automation-core');

const categoryMissingGate = businessGates.evaluateCategoryEvidenceGate({
  status: 'missing',
  dxmCandidateCategory: '',
});
assert.strictEqual(categoryMissingGate.allowed, false);
assert.deepStrictEqual(categoryMissingGate.blockers, ['category_evidence_missing']);

const categoryVerifiedGate = businessGates.evaluateCategoryEvidenceGate({
  status: 'conditional_verified',
  confidenceTier: 'low_confidence',
  dxmCandidateCategory: 'Home & Garden > Storage Boxes & Bins',
});
assert.strictEqual(categoryVerifiedGate.allowed, true);
assert.deepStrictEqual(categoryVerifiedGate.blockers, []);

const missingPriceGate = businessGates.evaluatePriceGate({
  asin: 'B0F2H4PF7R',
  status: 'missing',
  trusted: false,
  sourcePriceUsd: '',
  exchangeRate: 7,
  multiplier: 1.55,
});
assert.strictEqual(missingPriceGate.allowed, false);
assert.deepStrictEqual(missingPriceGate.blockers, ['amazon_displayed_price_missing']);

const formulaPriceGate = businessGates.evaluatePriceGate({
  asin: 'B0F2H4PF7R',
  status: 'trusted',
  trusted: true,
  sourcePriceUsd: 12.99,
  exchangeRate: '',
  multiplier: 1.55,
});
assert.strictEqual(formulaPriceGate.allowed, false);
assert.deepStrictEqual(formulaPriceGate.blockers, ['price_formula_missing_exchange_rate_or_multiplier']);

const readyPriceGate = businessGates.evaluatePriceGate({
  asin: 'B0F2H4PF7R',
  status: 'trusted',
  trusted: true,
  sourcePriceUsd: 12.99,
  exchangeRate: 7,
  multiplier: 1.55,
  priceRange: { min: 5, max: 20 },
});
assert.strictEqual(readyPriceGate.allowed, true);
assert.strictEqual(readyPriceGate.normalized.expectedCnyPrice, '140.94');

assert.strictEqual(businessGates.evaluateTemplateGate({ selectedText: '--- 请选择运费模板 ---' }).allowed, false);
assert.deepStrictEqual(
  businessGates.evaluateTemplateGate({ selectedText: '--- 请选择运费模板 ---' }).blockers,
  ['postage_template_not_111']
);
assert.strictEqual(businessGates.evaluateTemplateGate({ selectedText: '111' }).allowed, true);

assert.strictEqual(businessGates.evaluateShipsFromGate({ selectedText: '中国大陆(Mainland China)' }).allowed, false);
assert.deepStrictEqual(
  businessGates.evaluateShipsFromGate({ selectedText: '中国大陆(Mainland China)' }).blockers,
  ['ships_from_not_united_states']
);
assert.strictEqual(businessGates.evaluateShipsFromGate({ selectedText: '美国(United States)' }).allowed, true);

const editSaveGate = businessGates.evaluateEditSaveGate({
  categoryEvidence: categoryVerifiedGate,
  price: readyPriceGate,
  freight: businessGates.evaluateTemplateGate({ selectedText: '111' }),
  shipsFrom: businessGates.evaluateShipsFromGate({ selectedText: 'United States' }),
  preflightBlockers: [],
});
assert.strictEqual(editSaveGate.allowed, true);
assert.strictEqual(editSaveGate.nextAction, 'save_to_wait_publish_only_after_final_visible_confirmation');

const blockedEditSaveGate = businessGates.evaluateEditSaveGate({
  categoryEvidence: categoryMissingGate,
  price: readyPriceGate,
  freight: businessGates.evaluateTemplateGate({ selectedText: '--- 请选择运费模板 ---' }),
  shipsFrom: businessGates.evaluateShipsFromGate({ selectedText: '' }),
  preflightBlockers: ['product category is not selected'],
});
assert.strictEqual(blockedEditSaveGate.allowed, false);
assert.deepStrictEqual(blockedEditSaveGate.blockers, [
  'category_evidence_missing',
  'postage_template_not_111',
  'ships_from_not_united_states',
  'product_category_not_selected',
]);
assert.strictEqual(blockedEditSaveGate.nextAction, 'run_aliexpress_category_verification_before_save');
```

- [ ] **Step 2: Run the test and confirm failure**

Run:

```powershell
node tools\dxm-automation-core.test.js
```

Expected: fail with `Cannot read properties of undefined` or missing `businessGates`.

## Task 2: Implement `business-gates.js`

**Files:**
- Create: `src/dxm-automation-core/business-gates.js`
- Modify: `src/dxm-automation-core/index.js`

- [ ] **Step 1: Add the pure module**

Create `src/dxm-automation-core/business-gates.js` with these exports:

```javascript
'use strict';

const { calculateSupplyPriceCny, positiveNumber } = require('./pricing-rules');
const { analyzeCrawlboxBatch, normalizePreflightBlocker } = require('./workflow-diagnostics');

const VERIFIED_CATEGORY_STATUSES = new Set([
  'aliexpress_verified',
  'conditional_verified',
  'detail_verified',
  'learned_rule_matched',
]);

function compactText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function uniqueInOrder(values) {
  const seen = new Set();
  const output = [];
  values.forEach((value) => {
    const key = compactText(value);
    if (!key || seen.has(key)) return;
    seen.add(key);
    output.push(key);
  });
  return output;
}

function decision(blockers, nextAction, normalized = {}, warnings = []) {
  const cleanBlockers = uniqueInOrder(blockers);
  return {
    allowed: cleanBlockers.length === 0,
    blockers: cleanBlockers,
    warnings: uniqueInOrder(warnings),
    nextAction: cleanBlockers.length ? nextActionForBlockers(cleanBlockers, nextAction) : nextAction,
    normalized,
  };
}

function nextActionForBlockers(blockers, fallback = 'manual_gate_review') {
  if (blockers.includes('category_evidence_missing')) return 'run_aliexpress_category_verification_before_save';
  if (blockers.includes('aliexpress_dxm_category_map_missing')) return 'map_verified_aliexpress_category_to_dxm_before_save';
  if (blockers.includes('amazon_displayed_price_missing')) return 'recover_trusted_amazon_displayed_usd_price';
  if (blockers.includes('price_out_of_range_or_zero')) return 'skip_or_confirm_price_range_exception';
  if (blockers.includes('price_formula_missing_exchange_rate_or_multiplier')) return 'provide_task_exchange_rate_and_multiplier';
  if (blockers.includes('postage_template_not_111')) return 'select_real_postage_template_111_before_save';
  if (blockers.includes('ships_from_not_united_states')) return 'select_real_ships_from_united_states_before_save';
  if (blockers.includes('product_category_not_selected')) return 'select_verified_dxm_category_before_save';
  return fallback || 'manual_gate_review';
}

function evaluateCrawlboxClaimGate(input = {}) {
  const result = analyzeCrawlboxBatch(input);
  return {
    allowed: result.batchSafe,
    blockers: result.rootCauses,
    warnings: result.batchSafe ? [] : ['safe_claim_subset_requires_filtered_selection'],
    nextAction: result.batchSafe ? 'claim_current_batch_only' : nextActionForBlockers(result.rootCauses, 'claim_safe_subset_only'),
    normalized: result,
  };
}

function evaluatePriceGate(input = {}) {
  const blockers = [];
  const sourcePrice = positiveNumber(input.sourcePriceUsd || input.amazonDisplayedPriceUsd || input.amazonOriginalPriceUsd);
  const min = positiveNumber(input.priceRange && input.priceRange.min);
  const max = positiveNumber(input.priceRange && input.priceRange.max);
  if (!input.trusted || !sourcePrice) blockers.push('amazon_displayed_price_missing');
  if (sourcePrice && ((min != null && sourcePrice < min) || (max != null && sourcePrice > max))) blockers.push('price_out_of_range_or_zero');
  if (sourcePrice && (positiveNumber(input.exchangeRate) == null || positiveNumber(input.multiplier && input.multiplier.multiplier ? input.multiplier.multiplier : input.multiplier) == null)) {
    blockers.push('price_formula_missing_exchange_rate_or_multiplier');
  }
  const expectedCnyPrice = blockers.length ? '' : calculateSupplyPriceCny(sourcePrice, input.exchangeRate, input.multiplier);
  return decision(blockers, 'price_gate_passed', {
    asin: compactText(input.asin),
    sourcePriceUsd: sourcePrice || null,
    expectedCnyPrice,
    status: compactText(input.status || (input.trusted ? 'trusted' : 'missing')),
  });
}

function evaluateCategoryEvidenceGate(input = {}) {
  const status = compactText(input.status || input.aliexpressEvidenceStatus);
  const dxmCandidateCategory = compactText(input.dxmCandidateCategory || input.dxmVisibleCategoryPath || input.dxmVisibleCategory);
  const blockers = [];
  if (!VERIFIED_CATEGORY_STATUSES.has(status)) blockers.push('category_evidence_missing');
  if (VERIFIED_CATEGORY_STATUSES.has(status) && !dxmCandidateCategory && !input.safeAdjacentAllowed) blockers.push('aliexpress_dxm_category_map_missing');
  return decision(blockers, 'category_evidence_gate_passed', {
    status,
    confidenceTier: compactText(input.confidenceTier),
    dxmCandidateCategory,
    safeAdjacentAllowed: Boolean(input.safeAdjacentAllowed),
  }, input.safeAdjacentAllowed ? ['safe_adjacent_dxm_category_selected'] : []);
}

function evaluateTemplateGate(input = {}) {
  const selectedText = compactText(input.selectedText || input.postageText || input.freightTemplate || input.postageId);
  const ok = selectedText === '111' || /\b111\b/.test(selectedText);
  return decision(ok ? [] : ['postage_template_not_111'], 'freight_template_gate_passed', {
    selectedText,
    expectedTemplate: '111',
  });
}

function evaluateShipsFromGate(input = {}) {
  const selectedText = compactText(input.selectedText || input.shipFrom || input.origin || input.label);
  const normalized = selectedText.toLowerCase();
  const ok = /\bunited states\b|us\(origin\)|美国|\busa\b/.test(normalized) && !/mainland china|中国大陆/.test(normalized);
  return decision(ok ? [] : ['ships_from_not_united_states'], 'ships_from_gate_passed', {
    selectedText,
    expected: 'United States',
  });
}

function evaluateEditSaveGate(input = {}) {
  const gates = [input.categoryEvidence, input.price, input.freight, input.shipsFrom].filter(Boolean);
  const gateBlockers = gates.flatMap((gate) => Array.isArray(gate.blockers) ? gate.blockers : []);
  const normalizedPreflight = uniqueInOrder((input.preflightBlockers || []).map(normalizePreflightBlocker).filter(Boolean));
  return decision([...gateBlockers, ...normalizedPreflight], 'save_to_wait_publish_only_after_final_visible_confirmation', {
    gateCount: gates.length,
    gateWarnings: uniqueInOrder(gates.flatMap((gate) => Array.isArray(gate.warnings) ? gate.warnings : [])),
  });
}

module.exports = {
  evaluateCrawlboxClaimGate,
  evaluatePriceGate,
  evaluateCategoryEvidenceGate,
  evaluateTemplateGate,
  evaluateShipsFromGate,
  evaluateEditSaveGate,
  nextActionForBlockers,
};
```

- [ ] **Step 2: Export the module**

Update `src/dxm-automation-core/index.js`:

```javascript
'use strict';

module.exports = {
  textRules: require('./text-rules'),
  pricingRules: require('./pricing-rules'),
  pcDetailRules: require('./pc-detail-rules'),
  workflowDiagnostics: require('./workflow-diagnostics'),
  businessGates: require('./business-gates'),
};
```

- [ ] **Step 3: Run tests**

Run:

```powershell
node tools\dxm-automation-core.test.js
```

Expected: pass.

## Task 3: Minimal Userscript Adapter Normalization

**Files:**
- Modify: `src/dianxiaomi-automation-v1-merged-new.user.js`

- [ ] **Step 1: Locate readonly preflight aggregation**

Run:

```powershell
rg -n "safeToSaveToWaitPublish|blockers|preflightPass|postage template|ships from" src\dianxiaomi-automation-v1-merged-new.user.js
```

Use the existing function that builds readonly preflight output. Do not change DOM interaction functions or save button click functions.

- [ ] **Step 2: Add adapter-local normalization helpers**

Add these helpers near existing preflight helper functions:

```javascript
function normalizeBusinessGateBlocker(blocker) {
  const raw = compactText(blocker);
  const text = raw.toLowerCase();
  if (!text) return '';
  if (/category_evidence_missing|aliexpress category evidence/.test(text)) return 'category_evidence_missing';
  if (/aliexpress_category_confirmed_but_dxm_mapping_missing|aliexpress_dxm_category_map_missing/.test(text)) return 'aliexpress_dxm_category_map_missing';
  if (/product category is not selected|category is not selected|产品分类.*(未|空)/i.test(raw)) return 'product_category_not_selected';
  if (/postage template is not 111|freight template is not 111|运费.*111/i.test(raw)) return 'postage_template_not_111';
  if (/ships? from is not united states|发货地.*(united states|美国)/i.test(raw)) return 'ships_from_not_united_states';
  if (/amazon_displayed_price_missing|amazon_original_price_missing|price.*missing/.test(text)) return 'amazon_displayed_price_missing';
  if (/price_formula_missing_exchange_rate_or_multiplier/.test(text)) return 'price_formula_missing_exchange_rate_or_multiplier';
  if (/required attributes incomplete|product attribute|请选择产品属性/.test(text)) return 'required_attributes_incomplete';
  return text.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'unknown_preflight_blocker';
}

function normalizeBusinessGateBlockers(blockers) {
  const seen = new Set();
  const output = [];
  (Array.isArray(blockers) ? blockers : []).forEach((blocker) => {
    const normalized = normalizeBusinessGateBlocker(blocker);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    output.push(normalized);
  });
  return output;
}
```

- [ ] **Step 3: Include normalized blockers in readonly output**

Where readonly preflight returns `{ safeToSaveToWaitPublish, preflightPass, blockers, ... }`, add:

```javascript
const normalizedBlockers = normalizeBusinessGateBlockers(blockers);
const safeToSaveToWaitPublish = preflightPass && normalizedBlockers.length === 0;
```

Ensure the returned object includes:

```javascript
businessGate: {
  allowed: safeToSaveToWaitPublish,
  blockers: normalizedBlockers,
  nextAction: normalizedBlockers.length
    ? businessGateNextAction(normalizedBlockers)
    : 'save_to_wait_publish_only_after_final_visible_confirmation',
}
```

If `businessGateNextAction` does not exist, add a small helper matching the pure module order:

```javascript
function businessGateNextAction(blockers) {
  if (blockers.includes('category_evidence_missing')) return 'run_aliexpress_category_verification_before_save';
  if (blockers.includes('aliexpress_dxm_category_map_missing')) return 'map_verified_aliexpress_category_to_dxm_before_save';
  if (blockers.includes('amazon_displayed_price_missing')) return 'recover_trusted_amazon_displayed_usd_price';
  if (blockers.includes('price_formula_missing_exchange_rate_or_multiplier')) return 'provide_task_exchange_rate_and_multiplier';
  if (blockers.includes('postage_template_not_111')) return 'select_real_postage_template_111_before_save';
  if (blockers.includes('ships_from_not_united_states')) return 'select_real_ships_from_united_states_before_save';
  if (blockers.includes('product_category_not_selected')) return 'select_verified_dxm_category_before_save';
  return 'manual_edit_preflight_review';
}
```

- [ ] **Step 4: Syntax check**

Run:

```powershell
node --check src\dianxiaomi-automation-v1-merged-new.user.js
```

Expected: no output and exit code `0`.

## Task 4: Verification And Documentation

**Files:**
- Modify: `docs/current-status.md`
- Modify: `docs/test-plan.md`
- Modify: `docs/test-results.md`
- Modify: `DEVELOPMENT_LOG.md`

- [ ] **Step 1: Run full local verification**

Run:

```powershell
node tools\dxm-automation-core.test.js
node tools\aliexpress-evidence-policy.test.js
node --check src\dianxiaomi-automation-v1-merged-new.user.js
git ls-files "*.js" "*.mjs" | ForEach-Object { node --check $_ }
```

Expected:

- `dxm-automation-core.test.js passed`
- `aliexpress-evidence-policy.test.js passed`
- all syntax checks exit `0`

- [ ] **Step 2: Update docs with this status**

Add this concise status to the relevant docs:

```text
Added `src/dxm-automation-core/business-gates.js` as an offline-tested pure business gate for collection contamination, price readiness, AliExpress category evidence, freight template `111`, Ships From `United States`, and composed edit-save readiness. The main userscript only received a minimal readonly preflight normalization adapter; DOM interactions, native save, publish, and one-click publish behavior were not changed. No live Dianxiaomi business action was executed.
```

- [ ] **Step 3: Commit implementation**

Run:

```powershell
git add src\dxm-automation-core\business-gates.js src\dxm-automation-core\index.js tools\dxm-automation-core.test.js src\dianxiaomi-automation-v1-merged-new.user.js
git commit -m "feat(core): add userscript business gates"
```

- [ ] **Step 4: Commit documentation**

Run:

```powershell
git add docs\current-status.md docs\test-plan.md docs\test-results.md DEVELOPMENT_LOG.md docs\superpowers\plans\2026-07-07-userscript-business-gates.md
git commit -m "docs(core): document userscript business gates"
```

## Self-Review

- Spec coverage: all five requested business decisions are represented by pure gates and tests.
- Placeholder scan: no `TBD`, `TODO`, or open-ended test steps remain.
- Type consistency: public export is `businessGates`, and individual functions use the `evaluate*Gate` naming scheme.
- Scope control: runtime remains a single userscript; no live browser/Dianxiaomi action is part of this plan.
