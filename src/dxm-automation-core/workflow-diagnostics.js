'use strict';

const { positiveNumber } = require('./pricing-rules');

function compactText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeAsin(value) {
  const match = String(value || '').toUpperCase().match(/\bB0[A-Z0-9]{8}\b/);
  return match ? match[0] : '';
}

function uniqueInOrder(values) {
  const seen = new Set();
  const output = [];
  values.forEach((value) => {
    const key = String(value || '').trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    output.push(key);
  });
  return output;
}

function rowAsin(row) {
  if (typeof row === 'string') return normalizeAsin(row);
  return normalizeAsin(row && (row.asin || row.ASIN || row.sourceAsin || row.productKey || row.url || row.amazonUrl));
}

function rowPriceUsd(row) {
  if (!row || typeof row === 'string') return null;
  return positiveNumber(
    row.amazonDisplayedPriceUsd
    || row.amazonOriginalPriceUsd
    || row.priceUsd
    || row.usdPrice
    || row.price
    || row.sourcePriceUsd
  );
}

function priceInRange(price, priceRange) {
  if (price == null || price <= 0) return false;
  const min = positiveNumber(priceRange && priceRange.min);
  const max = positiveNumber(priceRange && priceRange.max);
  if (min != null && price < min) return false;
  if (max != null && price > max) return false;
  return true;
}

function analyzeCrawlboxBatch(input = {}) {
  const targetAsins = uniqueInOrder((input.targetAsins || []).map(normalizeAsin));
  const targetSet = new Set(targetAsins);
  const rows = Array.isArray(input.rows) ? input.rows : [];
  const rowsByAsin = new Map();
  const rowAsins = [];
  rows.forEach((row, index) => {
    const asin = rowAsin(row);
    if (!asin) return;
    rowAsins.push(asin);
    if (!rowsByAsin.has(asin)) rowsByAsin.set(asin, []);
    rowsByAsin.get(asin).push({ row, index, priceUsd: rowPriceUsd(row) });
  });

  const uniqueRowAsins = uniqueInOrder(rowAsins);
  const duplicateAsins = uniqueRowAsins.filter((asin) => (rowsByAsin.get(asin) || []).length > 1);
  const duplicateRowCount = rowAsins.length - uniqueRowAsins.length;
  const missingAsins = targetAsins.filter((asin) => !rowsByAsin.has(asin));
  const nonTargetAsins = uniqueRowAsins.filter((asin) => !targetSet.has(asin));
  const invalidPriceAsins = targetAsins.filter((asin) => {
    const asinRows = rowsByAsin.get(asin) || [];
    if (!asinRows.length) return false;
    return !asinRows.some((item) => priceInRange(item.priceUsd, input.priceRange));
  });
  const safeClaimAsins = targetAsins.filter((asin) => {
    const asinRows = rowsByAsin.get(asin) || [];
    if (!asinRows.length) return false;
    return asinRows.some((item) => priceInRange(item.priceUsd, input.priceRange));
  });

  const rootCauses = [];
  if (duplicateRowCount > 0) rootCauses.push('crawlbox_duplicate_rows');
  if (nonTargetAsins.length) rootCauses.push('crawlbox_non_target_rows');
  if (missingAsins.length) rootCauses.push('crawlbox_missing_target_rows');
  if (invalidPriceAsins.length) rootCauses.push('price_out_of_range_or_zero');

  return {
    targetCount: targetAsins.length,
    rowCount: rowAsins.length,
    uniqueRowCount: uniqueRowAsins.length,
    duplicateRowCount,
    duplicateAsins,
    missingAsins,
    nonTargetAsins,
    invalidPriceAsins,
    safeClaimAsins,
    safeClaimCount: safeClaimAsins.length,
    batchSafe: rootCauses.length === 0 && safeClaimAsins.length === targetAsins.length,
    status: rootCauses.length ? 'filtered_safe_subset' : 'ready',
    rootCauses,
  };
}

function normalizePreflightBlocker(blocker) {
  const raw = compactText(blocker);
  const text = raw.toLowerCase();
  if (!text) return '';
  if (/category_evidence_missing|aliexpress category evidence/.test(text)) return 'category_evidence_missing';
  if (/aliexpress_category_confirmed_but_dxm_mapping_missing/.test(text)) return 'aliexpress_dxm_category_map_missing';
  if (/product category is not selected|category is not selected|\u4ea7\u54c1\u5206\u7c7b.*(\u672a|\u7a7a)/i.test(raw)) return 'product_category_not_selected';
  if (/postage template is not 111|freight template is not 111|\u8fd0\u8d39.*111/i.test(raw)) return 'postage_template_not_111';
  if (/ships? from is not united states|\u53d1\u8d27\u5730.*(united states|\u7f8e\u56fd)/i.test(raw)) return 'ships_from_not_united_states';
  if (/price invalid|price_mismatch|amazon_displayed_price_missing|amazon_original_price_missing/.test(text)) return 'price_invalid';
  if (/required attributes incomplete|native_product_attribute_error|product attribute/.test(text)) return 'required_attributes_incomplete';
  if (/variation required fields incomplete|required variation attribute/.test(text)) return 'variation_required_fields_incomplete';
  if (/pc description/.test(text)) return 'pc_description_incomplete';
  if (/marketing images incomplete/.test(text)) return 'marketing_images_incomplete';
  if (/custom attributes invalid/.test(text)) return 'custom_attributes_invalid';
  return text.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'unknown_preflight_blocker';
}

function nextActionForPreflight(normalizedBlockers) {
  if (normalizedBlockers.includes('category_evidence_missing')) return 'run_aliexpress_category_verification_before_save';
  if (normalizedBlockers.includes('aliexpress_dxm_category_map_missing')) return 'map_verified_aliexpress_category_to_dxm_before_save';
  if (normalizedBlockers.includes('product_category_not_selected')) return 'select_verified_dxm_category_before_save';
  if (normalizedBlockers.includes('postage_template_not_111')) return 'select_real_postage_template_111_before_save';
  if (normalizedBlockers.includes('ships_from_not_united_states')) return 'select_real_ships_from_united_states_before_save';
  if (normalizedBlockers.includes('price_invalid')) return 'recover_trusted_amazon_price_and_task_formula_before_save';
  if (normalizedBlockers.includes('required_attributes_incomplete')) return 'repair_required_attribute_real_selections_before_save';
  if (normalizedBlockers.includes('variation_required_fields_incomplete')) return 'repair_required_variation_fields_before_save';
  if (normalizedBlockers.includes('pc_description_incomplete')) return 'rewrite_pc_description_image_first_before_save';
  if (normalizedBlockers.includes('marketing_images_incomplete')) return 'generate_required_marketing_images_before_save';
  if (normalizedBlockers.includes('custom_attributes_invalid')) return 'delete_imported_custom_attributes_before_save';
  return normalizedBlockers.length ? 'manual_edit_preflight_review' : 'save_to_wait_publish_only_after_final_visible_confirmation';
}

function analyzeEditPreflightReadback(preflight) {
  if (!preflight || typeof preflight !== 'object') {
    return {
      stage: 'readonly_preflight_missing',
      saveAllowed: false,
      rootCause: 'readonly_preflight_missing',
      normalizedBlockers: ['readonly_preflight_missing'],
      nextAction: 'open_correct_edit_page_and_rerun_readonly_preflight',
    };
  }
  const rawBlockers = Array.isArray(preflight.blockers)
    ? preflight.blockers
    : (preflight.preflight && Array.isArray(preflight.preflight.risks) ? preflight.preflight.risks : []);
  const normalizedBlockers = uniqueInOrder(rawBlockers.map(normalizePreflightBlocker).filter(Boolean));
  const saveAllowed = Boolean(preflight.safeToSaveToWaitPublish === true && normalizedBlockers.length === 0);
  const rootCause = normalizedBlockers[0] || (saveAllowed ? '' : 'edit_preflight_not_safe_to_save');
  return {
    stage: saveAllowed ? 'ready_for_wait_publish_save' : 'edit_preflight_blocked',
    asin: normalizeAsin(preflight.asin || preflight.currentAsin),
    saveAllowed,
    preflightPass: Boolean(preflight.preflightPass || preflight.pass),
    safeToSaveToWaitPublish: Boolean(preflight.safeToSaveToWaitPublish),
    rootCause,
    normalizedBlockers,
    blockers: rawBlockers,
    nextAction: nextActionForPreflight(normalizedBlockers),
  };
}

module.exports = {
  analyzeCrawlboxBatch,
  analyzeEditPreflightReadback,
  normalizePreflightBlocker,
};
