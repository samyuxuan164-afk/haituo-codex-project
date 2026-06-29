# 动态产品分类解析系统

## 目标

产品分类不能固定成 Bumpers，也不能要求每个新品类都人工学习一遍。系统必须按当前产品自动解析店小秘/速卖通海外托管发布类目：

```text
Amazon / edit.json 产品信息
-> 店小秘类目搜索接口候选
-> 候选评分与自动选择
-> 类目属性接口 schema
-> choiceSave / 编辑页保存 payload
```

## 正确原则

1. 已学习规则只是加速路径，不是唯一来源。
2. 新品类常规流程应该走自动搜索和自动拉取 schema。
3. 只有搜索低置信度、候选冲突、必填属性无法自动确定时，才进入人工确认队列。
4. `5050263-` 这类采集箱本地 fullCid 不是发布类目 ID，不能作为可发布 categoryId。
5. dry-run 必须阻断 `categoryResolver=unresolved` 和非数字发布类目 ID。

## 解析来源优先级

```text
1. learned_rules 精确 ASIN / 强关键词命中
2. 店小秘类目搜索接口候选
3. 店小秘类目属性接口 schema
4. edit.json 中已存在的有效数字 categoryId
5. manual_confirm_queue 低置信度人工确认
```

## 新品类自动流程

```text
打开产品编辑页
启用 save Payload V3 0.6.0+
点击“选择分类”
输入产品标题/核心关键词搜索
V3 自动记录类目搜索接口和候选响应
选中候选类目后，V3 自动记录类目属性接口响应
导出 V3 JSON
tools/analyze-category-api-records.py 提取候选类目和属性 schema
插件接入已发现的搜索/属性接口
后续同类或相近类目自动搜索、自动评分、自动拉 schema
```

## 工具

```text
tools/analyze-category-api-records.py
```

用途：

- 从 V2/V3 导出的接口记录中识别 `category_search_or_tree` 和 `category_attribute`。
- 提取候选类目 ID、名称、路径、原始响应位置。
- 提取属性 ID、属性名、是否必填、可选值预览。
- 判断下一步是 `wire_dynamic_category_search` 还是继续抓接口样本。

## 当前状态

已完成：

- Bumpers 规则保留为 learned rule。
- V1.1.9 已阻断未解析类目和非数字 categoryId，并在 dry-run 中接入店小秘类目搜索接口。
- V3 0.6.0 开始捕获类目搜索/类目属性相关接口。
- 新增类目接口分析工具。

待完成：

- 通过真实“选择分类”操作抓取店小秘类目搜索接口样本。
- 通过选中类目抓取属性接口样本。
- 继续增强属性 schema 自动填值；类目搜索已经接入主插件自动 resolver。

## 2026-06-25 店小秘类目优先规则

1. 类目选择必须以店小秘编辑页实际可见、可保存的类目为准，Amazon 标题或搜索关键词只作为辅助。
2. `Pen Holders` 只能作为类目映射规则，不能作为所有商品或所有 `Organizer` 商品的全局固定类目。
3. 仅当标题、图片、用途判断为桌面文具收纳、笔筒、`Pen Holder`、`Pencil Cup`、`Desk Pen Holder`、`Rotating Pen Organizer`、`Rotating Organizer for pencils / office supplies` 时，优先映射到：办公、文化及教育用品 > 桌上收纳用品 > 笔筒(Pen Holders)。
4. 这类商品优先搜索 `Pen Holders`、`笔筒`、`Pencil Holders`、`Pencil Cup`，不得优先用过泛的 `Organizers` 或错误的线缆收纳类目。
5. 仅出现 `Organizer` 不足以命中笔筒类目；线缆、化妆、浴室、厨房、抽屉、衣柜、文件等收纳必须重新判断实际类目。
6. Amazon 原始品类不能直接等同于店小秘平台类目；店小秘类目必须根据商品实际用途、实物形态、图片内容和标题语义重新判断。
7. 如果 Amazon 类目和店小秘类目不一致，以店小秘平台更贴近商品用途的类目为准；只有类目明显错误才拦截，名称不同但用途匹配可以通过。
8. 店小秘存在明确叶子类目时，必须选择叶子类目；没有高置信叶子类目时禁止保存并记录类目待确认。
