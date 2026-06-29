# Bumpers 5 条稳定验证计划

进入条件：

```text
tools/analyze-run-bundle.py 输出 readyForFiveItemValidation = true
```

## 目标

验证同一品类 Bumpers 下，5 个不同采集箱产品可以重复完成：

```text
dry-run
→ op=1 保存落库
→ edit.json 验证 SKU / 变种字段
→ op=2 发布
→ run 报告包验收
```

## 每条产品必须保留

```text
runs/<run-id>.zip
runs/<run-id>/acceptance-report.json
```

`acceptance-report.json` 必须满足：

```text
issues = []
readyForFiveItemValidation = true
nextAction = start_5_item_bumpers_validation
```

## 批次验收命令

5 个 run 包都放到 `runs/5-item-bumpers-001/` 后执行：

```text
python tools/analyze-five-runs.py ^
  --runs-dir runs/5-item-bumpers-001 ^
  --extract-to runs/5-item-bumpers-001/extracted ^
  --out runs/5-item-bumpers-001/batch-report.json
```

批次通过时：

```text
readyForTenItemValidation = true
nextAction = start_10_item_validation
```

## 5 条汇总字段

每条记录至少汇总：

```text
runId
productId
asin
skuCount
categoryId
postageId
op1.success
op1.persisted
op2.success
result
failureReason
```

## 失败分类

失败时先归类，不直接改业务流程：

```text
dry_run_failed
op1_save_failed
op1_not_persisted
op2_save_failed
platform_publish_failed
missing_amazon_weight
missing_amazon_dimensions
category_schema_mismatch
variation_schema_mismatch
```

## 通过条件

```text
5 条中至少 5 条 dry-run 通过
5 条中至少 5 条 op=1 返回成功
5 条中至少 5 条 op=1 落库成功
5 条中至少 5 条 op=2 返回成功
0 条因 SKU / 货值 / 物流费 / 库存 / 重量 / 尺寸缺失失败
0 条 SKU 重复
0 条 ASIN 与 SKU 不一致
```

通过后才能进入：

```text
10 条验证
→ 20 条验证
→ 50 条验证
```

## 禁止

1. 单品验收未通过时进入 5 条。
2. 5 条未全部保留报告包。
3. 根据页面感觉判断成功，不看 `save.json` 和报告。
4. 遇到字段没落库时直接改流程，必须先 diff Schema。
