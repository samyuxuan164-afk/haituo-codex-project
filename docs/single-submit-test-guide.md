# 单品真实提交测试说明

## 当前目标

用 1 个采集箱测试产品验证 `save.json` 是否可以替代页面助手提交。

脚本文件：

`src/dianxiaomi-automation-v1-merged.user.js`

## 安全规则

脚本加载后默认不会提交产品。

以下按钮是安全按钮：

- `读取第1条草稿`
- `读取 edit.json`
- `构造 dry-run`
- `下载 zip`
- `下载报告`

只有点击 `真实提交 1 个` 才会调用：

`POST /api/smtlocalProduct/save.json`

真实提交按钮默认禁用，必须同时满足：

1. `dry-run` 通过。
2. 已点击 `补全保存 op=1`。
3. `op=1落库` 显示 `已落库`。
4. 勾选 `我确认只提交 1 个测试产品`。
5. 输入确认码：`SUBMIT-ONE`
6. 再确认浏览器弹窗。

## 操作步骤

1. 在 Tampermonkey 新建脚本，粘贴 `dianxiaomi-automation-v1-merged.user.js`，保存启用。
2. 打开店小秘采集箱一级页面，确认只有准备测试的产品排在最前面。
3. 点击右下角 `店小秘自动化系统 V1` 的 `读取当前第1条`。
4. 点击 `读取 edit.json`。
5. 点击 `构造 dry-run`。
6. 如果显示 `dry-run 通过`，点击 `补全保存 op=1`。
7. 等待 `op=1落库` 显示 `已落库`。
8. 点击 `下载run报告包`，保存 op=1 阶段证据。
9. 如需真实发布，勾选确认框，输入 `SUBMIT-ONE`，再点击 `真实提交 1 个`。
10. 提交后再次点击 `下载run报告包`。
11. 检查店小秘后台：发布中、发布失败、在线产品。

## 判定标准

成功：

- `save.json` 返回 `code: 0`。
- 返回信息类似：产品已提交发布。
- 产品进入发布中或在线产品。

失败：

- `save.json` 返回非 0。
- 产品进入发布失败。
- 页面提示类目、物流、价格、合规字段错误。

失败时必须导出：

- run 报告包 zip。
- V2 探测器 JSON。
- 店小秘发布失败错误截图。

## 报告包内容

`下载run报告包` 会导出一个 zip，内部目录名为：

```text
YYYYMMDD-HHMMSS-<productId>/
```

至少包含：

```text
final-report.json
dry-run-report.json
choiceSave.txt
choiceSave.pretty.json
input-edit.json
```

执行 `op=1` 后还会包含：

```text
op1-save-response.json
after-op1-edit.json
op1-persistence-report.json
```

执行 `op=2` 后还会包含：

```text
op2-save-response.json
```
