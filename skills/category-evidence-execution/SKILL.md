---
name: category-evidence-execution
description: Execute category resolution for Dianxiaomi listing batches by reusing only success-verified category rules; all unverified product families must go through AliExpress/similar-product category verification before selecting a visible Dianxiaomi category.
---

# Category Evidence Execution Skill

Use this skill before opening or filling a Dianxiaomi edit-page product when its product-family category has not already succeeded to wait-to-publish or listing success.

## Input

```json
{
  "asin": "Amazon ASIN",
  "title": "Amazon or Dianxiaomi product title",
  "sourceUrl": "Amazon product URL",
  "imageUrls": ["current product image URLs when available"],
  "amazonOriginalPriceUsd": 0,
  "targetStore": "Halo Home Store",
  "businessLicenseGroup": "current license group",
  "editUrl": "https://www.dianxiaomi.com/web/smtlocalProduct/edit?id=..."
}
```

## Process

1. Check `skills/category-resolver/learned_rules.json`.
2. Use a learned rule directly only when it is success-verified:
   - status or evidence shows `saved_to_wait_publish_success`, `listing_success_verified`, or equivalent readback success;
   - it has a Dianxiaomi visible category path/search terms;
   - the current product matches the same specific product family, not only broad words.
3. If a rule is only a candidate, historical search result, AI judgment, or unverified mapping, record `category_rule_not_success_verified` and run AliExpress verification.
4. If no success-verified rule matches, record `aliexpress_category_required` and run AliExpress verification. Do not enter Dianxiaomi edit-page category selection first.
5. Open AliExpress with the current logged-in Chrome session and search by product image or similar-product/title terms.
6. Extract category evidence from similar products:
   - category id when visible in structured data;
   - category path when visible;
   - repeated product-family wording from top similar results;
   - conflicting category candidates and counts.
7. If AliExpress evidence itself is split across conflicting product families with no clear majority, record `aliexpress_category_evidence_split` and skip this product.
8. Convert AliExpress evidence into Dianxiaomi search terms:
   - use specific product-family nouns first;
   - use material/use/location terms only as secondary signals;
   - never use broad words such as `Organizer`, `Holder`, `Storage`, or `Accessories` alone.
9. In the Dianxiaomi edit-page category modal, search and select the closest visible leaf category.
10. If Dianxiaomi search returns multiple plausible candidates before AliExpress evidence was checked, record `dxm_candidate_category_split`; do not skip; return to AliExpress/Amazon evidence and decide.
11. If Dianxiaomi cannot find a visible matching leaf after AliExpress evidence is clear, record `dxm_visible_category_not_found` and skip this product.
12. If a visible leaf is selected, continue edit-page field filling and preflight.
13. Only after the product is saved to wait-to-publish or listing success and readback confirms the category, append or update a success-verified rule in `skills/category-resolver/learned_rules.json`.

## Evidence Gate

Before any Dianxiaomi category search, create or reuse this evidence object:

```json
{
  "asin": "Amazon ASIN",
  "productFamily": "specific product family",
  "aliexpressEvidenceStatus": "clear | split | missing | unavailable",
  "aliexpressCandidateCategories": [],
  "evidenceSource": "success_verified_rule | aliexpress_image_search | aliexpress_similar_search | structured_result | missing",
  "dxmSearchTerms": [],
  "legalNextStep": "search_dxm | skip_split | run_aliexpress_category_verification | retry_later"
}
```

Rules:

1. `search_dxm` is legal only when `aliexpressEvidenceStatus` is `clear` or a matching success-verified rule is reused.
2. If the evidence object is missing, record `category_evidence_missing` / `needs_aliexpress_category_verification`; do not search Dianxiaomi.
3. `dxm_visible_category_not_found` is legal only after `aliexpressEvidenceStatus = clear` and the recorded `dxmSearchTerms` fail to expose a matching visible Dianxiaomi leaf.
4. If AliExpress evidence is split, record `aliexpress_category_evidence_split`; do not search Dianxiaomi first.
5. If AliExpress is unavailable because of login, CAPTCHA, or network control, record `aliexpress_category_verification_unavailable` and continue to the next product.

## Output

```json
{
  "asin": "Amazon ASIN",
  "status": "category_selected | skipped",
  "selectedCategoryPath": "Dianxiaomi visible category path or empty",
  "selectedCategoryLeaf": "Dianxiaomi leaf text or empty",
  "evidence": {
    "source": "success_verified_rule | unverified_rule | aliexpress_image_search | aliexpress_similar_search | dxm_visible_search",
    "matchedTerms": [],
    "candidateCategories": [],
    "confidence": 0
  },
  "skipReason": "category_evidence_missing | aliexpress_category_evidence_split | dxm_visible_category_not_found | aliexpress_category_required | category_rule_not_success_verified | aliexpress_category_verification_unavailable | empty"
}
```

## Skip And Continue Rules

1. `dxm_candidate_category_split` is not a skip reason; it means Dianxiaomi candidates split and AliExpress/Amazon evidence must decide.
2. `aliexpress_category_evidence_split` means AliExpress evidence itself is split; record and continue to the next product.
3. `dxm_visible_category_not_found` means record and continue to the next product.
4. `aliexpress_category_required` and `category_rule_not_success_verified` mean run AliExpress verification before Dianxiaomi edit-page selection, not skip by default.
5. Do not wait for manual intervention during a batch.
6. Do not save a product with unresolved or mismatched category.
7. Do not use `dxm_visible_category_not_found` when AliExpress evidence is missing; use `category_evidence_missing` / `needs_aliexpress_category_verification`.

## Rule Deposition

After a successful wait-to-publish readback, write a reusable rule with:

```json
{
  "id": "product-family-visible-dxm",
  "status": "saved_to_wait_publish_success",
  "type": "categoryMapping",
  "scope": "specific-product-family-only",
  "categoryId": "",
  "categoryPath": "Dianxiaomi visible full path",
  "match": {
    "anyTitleTerms": [],
    "anySourceCategoryTerms": [],
    "negativeTitleTerms": []
  },
  "visibleCategorySearchTerms": [],
  "evidence": [],
  "successReadback": {
    "state": "wait_to_publish | listed",
    "asin": "",
    "categoryPath": ""
  },
  "principles": []
}
```
