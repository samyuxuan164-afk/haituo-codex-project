# Next Stage Test Plan

## Stage 1: Main Local Validation

Purpose: confirm the merged main branch can run the local engineer-framework checks.

Allowed:

- Unit tests.
- Local dry-run.
- Local validate.
- Local preflight summary.
- Report generation.

Forbidden:

- Browser access.
- Dianxiaomi page control.
- Collection, claim, edit, save, publish, one-click publish.

Exit criteria:

- All selected local checks either pass or have documented root causes.
- No real execution risk is observed.
- No sensitive data is committed.

## Stage 2: Readonly Browser Feasibility

Purpose: confirm whether readonly browser checks can observe state without business action.

Allowed only after Stage 1 passes:

- Browser page observation.
- Readonly JavaScript readback.
- Screenshots only when needed for evidence.

Forbidden:

- Clicking business controls.
- Filling fields.
- Saving.
- Publishing.
- Claiming or collecting.

Exit criteria:

- Browser actions are documented as readonly.
- No store state is changed.
- Any browser-control exception is classified as environment control, not business failure.

## Stage 3: Flow-Level Test Design

Purpose: design a future controlled flow test.

This stage prepares a plan only. It does not execute live business actions.

Any live action must have a separate user authorization, exact target, rollback or stop conditions, and a report template before execution.
