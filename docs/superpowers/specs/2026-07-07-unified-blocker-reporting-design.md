# Unified Blocker Reporting Design

## Goal

Wire readonly edit preflight, batch execution gate, and WebBridge safety reports into one pure blocker vocabulary. The change is source-level only and must not execute Dianxiaomi, AliExpress, Amazon, collection, claim, edit, save, publish, or one-click publish actions.

## Design

The existing `src/dxm-automation-core/business-gates.js` remains the pure business-gate module. This branch extends it with a small report-normalization layer instead of creating a separate rule engine. Existing gates still own business decisions for category evidence, price readiness, freight template `111`, and Ships From `United States`.

New pure functions normalize report producers into the same shape:

```js
{
  allowed: Boolean,
  blockers: string[],
  warnings: string[],
  nextAction: string,
  environmentStatus: {
    pageRendered: true | false | null,
    bridgeReachable: true | false | null,
    structuredReadOk: true | false | null,
    fallbackRecommended: '' | 'computer_use' | 'screenshot'
  },
  normalized: object
}
```

`blockers` are reserved for business or required structured-read stops. `environmentStatus` describes the read/control path. This prevents WebBridge failure, Computer Use fallback, or screenshot fallback from being misreported as `page_not_rendered` when the page itself is rendered.

## Producer Mapping

Readonly preflight:
- Prefer `preflight.businessGate.blockers` when present.
- Fall back to raw `blockers` / `preflight.risks` and normalize through the same blocker vocabulary.
- Missing function/node or thrown readonly function becomes `readonly_preflight_missing` or `readonly_preflight_call_failed`.

Batch gate:
- Local evidence/price/risk blockers use `nextActionForBlockers` from `business-gates.js`.
- Edit preflight merge uses the readonly normalizer rather than local ad hoc labels.
- WebBridge/evaluate failures become environment status plus `readonly_preflight_unavailable`, not `page_not_rendered`.

WebBridge report:
- Existing crawlbox preflight reasons such as `auto_claim_enabled`, `collector_input_missing`, `not_dxm_data_acquisition_page`, and `dangerous_action_blocked:*` map into the same blocker/nextAction contract.
- WebBridge call/read failures become `webbridge_call_failed` or `webbridge_read_failed` with `pageRendered` inferred only from URL/title/readyState evidence.
- `computer_use_fallback_needed` and `screenshot_fallback_needed` are warnings/environment status unless a structured read is required and unavailable.

## Testing

Add deterministic Node assertions in `tools/dxm-automation-core.test.js` before implementation:
- readonly preflight with `businessGate.blockers` and raw blockers normalize identically.
- WebBridge blocked report maps to stable blockers and next action.
- WebBridge call failure with `readyState: complete` records `pageRendered: true`, not `page_not_rendered`.
- batch `mergePreflight()` uses the same readonly blocker shape for unavailable preflight.

## Documentation

Update `docs/current-status.md`, `docs/test-plan.md`, `docs/test-results.md`, and `DEVELOPMENT_LOG.md` after verification. The status text must explicitly state that no live business action was executed.

