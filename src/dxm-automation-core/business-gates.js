'use strict';

const { calculateSupplyPriceCny, positiveNumber } = require('./pricing-rules');
const { analyzeCrawlboxBatch, normalizePreflightBlocker } = require('./workflow-diagnostics');

const VERIFIED_CATEGORY_STATUSES = new Set([
  'aliexpress_verified',
  'conditional_verified',
  'detail_verified',
  'learned_rule_matched',
]);

function compactText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function uniqueInOrder(values) {
  const seen = new Set();
  const output = [];
  values.forEach((value) => {
    const key = compactText(value);
    if (!key || seen.has(key)) return;
    seen.add(key);
    output.push(key);
  });
  return output;
}

function nextActionForBlockers(blockers, fallback = 'manual_gate_review') {
  if (blockers.includes('category_evidence_missing')) return 'run_aliexpress_category_verification_before_save';
  if (blockers.includes('aliexpress_dxm_category_map_missing')) return 'map_verified_aliexpress_category_to_dxm_before_save';
  if (blockers.includes('amazon_displayed_price_missing')) return 'recover_trusted_amazon_displayed_usd_price';
  if (blockers.includes('price_out_of_range_or_zero')) return 'skip_or_confirm_price_range_exception';
  if (blockers.includes('price_formula_missing_exchange_rate_or_multiplier')) return 'provide_task_exchange_rate_and_multiplier';
  if (blockers.includes('postage_template_not_111')) return 'select_real_postage_template_111_before_save';
  if (blockers.includes('ships_from_not_united_states')) return 'select_real_ships_from_united_states_before_save';
  if (blockers.includes('product_category_not_selected')) return 'select_verified_dxm_category_before_save';
  return fallback || 'manual_gate_review';
}

function decision(blockers, passAction, normalized = {}, warnings = []) {
  const cleanBlockers = uniqueInOrder(blockers);
  return {
    allowed: cleanBlockers.length === 0,
    blockers: cleanBlockers,
    warnings: uniqueInOrder(warnings),
    nextAction: cleanBlockers.length ? nextActionForBlockers(cleanBlockers) : passAction,
    normalized,
  };
}

function evaluateCrawlboxClaimGate(input = {}) {
  const normalized = analyzeCrawlboxBatch(input);
  const blockers = normalized.rootCauses || [];
  return {
    allowed: normalized.batchSafe,
    blockers,
    warnings: normalized.batchSafe ? [] : ['safe_claim_subset_requires_filtered_selection'],
    nextAction: normalized.batchSafe ? 'claim_current_batch_only' : nextActionForBlockers(blockers, 'claim_safe_subset_only'),
    normalized,
  };
}

function resolveMultiplierInput(input) {
  if (input.multiplier && typeof input.multiplier === 'object') {
    if (positiveNumber(input.multiplier.multiplier) != null) return input.multiplier.multiplier;
    if (Array.isArray(input.multiplier.tiers) && input.multiplier.tiers.length) return input.multiplier;
  }
  return input.multiplier;
}

function hasFormulaInput(input) {
  if (positiveNumber(input.exchangeRate) == null) return false;
  const multiplier = resolveMultiplierInput(input);
  if (multiplier && typeof multiplier === 'object' && Array.isArray(multiplier.tiers) && multiplier.tiers.length) return true;
  return positiveNumber(multiplier) != null;
}

function evaluatePriceGate(input = {}) {
  const sourcePrice = positiveNumber(input.sourcePriceUsd || input.amazonDisplayedPriceUsd || input.amazonOriginalPriceUsd);
  const min = positiveNumber(input.priceRange && input.priceRange.min);
  const max = positiveNumber(input.priceRange && input.priceRange.max);
  const blockers = [];
  if (!input.trusted || !sourcePrice) blockers.push('amazon_displayed_price_missing');
  if (sourcePrice && ((min != null && sourcePrice < min) || (max != null && sourcePrice > max))) blockers.push('price_out_of_range_or_zero');
  const formulaInputReady = sourcePrice && hasFormulaInput(input);
  if (sourcePrice && !formulaInputReady) blockers.push('price_formula_missing_exchange_rate_or_multiplier');
  let expectedCnyPrice = '';
  if (formulaInputReady) {
    expectedCnyPrice = calculateSupplyPriceCny(sourcePrice, input.exchangeRate, input.multiplier);
    if (!expectedCnyPrice) blockers.push('price_formula_missing_exchange_rate_or_multiplier');
  }
  if (blockers.length) expectedCnyPrice = '';
  return decision(blockers, 'price_gate_passed', {
    asin: compactText(input.asin),
    sourcePriceUsd: sourcePrice || null,
    expectedCnyPrice,
    status: compactText(input.status || (input.trusted ? 'trusted' : 'missing')),
  });
}

function evaluateCategoryEvidenceGate(input = {}) {
  const status = compactText(input.status || input.aliexpressEvidenceStatus);
  const dxmCandidateCategory = compactText(input.dxmCandidateCategory || input.dxmVisibleCategoryPath || input.dxmVisibleCategory);
  const blockers = [];
  const evidenceVerified = VERIFIED_CATEGORY_STATUSES.has(status);
  if (!evidenceVerified) blockers.push('category_evidence_missing');
  if (evidenceVerified && !dxmCandidateCategory) blockers.push('aliexpress_dxm_category_map_missing');
  return decision(blockers, 'category_evidence_gate_passed', {
    status,
    confidenceTier: compactText(input.confidenceTier),
    dxmCandidateCategory,
    safeAdjacentAllowed: Boolean(input.safeAdjacentAllowed),
  }, evidenceVerified && dxmCandidateCategory && input.safeAdjacentAllowed ? ['safe_adjacent_dxm_category_selected'] : []);
}

function evaluateTemplateGate(input = {}) {
  const selectedText = compactText(input.selectedText || input.postageText || input.freightTemplate || input.postageId);
  const ok = selectedText === '111' || /\b111\b/.test(selectedText);
  return decision(ok ? [] : ['postage_template_not_111'], 'freight_template_gate_passed', {
    selectedText,
    expectedTemplate: '111',
  });
}

function evaluateShipsFromGate(input = {}) {
  const selectedText = compactText(input.selectedText || input.shipFrom || input.shipsFrom || input.label);
  const normalized = selectedText.toLowerCase();
  const hasUnitedStates = /\bunited states\b|us\(origin\)|\u7f8e\u56fd|\busa\b/.test(normalized);
  const hasForbiddenFallback = /mainland china|\u4e2d\u56fd\u5927\u9646/.test(normalized);
  return decision(hasUnitedStates && !hasForbiddenFallback ? [] : ['ships_from_not_united_states'], 'ships_from_gate_passed', {
    selectedText,
    expected: 'United States',
  });
}

function evaluateEditSaveGate(input = {}) {
  const gates = [input.categoryEvidence, input.price, input.freight, input.shipsFrom].filter(Boolean);
  const gateBlockers = gates.flatMap((gate) => (Array.isArray(gate.blockers) ? gate.blockers : []));
  const normalizedPreflight = uniqueInOrder((input.preflightBlockers || []).map(normalizePreflightBlocker).filter(Boolean));
  return decision([...gateBlockers, ...normalizedPreflight], 'save_to_wait_publish_only_after_final_visible_confirmation', {
    gateCount: gates.length,
    gateWarnings: uniqueInOrder(gates.flatMap((gate) => (Array.isArray(gate.warnings) ? gate.warnings : []))),
  });
}

module.exports = {
  evaluateCrawlboxClaimGate,
  evaluatePriceGate,
  evaluateCategoryEvidenceGate,
  evaluateTemplateGate,
  evaluateShipsFromGate,
  evaluateEditSaveGate,
  nextActionForBlockers,
};
