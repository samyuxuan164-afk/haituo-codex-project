# AliExpress Category Resolver PoC - Remaining 3 Draft Products

Date: 2026-06-30

Scope:
- Read-only AliExpress category reverse lookup.
- No Dianxiaomi edit-page operation.
- No save, no move-to-wait-publish, no publish.
- Image-search entry was not available on the AliExpress desktop page during this run; product detail page access triggered a CAPTCHA/punish page, so this PoC used AliExpress search-result structured data only.

## Result Summary

| ASIN | Product | AliExpress Query | Top Category Signal | Confidence | Decision |
|---|---|---|---|---|---|
| B0CNSYPZBQ | Adhesive cable clips / cord organizer | `adhesive cable clips cord organizer` | Mixed: `201206404` 7/20, `14191201` 6/20, `201334803` 3/20, `200001603` 2/20, `14191206` 2/20 | Medium-low | Do not auto-save yet; resolver needs category-ID-to-path mapping and stricter similarity ranking. |
| B0D65JFRX4 | Kitchen sink drain strainer / stopper basket | `sink drain strainer kitchen sink stopper basket` | Strong: `200231151` 11/20 | High | Mapped by read-only Dianxiaomi category modal search to `厨房水槽水漏、过滤网(Kitchen Drains & Strainers)`; ready for category-selection-only integration, not auto-save. |
| B0C9ZHWC9K | Rotating desk pen organizer / pencil cup | `rotating plastic desk pen organizer 5 slots` | Moderate: `211114` 8/20, with several makeup-organizer and storage categories mixed in | Medium | Existing Dianxiaomi category `笔筒(Pen Holders)` is directionally correct; remaining blocker is Material field/readback. |

## Evidence Notes

### B0CNSYPZBQ

AliExpress search results were semantically close: cable organizer clips, cable fixing clips, adhesive wire organizer, cord management clips.

Category distribution:
- `201206404`: 7 / 20
- `14191201`: 6 / 20
- `201334803`: 3 / 20
- `200001603`: 2 / 20
- `14191206`: 2 / 20

Interpretation:
- The product family is confirmed as cable management / cable clips.
- AliExpress category IDs are split, so this is not yet a high-confidence auto-save candidate.
- The previous Dianxiaomi wrong category `导电线胶膏` is unsupported by AliExpress search evidence.

### B0D65JFRX4

AliExpress search results were highly concentrated around kitchen sink strainer / drain basket / stopper products.

Category distribution:
- `200231151`: 11 / 20
- `1302`: 2 / 20
- `100003246`: 2 / 20
- `100007091`: 2 / 20
- `200228146`: 2 / 20
- `201511301`: 1 / 20

Interpretation:
- This is the strongest PoC candidate.
- The previous Dianxiaomi wrong category `商用餐厨操作类电器（带电）` is unsupported by AliExpress search evidence.
- AliExpress category ID `200231151` was mapped by read-only Dianxiaomi edit-page category modal search to `家装（硬装）(Home Improvement)/厨房设施(Kitchen Fixture)/厨房水槽配件(Kitchen Sink Accessories)/厨房水槽水漏、过滤网(Kitchen Drains & Strainers)`.
- Matched Dianxiaomi search terms included `水槽`, `过滤`, `滤网`, `Sink`, `Drain`, and `Strainer`.

### B0C9ZHWC9K

AliExpress search results were mostly desk organizer / pen holder products, with some makeup brush organizer overlap because the product can be used for both.

Category distribution:
- `211114`: 8 / 20
- `100003309`: 2 / 20
- `200043145`: 2 / 20
- `200254142`: 2 / 20
- `201531504`: 2 / 20
- singletons: `142001`, `200000453`, `200672001`, `202184012`

Interpretation:
- Existing Dianxiaomi selected category `笔筒(Pen Holders)` is consistent with AliExpress search evidence.
- `Rotating` is confirmed as a functional term, not a title risk.
- Remaining automation blocker is not category; it is the required Material field being invisible/unreadable in the edit page.

## PoC Limitations

- AliExpress desktop homepage did not expose a usable image-search button in the current session.
- Opening an AliExpress item detail page triggered a CAPTCHA/punish page. No CAPTCHA bypass was attempted.
- Search result structured data provides `postCategoryId`, but not enough human-readable full category path. A mapping step is required before feeding these results into Dianxiaomi category selection.

## Recommended Next Step

Build `AliExpress Category Resolver` as a read-only preflight module:

1. Search AliExpress with cleaned product queries.
2. Extract top-N result titles and `postCategoryId`.
3. Score category-ID consensus.
4. Block low-confidence category splits.
5. Persist resolver output per ASIN.
6. Add a mapping layer from AliExpress `postCategoryId` to Dianxiaomi category modal target text before any edit-page auto-save use.

Do not connect this resolver to Dianxiaomi save flow until category-ID-to-path mapping is validated.
