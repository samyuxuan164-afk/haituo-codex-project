# Five-minute ready edit attempt - 2026-07-02

Scope: try the two new ready ASINs only: `B0F1DDLKBB`, `B0CTBQCKL9`.

Forbidden actions not executed: final publish, one-click publish, Product Development draft handling, recollection, reclaim.

## Result

| ASIN | Result | Details |
| --- | --- | --- |
| `B0F1DDLKBB` | saved_to_wait_publish | Direct edit id `167487782009931631`; final preflight passed with `blockers=[]`; native `保存并移入待发布` clicked; wait-to-publish readback passed. |
| `B0CTBQCKL9` | not_saved | Correct direct edit id is `167487782009931643`; initial candidate record id `167487782009931667` was wrong and read back as `B01E2EYG4U`, so it was not operated. Correct page partially filled but WebBridge timed out during the second half of field pipeline. Final preflight remained failed; no save executed. |

## B0F1DDLKBB readback

- SKU variants: `B0F1DDLKBB-1` ... `B0F1DDLKBB-5`.
- Price: `CNY 216.89`.
- Stock: `15`.
- Category: `收纳架(Racks & Holders)`.
- Wait-to-publish readback status: pass.

## B0CTBQCKL9 blockers

Final readonly preflight after the timed-out field pipeline:

- `postage template is not 111: --- 请选择运费模板 ---`
- `required attributes incomplete: feature, high_concerned_chemical, origin, material`
- `ships from is not United States: 美国(United States)`
- `variation parameter blocked: required variation attribute missing`
- `custom attributes invalid: #1 length=175`

Already completed before the timeout:

- Correct ASIN/source URL readback: `B0CTBQCKL9`, `https://www.amazon.com/dp/B0CTBQCKL9`.
- Category evidence accepted: `conditional_verified`, DXM category `收纳架(Racks & Holders)`.
- Category selected: `收纳架(Racks & Holders)`.
- Title shortened to length `78`.
- Price changed/read back: `64.99`.
- Brand selected/read back: `NONE(AE存量)******(None)`.

## Browser cleanup

- `dxm-five-minute-b0ct-locate`: closed successfully.
- `dxm-five-minute-b0f1`, `dxm-five-minute-b0ct`, `dxm-five-minute-b0ct-real`: close-session requests timed out and were interrupted to avoid leaving shell processes running.
- Next run must reopen direct URLs and re-read ASIN/source/category/price/stock before any action.

