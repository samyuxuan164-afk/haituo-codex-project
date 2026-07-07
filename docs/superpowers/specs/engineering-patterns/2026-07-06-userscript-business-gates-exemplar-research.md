---
status: reviewed
date: 2026-07-06
topic: userscript business gates
---

# Userscript Business Gates Exemplar Research

## Scope

The task is to separate deterministic business policy from DOM side effects in the Dianxiaomi userscript. The research focuses on existing local implementations that already behave as pure or near-pure gates.

## Reference 1: `tools/aliexpress-evidence-policy.js`

### Q1: What exactly does it do?

It keeps evidence thresholds and classification in pure functions: `classifyEvidenceConfidence(topShare, hasDxmCategory, conditionalChecks, thresholds)` returns a status, confidence tier, and verification mode. Default thresholds are explicit: high confidence `0.8`, direct pass `0.5`, detail evidence pages `2`, max detail pages `5`.

### Q2: How does our context differ?

The userscript cannot import this file directly without a bundler, and live category selection still depends on DOM readback. The compatible part is the function shape: plain inputs, explicit thresholds, structured output.

### Q3: What should we adapt vs skip?

Adapt the explicit status vocabulary and pure classifier style. Skip file IO and threshold loading inside the userscript gate; adapter code should pass already-read evidence and task config.

## Reference 2: `tools/dxm-batch-execution-gate.js`

### Q1: What exactly does it do?

`buildLocalGate(args, asins)` combines category evidence, Amazon price status, and risk screening into per-ASIN rows. It outputs `localReady`, `readyForEditPreflight`, `blockers`, and `nextAction`. Its safety text states it does not collect, claim, edit, save, publish, delete, order, cart, chat, or submit forms.

### Q2: How does our context differ?

The tool is a CLI orchestrator with filesystem stores and optional WebBridge readback. The userscript adapter has live DOM access and must not perform IO-heavy gate logic during page actions.

### Q3: What should we adapt vs skip?

Adapt the row-level `blockers` plus `nextAction` contract and the rule that local gates only authorize later checks, not business actions. Skip CLI argument parsing, store reads, and WebBridge orchestration in the pure core.

## Reference 3: `tools/product-risk-filter.js`

### Q1: What exactly does it do?

It normalizes product records, applies configured rules, and returns exactly three statuses: `allow`, `needs_review`, and `blocked`. It also creates exception previews only when requested by the caller.

### Q2: How does our context differ?

This userscript gate needs more than risk screening: it must cover crawlbox contamination, price formula readiness, category evidence, freight template, and Ships From. The status model still fits.

### Q3: What should we adapt vs skip?

Adapt the narrow status vocabulary and dry-run-first output style. Skip rule-file loading inside the browser gate.

## Reference 4: `tools/exception-queue.js`

### Q1: What exactly does it do?

`classifyReason(reason, context)` maps free text into normalized reasons, categories, severity, retryability, and next action. It already includes reasons such as `category_evidence_missing`, `amazon_displayed_price_missing`, `price_formula_missing_exchange_rate_or_multiplier`, `price_mismatch`, `required_attribute_incomplete`, and `environment_control_exception`.

### Q2: How does our context differ?

The queue writes to disk and manages persistence. The userscript gate only needs the normalization vocabulary and next-action consistency before a save decision.

### Q3: What should we adapt vs skip?

Adapt normalized reason names and next-action categories. Skip queue locks, JSON persistence, and command handlers.

## Patterns To Carry Into Implementation

1. All gates take plain objects and return structured decisions.
2. Gate output uses stable blocker names before human-readable text.
3. `allowed=true` must mean only "safe to proceed to the next bounded step", never "safe to publish".
4. IO, DOM, localStorage, WebBridge, and native clicks stay outside pure gates.
5. Unknown or missing evidence defaults to blocked, not guessed safe.

## Quality Review

The references are local source files with already-used project semantics. The planned implementation copies the function shape and blocker vocabulary, not CLI IO or DOM behavior. The design remains compatible with the current single-userscript runtime artifact.
