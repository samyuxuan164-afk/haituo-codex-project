# CHANGELOG

## 2026-07-04 - Main Plugin v2.1.48

### Fixed

- Collection-box recovery now has a dedicated fast exact selector for the fixed `High-concerned chemical` field.
- The fixed value remains only `天然未处理(None)`.
- If the fast exact selector cannot commit the field and time remains, the flow falls back to the existing Ant multi-select exact logic.
- No Use, category, price, variation, description, marketing image, save, publish, one-click publish, collection, reclaim, or Product Development draft logic was changed.

### Verified

- Local `node --check`, `git diff --check`, and targeted assertions passed.
- No browser edit/save/move-to-wait-publish/final publish/one-click publish action was executed during this source update.

## 2026-07-04 - Main Plugin v2.1.44

### Fixed

- PC description image readback now waits for CKEditor / hidden detail fields to finish applying after the image-first description is written.
- This prevents the remaining edit-page / recovery flow from falsely stopping at `pc-description-images` immediately after a successful write.

### Verified

- Local `node --check`, `git diff --check`, and targeted assertions passed.
- Live validation used wait-to-publish product `B0GKLXJCTZ` / editId `167487782012872503` because the original collection-box products had already been moved to wait-to-publish.
- Browser-loaded script was verified as `v2.1.43`, then local `v2.1.44` was injected only for validation.
- The remaining edit-page flow completed with `ok=true`, PC description product images `5/2`, marketing images readable, and `risks=[]`.
- No save, final publish, one-click publish, collection, reclaim, or Product Development draft handling was executed. The two validation browser pages were closed.
- Latest `v2.1.44` was copied to clipboard for userscript-manager overwrite.

## 2026-07-04 - Main Plugin v2.1.43

### Fixed

- Collection-box recovery / remaining edit-page flow now treats PC description images and marketing images as save-blocking quality gates.
- PC description generation now prefers current product main images from edit data before falling back to visible page images, preventing text-only descriptions when product images are available.
- The recovery flow stops at `pc-description-images` when the rewritten PC description is not image-first with current product images.
- The recovery flow now includes a bounded `marketing-images` stage that clicks the visible `一键生成` control when marketing images are missing.
- Marketing-image readback now waits for async generation and chooses a marketing section that actually contains images, avoiding false `0/2` results immediately after generation.

### Verified

- Local `node --check`, `git diff --check`, and targeted assertions passed.
- Live validation used a wait-to-publish product only for verification: `B07M74SH62` / editId `167487782012872549`.
- Initial readonly v2.1.42 preflight correctly blocked the product for `PC description missing current product images: 0/2`, `PC description image-first layout missing: 0/2`, and `marketing images incomplete: 0/2`.
- Running the remaining edit-page flow repaired PC description to image-first with current product images (`5/2`). Marketing generation clicked `一键生成`; after v2.1.43 wait/readback repair, readonly preflight passed with marketing images `2/2`, PC description images `5/2`, and `risks=[]`.
- No save, final publish, one-click publish, collection, reclaim, or Product Development draft handling was executed. The two validation browser pages were closed.

## 2026-07-04 - Main Plugin v2.1.41

### Fixed

- ASIN evidence-backed category selection now uses strict leaf-category matching in the Dianxiaomi category modal.
- Evidence-backed plans such as `Storage Boxes & Bins` no longer accept broad category text such as `Home & Garden` or `Storage Boxes` as a clickable/readback match.
- Wrong leaf categories such as `Anti-Mosquito Incense` are rejected by the strict matcher when the expected evidence leaf is `Storage Boxes & Bins`.

### Verified

- Local `node --check` passed.
- Targeted assertions passed for v2.1.41 and strict matching: the target full path, Chinese leaf, and English leaf pass; `Anti-Mosquito Incense`, top-level `Home & Garden`, and broad `Storage Boxes` fail.
- No browser action, Dianxiaomi field edit, save, move-to-wait-publish, final publish, one-click publish, collection, reclaim, Product Development draft handling, or rule-file change was executed during this source update.

## 2026-07-04 - Main Plugin v2.1.40

### Fixed

- Collection-box recovery entry field repair now handles current-page visible red-star `Material`, `Product application scenarios`, and `Theme` blockers.
- Required product-attribute checkbox/radio groups are now supported before falling back to Ant-style dropdown selection.
- `Product application scenarios` prefers `厨房(Kitchen)` and also selects `餐桌用(Dining table)` when the page exposes compatible multi-checkbox options.
- `Theme` defaults to a real visible `其他(Other)` / `Other` option.
- `Material` keeps evidence-first material selection such as `硅胶(Silicone)` and can fall back to real visible `其他(Other)` options when the category does not expose Silicone.

### Verified

- Local `node --check` and targeted assertions passed.
- Live recovery validation on `B0GKLXJCTZ` / editId `167487782012872503` passed after browser overwrite: `save:false` repaired Product application scenarios to `厨房(Kitchen)` + `餐桌用(Dining table)`, Theme to `其他(Others)`, final preflight passed, and exact `保存并移入待发布` moved the product to wait-to-publish. Wait-to-publish readback passed for SKU `B0GKLXJCTZ`, price `CNY 58.48`, stock `15`, and category `餐垫(Placemats)`. No final publish or one-click publish action was executed.

## 2026-07-04 - Main Plugin v2.1.39

### Fixed

- Final preflight now treats only current-page visible red-star product attributes as required-attribute blockers.
- `Use`, `Function`, `Feature`, `Material`, and `Frame Material` are skipped when the field is absent, hidden, or visible without a red required marker.
- Native Dianxiaomi product-attribute validation remains a blocker when the page actually reports it.

### Verified

- Local `node --check` and targeted assertions passed.
- No browser save/publish action was executed for this source update.

## 2026-07-04 - Main Plugin v2.1.38

### Fixed

- Variation parameter Ships From now enforces only `美国(United States)` / `United States`: it checks United States and clears other country checkboxes in the same parameter section.
- Variation parameter Color now runs before save whenever Color options are visible, instead of waiting for native save validation.
- Unknown or unclear Color now defaults to `多色(MULTI)`; `拼花色(Mixed Color)` is not used as the default.
- Color selection now keeps a single selected Color option when the visible control is checkbox-based.

### Verified

- Local `node --check` and targeted assertions passed.
- No browser save/publish action was executed for this source update.

## 2026-07-04 - Main Plugin v2.1.37

### Fixed

- Locked required Brand selection to the concrete Dianxiaomi option `NONE(AE存量)*******(None)` for both first-pass edit and collection-box recovery.
- Locked Origin selection/readback to `美国(Origin)(US(Origin))` and removed Mainland China / China fallback from the visible required-attribute rule.
- Kept High-concerned chemical locked to `天然未处理(None)` and kept custom attributes as clear/delete/skip by default.

### Verified

- Local `node --check` and targeted assertions passed.
- Live validation on `B0CZ7F61XN` / editId `167487782009931563` verified v2.1.37 on the exact page. The page had already reached `速卖通海外托管 > 待发布 > 编辑`; no `保存并移入待发布` button was present, so the recovery save guard stopped without clicking save or publish.

## 2026-07-03 - Main Plugin v2.1.36

### Fixed

- Variation `size` readback now uses the real table header row only, preventing row-level validation text such as `请填写包装尺寸` from overwriting the `尺寸(cm)` column index.
- Size filling now uses a dedicated three-input lookup for length / width / height.
- Variation color is skipped unless Dianxiaomi explicitly reports a required variation-attribute error.

### Verified

- Local `node --check` and targeted assertions passed.
- Live `save:false` validation reached `ready_to_save` with `afterBlockers=[]`, `safeToSaveToWaitPublish=true`, and no save/publish action.

## 2026-07-03 - Main Plugin v2.1.34

### Fixed

- Recovery now handles the B0CZ fixed required fields as bounded first-class stages: `High-concerned chemical` before `Origin`, then the generic required-attribute pass.
- Ant dropdown option lookup now reads `aria-label` / `title` from controlled listboxes and animation-stage dropdowns, covering the High-concerned chemical multi-select and Origin single-select controls.
- Generic required-attribute hard timeouts now continue when current page readback proves required attributes are already OK.

### Verified

- Local `node --check` and targeted assertions passed.
- Live `save:false` validation returned without saving or publishing; current remaining blocker is variation `size`.

### Safety

- `save` remains false by default.
- Save-to-wait-publish still requires exact text `保存并移入待发布`.
- No final publish or one-click publish behavior was added.

## 2026-07-03 - Main Plugin v2.1.21

### Fixed

- Added cooperative stage timeout handling to the collection-box recovery entry so a stuck dropdown or field returns structured `timedOut` / `stoppedAt` data instead of hanging until the external browser call timeout.
- Wired deadline checks through required-attribute dropdown selection, fixed High-concerned chemical / Origin recovery, and postage template `111` selection.
- Added hard bounded wrappers and progress readback for recovery stages so the entry returns even when a deeper page function fails to cooperate with the deadline.
- Refined required-attribute stage timeout reporting to return the first concrete missing field, for example `required-attributes.high_concerned_chemical`.

### Safety

- `save` remains false by default.
- The recovery save target remains the exact button text `保存并移入待发布`.
- No publish or one-click publish behavior was added.

## 2026-06-27 - Mac Plugin Recovery

### Fixed

- Restored Tampermonkey panel rendering on Mac after full Chrome quit/reopen.
- Added execution markers to distinguish matched scripts from executed scripts.
- Moved the Crawlbox panel default Dianxiaomi position away from the save Payload panel.
- Added root `dianxiaomi.com` match rules to Crawlbox.

### Changed

- Current Mac recovery versions: `DXM Automation V1 - NEW v1.1.42`, `DXM Amazon Crawlbox V1 v0.1.22`, `save Payload V3 v0.6.2`.

### Notes

- If Tampermonkey shows scripts as enabled but no panels render after permission/script changes, fully quit and reopen Chrome. Refresh alone can be insufficient.

## 2026-06-25 - V1 Freeze

### Added

- V1 freeze report and Mac migration documentation.
- Browser Session Incident Report for Environment Control Exception.
- Handoff document for Mac continuation.
- V2 design proposal.
- Permanent rule: browser control exceptions are not business, plugin, project, or product failures.

### Changed

- Current source of truth moved to `docs/freeze-v1-20260625/`.
- Main active version documented as `DXM Automation V1 - NEW v1.1.41`.
- Active collection version documented as `DXM Amazon Crawlbox V1 v0.1.21`.

### Paused

- 3 categories x 10 products live stability validation.
- Final publish remains disabled.

## 2026-06-25 - Main Plugin v1.1.41

### Added

- `CATEGORY_MAPPING_RULES` table.
- Pen Holders mapping limited to desk stationery / pen holder / pencil cup products.
- Guard against generic Organizer being mapped globally to Pen Holders.

## 2026-06-25 - Collection Rules

### Added

- Same product different colors are allowed as separate SKUs.
- Exact duplicate filtering requires same ASIN/link/color/size/package.
- Default target 100 and category limit 15 are configurable, not hard-coded business constants.

## 2026-06-24 - Main Plugin v1.1.37+

### Added

- Edit-page save preflight.
- Visible category selection.
- Conservative required attribute fill.
- Custom attribute cleanup/skip.
- Freight template 111 real selection and verification.
- One retry after fixable save validation errors.
