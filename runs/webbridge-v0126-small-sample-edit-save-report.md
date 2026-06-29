# v0.1.26 WebBridge 1-Item Small-Sample Edit-Save Validation Report

Date: 2026-06-28

## Scope

- Authorized scope: choose 1-3 low-risk products, collect, single-claim, enter edit flow, use DeepSeek Product Understanding, pass Rule Engine, save to wait-to-publish.
- Actual sample size: 1 item.
- Final publish: not executed.

## Safety Layer Confirmation

- Live page showed `DXM Amazon Crawlbox V1 v0.1.26`.
- Native Dianxiaomi auto-claim was closed.
- Collection input was present.
- Collection counts were readable.
- Visible dangerous controls produced warning only: `dangerous_dxm_controls_visible`.
- Target action `开始采集` was allowed.
- Dangerous target actions remain blocked by rule.

## Product Selected

- ASIN: `B0BY2M154R`
- Store: `Halo Home Store`
- Product: clear drawer organizer / storage tray set
- Visual precheck: main image showed clear storage trays without visible product logo or brand packaging.
- Brand risk: Amazon title/byline contained `Ravinte`; title and description require brand cleanup before any save or move-to-wait-publish action.

## Actions Executed

- Collected one Amazon link through the explicit `开始采集` button.
- Dianxiaomi collection result: success 1, failed 0.
- Collection box changed to total 6454 / unclaimed 1 / claimed 6453.
- Used row-level single `认领`, not `批量认领`.
- Claimed to `Halo Home Store`.
- Dianxiaomi claim result: success 1, failed 0, duplicate skipped 0.
- Opened `https://www.dianxiaomi.com/web/smtlocalProduct/draft`.
- Confirmed the item exists in `速卖通海外托管`采集箱 with row actions: `移入待发布`, `编辑`, `发布`, `更多`.

## DeepSeek Product Understanding

- Report file: `runs/product-understanding-B0BY2M154R.report.json`
- Model: `deepseek-v4-flash`
- Rule Engine: passed
- Product type: `Drawer Organizer`
- Recommended category: `Drawer Organizers`
- Attributes:
  - Material: `Acrylic, Plastic`
  - Color: `Clear`
  - Quantity: `6`
  - Size: `9 x 6 x 2 inches`
- Risk: brand in Amazon title/byline, must be cleaned before saving.

## Continued Edit-Page Attempt

After switching from WebBridge synthetic click to Computer Use for the `smtlocalProduct/draft` row action, the edit wizard did enter a stable edit page for the current sample:

- Edit URL: `https://www.dianxiaomi.com/web/smtlocalProduct/edit?id=167487782006437721`
- Source URL guard: `https://www.amazon.com/Ravinte-Pack-Drawer-Organizer-Organizers/dp/B0BY2M154R`
- Old ASIN guard: no operation was performed on the stale `B00AN8CTX0` edit tab.

Applied edit-page changes before save:

- Title cleaned to: `Clear 6 Pack Drawer Organizer Trays 6 x 9 Inch Plastic Storage Bins with Non-Slip Pads`
- Category selected: `家居用品(Home & Garden) > 家用储存收藏用具(Home Storage & Organization) > 衣物收纳(Clothing & Wardrobe Storage) > 内衣收纳盒(Drawer Organizers)`
- Brand selected: `NONE(AE存量)*******(None)`
- High-concerned chemical selected: `天然未处理(None)`
- Origin selected: `中国大陆(Origin)(Mainland China)`
- Material selected: `塑料(Plastic)`
- Ships From selected: `美国(United States)`
- Color selected: `透明色(Clear)`
- Number of Cells selected: `6-10 格(6-10 Cells)`
- Price corrected to `122.08 CNY`
- Logistics fee set to `0`
- Stock corrected to `15`
- SKU corrected to `B0BY2M154R`
- Weight set to `0.1 kg`
- Dimensions corrected to `22.86 x 15.24 x 5.08 cm`
- PC description replaced with brand-cleaned English copy.
- Imported custom attribute values were cleared.

## Stop Point

Save was not executed because visible preflight still failed on freight template:

- Freight template field remained `--- 请选择运费模板 ---`.
- DOM selection of `111` did not bind to the visible field.
- A Computer Use click opened the freight dropdown, but no `111` option was available.
- Clicking/syncing the freight template control did not load an option list; the dropdown still returned no visible options.

Project rule requires freight template `111` to be truly selected from the visible page control before save. Because that condition was not met, no `保存`, no `保存并移入待发布`, no wait-to-publish move, and no publish action was executed.

## Prohibited Actions Avoided

- Did not click `发布`.
- Did not click batch publish or one-click publish.
- Did not click `批量认领`.
- Did not enter 10-item or 30-item validation.
- Did not move to wait-to-publish with uncleaned brand title.

## Conclusion

v0.1.26 WebBridge safety layer works for collection preflight and single safe collection. The flow reached collection, single-claim, edit-page entry, category selection, title/description cleanup, required attributes, variation parameters, and price/SKU/stock/dimension correction.

The validation still did not complete the save-to-wait-publish step because the Dianxiaomi edit page could not visibly select freight template `111`. This should be treated as a freight-template UI/data-loading automation blocker, not a product-selection failure or DeepSeek failure.

## Next Fix Needed

1. Add or fix a dedicated freight-template `111` selector for the current Ant Design edit page.
2. Capture the API call used by the freight-template dropdown/sync action and determine why the visible option list is empty for `Halo Home Store`.
3. Keep the save preflight hard-blocked until visible freight template text contains `111`.
4. Keep Computer Use as a fallback for the draft row `编辑` wizard, because WebBridge synthetic click was not enough for that transition.
