---
name: project-freeze-handoff
description: Use when resuming the V1 Dianxiaomi automation project after freeze, Mac migration, or Browser Session incident recovery.
---

# Project Freeze Handoff Skill

## Source Of Truth

Use these documents first:

1. `docs/freeze-v1-20260625/FREEZE_REPORT.md`
2. `docs/freeze-v1-20260625/HANDOFF.md`
3. `docs/freeze-v1-20260625/MAC_MIGRATION_GUIDE.md`
4. `docs/freeze-v1-20260625/BROWSER_SESSION_INCIDENT_REPORT.md`

## Current Versions

1. Main plugin: `DXM Automation V1 - NEW v1.1.42`.
2. Collection plugin: `DXM Amazon Crawlbox V1 v0.1.22`.
3. Payload capture: `save Payload V3 v0.6.2`.

## New Environment Execution Flow

For every computer migration, new environment setup, plugin recovery, and validation run, follow this order exactly:

```text
Environment Recovery
-> Panel Validation
-> Environment Ready
-> Functional Validation
-> Smoke Test
-> 3x10 Validation
-> Production
```

Phase rules:

1. `Environment Recovery` only restores Chrome, Tampermonkey, scripts, Node, Git, and project files.
2. `Panel Validation` only checks panel visibility, account, page, overlap, and obvious errors.
3. `Environment Ready` confirms browser, script, project, Node, Git, and read-only Console state.
4. `Functional Validation` only checks plugin initialization, hooks, page listeners, network listeners, button binding, and Console stability.
5. Do not enter `Smoke Test` until `Functional Validation` passes.
6. Do not enter `3x10 Validation` until `Smoke Test` passes.
7. Do not enter `Production` until `3x10 Validation` passes.

During the first four phases, do not collect products, click start collection, claim, edit, save, or publish.

## Current Validation Target

```text
3 different categories
10 real products each
30 products total

Amazon product
-> collection box
-> claim
-> edit page auto-fill
-> save
-> wait-to-publish
```

Do not execute final publish.

## Environment Control Exception

If Browser / Computer Use repeatedly hits `evaluate`, `domSnapshot`, screenshot, `reload`, `goto`, or browser URL confidence failures on Dianxiaomi pages, classify the issue as:

```text
Environment Control Exception
```

This is not a business failure, plugin failure, project failure, or product failure.

Do not keep repeating deep browser control attempts. Record the event and resume only after environment recovery.
