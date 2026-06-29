# v1.1.48 五品类 x 单产品采集到保存前预检验证报告

日期：2026-06-29

## 阶段判断

当前阶段：Validation / 五品类单产品链路验证。

本次从采集重新建立样本。旧商品不作为验证对象。

## 环境确认

- 店小秘采集页：`https://www.dianxiaomi.com/web/productCrawl/dataAcquisition`
- 店小秘草稿页：`https://www.dianxiaomi.com/web/smtlocalProduct/draft`
- DXM Automation V1：`1.1.48`
- DXM Amazon Crawlbox V1：`v0.1.27`
- save Payload V3：`0.6.3`
- WebBridge preflight：可读，`allowed=true`
- 自动认领：关闭
- 危险按钮策略：页面存在 `采集并一键发布 / 批量认领 / 一键发布 / 发布` 时只产生 warning；目标为 `开始采集` 时 allowed
- 发布动作：未执行
- `save.json`：未调用

## 采集结果

初始采集箱计数：

```text
all=6467
unclaimed=0
claimed=6467
```

首批采集 5 条：

| 品类 | ASIN | 产品 | 结果 |
|---|---|---|---|
| 水槽过滤器 | B0D65JFRX4 | Sink Drain Strainer | 采集成功 |
| 免钉挂钩 | B09PFW8WRQ | Large Adhesive Wall Hooks | 采集成功 |
| 桌面笔筒 | B0C9ZHWC9K | Rotating Plastic Desk Pen Organizer | 采集成功 |
| 柜门防撞垫 | B088HGQSZT | Cabinet Bumpers | 重复采集，已跳过 |
| 硅胶皂碟 | B0BPS66NC3 | Silicone Soap Dish | 采集成功 |

补采 1 条：

| 品类 | ASIN | 产品 | 结果 |
|---|---|---|---|
| 线夹/理线夹 | B0CNSYPZBQ | Adhesive Cable Clips | 采集成功 |

最终采集箱计数：

```text
all=6473
unclaimed=0
claimed=6473
```

采集结论：

- 实际采集低风险品类数：6 个候选品类
- 有效进入海外托管后续验证品类数：5 个
- 总采集尝试：6 条
- 进入采集箱：6 条中 5 条新商品成功，1 条重复跳过
- 自动认领：未开启
- 批量认领：未使用

## 认领结果

| ASIN | 目标通道 | 认领结果 | 备注 |
|---|---|---|---|
| B0BCHYTNHZ | 产品开发采集箱 | 成功 1 / 失败 0 | 误认领到产品开发通道，剔除后续验证 |
| B0BPS66NC3 | 速卖通海外托管 / Halo Home Store | 成功 1 / 失败 0 | 有效样本 |
| B0C9ZHWC9K | 速卖通海外托管 / Halo Home Store | 成功 1 / 失败 0 | 有效样本 |
| B09PFW8WRQ | 速卖通海外托管 / Halo Home Store | 成功 1 / 失败 0 | 有效样本 |
| B0D65JFRX4 | 速卖通海外托管 / Halo Home Store | 成功 1 / 失败 0 | 有效样本 |
| B0CNSYPZBQ | 速卖通海外托管 / Halo Home Store | 成功 1 / 失败 0 | 补采有效样本 |

认领结论：

- 总认领数量：6
- 有效海外托管认领数量：5
- 误认领数量：1
- 误认领原因：首次店铺选择时误选 `产品开发 / 草稿箱`；后续改为海外托管组 `全选`，确认已选 `Halo Home Store`
- 批量认领：未使用

## 有效样本产品 ID

| ASIN | 产品 ID | 品类 |
|---|---:|---|
| B0CNSYPZBQ | 167487782007026945 | 线夹/理线夹 |
| B0D65JFRX4 | 167487782006920301 | 水槽过滤器 |
| B09PFW8WRQ | 167487782006887683 | 免钉挂钩 |
| B0C9ZHWC9K | 167487782006886749 | 桌面笔筒 |
| B0BPS66NC3 | 167487782006885971 | 硅胶皂碟 |

## 保存前 dry-run / preflight 结果

5 个有效海外托管样本均完成 `edit.json` 读取和 v1.1.48 dry-run。全部未通过保存前预检，因此未执行 `save.json op=1`。

| ASIN | dry-run | 主要拦截原因 | 分类 |
|---|---|---|---|
| B0CNSYPZBQ | 未通过 | PC / 移动端描述、属性、规格/SKU 存在平台不允许的引号或尺寸符号 | 规则拦截 |
| B0D65JFRX4 | 未通过 | PC / 移动端描述、属性、规格/SKU 存在平台不允许的引号或尺寸符号 | 规则拦截 |
| B09PFW8WRQ | 未通过 | `productPropertyListJson` 空、`categoryResolver unresolved`、`categoryId=5050263-` 不是发布类目 ID、描述特殊字符 | 类目不确定 + 规则拦截 |
| B0C9ZHWC9K | 未通过 | PC / 移动端描述、属性、规格/SKU 存在平台不允许的引号或尺寸符号 | 规则拦截 |
| B0BPS66NC3 | 未通过 | PC / 移动端描述、属性、规格/SKU 存在平台不允许的引号或尺寸符号 | 规则拦截 |

保存结果：

- 编辑保存成功数量：0
- 保存到待发布数量：0
- preflight 拦截数量：5
- `save.json op=1` 调用数量：0
- 发布数量：0

## 类目判断结果

本次未进入真实保存，因为 dry-run 已全部拦截。

可确认结果：

- `B09PFW8WRQ` 免钉挂钩类目解析失败：`categoryResolver unresolved`，且 `categoryId=5050263-` 不是有效发布类目 ID。
- 其余 4 条未出现类目 unresolved 日志，但仍被特殊字符规则拦截，未进入保存。

待补充结果：

- 本轮没有导出每个样本完整 dry-run 报告包，因此除 `B09PFW8WRQ` 外，完整类目路径需要下一轮导出报告包或在编辑页可视化确认。

## PC 图文详情检查

本轮 5 个有效样本的 dry-run 日志未出现：

```text
PC端描述缺少当前商品图片
PC端描述排版错误：必须先图片后描述
```

说明：

- v1.1.48 的 PC 图文详情检查已接入 dry-run。
- 本轮实际拦截点优先命中特殊字符和类目不确定。
- 因 dry-run 未通过，接口保存未执行，因此不存在“接口保存绕过图文详情检查”的情况。

前置验证证据：

- `runs/v1148-pc-detail-dry-run-20260629/single-submit-report-current-draft.json` 已证明缺图 / 非先图片后描述会被拦截。

## WebBridge / Computer Use 使用情况

- WebBridge：用于浏览器页面控制、采集、单条认领、只读读取、dry-run 触发。
- Computer Use：未使用。
- 页面控制异常：
  - 一次长轮询监控卡住，中断后用短检查恢复。
  - 一次批量 dry-run evaluate 调用卡住，中断后确认实际 dry-run 已完成 4 条，最后 1 条单独补跑。
  - 以上归类为页面控制异常，不计为业务失败。

## 失败分类

| 类型 | 数量 | 说明 |
|---|---:|---|
| 业务失败 | 0 | 未发生真实保存或发布失败 |
| 规则拦截 | 5 | 特殊字符清洗、类目不确定导致 dry-run 阻断 |
| 页面控制异常 | 2 | 长轮询 / 批处理 evaluate 卡住，已恢复 |
| 类目不确定 | 1 | B09PFW8WRQ 类目解析失败 |
| 重复商品 | 1 | B088HGQSZT 重复采集，已跳过 |
| 认领目标错误 | 1 | B0BCHYTNHZ 误入产品开发采集箱，已剔除 |

## DeepSeek Product Understanding

本轮未单独生成 5 条 DeepSeek Product Understanding 报告。

原因：

- 5 个有效样本在本地 dry-run / preflight 阶段已全部被规则拦截。
- 本轮没有进入真实保存阶段，也没有将 DeepSeek 输出用于最终保存。

后续要求：

- 下一轮修复特殊字符清洗和类目不确定后，必须为 5 个样本分别导出 Product Understanding + Rule Engine 报告，再进入保存。

## 结论

本轮可以确认：

1. 采集页环境和 WebBridge 安全边界正常。
2. 自动认领保持关闭。
3. 危险按钮 warning / safe target allowed 策略正常。
4. 5 个有效新样本已重新采集并认领到速卖通海外托管 `Halo Home Store`。
5. v1.1.48 保存前 preflight 生效，阻止了不合规 payload 进入 `save.json op=1`。
6. 未发布，未一键发布，未调用 `save.json`。

暂不建议进入更稳定的小批量验证。

下一步应先修复：

1. dry-run 生成 payload 后的特殊字符清洗覆盖范围，尤其是 PC 描述、移动端描述、属性、规格/SKU。
2. `B09PFW8WRQ` 这类免钉挂钩的类目解析，避免 `categoryId` 出现非发布类目 ID。
3. 认领弹窗店铺选择逻辑，避免误选产品开发通道。
4. 每个样本导出完整 dry-run 报告包和 DeepSeek Product Understanding 报告。
