# Engineer Framework Test Line

## Purpose

This directory defines a separate documentation track for validating the engineer framework.

It is not the live Dianxiaomi execution line. It does not replace `AGENT.md`, `AGENTS.md`, `TASK.md`, `DEVELOPMENT_LOG.md`, or any existing business execution rule.

## Scope

Allowed in this test line:

- Local unit tests.
- Local dry-run scripts.
- Local validation scripts.
- Read-only reports.
- Future readonly browser checks only when a separate stage explicitly allows them.

Forbidden in this test line:

- Dianxiaomi collection.
- Dianxiaomi claim.
- Dianxiaomi edit-page field writing.
- Save or move to wait-publish.
- Publish or one-click publish.
- Cookie, session, token, password, API key, browser profile, or local private path commits.

## Documents

```text
README.md
SAFE_TEST_BOUNDARY.md
LOCAL_VALIDATION_RUNBOOK.md
NEXT_STAGE_TEST_PLAN.md
REPORT_TEMPLATE.md
```

## Operating Rule

Every engineer-framework test run must choose the lowest-risk stage that can answer the question.

If a local dry-run is enough, do not open a browser.

If a readonly browser check is enough, do not click business controls.

If a live action would be needed, stop and create a new explicit authorization task before doing anything.
