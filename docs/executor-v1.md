# 自动执行器 V1

## 目标

第二阶段从“记录接口”升级为“调用接口”。执行器读取第一阶段捕获的接口记录，在店小秘登录页面内复用浏览器登录态，真实调用接口完成动作验证。

## 优先动作

1. 自动保存模板
2. 自动返回采集箱
3. 自动刷新采集箱
4. 自动启动助手
5. 自动读取任务状态
6. 自动结束/暂停任务

## 脚本文件

```text
src/dianxiaomi-auto-executor.user.js
```

## 接口来源

执行器支持三种接口来源：

- 当前页面已安装并运行探测器时，点击“导入探测器”。
- 粘贴第一阶段导出的 JSON。
- 使用执行器自身保存的接口库。

## 调用方式

执行器使用浏览器原生 `fetch` 发起调用：

```javascript
fetch(url, {
  method,
  headers,
  body,
  credentials: 'include',
  cache: 'no-store',
  redirect: 'follow'
})
```

关键点：

- `credentials: 'include'` 用于复用当前店小秘登录态。
- 自动过滤 `cookie`、`content-length`、`host`、`origin`、`referer`、`user-agent` 等浏览器禁止手工设置的请求头。
- GET/HEAD 请求不携带 body。
- POST 请求默认复用探测器捕获的 `requestBody`。
- 返回 2xx 且响应不像登录页时，标记为“已验证可调用”。

## 已验证可调用的接口

本地开发环境无法登录用户店小秘账号，也没有第一阶段导出的真实接口 JSON，因此不能伪造“店小秘真实接口已验证”的结果。

执行器已经实现实际调用验证机制。安装后在店小秘页面中完成以下验证，报告会自动列出已验证可调用接口：

- `template_save`
- `return_collection`
- `collection_refresh`
- `start`
- `task_status`
- `pause_or_finish`

验证结果保存在执行器面板和导出的 `dxm-executor-report-*.json` 中。

## 接口参数说明

### 通用参数

| 参数 | 来源 | 说明 |
| --- | --- | --- |
| `url` | 探测记录 | 实际接口地址，支持相对地址和绝对地址 |
| `method` | 探测记录 | `GET`、`POST` 等请求方法 |
| `requestHeaders` | 探测记录 | 请求头，执行器会过滤浏览器禁止设置的字段 |
| `requestBody` | 探测记录 | 原始请求体，POST 类接口默认复用 |
| `credentials` | 执行器固定值 | 固定为 `include`，复用登录态 |

### 动作映射

| 动作 | 候选接口类型 | 参数策略 |
| --- | --- | --- |
| 自动保存模板 | `template_save` | 复用模板保存接口的 URL、method、requestBody |
| 自动返回采集箱 | `collection_list` | 优先跳转到该记录捕获时的 `page.href` |
| 自动刷新采集箱 | `collection_list` | 调用列表接口刷新数据 |
| 自动启动助手 | `start` | 复用开始接口的 URL、method、requestBody |
| 自动读取任务状态 | `task_status` | 调用状态接口读取响应 |
| 自动结束/暂停任务 | `pause_or_finish` | 复用暂停、停止或结束接口 |

## 测试步骤

1. 安装并启用 `dianxiaomi-interface-detector.user.js`。
2. 在店小秘中完成一轮人工动作，捕获接口。
3. 安装并启用 `dianxiaomi-auto-executor.user.js`。
4. 刷新店小秘页面。
5. 在执行器面板点击“导入探测器”；如果没有探测器对象，点击“粘贴 JSON”。
6. 确认六个动作显示为“有候选”。
7. 勾选“允许真实调用”。
8. 先逐个点击“单步调用”验证：
   - 自动保存模板
   - 自动刷新采集箱
   - 自动启动助手
   - 自动读取任务状态
   - 自动结束/暂停任务
9. 单步成功后，点击“执行流程”。
10. 点击“导出报告”，保存测试结果。

## 测试结果

本地代码验证：

- `dianxiaomi-interface-detector.user.js` 语法检查通过。
- `dianxiaomi-auto-executor.user.js` 语法检查通过。

真实接口验证：

- 需要在已登录店小秘页面内运行。
- 需要导入第一阶段捕获的真实接口记录。
- 执行器会把真实调用成功的接口写入 `verifiedCallableInterfaces`。

## 风险控制

- 默认不允许真实调用，必须勾选“允许真实调用”。
- 支持单步调用，避免直接跑完整流程。
- 每次调用都记录 URL、方法、状态码、响应摘要、耗时。
- 响应疑似登录页时不会标记为验证成功。
