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
- Amazon displayed-price candidate policy.

Do not reuse a historical task formula when the current task does not explicitly confirm the formula.
The numeric example below is only an example of one configured task, not a project default.
Amazon displayed-price candidates include current buy-box price, displayed ranges, variant prices, and strike/list prices such as `List Price`.
The default candidate policy is `highest_displayed_value`: pick the highest valid Amazon displayed USD candidate, then apply the current task's formula.
Tasks may override that candidate policy, but the exchange rate, multiplier/tier strategy, and rounding rule still must come from the current task.

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
    "candidatePolicy": "highest_displayed_value"
  },
  "visibleGoodsValueCny": 0,
  "visibleSupplyPriceCny": 0
}
```

## Process

1. Require the current task's trusted Amazon displayed USD price before edit-page save.
2. Require the current task's price configuration before computing goods value.
3. If the price configuration is missing, record `price_formula_missing` and skip the product.
4. Select the Amazon displayed USD price from valid Amazon candidates. By default, use `highest_displayed_value`, including the high end of ranges and strike/list prices such as `List Price`.
5. If the current task explicitly provides a different supported candidate policy, use it; if it provides an unsupported policy, record `price_range_policy_invalid`.
6. Do not treat the candidate policy as the goods-value formula. It only selects the Amazon USD input price.
7. Compute goods value from current task inputs only, then round according to the task configuration.
8. Write the computed value to the edit-page `goods value / 货值(CNY)` field.
9. If `supply price including shipping / 含邮供货价(CNY)` is derived by the page, do not overwrite it unless the page requires a visible correction.
10. Do not use previously imported Dianxiaomi values when they conflict with the current task formula.
11. During preflight, compare visible goods value against the computed value.
12. If the Amazon displayed price is missing, record `amazon_displayed_price_missing` and skip the product.

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
