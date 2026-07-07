---
status: draft
topic: unified blocker reporting
date: 2026-07-07
---

# Unified Blocker Reporting Exemplar Research

## Scope

This pass studies mature status/reporting patterns for one narrow project problem: readonly edit preflight, batch gate, and WebBridge reports currently describe related failures with different vocabularies. The goal is not to copy a browser framework. The goal is to adapt their separation between page state, read/action channel state, and business-policy blockers.

No Dianxiaomi, AliExpress, Amazon, collection, claim, edit, save, publish, or one-click publish action is part of this research.

## Reference 1: Playwright Actionability

### What it does

Playwright checks multiple actionability conditions before performing UI actions. The important pattern is that it treats page/element readiness as a set of observable conditions such as visible, stable, receiving events, enabled, and editable. A failed actionability check is not automatically a business-rule failure.

### How our context differs

Our system is not trying to drive one test page. It reads Dianxiaomi/AliExpress through userscripts, WebBridge, Computer Use, and screenshots. The same page can be fully rendered while WebBridge evaluation or DOM readback fails.

### Adapt vs skip

Adapt:
- Keep environment/read-channel status separate from business blockers.
- Record `page_rendered` or `page_not_rendered` only from page evidence such as URL/title/readyState, not from a WebBridge timeout alone.

Skip:
- Do not import Playwright or add browser actionability checks to this source-level pass.

## Reference 2: Cypress Retry-ability and Actionability

### What it does

Cypress separates query/retry behavior from action execution. It repeatedly queries until assertions/actionability pass, then performs the action. This is useful because "not found yet" and "business rule blocked" remain different states.

### How our context differs

Our fallback chain is more expensive: WebBridge -> Computer Use -> screenshot. Computer Use and screenshot are slow and should be classified as fallback recommendations, not mixed into the blocker list that decides whether a product is business-safe.

### Adapt vs skip

Adapt:
- Treat `computer_use_fallback_needed` and `screenshot_fallback_needed` as environment status or warnings.
- Do not let fallback presence become an edit/save blocker unless the business readback itself is unavailable.

Skip:
- Do not implement automatic browser retries in this branch.

## Reference 3: Selenium Expected Conditions

### What it does

Selenium has named expected conditions such as presence, visibility, and clickability. This naming pattern makes diagnosis more precise than a single "failed" state.

### How our context differs

Dianxiaomi pages can be smooth and rendered while a script sandbox export, DOM JSON node, or WebBridge evaluate path is missing. A condition vocabulary must include bridge-level states, not only DOM element states.

### Adapt vs skip

Adapt:
- Use explicit machine reasons such as `readonly_preflight_missing`, `readonly_preflight_call_failed`, `webbridge_call_failed`, `webbridge_read_failed`, and `webbridge_probe_stalled`.
- Keep `page_not_rendered` reserved for real page evidence, not a default fallback.

Skip:
- Do not introduce Selenium-style polling APIs.

## Reference 4: OpenTelemetry Status and Attributes

### What it does

OpenTelemetry traces use stable status and attributes so different producers can report errors without losing comparability. A consumer can aggregate by status code and semantic attributes instead of parsing prose.

### How our context differs

Our reports are local JSON from userscripts and Node tools, not distributed traces. Still, we need stable keys across producers so batch summaries, exception queues, and PR audit docs do not invent new labels for the same root cause.

### Adapt vs skip

Adapt:
- Normalize every report into `allowed`, `blockers`, `warnings`, `nextAction`, and `environmentStatus`.
- Preserve producer-specific raw payload under `normalized` or report-specific details.

Skip:
- Do not add trace IDs or telemetry dependencies.

## Patterns To Use

1. Business blockers are policy decisions: category evidence missing, price source missing, template not 111, Ships From not United States, duplicate rows, and risk filters.
2. Environment status is observability/control state: page rendered, bridge reachable, structured read OK, probe stalled, fallback recommended.
3. Screenshot and Computer Use are fallback states, not evidence that a page failed to render.
4. Batch gate, readonly preflight, and WebBridge should all emit the same top-level shape so downstream tools can merge without ad hoc reason maps.

