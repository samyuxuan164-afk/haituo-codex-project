# Payload 构造测试报告

## 目标

本阶段只做 dry-run，不调用真实 `save.json`，不影响真实商品。

目标：

1. 读取真实 `choiceSave.txt` 样本。
2. 构造新的 `choiceSave.txt`。
3. 压缩成 zip。
4. 生成与 `save.json` 一致的 FormData manifest：
   - `file = zip`
   - `op = 2`
5. 与 `3.json` 的真实 payload 做 diff。

## 已完成工具

### Payload 构造器

```text
tools/build-save-payload-dry-run.py
```

功能：

- 从真实 `choiceSave.pretty.json` 构造 payload。
- 生成 `choiceSave.txt`。
- 压缩为 `choiceSave.zip`。
- 输出 dry-run FormData manifest。
- 支持字段覆盖：

```text
--set id="..."
--set subject="..."
```

当前不会提交任何接口。

### Diff 工具

```text
tools/diff-save-payload.py
```

功能：

- 比较真实 payload 与构造 payload。
- 自动展开嵌套 JSON 字符串字段：
  - `productPropertyListJson`
  - `mainImageListJson`
  - `optionValues`
  - `variationListStr`
  - `detailMobile`
  - `aeopQualificationStructListJson`
- 输出：
  - 字段差异
  - 缺失字段
  - 多余字段
  - 风险字段差异
  - 是否通过

### V2 JSON 解包工具

```text
tools/analyze-v2-save-json.py
```

功能：

- 从 V2 JSON 中提取 `save.json`。
- 解出 `file = application/zip`。
- 解压 `choiceSave.txt`。
- 输出 pretty JSON 和 summary。

## Dry-run 测试结果

使用真实样本：

```text
work/dianxiaomi-automation-v1/analysis/save-json-3/choiceSave.pretty.json
```

生成：

```text
work/dianxiaomi-automation-v1/analysis/dry-run-3/choiceSave.txt
work/dianxiaomi-automation-v1/analysis/dry-run-3/choiceSave.zip
work/dianxiaomi-automation-v1/analysis/dry-run-3/formdata-manifest.json
work/dianxiaomi-automation-v1/analysis/dry-run-3/diff-report.json
```

Diff 结果：

```json
{
  "fieldCounts": {
    "real": 32,
    "candidate": 32
  },
  "missingTopFields": [],
  "extraTopFields": [],
  "riskFieldDiffs": [],
  "diffCount": 0,
  "pass": true
}
```

结论：

```text
构造器可以 1:1 复现真实 choiceSave payload。
```

说明：

- zip 文件大小不要求与真实 zip 完全相同，因为压缩元数据/时间戳可能不同。
- 判断标准是解压后的 `choiceSave.txt` JSON 内容一致。

## 字段差异

本次 dry-run 回放无字段差异：

```text
缺失字段：0
多余字段：0
值差异：0
风险字段差异：0
```

## 风险字段

真实提交前必须重点检查：

```text
id
shopId
categoryId
productPropertyListJson
mainImageListJson
imgUrl
marketImage1
marketImage2
variationListStr
detailMobile
detailWeb
postageId
aeopQualificationStructListJson
msrEuId
msrTrId
```

原因：

- `id` 必须是当前草稿箱有效产品 ID。
- 图片字段必须对应当前产品，不可跨产品复用。
- `variationListStr` 决定 SKU、价格、库存、重量、尺寸。
- `postageId` 必须是当前店铺可用物流模板。
- 合规字段错误可能导致发布失败。

## 当前能力边界

已验证：

- V2 可以抓到真实 `save.json` 的 zip payload。
- 工具可以解压 `choiceSave.txt`。
- 工具可以重新构造同内容 `choiceSave.txt` 和 zip。
- dry-run FormData 结构已明确。

未验证：

- 从任意新产品 `edit.json` 自动生成完整可提交 payload。
- 直接调用 `save.json` 是否需要页面临时状态。
- 图片上传链路能否完全接口化复现。

## 下一步是否可以做单品提交测试

可以进入 **单品提交测试准备阶段**，但建议先做一个更安全的中间测试：

1. 准备 1 个新的测试草稿产品。
2. 用 V2 抓取该产品助手生成的真实 payload。
3. 用构造器从该真实 payload 回放生成 zip。
4. diff 通过后，才开启单品真实提交。

单品真实提交测试必须满足：

- 只对 1 条测试产品执行。
- 产品主图无 Logo/商标。
- 使用 dry-run 生成的 zip。
- 调用前再次确认 payload `id` 是该测试产品 ID。
- 调用后检查返回 `code == 0`。

## 真实提交方案草案

后续真实提交器的请求结构：

```javascript
const formData = new FormData();
formData.append("file", zipBlob, "blob");
formData.append("op", "2");

await fetch("/api/smtlocalProduct/save.json", {
  method: "POST",
  credentials: "include",
  body: formData
});
```

当前阶段没有执行这段代码。
