# Docs Audit README Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the project-facing documentation so README, architecture, install, and test docs match the current source tree and safety boundary.

**Architecture:** This is a docs-first stabilization pass. It derives active versions from `src/*.user.js` headers, derives test status from executable local commands, and writes audit artifacts that separate current truth from historical run logs.

**Tech Stack:** Tampermonkey userscripts, Node.js CLI tools, Python helper scripts, Markdown, Mermaid, ASCII architecture diagrams.

---

## File Structure

- Modify: `README.md`
  - Role: concise source-of-truth entrypoint for operators and reviewers.
- Modify: `docs/architecture.md`
  - Role: Mermaid architecture, component inventory, data flow, safety gates.
- Create: `docs/architecture-ascii.md`
  - Role: terminal/PR-friendly C4-style ASCII architecture map.
- Modify: `docs/install.md`
  - Role: current install and enablement instructions, driven by source versions.
- Modify: `docs/test-plan.md`
  - Role: layered verification strategy and exact local commands.
- Modify: `docs/test-results.md`
  - Role: latest local baseline from this audit run.
- Create: `docs/audit-2026-07-06.md`
  - Role: version drift, encoding findings, test gaps, and next actions.
- Create: `docs/superpowers/specs/engineering-patterns/2026-07-06-userscript-docs-exemplar-research.md`
  - Role: exemplar research record.

## Task 1: Record Research And Planning Artifacts

**Files:**

- Create: `docs/superpowers/specs/engineering-patterns/2026-07-06-userscript-docs-exemplar-research.md`
- Create: `docs/superpowers/plans/2026-07-06-docs-audit-readme.md`

- [x] **Step 1: Capture three-question exemplar research**

Write a compact analysis comparing mature userscript/browser automation documentation patterns with this repository.

- [x] **Step 2: Capture this implementation plan**

Write a docs-first plan with exact files and verification commands.

## Task 2: Rewrite Project Entry README

**Files:**

- Modify: `README.md`

- [x] **Step 1: Replace stale V1 freeze content**

Use the active source matrix from:

```powershell
rg -n "^// @name|^// @version|^// @description" src -g "*.user.js"
```

- [x] **Step 2: Add safety boundary**

Document that this pass does not authorize any Dianxiaomi collection, claim, edit, save, publish, or one-click publish action.

- [x] **Step 3: Add project map and quick verification**

List key folders and the current local baseline commands:

```powershell
node tools\aliexpress-evidence-policy.test.js
node --check src\dianxiaomi-automation-v1-merged-new.user.js
node --check src\dianxiaomi-amazon-crawlbox-v1.user.js
```

## Task 3: Rewrite Architecture Docs

**Files:**

- Modify: `docs/architecture.md`
- Create: `docs/architecture-ascii.md`

- [x] **Step 1: Add Mermaid context/container/component diagrams**

Use these layers: Amazon pages, Dianxiaomi pages, Tampermonkey userscripts, local Node/Python tools, config/rules, evidence stores, run artifacts.

- [x] **Step 2: Add ASCII architecture map**

Keep each line under 100 columns and label sync calls, local file reads, and gated live actions.

## Task 4: Update Install And Test Documentation

**Files:**

- Modify: `docs/install.md`
- Modify: `docs/test-plan.md`
- Modify: `docs/test-results.md`

- [x] **Step 1: Replace outdated install versions**

Use `DXM Automation V1 - NEW v2.1.75`, `DXM Amazon Crawlbox V1 v0.1.50`, `save Payload V3 v0.6.3`, and interface detector `v0.3.0` as the current source-visible versions.

- [x] **Step 2: Document test layers**

Name these layers: static syntax, pure policy tests, schema/fixture checks, read-only/dry-run checks, live gated validation.

- [x] **Step 3: Record latest test result**

Record the exact commands run in this pass and their pass/fail status.

## Task 5: Produce Audit Report

**Files:**

- Create: `docs/audit-2026-07-06.md`

- [x] **Step 1: Summarize version drift**

Record README/install/current-status/source version mismatches.

- [x] **Step 2: Summarize encoding findings**

Record that grep found documented historical mojibake warnings, but no replacement-character hits in the high-priority docs scan.

- [x] **Step 3: Summarize test gaps**

Record that only one explicit `.test.js` file was discovered and no package manifest exists.

## Task 6: Verification

**Files:**

- All modified Markdown files.

- [x] **Step 1: Run local static/test baseline**

```powershell
node tools\aliexpress-evidence-policy.test.js
node --check src\dianxiaomi-automation-v1-merged-new.user.js
node --check src\dianxiaomi-amazon-crawlbox-v1.user.js
git diff --check
```

- [x] **Step 2: Review docs for stale version strings**

```powershell
rg -n "1\.1\.14|1\.1\.43|0\.1\.15|3x10 Validation and Production remain not started" README.md docs\install.md docs\architecture.md docs\test-plan.md docs\test-results.md
```

- [x] **Step 3: Inspect final diff**

```powershell
git status --short
git diff -- README.md docs\architecture.md docs\architecture-ascii.md docs\install.md docs\test-plan.md docs\test-results.md docs\audit-2026-07-06.md
```
