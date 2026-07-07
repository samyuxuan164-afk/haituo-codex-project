---
name: field-fill-rule
description: Use when filling Dianxiaomi edit-page attributes, custom attributes, images, variation parameters, variation info, stock, SKU, freight template, and preflight-visible fields.
---

# Field Fill Rule Skill

Authoritative exception rules: `docs/exception-rules.md`. If a field-filling detail conflicts with this skill, follow `AGENT.md`, current `TASK.md`, and `docs/exception-rules.md`.

## Input

```json
{
  "asin": "Amazon ASIN",
  "categoryPath": "visible Dianxiaomi category path",
  "requiredFields": [],
  "amazonOriginalPriceUsd": 0,
  "visiblePageState": {}
}
```

## Process

1. Product attributes:
   - fill only fields with a visible red `*`;
   - do not fill fields without a red `*`;
   - do not use non-required fields as preflight blockers.
   - ordinary text/number fields can be typed according to their field rules; for red-star Ant/select dropdown fields, the input is only a search/filter box and completion requires selecting a real option from the dropdown.
2. Required product attribute defaults:
   - Brand: choose `NONE`, `None`, `No Brand`, or the closest page-safe no-brand value;
   - Function / Feature / Use: choose a real visible option that is safe and not obviously wrong; exact obvious options are preferred, but `Other/其他` is a valid fallback and should not block saving when it commits successfully;
   - High-concerned chemical: choose `天然未处理(None)` or page-equivalent `None`;
   - Origin: for the current Amazon US -> AliExpress overseas-hosting batch, choose the real page option for `United States` / `美国(Origin)(US(Origin))` and confirm readback; do not automatically fall back to `Mainland China/中国大陆`;
   - Frame Material: when visible and required, use the same evidence as Material; for metal/steel mesh organizers prefer `Metal`, `Steel`, `Iron`, `Alloy`, or closest page-safe equivalent before `Other/其他`;
   - Material: when the field has a visible red `*`, extract material from Amazon title/detail/spec evidence and fill it with the required-material fallback flow below.
3. Required dropdown real-selection flow:
   - close stale `.ant-select-dropdown` overlays before opening the target field;
   - open the target field's own dropdown;
   - read the visible option list from the active dropdown nearest to the current field;
   - for Function / Use / Feature, do not type/search by default; choose from the recommended visible option list first;
   - search/filter only after checking the unfiltered visible list and only when no safe recommended option exists, because typed search text can hide the real options;
   - if a typed search value makes the dropdown show `暂无数据`, delete/clear the search text and re-read the recommended default options before deciding the field has no options;
   - choose the best real option from the page list, not a free-typed value;
   - if no exact option exists, choose the safest visible adjacent/common option for that field type; for Function/Use/Feature, `Other/其他` is legal and usually preferred over over-analyzing;
   - do not keep retrying a more specific Feature/Function/Use option if `Other/其他` is visible and can be committed; commit `Other/其他`, read it back, and continue;
   - do not choose an obviously wrong option just because it is visible, for example `Adjustable Size` for a fixed-size jar;
   - do not infer `无BPA塑料(Bpa-free plastic)` only from acrylic/plastic material; choose BPA-free only when source evidence or page data explicitly says BPA-free;
   - click the real option object;
   - for dynamic attribute dropdowns such as Function / Use / Feature, do not use Enter/Tab after clicking the real option; commit by change/blur only, because Enter/Tab can expose the backend option ID instead of the label;
   - read back a selected label/item in the field container;
   - if readback is a pure numeric/internal option ID, treat it as invalid, clear the field, and reselect once with click-only commit;
   - if clearing an internal-ID display or a typed search value makes the field render `暂无数据`, clear the search text again to restore Dianxiaomi recommendations, then choose the safest real visible recommended option;
   - if only the dropdown search input contains text and no selected label/item exists, treat the dropdown field as not selected;
   - if the page or native save feedback still shows `请选择产品属性`, the field is still missing even if the script's mapped preflight fields look complete; locate the exact named field and repair it with a real dropdown option before saving again;
   - if the active dropdown renders no real option objects after stale overlays are cleared, search text is cleared, and recommended options are re-read, record `product_attribute_dropdown_selection_failed`;
   - if native save still reports `请选择产品属性`, repair the named field with this same flow; after 3 focused attempts record `product_attribute_dropdown_selection_failed`.
4. Non-required product attributes:
   - leave `Material` untouched when it has no red `*`;
   - leave `is_customized` untouched when it has no red `*`;
   - leave `Certification` untouched when it has no red `*`.
5. Required Material / Frame Material fallback flow:
   - first try exact dropdown match for the Amazon material, for example `不锈钢(Stainless steel)` for `Stainless steel`;
   - if no exact match exists, choose a similar material option that best represents the Amazon material, for example `钢铁(Steel)`, `金属(Metal)`, `铁(iron)`, or `合金(Alloy)` for stainless steel;
   - if no exact or similar material exists, choose any available material option to pass the required field, as long as it is not an obvious compliance-risk option;
   - if Material is a checkbox group rather than a dropdown, choose a real checked option and verify the checkbox state; when the exact material is absent and `其他 (自行填写)(Other)` exists, prefer that over an inaccurate material such as PVC/cotton/metal;
   - if the dropdown has no options and the field accepts free text, input the Amazon material text directly, for example `Stainless Steel`;
   - do not block only because the exact Amazon material is absent from the Dianxiaomi dropdown;
   - for metal mesh drawer organizers, do not accept a stale or uncommitted `塑料(Plastic)` value when the page still reports `请选择产品属性`;
   - record `material_required_unfillable` only when no material option can be selected and direct input is not accepted.
6. Custom attributes:
   - clear or delete imported custom attribute rows by default;
   - do not rewrite Amazon bullet text;
   - treat `自定义属性值不能超过70个字符` as a clear/delete signal, not as a copywriting task.
7. Product images:
   - keep valid selected product images;
   - click marketing image `一键生成`;
   - confirm `1:1 白底图` and `3:4 场景图` are generated or record `marketing_image_generation_failed`.
8. Variation parameters:
   - select only required `发货地`;
   - fixed value is `美国(United States)`;
   - leave `Color`, `Number of Pcs`, and `Size` blank unless they have a visible red `*`.
9. Variation info:
   - leave `计件单位` as is when already filled;
   - do not check `销售方式/打包出售`;
   - fill `商家仓库存` as fixed `15`; if Amazon is out of stock or unavailable, skip before collection instead of editing stock;
   - fill every `SKU编码` row as the current Amazon ASIN, without color/size text or `ASIN-1` suffixes;
   - fill weight and dimensions from collected data or project defaults;
   - fill goods value from `skills/price-processing/SKILL.md`.
10. Freight:
   - select the real dropdown option `运费模板 = 111`;
   - do not type `111` into the search/input box as completion;
   - reject `copy 111` / `copy111` options;
   - confirm committed readback is exactly `111` before save.
11. If Function / Feature / Use has no exact option, choose `Other/其他`; do not spend batch time over-analyzing these fields, but still choose a real dropdown option.
   - If an exact/safe option is visible, try it first, for example `无BPA塑料(Bpa-free plastic)` for acrylic/plastic qtip holders.
   - If that exact/safe option does not commit quickly but `Other/其他` is visible, use `Other/其他` rather than blocking the product.
12. If a required non-Material, non-Function, non-Feature field has no safe option, record a field-level failure and continue to the next product.
13. If native save exposes additional required checkbox/radio groups after page preflight, repair the exact named field with real options and checked-state readback. Example: Placemats can require Theme and Product application scenarios; use `Other/其他` for generic Theme and product-evidence scenarios such as Kitchen / Dining table for kitchen mats.
14. If native save exposes additional required Ant/select product attributes after page preflight, repair them the same way. Example: Makeup Organizers for cotton-swab holders can expose required `用途(Use)` and `特性(Feature)`; select real visible options such as `其他(others)` / `其他(Other)` when more specific options are unsupported or not evidenced.

## Output

```json
{
  "asin": "Amazon ASIN",
  "filledFields": [],
  "clearedFields": ["custom_attributes"],
  "skippedNonRequiredFields": [],
  "fieldFailures": [
    {
      "field": "field name",
      "reason": "machine-readable reason",
      "visibleEvidence": "page text"
    }
  ],
  "readyForPreflight": true
}
```
