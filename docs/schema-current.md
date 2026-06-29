# 店小秘 save.json 当前字段结构

本文件记录当前已经通过真实 `save.json` 抓包确认的字段结构。字段结构可以复用，字段值必须按当前产品动态生成，不能跨产品复用。

## 来源优先级

1. 真实 `save.json` 返回和抓包 payload
2. `choiceSave.txt` / `choiceSave.zip`
3. `edit.json`
4. Amazon 产品数据
5. Bumpers 类目规则

## save.json 外层请求

```text
POST /api/smtlocalProduct/save.json
multipart/form-data
file = zip(choiceSave.txt)
op = 1 或 2
```

已确认样本：

```text
analysis/save-json-3/choiceSave.pretty.json
```

## choiceSave 顶层字段

当前真实样本共 32 个顶层字段：

```text
shopId
categoryId
subject
sourceUrl
fullCid
productPropertyListJson
mainImageListJson
imgUrl
marketImage2
marketImage1
videoListJson
optionValues
productUnit
packageType
lotNum
supportCountrySupplyPrice
variationListStr
sizeChartId
detailMobile
detailWeb
sizeChartIdListJson
deliveryTime
postageId
aeopQualificationStructListJson
manufactureId
msrEuId
msrTrId
op
id
currencyCode
dxmState
productId
```

## SKU / 变种字段位置

SKU 业务字段位于 `choiceSave.variationListStr`，该字段本身是 JSON 字符串，解析后为 SKU 行数组。

当前单 SKU 行已确认字段：

```text
id
skuId
skuCode
gloGoodsValue
gloLogisticValue
supplyPrice
specialProductTypeListJson
skuStockWareType
skuWarehouseStockListJson
sellableQuantity
effectiveSupplyPrice
packageWeight
packageLength
packageWidth
packageHeight
packageWeightUnit
status
skuPropertyListJson
imageList
destCountrySupplyPriceListJson
```

核心业务值映射：

```text
SKU            -> variationListStr[].skuCode
货值           -> variationListStr[].gloGoodsValue / supplyPrice
物流费         -> variationListStr[].gloLogisticValue
库存           -> variationListStr[].sellableQuantity
重量           -> variationListStr[].packageWeight
尺寸           -> variationListStr[].packageLength / packageWidth / packageHeight
特殊商品类型   -> variationListStr[].specialProductTypeListJson
```

## 发货地字段

发货地不是单点字段，当前需要同时维护：

```text
choiceSave.optionValues.发货地 = ["United States"]
choiceSave.optionValueIds.发货地 = ["201336106"]    # 合并版插件已补，但真实 32 字段样本暂未包含顶层 optionValueIds
variationListStr[].skuPropertyListJson[].sku_property_id = "200007763"
variationListStr[].skuPropertyListJson[].property_value_id = "201336106"
variationListStr[].skuPropertyListJson[].sku_property_value = "United States"
```

## Bumpers 类目字段

当前 Bumpers 发布类目：

```text
categoryId = 200291142
fullCid = 5050263-
postageId = 50169732817
```

必填类目属性在 `productPropertyListJson`：

```text
Brand Name = None
High-concerned chemical = 天然未处理(None)
Origin = 美国(Origin)(US(Origin))
```

## 当前未完全确认

1. 编辑页“保存”按钮对应的真实 save.json payload 尚未学习。
2. `op=1` 已确认会触发移入待发布，不能再作为“补全保存”使用。
3. 保存后 `edit.json` 返回的变种结构可能是 `variationListStr` 或 `variationList`。
4. 待发布状态下保存结构可能不同于采集箱草稿状态。
5. 顶层 `optionValueIds` 是否必须随 `optionValues` 一起提交，需要通过新的真实保存 payload 继续确认。
6. 多变种 SKU 行需要 5 条样本验证，不能只靠单 SKU 样本推断。

## 验证工具

离线落库验证：

```text
python tools/verify-op1-persistence.py ^
  --before-choice-save runs/<run-id>/choiceSave.pretty.json ^
  --after-edit-json runs/<run-id>/after-op1-edit.json ^
  --save-response runs/<run-id>/op1-save-response.json ^
  --out runs/<run-id>/op1-persistence-report.json
```

验证通过条件：

```text
variation 行数一致
每行 SKU / 货值 / 物流费 / 库存 / 重量 / 尺寸 / 发货地完整
categoryId 已保存
optionValues 或 optionValueIds 含 United States
```
