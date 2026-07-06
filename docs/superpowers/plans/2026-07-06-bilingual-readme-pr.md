# Bilingual README And Architecture PR Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Produce polished bilingual project entry docs, bilingual architecture docs, bilingual SVG/Mermaid/ASCII diagrams, push first to collaborator fork `ALdaisuki/haituo-codex-project`, audit the fork branch, then open a PR to company upstream `samyuxuan164-afk/haituo-codex-project`.

**Architecture:** Keep executable source untouched. Documentation is derived from current `src/*.user.js` headers, existing project rules, and safe local verification commands. English and Chinese documents share the same facts and asset structure.

**Tech Stack:** Markdown, shields.io badges, GitHub Mermaid, hand-authored SVG, ASCII C4 diagrams, Node.js/Python static validation, GitHub CLI.

---

## Tasks

- [x] Confirm isolated worktree and fork access.
- [x] Generate English README with English SVG and complete English Mermaid architecture diagram.
- [x] Generate Chinese README with Chinese SVG and complete Chinese Mermaid architecture diagram.
- [x] Generate English and Chinese 13-section architecture docs.
- [x] Generate English and Chinese Mermaid source files.
- [x] Generate English and Chinese SVG vector architecture diagrams.
- [x] Generate English and Chinese ASCII architecture maps.
- [ ] Run fresh verification.
- [ ] Commit all changes.
- [ ] Push to `ALdaisuki/haituo-codex-project`.
- [ ] Audit fork branch diff for local private content.
- [ ] Create PR to `samyuxuan164-afk/haituo-codex-project`.

## Verification Commands

```powershell
node tools\aliexpress-evidence-policy.test.js
git ls-files "*.js" "*.mjs" | ForEach-Object { node --check $_ }
@'
import ast, subprocess
for path in subprocess.check_output(['git', 'ls-files', '*.py'], text=True).splitlines():
    ast.parse(open(path, encoding='utf-8').read(), filename=path)
print('python ast ok')
'@ | python -
node -e "const fs=require('fs'); for (const f of ['docs/assets/architecture-overview-en.png','docs/assets/architecture-overview-zh.png']) { if (fs.statSync(f).size === 0) process.exit(1) }"
git diff --check
```
