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
  if (blockers.includes('auto_claim_enabled')) return 'disable_native_auto_claim_before_collection';
  if (blockers.includes('collector_input_missing')) return 'open_dxm_collection_page_and_restore_collector_input';
  if (blockers.includes('not_dxm_data_acquisition_page')) return 'open_dxm_data_acquisition_page_before_collection';
  if (blockers.includes('dangerous_action_blocked')) return 'use_safe_collection_or_claim_entry_only';
  if (blockers.includes('readonly_preflight_unavailable') || blockers.includes('readonly_preflight_missing')) return 'open_correct_edit_page_and_rerun_readonly_preflight';
  if (blockers.includes('readonly_preflight_call_failed')) return 'recover_readonly_preflight_export_then_retry';
  if (blockers.includes('webbridge_call_failed') || blockers.includes('webbridge_read_failed') || blockers.includes('webbridge_probe_stalled')) return 'recover_browser_control_then_retry_readonly';
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

function normalizeReportBlocker(blocker) {
  const raw = compactText(blocker);
  const text = raw.toLowerCase();
  if (!text) return '';
  if (text.startsWith('dangerous_action_blocked')) return 'dangerous_action_blocked';
  if (/auto_claim_enabled|auto claim/.test(text)) return 'auto_claim_enabled';
  if (/collector_input_missing|collection input missing|collector input/.test(text)) return 'collector_input_missing';
  if (/not_dxm_data_acquisition_page|data acquisition page/.test(text)) return 'not_dxm_data_acquisition_page';
  if (/readonly_preflight_unavailable/.test(text)) return 'readonly_preflight_unavailable';
  if (/readonly_preflight_missing|readonly function missing|readonly_function_missing/.test(text)) return 'readonly_preflight_missing';
  if (/readonly_preflight_call_failed|readonly_preflight_error|readonly_failed/.test(text)) return 'readonly_preflight_call_failed';
  if (/webbridge_call_failed|webbridge_timeout|webbridge_daemon_unreachable|daemon_unreachable/.test(text)) return 'webbridge_call_failed';
  if (/webbridge_read_failed|readonly_preflight_parse_failed/.test(text)) return 'webbridge_read_failed';
  if (/webbridge_probe_stalled|probe_stalled/.test(text)) return 'webbridge_probe_stalled';
  if (/computer_use_fallback_needed/.test(text)) return 'computer_use_fallback_needed';
  if (/screenshot_fallback_needed/.test(text)) return 'screenshot_fallback_needed';
  if (/page_not_rendered/.test(text)) return 'page_not_rendered';
  return normalizePreflightBlocker(raw);
}

function normalizeBlockers(blockers) {
  return uniqueInOrder((Array.isArray(blockers) ? blockers : [])
    .map(normalizeReportBlocker)
    .filter(Boolean));
}

function pageRenderedFromReport(report = {}) {
  const readyState = compactText(report.readyState || report.pageReadyState || (report.page && report.page.readyState)).toLowerCase();
  const href = compactText(report.href || report.url || (report.page && report.page.href));
  const title = compactText(report.title || report.pageTitle || (report.page && report.page.title));
  const status = compactText(report.status || report.reason || report.error).toLowerCase();
  if (/page_not_rendered|page_not_loaded|not_loaded/.test(status)) return false;
  if (readyState === 'complete' || readyState === 'interactive') return true;
  if (href || title) return true;
  return null;
}

function environmentStatusFromReport(report = {}, overrides = {}) {
  const statusText = compactText(`${report.status || ''} ${report.reason || ''} ${report.error || ''} ${report.stage || ''}`).toLowerCase();
  const bridgeFailed = /webbridge|timeout|daemon_unreachable|evaluate/.test(statusText) && report.ok === false;
  const structuredReadOk = overrides.structuredReadOk != null
    ? overrides.structuredReadOk
    : (report.ok === true ? true : null);
  const fallbackRecommended = overrides.fallbackRecommended != null
    ? overrides.fallbackRecommended
    : (bridgeFailed ? 'computer_use' : '');
  return {
    pageRendered: overrides.pageRendered != null ? overrides.pageRendered : pageRenderedFromReport(report),
    bridgeReachable: overrides.bridgeReachable != null ? overrides.bridgeReachable : (bridgeFailed ? false : (report.ok === true ? true : null)),
    structuredReadOk,
    fallbackRecommended,
  };
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

function readonlyPreflightPayload(report = {}) {
  if (report.preflight && typeof report.preflight === 'object') return report.preflight;
  if (report.readonly && report.readonly.preflight && typeof report.readonly.preflight === 'object') return report.readonly.preflight;
  return null;
}

function evaluateReadonlyPreflightReport(report = {}) {
  const preflight = readonlyPreflightPayload(report);
  const rawBlockers = [];
  const source = compactText(report.source || (report.readonly && report.readonly.source));
  const ok = report.ok !== false;
  if (!ok) {
    rawBlockers.push('readonly_preflight_unavailable');
  } else if (!preflight) {
    rawBlockers.push(source === 'error' ? 'readonly_preflight_call_failed' : 'readonly_preflight_missing');
  } else if (preflight.businessGate && Array.isArray(preflight.businessGate.blockers)) {
    rawBlockers.push(...preflight.businessGate.blockers);
  } else if (Array.isArray(preflight.blockers)) {
    rawBlockers.push(...preflight.blockers);
  } else if (preflight.preflight && Array.isArray(preflight.preflight.risks)) {
    rawBlockers.push(...preflight.preflight.risks);
  }

  const blockers = normalizeBlockers(rawBlockers);
  const structuredReadOk = Boolean(preflight && !blockers.includes('readonly_preflight_unavailable') && !blockers.includes('readonly_preflight_missing'));
  const safeToSave = Boolean(preflight && (preflight.safeToSaveToWaitPublish || (preflight.businessGate && preflight.businessGate.allowed)));
  const allowed = Boolean(ok && structuredReadOk && safeToSave && blockers.length === 0);
  return {
    allowed,
    blockers,
    warnings: normalizeBlockers(report.warnings || []),
    nextAction: blockers.length
      ? nextActionForBlockers(blockers, 'open_correct_edit_page_and_rerun_readonly_preflight')
      : 'save_to_wait_publish_only_after_final_visible_confirmation',
    environmentStatus: environmentStatusFromReport(report, {
      structuredReadOk,
      fallbackRecommended: ok ? '' : 'computer_use',
    }),
    normalized: {
      asin: compactText((preflight && (preflight.asin || preflight.currentAsin)) || report.currentAsin),
      source,
      preflightPass: Boolean(preflight && (preflight.preflightPass || preflight.pass)),
      safeToSaveToWaitPublish: safeToSave,
      href: compactText(report.href || report.url || (preflight && preflight.currentUrl)),
    },
  };
}

function webBridgePayload(report = {}) {
  if (report.preflight && typeof report.preflight === 'object') return report.preflight;
  if (report.webBridgePreflight && typeof report.webBridgePreflight === 'object') return report.webBridgePreflight;
  if (report.blockReason || report.blockReasons || report.allowed != null) return report;
  return null;
}

function evaluateWebBridgeReport(report = {}) {
  const payload = webBridgePayload(report);
  const rawBlockers = [];
  const rawWarnings = [];
  if (report.ok === false) {
    rawBlockers.push(/read|parse/i.test(compactText(report.stage || report.status)) ? 'webbridge_read_failed' : 'webbridge_call_failed');
  } else if (!payload) {
    rawBlockers.push('webbridge_read_failed');
  } else {
    rawBlockers.push(...(payload.blockReason || payload.blockReasons || payload.risks || []));
    rawWarnings.push(...(payload.warnings || payload.warning || []));
  }
  const blockers = normalizeBlockers(rawBlockers).filter((item) => item !== 'computer_use_fallback_needed' && item !== 'screenshot_fallback_needed');
  const warnings = uniqueInOrder([
    ...normalizeBlockers(rawWarnings),
    ...normalizeBlockers(report.warnings || []),
  ]);
  const structuredReadOk = Boolean(payload && report.ok !== false);
  const allowed = Boolean(payload && payload.allowed !== false && blockers.length === 0 && report.ok !== false);
  return {
    allowed,
    blockers,
    warnings,
    nextAction: blockers.length ? nextActionForBlockers(blockers, 'recover_browser_control_then_retry_readonly') : 'webbridge_preflight_passed',
    environmentStatus: environmentStatusFromReport({ ...report, ...(payload || {}) }, {
      structuredReadOk,
      fallbackRecommended: report.ok === false ? 'computer_use' : '',
    }),
    normalized: {
      targetButtonText: compactText(payload && payload.targetButtonText),
      isDataAcquisitionPage: Boolean(payload && payload.isDataAcquisitionPage),
      href: compactText(report.href || report.url || (payload && payload.url)),
    },
  };
}

module.exports = {
  evaluateCrawlboxClaimGate,
  evaluatePriceGate,
  evaluateCategoryEvidenceGate,
  evaluateTemplateGate,
  evaluateShipsFromGate,
  evaluateEditSaveGate,
  evaluateReadonlyPreflightReport,
  evaluateWebBridgeReport,
  normalizeBlockers,
  environmentStatusFromReport,
  nextActionForBlockers,
};
