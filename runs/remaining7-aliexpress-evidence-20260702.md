# Remaining 7 AliExpress Evidence Validation - 2026-07-02

## Scope

- Phase: Validation / first-batch remaining evidence gates.
- Input ASINs: `B0CZ7F61XN`, `B0DZ14L38Y`, `B0F1DDLKBB`, `B0CTBQCKL9`, `B01E2EYG4U`, `B0GFV4N3K8`, `B0C1JY1C7F`.
- Completed closed-loop ASINs excluded from next edit pool: `B0DXFB86J7`, `B0DPSJP47V`, `B0FH7774VK`.
- Browser action type: AliExpress search-page readonly evidence capture only.
- Forbidden actions status: no final publish, no one-click publish, no Product Development draft handling, no recollection, no reclaim, no Dianxiaomi edit/save, no AliExpress product click/cart/order/chat/form submit.

## Evidence Threshold Implemented

- `>=80%` top AliExpress `postCategoryId` consensus with DXM candidate category: `aliexpress_verified`, `high_confidence`.
- `60%-79%`: conditional pass only when DXM candidate category exists, usage/form are consistent, no obvious conflict exists, and risk screen is clear. Stored as `conditional_verified`, `low_confidence`.
- `<60%`: run a semantic-consensus second pass before blocking. If titles are semantically consistent but no safe DXM category exists, store `semantic_consensus_needs_dxm_mapping`; if a safe DXM category exists, store `conditional_verified` / `semantic_low_confidence`; only true category/semantic conflict stays `evidence_split`.

Updated code and docs:

- `tools/aliexpress-evidence-capture.js`
- `tools/aliexpress-evidence-store.js`
- `tools/aliexpress-evidence-batch.js`
- `config/aliexpress-evidence.schema.json`
- `AGENT.md`
- `AGENTS.md`
- `docs/category-resolution-system.md`
- `docs/exception-rules.md`

## Readonly Dry-Run And Writeback Results

All seven remaining ASINs stayed below the 60% `postCategoryId` pass line. After semantic second-pass review, `B0CZ7F61XN` was reclassified from split to semantic-consensus mapping-needed. No new ready product was produced because it still lacks a safe DXM candidate category.

| ASIN | Query | Status | Confidence | Top Category | DXM Candidate | Decision |
|---|---|---|---:|---|---|---|
| `B0CZ7F61XN` | `silicone faucet mat splash guard kitchen sink` | `semantic_consensus_needs_dxm_mapping` | 42% | `100003261` | none | blocked: add DXM mapping |
| `B0DZ14L38Y` | `kitchen sink faucet mat splash guard` | `semantic_consensus_needs_dxm_mapping` | 38% | `100003261` | none | blocked: add DXM mapping |
| `B0F1DDLKBB` | `trash bag holder garbage bag dispenser organizer` | `conditional_verified` | 15% | `200089142` | `收纳架(Racks & Holders)` | ready: low confidence |
| `B0CTBQCKL9` | `plastic bag holder grocery bag dispenser` | `conditional_verified` | 52% | `200042150` | `收纳架(Racks & Holders)` | ready: low confidence |
| `B01E2EYG4U` | `storage cubes fabric storage bins` | `evidence_split` | 50% | `201222631` | `收纳盒和收纳箱(Storage Boxes & Bins)` | blocked |
| `B0GFV4N3K8` | `chair leg floor protectors silicone furniture pads` | `evidence_split` | 42% | `370803` | none | blocked |
| `B0C1JY1C7F` | `furniture sliders carpet furniture moving sliders` | `evidence_split` | 38% | `370803` | none | blocked |

Formal writeback:

- `runs/aliexpress-evidence-store.json`: 1 `semantic_consensus_needs_dxm_mapping` record and 6 `evidence_split` records written/read back.
- `runs/exception-queue.json`: 1 open `aliexpress_dxm_category_map_missing` blocker and 6 open `aliexpress_category_evidence_split` blockers.

## B0CZ7F61XN Mapping Review

`B0CZ7F61XN` was reviewed first before deciding whether the remaining six should be batch-processed with the same rule.

- Browser action type: Dianxiaomi collection-box/edit-classification readonly attempt only.
- Located row: `B0CZ7F61XN`, title `24 Inch Longer Faucet Mat for Kitchen Sink...`.
- Action executed: opened the edit classification prompt and attempted the `编辑分类` step for category confirmation.
- Not executed: save, move to wait-to-publish, final publish, one-click publish, Product Development draft handling, recollection, reclaim, or product field editing.
- Result: no safe DXM leaf category was confirmed from the page.
- Local category data review found validated `Kitchen Drains & Strainers`, but that mapping is explicitly scoped to sink/drain/strainer products and rejects faucet products.
- Decision: keep `B0CZ7F61XN` blocked as `aliexpress_dxm_category_map_missing`; do not promote it to `conditional_verified` until a precise or explicitly safe adjacent DXM leaf is confirmed.
- Map state: `config/aliexpress-dxm-category-map.json` records `postCategoryId=100003261` as `needs_review`, not `active`.

## Remaining 6 Follow-Up Review

The remaining six ASINs were rechecked after the semantic second-pass rule was corrected. Browser actions were limited to readonly AliExpress search-page loading/reading. No AliExpress product click, cart, order, chat, or form submit was executed. No Dianxiaomi save, move-to-wait-publish, final publish, one-click publish, Product Development draft handling, recollection, or reclaim was executed.

| ASIN | Result After Follow-Up | Decision |
|---|---|---|
| `B0DZ14L38Y` | `semantic_consensus_needs_dxm_mapping`, top `100003261`, semantic family `faucet-mat-splash-guard` | still blocked; same missing DXM leaf as `B0CZ7F61XN` |
| `B0F1DDLKBB` | `conditional_verified`, `semantic_low_confidence`, top `200089142`, semantic family `bag-holder-dispenser`, DXM `收纳架(Racks & Holders)` | newly ready for readonly edit preflight |
| `B0CTBQCKL9` | `conditional_verified`, `semantic_low_confidence`, top `200042150`, semantic family `bag-holder-dispenser`, DXM `收纳架(Racks & Holders)` | newly ready for readonly edit preflight |
| `B01E2EYG4U` | still `evidence_split`; current recapture returned category IDs but no readable titles | not promoted |
| `B0GFV4N3K8` | still `evidence_split`; current recapture returned category IDs but no readable titles, and no DXM candidate exists | not promoted |
| `B0C1JY1C7F` | still `evidence_split`; current recapture returned category IDs but no readable titles, and no DXM candidate exists | not promoted |

Formal write/readback after follow-up:

- `runs/aliexpress-evidence-store.json`: `B0DZ14L38Y` updated to `semantic_consensus_needs_dxm_mapping`; `B0F1DDLKBB` and `B0CTBQCKL9` updated to `conditional_verified / semantic_low_confidence`.
- `runs/exception-queue.json`: split exceptions for `B0DZ14L38Y`, `B0F1DDLKBB`, and `B0CTBQCKL9` resolved; new `aliexpress_dxm_category_map_missing` exception opened for `B0DZ14L38Y`.
- `config/aliexpress-dxm-category-map.json`: `postCategoryId=100003261` remains `needs_review`, now supported by both `B0CZ7F61XN` and `B0DZ14L38Y`; it is not active and cannot be used to save.

Pipeline rerun after follow-up:

- Gate-ready total: 5 (`B0DXFB86J7`, `B0DPSJP47V`, `B0FH7774VK`, `B0F1DDLKBB`, `B0CTBQCKL9`).
- Already completed/wait-publish ASINs to exclude: `B0DXFB86J7`, `B0DPSJP47V`, `B0FH7774VK`.
- New ready ASINs: `B0F1DDLKBB`, `B0CTBQCKL9`.
- Remaining blockers: `aliexpress_dxm_category_map_missing=2` (`B0CZ7F61XN`, `B0DZ14L38Y`), `aliexpress_category_evidence_split=3` (`B01E2EYG4U`, `B0GFV4N3K8`, `B0C1JY1C7F`).

Evidence readback summary:

- Total checked: 7
- Verified: 0
- High confidence: 0
- Conditional verified: 0
- Semantic consensus needs mapping: 1
- Missing: 0
- Blockers: 7

Exception report summary:

- Total ASINs: 7
- Blocked: 7
- Open exceptions: 7
- Reason: `aliexpress_dxm_category_map_missing=1`, `aliexpress_category_evidence_split=6`
- Next action: `validate_and_add_aliexpress_dxm_category_mapping=1`, `manual_review_or_add_category_mapping=6`

## Batch Pipeline Rerun

Local `dxm-batch-pipeline plan` was rerun after evidence and exception writeback.

Safety flags:

- `businessActions=false`
- `browserActions=false`
- `writesManifestReport=false`
- `writesExceptionQueue=false`
- `writesPriceStore=false`

Pipeline summary:

- Total: 10
- Raw gate-ready: 3 (`B0DXFB86J7`, `B0DPSJP47V`, `B0FH7774VK`)
- Completed/wait-publish excluded: 3
- New ready after exclusion: 0
- Blocked: 7
- Gate blocker counts: `aliexpress_dxm_category_map_missing=1`, `aliexpress_category_evidence_split=6`
- Exception next actions: `validate_and_add_aliexpress_dxm_category_mapping=1`, `manual_review_or_add_category_mapping=6`

Decision:

- Do not edit/save any additional first-batch products.
- Do not retry the same 7 evidence searches in a loop.
- Next step is to prepare the next candidate batch or add stronger category mappings/manual review evidence for these 7 before any edit-page action.

## Next Batch Preparation State

Local search found no second-batch candidate file. Existing candidate-like files are:

- `runs/validation-100-first-batch-candidates-20260701.json`
- `runs/validation-100-live-execution-20260701-claim-blocked.md`
- `runs/drawer-organizers-10-category-attribute-validation-report.md`

Next safe preparation step:

- Generate or import the next candidate manifest using the project template in `TASK.md` / `docs/validation-100-category-100-product-plan.md`.
- Run price and AliExpress evidence gates before any collection, claim, edit, or save action.
- Do not recollect or reclaim old first-batch products.
