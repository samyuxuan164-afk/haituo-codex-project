---
name: failure-recovery
description: Use when a Dianxiaomi batch product cannot be completed because of category split, required field option absence, stale dropdown overlays, WebBridge/tab focus problems, or other recoverable product-level failures.
---

# Failure Recovery Skill

## Input

```json
{
  "asin": "Amazon ASIN",
  "stage": "category | field_fill | preflight | save | browser_control",
  "visibleErrors": [],
  "lastAction": "",
  "currentUrl": ""
}
```

## Process

1. Classify the failure:
   - `dxm_candidate_category_split` when Dianxiaomi category search returns multiple plausible candidates before AliExpress evidence decides; this is not a skip reason;
   - `aliexpress_category_evidence_split` when AliExpress/similar-product evidence itself points to conflicting product families with no clear majority;
   - `aliexpress_category_required` when the product family has not succeeded to wait-to-publish/listing success and must be verified on AliExpress before Dianxiaomi editing;
   - `category_rule_not_success_verified` when a candidate/AI/history rule exists but has no wait-to-publish/listing success readback;
   - `dxm_visible_category_not_found` when Dianxiaomi has no matching visible leaf category;
   - `required_attribute_option_not_found` when a red-star field has no safe selectable option;
   - `material_required_unfillable` only when required Material cannot be selected, cannot use any available material option, and cannot accept direct text input;
   - `postage_111_option_not_found` when freight template `111` is not selectable;
   - `marketing_image_generation_failed` when required marketing image generation fails;
   - `select_overlay_cross_field_stale` when dropdown options belong to another field;
   - `webbridge_tab_control_interruption` when browser focus/tab control becomes unsafe.
2. Apply one focused correction cycle for simple visible issues:
   - close stale dropdowns;
   - refocus the target field;
   - reselect the exact required value;
   - re-run visible preflight.
3. Do not spend time filling non-required fields.
4. Do not retry the same product repeatedly after one focused correction cycle fails.
5. For `dxm_candidate_category_split`, return to AliExpress/Amazon category evidence instead of skipping.
6. Record field-level evidence and continue to the next product for real product-level failures.
7. Stop browser operations only when targeting is unsafe because of WebBridge/tab-control interruption.
8. Never publish, one-click publish, recollect, or reclaim as part of recovery.

## Output

```json
{
  "asin": "Amazon ASIN",
  "decision": "retry_once | skip_product | stop_browser_operations",
  "reason": "machine-readable reason",
  "fieldFailures": [],
  "forbiddenActionsExecuted": false
}
```
