# Skill Name: dxm-three-step-product-edit

Authoritative exception rules: `docs/exception-rules.md`. This skill must not expand business scope when WebBridge / tab-control fails; use direct edit URLs and authoritative list readback instead.

## Input
- `asin`
- `editId` or `editUrl`
- `amazonOriginalUsd`
- `productFamily`
- `targetStore`: `Halo Home Store`
- `verifiedCategoryRule`:
  - `status`
  - `categoryPath`
  - `visibleSearchTerms`
- `maxAttemptsPerBlocker`: `3`

## Process
1. Confirm:
   - open `/web/smtlocalProduct/edit?id=<editId>` in a fresh tab;
   - verify store is `Halo Home Store`;
   - read current category, title, required attributes, variation options, freight template, price, stock, SKU, PC description, and visible validation errors;
   - before treating any product attribute or variation parameter as a blocker, verify that the field has a visible red `*` or that native save explicitly reports that exact field as required;
   - classify one root blocker before editing.
2. Fix:
   - apply only the minimum action for the current root blocker;
   - use a verified category rule only when the product family matches the rule scope;
   - for category modal result rows, use a real double click on the exact result item and then verify category writeback;
   - for freight template `111`, open the dropdown, clear the search text first, read the full list, then choose exact `111`;
   - for custom attributes, delete invalid rows until no row-level error remains; do not only clear input values;
   - set price from `amazonOriginalUsd x 7 x 1.55`, stock `15`, and SKU `asin`.
3. Verify:
   - after each fix, read back the exact field that was changed;
   - before save, require category selected, required attributes complete, freight `111`, Ships From `United States`, expected CNY price, stock `15`, SKU ASIN, PC description >= 500 chars, and no visible validation error;
   - click only `保存并移入待发布`;
   - confirm success either by `产品已移入待发布` modal or `/web/smtlocalProduct/offline` readback.
4. Stop:
   - after 3 failed fix attempts for the same blocker, record field-level failure and continue to the next product;
   - do not perform a fourth manual correction for the same blocker during the batch.
5. Cleanup:
   - after each product is saved, skipped, or blocked, close that product's edit tab;
   - keep only the current required list/tab open for continuation;
   - do not leave completed edit pages open during batch execution.

## Output
- `status`: `saved_to_wait_publish | skipped | blocked_by_script_install`
- `asin`
- `completedFields[]`
- `failedField`
- `failureReason`
- `attemptsUsed`
- `nextAction`

## Rules
- Never click `发布`, `一键发布`, or `采集并一键发布`.
- Never save with an unresolved category or mismatched visible category.
- Variation-parameter priority:
  - first check whether the variation field has a visible red `*` or a native save error naming that field;
  - if `Color`, `Number of Pcs`, or `Size` has no red `*` and no native save error, leave it blank and never record it as a blocker;
  - only for required variation fields, never choose an inaccurate value to force a save;
  - example: a required `200 Pcs` field must not be saved with `156 Pcs` if no exact/custom `200 Pcs` option exists.
- Do not treat category-blank cascades as separate price, freight, and attribute failures.
- If the installed edit-page script version is older than the project source version needed for the fix, stop live business execution and activate the new script before continuing.
- Unknown product families must run AliExpress/similar-product category evidence before DXM category selection.
- Before DXM category search, require a category evidence object with `aliexpressEvidenceStatus`, `evidenceSource`, `aliexpressCandidateCategories`, and `dxmSearchTerms`.
- If the category evidence object is missing, stop the category step for this product as `category_evidence_missing` / `needs_aliexpress_category_verification`; do not search DXM and do not record `dxm_visible_category_not_found`.
- If AliExpress evidence is clear, search the DXM category modal with the most specific Chinese noun first, then one broader Chinese noun, then one English noun or related category noun. Choose the exact visible leaf when present; if no exact leaf exists, choose a safe adjacent visible category only when it matches the same product use/form and is less likely to be wrong than other visible alternatives. Stop after 3 searches when no safe visible category appears and record `dxm_visible_category_not_found`.
- `dxm_visible_category_not_found` is legal only after clear AliExpress evidence or a matching success-verified learned rule.
- Category result writeback must be verified after the exact row is selected. If CDP double-click fails, dispatch `mousedown`, `mouseup`, `click`, and `dblclick` on the exact `.search-result-item` row, then read back the full category path.
- If a category modal search result is visible but DOM click does not write the selected leaf back to the main form, use a real coordinate double-click on the `.search-result-item` row and verify the main form category before continuing.
- Ordinary text/number fields can be typed according to their field rules. Native Ant dropdown fields are different: their input is only a search/filter box and is not the selected value.
- Red-star product attribute dropdowns must use the real-selection flow: close stale dropdowns, open the target dropdown, read visible options, click a real option object, and verify a selected label/item.
- For Function / Use / Feature, choose directly from Dianxiaomi's recommended visible options first. Do not type/search by default; search/filter only if no safe recommended option is visible.
- For dynamic product attributes such as `Function`, `Use`, and `Feature`, do not press Enter/Tab after clicking a real option. These fields can display a backend option ID instead of the label when keyboard-confirmed.
- For generic required dropdowns such as `Feature`, `Function`, and `Use`, do not chase perfect semantics. Prefer exact obvious visible options, then safe common options when supported by product evidence, then `Other/其他` as a legal fallback. If `Other/其他` commits successfully, continue the product instead of blocking.
- Reject only obviously wrong visible options, for example `Adjustable Size` for fixed-size jars, `Waterproof` without water-resistant evidence, or teapot/cup-only features for non-teapot/non-cup products.
- If searching an intended value makes a required dropdown show `暂无数据`, clear/delete the search text and read the Dianxiaomi recommended options before failing the field. Select the safest real recommended option when it is not obviously wrong.
- If a red-star product attribute dropdown opens but renders no visible `.ant-select-item-option` after clearing stale overlays, clearing search text, and re-reading recommended options, record `product_attribute_dropdown_selection_failed`; do not save and do not keep retrying the same field.
- If a required dropdown displays a numeric/internal ID after selection, clear the field and reselect once using click-only commit. If the field/search path shows `暂无数据`, clear the search text and try the recommended options before classifying failure.
- `Frame Material` must be handled as a material field: use Amazon evidence first, prefer metal/steel/iron/alloy for metal mesh drawer organizers, then `Other/其他` only if no better real option exists.
- `Function` must be handled as a function/use field: prefer storage/organizer/office/home when those real options exist, then `Other/其他` only if no better real option exists.
- When native save reports required attributes after script preflight passes, locate exact field names before repair. Use exact product evidence first, then `Other/其他` only for generic fields such as `Function`, `Feature`, `Use`, or `Specification`.
- Native `请选择产品属性` feedback overrides script preflight. Do not save again until the named product attribute is repaired with a real dropdown option and the error text disappears.
- Native save can expose required category-specific checkbox groups after page/script preflight, especially after choosing a safe adjacent category. Locate the exact field names from the native error parent, choose real checkbox/radio options, read back the checked state, then retry preflight/save once.
- For Placemats / table-linen safe-adjacent products, native required fields observed include `Theme` and `Product application scenarios`; use `其他(Other)` for Theme and product-evidence scenarios such as `厨房(Kitchen)` / `餐桌用(Dining table)` for silicone kitchen mats.
- If a required dropdown still reports `请选择产品属性` after 3 focused attempts, record `product_attribute_dropdown_selection_failed` with field names and continue to the next product.
- For cotton-swab / qtip holders under Makeup Organizers, observed native-required fields include `Use`, `Function`, `Feature`, High-concerned chemical, Origin, and Material. If `Use` or `Feature` is missed by script preflight, repair with real visible options such as `其他(others)` and `其他(Other)`. Use BPA-free only with explicit BPA-free evidence; do not use `Adjustable Size` for a fixed jar.
- If script preflight reports a required field that is not visible on the page and native save succeeds, record it as `script_conservative_invisible_field` instead of blocking the product.
- Always use `/web/smtlocalProduct/offline` authoritative readback after a recovery batch. Platform list state overrides the agent's edit-tab operation log.
- Close completed/failed edit tabs immediately after recording the result; do not accumulate old edit pages.

## Learned Category Rules
- `plant saucer tray`:
  - Input evidence: AliExpress / DXM product noun indicates plant saucer, plant tray, pot tray.
  - Process: search DXM `花盆托盘`.
  - Output category: `家居用品(Home & Garden) > 园艺用品(Garden Supplies) > 花盆/种植配件(Gardening Pots, Planters & Accessories) > 花盆托盘(Pot Trays)`.
- `refrigerator organizer bins`:
  - Input evidence: refrigerator organizer, pantry/fridge bins, kitchen food storage.
  - Process: search DXM `冰箱收纳盒`, then `食品储存容器`, then `保鲜盒`.
  - Output category: `家居用品(Home & Garden) > 厨房吧台用品(Kitchen,Dining & Bar) > 餐具(Tableware) > 食品保鲜盒(Food Storage Container)`.
- `makeup brush holder`:
  - Input evidence: makeup brush holder/storage, cosmetic organizer.
  - Process: search DXM `化妆刷收纳`.
  - Output category: `美容健康(Beauty & Health) > 彩妆(Makeup) > 化妆刷和工具(Makeup Brushes & Tools) > 化妆刷收纳(Makeup Brush Storage)`.
- `cotton swab holder`:
  - Input evidence: cotton swab/cotton ball/qtip bathroom cosmetic storage.
  - Process: search DXM `化妆品收纳盒` / `Makeup Organizers` before `棉签盒`.
  - Output category: `家居用品(Home & Garden) > 家用储存收藏用具(Home Storage & Organization) > 浴室收纳(非五金材质，非打孔安装）(Bathroom Storage & Organization) > 化妆品收纳盒(Makeup Organizers)`.
  - Save caveat: this category may expose required `Use`, `Function`, and `Feature` dropdowns. Select real page options such as `Other/其他`; do not treat dropdown search text as completion. Stop after 3 attempts if native errors persist.
- `toilet paper holder stand`:
  - Input evidence: toilet paper holder, bathroom paper holder, toilet roll stand.
  - Process: search DXM `卫生纸架`, then `纸巾架`.
  - Output category: `家装（硬装）(Home Improvement) > 卫浴设施(Bathroom Fixture) > 卫浴五金件(Bathroom Hardware) > 纸巾架(Paper Holders)`.
- `laundry lint catcher`:
  - Input evidence: laundry lint catcher, washer lint filter ball, pet hair remover laundry ball.
  - Process: search DXM `洗衣球`.
  - Output category: `家居用品(Home & Garden) > 家居日用品(Household Merchandises) > 洗衣产品(Laundry Products) > 洗衣球,洗衣片(Laundry Balls & Discs)`.
- `desk drawer organizer`:
  - Input evidence: desk/drawer organizer tray, office/stationery/cosmetic storage.
  - Process: search DXM `收纳盒和收纳箱` / `Storage Boxes & Bins` before broad `收纳盒`.
  - Output category: `家居用品(Home & Garden) > 家用储存收藏用具(Home Storage & Organization) > 收纳盒和收纳箱(Storage Boxes & Bins)` when no office-specific path is visible.
  - Search caveat: search exact `收纳盒和收纳箱` / `Storage Boxes & Bins` before broad `收纳盒`; broad search can select the wrong `电池收纳盒(Battery Storage Boxes)` leaf.
  - Save caveat: this category may expose required `Frame Material`, `Function`, and `Material` dropdowns. `Frame Material` must use real metal/steel/iron/alloy/Other option selection; `Function` must use real storage/organizer/office/Other option selection. Typed-only values are invalid. If options do not render, skip after 3 focused attempts.
- `cotton swab holder`:
  - Search caveat: search exact `化妆品收纳盒` / `Makeup Organizers` before `棉签盒`; `棉签盒` may not expose the visible DXM leaf even when the learned category is valid.
  - Save caveat: this category may expose required `Use`, `Function`, `Feature`, `Material`, `High-concerned chemical`, and `Origin`. Required dropdowns must render and commit real options; dropdown search text such as `Other` is not a selected value until a real option is clicked and read back.
  - Feature caveat: if visible, `无BPA塑料(Bpa-free plastic)` is a good exact/safe option for acrylic/plastic qtip jars. If it does not commit quickly and `其他(Other)` is visible, choose `其他(Other)` and continue. Do not use `可调节尺寸(Adjustable Size)` unless the product is actually adjustable.
- `silicone trivet / pot holder`:
  - AliExpress evidence observed: `硅胶隔热垫`, `耐热锅垫`, `hot pads`, `pot holders`, `trivet mats`, `coaster`, and `placemat`.
  - DXM search terms tried: `隔热垫`, `锅垫`, `杯垫`, `餐垫`, `Pot Holders`, `Trivet`.
  - Legal outcome: if no exact hot-pad / pot-holder / trivet-mat leaf appears, choose safe adjacent `餐垫(Placemats)` for flat silicone heat-resistant mats/pot holders; avoid `杯垫(Coaster)` unless the product is cup-only and avoid `茶壶底座(Teapot Trivets)` unless it is teapot-only. Record the decision as `safe_adjacent_dxm_category_selected`.
  - Save caveat: `餐垫(Placemats)` may expose required checkbox groups not covered by generic Ant-select logic. For B0DFPHVNHG, native save required `Theme=其他(Other)` and `Product application scenarios=厨房(Kitchen)+餐桌用(Dining table)`. Material had no Silicone option, so the safest real checkbox option was `其他 (自行填写)(Other)`.

## Efficiency Notes
- Highest-time-cost blocker: repeated manual DOM/WebBridge field recovery after the edit-page script stops at category.
- Automation replacement:
  - the edit-page script must continue the pipeline when a verified category is already selected;
  - source price must prioritize the current task/localStorage value over stale panel values;
  - custom attribute cleanup must delete rows, not only empty inputs.
- Cache reusable category paths per product family after wait-to-publish readback.
- Use one batched readback per product before save instead of many single-field reads.
- Cache AliExpress evidence result plus DXM search term per product family in the batch, so the next same-family product does not reopen AliExpress.
- Prefer fresh direct edit URL tabs over `find_tab` when many old `/edit?id=` tabs exist; `find_tab` can match older edit pages.
- Treat native dropdown repair as the highest-cost live step. Future automation should select actual dropdown option objects, not only type text into Ant inputs.
