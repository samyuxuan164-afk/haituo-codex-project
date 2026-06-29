# 3.json save.json Payload 分析

## 结论

`3.json` 已成功抓到 `save.json` 的真实 `file/blob` 内容。

关键接口：

```text
POST /api/smtlocalProduct/save.json
```

请求体：

```text
multipart/form-data
file = application/zip
op = 2
```

V2 抓到的 `file`：

```text
fileName: blob
type: application/zip
size: 3035
capturedBytes: 3035
truncated: false
```

解压后：

```text
choiceSave.txt
```

`choiceSave.txt` 是完整 JSON payload。

## Payload 顶层字段

已解析出 32 个顶层字段：

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

## 关键字段说明

基础信息：

```text
shopId = 8438115
categoryId = 200291142
subject = 产品标题
sourceUrl = Amazon 来源链接
fullCid = 5050263-
currencyCode = USD
dxmState = draft
id = 店小秘草稿产品 ID
productId = null
op = 2
```

属性：

```text
productPropertyListJson
```

其中已包含：

```text
Brand Name = None
High-concerned chemical = 天然未处理(None)
Origin = 美国(Origin)(US(Origin))
```

图片：

```text
mainImageListJson
imgUrl
marketImage1
marketImage2
```

SKU / 价格 / 库存 / 尺寸：

```text
variationListStr
```

本次只有 1 个 SKU，包含：

```text
skuCode
gloGoodsValue
supplyPrice
sellableQuantity
packageWeight
packageLength
packageWidth
packageHeight
skuPropertyListJson
```

详情：

```text
detailMobile
detailWeb
```

物流：

```text
deliveryTime
postageId
```

合规：

```text
aeopQualificationStructListJson
msrEuId
msrTrId
manufactureId
```

## 页面跳转链路

V2 记录显示，助手/流程链路为：

```text
/web/smtlocalProduct/edit?id=...&task
→ 编辑页内生成图片、价格、详情
→ 点击发布
→ POST /api/smtlocalProduct/save.json
→ save.json 返回成功
→ 进入下一条 /edit?id=...&task
```

因此，店小秘“批量助手”更像是前端逐条打开编辑页并提交 `save.json`，而不是一个单独的后端批量发布接口。

## 是否可以绕过助手直接调用 save.json

结论：**可以进入可实现阶段，但需要先做一次安全验证。**

现在已经具备直接构造请求所需的核心结构：

```text
FormData
  file: zip(choiceSave.txt)
  op: 2
```

但直接调用前还要验证 3 点：

1. `choiceSave.txt` 内的 `id` 是否必须是当前草稿箱有效产品 ID。
2. 图片 URL 是否必须先经过上传/回调生成到 `wxalbum`。
3. `postageId`、`categoryId`、属性值是否可以跨产品复用。

如果这 3 点成立，自动执行器可以绕过页面助手，直接：

```text
读取草稿产品 edit.json
生成 choiceSave.txt
压缩为 zip
FormData 提交 save.json
进入下一条
```

## 下一步方案

第一步：开发 `save.json` payload 构造器。

功能：

```text
edit.json product → choiceSave payload
choiceSave payload → choiceSave.txt
choiceSave.txt → zip blob
zip blob + op=2 → save.json
```

第二步：先只做测试模式。

测试模式只对 1 个测试产品执行：

```text
生成 payload
不提交
导出 payload zip
与真实 V2 payload diff
```

第三步：通过 diff 后，再开启真实提交。

## 已生成解析文件

本次已解压保存：

```text
work/dianxiaomi-automation-v1/analysis/save-json-3/save-file.zip
work/dianxiaomi-automation-v1/analysis/save-json-3/choiceSave.txt
work/dianxiaomi-automation-v1/analysis/save-json-3/choiceSave.pretty.json
```
