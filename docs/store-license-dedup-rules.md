# Store License Dedup Rules

## Purpose

This document defines product deduplication scope for Dianxiaomi collection, claim, edit, and listing tasks.

The key rule is:

```text
Do not duplicate the same product under the same business-license group.
The same product may be listed under a different business-license group when business value justifies it.
```

## Definitions

- `businessLicenseGroup`: a group of stores operated under the same business license.
- `store`: a Dianxiaomi / AliExpress managed store under one business-license group.
- `productKey`: the normalized product identity used for deduplication.
- `winningProduct`: a product with good sales potential or validated listing value that may be reused across different business-license groups.

Current known structure:

```text
1 business license group = 6 stores
Current test store = one store under the current business license group
```

The user should specify the target business-license group and target store when starting a new collection/listing task.

## Product Identity

Use the strongest available product identity in this order:

1. Exact Amazon ASIN.
2. Exact Amazon product URL normalized to ASIN.
3. Same ASIN + same variation combination.
4. Same title + same main image + same color/size/package combination, only when ASIN is missing.

Different colors, sizes, or package combinations can be separate products when the source listing and SKU evidence show they are real variants.

## Dedup Scope

### Same Business-License Group

Within the same business-license group:

1. The same `productKey` must not be collected again.
2. The same `productKey` must not be claimed to another store under the same business-license group.
3. If one store under the group has already collected, claimed, saved, moved to wait-to-publish, published, or skipped the same product, later tasks under the same group must treat it as duplicate or previously handled.
4. Re-collection is allowed only for recovery when the existing record is confirmed broken, deleted, or unusable; the recovery reason must be logged.

### Different Business-License Groups

Across different business-license groups:

1. The same `productKey` may be collected and listed again.
2. Good-selling or high-potential products can be intentionally reused across other business-license groups.
3. Cross-license reuse must still pass Logo/brand risk checks, category resolver, required attributes, price rules, preflight, and save gates.
4. Cross-license reuse must be recorded as intentional reuse, not treated as accidental duplicate collection.

## Required Task Context

Every new collection/listing task should declare:

```json
{
  "businessLicenseGroup": "license-group-name-or-id",
  "targetStore": "store-name",
  "dedupScope": "same_business_license_group",
  "allowCrossLicenseReuse": true
}
```

If the business-license group is unknown, the task must stop before collection/claim and ask for clarification.

## Dedup Status Values

Recommended status values:

- `not_seen_in_license_group`
- `duplicate_in_same_license_group`
- `claimed_in_same_license_group`
- `wait_publish_in_same_license_group`
- `published_in_same_license_group`
- `skipped_in_same_license_group`
- `allowed_cross_license_reuse`
- `recovery_recollect_allowed`
- `license_group_unknown`

## Execution Rules

1. Collection must check duplicates at `businessLicenseGroup + productKey` scope.
2. Claim must check that the target store belongs to the declared business-license group.
3. Batch claim must not claim products already handled by another store under the same business-license group.
4. High-value products reused under another business-license group must be tagged as `allowed_cross_license_reuse`.
5. Reports must show duplicate decisions with business-license group, target store, productKey, prior status, and action taken.

## Current Implementation Status

This is now the source-of-truth rule for deduplication design.

Implementation status:

```text
Rule documented.
Code-level license-group registry and dedup ledger are pending.
Until the ledger exists, every task must explicitly state businessLicenseGroup and targetStore, and reports must manually record duplicate scope decisions.
```
