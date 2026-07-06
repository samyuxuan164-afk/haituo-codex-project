## 概要

- 待补充

## 变更范围

- 待补充

## 本地验证

- [ ] `node tools\aliexpress-evidence-policy.test.js`
- [ ] `node tools\dxm-automation-core.test.js`
- [ ] `git ls-files "*.js" "*.mjs" | ForEach-Object { node --check $_ }`
- [ ] `git diff --check`

## 安全边界

- [ ] 未执行店小秘采集、认领、编辑、保存、发布或一键发布。
- [ ] 未提交本地私人路径、凭据、cookies、浏览器 profile、tokens、payload dump 或个人 Codex runtime 元数据。
- [ ] 如变更影响代码行为、测试面、状态或规则，已同步更新相关文档。

## 说明

本项目默认使用中文作为 PR 标题、PR 正文、Review 沟通和维护说明语言。必要时可在中文说明后追加英文摘要。
