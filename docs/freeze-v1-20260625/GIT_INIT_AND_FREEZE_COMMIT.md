# Git Init And Freeze Commit

## Purpose

Use this guide tomorrow on Mac after copying the full project directory. The goal is to preserve the V1 freeze state as the first Git baseline commit:

```text
v1-freeze-20260625
```

Current Windows directory is not a Git repository, so Git history is not available yet.

## Recommended Mac Project Path

```bash
mkdir -p ~/Projects
cd ~/Projects/dianxiaomi-automation-v1
```

## Pre-Git Checks

Run these before `git init`:

```bash
pwd
ls
test -f src/dianxiaomi-automation-v1-merged-new.user.js
test -f docs/freeze-v1-20260625/FREEZE_REPORT.md
node --check src/dianxiaomi-automation-v1-merged-new.user.js
python3 -m json.tool skills/category-resolver/learned_rules.json >/dev/null
python3 -m json.tool skills/bumpers-v2/known_issues.json >/dev/null
```

Expected active versions:

```text
DXM Automation V1 - NEW v1.1.41
DXM Amazon Crawlbox V1 v0.1.21
save Payload V3 v0.6.1
```

## Initialize Git

```bash
git init
git status --short
```

Review `.gitignore` before adding files:

```bash
cat .gitignore
```

## Files That Must Be Included

Add these source-of-truth folders/files:

```text
src/
skills/
tools/
docs/
analysis/
runs/
AGENT.md
AGENTS.md
README.md
CHANGELOG.md
VERSION_HISTORY.md
RELEASE_NOTES.md
TODO.md
DEVELOPMENT_LOG.md
DELIVERABLE.md
.gitignore
```

Important freeze documents:

```text
docs/freeze-v1-20260625/INDEX.md
docs/freeze-v1-20260625/FREEZE_REPORT.md
docs/freeze-v1-20260625/HANDOFF.md
docs/freeze-v1-20260625/MAC_MIGRATION_GUIDE.md
docs/freeze-v1-20260625/MAC_FIRST_SETUP_GUIDE.md
docs/freeze-v1-20260625/MAC_ENVIRONMENT_CHECKLIST.md
docs/freeze-v1-20260625/BROWSER_SESSION_INCIDENT_REPORT.md
docs/freeze-v1-20260625/SYSTEM_ARCHITECTURE.md
docs/freeze-v1-20260625/WINDOWS_COMPATIBILITY_AUDIT.md
docs/freeze-v1-20260625/V2_UPGRADE_PROPOSAL.md
docs/freeze-v1-20260625/GIT_INIT_AND_FREEZE_COMMIT.md
```

Important runtime evidence to keep:

```text
runs/stability-30-20260624-065520/
runs/stability-30-20260624-065520/browser-control-blocker-20260625.md
runs/stability-30-20260624-065520/browser-control-exception-20260625-resume.md
analysis/
```

## Files That Must Be Ignored

Do not commit:

```text
.env
.env.*
browser profiles
browser caches
cookies
localStorage/sessionStorage dumps
auth state files
API keys
passwords
tokens
private certificates
node_modules
Python virtualenvs
temporary logs
local temp files
OS/editor metadata
```

The committed `.gitignore` already excludes these categories.

## Add And Inspect

```bash
git add .
git status --short
```

Inspect suspicious files before committing:

```bash
git status --short | grep -Ei 'env|secret|credential|password|token|cookie|storage|profile|cache|node_modules|venv' || true
```

If any sensitive file appears, remove it from staging:

```bash
git restore --staged <path>
```

## Freeze Commit

```bash
git commit -m "v1-freeze-20260625"
```

Tag the freeze:

```bash
git tag v1-freeze-20260625
```

Verify:

```bash
git log --oneline --decorate -1
git status --short
```

Expected result:

```text
latest commit is v1-freeze-20260625
working tree clean or only intentionally ignored local files remain
```

## After Commit

Continue with:

```text
docs/freeze-v1-20260625/MAC_FIRST_SETUP_GUIDE.md
docs/freeze-v1-20260625/MAC_ENVIRONMENT_CHECKLIST.md
TODO.md
```

Do not run final publish during first Mac validation.

