# Windows Compatibility Audit

## Summary

The project code is mostly userscript / Python / Node and can migrate to Mac. The main compatibility risks are path references in historical artifacts, PowerShell-only operational commands, missing Git metadata, and browser automation differences.

## Windows Paths Found

| Pattern | Example file | Action on Mac |
|---|---|---|
| `D:\自动上架\...` | `runs/20260622-071513-167487781998795063/acceptance-report.json` | Historical artifact only. Do not use as live path. |
| `C:\Users\xz153\Desktop\3.json` | `analysis/tool-test-3/summary.json` | Historical artifact only. Use relative project paths. |
| `C:\Users\xz153\AppData\Local\Temp\...` | Chat/screenshot references, not canonical project files | Do not migrate temp paths as dependencies. |
| `C:\Users\xz153\.cache\codex-runtimes\...` | Prior command logs | Mac Codex runtime paths will differ. Do not hard-code. |

## Windows Commands / Shell Usage

| Windows command | Prior use | Mac equivalent |
|---|---|---|
| `Set-Clipboard` | Copy userscript into Tampermonkey | `pbcopy < src/file.user.js` |
| `Get-Content` | Read files | `cat`, `sed`, or `rg`; keep UTF-8 locale. |
| `New-Item -ItemType Directory` | Create directories | `mkdir -p` |
| PowerShell here-strings | Temporary checks | Use shell heredoc or node/python files. |
| Backslash paths | Windows filesystem | Use `/` and relative paths on Mac. |

## Encoding

Some older Markdown/Skill output appears as mojibake in Windows terminal. JSON character-code checks confirmed `skills/category-resolver/learned_rules.json` stores `笔筒` correctly as UTF-8.

Mac action:

```bash
export LANG=en_US.UTF-8
python3 -m json.tool skills/category-resolver/learned_rules.json >/dev/null
```

Open the project in a UTF-8 editor and use the freeze documents as source of truth.

## Git

Current directory is not a Git repository.

Mac action:

```bash
git init
git add .
git commit -m "Freeze V1 before Mac validation"
```

## Scripts

| Script type | Files | Mac status |
|---|---|---|
| Python tools | `tools/*.py` | Expected to work with Python 3 after path checks. |
| Node tools | `tools/*.mjs` | Expected to work with Node LTS. |
| Userscripts | `src/*.user.js` | Browser/Tampermonkey dependent, not OS dependent. |

## Browser Automation Risk

Windows Browser / Computer Use hit URL confidence and deep interaction timeouts on Dianxiaomi pages.

Mac action:

1. Do not assume Windows incident reproduces.
2. Start with smoke checks.
3. If Mac browser automation fails similarly, classify as `Environment Control Exception` and do not count as product failure.

## Required Changes On Mac

| Required change | Location | Method | Estimate |
|---|---|---|---:|
| Replace clipboard command | Operator workflow | Use `pbcopy` | 5 min |
| Replace project path assumptions | Docs/operator commands | Use `~/Projects/dianxiaomi-automation-v1` | 10 min |
| Initialize Git | Project root | `git init` and first commit | 10-20 min |
| Verify UTF-8 | Rules/docs | Open in UTF-8 editor, run JSON checks | 10 min |
| Install Tampermonkey scripts | Chrome | Manual import/copy | 20-40 min |

