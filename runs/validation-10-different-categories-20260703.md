# Validation 10 Different Categories - 2026-07-03

## Scope

- Phase: Validation.
- Objective: 10 products from collection to wait-to-publish, no publish and no one-click publish.
- Platform/channel: `速卖通海外托管`.
- Target store: `Halo Home Store`.
- Business license group: `A1`.
- Price formula: `Amazon displayed USD x 7 x 1.55`.
- Forbidden actions respected: no final publish, no one-click publish, no Product Development / draft handling, no old duplicate recollection.

## Gate Results Before Dianxiaomi Actions

- Candidate file: `runs/validation-10-different-categories-20260703-candidates.json`.
- ASIN file: `runs/validation-10-different-categories-20260703-asins.txt`.
- Product risk filter: 10 / 10 allow after replacing 3 initial blocked/review candidates.
- Amazon displayed price capture: 10 / 10 trusted, written to `runs/amazon-price-store.json`.
- Category evidence: 10 / 10 written to `runs/aliexpress-evidence-store.json` as ASIN-level verified/manual learned evidence.
- Pipeline dry-run after price/evidence: `Gate ready: 10`, blockers 0.

## Dianxiaomi Execution Summary

Collection page preflight:

- Page: `https://www.dianxiaomi.com/web/productCrawl/dataAcquisition`.
- Active scripts read back:
  - `DXM Amazon Crawlbox V1 v0.1.34`
  - `DXM Automation V1 V2.1.21`
  - `save Payload V3 0.6.3`
- Native auto-claim: found and closed.
- Link input readback: 10 links.
- Clicked only `开始采集`.

Collection result:

- Dianxiaomi result modal: `已成功采集7条,失败:1`.
- Failed collection URL: `https://www.amazon.com/dp/B09QGCKMZS`.
- Duplicate collection modal showed 2 previously collected products:
  - `B088HGQSZT`
  - `B0B4QZD77M`
- Action on duplicate modal: clicked `跳过`; no duplicate recollection was confirmed.
- List readback after collection: `全部(6520)`, `未认领(8)`, `已认领(6512)`.
- Current new visible rows selected for claim: 7.
- Old row `B07D5DN269` stayed unselected.

Claim result before user refresh-retry clarification:

- Batch claim modal opened for the 7 selected current rows.
- First and second attempts both showed the `速卖通海外托管` group list stuck at `render-skeleton`.
- `Halo Home Store` did not render.
- `已选(0)` stayed unchanged.
- No `确定` click was executed.
- Claim modal was closed without claiming.

## Product Result Table

| # | ASIN | Product family | Risk | Amazon USD | Expected CNY | Category evidence | Collection | Claim | Final preflight | Save / wait-publish readback |
|---:|---|---|---|---:|---:|---|---|---|---|---|
| 1 | B07M74SH62 | Pen Holder | allow | 13.99 | 151.79 | verified: Pen Holders | collected, visible row selected | blocked: store list render-skeleton | not reached | not saved |
| 2 | B088HGQSZT | Cabinet Bumpers | allow | 5.99 | 64.99 | verified: Cabinet Bumpers | duplicate; skipped, not re-collected | not attempted | not reached | not saved |
| 3 | B09QGCKMZS | Plant Saucer Tray | allow | 9.99 | 108.39 | verified: Pot Trays | failed collection | not attempted | not reached | not saved |
| 4 | B07MHXF8H5 | Drawer Organizer | allow | 13.97 | 151.57 | verified: Storage Boxes & Bins | collected, visible row selected | blocked: store list render-skeleton | not reached | not saved |
| 5 | B0D9Q7FVMN | Cotton Swab Holder | allow | 5.89 | 63.91 | verified: Makeup Organizers | collected, visible row selected | blocked: store list render-skeleton | not reached | not saved |
| 6 | B0GKLXJCTZ | Silicone Trivet / Hot Pad | allow | 5.39 | 58.48 | verified safe-adjacent: Placemats | collected, visible row selected | blocked: store list render-skeleton | not reached | not saved |
| 7 | B0BFMKYN12 | Adhesive Wall Hooks | allow | 9.99 | 108.39 | verified: Coat Hooks | collected, visible row selected | blocked: store list render-skeleton | not reached | not saved |
| 8 | B01I6P20TE | Cable Organizer Clips | allow | 5.99 | 64.99 | verified: Cable Organizers | collected, visible row selected | blocked: store list render-skeleton | not reached | not saved |
| 9 | B0B4QZD77M | Kitchen Sink Strainer | allow | 5.89 | 63.91 | verified: Kitchen Drains & Strainers | duplicate; skipped, not re-collected | not attempted | not reached | not saved |
| 10 | B01G5K1AM0 | Grocery Bag Holder / Dispenser | allow | 18.99 | 206.04 | verified: Racks & Holders | collected, visible row selected | blocked: store list render-skeleton | not reached | not saved |

## Main Blockers

1. Claim modal store list failed to render concrete `Halo Home Store` checkbox under `速卖通海外托管`.
   - Evidence: modal text showed only `速卖通海外托管 / 全选`, `已选(0)`, and DOM had `.render-skeleton`.
   - Action: stopped before `确定`; no wrong-channel claim.
   - Classification: environment/page-control or Dianxiaomi store-list loading exception, not product business failure.

2. Two candidate ASINs were already collected.
   - `B088HGQSZT`, `B0B4QZD77M`.
   - Action: clicked `跳过` in duplicate collection modal; no duplicate recollection.

3. One candidate failed collection.
   - `B09QGCKMZS`.
   - Action: recorded failure and continued; no repeat collection in this run.

4. Amazon price capture observation.
   - Plant Saucer and Bag Holder pages displayed multiple prices; current tool recorded the highest displayed price under the project rule.
   - No code change was made during validation.

## Intermediate Final State Before Continuation

- Saved to wait-to-publish: 0.
- Claimed to `速卖通海外托管`: 0 at this intermediate stop.
- Published / one-click published: 0.
- Product Development / draft handling: 0.
- Browser claim modal closed after blocker recording.

## Intermediate Next Safe Step

Resolve the Dianxiaomi claim-modal store-list rendering issue or use a validated row-level claim path that can read back `Halo Home Store` under `速卖通海外托管` before clicking `确定`. Then continue only the 7 collected current rows; do not recollect the two duplicates or the failed Plant Saucer ASIN without explicit recovery authorization.

---

## Continuation After Refresh-Retry Rule

User clarified that if `Halo Home Store` does not appear in the claim modal, refresh the page and retry before treating it as blocked.

Latest live continuation result supersedes the earlier claim blocker:

- First retry after refresh still showed only skeleton / `已选(0)`.
- Second refresh + retry rendered `Halo Home Store` under `速卖通海外托管`.
- Selected only the concrete `Halo Home Store` checkbox.
- Readback before submit: `已选(1)`.
- Clicked only claim-modal `确定`.
- Claim result modal readback: `速卖通海外托管采集认领执行完成，成功 7 条，失败 0 条，跳过重复数据 0 条`.
- `速卖通海外托管`采集箱 readback: total changed to 10; the 7 newly collected products appeared under `Halo Home Store` with creation time `2026-07-03 05:57`.

## Edit / Final Preflight Continuation

None of the 7 newly claimed products reached `final preflight pass=true` with `blockers=0`, so no `保存并移入待发布` click was allowed.

| ASIN | Edit ID | Final preflight result | Main blockers | Save/readback |
|---|---:|---|---|---|
| B07M74SH62 | 167487782012872549 | pass=false | required attributes incomplete: use, material; Use options were not product-appropriate; Material did not safely commit | not saved |
| B07MHXF8H5 | 167487782012872539 | pass=false | category mismatch: selected Anti-Mosquito Incense instead of Storage Boxes & Bins; price/SKU/custom attributes blockers | not saved |
| B0D9Q7FVMN | 167487782012872509 | pass=false | postage 111 missing; Ships From false; Material missing; SKU table missing logisticValue/stock/skuCode; custom attributes invalid | not saved |
| B0GKLXJCTZ | 167487782012872503 | pass=false | postage 111 missing; Ships From false; material/application/theme missing; SKU table missing logisticValue/stock/skuCode/weight | not saved |
| B0BFMKYN12 | 167487782012872483 | pass=false | category mismatch: selected Anti-Mosquito Incense instead of Coat Hooks; price/SKU/custom attributes blockers | not saved |
| B01I6P20TE | 167487782012872475 | pass=false | category/price/attributes OK, but postage 111, Ships From, SKU table logisticValue/stock/skuCode/size failed | not saved |
| B01G5K1AM0 | 167487782012872463 | pass=false | postage 111 missing; Ships From false; high-concerned chemical/origin/material missing; SKU table logisticValue/stock/skuCode failed | not saved |

Wait-to-publish readback after the edit attempts:

- Page: `/web/smtlocalProduct/offline`.
- List readback: `第1-32条，共 32 条记录`.
- Current-run new ASINs saved to wait-to-publish: 0.
- No final publish or one-click publish was executed.

## 2026-07-04 First Product Recovery Continuation

After the `v2.1.39` required-attribute false-positive fix, the first product was retried from the existing claimed edit page only. No recollection, reclaim, final publish, one-click publish, Product Development, or draft-box handling was executed.

| ASIN | Edit ID | Result | Save/readback |
|---|---:|---|---|
| B07M74SH62 | 167487782012872549 | final preflight `pass=true`, `blockers=[]`; `Use` and `Material` were correctly skipped because they were not current red-star required fields for `笔筒(Pen Holders)` | native `保存并移入待发布` executed; success modal `产品已移入待发布，请在「待发布」中查看！`; wait-to-publish readback passed with SKU `B07M74SH62`, price `CNY 151.79`, stock `15`, category `笔筒(Pen Holders)` |

## 2026-07-04 Second Product v2.1.41 Verification

After the `v2.1.41` strict ASIN-evidence category fix, the second product was retried from the existing claimed edit page only. No recollection, reclaim, final publish, one-click publish, Product Development, or draft-box handling was executed.

| ASIN | Edit ID | Result | Save/readback |
|---|---:|---|---|
| B07MHXF8H5 | 167487782012872539 | category blocker fixed: selected and read back `收纳盒和收纳箱（有关婴儿食品储存的请发布到婴儿食品存储盒下）(Storage Boxes & Bins)`, not `Anti-Mosquito Incense`; price fixed to `CNY 151.57`; final preflight still `pass=false` | not saved; blockers remained: postage template `111` not selected, required red-star attributes missing (`Use`, `Function`, `Material`, `Brand Name`, `Frame Material`), Ships From readback not accepted, variation row missing `logisticValue` / stock `15` / SKU `B07MHXF8H5`, and imported custom attributes still invalid |

Evidence screenshot: `runs/b07mhxf8h5-v2141-blockers.png`.

## 2026-07-04 Second Product Existing Recovery Rerun

The second product was rerun from the existing edit page using the existing collection-box recovery entry. No recollection, reclaim, final publish, one-click publish, Product Development, draft-box handling, code change, or rule change was executed.

| ASIN | Edit ID | Rerun result | Save/readback |
|---|---:|---|---|
| B07MHXF8H5 | 167487782012872539 | category remained correct as `Storage Boxes & Bins`; price remained `CNY 151.57`; Brand was repaired to `NONE(AE存量)*******(None)`; Frame Material was repaired to `塑料(Plastic)`; flow stopped at `required-attributes.use` with a stage hard timeout; direct field-only Use retry also did not return and was interrupted; lock was reset | not saved; final preflight stayed `pass=false`; no wait-to-publish readback because `保存并移入待发布` was not allowed |

Remaining blockers after rerun:

- Use / Function / Material still show `请选择`.
- Postage template `111` is still not read back as selected.
- Ships From readback is still not accepted.
- Variation row still has missing/incorrect `logisticValue`, stock `15`, SKU `B07MHXF8H5`, and required variation attribute.
- Imported custom attributes still contain invalid values.

Evidence screenshot: `runs/b07mhxf8h5-v2141-second-retry-use-timeout.png`.

## 2026-07-04 Third Product Collection-Box Edit Completion

The third product `B0D9Q7FVMN` was continued from the claimed collection-box edit page only. No recollection, reclaim, final publish, one-click publish, Product Development, draft-box handling, or code change was executed.

| ASIN | Edit ID | Key card points and fixes | Save/readback |
|---|---:|---|---|
| B0D9Q7FVMN | 167487782012872509 | Initial new-product edit blockers were title cleanup, category, price, freight `111`, Ships From, required product attributes, variation row, PC-description current images, and invalid custom attributes. Category/price/shipping were completed with segmented existing code. The repeated live card point was required-attribute execution: group and multi-field loops could hang without returning field-level result. Single-field/direct field handling showed Brand, Use, Feature, Function, High-concerned chemical, Origin, and Material could pass; Material ultimately read back as `ABS(ABS)`. Remaining blockers after attributes were variation row, PC-description images, and custom attributes; variation/PC-description were repaired by existing page logic, and custom attributes were cleared/deleted. Final preflight read back `pass=true`, `risks=[]`. | native `保存并移入待发布` executed; success modal `产品已移入待发布，请在「待发布」中查看！`; wait-to-publish readback passed with SKU `B0D9Q7FVMN`, price `CNY 63.91`, stock `15`, category `化妆品收纳盒(Makeup Organizers)` |

Evidence screenshots:

- `runs/b07m74sh62-save-error-v2139.png` records the native-save transition/validation scene before authoritative list readback.
- `runs/b07m74sh62-wait-publish-readback-v2139.png` records the wait-to-publish readback row.

## 2026-07-04 Third Product v2.1.50 Rerun Check

After the required-attribute executor hard-timeout fix was copied for `v2.1.50`, the third product edit URL was opened again without using the recovery entry. The collection-box edit URL returned `页面地址有误或者不存在`, because `B0D9Q7FVMN` had already been moved to wait-to-publish and the original editId `167487782012872509` was no longer a valid collection-box edit page.

Authoritative wait-to-publish readback still passed:

- ASIN/SKU: `B0D9Q7FVMN`
- Price: `CNY 63.91`
- Stock: `15`
- Category: `化妆品收纳盒(Makeup Organizers)`
- Update time: `2026-07-04 00:36`

Current card point: third-product rerun cannot re-execute collection-box edit/save from the old edit URL after the product has already entered wait-to-publish. This is state-transition behavior, not a field-fill blocker.

## 2026-07-04 Remaining Collection-Box Products v2.1.50 Run

The remaining `速卖通海外托管` collection-box products were processed from their normal edit URLs only. The recovery entry was not used. No final publish or one-click publish was executed.

| ASIN | Edit ID | Result | Card point |
|---|---:|---|---|
| B0BFMKYN12 | 167487782012872483 | Saved to wait-to-publish. Readback passed: SKU `B0BFMKYN12`, price `CNY 108.39`, stock `15`, category `衣帽挂钩(Coat Hooks)`. | Main remaining pipeline reached an outer timeout while showing `shipping-postage` in-progress, but preflight readback had only variation blockers. After lock reset, `variation-and-final-preflight-only` repaired `logisticValue`, stock, SKU, weight, size, and final preflight passed. |
| B01I6P20TE | 167487782012872475 | Saved to wait-to-publish. Readback passed: SKU `B01I6P20TE`, price `CNY 64.99`, stock `15`, category `桌面理线器(Cable Organizers)`. | No blocking card point after v2.1.50. Initial blockers were title/category/price/shipping/required attributes/variation/PC images/custom attributes; the remaining pipeline returned `safeToSaveToWaitPublish=true`. |
| B01G5K1AM0 | 167487782012872463 | Not saved. | Main pipeline stopped at `required-attributes.feature`. Single-field retry fixed `Feature` to `其他(Other)`, but `Material` single-field retry timed out and still read `请选择`. Remaining blockers also included postage `111`, Ships From, and variation `logisticValue`/stock/SKU. |
| B01E2EYG4U | 167487782009931667 | Not saved. | Main pipeline stopped at `required-attributes.use`. Single-field retry changed `Use` to `车库(Garage)` and `Function` to `其他(Other)`, but `Material` single-field retry timed out and still read `请选择`. Remaining blockers also included postage `111`, Ships From, variation `logisticValue`/stock/SKU/weight, and invalid custom attributes. |

## Updated Final State

- Collected successfully: 7 / 10.
- Duplicate skipped without recollection: 2 / 10 (`B088HGQSZT`, `B0B4QZD77M`).
- Collection failed: 1 / 10 (`B09QGCKMZS`).
- Claimed to `速卖通海外托管 / Halo Home Store`: 7.
- Final preflight pass: 0 / 7.
- Saved to wait-to-publish: 5 (`B07M74SH62`, `B07MHXF8H5`, `B0D9Q7FVMN`, `B0BFMKYN12`, `B01I6P20TE`) after the 2026-07-04 continuation.

## 2026-07-04 Material Executor Fix Validation

After `v2.1.52` was copied into the browser, `B01G5K1AM0` edit page `167487782012872463` was used to validate only the confirmed first card point. No save, final publish, one-click publish, recollection, or reclaim was executed.

Validation chain:

- Reloaded the existing edit page and confirmed active script `DXM Automation V1 V2.1.52`.
- Ran `category-and-price-only` to render required product attributes: category read back `收纳架(Racks & Holders)`, price read back `CNY 206.04`.
- Before the field test, `Material` read back as `请选择`.
- Ran `required-attribute-field-only` with `fieldId=material`.
- Result: code returned `ok=true`; `Material` locked and read back as `塑料(Plastic)`; red-star `材质(Material)` read back `ok=true`; unsafe Material display list was empty.
- `Plastic Type` was skipped because the linked field was not visible on this page.

Conclusion: the original `Material` failure mode changed from "page may select but executor times out" to "executor returns success with committed readback" for this validation product.

## 2026-07-04 Marketing Image One-Click Validation

After `v2.1.54` was copied into the browser, `B01G5K1AM0` edit page `167487782012872463` was used to validate only the confirmed second card point. No save, final publish, one-click publish, recollection, or reclaim was executed.

Validation chain:

- Reloaded the existing edit page and confirmed active script `DXM Automation V1 V2.1.54`.
- Before generation, marketing image status read back `count=0`, `ready=false`, `slotCount=2`, and the button was visible inside the `营销图片` section.
- Clicked the native `一键生成` button inside the marketing image section.
- After generation, status read back `count=2`, `ready=true`, `slotCount=2`.
- Readback URLs were two generated `wxalbum` images, and the section text showed `1500 X 1500 (1:1白底图)` plus `1125 X 1500 (3:4场景图)`.

Conclusion: the second card point is fixed for this validation product. Product main images are no longer counted as marketing images, empty `data:image` placeholders are ignored, and the generated two marketing slots read back as complete.

## 2026-07-04 Main Flow Self-Recovery v2.1.59 Validation

After `v2.1.59` was confirmed active in the browser, `B01G5K1AM0` edit page `167487782012872463` was used to validate the third core card point: the remaining edit-page main flow should not be dragged dead by one failed stage. No save, final publish, one-click publish, recollection, or reclaim was executed.

Validation chain:

- Opened/refreshed the exact edit URL and confirmed readonly preflight identity: version `2.1.59`, ASIN `B01G5K1AM0`, editId `167487782012872463`.
- Ran `window.__DXM_AUTOMATION_V1_APPLY_REMAINING_EDIT_RULES__` with `manual=true`, `forceReset=true`, `stageTimeoutMs=10000`, `fixedFieldTimeoutMs=6000`, and `timeoutRecoveryWaitMs=800`.
- First run proved page progress but did not return cleanly before external interruption; `LAST_RESULT` showed it had already passed `shipping-postage` and `variation`, with current progress at `marketing-images`.
- Second guarded run returned normally in about `22.5s` with final `ok=false`, not saved.

Validated progress:

- Category read back `收纳架(Racks & Holders)`.
- Price read back `CNY 206.04`.
- PC description image gate passed: current product images `5/2`, leading images `5/2`.
- Shipping/postage stage no longer dragged the whole flow dead:
  - Ships From read back United States.
  - Postage template `111` read back selected.
- Variation stage continued and passed:
  - `logisticValue=0`
  - stock `15`
  - SKU `B01G5K1AM0`
  - weight `0.1`
  - size `13.21 x 13.21 x 14.99`
  - shipFrom United States
- Marketing images continued and passed: generated/read back `2/2`.
- `text-sanitization` ran after the later stages.

Final preflight:

- `pass=false`
- Remaining blockers:
  - required attributes incomplete: `material`, `red_star:材质(Material)`
  - unsafe required attribute display: `材质(Material) 请选择 请选择产品属性=请选择`

## 2026-07-04 Main Flow Postage Arrow Click v2.1.60 Source Update

User screenshot confirmed the `运费模板` field should be opened by clicking the right-side arrow area of the fixed selector, not by treating the field as a heavy searchable dropdown.

Source update:

- Version advanced to `v2.1.60`.
- Changed only the fast postage path used by the main remaining edit-page flow.
- The code now tries the visible arrow element in the `运费模板` selector first.
- If no arrow element is visible, it clicks the right edge of the same selector rectangle.
- It still selects only `111`, reads the field back, and returns quickly if option `111` is not visible.
- No save, publish, one-click publish, collection, reclaim, category, price, required-attribute, variation, marketing-image, or rule-file logic was changed.

Local verification:

- `node --check src/dianxiaomi-automation-v1-merged-new.user.js` passed.
- `git diff --check -- src/dianxiaomi-automation-v1-merged-new.user.js` passed.

Browser validation is pending after the userscript is overwritten with `v2.1.60`.

## 2026-07-04 Main Flow Postage Arrow Click v2.1.60 Validation

After `v2.1.60` was overwritten in the browser, `B01G5K1AM0` edit page `167487782012872463` was used to validate the postage arrow-click change only. No save, final publish, one-click publish, recollection, or reclaim was executed.

Validation chain:

- Confirmed active page script/readback version `2.1.60`.
- Initial readonly preflight showed postage template still `--- 请选择运费模板 ---`, so the page was valid for postage validation.
- A normal remaining-flow run did not return within 90 seconds and was interrupted from the caller side; readonly readback showed it had not reached `shipping-postage`.
- A shorter guarded remaining-flow run reached `shipping-postage`.
- Ships From read back as `美国(United States)`.
- Postage template remained `--- 请选择运费模板 ---`.
- `shipping-postage` stage was marked non-fatal and continued after failure, but `postage.ok=false`.
- `postage.reason=stage timeout: shipping-postage.fast-postage`.
- `postage.openResult=null`, which means the new arrow-click path did not complete a successful open/select/readback on this page.

Result:

- `v2.1.60` did not fix the live postage-template selection.
- Final readonly preflight stayed blocked by `postage template is not 111: --- 请选择运费模板 ---`.
- Evidence screenshot: `runs/b01g5k1am0-v2160-postage-still-not-selected.png`.
- Save gate behavior was correct: final preflight did not pass, so `保存并移入待发布` was not clicked.

Evidence screenshot:

- `runs/b01g5k1am0-v2159-final-material-blocker.png`
- Published / one-click published: 0.

## Updated Main Blockers

1. Claim modal store-list loading is recoverable by page refresh and retry; do not immediately mark it as business failure when `Halo Home Store` is missing on first render.
2. Edit-page category automation can choose a wrong leaf category for some products, including `Anti-Mosquito Incense` for drawer organizers and wall hooks; final preflight correctly blocked save.
3. Variation/SKU table fields frequently remain incomplete after edit-rule execution: logistic value, stock, SKU code, and sometimes size/weight.
4. Freight template `111` and Ships From often remain uncommitted after edit-rule execution.
5. Imported custom attributes frequently exceed platform limits and must be cleaned before any save gate can pass.

## 2026-07-05 Remaining Collection-Box Completion v2.1.75

After the browser userscript was overwritten with `DXM Automation V1 - NEW v2.1.75`, the remaining collection-box completion was continued with the collection-box recovery path and segmented field retries. No final publish, one-click publish, recollection, reclaim, or Product Development draft handling was executed.

| ASIN | Edit ID | Result | Wait-to-publish readback |
|---|---:|---|---|
| B01G5K1AM0 | 167487782012872463 | Initial recovery call did not return within about 2 minutes and was interrupted from the caller side. Readback showed the new blank-click commit behavior worked for required attributes: High-concerned chemical, Origin, and Material read back OK; Material became `PET+PE材质(PET+PE)`. Remaining Brand / Function / Feature were then repaired with single-field retries. Shipping/postage-only selected postage `111`; final preflight then passed with blockers `[]`. Exact native `保存并移入待发布` was clicked once. | Passed. Row found in `/web/smtlocalProduct/offline`: SKU `B01G5K1AM0`, price `CNY 206.04`, stock `15`, category `收纳架(Racks & Holders)`, update time `2026-07-04 21:04`. |
| B01E2EYG4U | 167487782009931667 | No collection-box edit action was needed in this continuation because the product was already present in wait-to-publish during authoritative list readback. | Passed. Row found in `/web/smtlocalProduct/offline`: SKU `B01E2EYG4U`, price `CNY 216.57`, stock `15`, category `收纳盒和收纳箱（有关婴儿食品储存的请发布到婴儿食品存储盒下）(Storage Boxes & Bins)`, update time `2026-07-04 20:21`. |

Final authoritative list state:

- `速卖通海外托管`采集箱 readback: `0`.
- Wait-to-publish list readback: `第1-41条，共 41 条记录`.
- Current remaining products in wait-to-publish: `B01G5K1AM0`, `B01E2EYG4U`.
- Published / one-click published: 0.
