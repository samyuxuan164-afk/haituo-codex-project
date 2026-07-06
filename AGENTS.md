# 项目执行规则

## 执行入口

本项目业务执行的唯一真相源是 `AGENT.md`。任何采集、认领、编辑、preflight、保存、发布前检查或恢复任务开始前，必须先读取 `AGENT.md`，再读取 `TASK.md`、相关 `skills/*/SKILL.md`、`docs/current-status.md` 和 `DEVELOPMENT_LOG.md`。

如果聊天历史、旧日志、旧报告与 `AGENT.md` / 当前 `TASK.md` 冲突，以 `AGENT.md` 和当前 `TASK.md` 为准。

异常规则库统一入口是 `docs/exception-rules.md`。下拉字段、类目安全相邻、native 保存暴露字段、价格来源和 WebBridge / tab-control 中断归类，必须以该文件和 `AGENT.md` 为准。

本项目目标是用插件和自动化流程代替人工执行店小秘原有上架流程，不绕过店小秘。

标准链路：

```text
Amazon 商品 -> 店小秘采集箱 -> 认领 -> 编辑页自动填写 -> 保存 -> 待发布 -> 批次检查 -> 发布
```

采集和认领前必须先确认当前任务的营业执照组和目标店铺；同一营业执照组内禁止重复采集/认领同一产品，跨营业执照组可以按业务价值复用同一产品。

店小秘认领弹窗的平台渠道固定为 `速卖通海外托管`；不论采集什么链接、上架哪个店铺，都只能勾选该分组下面的店铺，禁止选择 `产品开发`、`草稿箱` 或其他渠道。

## 发布阶段

1. 测试阶段允许对 1 个测试商品执行单个发布验证。
2. 测试阶段目标是验证发布按钮、发布接口、发布结果和发布后状态。
3. 正式运行阶段默认使用批量发布：勾选产品 -> 批量操作 -> 批量发布。
4. 正式运行阶段不逐个点击产品级发布。
5. 只有同一批商品全部完成编辑并通过发布前检查后，才允许批量发布。
6. 未完成编辑、检查未通过、状态异常的商品禁止发布。
7. 如果批次中存在异常商品，必须继续编辑或剔除异常商品，不能带病批量发布。

## 截图清理规则

1. 截图默认是临时证据，不是长期项目状态。
2. 下一次继续工作以前，以文档、JSON、代码、异常队列和实时页面读回为准，不以旧截图为准。
3. 每次任务结束后必须运行 `tools/cleanup-task-screenshots.js plan` 生成截图清理计划。
4. 未被运行报告、文档或 JSON 明确引用的截图，应使用 `tools/cleanup-task-screenshots.js cleanup --write` 删除。
5. 只有最近失败现场、页面结构变化、关键读回证明、危险动作排除证明等被报告明确引用的截图可以保留。
6. 删除截图不得删除运行报告、JSON 状态、代码、规则、异常队列或价格/证据库。

## 发布前检查

发布前必须检查并确认：

1. 标题已重写。
2. 商品类型与平台类目匹配。
3. 必填属性完整。
4. PC 描述已重写。
5. 营销图已生成或按规则保留。
6. 运费模板已选择 `111`。
7. 品牌信息已过滤。
8. Logo 产品已过滤。
9. 商品状态已正常进入待发布。
10. 所有即将提交到平台的文本字段已完成特殊字符清洗。

## 特殊字符清洗

发布前必须清洗所有即将提交到平台的文本字段，包括标题、PC 描述、属性、规格、图片文字、详情文案和 payload 文本字段。

规则：

1. 禁止英文双引号 `"`。
2. 禁止尺寸符号 `′`、`″`。
3. 禁止中文引号、智能引号。
4. `4.625"`、`4.625″`、`4.625 in.` 必须统一改为 `4.625 inch`。
5. 如果发布前仍检测到上述字符，禁止发布，必须返回编辑页修正后保存。

## 类目规则

1. 店小秘和平台发布接口不会自动校验产品类目是否业务正确。
2. 发布成功不代表类目正确。
3. 类目正确性必须由自动化流程在发布前自行校验。
4. 发布前必须检查商品类型与平台类目是否匹配。
5. 如果商品类型与类目明显不一致，禁止发布并记录为类目错误。
6. 例如：Sink Strainer 不能归到 Kitchen Faucets；水槽过滤器不能归到厨房龙头。
7. 类目错误不一定导致发布失败，但会导致上架质量错误，必须在发布前拦截。

## 编辑页执行规范

1. 编辑页完成后先点击保存。
2. 保存成功后返回待发布或对应列表页继续流程。
3. 不在编辑页直接执行最终发布。
4. 编辑页自动填写必须优先保证核心字段正确。

核心字段：

1. 标题。
2. 类目。
3. 必填属性。
4. PC 描述。
5. 营销图。
6. 运费模板。
7. 品牌过滤。

## 标题规则

1. 标题必须重新生成，禁止直接使用 Amazon 标题。
2. 删除品牌名、商标、Amazon 相关词、敏感词、违禁词和营销诱导词。
3. 符合美国搜索习惯和跨境电商标题规范。
4. 使用自然英文表达。
5. 长度不超过 80 个字符。

## PC 描述规则

1. 禁止直接复用 Amazon 详情页原文。
2. 禁止保留 Brand Story 模块。
3. 删除品牌信息、Amazon 信息、其他平台名称、商标、品牌故事和品牌介绍。
4. 删除违规营销词、夸张宣传词和平台敏感词。
5. 使用美国本土英文表达。
6. 客观描述材质、功能、细节、适用场景和核心优势。
7. 分点结构，条理清晰。
8. 不少于 500 个英文字符。
9. 正常产品图和场景图允许保留。
10. PC 描述排版必须先图片后描述。
11. PC 描述必须至少包含 2 张当前商品图片；缺图、跨商品图片或图片未排在描述前，保存前必须拦截。
12. 接口保存路径与编辑页 UI 保存路径必须使用同一套 PC 图文详情规则，不能只生成纯文字 detailWeb。

## 图片与 Logo 规则

1. 营销图片固定保留 2 张，优先使用店小秘系统一键生成。
2. 删除 Brand Story 模块。
3. 保留正常产品图和场景图。
4. 过滤 Logo 图、品牌图、品牌水印图。
5. 选品阶段禁止带明显 Logo 的产品进入采集流程。
6. 发现品牌 Logo、水印、品牌名称印刷在产品主体上，直接跳过，不进入采集流程。

## 运费模板

运费模板固定选择 `111`。

这是选择模板，不是向输入框写入文本。自动化必须触发页面下拉/选择逻辑，使店小秘真实选中模板 `111`。

## 自定义属性

1. 编辑页中的自定义属性默认不填写。
2. 自定义属性属于低优先级字段，不作为发布前必填项。
3. 自定义属性经测试容易触发字符长度、特殊字符等校验错误。
4. 自定义属性不影响保存、不影响待发布、不影响正常发布时，统一跳过。
5. 批量运行阶段默认跳过自定义属性，以减少错误率并提升处理效率。

只有以下情况才允许填写自定义属性：

1. 平台强制要求。
2. 类目强制要求。
3. 发布失败明确提示缺少该字段。

## 成功标准

1. 保存成功必须以店小秘页面实际状态为准。
2. 发布成功必须以商品进入发布中、在线产品、审核中或平台可确认状态为准。
3. 接口返回成功不等于最终成功。
4. 发布失败必须记录失败原因，并回到编辑页修复后再重新保存和发布。

## 2026-06-24 编辑页保存前预检规则 v1.1.37

1. 编辑页保存前必须先做页面可见字段预检，不允许只依赖 payload 或本地报告判定成功。
2. 产品分类必须在编辑页真实选中；如果页面显示未选择分类，必须根据商品关键词自动选择最接近的可见类目，仍无法选择则禁止保存并记录为类目错误。
3. 运费模板必须通过下拉选项真实选择 `111`，不是向输入框写入文本；保存前必须复核页面显示已选中 `111`。
4. 自定义属性默认清空或跳过，不作为发布前必填项；除非平台强制、类目强制或失败提示明确要求，否则不填写自定义属性。
5. 必填属性允许自动补齐保守默认值：品牌优先 `None/No Brand`，高关注化学品优先 `None/天然未处理`；当前海外托管批次产地固定优先 `United States` / `美国(Origin)(US(Origin))` 并读回。历史记录中的 `Mainland China/中国大陆` 不是当前默认值，不能作为自动回退值。
6. 标题、PC 描述、属性、规格、图片文字和即将提交的平台文本字段必须执行特殊字符清洗，禁止 `"`、`′`、`″`、中文引号和智能引号；尺寸写法统一为 `inch`。
7. 保存前必须确认标题不超过 80 字符、PC 描述不少于 500 英文字符、类目已选、运费模板 111 已选、自定义属性为空。
8. 保存失败时，如果页面提示未选择、不能为空、不能超过字符数或特殊字符错误，允许自动纠偏后重试 1 次；仍失败则记录失败原因并跳过商品。
9. 模板继承必须以页面实际显示为准：类目、运费模板和必填属性必须在保存前被页面确认，不能只记录为“已写入”。
10. 本规则为正式执行规则，适用于后续小批量和批量运行。
## 2026-06-25 正式选品、标题和去重规则

1. 标题禁止保留任何品牌名称、商标、品牌型号；保存前和发布前必须再次检查标题是否仍包含品牌词。
2. 如标题仍包含品牌词、商标词或品牌型号，自动重新生成标题，直到符合规则；仍无法清除时禁止保存和发布。
3. 同一款产品不同颜色允许作为不同商品分别上架；不同颜色视为不同 SKU，不属于重复商品，不允许过滤。
4. 真正需要过滤的是：同一营业执照组下完全相同的 Amazon 链接、完全相同的 ASIN、完全相同的颜色/尺寸/套餐组合、同一商品被重复采集。
5. 默认选品任务参数可配置；当前默认值为价格区间 5-20 USD、目标 100 个商品、每个品类最多 15 个商品，但执行时必须以面板/任务配置为准，不得写死。
6. 同一品类内必须尽量保证商品多样性；默认跳过当前营业执照组内已经采集、认领、待发布、已发布或已跳过的完全相同商品。
7. 去重范围是 `businessLicenseGroup + productKey`，不是全局 ASIN；详细知识库见 `docs/store-license-dedup-rules.md`。
8. 不同营业执照组之间可以复用相同产品；卖得较好或高潜力产品原则上允许跨营业执照组再次上架，但仍必须通过 Logo/品牌、类目、属性、价格、preflight 和保存闸门。
9. 新任务开始时必须声明当前 `businessLicenseGroup` 和 `targetStore`；如果无法确认，采集/认领前停止并记录 `license_group_unknown`。

## 2026-06-25 店小秘类目优先规则

1. 类目选择必须以店小秘编辑页实际可见、可保存的类目为准，Amazon 标题或搜索关键词只作为辅助。
2. `Pen Holders` 只能作为类目映射规则，不能作为所有商品或所有 `Organizer` 商品的全局固定类目。
3. 仅当标题、图片、用途判断为桌面文具收纳、笔筒、`Pen Holder`、`Pencil Cup`、`Desk Pen Holder`、`Rotating Pen Organizer`、`Rotating Organizer for pencils / office supplies` 时，优先映射到：办公、文化及教育用品 > 桌上收纳用品 > 笔筒(Pen Holders)。
4. 这类商品优先搜索 `Pen Holders`、`笔筒`、`Pencil Holders`、`Pencil Cup`，不得优先用过泛的 `Organizers` 或错误的线缆收纳类目。
5. 仅出现 `Organizer` 不足以命中笔筒类目；线缆、化妆、浴室、厨房、抽屉、衣柜、文件等收纳必须重新判断实际类目。
6. Amazon 原始品类不能直接等同于店小秘平台类目；店小秘类目必须根据商品实际用途、实物形态、图片内容和标题语义重新判断。
7. 如果 Amazon 类目和店小秘类目不一致，以店小秘平台更贴近商品用途的类目为准；只有类目明显错误才拦截，名称不同但用途匹配可以通过。
8. 店小秘存在明确叶子类目时，必须选择叶子类目；没有高置信叶子类目时禁止保存并记录类目待确认。

## 2026-06-30 速卖通类目证据优先规则

1. 新品类的店小秘分类主入口必须是速卖通以图搜图 / 相似商品搜索类目证据。
2. DeepSeek 只负责商品理解、属性抽取、标题清洗和风险归纳，不能作为最终类目裁判。
3. 本地 category knowledge 只缓存已经由速卖通相似商品证据或店小秘可见类目验证过的结果。
4. 旧本地关键词规则只能作为诊断和候选解释，不能直接推动自动保存。
5. 没有速卖通类目证据或已验证可见类目规则时，编辑页必须阻断并记录 `aliexpress-evidence-required`。
6. 后续 10 个不同品类批量测试必须按“先类目证据、再店小秘填写”的顺序执行。
7. 默认使用一个稳定登录的速卖通账号和固定 Chrome Profile；多账号只作为人工备用，不作为自动轮换池。
8. 已验证并沉淀的类目，后续同类商品直接调用 `skills/category-resolver/learned_rules.json`，不再重复图搜。
9. AliExpress `postCategoryId` 共识 `>=80%` 且有 DXM 候选类目时，记录高可信通过 `aliexpress_verified/high_confidence`。
10. 共识 `60%-79%` 只能条件通过，必须满足 DXM 候选类目、用途/形态一致、无明显冲突、非风险品类，并记录 `conditional_verified/low_confidence`。
11. 共识 `<60%` 不直接判死；必须进入标题语义二级判断。若标题语义、用途和形态高度一致，优先打开高度相似 AliExpress 详情页读取规格 `类型` / `类别` / `产品类型` / `商品类型` / `专用工具类型` / `Product Type` / `Category` / `Special Tool Type`；2 个详情页类型一致或等价时记录 `detail_verified/detail_low_confidence/detail_type_consensus`，并把详情页类型作为店小秘分类弹窗自动搜索词。若单个详情页缺字段、出现 `浏览/Browse` 导航噪音或被验证页拦截，可以最多补看 5 个同类候选。
12. 若详情页类型无法读取且缺安全 DXM 候选类目，记录 `semantic_consensus_needs_dxm_mapping`；若已有安全 DXM 候选类目且无冲突，可记录 `conditional_verified/semantic_low_confidence`。只有类目 ID 和标题语义都分散、详情页证据缺失/冲突或存在用途冲突/风险时，才记录 split/missing/needs_review。遇到 AliExpress 验证页记录 `aliexpress_verification_required` 并继续下一个 ASIN，不自动绕过。

## 2026-06-25 V1 历史环境控制异常规则

本节是历史环境资料索引，不表示当前任务进入 Freeze、Handoff、Release 或 Migration。

1. 历史 V1 基线状态以 `docs/freeze-v1-20260625/FREEZE_REPORT.md` 为准。
2. 当前 Mac 恢复版本为 `DXM Automation V1 - NEW v1.1.42`、`DXM Amazon Crawlbox V1 v0.1.22`、`save Payload V3 v0.6.2`。
3. Windows Browser / Computer Use 对店小秘页面连续出现 `evaluate`、`domSnapshot`、截图、`reload`、`goto` 超时或无法确认浏览器 URL 时，统一归类为 `Environment Control Exception`。
4. `Environment Control Exception` 不属于业务失败、不属于插件失败、不属于项目失败、不属于商品失败，不计入 3 x 10 稳定性验证结果。
5. 遇到该异常时，不得反复执行深度浏览器操作导致控制内核重置；应记录事件并暂停现场验证，等待新环境或人工恢复。
6. 每次工作任务执行结束、暂停或异常中断后，必须关闭本次任务自动打开或接管的浏览器页面；下一次执行必须重新打开 direct edit URL 或权威列表页，并重新读回 ASIN、来源 URL、类目、价格和库存后再动作，避免旧标签影响后续定位。
7. 如果存在未保存字段、保存结果未确认、验证码/登录/页面控制异常等未收口现场，不得静默关闭；必须先记录未关闭原因，再等待恢复或用户确认。
7. Mac 迁移与恢复以 `docs/freeze-v1-20260625/MAC_MIGRATION_GUIDE.md`、`MAC_FIRST_SETUP_GUIDE.md`、`MAC_ENVIRONMENT_CHECKLIST.md` 为准。
8. 恢复后继续验证链路：Amazon 商品 -> 采集箱 -> 认领 -> 编辑页自动填写 -> 保存 -> 待发布；不执行最终发布。

## 2026-06-27 新环境标准执行流程

所有电脑迁移、新环境部署、插件恢复和后续验证必须按以下顺序执行，不得跳级：

```text
Environment Recovery
-> Panel Validation
-> Environment Ready
-> Functional Validation
-> Smoke Test
-> 3x10 Validation
-> Production
```

1. `Environment Recovery` 只恢复 Chrome、Tampermonkey、脚本安装、Node、Git 和项目文件，不做业务动作。
2. `Panel Validation` 只确认 3 个业务面板显示、账号、页面、遮挡和异常状态，不采集、不认领、不编辑、不保存、不发布。
3. `Environment Ready` 必须确认浏览器版本、脚本版本、项目目录、文档、Skill、源码、Node、Git 和只读 Console 状态。
4. `Functional Validation` 只验证插件初始化、Hook、监听、按钮绑定和 Console 稳定性；禁止触发采集、认领、编辑、保存、发布。
5. 只有 `Functional Validation` 全部通过后，才允许进入 `Smoke Test`。
6. 只有 `Smoke Test` 通过后，才允许进入 `3x10 Validation`。
7. 只有 `3x10 Validation` 通过后，才允许进入 `Production`。

## Git Audit and Synchronization Rules

All Codex work in this repository must follow the Git workflow defined in:

`docs/git-workflow/COMMIT_RULES.md`

Required behavior:

1. Every meaningful code change, rule update, execution document update, validation report, or optimization must leave a Git commit.
2. Commits must be small and auditable.
3. Do not mix unrelated changes in one commit.
4. Before changing files, run `git status`.
5. After changing files, run `git status` and review the changed files.
6. Add only related files with explicit `git add <path>`.
7. Commit using the format `type(scope): short summary`.
8. Push to GitHub after each completed safe commit.
9. Never commit real passwords, API keys, cookies, sessions, tokens, or private account data.
10. If a task changes code behavior, update the relevant docs, skills, task log, or development log in a separate small commit when possible.

