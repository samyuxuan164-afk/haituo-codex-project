---
name: price-processing
description: Use when computing Dianxiaomi AliExpress local listing prices or goods value from Amazon original USD prices during edit-page automation and preflight.
---

# Price Processing Skill

## Input

```json
{
  "asin": "Amazon ASIN",
  "amazonOriginalPriceUsd": 9.9,
  "visibleGoodsValueCny": 0,
  "visibleSupplyPriceCny": 0
}
```

## Process

1. Require an Amazon original USD price before edit-page save.
2. Compute goods value with this formula:

```text
amazonOriginalPriceUsd x 7 x 1.55
```

3. Round the result to 2 decimal places.
4. Write the computed value to the edit-page `货值(CNY)` field.
5. If `含邮供货价(CNY)` is derived by the page, do not overwrite it unless the page requires a visible correction.
6. Do not use previously imported Dianxiaomi values when they conflict with the formula.
7. During preflight, compare visible `货值(CNY)` against the computed value.
8. If the Amazon original price is missing, record `amazon_original_price_missing` and skip the product.

## Output

```json
{
  "asin": "Amazon ASIN",
  "computedGoodsValueCny": 107.42,
  "status": "filled | skipped",
  "skipReason": ""
}
```
