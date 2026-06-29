# Mac First Setup Guide

## 1. Prepare Tools

Install:

```text
Chrome
Tampermonkey
Node.js LTS
Python 3.11+
Git
VS Code or another UTF-8-safe editor
```

Optional but useful:

```text
Homebrew
ripgrep
jq
```

## 2. Place Project

Recommended path:

```text
~/Projects/dianxiaomi-automation-v1
```

Avoid spaces and non-ASCII path dependencies in scripts. The project folder can contain Chinese filenames, but scripts should use relative paths.

## 3. Verify Files

From project root:

```bash
pwd
find src skills docs tools runs analysis -maxdepth 2 -type f | wc -l
node --check src/dianxiaomi-automation-v1-merged-new.user.js
python3 -m json.tool skills/category-resolver/learned_rules.json >/dev/null
python3 -m json.tool skills/bumpers-v2/known_issues.json >/dev/null
```

## 4. Initialize Git

Only after confirming the copied project is complete:

```bash
git init
git add .
git commit -m "Freeze V1 before Mac validation"
```

## 5. Install Tampermonkey Scripts

Install these scripts:

```text
src/dianxiaomi-automation-v1-merged-new.user.js
src/dianxiaomi-amazon-crawlbox-v1.user.js
src/dianxiaomi-save-payload-capture-v3.user.js
src/dianxiaomi-interface-detector-v2.user.js
```

Expected versions:

```text
DXM Automation V1 - NEW v1.1.41
DXM Amazon Crawlbox V1 v0.1.21
save Payload V3 v0.6.1
Interface Detector V2 v0.3.0
```

## 6. Browser Login

Open Chrome and login:

```text
Dianxiaomi
Amazon
```

Do not start 3 x 10 validation until the smoke checks pass.

## 7. Smoke Checks

1. Open Dianxiaomi product page.
2. Confirm `DXM Automation V1 - NEW v1.1.41` panel appears.
3. Open Amazon product/search page.
4. Confirm `DXM Amazon Crawlbox V1 v0.1.21` panel appears.
5. Do not publish.

## 8. Resume Validation

Resume target:

```text
3 different categories
10 real products each
30 total

Amazon product
-> collection box
-> claim
-> edit page auto-fill
-> save
-> wait-to-publish
```

Final publish must not be executed.

