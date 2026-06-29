# 测试步骤

## 测试目标

确认 V1 可以在店小秘页面内捕获关键接口，并将接口自动归类为后续自动执行器需要的候选接口。

## 测试前准备

- Chrome 已安装 Tampermonkey。
- 已安装并启用 `dianxiaomi-interface-detector.user.js`。
- 已登录店小秘账号。
- 准备一个低风险测试批次。

## 测试流程

1. 打开店小秘采集箱一级页面。
2. 确认右下角出现“店小秘自动化 V1”面板。
3. 刷新采集箱列表。
4. 进入一个模板产品编辑页。
5. 修改或保存模板产品。
6. 返回采集箱一级页面。
7. 打开助手设置。
8. 保存助手设置。
9. 点击开始。
10. 等待任务状态变化。
11. 点击暂停或结束。
12. 点击面板“导出 JSON”。

## 验收标准

导出的 JSON 中应至少出现以下接口候选中的多项：

- `模板保存接口`
- `采集箱列表接口`
- `助手设置接口`
- `开始接口`
- `暂停/结束接口`
- `任务状态接口`

每条记录应包含：

- URL
- method
- requestBody
- status
- responseText
- matches
- page.href

## 失败处理

- 如果面板没有出现，确认 Tampermonkey 脚本已启用，并刷新页面。
- 如果没有记录，确认页面操作触发了网络请求。
- 如果分类不准确，先保留 JSON，下一版根据真实 URL 和字段补充精确规则。
- 如果导出失败，可在浏览器控制台执行：

```javascript
window.__DXM_INTERFACE_DETECTOR_V1__.getRecords()
```

## 第二阶段调用测试

安装 `dianxiaomi-auto-executor.user.js` 后执行：

1. 打开店小秘页面，确认“店小秘自动执行 V1”面板出现。
2. 点击“导入探测器”或“粘贴 JSON”。
3. 确认以下动作显示“有候选”：
   - 自动保存模板
   - 自动返回采集箱
   - 自动刷新采集箱
   - 自动启动助手
   - 自动读取任务状态
   - 自动结束/暂停任务
4. 勾选“允许真实调用”。
5. 展开“单步调用”，逐项执行并观察状态码。
6. 单步调用成功后，点击“执行流程”。
7. 点击“导出报告”。

第二阶段验收标准：

- 报告中 `verifiedCallableInterfaces` 包含真实调用成功的接口。
- 每个成功接口包含 `url`、`method`、`verifiedAt`、`status`、`durationMs`。
- 响应为登录页或非 2xx 状态时，不得标记为已验证。

## V2 save.json 抓取测试

1. 禁用 V1 探测器。
2. 启用 `dianxiaomi-interface-detector-v2.user.js`。
3. 刷新店小秘页面，确认右下角出现 `店小秘探测器 V2`。
4. 清空 V2 记录。
5. 执行一次助手流程或单个测试产品提交流程。
6. 导出 `dxm-interface-v2-records-*.json`。

V2 验收标准：

- JSON 中出现 `POST /api/smtlocalProduct/save.json`。
- 该记录包含 `requestBodyKind: "formdata"`。
- 该记录包含 `requestBodyFields`。
- `requestBodyFields` 中 `name: "file"` 的字段应包含：
  - `size`
  - `type`
  - `text` 或 `textParse`
- 如果 `file` 是 JSON blob，`textParse.type` 应为 `json`。
