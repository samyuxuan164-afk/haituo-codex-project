# B0CTBQCKL9 Edit Closed Loop - 2026-07-02

## Scope

- Phase: Validation / real edit-to-wait-publish closed loop.
- Target ASIN: `B0CTBQCKL9`.
- Correct DXM edit id: `167487782009931643`.
- Allowed business action: save and move to wait-publish only after final preflight pass.
- Prohibited actions respected: no final publish, no one-click publish, no Product Development draft handling, no recollection, no reclaim.

## Code Repairs

- Added project-level single required-attribute recovery in `src/dianxiaomi-automation-v1-merged-new.user.js`.
- Added `requiredAttrField --field` and readonly `inspectRequiredAttr --field` to `tools/dxm-live-edit-helper.js`.
- Added variation required-field preflight for row fields: freight/logistic value, stock, SKU, weight, dimensions, and Ships From.
- Fixed stale Ant Design dropdown filtering so old closing dropdowns are not used for another field.
- Fixed Origin selection to prefer short United States tokens and verify the committed selected tag.
- Fixed hidden native validation text handling so invisible transition/helper text does not block final preflight.

## Field Readback

- ASIN guard: passed, source URL read back as `https://www.amazon.com/dp/B0CTBQCKL9`.
- Category: `收纳架(Racks & Holders)`.
- Postage template: `111`.
- Ships From: United States.
- Price: `64.99`, from trusted Amazon displayed-price store formula.
- Stock: `15`.
- SKU: `B0CTBQCKL9`.
- Required attributes:
  - Brand: `NONE(AE存量)*******(None)`.
  - Feature: `其他(Other)`.
  - High-concerned chemical: `天然未处理(None)`.
  - Origin: `美国(Origin)(US(Origin))`.
  - Material: `塑料(Plastic)`.

## Save Gate

- Final edit preflight: `pass=true`.
- Final blockers: `0`.
- Executed native `保存并移入待发布` once after the gate passed.

## Wait-Publish Readback

- Row found: yes.
- SKU: `B0CTBQCKL9`.
- Price: `CNY 64.99`.
- Stock: `15`.
- Category: `收纳架(Racks & Holders)`.
- Readback status: passed.

## Notes

- The earlier failed save attempt exposed a real project-code gap: variation-row freight/stock/SKU were not part of the final preflight. That is now covered.
- The later Origin/Material work exposed stale dropdown and hidden validation-text issues. These were fixed at project level, not as product-specific business rules.
