# Remaining Products 10-Minute Execution - 2026-07-02

## Scope

- Phase: Validation
- Target: process remaining collection-box products as far as gates allow.
- Prohibited actions kept: no final publish, no one-click publish, no Product Development drafts, no recollection, no reclaim.

## Result

- Saved to wait-publish: 0
- New evidence ready: 1
- Products blocked: 2 checked directly
- Browser close: succeeded on second safe attempt; 6 task-opened pages were closed. No save confirmation was clicked.

## Product Results

### B0DZ14L38Y

- Current page/readback: edit id `167487782009931589`, ASIN `B0DZ14L38Y`.
- Price gate: trusted, expected CNY `130.09`.
- Before action: blocked by AliExpress evidence `semantic_consensus_needs_dxm_mapping`.
- Action: readonly AliExpress search/detail evidence recapture.
- Code fix during run: `tools/aliexpress-evidence-capture.js` now continues detail-page checking until 2 matching detail types are found, instead of stopping after any 2 readable details.
- Result: not ready.
- Field-level/blocker reason:
  - Search results are semantically faucet/sink splash-guard related.
  - Detail pages checked: 5.
  - Usable detail types: one wrong/irrelevant `吸油纸`, one useful `厨房水龙头配件`.
  - Remaining 3 candidate detail pages hit AliExpress verification pages.
  - Final status remained blocked by `aliexpress_verification_required` / insufficient 2-page detail consensus.
- No Dianxiaomi edit/save was executed for B0DZ.

### B01E2EYG4U

- Evidence action: readonly AliExpress search recapture.
- Evidence result: passed and written to formal store.
- Formal evidence readback:
  - `status=conditional_verified`
  - `confidenceTier=medium_confidence`
  - `evidenceConfidence=0.6667`
  - DXM candidate: `家居用品(Home & Garden)/家用储存收藏用具(Home Storage & Organization)/收纳盒和收纳箱（有关婴儿食品储存的请发布到婴儿食品存储盒下）(Storage Boxes & Bins)`
- Exception action: resolved old `aliexpress_category_evidence_split`.
- Local gate result: ready for readonly edit preflight.
- Edit page readback: edit id `167487782009931667`, ASIN matched `B01E2EYG4U`.
- Edit action: field-fill attempt only; no save.
- Result: not saved.
- Field-level/blocker reason:
  - Category selector failed to find the exact visible `Storage Boxes & Bins` leaf.
  - Existing runtime clicked a generic/top-level item and the page read back the wrong category `蚊香/蚊香片/灭蚊香（婴儿/儿童用的请发布到母婴类目下）(Anti-Mosquito Incense)`.
  - Preflight blocked save because category did not match B01 evidence.
  - Other remaining blockers after stop: postage 111, required attributes, price, variation fields, custom attributes.
- Code fix during run: `src/dianxiaomi-automation-v1-merged-new.user.js` now disables generic direct-leaf clicks for ASIN evidence category plans. If the exact visible leaf is not found, it must stop with a field-level category reason instead of clicking a generic/wrong category.
- Formal evidence was briefly overwritten by an execution-control mistake while the active page was Dianxiaomi, then immediately restored from the AliExpress search page and read back as verified.
- The B01 edit page had unsaved field changes from the failed category attempt. The browser pages were closed without saving, so those field changes were discarded.

### B0GFV4N3K8

- Not edited.
- Existing project state still says current-batch row was missing/not claimed.
- No recollection or reclaim was executed.

### B0C1JY1C7F

- AliExpress search page was pre-opened, but no full evidence capture was completed before the 10-minute window ended.
- No Dianxiaomi edit/save was executed.

## Code Changes

- `tools/aliexpress-evidence-capture.js`
  - Fixed detail evidence loop so it keeps checking candidates until 2 matching detail types are found or the candidate cap is reached.
- `src/dianxiaomi-automation-v1-merged-new.user.js`
  - Added safety guard: ASIN evidence category plans cannot use generic direct-leaf clicks when the exact visible leaf is not found.

## Verification

- `node --check tools/aliexpress-evidence-capture.js` passed.
- `node --check src/dianxiaomi-automation-v1-merged-new.user.js` passed.
- `tools/aliexpress-evidence-policy.test.js` passed.
- `tools/aliexpress-evidence-batch.js status --asins B01E2EYG4U` read back the restored verified B01 evidence record.

## Safety

- No product was published.
- No one-click publish was executed.
- No Product Development draft was opened or processed.
- No recollection or reclaim was executed.
- No save/move-to-wait-publish was executed in this 10-minute run.
