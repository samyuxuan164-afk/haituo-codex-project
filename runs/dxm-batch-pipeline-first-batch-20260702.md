# DXM Batch Pipeline Report

Generated: 2026-07-02T04:04:00.441Z
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
- Manifest auto ready: 0
- Gate ready: 0
- Blocked: 10
- Control retryable: 0

## Recommended Order

- manual_risk_review_or_skip: none
- recover_prices: B0CZ7F61XN, B0DZ14L38Y, B0DXFB86J7, B0DPSJP47V, B0F1DDLKBB, B0CTBQCKL9, B0FH7774VK, B01E2EYG4U, B0GFV4N3K8, B0C1JY1C7F
- verify_aliexpress_categories: B0CZ7F61XN, B0DZ14L38Y, B0DXFB86J7, B0DPSJP47V, B0F1DDLKBB, B0CTBQCKL9, B0FH7774VK, B01E2EYG4U, B0GFV4N3K8, B0C1JY1C7F
- retry_control_readback: none
- readonly_edit_preflight: none
- wait_publish_readback: none
- batch_exception_report: none

## Gate Rows

| ASIN | Ready | Next Action | Blockers |
|---|---:|---|---|
| B0CZ7F61XN | no | run_aliexpress_category_verification_or_import_confirmed_evidence | category_evidence_missing; amazon_displayed_price_missing |
| B0DZ14L38Y | no | run_aliexpress_category_verification_or_import_confirmed_evidence | category_evidence_missing; amazon_displayed_price_missing |
| B0DXFB86J7 | no | run_aliexpress_category_verification_or_import_confirmed_evidence | category_evidence_missing; amazon_displayed_price_missing |
| B0DPSJP47V | no | run_aliexpress_category_verification_or_import_confirmed_evidence | category_evidence_missing; amazon_displayed_price_missing |
| B0F1DDLKBB | no | run_aliexpress_category_verification_or_import_confirmed_evidence | category_evidence_missing; amazon_displayed_price_missing |
| B0CTBQCKL9 | no | run_aliexpress_category_verification_or_import_confirmed_evidence | category_evidence_missing; amazon_displayed_price_missing |
| B0FH7774VK | no | run_aliexpress_category_verification_or_import_confirmed_evidence | category_evidence_missing; amazon_displayed_price_missing |
| B01E2EYG4U | no | run_aliexpress_category_verification_or_import_confirmed_evidence | category_evidence_missing; amazon_displayed_price_missing |
| B0GFV4N3K8 | no | run_aliexpress_category_verification_or_import_confirmed_evidence | category_evidence_missing; amazon_displayed_price_missing |
| B0C1JY1C7F | no | run_aliexpress_category_verification_or_import_confirmed_evidence | category_evidence_missing; amazon_displayed_price_missing |

