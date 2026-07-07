# Unified Blocker Reporting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** readonly edit preflight, batch gate, and WebBridge reports all normalize to one pure blocker contract.

**Architecture:** Extend `business-gates.js` with pure report normalization helpers and keep tool/userscript adapters thin. `workflow-diagnostics.js` remains the source for text-to-blocker normalization, while batch/WebBridge tooling delegates next-action decisions to the shared pure layer.

**Tech Stack:** CommonJS Node modules, deterministic `assert` tests, PowerShell local verification.

---

### Task 1: Add Failing Pure Tests

**Files:**
- Modify: `tools/dxm-automation-core.test.js`

- [ ] **Step 1: Add readonly and WebBridge report assertions**

Add assertions for `businessGates.evaluateReadonlyPreflightReport()` and `businessGates.evaluateWebBridgeReport()`:

```js
const readonlyReport = businessGates.evaluateReadonlyPreflightReport({
  ok: true,
  source: 'function',
  href: 'https://www.dianxiaomi.com/web/smtlocalProduct/edit?id=1',
  readyState: 'complete',
  preflight: {
    asin: 'B0F2H4PF7R',
    safeToSaveToWaitPublish: false,
    businessGate: {
      blockers: ['category_evidence_missing', 'postage_template_not_111'],
    },
  },
});
assert.deepStrictEqual(readonlyReport.blockers, ['category_evidence_missing', 'postage_template_not_111']);
assert.strictEqual(readonlyReport.environmentStatus.pageRendered, true);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tools\dxm-automation-core.test.js`
Expected: FAIL with missing function.

### Task 2: Implement Pure Report Normalizers

**Files:**
- Modify: `src/dxm-automation-core/business-gates.js`

- [ ] **Step 1: Add shared helpers**

Add `normalizeBlockers`, `environmentStatusFromReport`, `evaluateReadonlyPreflightReport`, and `evaluateWebBridgeReport`.

- [ ] **Step 2: Run test to verify it passes**

Run: `node tools\dxm-automation-core.test.js`
Expected: PASS.

### Task 3: Wire Batch Gate To Shared Logic

**Files:**
- Modify: `tools/dxm-batch-execution-gate.js`
- Test: `tools/dxm-automation-core.test.js`

- [ ] **Step 1: Add a batch merge regression**

Require `mergePreflight` from `tools/dxm-batch-execution-gate.js` and assert unavailable preflight produces `readonly_preflight_unavailable` with shared next action.

- [ ] **Step 2: Update batch gate implementation**

Import `businessGates` and use `evaluateReadonlyPreflightReport()` plus `nextActionForBlockers()` in `mergePreflight()`.

- [ ] **Step 3: Run test**

Run: `node tools\dxm-automation-core.test.js`
Expected: PASS.

### Task 4: Wire Readonly Preflight Tool Analysis

**Files:**
- Modify: `tools/aliexpress-evidence-preflight-check.js`

- [ ] **Step 1: Replace local analysis output**

Use `businessGates.evaluateReadonlyPreflightReport()` in `readReadonlyPreflight()` and keep legacy fields for compatibility.

- [ ] **Step 2: Syntax check**

Run: `node --check tools\aliexpress-evidence-preflight-check.js`
Expected: PASS.

### Task 5: Documentation And Verification

**Files:**
- Modify: `docs/current-status.md`
- Modify: `docs/test-plan.md`
- Modify: `docs/test-results.md`
- Modify: `DEVELOPMENT_LOG.md`

- [ ] **Step 1: Run local verification**

Run the documented safe baseline:

```powershell
node tools\aliexpress-evidence-policy.test.js
node tools\dxm-automation-core.test.js
node --check src\dianxiaomi-automation-v1-merged-new.user.js
node --check src\dianxiaomi-amazon-crawlbox-v1.user.js
node --check src\dxm-automation-core\business-gates.js
node --check tools\dxm-batch-execution-gate.js
node --check tools\aliexpress-evidence-preflight-check.js
git diff --check
node tools\cleanup-task-screenshots.js plan
```

- [ ] **Step 2: Update docs with results**

Record the branch, commands, and no-live-business-action boundary.

- [ ] **Step 3: Commit and push**

Use explicit `git add <path>` and commit with `feat(userscript): unify blocker report logic`.

