# Controlled Claim Test Report

## 1. Task Summary

Task name: first controlled claim test after first real collection

Task date: 2026-07-06

Executor: Codex

Repository branch used for report: `test/first-real-collection-b0d4v7m7d4`

Live scope: claim one already-collected Dianxiaomi row only.

Target ASIN: `B0D4V7M7D4`

Target platform group: `速卖通海外托管`

Target store: `Halo Home Store`

Business license group: `A1`

Explicitly not executed: new collection, edit, save, wait-publish move, publish, one-click publish, collection-and-one-click-publish, or Product Development / draft handling.

## 2. Pre-Claim Gate

Page opened:

```text
https://www.dianxiaomi.com/web/productCrawl/dataAcquisition
```

Readonly checks before claim:

- Page title read back as `店小秘--数据采集`.
- Installed panels remained visible:
  - `save Payload V3 0.6.3`
  - `DXM Amazon Crawlbox V1 v0.1.57`
  - `DXM Automation V1 V2.1.75`
- Native `自动认领` checkbox was read back as unchecked.
- The current page had 10 table rows, so broad table-header selection was not used.
- The target row was identified by ASIN `B0D4V7M7D4` and title `30 Pack Plant Saucer 6 Inches Plant Trays for Pots...`.
- The target row's own `认领` entry was used as a controlled single-row fallback because other old unclaimed rows were present on the same page.

## 3. Store Selection Readback

Claim modal readback:

```text
Modal: 选择店铺-认领到采集箱
Platform filter: 速卖通海外托管
Visible target store under that group: Halo Home Store
Selected count after checkbox selection: 已选(1)
Selected store readback: Halo Home Store
```

Safety confirmations before clicking `确定`:

- `Halo Home Store` was visible under `速卖通海外托管`.
- Exactly one visible store checkbox was selected.
- Selected store readback was `Halo Home Store`.
- No `产品开发`, `草稿箱`, or other non-`速卖通海外托管` target was selected.

## 4. Live Action Executed

Only one live Dianxiaomi business action was executed:

```text
Clicked target row: 认领
Selected store: 速卖通海外托管 > Halo Home Store
Clicked modal button: 确定
```

No edit, save, publish, one-click publish, or new collection button was clicked in this step.

## 5. Result

Dianxiaomi result modal readback:

```text
认领到采集箱
状态：已完成!
详情：
速卖通海外托管采集认领执行完成，成功 1 条，失败 0 条，跳过重复数据 0 条
```

The result modal was closed after readback.

## 6. Network Evidence

Network capture during the claim step showed these Dianxiaomi requests:

```text
POST /api/crawl/batchCollectMoreShop.json
POST /api/checkProcess.json
POST /api/crawl/index.json
```

No save, wait-publish move, publish, one-click publish, Product Development, cart, order, or chat endpoint was observed in this capture.

## 7. Risk Check

- [x] Target row was locked by ASIN `B0D4V7M7D4`.
- [x] Broad table-header selection was not used because the page contained other unclaimed rows.
- [x] Store readback showed `已选(1)` and `Halo Home Store`.
- [x] Claim result showed success `1`, failure `0`, duplicate skip `0`.
- [x] No edit page was opened.
- [x] No save or wait-publish move was executed.
- [x] No publish, one-click publish, or collection-and-one-click-publish was executed.
- [x] No cookies, sessions, tokens, passwords, API keys, or browser profile data were committed.
- [x] The legacy local folder `自动上架` was not touched.

## 8. Next Step Recommendation

The controlled claim gate passed for `B0D4V7M7D4`.

Next safe stage:

1. Open or read the `速卖通海外托管` collection box for the claimed product.
2. Confirm the claimed product row still matches ASIN `B0D4V7M7D4`.
3. Run edit-page readonly preflight first.
4. Do not save until category, required fields, price, stock, SKU, origin, freight template, and PC-description checks pass.
5. Continue to keep publish and one-click publish forbidden.
