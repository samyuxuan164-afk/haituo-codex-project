# 异常规则库

本文件是店小秘自动上架项目的异常规则统一入口。后续执行、调试和验证准备时，如果聊天记录、临时日志或旧报告与本文件冲突，以 `AGENT.md`、当前 `TASK.md` 和本文件为准。

当前状态：异常规则库统一整理 / Validation 准备。

适用边界：

1. 本规则库只约束采集箱、认领后编辑页、保存到待发布、发布前检查和环境控制异常的判定。
2. 不授权重新采集、重新认领、最终发布、一键发布或处理 `产品开发 / 草稿箱`。
3. 业务状态读回以店小秘权威列表为准，例如 `/web/smtlocalProduct/offline` 的待发布列表。

## 0. 认领弹窗店铺列表加载异常

1. 批量认领弹窗中，如果 `速卖通海外托管` 分组下没有出现目标店铺 `Halo Home Store`，且弹窗只显示骨架屏 / `render-skeleton` / `已选(0)`，先归类为页面加载或环境控制异常，不直接归类为业务失败。
2. 恢复步骤：关闭认领弹窗，刷新店小秘采集页，重新只勾选当前批次已锁定 ASIN 行，再重新打开批量认领弹窗。
3. 重试后必须重新读回：
   - 仍然只选中当前批次行；
   - 旧行未被选中；
   - `Halo Home Store` 位于 `速卖通海外托管` 分组下；
   - `已选(1)`。
4. 只有满足上述读回后，才允许点击认领弹窗 `确定`。
5. 不得选择 `产品开发`、`草稿箱`、普通 `速卖通` 店铺或分组 `全选` 作为替代。
6. 如果刷新重试后仍不出现目标店铺，记录 `claim_store_list_render_skeleton` / `environment_control_exception`，跳过本批认领或等待恢复；不得点击 `确定`。

## 1. 下拉字段规则

1. Ant/select 下拉字段的输入框只是搜索/过滤入口，不是最终提交值。
2. 必须点击真实下拉选项对象，并读回已选 label / selected item；只有输入框里有文字不算完成。
3. Function / Use / Feature 默认先打开下拉并读取店小秘推荐可见选项，不默认输入搜索词。
4. 只有推荐可见选项里没有安全项时，才允许搜索/过滤。
5. 搜索后如果出现 `暂无数据`，先清空搜索词，恢复推荐选项，再判断是否失败。
6. Function / Use / Feature 等动态下拉在点击真实选项后，不要再用 Enter/Tab 二次确认；Enter/Tab 可能让页面显示后台 option ID。
7. 如果读回显示纯数字或内部 ID，例如 `23399620951`，必须判定为未安全提交：清空字段并用真实选项 click-only 方式重选一次。
8. `Other/其他` 是合法兜底选项。对 Function / Use / Feature 这类通用必填项，不要为了追求更漂亮选项阻塞批次；但不能选择明显错误选项。
9. 明显错误选项必须拒绝，例如固定尺寸瓶罐不能选 `Adjustable Size`，没有防水证据不能选 `Waterproof`。
10. 下拉字段失败只有在关闭旧浮层、打开目标字段、清空搜索词、读取推荐选项、尝试真实选项且仍无法读回 label 后，才记录为 `product_attribute_dropdown_selection_failed`。

## 2. 类目规则

1. 类目必须基于 AliExpress / 相似产品 / 已验证店小秘可见规则证据，不能只凭 DeepSeek、旧关键词或聊天判断直接保存。
2. DeepSeek 只负责商品理解、属性抽取、标题清洗和风险归纳，不作为最终类目裁判。
3. 店小秘没有完全一致叶子类目时，可以选择安全相邻类目。
4. 安全相邻类目的原则是：同用途、同形态、不会明显出错；不要求和速卖通证据类目名称完全一致。
5. 安全相邻类目必须记录为 `safe_adjacent_dxm_category_selected`，并在待发布读回后沉淀到 `skills/category-resolver/learned_rules.json`。
6. 例如硅胶隔热垫 / 锅垫 / hot pad 没有精确 `Pot Holders/Trivets` 时，可选 `餐垫(Placemats)`；不要选杯具专用 `杯垫(Coaster)` 或茶壶专用 `茶壶底座(Teapot Trivets)`。
7. 类目搜索结果如果 DOM click 不回填主表单，允许使用真实坐标双击精确 search-result row，但必须验证主表单类目已写回。
8. 不能把“店小秘搜索失败”直接当业务失败；只有已有上游证据、足够搜索尝试且没有安全相邻类目时，才记录 `dxm_visible_category_not_found`。
9. 没有 AliExpress / 相似商品 / 已验证规则证据时，记录 `category_evidence_missing` / `needs_aliexpress_category_verification`，不得直接记录店小秘无类目。
10. ASIN 级 AliExpress 证据批量入库闭环入口为 `tools/aliexpress-evidence-batch.js closure`；它必须输出导入预览/写入结果、证据库读回、有效证据状态、阻断原因和下一步 ASIN 列表。
11. 正式 `runs/aliexpress-evidence-store.json` 写入必须先 dry-run 取得确认 token，再使用 `--write --confirm-token <token>`；没有 token 或 token 不匹配时必须拒绝写入。
12. resolver 证据中 `recommended.dxmVisibleCategoryPath` 和 `recommended.dxmVisibleCategory` 都可作为 DXM 候选类目来源；但 split/低置信证据仍不得自动升级为 verified。
13. AliExpress `postCategoryId -> 店小秘候选类目` 映射覆盖入口为 `tools/aliexpress-dxm-category-map.js coverage`。
14. 新 resolver 映射必须先用 `review-resolvers` 查看候选、已有映射状态和阻断项；正式 `config/aliexpress-dxm-category-map.json` 写入必须使用 `import-resolvers --write --confirm-token <token>`。
15. split resolver 例如多个 `postCategoryId` 接近且没有推荐 `postCategoryId` 时，不得自动写 active 映射；必须保持 blocked/needs_review 并进入人工复核或重新验证。

## 3. native 保存暴露字段

1. 脚本预检通过不等于最终通过；店小秘 native 保存反馈优先级高于脚本 preflight。
2. native 保存可能暴露额外必填字段，例如 `Use`、`Feature`、`Plastic Type`、`Theme`、`Product application scenarios`。
3. native 提示 `请选择产品属性` 时，必须定位具体字段并修复，不能继续保存或把它当成可忽略提示。
4. 修复 native 暴露字段时仍按字段类型处理：下拉必须选真实选项，checkbox/radio 必须勾选真实选项并读回 checked 状态。
5. category-specific checkbox/radio 组是可修复保存阻断，不是商品业务失败。例如 `Placemats` 可能要求 `Theme` 和 `Product application scenarios`。
6. 对通用字段可用 `Other/其他` 兜底；对场景字段应选择有商品证据的真实场景，例如厨房垫选择 `厨房(Kitchen)` / `餐桌用(Dining table)`。
7. 修复后重新 preflight / save；同一字段连续 3 次聚焦修复仍失败，才记录字段级失败并继续下一个商品。
8. 保存成功后跳转到 `/web/smtlocalProduct/offline` 或出现 `产品已移入待发布` 属于成功路径，必须用待发布列表读回确认。
9. 当前 Amazon US -> 速卖通海外托管批次的产地 `Origin` 默认选择 `美国(Origin)(US(Origin))` / `United States` 等页面等价真实选项，并以真实读回为准；不允许自动回退 `Mainland China/中国大陆`。如果 United States 选项不可见或无法提交，记录字段级异常并等待规则确认，不得静默改用中国大陆。

## 4. 价格来源规则

1. 货值 / 供货价只能来自当前任务 Amazon 页面展示价格 USD × 当前任务汇率 × 当前任务倍率。
2. 当前 100 品类任务使用的公式是 `Amazon 页面展示价格 USD x 7 x 1.55`，结果保留 2 位小数；后续任务如配置不同，以任务配置为准。
3. 禁止使用店小秘页面旧价格、缓存价格、采集批次缓存价、`product.price`、`sourcePrice`、`minPrice`、`maxPrice`、UI 数字扫描或手动 CNY 覆盖作为保存价格来源。
4. Amazon 页面展示单一价格时直接取该价格；Amazon 页面展示价格区间时取最高值，例如 `$8.99 - $12.99` 取 `$12.99`。
5. 缺少可信 Amazon 页面展示价格时，必须阻断 preflight / save，记录价格来源缺失。
6. 保存前必须校验 visible 变种货值和 payload SKU 价格等于期望值；不一致禁止保存。
7. 异常价格必须在发布前单独检查，不能只因商品进入待发布就默认价格正确。
8. 可信 Amazon 页面展示价格 USD 的机器入口为 `runs/amazon-price-store.json`。
9. 价格工具为 `tools/amazon-price-store.js`。
10. 当前价格库优先字段为 `amazonDisplayedPriceUsd`；旧字段 `amazonOriginalPriceUsd` 作为兼容 fallback 保留。
11. 价格工具只保存 Amazon 页面展示价格 USD 和来源证据；期望 CNY 必须由运行时任务公式参数计算，不把某一次任务公式写死进价格库。
12. Amazon 页面展示价格只读采集工具为 `tools/amazon-displayed-price-capture.js`；默认 dry-run，只有显式 `--write` 才能写入价格库。
13. 采价失败必须标准化记录：验证码/机器人检查为 `amazon_page_captcha_or_robot_check`，商品不可售且无展示价为 `amazon_product_unavailable_no_displayed_price`，价格选择器缺失为 `amazon_price_selector_missing`，其他采价失败为 `amazon_price_capture_failed` 或环境控制异常。
14. 采价失败写入异常队列必须显式使用 `--write-exceptions`；不得因为采价失败而改用店小秘旧价或缓存价。
15. 价格状态可通过 `tools/exception-queue.js from-price-status` 进入统一异常队列。
16. 批量 Amazon 页面展示价格采集入口为 `tools/amazon-displayed-price-batch.js`；默认 dry-run、顺序执行、复用一个 Amazon 标签页，只有显式 `--write-prices` 才写价格库，只有显式 `--write-exceptions` 才写异常队列。
17. Amazon 页面被浏览器翻译或本地化时，`17.99美元`、`17美元 . 99` 等可作为 USD 展示价候选；必须先过滤中文免运门槛、销量、促销额度等非商品价格，再按当前规则从真实展示价中取最高值。
18. 价格文本中的销量/购买量、`订单满 xx 美元` 免费送货门槛、信用卡/促销立减额度等不属于商品展示价，必须过滤。

## 5. WebBridge / tab-control 中断归类

1. WebBridge evaluate 卡住、页面跳转、`Inspected target navigated`、`Inspected target closed`、旧 tab 匹配、截图/DOM 读取超时、下拉浮层串场，统一归类为环境控制异常。
2. 环境控制异常不是业务失败、不是商品失败、不是插件业务失败，也不能计入商品规则失败。
3. 保存后跳转到 `/web/smtlocalProduct/offline` 是成功路径，不应误判为页面丢失或保存失败。
4. 批量恢复时优先使用直接 edit URL 打开当前商品，减少旧 tab 匹配风险。
5. 完成后必须用 `/web/smtlocalProduct/offline` 或对应列表权威读回，列表状态优先于 agent 对 edit tab 的局部记忆。
6. 遇到控制异常时，不得扩大业务动作，不得重新采集，不得重新认领，不得处理 `产品开发 / 草稿箱`，不得为了恢复控制而发布或一键发布。
7. 连续控制异常时，应记录现场、关闭或隔离旧 edit tab，并从权威列表 / direct edit URL 恢复，而不是把异常商品判为业务失败。
8. 继续同一商品编辑验证前，应使用 `tools/dxm-live-edit-helper.js forceEdit` 打开干净 direct edit URL；该流程只处理旧页丢弃、`离开此网站？` 确认、20 秒加载校验、edit id / ASIN / 插件版本校验，不执行字段编辑或保存。
9. 在 `forceEdit` 主动刷新、关闭、重开或跳转旧编辑页时出现 `离开此网站？`，应选择 `离开`；如果不是自动化主动丢弃旧页，或保存/读回/上传现场未收口，则不得自动选择离开。
10. 干净编辑页 20 秒内仍无法读回正确 edit id、ASIN、插件版本或 readonly preflight 函数时，记录为 `clean_edit_page_not_ready` / 环境控制异常，停止业务动作，不得继续保存。

## 本轮已验证业务断点

1. 20 类目 20 产品采集箱断点恢复已完成。
2. 采集箱读回：`采集箱(0)`。
3. 待发布读回：`第1-26条，共 26 条记录`。
4. 最后完成商品：`B08PB79YXV cotton swab holder`，已进入待发布。
5. 当前脚本版本：`DXM Automation V1 - NEW v2.1.2`、`DXM Amazon Crawlbox V1 v0.1.29`、`save Payload V3 0.6.3`。

## Validation 前检查点

1. 100 品类 100 产品压测开始前，必须确认本异常规则库已被执行入口和相关 skills 引用。
2. 压测开始前必须确认本轮没有执行店小秘业务动作，只做规则沉淀和计划准备。
3. 后续发布前检查必须额外抽查异常价格、native 暴露字段和 safe adjacent 类目记录。

## 6. 商品风险过滤

1. 商品风险过滤机器入口为 `tools/product-risk-filter.js`。
2. 风险规则配置为 `config/product-risk-rules.json`。
3. 批次总控可通过 `tools/dxm-batch-execution-gate.js --risk-file` 或 `--risk-json` 合并风险状态。
4. 风险筛查默认只读，不写正式异常队列；写入异常队列必须显式使用 `--write-exceptions`。
5. 输出状态只有三类：`allow`、`needs_review`、`blocked`。
6. `blocked` 不得进入采集、认领、编辑保存或待发布；`needs_review` 必须人工复核或补充证据后才能进入自动流程。
7. 已机器化的风险原因包括 `brand_logo_or_infringement_risk`、`food_or_ingestible_risk`、`liquid_cosmetic_or_chemical_risk`、`medical_or_health_claim_risk`、`children_or_toy_risk`、`battery_or_electric_risk`、`weapon_or_hazardous_material_risk`、`adult_or_sensitive_risk`、`fragile_or_glass_risk`、`apparel_or_wearable_risk`。
8. 如果批次总控启用风险筛查但某个 ASIN 没有候选记录，记录 `product_risk_record_missing`，不得默认为安全。
9. 单独的 `food` 文本不作为阻断词，避免误伤 `food storage container` 这类非食品容器；可食用、零食、糖果、补剂、宠物食品等仍阻断。
10. 短词规则必须避免子串误判，例如 `bra` 不得误伤 `brace`。
11. 风险过滤只做分流和阻断，不授权发布、一键发布、重新采集旧产品或处理 `产品开发 / 草稿箱`。

## 7. 机器异常队列

1. 机器可读异常队列统一入口为 `runs/exception-queue.json`。
2. 维护工具为 `tools/exception-queue.js`。
3. 证据状态、只读 preflight、价格源、字段阻断、环境控制异常应进入同一个队列，而不是只写在聊天记录里。
4. `category_evidence_missing`、`aliexpress_category_evidence_split`、`aliexpress_category_confirmed_but_dxm_mapping_missing`、`amazon_displayed_price_missing`、`amazon_page_captcha_or_robot_check`、`amazon_product_unavailable_no_displayed_price`、`amazon_price_selector_missing`、兼容旧原因 `aliexpress_dxm_category_map_missing`、`dxm_candidate_category_missing`、`amazon_original_price_missing`、`price_mismatch`、`required_attribute_incomplete`、`collection_missing_current_unclaimed_row`、`not_edit_page`、`environment_control_exception` 都必须保留标准化 reason。

## AliExpress Evidence Confidence

1. `aliexpress_verified` 只表示 `postCategoryId` 共识 `>=80%` 且 DXM 候选类目存在，属于 `high_confidence`。
2. `conditional_verified` 表示 `60%-79%` 条件通过，必须同时满足 DXM 候选类目、用途/形态一致、无明显冲突、非风险品类，属于 `low_confidence`。
3. `conditional_verified` 可以进入后续 preflight，但报告、证据库和运行记录必须保留 `conditional_verified` / `low_confidence`，不得合并显示为高可信通过。
4. `<60%` 不能直接等同 split；必须先检查搜索结果标题语义是否高度一致。
5. `<60%` 且标题语义一致时，优先进入 AliExpress 详情页补证据：打开高度相似商品详情页，读取规格中的 `类型` / `类别` / `产品类型` / `商品类型` / `专用工具类型` / `Product Type` / `Category` / `Special Tool Type`；2 个详情页类型一致或等价时，记录 `detail_verified` / `detail_low_confidence` / `detail_type_consensus`。无效导航词如 `浏览/Browse` 不算有效类型；如果单个详情页缺字段或被验证页拦截，可以继续补看后续同类候选，最多 5 个详情页。
6. 详情页类型来自速卖通平台自身，可以作为 DXM 分类弹窗的自动搜索词；例如 `厨房水龙头配件` 可以用于搜索并选择店小秘真实可点击、可回填、语义等价的叶子类目。保存仍必须通过 final preflight。
7. `<60%` 但标题语义一致、详情页唯一速卖通类目已确认但 DXM 对应类目未找到时，标准异常原因为 `aliexpress_category_confirmed_but_dxm_mapping_missing`；兼容旧原因 `aliexpress_dxm_category_map_missing`、`dxm_candidate_category_missing`，但新写入不得再使用旧名。
8. `<60%` 且标题语义一致、有安全 DXM 候选类目、用途/形态一致、无明显冲突、非风险品类时，可以记录 `conditional_verified` / `semantic_low_confidence`。
9. 遇到 AliExpress 真人验证、滑块验证、验证码或风控页时，记录 `aliexpress_verification_required`，属于可重试控制异常；不得自动绕过，不得让批次卡死，应关闭当前页面并继续下一个 ASIN。
10. 只有类目 ID 分散且标题语义也分散、详情页证据缺失/冲突、用途冲突、无安全 DXM 类目或风险筛查不通过时，才记录 `aliexpress_category_evidence_split` / `aliexpress_evidence_needs_manual_review` 等阻断原因。
11. 队列项只表示分流/阻断状态，不授权发布、一键发布、重新采集旧产品或处理 `产品开发 / 草稿箱`。
12. 临时验证必须优先写入 `/private/tmp` 或自定义队列；正式队列写入前应先 dry-run 读回将写入哪些 ASIN 和原因。
13. 批次异常报告入口为 `tools/exception-queue.js report`。
14. 报告必须至少输出每个 ASIN 的状态、主原因、异常类别、是否可重试和下一步动作。
15. `--format markdown` 可生成给人读的批次报告；默认 JSON 供机器继续处理。
16. 异常队列写入使用锁保护；批量工具可以顺序或并发写入，但正式业务报告仍应以最终 `report` 读回为准。

## 8. 待发布读回异常

1. 保存成功不能只按 edit tab 或脚本日志判断，必须以 `/web/smtlocalProduct/offline` 待发布列表读回为准。
2. 待发布读回工具为 `tools/dxm-wait-publish-readback.js`。
3. 读回必须至少检查 ASIN 行是否存在、SKU 是否包含 ASIN、价格是否等于可信 Amazon 页面展示价格按运行时公式计算的期望值、库存是否等于任务期望值。
4. 有 AliExpress / DXM 类目证据时，还应检查待发布行是否包含候选类目叶子词或等价词。
5. `wait_publish_row_missing` 表示待发布当前页没有目标 ASIN 行，下一步是确认保存结果或翻页/搜索读回，不得直接重新采集旧产品。
6. `wait_publish_sku_missing`、`wait_publish_price_mismatch`、`wait_publish_stock_mismatch`、`wait_publish_category_mismatch` 属于待发布读回不一致，下一步是修复已保存产品或进入异常复核，不得发布。
7. 读回工具只允许只读导航和页面读取；不得借读回流程点击编辑、保存、移入待发布、发布、一键发布或删除。
8. 临时验证必须写入 `/private/tmp` 或自定义队列；正式异常队列写入必须显式使用 `--write-exceptions`。
9. 本地离线分析入口为 `tools/dxm-wait-publish-readback.js analyze`；可用保存的 `--readback-json` / `--readback-file` 和 `--expected-json` / `--expected-file` 验证批量读回结果，不需要打开浏览器。
10. 价格读回必须按数值比较并允许极小格式差异，例如 `97.54` 与 `97.540` 视为一致；默认容差为 `0.01`。
11. 如果目标行缺失，只记录主因 `wait_publish_row_missing`；不要同时制造价格、库存、类目不匹配的连锁假异常。
12. `not_wait_publish_page` / `wait_publish_page_not_loaded` 属于可重试的待发布读回控制异常，应先打开正确待发布页再重试读回。

## 9. 批次执行总控

1. 当前批次的项目级机器总控入口为 `tools/dxm-batch-pipeline.js`。
2. `tools/dxm-batch-execution-gate.js` 是总控内部使用的执行门禁工具，仍可单独用于局部门禁检查。
3. 批次执行前先用 pipeline `plan` 生成统一报告，确认每个 ASIN 的候选清单、风险、价格、类目证据、异常状态、最终门禁和下一步动作。
4. `plan` 通过的 ASIN 才能进入编辑页只读 preflight；没有通过的 ASIN 必须先补证据/价格、风险复核或进入异常队列。
5. pipeline `check --sync-evidence --edit-preflight --wait-readback` 只允许做浏览器证据同步、只读 preflight 和待发布只读读回。
6. 总控工具不授权采集、认领、编辑字段、保存、移入待发布、发布、一键发布、删除、下单、加购或聊天。
7. 正式异常队列写入必须显式使用 `--write-exceptions`；默认 dry-run 结果只能作为执行计划和风险读回。
8. 总控 `plan` 必须输出 `amazonPriceCapturePlan`，列出缺少可信 Amazon 页面展示价格的 ASIN 和对应批量采价命令。
9. 总控只有在显式使用 `--capture-missing-prices` 时才允许调用 Amazon 只读批量采价；默认 `plan` 不打开浏览器。
10. 通过总控写入价格库必须同时使用 `--capture-missing-prices --write-price-captures`；不得把 gate 的普通 `--write-exceptions` 解释为价格库写入授权。
11. 通过总控写入采价失败异常必须同时使用 `--capture-missing-prices --write-price-capture-exceptions`。
12. 总控报告写入必须显式使用 `--write --out <path>`；默认只打印 dry-run 报告。
13. 总控必须输出 recommended execution order；风险阻断商品先跳过或人工复核，不得继续排入补价格/补类目队列。
