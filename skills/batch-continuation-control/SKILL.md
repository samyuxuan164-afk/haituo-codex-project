---
name: batch-continuation-control
description: Control Dianxiaomi batch execution so per-product failures are recorded and the batch continues without waiting for manual intervention or repeating successful collection/claim work.
---

# Batch Continuation Control Skill

Use this skill for recovery, validation, and multi-product listing batches.

## Input

```json
{
  "batchId": "batch identifier",
  "targetStore": "Halo Home Store",
  "draftProducts": [
    {
      "asin": "Amazon ASIN",
      "editUrl": "Dianxiaomi edit URL",
      "amazonOriginalPriceUsd": 0,
      "status": "draft"
    }
  ],
  "forbiddenActions": [
    "publish",
    "one_click_publish",
    "recollect_successful_items",
    "reclaim_successful_items"
  ]
}
```

## Process

1. Read `AGENT.md` first, then `TASK.md`, then the relevant skill files.
2. Start from the current list state; do not recollect or reclaim already successful items.
3. Open each product by stable edit URL when row-level edit buttons are unreliable.
4. Apply category evidence rules before editing fields: direct reuse is allowed only for product-family category rules that have succeeded to wait-to-publish or listing success.
5. If only candidate or unverified category rules exist, record `category_rule_not_success_verified` / `aliexpress_category_required`, run AliExpress category verification, then return to Dianxiaomi visible-category selection.
6. If Dianxiaomi candidates split, record `dxm_candidate_category_split`; do not skip; use AliExpress/Amazon evidence to decide.
7. Apply field fill rules from `skills/field-fill-rule/SKILL.md`.
8. Run visible preflight.
9. If preflight passes, save to wait-to-publish and close success modal with `X`.
10. If preflight cannot be automatically fixed, record field-level failure and continue to the next product.
11. If AliExpress category evidence itself is split, record `aliexpress_category_evidence_split` and continue.
12. If Dianxiaomi visible category cannot be found after AliExpress evidence is clear, record `dxm_visible_category_not_found` and continue.
13. If WebBridge or tab control fails repeatedly, record `webbridge_tab_control_interruption` and stop browser operations to avoid unsafe clicks.
14. If no AliExpress evidence object or success-verified learned rule exists, record `category_evidence_missing` / `needs_aliexpress_category_verification` and continue; do not search Dianxiaomi and do not record `dxm_visible_category_not_found`.

## Output

```json
{
  "batchId": "batch identifier",
  "completedToWaitPublish": [],
  "skipped": [
    {
      "asin": "Amazon ASIN",
      "reason": "field-level reason",
      "fieldFailures": []
    }
  ],
  "environmentInterruptions": [],
  "forbiddenActionsExecuted": false
}
```

## Non-Wait Rules

1. Do not wait for manual intervention for a single product failure.
2. Do not retry the same product more than one focused correction cycle unless the failure is a simple visible field correction.
3. Do not treat product-level skip as batch failure.
4. Do not treat WebBridge control interruption as product business failure.
5. Continue until all current-batch products are completed, skipped, or an environment interruption requires stopping.
