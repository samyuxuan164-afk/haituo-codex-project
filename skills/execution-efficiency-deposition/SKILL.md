---
name: execution-efficiency-deposition
description: Mandatory end-of-task deposition skill for summarizing execution, extracting reusable capabilities, analyzing efficiency bottlenecks, and updating project memory.
---

# Execution Efficiency Deposition Skill

## Skill Name

execution-efficiency-deposition

## Input

```json
{
  "taskId": "current task or batch id",
  "phase": "Planning | Development | Debug | Validation | Recovery | Freeze | Migration | Release",
  "executedProducts": [
    {
      "asin": "Amazon ASIN",
      "categoryFamily": "product family",
      "status": "saved_to_wait_publish | skipped | blocked | environment_interrupted",
      "fieldFailures": [],
      "categoryEvidence": [],
      "timeCostClass": "low | medium | high"
    }
  ],
  "successfulSteps": [],
  "failedSteps": [],
  "reusableOperations": [],
  "webbridgeOperations": [],
  "filesChanged": [],
  "validationResults": []
}
```

## Process

1. Write the task summary before ending the task:
   - task content;
   - successful steps;
   - failed steps;
   - reusable operations;
   - highest-time-cost step.
2. Extract reusable capabilities:
   - collection rules;
   - recognition logic;
   - DOM / WebBridge operation methods;
   - category decision rules;
   - field filling rules;
   - preflight rules;
   - error repair methods;
   - skip conditions;
   - success paths;
   - time bottlenecks;
   - automatable replacement steps.
3. Convert every reusable capability into executable rules:
   - put category capability into `skills/category-evidence-execution/SKILL.md`;
   - put field capability into `skills/field-fill-rule/SKILL.md`;
   - put edit-page DOM capability into `skills/dxm-edit-page-automation/SKILL.md`;
   - put batch continuation capability into `skills/batch-continuation-control/SKILL.md`;
   - put failure classification capability into `skills/failure-recovery/SKILL.md`;
   - create a new Skill only when no existing Skill owns the capability.
4. Mark the highest-time-cost step using one of:
   - `category_evidence_lookup_high_cost`;
   - `dxm_category_modal_search_high_cost`;
   - `field_dropdown_recovery_high_cost`;
   - `webbridge_tab_recovery_high_cost`;
   - `manual_review_high_cost`.
5. Write project memory:
   - update `DEVELOPMENT_LOG.md`;
   - update `docs/current-status.md`;
   - record added or updated Skill paths;
   - record efficiency optimization points.
6. Validate the deposition:
   - run text search for the new skill/rule name;
   - run `git diff --check` on touched markdown files when available;
   - report if validation was not run.
7. Before reporting a browser execution result, verify the authoritative platform state:
   - read the target list page, such as Dianxiaomi wait-to-publish;
   - search for every target ASIN/SKU in that list;
   - compare platform readback against the agent's own operation log;
   - if they differ, platform readback wins and the project memory must be corrected.

## Output

```json
{
  "summary": {
    "task": "what was executed",
    "successfulSteps": [],
    "failedSteps": [],
    "reusableOperations": [],
    "highestTimeCostStep": "machine-readable bottleneck"
  },
  "capabilitiesExtracted": {
    "collectionRules": [],
    "recognitionLogic": [],
    "domWebBridgeMethods": [],
    "categoryRules": [],
    "fieldFillRules": [],
    "preflightRules": [],
    "errorRepairMethods": [],
    "skipConditions": [],
    "successPaths": [],
    "automationReplacements": []
  },
  "skillsWritten": [],
  "memoryUpdated": {
    "developmentLog": true,
    "currentStatus": true
  },
  "efficiencyNotes": []
}
```

## Rules

1. Do not end a meaningful project task without this deposition.
2. Do not write only chat output; at least one project memory file must be updated.
3. If a reusable operation was discovered, write it into an existing Skill or a new Skill under `/skills/`.
4. Every Skill update must include executable `Input`, `Process`, `Output`, `Rules`, and `Efficiency Notes` sections, or the owning Skill must already provide equivalent executable structure.
5. Always mark the highest-time-cost step, even when the task failed.
6. Product-level failure must include field-level or category-level reason.
7. Environment failure must be separated from business failure.
8. A skip condition must be reusable and machine-readable.
9. Do not turn a temporary page-control problem into a product business rule.
10. Do not mark a product category rule as active until save-to-wait-publish or listing readback confirms it.
11. Do not score or summarize browser work from the agent's own WebBridge operation log alone; the final result must use platform list readback when the target is a visible platform state.

## Efficiency Notes

1. Cache category search results by `categoryFamily + searchTerm + visiblePath` during the batch to avoid repeated modal searches.
2. Cache Amazon original price by ASIN and reuse it for price calculation; do not re-read already confirmed batch prices.
3. Prefer direct edit URL in a new tab when the current edit page has unsaved changes.
4. Prefer Skill / Rule lookup before live WebBridge exploration.
5. Reduce WebBridge calls by batching read-only DOM state extraction into one evaluate call per product.
6. Replace repeated manual category judgment with:
   - learned active category rule when success-verified;
   - AliExpress evidence lookup when no verified rule exists;
   - `dxm_candidate_category_split` when Dianxiaomi candidates split before AliExpress proof;
   - `aliexpress_category_evidence_split` only when AliExpress evidence itself splits.
7. Delete repeated artificial waits; use short bounded waits and record timeout class.
8. For dropdown fields, clear stale `.ant-select-dropdown` once before opening the target field; if options still belong to another field, record `select_overlay_cross_field_stale` and continue.
9. For recurring field failures, update `skills/field-fill-rule/SKILL.md` instead of re-debugging from chat memory.
10. For recurring WebBridge/tab issues, update `skills/failure-recovery/SKILL.md` or `skills/dxm-edit-page-automation/SKILL.md` instead of repeating clicks.
11. Final result verification must be a single batched readback of the authoritative list page when possible, instead of checking each edit tab individually.
