# 动态产品分类解析系统

## 目标

产品分类不能固定成 Bumpers，也不能要求每个新品类都人工学习一遍。当前主流程已经从“本地关键词/DeepSeek 推断类目”升级为“速卖通相似商品类目证据优先”：

```text
Amazon / edit.json 产品信息
-> 速卖通以图搜图 / 相似商品搜索
-> 读取速卖通相似商品类目 ID / 类目路径 / 标题相似度
-> 形成类目候选评分
-> 店小秘可见类目搜索确认
-> 候选评分与自动选择
-> 类目属性接口 schema
-> choiceSave / 编辑页保存 payload
```

## 正确原则

1. 速卖通相似商品类目证据是新品类主入口。
2. DeepSeek 只负责商品理解、属性抽取、风险归纳，不能作为最终类目裁判。
3. 已学习规则只是对“速卖通证据 / 店小秘可见路径验证成功”的缓存，不是旧关键词兜底。
4. 新品类常规流程应该先走速卖通图搜或相似商品搜索，再用店小秘可见类目确认。
5. 只有搜索低置信度、候选冲突、必填属性无法自动确定时，才进入人工确认队列。
4. `5050263-` 这类采集箱本地 fullCid 不是发布类目 ID，不能作为可发布 categoryId。
6. dry-run / 编辑页保存必须阻断 `categoryResolver=unresolved`、非数字发布类目 ID，或缺少速卖通类目证据的可见类目选择。
7. 类目异常处理细则以 `docs/exception-rules.md` 为准，尤其是安全相邻类目、DOM 点击不回填后的真实坐标双击、以及 `dxm_visible_category_not_found` 的记录边界。

## 解析来源优先级

```text
1. 速卖通以图搜图 / 相似商品搜索类目证据
2. 速卖通搜索结果结构化类目共识
3. 已沉淀的 AliExpress/DXM 可见类目证据规则
4. 店小秘可见类目搜索确认
5. 店小秘类目属性接口 schema
6. edit.json 中已存在的有效数字 categoryId
7. manual_confirm_queue 低置信度人工确认
8. 旧关键词规则仅作诊断，不允许直接自动保存
```

## v1.1.92+ 执行策略

1. 编辑页类目选择优先命中 `learned_rules.json` 中的活跃可见类目证据规则。
2. 没有已学规则时，不得等待人工确认，也不得直接停止批次。
3. 没有已学规则时，自动进入速卖通以图搜图 / 相似商品搜索 / 结构化搜索结果类目证据流程。
4. 取得速卖通类目证据后，回到店小秘编辑页搜索并选择最接近的可见叶子类目。
5. 旧的硬编码类目计划保留为代码参考，但默认不会被执行。
6. 如果速卖通相似商品类目严重分裂，记录 `category_evidence_split`，跳过当前商品并继续下一个。
7. 如果速卖通证据明确或成功沉淀规则匹配后，店小秘仍搜索不到同名可见类目，先判断是否存在不会明显错配的安全相邻类目；有安全相邻类目时可以选择该类目并记录 `safe_adjacent_dxm_category_selected`，没有安全相邻类目时才记录 `dxm_visible_category_not_found` 并继续下一个；没有速卖通证据时记录 `category_evidence_missing` / `needs_aliexpress_category_verification`。
8. 如果 AliExpress 验证页/风控阻断，记录 `aliexpress_verification_required`，跳过当前商品并继续下一个，除非整个批次依赖同一现场验证。
9. 成功保存到待发布并回读类目正确后，才把该商品族写入 `skills/category-resolver/learned_rules.json`，这一步才叫规则沉淀。
10. `aliexpress-evidence-required` 不是人工前置门槛；它是触发自动查证据的状态。

## AliExpress 类目证据通过线

1. AliExpress 搜索结果的 `postCategoryId` 共识占比 `>=80%`，且存在 DXM 候选类目时，记录为 `aliexpress_verified`，`confidenceTier=high_confidence`。
2. 共识占比 `50%-79%` 时，只能条件通过：必须同时满足用途/形态与搜索标题一致、无明显冲突、非风险品类；已有安全 DXM 候选类目时记录为 `conditional_verified`，`confidenceTier=medium_confidence`，不得混入高可信通过。缺少安全 DXM 候选类目时，不直接保存，记录 `dxm_category_validation_required`，进入店小秘只读类目验证。
3. 共识占比 `<50%` 时不得直接判死；必须进入标题语义二级判断。
4. `<50%` 但 AliExpress 标题语义、用途和形态高度一致时，不再直接记录为 `evidence_split`：
   - 先进入 AliExpress 详情页补证据：打开高度相似商品详情页，滚动到规格区域，读取 `类型` / `类别` / `产品类型` / `商品类型` / `专用工具类型` / `Product Type` / `Category` / `Special Tool Type`。
   - 如果 2 个详情页的类型一致或等价，例如都显示 `厨房水龙头配件`，记录 `detail_verified`，`confidenceTier=detail_low_confidence`，`verificationMode=detail_type_consensus`；该详情页类型可作为后续 DXM 分类弹窗的自动搜索依据。
   - 如果某个代表详情页只读到导航噪音（例如 `浏览/Browse`）、缺少类型字段或被 AliExpress 风控页拦截，不把这个噪音当成有效类型；工具可以继续检查后续同类候选，最多检查 5 个详情页，以凑够 2 个一致/等价的有效详情证据。
   - 如果详情页类型无法读取但搜索结果标题语义一致，不把产品判为最终失败，记录 `dxm_category_validation_required`，下一步进入店小秘只读类目搜索/编辑页 preflight 兜底；只有店小秘也找不到安全可回填类目时，才进入 `evidence_split` / `needs_manual_review`。
   - 如果已有安全 DXM 候选类目，也必须继续经过店小秘编辑页 final preflight；低置信证据不得跳过保存门禁。
5. 详情页补证据只要求 2 个高度相似产品一致，不要求打开更多页面；如果搜索结果特别混杂或 2 个详情页不一致，才进入人工复核或扩样。
6. 遇到 AliExpress 真人验证、滑块验证、验证码或风控页时，不自动绕过；记录 `aliexpress_verification_required`、链接和截图，关闭页面并继续下一个 ASIN。
7. 只有 `postCategoryId` 分散、标题语义也分散、详情页类型不一致/缺失、用途冲突、店小秘只读类目验证也找不到安全可回填类目，或风险筛查不通过时，才记录 `evidence_split` / `needs_manual_review`。
8. 条件通过和详情页通过可以进入后续价格/编辑 preflight 门禁，但报告必须保留 `conditional_verified` / `low_confidence` / `semantic_low_confidence` / `detail_low_confidence` 标记；最终保存仍必须满足编辑页 final preflight。
9. 风险品类筛查优先级高于条件通过；风险筛查未通过时，即使 AliExpress 证据达到条件通过或详情页通过，也不得进入编辑保存。

## 速卖通账号与浏览器会话

1. 默认只使用一个稳定的速卖通登录账号和一个固定 Chrome 用户环境。
2. 不建议为了自动化准备多个速卖通账号轮换使用；多账号会增加风控、验证码、登录状态混乱和账号安全风险。
3. 可以准备一个备用账号，但只作为主账号异常、被风控或无法访问时的人工切换，不作为自动轮换池。
4. 用户负责登录、验证码和账号安全；项目代码不得保存速卖通账号、密码、Cookie 或二次验证信息。
5. 建议在 Chrome 书签栏固定速卖通首页、速卖通搜索页和店小秘页面，保持同一个 Chrome Profile 长期登录。
6. 浏览器自动化只复用用户已经登录的真实会话，不绕过验证码；遇到验证页时记录为 `aliexpress_verification_required`，关闭当前页面，继续处理后续 ASIN，批次结束后输出人工验证队列。

## 类目知识复用策略

1. 已经上架成功或保存到待发布且类目回读正确的商品族，必须沉淀到 `skills/category-resolver/learned_rules.json`。
2. 后续同类商品命中 active learned rule 时，直接使用知识库里的 `visibleCategorySearchTerms` 和 `categoryPath` 填写店小秘分类，不再重复跑速卖通图搜。
3. 只有以下情况才重新跑速卖通图搜 / 相似商品验证：
   - 商品族不在知识库；
   - 知识库命中多个冲突类目；
   - 商品标题/图片/用途与已沉淀规则不一致；
   - 店小秘可见类目搜索不到知识库路径；
   - 保存或发布前检查提示类目/属性错误；
   - 平台类目疑似调整。
4. 批量运行时，类目验证分两层：
   - 首次新品类：走速卖通图搜 / 相似商品证据，成功后沉淀。
   - 已知类目：直接调用知识库，进入店小秘填写。
5. 为防止知识库漂移，批量任务可以按商品族抽样复核；抽样不阻塞同类商品正常执行，除非发现类目错误。
6. 规则沉淀是执行后的复用动作，不是新品类执行前的人工门槛。
7. 速卖通证据用于限定商品家族，不要求店小秘叶子类目名称完全一致；店小秘没有精确类目时，可选择符合用途/形态且风险更低的相邻可见类目。例如硅胶隔热垫/锅垫/热垫没有精确 `Pot Holders/Trivets` 时，优先安全相邻 `餐垫(Placemats)`，不要选杯具专用 `杯垫(Coaster)` 或茶壶专用 `茶壶底座(Teapot Trivets)`。

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
