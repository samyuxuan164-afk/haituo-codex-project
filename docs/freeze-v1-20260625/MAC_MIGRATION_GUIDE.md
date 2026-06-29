# Mac Migration Guide - V1

## Goal

Move the full V1 Dianxiaomi automation development and validation environment from Windows to Mac without losing project state, rules, evidence, or Tampermonkey plugin versions.

## Must Migrate

| Item | Source on Windows | Mac target suggestion | Required |
|---|---|---|---|
| Project directory | `D:\自动上架\dianxiaomi-automation-v1` | `~/Projects/dianxiaomi-automation-v1` | Yes |
| Evidence directory | `runs/` | Same relative path | Yes |
| Analysis directory | `analysis/` | Same relative path | Yes |
| Main plugin | `src/dianxiaomi-automation-v1-merged-new.user.js` | Same relative path | Yes |
| Amazon Crawlbox | `src/dianxiaomi-amazon-crawlbox-v1.user.js` | Same relative path | Yes |
| save Payload V3 | `src/dianxiaomi-save-payload-capture-v3.user.js` | Same relative path | Yes |
| Skills | `skills/` | Same relative path | Yes |
| Rules/docs | `AGENT.md`, `AGENTS.md`, `docs/` | Same relative path | Yes |
| Tools | `tools/` | Same relative path | Yes |
| Screenshots/logs | `*.png`, `runs/**/*.png`, `analysis/**/*.json` | Same relative path | Yes |
| Browser/Tampermonkey config | Chrome profile + Tampermonkey scripts | Install/import manually | Yes |

## Git Status

Current Windows project directory is not a Git repository:

```text
git status -> fatal: not a git repository
```

Migration recommendation:

1. Copy the full directory first.
2. On Mac, initialize Git only after confirming all files are present.
3. Make the first commit as `v1-freeze-20260625`.
4. Do not discard generated evidence until after the first Mac validation run.

## Tampermonkey Scripts To Install On Mac

Install or import these scripts into Chrome Tampermonkey on Mac:

| Tampermonkey script | File | Version |
|---|---|---:|
| DXM Automation V1 - NEW | `src/dianxiaomi-automation-v1-merged-new.user.js` | 1.1.41 |
| DXM Amazon Crawlbox V1 | `src/dianxiaomi-amazon-crawlbox-v1.user.js` | 0.1.21 |
| save Payload V3 | `src/dianxiaomi-save-payload-capture-v3.user.js` | 0.6.1 |
| Interface Detector V2 | `src/dianxiaomi-interface-detector-v2.user.js` | 0.3.0 |

Do not use `DXM Amazon NEW` as the active collection plugin unless explicitly switching experiments.

## Windows-Specific Items Found

| Pattern | Where observed | Mac action |
|---|---|---|
| `D:\自动上架\...` | Project path and run reports | Move to `~/Projects/dianxiaomi-automation-v1`; keep relative paths in docs. |
| `C:\Users\xz153\...` | Temp screenshots, Codex runtime paths, analysis metadata | Do not depend on these paths on Mac. |
| PowerShell commands | Prior execution notes and clipboard operations | Use `pbcopy`, `open`, `mkdir -p`, `python3`, `node` on Mac. |
| `Set-Clipboard` | Plugin copy workflow | Replace with `pbcopy < src/file.user.js`. |
| Backslash paths | Reports and docs | Prefer POSIX paths in new Mac docs; scripts should use `pathlib` / Node `path`. |
| Windows terminal mojibake | Some old docs/Skill display | Treat new freeze docs as UTF-8 source of truth; verify files with UTF-8 editors on Mac. |
| No `.git` directory | Repo root | Initialize Git on Mac after migration. |

## Mac Equivalent Commands

```bash
# create target
mkdir -p ~/Projects

# copy from external disk / network location into:
~/Projects/dianxiaomi-automation-v1

# verify node and python
node --version
python3 --version

# syntax check main plugin
node --check src/dianxiaomi-automation-v1-merged-new.user.js

# validate JSON rules
python3 -m json.tool skills/category-resolver/learned_rules.json >/dev/null
python3 -m json.tool skills/bumpers-v2/known_issues.json >/dev/null

# copy Tampermonkey plugin content to clipboard
pbcopy < src/dianxiaomi-automation-v1-merged-new.user.js
```

## Estimated Migration Work

| Task | Estimate |
|---|---:|
| Copy project folder and verify file count | 15-30 min |
| Install Chrome + Tampermonkey + scripts | 20-40 min |
| Validate Node/Python tools | 10-20 min |
| Create Git repo and first commit | 10-20 min |
| Login and restore Dianxiaomi/Amazon sessions | 15-45 min |
| First smoke validation | 30-60 min |

## Do Not Migrate As Source Of Truth

Do not rely on old `README.md` and `docs/current-status.md` alone because some content displays as mojibake in Windows terminal output. Keep them for history, but use this freeze directory as the current source of truth.

