# First Real Collection Test Report

## 1. Task Summary

Task name: first controlled real collection test after engineer-framework merge

Task date: 2026-07-06

Executor: Codex

Repository branch used for report: `test/first-real-collection-b0d4v7m7d4`

Base main merge commit before test: `122827d`

Target store: `Halo Home Store`

Business license group: `A1`

Live scope: one real Dianxiaomi collection action only.

Explicitly not executed: claim, edit, save, wait-publish move, publish, one-click publish, or collection-and-one-click-publish.

## 2. Candidate

```text
ASIN: B0D4V7M7D4
Amazon URL: https://www.amazon.com/dp/B0D4V7M7D4
Amazon displayed price USD: 9.99
Expected CNY price by current task formula: 108.39
Product family: plant saucer tray
Target DXM category evidence: 家居用品(Home & Garden)/园艺用品(Garden Supplies)/花盆/种植配件(Gardening Pots, Planters & Accessories)/花盆托盘(Pot Trays)
```

## 3. Preflight And Gates

- Local main was synced to merge commit `122827d`.
- Local unit checks passed before live action:
  - `node tools/dxm-automation-core.test.js`
  - `node tools/aliexpress-evidence-policy.test.js`
- Dry-run payload generation passed before live action and confirmed `dryRun: true`, `submit: false`.
- Product Understanding schema validation passed for the existing adapted fixture.
- JS syntax check passed for 38 tracked `.js` / `.mjs` files.
- Dianxiaomi readonly page check confirmed:
  - Page: `https://www.dianxiaomi.com/web/productCrawl/dataAcquisition`
  - Page title: `店小秘--数据采集`
  - Login state present; no login page shown.
  - Auto claim checkbox was not checked.
  - Visible dangerous controls existed and were deliberately avoided: `采集并一键发布`, `批量认领`, `一键发布`, and publish-related panel controls.

## 4. Category Evidence

Initial candidate gate result for `B0D4V7M7D4` was blocked by `category_evidence_missing`.

Readonly AliExpress evidence capture was then run for query `plant saucer tray`.

Result:

```text
status: aliexpress_verified
aliexpressCategoryId: 100001805
evidenceConfidence: 1
confidenceTier: high_confidence
verificationMode: high_confidence
blockers: []
summary: AliExpress readable results: 60; top postCategoryId 100001805 (100%)
```

After writing that evidence to `runs/aliexpress-evidence-store.json`, the local candidate manifest gate returned:

```text
Total: 1
Auto ready: 1
Routing: auto_ready
Next action: ready_for_controlled_collection_or_edit_preflight
Blockers: -
```

## 5. Live Action Executed

Only one live Dianxiaomi action was executed:

```text
Input link: https://www.amazon.com/dp/B0D4V7M7D4
Clicked button: 开始采集
```

Safety confirmations before click:

- The link textarea contained exactly one URL.
- The visible `自动认领` checkbox was not checked.
- The `开始采集` button was a separate button from `采集并一键发布`.
- The clicked button text was exactly `开始采集`.

## 6. Result

Dianxiaomi result modal readback:

```text
链接采集
状态：已完成!
详情：
已成功采集1条,失败:0
```

Network capture showed only collection and progress-related requests:

```text
POST /api/crawl/crawl.json
POST /api/checkProcess.json
GET /api/quickPublish/exportErrorInfo.json
```

No claim, save, publish, or one-click publish endpoint was observed.

## 7. Risk Check

- [x] No claim was executed.
- [x] No edit page was opened for this product.
- [x] No save or wait-publish move was executed.
- [x] No publish or one-click publish was executed.
- [x] `采集并一键发布` was not clicked.
- [x] `批量认领` and claim buttons were not clicked.
- [x] No cookies, sessions, tokens, passwords, API keys, or browser profile data were committed.
- [x] The legacy local folder `自动上架` was not touched.

## 8. Next Step Recommendation

The controlled single-product collection gate passed for `B0D4V7M7D4`.

Next safe stage is controlled claim for this one current collected product only:

1. Read back the current unclaimed row and confirm ASIN `B0D4V7M7D4`.
2. Confirm target group is `速卖通海外托管`.
3. Select only `Halo Home Store`.
4. Execute claim only after row identity and selected store readback are explicit.
5. Do not edit, save, publish, or one-click publish in the same step.
