# Install And Enablement Guide

## Scope

This guide describes the source-visible userscripts in this repository. It does not confirm what is currently installed in any browser. After changing Tampermonkey scripts, fully quit and reopen Chrome when required by the current task instructions, then confirm the page-visible version.

## Current Source-Visible Scripts

| Script | Version | Source file | Enablement status |
|---|---:|---|---|
| DXM Automation V1 - NEW | 2.1.75 | `src/dianxiaomi-automation-v1-merged-new.user.js` | Main current automation script |
| DXM Amazon Crawlbox V1 | 0.1.50 | `src/dianxiaomi-amazon-crawlbox-v1.user.js` | Current Amazon candidate and collection-box preparation script |
| save.json Payload Capture V3 | 0.6.3 | `src/dianxiaomi-save-payload-capture-v3.user.js` | Enable when payload evidence capture is required |
| Interface Detector V2 | 0.3.0 | `src/dianxiaomi-interface-detector-v2.user.js` | Enable when request/FormData/click-path evidence is required |
| Single Submit Tester | 0.2.5 | `src/dianxiaomi-single-submit-tester.user.js` | Enable only for guarded single-product dry-run/save testing |
| Tampermonkey Execution Diagnostic | 0.0.1 | `src/dianxiaomi-tm-execution-diagnostic.user.js` | Read-only diagnostic helper |

Historical scripts remain in `src/` for reference. Do not enable old and new variants of the same panel at the same time.

## Recommended Enablement

### Normal documentation or local audit work

No browser scripts need to be enabled. Use local commands only:

```powershell
node tools\aliexpress-evidence-policy.test.js
node --check src\dianxiaomi-automation-v1-merged-new.user.js
node --check src\dianxiaomi-amazon-crawlbox-v1.user.js
```

### Read-only browser validation

Enable only the scripts required by the current validation:

1. `DXM Automation V1 - NEW`
2. Optional: `DXM Amazon Crawlbox V1` for Amazon candidate panel checks
3. Optional: `Interface Detector V2` or `save.json Payload Capture V3` for evidence capture

Read-only validation must not click collection, claim, edit, save, publish, or one-click publish controls.

### Guarded live validation

Proceed only when `TASK.md` allows the phase and the user explicitly starts live execution. Before starting, read the required files listed in `TASK.md`.

Minimum confirmation checklist:

1. Target store is confirmed.
2. Business license group is confirmed.
3. Platform channel is `速卖通海外托管`.
4. Browser-visible script versions match the intended source versions.
5. Dianxiaomi native auto-claim state is checked as required by the current task.
6. Dangerous actions are still blocked: publish, one-click publish, wrong channel claim, stale price usage.

## Manual Tampermonkey Update

1. Open the relevant `src/*.user.js` file.
2. Copy the full file content.
3. Open Tampermonkey dashboard.
4. Replace the corresponding script content.
5. Save.
6. Fully quit and reopen Chrome when the current status docs require it.
7. Refresh the target page.
8. Confirm the page-visible version before any validation step.

## Version Verification Commands

Use this command to extract source headers:

```powershell
rg -n "^// @name|^// @version|^// @description" src -g "*.user.js"
```

Expected current highlights:

```text
DXM Automation V1 - NEW v2.1.75
DXM Amazon Crawlbox V1 v0.1.50
save.json Payload Capture V3 v0.6.3
Interface Detector V2 v0.3.0
```

## Safety Boundary

This install guide is not an execution authorization. It does not permit:

- Product collection.
- Claim.
- Edit-page writes.
- Save or move to wait-publish.
- Publish.
- One-click publish.
- Claim to `产品开发` or `草稿箱`.
- Origin fallback from United States to Mainland China.

