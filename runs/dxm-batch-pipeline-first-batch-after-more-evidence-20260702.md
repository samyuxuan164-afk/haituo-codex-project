# DXM Batch Pipeline Report

Generated: 2026-07-02T05:02:57.467Z
Command: plan
Dry run: false

## Safety

- businessActions: false
- browserActions: false
- writesManifestReport: true
- writesExceptionQueue: false
- writesPriceStore: false

## Summary

- Total: 10
- Manifest auto ready: 3
- Gate ready: 3
- Blocked: 7
- Control retryable: 0

## Recommended Order

- manual_risk_review_or_skip: none
- recover_prices: none
- verify_aliexpress_categories: B0CZ7F61XN, B0DZ14L38Y, B0F1DDLKBB, B0CTBQCKL9, B01E2EYG4U, B0GFV4N3K8, B0C1JY1C7F
- retry_control_readback: none
- readonly_edit_preflight: B0DXFB86J7, B0DPSJP47V, B0FH7774VK
- wait_publish_readback: none
- batch_exception_report: none

## Gate Rows

| ASIN | Ready | Next Action | Blockers |
|---|---:|---|---|
| B0CZ7F61XN | no | run_aliexpress_category_verification_or_import_confirmed_evidence | category_evidence_missing |
| B0DZ14L38Y | no | run_aliexpress_category_verification_or_import_confirmed_evidence | category_evidence_missing |
| B0DXFB86J7 | yes | open_edit_page_and_run_readonly_preflight | - |
| B0DPSJP47V | yes | open_edit_page_and_run_readonly_preflight | - |
| B0F1DDLKBB | no | run_aliexpress_category_verification_or_import_confirmed_evidence | category_evidence_missing |
| B0CTBQCKL9 | no | run_aliexpress_category_verification_or_import_confirmed_evidence | category_evidence_missing |
| B0FH7774VK | yes | open_edit_page_and_run_readonly_preflight | - |
| B01E2EYG4U | no | run_aliexpress_category_verification_or_import_confirmed_evidence | aliexpress_category_evidence_split |
| B0GFV4N3K8 | no | run_aliexpress_category_verification_or_import_confirmed_evidence | category_evidence_missing |
| B0C1JY1C7F | no | run_aliexpress_category_verification_or_import_confirmed_evidence | category_evidence_missing |

