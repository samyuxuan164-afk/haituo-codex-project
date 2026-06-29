# 执行报告结构

每次真实执行都必须保存一个独立 run 目录，目录名建议使用时间和产品 ID：

```text
runs/YYYYMMDD-HHMMSS-<productId>/
```

## 必留文件

```text
input-edit.json
choiceSave.txt
choiceSave.pretty.json
choiceSave.zip
dry-run-report.json
op1-save-response.json
after-op1-edit.json
op1-persistence-report.json
op2-save-response.json
final-report.json
```

## final-report.json

```json
{
  "runId": "20260622-120000-167487781997719279",
  "category": "bumpers-v2",
  "productId": "167487781997719279",
  "asin": "B0DGTDW7ZL",
  "stage": "single-product",
  "taskConfig": {
    "stock": 15,
    "exchangeRate": 7,
    "priceMultiplier": 1.55,
    "defaultWeightKg": 0.1
  },
  "valueSources": {
    "sku": "amazon.asin",
    "price": "amazon.price * task.exchangeRate * task.priceMultiplier",
    "weight": "amazon.weightKg || defaultWeightKg",
    "dimensions": "amazon.dimensionsIn * 2.54"
  },
  "dryRun": {
    "pass": true,
    "riskCount": 0
  },
  "op1": {
    "called": true,
    "success": true,
    "persisted": true
  },
  "op2": {
    "called": true,
    "success": true,
    "responseCode": 0
  },
  "result": "success",
  "failureReason": ""
}
```

## 执行原则

1. `dry-run` 不通过，不允许调用 `op=1`。
2. `op=1` 返回成功后，必须重新读取 `edit.json`。
3. `op1-persistence-report.json.persisted != true`，不允许进入 `op=2`。
4. `op=2` 返回成功不等于最终成功，还要检查商品是否进入发布中、发布失败或在线产品。
5. 失败原因必须写入 `final-report.json.failureReason`，不能只看页面提示。
