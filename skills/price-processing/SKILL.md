---
name: price-processing
description: Use when computing Dianxiaomi AliExpress local listing goods value from current-task Amazon displayed USD prices during edit-page automation and preflight.
---

# Price Processing Skill

## Principle

Goods value is not a global fixed formula.

Every task must provide its own price configuration, including:

- Amazon price source field.
- Exchange rate.
- Multiplier or tiered multiplier strategy.
- Rounding rule.
- Displayed-price range policy.

Do not reuse a historical task formula when the current task does not explicitly confirm the formula.
The numeric example below is only an example of one configured task, not a project default.

## Input

```json
{
  "asin": "Amazon ASIN",
  "amazonDisplayedPriceUsd": 9.9,
  "priceFormula": {
    "exchangeRate": 7,
    "multiplier": 1.55,
    "tiers": [],
    "rounding": "round-2",
    "rangePolicy": "highest_displayed_value"
  },
  "visibleGoodsValueCny": 0,
  "visibleSupplyPriceCny": 0
}
```

## Process

1. Require the current task's trusted Amazon displayed USD price before edit-page save.
2. Require the current task's price configuration before computing goods value.
3. If the price configuration is missing, record `price_formula_missing` and skip the product.
4. If Amazon displays a price range, require the current task's configured range policy before formula calculation; record `price_range_policy_missing` or `price_range_policy_invalid` when it is absent or unsupported.
5. Compute goods value from current task inputs only, then round according to the task configuration.
6. Write the computed value to the edit-page `goods value / 货值(CNY)` field.
7. If `supply price including shipping / 含邮供货价(CNY)` is derived by the page, do not overwrite it unless the page requires a visible correction.
8. Do not use previously imported Dianxiaomi values when they conflict with the current task formula.
9. During preflight, compare visible goods value against the computed value.
10. If the Amazon displayed price is missing, record `amazon_displayed_price_missing` and skip the product.

## Output

```json
{
  "asin": "Amazon ASIN",
  "computedGoodsValueCny": 107.42,
  "priceFormulaSource": "current_task",
  "status": "filled | skipped",
  "skipReason": ""
}
```
