# Dianxiaomi Automation V1

## Current Status

V1 is frozen on 2026-06-25 for Mac migration. The new Mac environment migration is complete; minimal read-only Functional Validation, read-only smoke tests, and the controlled 1-link Smoke Test have passed. 3x10 Validation and Production have not started.

Current source of truth:

```text
docs/freeze-v1-20260625/FREEZE_REPORT.md
docs/freeze-v1-20260625/HANDOFF.md
docs/freeze-v1-20260625/MAC_MIGRATION_GUIDE.md
docs/freeze-v1-20260625/BROWSER_SESSION_INCIDENT_REPORT.md
```

## Active Versions

| Component | Version | File |
|---|---:|---|
| DXM Automation V1 - NEW | 1.1.43 | `src/dianxiaomi-automation-v1-merged-new.user.js` |
| DXM Amazon Crawlbox V1 | 0.1.24 active / 0.1.25 source prepared | `src/dianxiaomi-amazon-crawlbox-v1.user.js` |
| save Payload V3 | 0.6.3 | `src/dianxiaomi-save-payload-capture-v3.user.js` |
| Interface Detector V2 | 0.3.0 | `src/dianxiaomi-interface-detector-v2.user.js` |

Source update manually saved in Tampermonkey and confirmed active after Chrome full quit/reopen:

| Component | Prepared Version | Change |
|---|---:|---|
| DXM Automation V1 - NEW | 1.1.43 | Remove visual boot/recovery badge overlay. |
| save Payload V3 | 0.6.3 | Remove visual boot/recovery badge overlay. |
| DXM Amazon Crawlbox V1 | 0.1.24 | Add WebBridge-compatible read-only preflight and dangerous-action safety interception; not yet confirmed active in Tampermonkey. |
| DXM Amazon Crawlbox V1 | 0.1.25 | Expose full WebBridge preflight result through page window, unsafeWindow, DOM JSON fallback, and data attributes; not yet confirmed active in Tampermonkey. |

Mac migration note: after enabling Tampermonkey user scripts or changing script installs, fully quit and reopen Chrome. A page refresh can still show scripts as enabled while userscript execution has not restarted.

## Standard Validation Path

```text
Amazon product
-> Dianxiaomi collection box
-> claim
-> edit page auto-fill
-> save
-> wait-to-publish
```

Final publish is not part of the current validation target.

## Current Decision Point

Controlled 1-link Smoke Test passed after Dianxiaomi native `自动认领` was unchecked and verified. One Amazon link was collected into the collection box only; no claim, edit, save, publish, or `采集并一键发布` action was executed.

## Next Step

```text
Wait for explicit user confirmation before any 3x10 Validation or Production action.
```
