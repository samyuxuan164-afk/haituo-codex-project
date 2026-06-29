# 探测器 V2 与 save.json 分析

## 1. save.json 结构分析

基于 `1.json` 和 `2.json`，两次真实记录都显示店小秘助手执行过程中最终会进入产品编辑页，并调用：

```text
POST /api/smtlocalProduct/save.json
```

请求外层结构：

```text
multipart/form-data
file = Blob/File
op = 2
```

旧探测器记录到的请求体示例：

```text
[["file","[File:blob:2139]"],["op","2"]]
[["file","[File:blob:2745]"],["op","2"]]
```

响应示例：

```json
{
  "code": 0,
  "msg": "产品已提交发布，请在「发布中」、「发布失败」或「在线产品」中查看！",
  "data": "167487781997716055"
}
```

判断：

- `save.json` 是真实提交发布接口。
- `op=2` 高概率代表提交发布动作。
- `file` 字段里承载了真实产品提交数据。
- 旧探测器没有展开 `file` 的 blob 内容，因此不能从旧 JSON 反推出完整提交参数。

## 2. FormData / blob 解析结果

旧 JSON 中只能看到：

```text
file: [File:blob:<size>]
op: 2
```

这说明旧探测器只记录了 File 元信息，没有读取 File 内容。

V2 已新增：

- `requestBodyKind`
- `requestBodyText`
- `requestBodyFields`
- FormData 字段逐项展开
- File/Blob 的 `name`、`type`、`size`
- 文本型 blob 的完整 `text`
- JSON blob 的 `textParse`
- 非文本小 blob 的 `base64Preview`

如果 `save.json` 的 `file` 实际是 JSON 或文本，V2 会直接导出其内容。

## 3. 页面跳转链路判断

两份真实记录的链路都符合：

```text
/web/smtlocalProduct/draft
→ /web/smtlocalProduct/edit?id=...&task
→ 上传/回调图片
→ POST /api/smtlocalProduct/save.json
→ 返回/继续下一个编辑页或刷新状态
```

这表明店小秘助手可能不是调用一个独立的“批量开始后端接口”，而是通过前端任务流逐个打开产品编辑页，再调用单品提交接口。

因此：

- 看见 `/edit?id=...&task` 不一定表示用户点错。
- 它可能是助手批量流程内部自动打开的任务页。
- 当前真正需要破解的是 `save.json` 的 FormData `file` 内容。

## 4. 是否可以绕过助手直接调用 save.json

当前结论：**可能可以，但还不能直接做。**

已确认：

- `save.json` 是可调用的真实提交发布接口。
- 请求结构是 FormData。
- 成功响应能返回产品 ID。

未确认：

- `file` blob 的完整字段结构。
- `file` 中是否包含一次性 token、时间戳、签名或页面临时态。
- 是否必须先执行图片上传和 `cosDxmCallBack`。
- 是否必须先进入编辑页加载 `edit.json`、类目属性、品牌、物流模板等依赖。

所以在 V2 抓到 blob 内容前，不建议直接构造 `save.json`。

## 5. 下一步可执行方案

### 方案 A：用 V2 再抓一次助手流程

安装：

```text
src/dianxiaomi-interface-detector-v2.user.js
```

然后抓一次助手执行流程。V2 导出的 JSON 应重点检查：

```text
POST /api/smtlocalProduct/save.json
requestBodyFields[].name == "file"
requestBodyFields[].text
requestBodyFields[].textParse
```

如果 `file.textParse.type == "json"`，即可进入自动执行器开发。

### 方案 B：基于 edit.json + V2 save.json blob 反推提交模板

需要对比：

- `/api/smtlocalProduct/edit.json?id=...`
- `/api/smtlocalProduct/save.json` 的 blob JSON

目标：

- 找出编辑页原始 product 到 save payload 的字段映射。
- 保留必要字段。
- 删除无关图片/SKU/物流字段。
- 自动批量构造 FormData。

### 方案 C：先不绕过助手，只自动驱动助手内部链路

如果 `save.json` 中存在强临时态，短期可先做：

```text
接口读取采集箱产品列表
自动打开 /edit?id=...&task
让页面生成 save blob
拦截并复用/改写 save.json
自动进入下一条
```

这仍然能减少截图和人工判断，但速度不如纯接口调用。

## 当前阻塞点

唯一阻塞点：

```text
旧 JSON 没有展开 save.json 的 file blob 内容。
```

V2 已解决采集能力。下一份 V2 JSON 能决定是否可以直接绕过助手调用 `save.json`。
