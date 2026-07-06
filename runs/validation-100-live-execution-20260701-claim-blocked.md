# Validation 100 Live Execution - 2026-07-01

## Scope

- Task: 100品类压测
- Platform: 速卖通海外托管
- Store: Halo Home Store
- Business license group: A1
- Source: Amazon search
- Price rule: Amazon original USD x 7 x 1.55
- Goal: edit/save to wait-to-publish only
- Forbidden actions respected: no final publish, no one-click publish, no Product Development draft handling

## Candidate And Routing

- Amazon raw candidate records scanned: 1512
- Initial auto_ready after first pass: 91
- Strict auto_ready after brand/title first-token tightening: 44
- Moved from auto_ready to exception by strict brand pass: 47
- AliExpress category evidence checked: 44
- AliExpress evidence verified: 44
- AliExpress evidence failed: 0

## Executed Batch

First execution batch attempted 10 ASINs:

- B0CZ7F61XN
- B0DZ14L38Y
- B0DXFB86J7
- B0DPSJP47V
- B0F1DDLKBB
- B0CTBQCKL9
- B0FH7774VK
- B01E2EYG4U
- B0GFV4N3K8
- B0C1JY1C7F

Observed Dianxiaomi collection result:

- New current-batch unclaimed rows visible: 9
- Missing from current unclaimed rows: B0GFV4N3K8
- Pre-existing old unclaimed row skipped: B07D5DN269
- Selected for batch claim: 9 current-batch rows
- Old row selection readback: B07D5DN269 unchecked

## Claim Flow Correction

Batch claim modal opened, but the store list stayed in `render-skeleton` loading state after:

- First open
- Search for `Halo Home Store`
- Search clear and re-selecting `速卖通海外托管`
- Long wait
- Closing and reopening the claim modal

The run stopped before clicking `确定`.

After the user installed `DXM Amazon Crawlbox V1 v0.1.30`, the same batch was rechecked from the current Dianxiaomi page:

- Page script readback: `DXM Amazon Crawlbox V1 v0.1.30`.
- Refreshed page count: `全部(6513)`, `未认领(10)`, `已认领(6503)`.
- Re-selected the same 9 current-batch rows and read back `已选中9条数据`.
- Confirmed old row `B07D5DN269` stayed unchecked.
- Opened batch claim again.
- Waited 20 seconds: `Halo Home Store` did not render, `已选(0)` remained.
- Refreshed the Dianxiaomi page once per the v0.1.30 rule.
- Re-selected the 9 current-batch rows again and opened batch claim again.
- Waited another 20 seconds: still no `Halo Home Store` or concrete overseas-managed store checkbox.
- Clicked the top `速卖通海外托管` channel tab and searched `Halo Home Store`; the modal still showed only `速卖通海外托管 / 全选` and `已选(0)`.
- Closed the modal without clicking `确定`.

Corrected diagnosis after user review:

- The modal page itself is expected to open on the top `全部` tab.
- The correct business path is not to click the top `速卖通海外托管` filter tab and not to search `Halo Home Store`.
- Correct path: keep top `全部` -> find the left-side `速卖通海外托管` group -> tick the concrete store checkbox under that group -> read back `已选(1)` -> click `确定`.
- Store display name is not the primary business key for this step. The required key is the left-side `速卖通海外托管` group.
- v0.1.31 has been prepared to overwrite the old logic and use this group-selection path.

## Exception Queue

- B0GFV4N3K8: `collection_missing_current_unclaimed_row`
- Current 9 selected rows: `claim_flow_corrected_pending_v0.1.31_retry`
- B07D5DN269: `old_unclaimed_row_skipped_not_current_batch`

## Metrics

- Actual business execution reached: Amazon candidate generation -> AliExpress evidence -> Dianxiaomi collection -> current-batch row selection -> claim-modal safety block
- Saved to wait-to-publish: 0
- Published / one-click published: 0
- WebBridge / tab-control interruptions: 2 known events
  - stale `find_tab` matched older Dianxiaomi draft tab
  - claim-modal read/selection path used the wrong top-tab/search model before user correction
- Claim-store refresh recoveries attempted: 1
- Claim-store 20-second wait cycles: 2
- Native save补字段次数: 0
- Average item completion time: not measurable because no item passed claim/edit/save
- Estimated hourly throughput: not measurable; current bottleneck is corrected claim-flow retry pending
- 300-500/hour target: not assessable in this blocked run

## Resume Point

Resume after installing `DXM Amazon Crawlbox V1 v0.1.31`: reopen batch claim for the 9 current-batch rows if still present, keep top `全部`, select the concrete store checkbox in the left-side `速卖通海外托管` group, read back `已选(1)`, then click `确定`.

Do not use `全选` as a substitute for target-store confirmation.

## WebBridge Continuation - v0.1.31 Claim Retry

Continuation date: 2026-07-01.

Scope respected:

- Used WebBridge after the user explicitly requested it.
- No new collection was executed.
- No final publish, one-click publish, Product Development draft handling, or product-level `发布` action was executed.
- Old unclaimed row `B07D5DN269` remained excluded from the claim selection.

Readback before claim:

- Page: `https://www.dianxiaomi.com/web/productCrawl/dataAcquisition`.
- Page script: `DXM Amazon Crawlbox V1 v0.1.31`.
- Counts: `全部(6513)`, `未认领(10)`, `已认领(6503)`.
- Visible current-batch rows: 9.
- Missing current-batch row still absent: `B0GFV4N3K8`.
- Visible old row still present and unchecked: `B07D5DN269`.

Claim execution:

- Selected exactly the 9 visible current-batch ASIN rows:
  - `B0C1JY1C7F`
  - `B01E2EYG4U`
  - `B0FH7774VK`
  - `B0CTBQCKL9`
  - `B0F1DDLKBB`
  - `B0DPSJP47V`
  - `B0DXFB86J7`
  - `B0DZ14L38Y`
  - `B0CZ7F61XN`
- Claim modal top tab remained `全部`.
- Verified `Halo Home Store` was under the left-side `速卖通海外托管` group:
  - `产品开发` group contained `草稿箱`.
  - `速卖通` group contained disabled `cn1113097037kjkae`.
  - `速卖通海外托管` group contained concrete store `Halo Home Store`.
- Clicked only the concrete `Halo Home Store` checkbox, not group `全选`.
- Readback before confirmation: `已选(1)`, `Halo Home Store` checked, no wrong-channel checkbox checked.
- Clicked modal `确定`.

Claim result readback:

- Dianxiaomi result modal: `速卖通海外托管采集认领执行完成，成功 9 条，失败 0 条，跳过重复数据 0 条`.
- Opened `速卖通海外托管` collection box from the left navigation.
- Authoritative collection-box readback:
  - URL: `https://www.dianxiaomi.com/web/smtlocalProduct/draft`.
  - Page: `速卖通海外托管 > 采集箱`.
  - `采集箱(9)`.
  - `发布中 (0)`.
  - `发布失败 (0)`.
  - `第1-9条，共 9 条记录`.

Edit/save attempt readback:

- Opened first product directly:
  - ASIN: `B0C1JY1C7F`.
  - Edit id: `167487782009931687`.
  - Amazon original price readback: `$8.99`.
  - Expected goods value: `CNY 97.54`.
  - Result: blocked before save.
  - Blockers: `category_evidence_missing`; category not selected; freight template not `111`; required attributes hidden because category was missing; visible goods value mismatch, expected `97.54`, actual `74.51`.
- Opened second product directly:
  - ASIN: `B01E2EYG4U`.
  - Edit id: `167487782009931667`.
  - Amazon original price readback: `$19.96`.
  - Expected goods value: `CNY 216.57`.
  - Result: blocked before save.
  - Blockers: `category_evidence_missing`; category not selected; freight template not `111`; required attributes hidden because category was missing; visible goods value mismatch, expected `216.57`, actual `182.78`; imported custom attributes still invalid.

Current exception queue:

- `B0GFV4N3K8`: `collection_missing_current_unclaimed_row`.
- `B0C1JY1C7F`: `category_evidence_missing`; `price_visible_mismatch`; not saved.
- `B01E2EYG4U`: `category_evidence_missing`; `price_visible_mismatch`; custom attributes invalid; not saved.
- Remaining 7 claimed collection-box products: pending edit, but should not be saved until AliExpress category evidence / learned rule is available and price is read from Amazon original USD.

Updated resume point:

- The claim blocker is resolved.
- Resume from `速卖通海外托管 > 采集箱(9)`.
- Do not re-collect or re-claim this first batch.
- Before saving any of the 9 products, restore or attach per-ASIN AliExpress category evidence / learned category rules and per-ASIN Amazon original USD prices.
- Do not use Dianxiaomi visible goods value as the price source.

## 2026-07-01 Status Readback Code Verification

Scope respected:

- Installed and verified `DXM Amazon Crawlbox V1 v0.1.32`.
- Verification used WebBridge structured DOM/JSON readback only.
- No collection, claim, edit save, wait-to-publish move, final publish, one-click publish, Product Development draft handling, or product-level publish was executed.

Code verification:

- Added readonly status JSON exposure:
  - `window.__DXM_AMAZON_CRAWLBOX_STATUS_READBACK__`
  - `#dxm-amazon-crawlbox-status-readback-json`
- Added local status readback helper: `tools/dxm-status-readback.js`.
- Syntax checks passed:
  - `node --check src/dianxiaomi-amazon-crawlbox-v1.user.js`
  - `node --check tools/dxm-status-readback.js`

Live readonly readback:

- Page: `https://www.dianxiaomi.com/web/productCrawl/dataAcquisition`.
- Page script: `DXM Amazon Crawlbox V1 v0.1.32`.
- Counts: `全部(6513)`, `未认领(1)`, `已认领(6512)`.
- Native auto-claim: found and closed (`checked=false`).
- Current-batch visible rows: 0.
- Current-batch checked rows: 0.
- Old/other checked rows: 0.
- The only visible unclaimed ASIN was old row `B07D5DN269`; it was unchecked.

Decision:

- Do not click batch claim from the current data-acquisition page.
- `B07D5DN269`: `old_unclaimed_row_skipped_not_current_batch`.
- Current first-batch claimed products should be continued from `速卖通海外托管 > 采集箱(9)` / direct edit URLs, not from the current unclaimed list.
- The Codex Node runtime cannot directly connect to `127.0.0.1:10086` in this sandbox (`EPERM`), while direct shell `curl` WebBridge calls work. For this environment, use direct `curl` WebBridge readback rather than the Node helper.
