# 多平台商品自动上架完整开发流程与遗漏场景清单

更新日期：2026-07-01

## 本次判断

当前阶段是 `Recovery / Validation` 后的开发流程梳理，不进入真实业务执行。

当前项目已完成 Mac 迁移、只读验证、受控 1-link Smoke Test 和 20-category 批次的部分恢复执行；最终发布不是当前默认目标。后续应先补齐流程设计、异常分类、验证闸门和最小代码改造计划，再进入新的 3x10 或 Production。

本次用户指定的 `request-refactor-plan`、`grill-me` 未安装到全局 Codex skills 目录，因此本文件按两者的工作意图执行：

1. `request-refactor-plan` 风格：先分层梳理系统、边界、重构顺序和验证闸门。
2. `grill-me` 风格：用反向质询挖掘遗漏业务场景、异常失败卡点和误判风险。

## 总目标

把多平台商品自动上架做成可恢复、可验证、可迁移、可维护的自动化系统。

标准业务链路：

```text
任务配置
-> 选品
-> 品牌/Logo/重复过滤
-> 类目证据
-> 采集
-> 认领
-> 编辑页自动填写
-> 保存到待发布
-> 发布前批次检查
-> 发布
-> 发布结果回读
-> 失败恢复和知识沉淀
```

当前项目的主链路仍以：

```text
Amazon 商品 -> 速卖通海外托管 / 店小秘 -> 待发布
```

为第一阶段目标。未来扩展到更多来源平台或目标平台时，必须新增适配层，不把平台差异写进业务核心逻辑。

## 多平台边界

### 来源平台

第一阶段来源平台：

- Amazon US

后续可扩展来源：

- Amazon 其他站点
- AliExpress 商品源
- Temu / Walmart / 1688 等候选源
- 手工导入 URL / CSV

来源平台只负责提供标准化商品上下文：

```json
{
  "sourcePlatform": "amazon_us",
  "sourceUrl": "",
  "asinOrSourceId": "",
  "title": "",
  "originalPrice": 0,
  "currency": "USD",
  "images": [],
  "brandSignals": [],
  "variationSignals": [],
  "categoryHints": [],
  "specs": {}
}
```

### 目标平台

第一阶段目标平台：

- 店小秘
- 速卖通海外托管
- Halo Home Store

后续目标平台或店铺扩展必须通过任务配置声明：

```json
{
  "targetSystem": "dianxiaomi",
  "targetChannel": "速卖通海外托管",
  "targetStore": "Halo Home Store",
  "businessLicenseGroup": ""
}
```

禁止在代码里写死店铺、电脑路径、Chrome Profile、账号、密码、Cookie、营业执照组。

## 开发主流程

### P0 环境恢复

目标：确认自动化能力可运行，但不触发业务动作。

检查项：

- Chrome 可打开目标页面。
- Tampermonkey 脚本已安装、启用、实际注入。
- 项目脚本版本与源码版本一致。
- 店小秘、Amazon、速卖通登录状态可用。
- WebBridge / Browser 控制能读取页面但不误触按钮。
- 项目目录、文档、skills、源码完整。

禁止动作：

- 采集。
- 认领。
- 编辑保存。
- 发布。
- 一键发布。

### P1 面板验证

目标：确认三个业务面板显示和只读状态稳定。

检查项：

- DXM Automation V1 面板显示。
- DXM Amazon Crawlbox V1 面板显示。
- save Payload V3 面板显示。
- 版本号正确。
- 只读 preflight 能读取页面状态。
- 危险动作拦截存在。

异常归类：

- 面板不显示但 Tampermonkey 显示启用：`tampermonkey_execution_inactive`。
- 页面刷新无效但重启 Chrome 后恢复：环境恢复经验，不算业务失败。
- Browser / WebBridge 读取超时：`Environment Control Exception`。

### P2 功能验证

目标：验证 Hook、按钮绑定、预检、拦截，不执行真实业务。

检查项：

- fetch / XHR Hook 正常记录。
- save / publish payload 只读捕获正常。
- 危险按钮识别正常。
- 自动认领状态可读。
- 采集输入框、采集箱计数可读。
- 编辑页字段读取、预检、dry-run 可执行。

禁止动作：

- 真实采集。
- 真实认领。
- 真实保存。
- 真实发布。

### P3 Smoke Test

目标：用极小样本验证真实链路一个环节，不扩大范围。

建议顺序：

1. 只读 Smoke Test。
2. 1-link 采集 Smoke Test。
3. 1-link 采集 + 认领 Smoke Test。
4. 1-link 编辑 + 保存到待发布 Smoke Test。
5. 仅在授权下执行 1 个测试商品发布验证。

必须记录：

- 商品 ASIN / URL。
- 目标店铺。
- 营业执照组。
- 执行动作。
- 禁止动作未触发证明。
- 平台回读结果。

### P4 3x10 Validation

目标：验证 3 个不同品类，每类 10 个商品的稳定性。

前置条件：

- P0-P3 已通过。
- 当前脚本版本已在页面确认。
- 类目证据流程已可执行。
- 品牌/Logo 采集前过滤已完成。
- 价格来源只取当前任务 Amazon 原价。
- 保存成功以待发布列表回读为准。

失败计数原则：

- 商品字段失败计入商品失败。
- 类目证据缺失计为类目流程待补，不拆成价格/运费/属性多重失败。
- WebBridge / Browser 控制中断计为环境控制异常，不计为商品业务失败。

### P5 Production

目标：按批次稳定完成上架前流程，并在发布授权后执行批量发布。

正式批量原则：

- 默认批量采集。
- 默认受控批量认领。
- 编辑保存按商品逐个通过闸门。
- 发布前必须批次检查。
- 正式发布默认批量发布，不逐个点击产品级发布。
- 有异常商品时，继续编辑或剔除异常商品，不能带病发布。

## 单商品生命周期

### 1. 任务输入

必需字段：

- `sourcePlatform`
- `sourceUrl`
- `asinOrSourceId`
- `amazonOriginalPriceUsd`
- `targetChannel`
- `targetStore`
- `businessLicenseGroup`

缺失处理：

- 缺少营业执照组：停止采集/认领，记录 `license_group_unknown`。
- 缺少 Amazon 原价：停止编辑保存，记录 `amazon_original_price_missing`。
- 缺少目标店铺：停止认领，记录 `store_uncertain`。

### 2. 选品过滤

必须过滤：

- 明显品牌 Logo。
- 主图/包装/水印出现品牌名或商标。
- 同营业执照组内完全相同商品重复。
- 标题、图片、详情明显侵权或平台风险。
- 价格不在任务配置范围。
- 商品类型不适合当前目标平台。

允许保留：

- 同款不同颜色。
- 不同尺寸/组合且可作为独立 SKU 的商品。
- 跨营业执照组复用的高潜力商品。

### 3. 类目证据

新品类必须先做速卖通相似商品 / 以图搜图类目证据。

合法进入店小秘类目搜索的条件：

- 匹配 success-verified learned rule。
- 或 AliExpress 证据清晰。

禁止：

- 只靠 DeepSeek 判断类目。
- 只靠旧关键词规则直接保存。
- 没有 AliExpress 证据就记录 `dxm_visible_category_not_found`。
- 用宽泛词 `Organizer`、`Holder`、`Storage` 直接搜索并保存。

### 4. 采集

前置检查：

- 店小秘页面正确。
- 自动认领关闭。
- 采集输入框存在。
- 采集目标链接数量正确。
- 危险按钮只作为警告，不误点。

禁止：

- `采集并一键发布`。
- `采集并自动认领`。
- 未确认当前批次 ASIN 时裸点批量动作。

### 5. 认领

必须选择：

- 渠道：`速卖通海外托管`
- 店铺：任务指定目标店铺

禁止选择：

- 产品开发
- 草稿箱
- 非目标渠道分组
- 弹窗默认勾选项未经确认直接提交

多店铺时必须按配置匹配。匹配失败记录 `store_uncertain`。

### 6. 编辑页填写

核心字段：

- 标题。
- 类目。
- 必填属性。
- PC 描述。
- 营销图。
- 运费模板 111。
- SKU。
- 库存。
- 货值。
- 变种发货地。
- 自定义属性清空。

字段原则：

- 只处理红星必填字段。
- 无红星字段默认不填、不点、不阻塞。
- Function / Feature 无准确项时选 `Other/其他`。
- Material 红星必填时按证据、相近项、可用项、自由输入逐级兜底。
- Color / Number of Pcs / Size 无红星时不选。
- 自定义属性默认删除，不重写 Amazon bullet。
- 运费模板必须真实下拉选择 `111` 并读回。

价格规则：

```text
货值(CNY) = Amazon 原价 USD x 7 x 1.55
```

保存前必须比对页面可见值。

### 7. 保存前预检

保存闸门：

- 类目已选择且业务匹配。
- AliExpress / success-verified 类目证据存在。
- Brand / High-concerned chemical / Origin 等红星必填真实读回。
- Ships From 为 United States / 美国。
- 运费模板为 111。
- SKU 为当前 ASIN。
- 库存为 15。
- 货值符合公式。
- PC 描述不少于 500 英文字符。
- PC 描述至少包含 2 张当前商品图片，且图片在文字前。
- 标题不超过 80 字符。
- 标题无品牌词、商标词、平台词。
- 特殊字符清洗通过。
- 自定义属性无 70 字符错误。
- 无 `每包` 数值错误。

### 8. 保存与回读

只点击：

- `保存并移入待发布`

不点击：

- `创建新产品继续编辑`
- `发布`
- `一键发布`

成功标准：

- 页面提示产品已移入待发布。
- 待发布列表回读到当前 ASIN。
- 类目、价格、库存、店铺状态可确认。

接口返回成功不等于最终成功。

### 9. 发布前批次检查

必须检查：

- 批次商品都在待发布。
- 未完成编辑商品已剔除。
- 类目业务正确。
- 必填属性完整。
- 标题/描述/属性特殊字符清洗通过。
- 品牌/Logo 风险已过滤。
- 运费模板 111。
- PC 描述图片规则通过。
- 价格与任务公式一致。

### 10. 发布

测试阶段：

- 允许 1 个测试商品单独发布验证。

正式阶段：

- 勾选商品。
- 批量操作。
- 批量发布。

发布后必须回读：

- 发布中。
- 在线产品。
- 审核中。
- 发布失败。

发布失败必须记录平台提示，回到编辑页修复后重新保存。

## 遗漏业务场景清单

### 任务配置遗漏

- 未声明营业执照组。
- 同一营业执照组下多店铺重复采集。
- 跨营业执照组允许复用但未记录。
- 任务价格区间、目标数量、每品类上限未配置时误用硬编码。
- 目标店铺名称变化或同名店铺出现。
- 多平台任务混合时目标渠道错误。

### 商品输入遗漏

- Amazon 原价缺失。
- Amazon 促销价、折扣价、券后价和原价混淆。
- ASIN 缺失或 URL 跳转到变体父体。
- 同一父体不同颜色/尺寸误判为重复。
- 商品图片为空或抓到跨商品图片。
- 详情页包含品牌故事、A+ 模块、包装图。
- 商品是套装、多件装、变体组合但页面变种字段未建模。

### 品牌/Logo 遗漏

- Logo 出现在包装盒角落。
- Logo 出现在场景图背景。
- Logo 出现在产品本体压印。
- Logo 出现在说明书、吊牌、贴纸。
- 品牌词只在图片中，不在标题中。
- Amazon 品牌词被当作普通功能词。
- 真实功能词被误判为品牌词，例如 Rotating。

### 类目遗漏

- AliExpress 证据缺失却进入店小秘搜索。
- AliExpress 证据分裂但强行保存。
- 店小秘多个叶子类目名称相近，实际用途不同。
- 宽泛类目词导致误入错误父路径。
- Amazon 类目和店小秘可售类目不一致。
- 店小秘能保存但业务类目错误。
- learned rule 只有候选记录，没有成功回读验证。
- 同名叶子类目在不同父路径下语义不同。

### 属性遗漏

- 页面红星必填字段动态变化。
- 下拉打开后显示上一个字段的旧选项。
- 下拉输入有文字但未真正选中选项。
- Function / Feature 没有精确项时没有兜底 Other。
- Material 精确材质缺失时未尝试相近项。
- Brand 没有 None / No Brand 可选项。
- High-concerned chemical 选项文案中英文不一致。
- Origin / Ships From 混淆。
- 非红星字段被误当阻塞项。

### 变种遗漏

- Color 非红星却被强行选择。
- Number of Pcs 非红星却被强行选择。
- Size 非红星却被强行选择。
- 单件商品保留打包出售导致每包数值错误。
- 多件装商品需要每包但未识别。
- 页面 SKU 行多变体，自动化只填第一行。
- 颜色、尺寸、套餐组合影响去重口径。

### 价格遗漏

- 使用店小秘页面缓存价格。
- 使用采集批次缓存价格。
- 使用手动 CNY 供货价覆盖。
- 商品缺少 Amazon 原价却继续保存。
- 货值与 payload SKU 价格不一致。
- 汇率、倍率写死在代码而不是任务配置。
- 促销价/原价字段不清导致利润错误。

### PC 描述遗漏

- 纯文本 detailWeb 没有图片。
- 图片数量少于 2 张。
- 图片在文字后面。
- 图片不是当前商品图片。
- Brand Story 未删除。
- Amazon / 品牌 / 平台词残留。
- 描述少于 500 英文字符。
- HTML 清洗破坏图片标签。

### 图片遗漏

- 营销图一键生成失败。
- 只生成一张图。
- 生成图不是 1:1 白底或 3:4 场景图。
- 图片加载慢导致误判缺失。
- 图片跨商品污染。
- 图片中含品牌水印但选品阶段未拦截。

### 采集/认领遗漏

- 自动认领未关闭。
- 采集并一键发布按钮误触。
- 批量认领未按当前批次 ASIN 约束。
- 弹窗默认勾选错误分组。
- 产品开发/草稿箱被误选。
- 采集成功但未进入目标采集箱。
- 重复采集被平台吞掉但未记录。

### 保存遗漏

- save.json 没发出请求。
- save.json 返回成功但页面未移入待发布。
- 成功弹窗出现后误点创建新产品继续编辑。
- 保存后未回读待发布列表。
- 自定义属性清空输入但未删除行，错误仍存在。
- 页面遮罩残留挡住真实表单。
- beforeunload 卡住后继续操作错页。

### 发布遗漏

- 待发布列表中混入旧商品。
- 批次未全通过 preflight 就发布。
- 单品发布测试误扩展为批量发布。
- 发布成功接口返回但平台状态失败。
- 发布失败提示字段与编辑页字段映射不清。
- 发布后进入审核中但未记录最终状态。

### 环境控制遗漏

- WebBridge `find_tab` 匹配到旧编辑页。
- 多个 `/edit?id=` 标签页导致焦点错误。
- 长脚本 evaluate 失败，短脚本可用。
- Browser / Computer Use 截图、DOM、reload、goto 超时。
- Chrome / Tampermonkey 需完整重启才注入。
- chrome-extension 页面不能自动化编辑脚本。
- 页面滚动函数被覆盖导致字段定位失败。

## 异常失败卡点分类

| 类型 | 机器码 | 处理 |
|---|---|---|
| 营业执照组未知 | `license_group_unknown` | 停止采集/认领 |
| 店铺不确定 | `store_uncertain` | 停止认领 |
| 类目证据缺失 | `needs_aliexpress_category_verification` | 先跑 AliExpress 证据 |
| 类目证据分裂 | `aliexpress_category_evidence_split` | 跳过商品，记录候选 |
| 店小秘类目找不到 | `dxm_visible_category_not_found` | 仅在证据清晰后记录 |
| 类目候选分裂 | `dxm_candidate_category_split` | 回到证据裁决，不直接跳过 |
| 必填属性无选项 | `required_attribute_option_not_found` | 字段级失败，继续下个商品 |
| 材质不可填 | `material_required_unfillable` | 只在兜底全失败后记录 |
| 运费 111 不可选 | `postage_111_option_not_found` | 记录并跳过 |
| 下拉串场 | `select_overlay_cross_field_stale` | 关闭旧下拉，重试一次 |
| 自定义属性残留 | `custom_attribute_validation_persisted` | 删除行，不只清空值 |
| 价格源缺失 | `amazon_original_price_missing` | 禁止保存 |
| 页面控制中断 | `webbridge_tab_control_interruption` | 停止浏览器操作，不算业务失败 |
| 环境控制异常 | `Environment Control Exception` | 记录现场，等待恢复 |

## 重构开发计划

### R0 固定真相源

目标：减少聊天上下文和旧日志冲突。

输出：

- `docs/current-status.md` 只记录最新状态。
- `AGENTS.md` / `AGENT.md` 记录执行规则。
- 每次验证后更新 `DEVELOPMENT_LOG.md`。
- 批次结果必须以平台回读为准。

### R1 标准任务模型

目标：把任务配置、商品输入、目标店铺、营业执照组统一成一个数据结构。

最小改造：

- 新增或明确 `TaskContext`。
- 新增 `ProductContext`。
- 所有价格、店铺、营业执照组从上下文读取。
- 缺字段时阻断，不 fallback 到页面缓存。

### R2 平台适配层

目标：隔离来源平台和目标平台差异。

模块边界：

- `source-adapter`：Amazon 采集、图片、标题、价格、变体。
- `category-evidence`：AliExpress 相似商品证据。
- `target-adapter`：店小秘页面字段、接口、回读。
- `rule-engine`：标题、类目、属性、价格、字符清洗。
- `execution-controller`：批次状态、重试、跳过、恢复。

### R3 闸门化执行

目标：每个阶段都有输入、输出、失败码和可验证证据。

阶段闸门：

- `selection_gate`
- `logo_brand_gate`
- `dedup_gate`
- `category_evidence_gate`
- `collection_gate`
- `claim_gate`
- `edit_preflight_gate`
- `save_gate`
- `wait_publish_readback_gate`
- `publish_preflight_gate`
- `publish_result_gate`

### R4 失败恢复和继续执行

目标：商品失败不拖垮批次，环境失败不误判业务。

规则：

- 同一 blocker 最多 3 次。
- 简单可见问题只做一次聚焦纠偏。
- 字段级失败记录后继续下个商品。
- 环境控制异常停止浏览器操作。
- 所有跳过都要有下一步建议。

### R5 知识沉淀

目标：成功经验可复用，失败原因可追踪。

必须沉淀：

- success-verified 类目规则。
- 失败码。
- 商品族类目白名单/黑名单。
- 字段兜底规则。
- 平台异常和恢复方法。
- 批次耗时和慢点。

## Karpathy 风格编码约束

后续代码改造必须遵守：

1. 函数职责单一，函数名直接表达业务目的。
2. 先处理空值、缺字段、页面不可读、接口异常，再处理主流程。
3. 每个阶段只接收明确输入，只返回明确输出。
4. 禁止隐式 fallback 到页面缓存、旧批次缓存、本地手动值。
5. 重复判断抽成小函数，不引入大而全框架。
6. 优先使用普通对象、数组、纯函数和明确状态码。
7. 注释只解释业务目的或平台坑，不解释语法。
8. 不新增无关功能。
9. 不为了一个失败商品写 ASIN 特例。
10. 不把路径、账号、Chrome Profile、店铺、营业执照组写死到业务代码。

推荐函数形态：

```js
function computeGoodsValueCny(amazonOriginalPriceUsd, exchangeRate, multiplier) {
  if (!Number.isFinite(amazonOriginalPriceUsd) || amazonOriginalPriceUsd <= 0) {
    return { ok: false, reason: 'amazon_original_price_missing' };
  }

  const value = amazonOriginalPriceUsd * exchangeRate * multiplier;
  return { ok: true, value: Math.round(value * 100) / 100 };
}
```

不推荐：

```js
function fixEverything(product) {
  // 读取页面、猜价格、选类目、填字段、保存、发布全部混在一起
}
```

## 下一步建议

1. 先补装或确认 `request-refactor-plan`、`grill-me` 的来源；如果要强制使用对应 skill，需要先安装。
2. 不开始新的 30 商品验证，除非用户明确授权。
3. 优先把当前 4 个 unresolved drafts 按本文件失败分类收口。
4. 代码层下一步只做 R1/R3 的最小改造：统一 `TaskContext`、补齐阶段闸门返回值、禁止价格和类目隐式 fallback。
5. 每次改造后先跑语法检查，再做只读 / dry-run / 小样本验证。
