# Current Task

## Phase

Validation / 100-category 100-product stress-test execution preflight.

## Task Name

100品类压测。

## Confirmed Business Parameters

| Parameter | Confirmed Value |
|---|---|
| Platform | 速卖通海外托管 |
| Target store | Halo Home Store |
| Business license group | A1 |
| Objective | 编辑到待发布，不发布，不一键发布 |
| Product source | Amazon 搜索 |
| New collection | 允许 |
| Claim | 允许 |
| Price range | Amazon 页面展示价格 USD 5-20 |
| Quantity | 100 条，每类目 1 条 |
| Current task price parameters | 当前 100 品类任务暂按 `Amazon 页面展示价格 USD x 7 x 1.55`；Amazon 展示价候选默认取最高有效值，候选包括当前价、区间价、变体价、划线价/List Price；这只是本任务参数，不是长期公式，高价或后续任务可改用新倍率、阶梯倍率、舍入规则或新的展示价候选策略 |
| Category rule | 需要 AliExpress 类目证据；允许安全相邻类目 |
| Execution gate | 先做预判分流，只对 `auto_ready` 产品执行 |
| Readback | 保存后必须在待发布列表权威读回确认 |

## Current Boundary

This task has confirmed parameters, but real Dianxiaomi business actions must still be started deliberately.

Allowed now:

1. Prepare the 100-product candidate list.
2. Run pre-judgment routing.
3. Record category evidence status.
4. Maintain documentation, rules, templates, and exception queues.

Not allowed until the user explicitly says to start live execution:

1. Open or operate Dianxiaomi business pages.
2. Click collection, claim, edit, save, publish, or one-click publish controls.
3. Process `产品开发 / 草稿箱`.
4. Modify business userscripts for this documentation/preflight step.

Always forbidden:

1. Publish.
2. One-click publish.
3. Claim to `产品开发 / 草稿箱`.
4. Use stale Dianxiaomi prices, cached prices, UI numeric scans, or manual CNY overrides.
5. Auto-fallback Origin from United States to Mainland China.

## Risk Exclusions

Exclude candidates before collection when any of these are present:

1. Brand / Logo / trademark risk in title, main image, packaging, or product body.
2. Food, medical, children, electric/battery, infringement, or other high-risk category.
3. Missing Amazon displayed price.
4. Amazon page shows out of stock, unavailable, or not currently sellable.
5. Unclear main image.
6. Over-complex variations.

## Required List Fields

```csv
ASIN,Amazon 页面展示价格 USD,商品标题,店铺,采集状态,认领状态,类目证据状态,预判分流状态,风险字段,备注,productFamily,Amazon URL,businessLicenseGroup,targetStore,expectedCnyPrice,expectedOrigin,expectedFreightTemplate,safeAdjacentAllowed,finalStatus
```

## Status Values

Pre-judgment routing:

```text
auto_ready
needs_review
skip_brand_or_logo_risk
skip_high_risk_category
skip_price_missing
skip_image_unclear
skip_variation_complex
skip_category_evidence_missing
```

Execution/final status:

```text
not_started
collected
claimed
saved_to_wait_publish
skipped
field_failed
category_failed
price_failed
environment_interrupted
```

## Exception Handling

1. Failed products enter the exception queue.
2. Do not repeatedly deadlock on one product or one field.
3. Record field-level failure reasons.
4. WebBridge / tab-control interruptions are environment control exceptions, not business failures.
5. Save navigation to `/web/smtlocalProduct/offline` is a success-path signal and must be followed by authoritative list readback.

## Required Read Order

Before any live execution, read:

```text
AGENT.md
AGENTS.md
TASK.md
docs/current-status.md
docs/exception-rules.md
docs/validation-100-category-100-product-plan.md
docs/validation-100-preflight-confirmation.md
docs/project-execution-rules.md
docs/category-resolution-system.md
skills/field-fill-rule/SKILL.md
skills/dxm-three-step-product-edit/SKILL.md
skills/category-resolver/learned_rules.json
skills/category-resolver/rules.json
```

## Next Gate

Do not begin real Dianxiaomi collection / claim / edit / save until the user confirms the start command for live execution.
