# Product Understanding 输出规范与规则校验

## 目标

DeepSeek 只负责商品理解，不负责决定发布。

Product Understanding 输出必须先经过本地 Rule Engine 校验；只有通过校验的结果，才能作为编辑页类目搜索、属性默认值建议的输入。

## 固定 JSON Schema

输出必须是单个 JSON object，`schemaVersion` 固定为：

```text
product-understanding-v1
```

必填字段：

```text
schemaVersion
asin
productType
primaryUse
recommendedCategory
attributes
risks
confidence
ruleEngine
```

`recommendedCategory` 必须包含：

```text
name
path
searchTerms
confidence
evidence
```

`attributes` 每一项必须包含：

```text
name
value
source
confidence
```

`risks` 每一项必须包含：

```text
type
level
message
```

`ruleEngine` 必须包含：

```text
passed
blockedBy
allowedForEditPage
notes
```

## 禁止输出

DeepSeek 输出中禁止出现发布建议，包括但不限于：

```text
publish
review and publish
ready to publish
go publish
发布
上架
刊登
一键发布
```

如果出现上述内容，本地 Rule Engine 必须判定失败。

## 规则校验

本地校验工具：

```text
tools/validate-product-understanding.py
```

校验条件：

1. 必须是严格 JSON object。
2. 必须匹配 `skills/product-understanding/schema.json`。
3. 禁止出现任何发布建议。
4. 推荐类目置信度必须不低于 `0.72`。
5. 推荐类目必须带搜索词和证据。
6. 属性必须带来源和置信度。
7. 存在 `blocker` 风险时，禁止用于编辑页。
8. `ruleEngine.allowedForEditPage` 必须为 `true`。

## 使用边界

通过校验的 Product Understanding 结果只能用于：

1. 编辑页类目搜索候选。
2. 属性默认值建议。
3. 保存前 Preflight 的辅助判断。

不能用于：

1. 直接发布。
2. 跳过 Logo / 品牌 / 类目 / 运费模板规则。
3. 替代店小秘可见类目选择。
4. 替代项目发布前检查。

## 当前状态

本阶段只完成本地输出规范和 Rule Engine 校验接入。

没有操作店小秘页面，没有采集、认领、编辑、保存或发布。
