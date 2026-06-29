---
name: dxm-collection-automation
description: Default collection and duplicate handling rules for Amazon Crawlbox to Dianxiaomi collection box automation.
---

# 店小秘自动上架采集规则

## 采集去重口径

1. 同一款产品不同颜色允许进入采集流程。
2. 同一款产品不同颜色视为不同 SKU，不属于重复商品。
3. 不得因为同款不同色而过滤候选商品。
4. 只过滤完全相同的 Amazon 链接、完全相同的 ASIN、完全相同的颜色/尺寸/套餐组合。
5. 已采集、已认领、已发布或已排除的完全相同商品，默认跳过。

## 默认采集任务

1. 价格区间默认值：5-20 USD，可按任务配置调整。
2. 目标数量默认值：100 个商品，可按任务配置调整。
3. 每个品类上限默认值：15 个商品，可按任务配置调整。
4. 同一品类内尽量保证商品多样性。
5. 当前品类不足时切换下一个品类补齐，不重复采集旧商品。

## 2026-06-25 V1 Freeze

1. 当前采集插件版本为 `DXM Amazon Crawlbox V1 v0.1.21`。
2. 当前 3 x 10 稳定性验证因 `Environment Control Exception` 暂停，不计入采集业务失败。
3. Mac 迁移后继续验证：3 个不同品类，每个品类 10 个真实商品，总计 30 个。
4. 只验证 Amazon 商品 -> 采集箱 -> 认领 -> 编辑页自动填写 -> 保存 -> 待发布，不执行最终发布。
