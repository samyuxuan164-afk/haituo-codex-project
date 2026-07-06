# First Batch Small Loop Validation - 2026-07-02

## Scope

- Phase: Validation / small real-product closed loop
- Goal: verify that a real claimed Dianxiaomi collection-box product can pass code gates, be edited, saved to wait-to-publish, and read back without publishing.
- Target ASIN selected by pipeline gate: `B0DXFB86J7`
- Forbidden actions status: no final publish, no one-click publish, no Product Development draft handling, no recollection, and no reclaim executed.

## Formal Store Writes

### Amazon Displayed Price Store

- Store: `runs/amazon-price-store.json`
- Result: 10 trusted records written and read back.
- Formula: Amazon displayed price USD x 7 x 1.55.
- Readback: 10/10 trusted, 10/10 formula OK, 0 blockers.

Key selected values:

| ASIN | Amazon Displayed USD | Expected CNY |
|---|---:|---:|
| B0CZ7F61XN | 11.99 | 130.09 |
| B0DZ14L38Y | 11.99 | 130.09 |
| B0DXFB86J7 | 9.99 | 108.39 |
| B0DPSJP47V | 9.99 | 108.39 |
| B0F1DDLKBB | 19.99 | 216.89 |
| B0CTBQCKL9 | 5.99 | 64.99 |
| B0FH7774VK | 15.58 | 169.04 |
| B01E2EYG4U | 19.96 | 216.57 |
| B0GFV4N3K8 | 12.99 | 140.94 |
| B0C1JY1C7F | 8.99 | 97.54 |

### AliExpress Category Evidence Store

- Store: `runs/aliexpress-evidence-store.json`
- Current records: 3
- Verified: 1
- Split evidence: 2

| ASIN | Status | DXM Candidate Category | Result |
|---|---|---|---|
| B0DXFB86J7 | `aliexpress_verified` | `收纳架(Racks & Holders)` | passed hard gate |
| B01E2EYG4U | `evidence_split` | `收纳盒和收纳箱(Storage Boxes & Bins)` | blocked |
| B0FH7774VK | `evidence_split` | `收纳架(Racks & Holders)` | blocked |

## Batch Pipeline Plan

- Report JSON: `runs/dxm-batch-pipeline-first-batch-after-price-evidence-20260702.json`
- Report Markdown: `runs/dxm-batch-pipeline-first-batch-after-price-evidence-20260702.md`
- Total ASINs: 10
- Gate ready: 1
- Blocked: 9
- Ready for readonly edit preflight: `B0DXFB86J7`
- Blockers: `category_evidence_missing=7`, `aliexpress_category_evidence_split=2`

## Edit-To-Wait-Publish Execution

### Selected Product

- ASIN/SKU: `B0DXFB86J7`
- Edit row id: `167487782009931615`
- Store: `Halo Home Store`
- Expected stock: `15`
- Expected category leaf: `收纳架`
- Expected price: `CNY 108.39`

### Field Results Before Save

- Title: `Kitchen Cutting Board Organizer Rack, 5 Slot Storage Holder for Boards`
- Category: `收纳架(Racks & Holders)`
- Required attributes filled: Brand `NONE`, Function `其他(Other)`, Feature `其他(Other)`, High-concerned chemical `天然未处理(None)`, Origin `美国`, Material `PET+PE`
- Ships From: `美国`
- Freight template: `111`
- Custom attributes: cleared to 0
- Package sale: unchecked
- Variation Color: `黑色`
- Variation price: `108.39`
- Stock: `15`
- PC description: manually topped up above the minimum text threshold before save

### Known Code Finding

- Browser live script was still `2.1.4` during this execution and could reuse stale ASIN/price panel state when a direct edit URL is opened.
- Source file was fixed to `2.1.5` in `src/dianxiaomi-automation-v1-merged-new.user.js`:
  - current edit ASIN now prioritizes the active edit page/source URL
  - strict price state can read `dxm_amazon_price_store_v1`
  - invisible locked required-attribute containers no longer block preflight by themselves
- Syntax check passed for the updated source file.

### Business Action Executed

- Action: clicked the native edit-page `保存并移入待发布` button once.
- Action nature: save/move to wait-to-publish only.
- Result message: `产品已移入待发布，请在「待发布」中查看！`
- No publish or one-click publish button was clicked.

## Wait-To-Publish Readback

Authoritative readback source: `/web/smtlocalProduct/offline`

Readback row:

```text
亚马逊(美国) Kitchen Cutting Board Organizer Rack, 5 Slot Storage Holder for Boards 「Halo Home Store」 美国 收纳架(Racks & Holders) -- B0DXFB86J7 CNY 108.39 15 创建： 2026-07-01 03:28 更新： 2026-07-01 21:47 编辑 发布 更多
```

Field checks:

| Field | Expected | Actual | Result |
|---|---|---|---|
| row present | yes | yes | pass |
| ASIN/SKU | `B0DXFB86J7` | `B0DXFB86J7` | pass |
| price | `108.39` | `108.39` | pass |
| stock | `15` | `15` | pass |
| category | `收纳架` | `收纳架(Racks & Holders)` | pass |

Readback summary:

- Total checked: 1
- Passed: 1
- Blockers: 0
- Missing rows: 0
- SKU mismatches: 0
- Price mismatches: 0
- Stock mismatches: 0
- Category mismatches: 0

## B0FH7774VK Third Ready Product Closed Loop

### Gate And Preflight Confirmation

- Target ASIN/SKU: `B0FH7774VK`
- Edit id: `167487782009931651`
- Source URL read from current collection-box row: `https://www.amazon.com/dp/B0FH7774VK`
- Amazon displayed price store: trusted, USD `15.58`, expected CNY `169.04` by `15.58 x 7 x 1.55`.
- AliExpress category evidence: `aliexpress_verified`, `postCategoryId=200044148`, candidate category `收纳架(Racks & Holders)`.
- Initial readonly preflight correctly blocked save before field fill because category, freight `111`, Ships From, price, PC description, and required/custom attributes were not yet compliant.

### Code Repair Applied

- Local source advanced to `DXM Automation V1 - NEW v2.1.14`.
- Root cause fixed: the main edit-page pipeline had a PC description filler but did not call it, so B0FH could remain blocked by `PC description too short` after other fields passed.
- The sequential edit pipeline now runs `applyVisiblePcDescriptionRule()` immediately after title normalization and includes the description result in stop/final reports.

### Final Preflight Before Save

Final preflight passed before any save action:

- `pass=true`
- `blockers=0`
- title length: `72`
- PC description chars: `1038`
- category: `收纳架(Racks & Holders)`
- freight template: `111`
- Ships From: `美国(United States)`
- price: `169.04`
- stock: `15`
- Brand: `NONE(AE存量)*******(None)`
- Feature: `其他(Other)`
- High-concerned chemical: `天然未处理(None)`
- Origin: `美国(Origin)(US(Origin))`
- Material: `PET+PE材质(PET+PE)`
- custom attributes after cleanup: `0`

### Business Action Executed

- Action: clicked native edit-page `保存并移入待发布` only after final preflight passed.
- Result message: `产品已移入待发布，请在「待发布」中查看！`
- Final publish: not executed.
- One-click publish: not executed.
- Product Development draft handling: not executed.
- Recollection/reclaim: not executed.

### Wait-To-Publish Readback

Authoritative readback source: `/web/smtlocalProduct/offline`

Readback row:

```text
亚马逊(美国) 2 Pack Pull Out Storage Organizers, Under Sink Organizer and Storage for 「Halo Home Store」 美国 收纳架(Racks & Holders) -- B0FH7774VK CNY 169.04 15 创建： 2026-07-01 03:28 更新： 2026-07-01 23:04 编辑 发布 更多
```

Field checks:

| Field | Expected | Actual | Result |
|---|---|---|---|
| row present | yes | yes | pass |
| ASIN/SKU | `B0FH7774VK` | `B0FH7774VK` | pass |
| price | `169.04` | `169.04` | pass |
| stock | `15` | `15` | pass |
| category | `收纳架` | `收纳架(Racks & Holders)` | pass |

Readback summary:

- Total checked: 1
- Passed: 1
- Blockers: 0
- Missing rows: 0
- SKU mismatches: 0
- Price mismatches: 0
- Stock mismatches: 0
- Category mismatches: 0

## Ten-Item Pressure Test Preparation

Current first-batch status after three closed loops:

- Closed-loop completed: `B0DXFB86J7`, `B0DPSJP47V`, `B0FH7774VK`.
- Local `dxm-batch-pipeline plan` dry-run still reports those same three ASINs as gate-ready from price/evidence stores; they must be excluded from the next pressure-test candidate pool because they are already in wait-to-publish.
- Dry-run safety flags: `businessActions=false`, `browserActions=false`, `writesManifestReport=false`, `writesExceptionQueue=false`, `writesPriceStore=false`.
- Remaining ready for next small batch: none.
- Remaining blockers:
  - `B0CZ7F61XN`: `category_evidence_missing`
  - `B0DZ14L38Y`: `category_evidence_missing`
  - `B0F1DDLKBB`: `category_evidence_missing`
  - `B0CTBQCKL9`: `category_evidence_missing`
  - `B01E2EYG4U`: `aliexpress_category_evidence_split`
  - `B0GFV4N3K8`: `category_evidence_missing`; also remains not eligible for edit because the current-batch row was previously missing/not claimed.
  - `B0C1JY1C7F`: `category_evidence_missing`

Decision:

- Do not expand to 10 edit-save actions from this batch yet.
- Next safe preparation step is to repair/collect only AliExpress category evidence gates for the remaining candidates, then rerun `dxm-batch-pipeline plan`.
- No collection, reclaim, edit save, final publish, one-click publish, or Product Development draft action was executed during this preparation check.

## Current Decision

- The first real small closed loop passed for `B0DXFB86J7`.
- Expansion to 10 products is still blocked by AliExpress category evidence gates for the other 9 ASINs.
- Next safe step is to continue readonly AliExpress evidence capture/import for the remaining claimed products, then rerun `dxm-batch-pipeline plan`.
- Do not proceed to broader edit/save until those ASINs pass price and category evidence hard gates.

## Continuation - More Evidence And Second Candidate Preflight

### AliExpress Evidence Continuation

Readonly AliExpress dry-runs were executed after the first closed-loop pass. No AliExpress product click, cart, order, chat, or form submit was executed.

Trusted evidence records written:

| ASIN | Status | Top AliExpress Category | Consensus | DXM Candidate Category |
|---|---|---|---:|---|
| B0DPSJP47V | `aliexpress_verified` | `postCategoryId:100007128` | 90% | `收纳架(Racks & Holders)` |
| B0FH7774VK | `aliexpress_verified` | `postCategoryId:200044148` | 82% | `收纳架(Racks & Holders)` |

Dry-run records not promoted to pass:

| ASIN | Dry-run Result | Reason |
|---|---|---|
| B01E2EYG4U | still split | refined query dropped top share to 35%; existing formal split at 48% retained |
| B0CTBQCKL9 | split | top share 37% |
| B0F1DDLKBB | split | top share 48% |
| B0CZ7F61XN | split / unmapped | top share 45%, no verified DXM mapping |
| B0DZ14L38Y | split / unmapped | top share 42%, no verified DXM mapping |
| B0C1JY1C7F | split / unmapped | top share 43%, no verified DXM mapping |
| B0GFV4N3K8 | skipped for edit flow | current-batch row remains missing / not claimed; do not recollect or reclaim without explicit authorization |

### Pipeline After More Evidence

- Report JSON: `runs/dxm-batch-pipeline-first-batch-after-more-evidence-20260702.json`
- Report Markdown: `runs/dxm-batch-pipeline-first-batch-after-more-evidence-20260702.md`
- Total ASINs: 10
- Gate ready: 3
- Blocked: 7
- Ready for edit preflight: `B0DXFB86J7`, `B0DPSJP47V`, `B0FH7774VK`
- Blockers: `category_evidence_missing=6`, `aliexpress_category_evidence_split=1`

### B0DPSJP47V Edit Preflight Attempt

- Edit id: `167487782009931619`
- Source URL readback: `https://www.amazon.com/dp/B0DPSJP47V`
- Formal price: USD `9.99` -> CNY `108.39`
- Formal evidence: `aliexpress_verified`, candidate category `收纳架(Racks & Holders)`
- Browser persistent userscript was still `2.1.4`; current page was temporarily injected with local `v2.1.6` runtime for validation.

Code findings:

- `v2.1.4` misread B0DPS as stale `B0DXFB86J7`; save was blocked.
- `v2.1.5` fixed stale ASIN priority but introduced a recursion in edit-page DOM snapshot price lookup.
- Source was advanced to `v2.1.6`:
  - DOM SKU snapshot no longer calls full strict price preflight.
  - Current edit price ASIN lookup no longer calls DOM fallback product construction.
  - Syntax check passed.

Preflight after `v2.1.6`:

- ASIN correct: `B0DPSJP47V`
- Category evidence correct: `asin-evidence-B0DPSJP47V`
- Price source correct: `amazon_price_store_displayed_price`
- Category partly succeeded after field-rule execution: `收纳架(Racks & Holders)`
- Title shortened to 72 characters.

Remaining blockers:

| Field | Status |
|---|---|
| freight template | not selected, expected `111` |
| required attributes | missing Brand, Feature, High-concerned chemical, Origin, Material |
| Ships From | United States option visible but not selected |
| price | still old visible value `67.73`, expected `108.39` |
| variation parameters | required variation attribute missing |

Result:

- `B0DPSJP47V` was not saved.
- No move to wait-to-publish was executed for `B0DPSJP47V`.
- No final publish or one-click publish was executed.
- Failure classification: edit-page field-fill control issue after category modal / variation-parameter transition, not a price/evidence gate failure.

## B0DPSJP47V Field-Control Fix And Closed Loop

### Repair Scope

- Target ASIN/SKU: `B0DPSJP47V`
- Edit id: `167487782009931619`
- Repair type: edit-page field-fill control code fix, not business-rule regeneration.
- Business rules retained: freight template `111`, Origin/Ships From United States, Brand `NONE`, price from Amazon displayed-price store formula, save only after preflight pass.
- Browser runtime used for validation: local source injected up to `DXM Automation V1 - NEW v2.1.13`.
- Persistent Tampermonkey deployment may still need overwrite; live page was validated by runtime injection.

### Code Findings And Fixes

- Category selection could write the category field but leave the category modal visible, interrupting later fields. Fixed by adding category-finalize handling that treats an already-written category as committed and hides the residual modal before continuing.
- Price writing was previously coupled to the full variation filler. Added a category-and-price-only validation entry that writes current-ASIN price from `runs/amazon-price-store.json` / browser cache and immediately reads it back.
- Freight template selection was using an imprecise field container. Added exact Ant form-item lookup by label and made selection/readback use the same `运费模板` container.
- Ships From readback now distinguishes visible United States text from an actually checked United States checkbox.
- Required attributes were validated through a standalone attributes-only entry so Brand, Feature, High-concerned chemical, Origin, and Material could be selected and read back before any save.
- Variation filler no longer fails when global Ships From is already selected but the current viewport is at the variation table.

### Batch Validation Results

| Batch | Fields | Result |
|---|---|---|
| 1 | Category finalize + price | Category `收纳架(Racks & Holders)` selected; modal count `0`; price readback `108.39` |
| 2 | Freight + Ships From | Freight template `111` selected/read back; Ships From United States checked/read back |
| 3 | Required attributes | Brand `NONE(AE存量)*******(None)`, Feature `其他(Other)`, High-concerned chemical `天然未处理(None)`, Origin `美国(Origin)(US(Origin))`, Material `PET+PE材质(PET+PE)` |
| 4 | Title + variation + final preflight | Title shortened to 72 chars; variation `allowed=true`; final preflight `pass=true`, blockers `0` |

### Business Action Executed

- Action: clicked native edit-page `保存并移入待发布` once after final preflight passed.
- Result message: `产品已移入待发布，请在「待发布」中查看！`
- Final publish: not executed.
- One-click publish: not executed.
- Product Development draft handling: not executed.
- Recollection/reclaim: not executed.

### Wait-To-Publish Readback

Authoritative readback source: `/web/smtlocalProduct/offline`

Readback row:

```text
亚马逊(美国) Paper Towel Holder Countertop, Standing Paper Roll Holder with Anti Slip 「Halo Home Store」 美国 收纳架(Racks & Holders) -- B0DPSJP47V CNY 108.39 15 创建： 2026-07-01 03:28 更新： 2026-07-01 22:48 编辑 发布 更多
```

Field checks:

| Field | Expected | Actual | Result |
|---|---|---|---|
| row present | yes | yes | pass |
| ASIN/SKU | `B0DPSJP47V` | `B0DPSJP47V` | pass |
| price | `108.39` | `108.39` | pass |
| stock | `15` | `15` | pass |
| category | `收纳架` | `收纳架(Racks & Holders)` | pass |

Readback summary:

- Total checked: 1
- Passed: 1
- Blockers: 0
- Missing rows: 0
- SKU mismatches: 0
- Price mismatches: 0
- Stock mismatches: 0
- Category mismatches: 0
