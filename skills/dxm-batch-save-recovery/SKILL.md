# Skill Name: dxm-batch-save-recovery

## Input
- Batch product list:
  - `asin`
  - `editUrl` or Dianxiaomi edit `id`
  - `amazonDisplayedPriceUsd`
  - `priceFormula` with exchange rate, multiplier or tiers, rounding, and optional displayed-price candidate policy override
  - `productFamily`
- Current project rules:
  - no final publish
  - no one-click publish
  - no recollection or reclaim for already claimed drafts
  - target store must be `速卖通海外托管 / Halo Home Store`

## Process
1. Open the edit page by direct URL:
   - use `/web/smtlocalProduct/edit?id=<id>`;
   - prefer a new tab when the current tab has stale modal state or WebBridge focus ambiguity.
2. Set trusted task values before applying edit rules:
   - `dxm-single-submit-default-source-price = amazonDisplayedPriceUsd`;
   - `dxm-automation-amazon-source-asin = asin`;
   - `dxm-automation-task-exchange-rate = priceFormula.exchangeRate`;
   - `dxm-automation-task-price-multiplier = priceFormula.multiplier` or the resolved task tier multiplier;
   - `dxm-automation-task-price-range-policy = priceFormula.rangePolicy || "highest_displayed_value"`; this selects the Amazon displayed-price candidate only and does not replace the current task goods-value formula.
   - `dxm-single-submit-default-stock = 15`.
3. Run edit-page rules with timeout:
   - call `window.__DXM_AUTOMATION_V1_APPLY_EDIT_RULES__({ manual: true, preSave: true })`;
   - wrap the call in a 25-30 second timeout;
   - if the call times out, wait once for 5 seconds and then inspect page state;
   - do not let one product block the batch.
4. Handle category decision:
   - if result category mode is `aliexpress-evidence-required`, record `category_evidence_required` and skip save;
   - if result category attempts found a DXM leaf but selected text remains `---- 请选择分类 ----`, record `dxm_visible_category_selection_failed` and skip save;
   - if title risk appears, record the exact forbidden term and skip save unless the title was already cleaned and preflight passes.
5. Handle required attributes:
   - only required red-star attributes are blockers;
   - required Material uses exact material, similar material, safe available material, or direct accepted input;
   - Material AutoComplete is accepted only when the field has no visible error and accessibility/readback shows the value.
6. Handle package-sale validation:
   - if page shows `请输入2~100000之间的数值` for `销售方式 / 每包`, set the package count to the minimum legal value `2` or uncheck package sale when the product is clearly single-piece and local rules allow it;
   - re-check that the alert disappeared before save.
7. Handle freight template:
   - do not search `111` first if the dropdown returns `暂无数据`;
   - clear the freight search box and read the full template list;
   - choose the exact `111` option, not `copy 111` or another similarly named template;
   - if `111` still cannot be selected after 3 attempts, record `postage_template_111_unselectable` and continue.
8. Handle custom attributes:
   - invalid custom attributes must be deleted row-by-row;
   - clearing input values alone is not enough when Dianxiaomi keeps row-level validation text;
   - after deletion, verify that no `自定义属性值不能超过70个字符` text remains before save.
9. Handle PC description:
   - if visible PC description text is below 500 characters or lacks product images, rebuild description with current product images first and neutral non-brand product text.
10. Save only when all save gates pass:
   - category selected;
   - required attributes have no visible red error;
   - expected price is visible and matches the current task price formula;
   - `Ships From` is United States;
   - freight template is `111`;
   - stock is `15`;
   - SKU is ASIN;
   - PC description passes length/image check;
   - no visible `2~100000` package-count alert.
11. Click only `保存并移入待发布`.
12. If success modal appears:
    - confirm text contains `产品已移入待发布`;
    - close with the modal `X`;
    - do not click `创建新产品继续编辑`.
13. After the batch, open `/web/smtlocalProduct/offline` and read back the platform list:
    - count records;
    - match ASINs;
    - record category, CNY price, stock, and store.

## Output
- `completedToWaitPublish[]`:
  - `asin`
  - `category`
  - `priceCny`
  - `stock`
  - `readbackSource`
- `skipped[]`:
  - `asin`
  - `field`
  - `reason`
  - `nextAction`
- `controlIssues[]`:
  - `webbridge_tab_focus_wrong_match`
  - `webbridge_long_evaluate_error`
  - `apply_edit_rules_timeout`
- `efficiencyNotes[]`

## Rules
- Never save when category is blank or category evidence is required.
- Never treat category-blank cascades as separate price/freight/attribute failures; record the root blocker as category first.
- Never rely on the agent operation log alone; final success must be verified on `/web/smtlocalProduct/offline`.
- Never click `发布`, `一键发布`, or `采集并一键发布`.
- Do not retry long WebBridge evaluate scripts after one batch-level failure; switch to short per-product commands.
- Do not use `find_tab` as authoritative when multiple similar edit URLs exist; verify the exact URL or open a fresh edit URL.
- Do not continue live business execution with an old installed userscript when the source fix is required for the current blocker; activate the new script first.

## Efficiency Notes
- Use short page scripts per product instead of one large batch `evaluate`; long scripts can return `webbridge_error` even when short commands work.
- Cache per-family category blockers:
  - if many products return `aliexpress-evidence-required`, stop repeated edit-page filling and run a dedicated AliExpress category-evidence pass first.
- Treat category-blank cascades as one blocker to reduce false field work:
  - price, freight, Ships From, and required attributes often cannot settle until the category exists.
- Always repair `销售方式 / 每包` before native save; otherwise no save request is sent.
- For freight `111`, clearing the search box and selecting from the full list is faster and more reliable than searching `111` directly.
- For custom attributes, row deletion is faster than repeated save attempts after clearing values.
- Use platform wait-to-publish readback as the final verification step.
