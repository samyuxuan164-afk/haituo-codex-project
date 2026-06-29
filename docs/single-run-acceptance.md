# 单品真实验证验收规则

本阶段目标是证明 1 个 Bumpers 测试产品可以通过主流程真实完成：

```text
edit.json
→ choiceSave.txt
→ save.json op=1
→ edit.json 落库校验
→ save.json op=2
→ run 报告包验收
```

## 输入

从合并版插件导出的 run 报告包：

```text
YYYYMMDD-HHMMSS-<productId>.zip
```

## 本地验收命令

```text
python tools/analyze-run-bundle.py runs/YYYYMMDD-HHMMSS-<productId>.zip ^
  --extract-to runs/YYYYMMDD-HHMMSS-<productId> ^
  --out runs/YYYYMMDD-HHMMSS-<productId>/acceptance-report.json
```

## 通过条件

1. `dry-run-report.json.pass == true`
2. `op1-save-response.json.code == 0`
3. `op1-persistence-report.json.persisted == true`
4. `op2-save-response.json.code == 0`
5. `final-report.json.result == "success"`
6. `choiceSave.pretty.json` 中 SKU / 货值 / 物流费 / 库存 / 重量 / 尺寸完整

通过后：

```text
readyForFiveItemValidation = true
nextAction = start_5_item_bumpers_validation
```

## 失败处理

如果失败，禁止直接进入 5 条验证。按顺序排查：

1. 对比 `op1-save-response.json`
2. 对比 `choiceSave.pretty.json`
3. 对比 `after-op1-edit.json`
4. 查看 `op1-persistence-report.json.issues`
5. 修复字段结构或插件逻辑

## 进入 5 条验证前的人工确认

即使工具通过，也要确认店小秘后台状态：

```text
发布中 / 在线产品 / 发布失败
```

如果商品进入发布失败，需要把失败原因补进该 run 的最终记录，不能只依赖 `save.json code == 0`。
