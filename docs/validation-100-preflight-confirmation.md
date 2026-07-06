# 100品类100产品压测执行前确认

当前阶段：Validation / 100品类100产品压测执行前确认。

状态：业务参数已确认；仍不开始真实店小秘业务动作，等待用户明确启动 live execution。

## 当前边界

1. 不发布。
2. 不一键发布。
3. 不处理 `产品开发 / 草稿箱`。
4. 不修改业务脚本。
5. 不打开或操作店小秘业务页面。
6. 不重新采集、重新认领、编辑、保存，除非用户后续明确确认进入真实压测。

## 已确认业务参数

| 参数 | 确认值 |
|---|---|
| 任务名称 | 100品类压测 |
| 平台 | 速卖通海外托管 |
| `targetStore` | Halo Home Store |
| `businessLicenseGroup` | A1 |
| 目标 | 编辑到待发布，不发布，不一键发布 |
| 产品来源 | Amazon 搜索 |
| 是否允许新采集 | 允许 |
| 是否允许认领 | 允许 |
| 价格范围 | Amazon 页面展示价格 USD 5-20 |
| 数量 / 类目 | 100 条，每类目 1 条 |
| 价格公式 | `Amazon 页面展示价格 USD x 7 x 1.55`；区间价取最高值 |
| 类目要求 | 需要 AliExpress 类目证据；允许安全相邻类目 |
| 风控排除 | 品牌/logo、食品、医疗、儿童、带电、侵权高风险、无页面展示价格、无清晰主图、变体过复杂 |
| 执行规则 | 先做预判分流，只对 `auto_ready` 产品执行 |
| 异常处理 | 失败产品进入异常队列；不反复卡死；字段级记录失败原因 |
| 读回要求 | 保存后必须在待发布列表读回确认 |

## 计划复核结论

`docs/validation-100-category-100-product-plan.md` 已具备压测执行前所需的主要结构：

1. 明确当前仅为计划，等待用户确认后才允许真实动作。
2. 明确禁止发布、一键发布、采集并一键发布。
3. 明确禁止认领到非 `速卖通海外托管` 分组。
4. 明确 `Origin` 固定 United States 等价真实选项，不自动回退 Mainland China。
5. 明确分阶段执行：只读准备、候选与类目证据、受控采集、受控认领、编辑保存到待发布、批次读回与报告。
6. 明确每批 10 个产品的节奏建议。
7. 明确高/中/低风险边界和停止条件。

## 开始前必须确认的业务参数

| 参数 | 当前状态 | 必须确认内容 | 未确认时处理 |
|---|---|---|---|
| `businessLicenseGroup` | 已确认 | A1 | 如页面读回不一致，停止采集/认领，记录 `license_group_mismatch` |
| `targetStore` | 已确认 | Halo Home Store，且必须属于 `速卖通海外托管` 分组 | 如页面读回不一致，停止认领，记录 `target_store_mismatch` / `store_uncertain` |
| 价格公式 | 已确认 | `Amazon 页面展示价格 USD x 7 x 1.55`，适用于 Amazon 页面展示价格 USD 5-20 的 100 条产品；区间价取最高值 | 保存前价格不一致时停止，记录 `price_formula_mismatch` |
| Amazon 页面展示价格 USD 来源 | 已确认为打开 Amazon 商品页时页面展示的价格 | 当前 100 产品清单中每个 ASIN 必须记录可信 Amazon 页面展示价格 USD | 缺失商品不得保存，记录 `amazon_displayed_price_missing` |
| 是否允许保存到待发布但不发布 | 已确认 | 允许保存到待发布；禁止发布 / 一键发布 | 出现发布入口或确认框立即停止 |
| 100 产品清单来源 | 已确认为 Amazon 搜索 | 先形成候选清单和预判分流结果，再进入采集 | 未形成 `auto_ready` 清单时不得采集 |
| 是否允许重新采集/认领 | 已确认 | 允许新采集、允许认领；仍需按 A1 + Halo Home Store + 速卖通海外托管约束执行 | 错店铺/错分组/重复风险时停止或跳过 |
| 批次大小 | 建议每批 10 个 | 是否按 10 个/批执行，是否需要首批更小样本 | 未确认时默认不执行 |
| 异常处理上限 | 计划为同一字段 3 次 | 是否接受同字段 3 次失败后跳过并记录 | 未确认时不得进入批量编辑 |
| 类目证据方式 | 已确认 | 每类目 1 条；需要 AliExpress 类目证据；允许安全相邻类目 | 证据缺失或分裂时不得保存 |
| 预判分流 | 已确认 | 只对 `auto_ready` 产品执行 | 非 `auto_ready` 进入复核/跳过队列 |

## 100产品清单模板字段

建议使用 CSV / XLSX / Markdown 表均可。最小字段如下：

| 字段 | 必填 | 示例 / 允许值 | 用途 |
|---|---:|---|---|
| `ASIN` | 是 | `B08PB79YXV` | SKU、去重、读回匹配 |
| `Amazon 页面展示价格 USD` | 是 | `6.66` | 唯一价格来源；区间价取最高值 |
| `商品标题` | 是 | Amazon 标题或清洗前标题 | 商品理解、品牌/Logo 风险、类目证据 |
| `店铺` | 是 | 目标店铺名 | 认领目标确认 |
| `采集状态` | 是 | `not_started` / `collected` / `failed` / `skipped` | 阶段跟踪 |
| `认领状态` | 是 | `not_started` / `claimed` / `failed` / `skipped` | 阶段跟踪 |
| `类目证据状态` | 是 | `learned_rule_matched` / `aliexpress_verified` / `evidence_missing` / `evidence_split` | 类目闸门 |
| `预判分流状态` | 是 | `auto_ready` / `needs_review` / `skip_logo_or_brand_risk` / `skip_high_risk_category` / `skip_price_missing` / `skip_image_unclear` / `skip_variation_complex` | 采集前过滤 |
| `风险字段` | 否 | `logo_risk; price_missing; category_split` | 批量风险汇总 |
| `备注` | 否 | 自由文本 | 人工说明、异常证据 |

建议增加的执行字段：

| 字段 | 用途 |
|---|---|
| `productFamily` | 商品族匹配 learned rules |
| `Amazon URL` | 采集链接 |
| `businessLicenseGroup` | 同营业执照组去重 |
| `targetStore` | 认领店铺 |
| `expectedCnyPrice` | 公式计算结果 |
| `expectedOrigin` | 固定 `United States` |
| `expectedFreightTemplate` | 固定 `111` |
| `safeAdjacentAllowed` | 是否允许安全相邻类目 |
| `finalStatus` | `saved_to_wait_publish` / `skipped` / `blocked` / `environment_interrupted` |

## CSV 表头建议

```csv
ASIN,Amazon 页面展示价格 USD,商品标题,店铺,采集状态,认领状态,类目证据状态,预判分流状态,风险字段,备注,productFamily,Amazon URL,businessLicenseGroup,targetStore,expectedCnyPrice,expectedOrigin,expectedFreightTemplate,safeAdjacentAllowed,finalStatus
```

## 统一候选清单工具

候选清单机器入口为：

```text
tools/candidate-manifest.js
```

用途：

1. 把 CSV / JSON 候选商品统一成 `dxm-candidate-manifest-v1`。
2. 合并风险过滤、Amazon 页面展示价格、AliExpress 类目证据、异常队列状态。
3. 输出每个 ASIN 的 `precheckRoutingStatus` 和 `nextAction`。
4. 只有 `auto_ready` 才允许进入后续受控采集 / 认领 / 编辑 preflight。

默认只 dry-run；写入文件必须显式使用：

```text
--write --out <path>
```

## 压测开始前确认清单

只有以下全部为 `YES`，才允许进入真实压测：

| 序号 | 确认项 | YES/NO |
|---:|---|---|
| 1 | 用户明确授权开始真实 100 品类 100 产品压测 | 待确认启动 |
| 2 | `businessLicenseGroup` 已确认 | YES: A1 |
| 3 | `targetStore` 已确认且属于 `速卖通海外托管` | YES: Halo Home Store |
| 4 | 价格公式已确认 | YES: `Amazon 页面展示价格 USD x 7 x 1.55`，区间价取最高值 |
| 5 | 每个 ASIN 都有可信 Amazon 页面展示价格 USD |  |
| 6 | 用户确认允许保存到待发布，但不允许发布 | YES |
| 7 | 100 产品清单来源已确认 | YES: Amazon 搜索 |
| 8 | 是否允许重新采集/认领已确认 | YES: 允许新采集、允许认领 |
| 9 | 同营业执照组去重策略已确认 |  |
| 10 | 100 产品清单已包含必填字段 |  |
| 11 | Logo / 品牌风险预判规则已确认 | YES: 排除品牌/logo |
| 12 | 类目证据策略已确认：learned rules 优先，新品类走 AliExpress / 相似商品证据 | YES |
| 13 | `Origin` 规则已确认：United States，不自动回退 Mainland China | YES |
| 14 | 运费模板规则已确认：真实选择 `111` |  |
| 15 | 下拉字段规则已确认：真实选项 + selected label 读回 |  |
| 16 | native 保存额外字段修复规则已确认 |  |
| 17 | WebBridge / tab-control 异常归类规则已确认 |  |
| 18 | 每批数量已确认，建议 10 个/批 |  |
| 19 | 首批是否先跑 10 个小批已确认 |  |
| 20 | 发布、一键发布、采集并一键发布仍保持禁止 |  |

## 不满足条件时的默认处理

1. 参数未确认：不开始真实动作。
2. 清单字段缺失：补齐清单，不采集。
3. 页面展示价格缺失：该 ASIN 不进入保存流程。
4. 店铺或营业执照组不明确：不认领。
5. 类目证据缺失：不保存。
6. Origin 不能选 United States：不自动回退，记录字段异常。
7. 出现发布相关入口或确认框：停止批次并记录。

## 下一步

等待用户明确启动后，先进入候选清单与预判分流；只有 `auto_ready` 产品允许进入真实店小秘采集 / 认领 / 编辑 / 保存链路。
