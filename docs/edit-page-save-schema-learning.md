# 编辑页保存 Schema 学习

## 当前结论

第一层“Amazon 到店小秘采集箱”只能把商品送到可编辑位置，不能保证属性、发货地、价格、库存、重量、尺寸已经正确保存。

第二层必须基于真实 `save.json` payload 做闭环：

```text
读取 edit.json
-> 构造 dry-run payload
-> 学习页面真实保存 payload
-> 对比缺字段和关键字段差异
-> 生成可复用保存结构
-> 保存后重新读取 edit.json 校验字段落库
```

## 为什么不能继续用 op=1 当保存验证

已确认采集箱流程里的 `op=1` 可能直接移入待发布，不是稳定的“编辑页补全保存”。如果用它做落库验证，会跳过真正的编辑页保存结构，后续批量上架风险很高。

所以主插件继续禁用 `op=1 移待发布(待学习)`，直到编辑页真实保存结构学会并验证通过。

## v1.1.15 已新增能力

主插件 `DXM Automation V1 - Merged v1.1.15` 新增：

- `学习真实保存payload` 按钮。
- 从 V3 抓包插件读取最新真实 `save.json` payload。
- 和当前 dry-run 生成的 `choiceSave` payload 做字段级对比。
- 输出 `save-payload-learning.json` 到 run 报告包。

V3 抓包插件 `0.6.1` 新增：

- 抓到的真实保存记录会暴露给主插件读取。
- 主插件不需要手工导入 JSON，就能读取同页面最新抓包记录。

## 学习报告关注字段

报告会重点检查：

- 真实 payload 有但自动 payload 缺失的字段。
- 自动 payload 有但真实 payload 没有的字段。
- `categoryId`
- `productPropertyListJson`
- `variationListStr`
- `optionValues`
- `optionValueIds`
- `shipFrom`
- `postageId`
- `deliveryTime`
- `detailMobile`
- `detailWeb`
- `op`

其中 `variationListStr` 会进一步汇总：

- SKU 数量
- 供货价
- 物流费
- 库存
- 重量
- 长宽高
- 是否带 United States 发货地

## 下一步执行方式

1. 更新并启用 V3 抓包插件 `0.6.1`。
2. 更新并启用主插件 `1.1.15`。
3. 打开一个速卖通海外托管采集箱商品的编辑页。
4. 主插件先执行：

```text
读取 edit.json
构造 dry-run
```

5. 页面上触发一次真实“保存”按钮，用 V3 捕获编辑页真实 `save.json` payload。
6. 主插件点击：

```text
学习真实保存payload
```

7. 下载 run 报告包，查看：

```text
save-payload-learning.json
```

## 验收标准

第一轮不要求真实发布，只要求完成学习闭环：

- 能捕获真实编辑页保存 payload。
- 主插件能读取到该 payload。
- 能生成字段差异报告。
- 能明确下一步是补字段、修字段格式，还是进入保存落库验证。

只有学习报告显示结构可对齐后，才进入：

```text
自动构造编辑页保存 payload
-> 调用 save.json
-> 重新读取 edit.json
-> 校验属性、发货地、价格、库存、重量、尺寸真实落库
```
