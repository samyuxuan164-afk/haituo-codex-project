#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  DEFAULT_STORE_PATH,
} = require('./aliexpress-evidence-store');
const {
  DEFAULT_STORE_PATH: DEFAULT_PRICE_STORE_PATH,
  buildStatus: buildPriceStatus,
} = require('./amazon-price-store');
const {
  buildBatchStatus,
} = require('./aliexpress-evidence-batch');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_QUEUE_PATH = path.join(ROOT, 'runs', 'exception-queue.json');
const SCHEMA_VERSION = 'dxm-exception-queue-v1';
const VALID_STATUSES = new Set(['open', 'resolved', 'ignored']);
const VERIFIED_STATUSES = new Set(['aliexpress_verified', 'conditional_verified', 'detail_verified', 'learned_rule_matched']);

function nowIso() {
  return new Date().toISOString();
}

function compactText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeAsin(value, required = true) {
  const asin = compactText(value).toUpperCase();
  if (!asin && !required) return '';
  if (!/^B0[A-Z0-9]{8}$/.test(asin)) throw new Error(`Invalid ASIN: ${value}`);
  return asin;
}

function emptyQueue() {
  return {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: nowIso(),
    items: {},
  };
}

function readQueue(queuePath = DEFAULT_QUEUE_PATH) {
  if (!fs.existsSync(queuePath)) return emptyQueue();
  const raw = fs.readFileSync(queuePath, 'utf8');
  const queue = raw.trim() ? JSON.parse(raw) : emptyQueue();
  if (queue.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(`Unsupported exception queue schemaVersion: ${queue.schemaVersion || 'missing'}`);
  }
  if (!queue.items || typeof queue.items !== 'object' || Array.isArray(queue.items)) {
    throw new Error('Invalid exception queue: items must be an object');
  }
  return queue;
}

function sleepMs(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function withQueueLock(queuePath, fn) {
  const lockPath = `${queuePath}.lock`;
  fs.mkdirSync(path.dirname(queuePath), { recursive: true });
  let fd = null;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      fd = fs.openSync(lockPath, 'wx');
      break;
    } catch (error) {
      if (error && error.code !== 'EEXIST') throw error;
      try {
        const stat = fs.statSync(lockPath);
        if (Date.now() - stat.mtimeMs > 30000) fs.unlinkSync(lockPath);
      } catch (_) {
        // Another process may have released the lock between stat/unlink.
      }
      sleepMs(50);
    }
  }
  if (fd == null) throw new Error(`Timed out waiting for exception queue lock: ${lockPath}`);
  try {
    return fn();
  } finally {
    try {
      fs.closeSync(fd);
    } finally {
      try {
        fs.unlinkSync(lockPath);
      } catch (_) {
        // Best-effort cleanup; stale locks are cleared on the next attempt.
      }
    }
  }
}

function writeQueueUnlocked(queue, queuePath = DEFAULT_QUEUE_PATH) {
  queue.updatedAt = nowIso();
  fs.mkdirSync(path.dirname(queuePath), { recursive: true });
  fs.writeFileSync(queuePath, `${JSON.stringify(queue, null, 2)}\n`);
}

function writeQueue(queue, queuePath = DEFAULT_QUEUE_PATH) {
  return withQueueLock(queuePath, () => writeQueueUnlocked(queue, queuePath));
}

function slug(value) {
  return compactText(value).toLowerCase().replace(/[^a-z0-9_:-]+/g, '_').replace(/^_+|_+$/g, '') || 'unknown';
}

function buildItemKey(item) {
  const scope = item.asin || item.productId || 'global';
  return `${slug(scope)}::${slug(item.normalizedReason || item.reason || 'unknown')}`;
}

function classifyReason(reason, context = {}) {
  const text = compactText(reason);
  const haystack = `${text} ${compactText(context.stage)} ${compactText(context.status)}`.toLowerCase();
  const result = {
    normalizedReason: slug(text || context.status || 'unknown_exception'),
    category: 'general_blocker',
    severity: 'blocker',
    retryable: false,
    nextAction: 'manual_review',
  };

  if (/category_evidence_missing|needs_aliexpress_category_verification|no evidence record/.test(haystack)) {
    return {
      ...result,
      normalizedReason: 'category_evidence_missing',
      category: 'category_evidence',
      nextAction: 'run_aliexpress_category_verification',
    };
  }
  if (/aliexpress_verification_required|verification required|captcha|slide to verify|滑动验证|验证码|人机验证/.test(haystack)) {
    return {
      ...result,
      normalizedReason: 'aliexpress_verification_required',
      category: 'category_evidence',
      severity: 'control',
      retryable: true,
      nextAction: 'resolve_aliexpress_verification_then_resume_detail_capture',
    };
  }
  if (/dxm_category_validation_required|run_dxm_readonly_category_validation/.test(haystack)) {
    return {
      ...result,
      normalizedReason: 'dxm_category_validation_required',
      category: 'category_mapping',
      severity: 'control',
      retryable: true,
      nextAction: 'run_dxm_readonly_category_validation',
    };
  }
  if (/evidence_split|category_id_split|aliexpress category ids are split|category_direction_confirmed/.test(haystack)) {
    return {
      ...result,
      normalizedReason: 'aliexpress_category_evidence_split',
      category: 'category_evidence',
      nextAction: 'manual_review_or_add_category_mapping',
    };
  }
  if (/semantic_consensus_needs_dxm_mapping|aliexpress_category_confirmed_but_dxm_mapping_missing|aliexpress_dxm_category_map_missing|dxm_candidate_category_missing|category map missing|no aliexpress-to-dxm category mapping|mapping exists but is not active/.test(haystack)) {
    return {
      ...result,
      normalizedReason: 'aliexpress_category_confirmed_but_dxm_mapping_missing',
      category: 'category_mapping',
      nextAction: 'validate_and_add_aliexpress_dxm_category_mapping',
    };
  }
  if (/amazon_displayed_price_missing|amazon_original_price_missing|missing trusted amazon original price|missing trusted amazon displayed price|blocked_missing_task_amazon_original_price|amazon 原价|页面展示价格/.test(haystack)) {
    return {
      ...result,
      normalizedReason: /amazon_displayed_price_missing|页面展示价格|displayed price/.test(haystack) ? 'amazon_displayed_price_missing' : 'amazon_original_price_missing',
      category: 'price_source',
      nextAction: 'recover_trusted_amazon_displayed_usd_price',
    };
  }
  if (/amazon_page_captcha_or_robot_check|captcha|robot check|enter the characters/.test(haystack)) {
    return {
      ...result,
      normalizedReason: 'amazon_page_captcha_or_robot_check',
      category: 'price_capture',
      severity: 'control',
      retryable: true,
      nextAction: 'resolve_amazon_page_check_then_recapture_price',
    };
  }
  if (/amazon_product_unavailable_no_displayed_price|currently unavailable|temporarily out of stock|see all buying options/.test(haystack)) {
    return {
      ...result,
      normalizedReason: 'amazon_product_unavailable_no_displayed_price',
      category: 'price_capture',
      nextAction: 'skip_or_replace_unavailable_amazon_product',
    };
  }
  if (/amazon_price_capture_failed|amazon_price_selector_missing|amazon_price_page_read_failed/.test(haystack)) {
    return {
      ...result,
      normalizedReason: /selector_missing/.test(haystack) ? 'amazon_price_selector_missing' : 'amazon_price_capture_failed',
      category: 'price_capture',
      severity: 'control',
      retryable: true,
      nextAction: 'retry_amazon_price_capture_or_mark_price_missing',
    };
  }
  if (/amazon_original_price_out_of_range|price.*out_of_range|out of range/.test(haystack)) {
    return {
      ...result,
      normalizedReason: 'amazon_original_price_out_of_range',
      category: 'price_source',
      nextAction: 'skip_or_confirm_price_range_exception',
    };
  }
  if (/price_formula_missing_exchange_rate_or_multiplier|missing.*exchange.*multiplier|任务汇率|任务倍率/.test(haystack)) {
    return {
      ...result,
      normalizedReason: 'price_formula_missing_exchange_rate_or_multiplier',
      category: 'price_formula',
      nextAction: 'provide_task_exchange_rate_and_multiplier',
    };
  }
  if (/price_visible_mismatch|visible.*price.*mismatch|goods value mismatch|sku price/.test(haystack)) {
    return {
      ...result,
      normalizedReason: 'price_mismatch',
      category: 'price_validation',
      nextAction: 'recalculate_and_reapply_task_price_formula',
    };
  }
  if (/wait_publish_row_missing|wait publish row missing|待发布.*缺/.test(haystack)) {
    return {
      ...result,
      normalizedReason: 'wait_publish_row_missing',
      category: 'wait_publish_readback',
      nextAction: 'confirm_save_result_or_open_next_page',
    };
  }
  if (/not_wait_publish_page|wait_publish_page_not_loaded/.test(haystack)) {
    return {
      ...result,
      normalizedReason: /not_wait_publish_page/.test(haystack) ? 'not_wait_publish_page' : 'wait_publish_page_not_loaded',
      category: 'wait_publish_readback',
      severity: 'control',
      retryable: true,
      nextAction: 'open_wait_publish_page_then_retry_readback',
    };
  }
  if (/wait_publish_sku_missing|wait_publish_price_mismatch|wait_publish_stock_mismatch|wait_publish_category_mismatch/.test(haystack)) {
    const reason = haystack.match(/wait_publish_(sku_missing|price_mismatch|stock_mismatch|category_mismatch)/);
    return {
      ...result,
      normalizedReason: reason ? `wait_publish_${reason[1]}` : 'wait_publish_readback_mismatch',
      category: 'wait_publish_readback',
      nextAction: 'repair_saved_product_or_move_to_exception_review',
    };
  }
  if (/required attributes incomplete|native_product_attribute_error|product_attribute_dropdown_selection_failed|请选择产品属性|material field|field\/readback/.test(haystack)) {
    return {
      ...result,
      normalizedReason: 'required_attribute_incomplete',
      category: 'required_attribute',
      retryable: true,
      nextAction: 'repair_required_attribute_and_readback',
    };
  }
  if (/collection_missing_current_unclaimed_row|missing current.*unclaimed|not.*unclaimed row/.test(haystack)) {
    return {
      ...result,
      normalizedReason: 'collection_missing_current_unclaimed_row',
      category: 'collection_claim',
      nextAction: 'do_not_recollect_old_product_check_collection_result',
    };
  }
  if (/webbridge|inspected target|target closed|target navigated|timeout|daemon_unreachable|not_edit_page|stale tab/.test(haystack)) {
    return {
      ...result,
      normalizedReason: /not_edit_page/.test(haystack) ? 'not_edit_page' : 'environment_control_exception',
      category: 'environment_control',
      severity: 'control',
      retryable: true,
      nextAction: /not_edit_page/.test(haystack) ? 'open_direct_edit_page_before_preflight' : 'recover_browser_control_then_retry_readonly',
    };
  }
  if (/product_risk_record_missing/.test(haystack)) {
    return {
      ...result,
      normalizedReason: 'product_risk_record_missing',
      category: 'risk_filter',
      nextAction: 'provide_candidate_record_and_run_product_risk_filter',
    };
  }
  if (/product_risk_needs_review/.test(haystack)) {
    return {
      ...result,
      normalizedReason: 'product_risk_needs_review',
      category: 'risk_filter',
      nextAction: 'skip_or_manual_risk_review',
    };
  }
  if (/food_or_ingestible_risk|ingestible|supplement|vitamin|pet food|食品|可食用|保健品|宠物食品/.test(haystack)) {
    return {
      ...result,
      normalizedReason: 'food_or_ingestible_risk',
      category: 'risk_filter',
      nextAction: 'skip_or_manual_risk_review',
    };
  }
  if (/medical_or_health_claim_risk|medical|medicine|drug|therapeutic|treatment|diagnostic|health claim|医疗|药品|治疗|诊断|保健功效/.test(haystack)) {
    return {
      ...result,
      normalizedReason: 'medical_or_health_claim_risk',
      category: 'risk_filter',
      nextAction: 'skip_or_manual_risk_review',
    };
  }
  if (/children_or_toy_risk|baby|toddler|infant|kids|children|toy|nursery|母婴|婴儿|儿童|玩具/.test(haystack)) {
    return {
      ...result,
      normalizedReason: 'children_or_toy_risk',
      category: 'risk_filter',
      nextAction: 'skip_or_manual_risk_review',
    };
  }
  if (/battery_or_electric_risk|battery|batteries|rechargeable|lithium|electric|powered|usb|charger|charging|电池|锂电|充电|电动|带电/.test(haystack)) {
    return {
      ...result,
      normalizedReason: 'battery_or_electric_risk',
      category: 'risk_filter',
      nextAction: 'skip_or_manual_risk_review',
    };
  }
  if (/weapon_or_hazardous_material_risk|knife|blade|weapon|flammable|explosive|hazardous|刀具|刀片|武器|易燃|爆炸|危险品/.test(haystack)) {
    return {
      ...result,
      normalizedReason: 'weapon_or_hazardous_material_risk',
      category: 'risk_filter',
      nextAction: 'skip_or_manual_risk_review',
    };
  }
  if (/liquid_cosmetic_or_chemical_risk|adult_or_sensitive_risk|fragile_or_glass_risk|apparel_or_wearable_risk/.test(haystack)) {
    const normalizedReason = haystack.match(/(liquid_cosmetic_or_chemical_risk|adult_or_sensitive_risk|fragile_or_glass_risk|apparel_or_wearable_risk)/)[1];
    return {
      ...result,
      normalizedReason,
      category: 'risk_filter',
      nextAction: 'skip_or_manual_risk_review',
    };
  }
  if (/logo|brand|trademark|infringement|侵权/.test(haystack)) {
    return {
      ...result,
      normalizedReason: 'brand_logo_or_infringement_risk',
      category: 'risk_filter',
      nextAction: 'skip_or_manual_risk_review',
    };
  }
  return result;
}

function validateItem(input) {
  const item = { ...input };
  item.asin = normalizeAsin(item.asin, false);
  item.productId = compactText(item.productId);
  item.stage = compactText(item.stage || 'unknown');
  item.reason = compactText(item.reason || item.normalizedReason || 'unknown_exception');
  const classified = classifyReason(item.reason, item);
  item.normalizedReason = compactText(item.normalizedReason || classified.normalizedReason);
  item.category = compactText(item.category || classified.category);
  item.severity = compactText(item.severity || classified.severity);
  item.status = item.status || 'open';
  if (!VALID_STATUSES.has(item.status)) throw new Error(`Invalid exception status: ${item.status}`);
  item.retryable = item.retryable != null ? Boolean(item.retryable) : Boolean(classified.retryable);
  item.nextAction = compactText(item.nextAction || classified.nextAction);
  item.source = compactText(item.source || 'manual');
  item.details = item.details && typeof item.details === 'object' && !Array.isArray(item.details) ? item.details : {};
  item.evidence = Array.isArray(item.evidence) ? item.evidence.map(compactText).filter(Boolean) : [];
  item.occurrences = Number.isFinite(Number(item.occurrences)) ? Math.max(1, Number(item.occurrences)) : 1;
  item.updatedAt = item.updatedAt || nowIso();
  item.createdAt = item.createdAt || item.updatedAt;
  if (!item.asin && !item.productId && item.stage !== 'environment_control') {
    throw new Error('Exception item requires asin or productId');
  }
  return item;
}

function upsertException(input, queuePath = DEFAULT_QUEUE_PATH) {
  return withQueueLock(queuePath, () => {
    const queue = readQueue(queuePath);
    const incoming = validateItem(input);
    const key = buildItemKey(incoming);
    const previous = queue.items[key] || {};
    const merged = validateItem({
      ...previous,
      ...incoming,
      occurrences: (previous.occurrences || 0) + 1,
      createdAt: previous.createdAt || incoming.createdAt || nowIso(),
      updatedAt: nowIso(),
    });
    queue.items[key] = merged;
    writeQueueUnlocked(queue, queuePath);
    return { key, item: merged };
  });
}

function listExceptions(args) {
  const queue = readQueue(args.queuePath);
  let rows = Object.entries(queue.items).map(([key, item]) => ({ key, ...item }));
  if (args.status) rows = rows.filter((item) => item.status === args.status);
  if (args.asin) {
    const asin = normalizeAsin(args.asin);
    rows = rows.filter((item) => item.asin === asin);
  }
  rows.sort((a, b) => String(a.updatedAt).localeCompare(String(b.updatedAt)) || a.key.localeCompare(b.key));
  return {
    ok: true,
    queuePath: args.queuePath,
    rows,
    summary: summarizeRows(rows),
  };
}

function summarizeRows(rows) {
  const byStatus = {};
  const byCategory = {};
  rows.forEach((row) => {
    byStatus[row.status] = (byStatus[row.status] || 0) + 1;
    byCategory[row.category] = (byCategory[row.category] || 0) + 1;
  });
  return {
    total: rows.length,
    open: rows.filter((row) => row.status === 'open').length,
    resolved: rows.filter((row) => row.status === 'resolved').length,
    ignored: rows.filter((row) => row.status === 'ignored').length,
    byStatus,
    byCategory,
  };
}

function severityRank(severity) {
  if (severity === 'control') return 0;
  if (severity === 'blocker') return 1;
  if (severity === 'review') return 2;
  return 3;
}

function groupBy(rows, getter) {
  return rows.reduce((acc, row) => {
    const key = compactText(getter(row) || 'unknown');
    acc[key] = acc[key] || [];
    acc[key].push(row);
    return acc;
  }, {});
}

function countBy(rows, getter) {
  return Object.fromEntries(Object.entries(groupBy(rows, getter)).map(([key, value]) => [key, value.length]));
}

function readReportAsins(args, rows) {
  const explicit = readAsinsFromArgs(args, false);
  if (explicit.length) return explicit;
  const seen = new Set();
  return rows
    .map((row) => row.asin)
    .filter(Boolean)
    .filter((asin) => {
      if (seen.has(asin)) return false;
      seen.add(asin);
      return true;
    })
    .sort();
}

function readAsinsFromArgs(args, required = true) {
  const values = [];
  if (args.asinList) values.push(...args.asinList.split(/[,\s]+/));
  if (args.asinFile) values.push(...fs.readFileSync(args.asinFile, 'utf8').split(/[,\s]+/));
  const seen = new Set();
  const asins = values
    .map(compactText)
    .filter(Boolean)
    .map((asin) => normalizeAsin(asin, required))
    .filter(Boolean)
    .filter((asin) => {
      if (seen.has(asin)) return false;
      seen.add(asin);
      return true;
    });
  if (required && !asins.length) throw new Error('ASIN input required');
  return asins;
}

function itemStatusFor(openItems) {
  if (!openItems.length) return 'clear';
  if (openItems.some((item) => item.severity === 'blocker')) return 'blocked';
  if (openItems.some((item) => item.severity === 'control')) return 'control_retryable';
  if (openItems.some((item) => item.severity === 'review')) return 'needs_review';
  return 'blocked';
}

function primaryItem(openItems) {
  if (!openItems.length) return null;
  return [...openItems].sort((a, b) => {
    const severity = severityRank(a.severity) - severityRank(b.severity);
    if (severity) return severity;
    return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
  })[0];
}

function buildBatchReport(args) {
  const queue = readQueue(args.queuePath);
  const allRows = Object.entries(queue.items).map(([key, item]) => ({ key, ...item }));
  const includedRows = args.includeResolved ? allRows : allRows.filter((item) => item.status === 'open');
  const asins = readReportAsins(args, includedRows);
  const rowsByAsin = groupBy(includedRows, (row) => row.asin || row.productId || 'global');
  const asinReports = asins.map((asin) => {
    const rows = (rowsByAsin[asin] || []).sort((a, b) => {
      const severity = severityRank(a.severity) - severityRank(b.severity);
      if (severity) return severity;
      return String(a.normalizedReason || a.reason).localeCompare(String(b.normalizedReason || b.reason));
    });
    const openItems = rows.filter((row) => row.status === 'open');
    const primary = primaryItem(openItems);
    return {
      asin,
      status: itemStatusFor(openItems),
      openCount: openItems.length,
      totalCount: rows.length,
      primaryReason: primary ? primary.normalizedReason || primary.reason : '',
      primaryCategory: primary ? primary.category : '',
      severity: primary ? primary.severity : '',
      retryable: primary ? Boolean(primary.retryable) : false,
      nextAction: primary ? primary.nextAction : 'no_open_exception',
      reasons: rows.map((row) => ({
        key: row.key,
        status: row.status,
        reason: row.normalizedReason || row.reason,
        category: row.category,
        severity: row.severity,
        retryable: Boolean(row.retryable),
        nextAction: row.nextAction,
        updatedAt: row.updatedAt,
      })),
    };
  });
  const openRows = includedRows.filter((row) => row.status === 'open');
  const byNextAction = groupBy(asinReports.filter((row) => row.status !== 'clear'), (row) => row.nextAction);
  const nextActionGroups = Object.fromEntries(Object.entries(byNextAction).map(([action, rows]) => [
    action,
    rows.map((row) => row.asin),
  ]));
  const summary = {
    totalAsins: asinReports.length,
    clear: asinReports.filter((row) => row.status === 'clear').length,
    blocked: asinReports.filter((row) => row.status === 'blocked').length,
    controlRetryable: asinReports.filter((row) => row.status === 'control_retryable').length,
    needsReview: asinReports.filter((row) => row.status === 'needs_review').length,
    openExceptions: openRows.length,
    allIncludedExceptions: includedRows.length,
    byStatus: countBy(asinReports, (row) => row.status),
    byReason: countBy(openRows, (row) => row.normalizedReason || row.reason),
    byCategory: countBy(openRows, (row) => row.category),
    bySeverity: countBy(openRows, (row) => row.severity),
    byNextAction: Object.fromEntries(Object.entries(nextActionGroups).map(([action, rows]) => [action, rows.length])),
  };
  return {
    ok: true,
    schemaVersion: 'dxm-batch-exception-report-v1',
    generatedAt: nowIso(),
    queuePath: args.queuePath,
    includeResolved: Boolean(args.includeResolved),
    summary,
    nextActionGroups,
    rows: asinReports,
  };
}

function renderBatchReportMarkdown(report) {
  const lines = [];
  lines.push('# Batch Exception Report');
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Queue: ${report.queuePath}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Total ASINs: ${report.summary.totalAsins}`);
  lines.push(`- Clear: ${report.summary.clear}`);
  lines.push(`- Blocked: ${report.summary.blocked}`);
  lines.push(`- Control retryable: ${report.summary.controlRetryable}`);
  lines.push(`- Needs review: ${report.summary.needsReview}`);
  lines.push(`- Open exceptions: ${report.summary.openExceptions}`);
  lines.push('');
  lines.push('## Open Exceptions By Category');
  lines.push('');
  Object.entries(report.summary.byCategory).forEach(([category, count]) => {
    lines.push(`- ${category}: ${count}`);
  });
  if (!Object.keys(report.summary.byCategory).length) lines.push('- none');
  lines.push('');
  lines.push('## Next Actions');
  lines.push('');
  Object.entries(report.nextActionGroups).forEach(([action, asins]) => {
    lines.push(`- ${action}: ${asins.join(', ')}`);
  });
  if (!Object.keys(report.nextActionGroups).length) lines.push('- none');
  lines.push('');
  lines.push('## ASIN Rows');
  lines.push('');
  lines.push('| ASIN | Status | Primary Reason | Category | Next Action |');
  lines.push('|---|---|---|---|---|');
  report.rows.forEach((row) => {
    lines.push(`| ${row.asin} | ${row.status} | ${row.primaryReason || '-'} | ${row.primaryCategory || '-'} | ${row.nextAction || '-'} |`);
  });
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function resolveException(args, status = 'resolved') {
  return withQueueLock(args.queuePath, () => {
    const queue = readQueue(args.queuePath);
    const asin = normalizeAsin(args.asin);
    const reason = compactText(args.reason);
    const keys = Object.keys(queue.items).filter((key) => {
      const item = queue.items[key];
      if (item.asin !== asin) return false;
      if (!reason) return true;
      return item.normalizedReason === slug(reason) || item.reason === reason || item.normalizedReason === reason;
    });
    keys.forEach((key) => {
      queue.items[key] = {
        ...queue.items[key],
        status,
        resolvedAt: nowIso(),
        updatedAt: nowIso(),
      };
    });
    writeQueueUnlocked(queue, args.queuePath);
    return { ok: true, status, matched: keys.length, keys };
  });
}

function buildEvidenceExceptions(args) {
  const status = buildBatchStatus({
    storePath: args.storePath,
    asinList: args.asinList,
    asinFile: args.asinFile,
  });
  const rows = status.rows
    .filter((row) => !row.verified)
    .map((row) => {
      const reason = row.status === 'missing'
        ? 'category_evidence_missing'
        : row.status === 'evidence_split'
          ? 'aliexpress_category_evidence_split'
          : row.status === 'dxm_category_validation_required'
            ? 'dxm_category_validation_required'
            : row.status === 'semantic_consensus_needs_dxm_mapping'
              ? 'aliexpress_category_confirmed_but_dxm_mapping_missing'
              : row.reason || row.status;
      return validateItem({
        asin: row.asin,
        stage: 'evidence_preflight',
        reason,
        source: 'aliexpress_evidence_batch_status',
        details: row,
        evidence: [path.relative(ROOT, args.storePath)],
      });
    });
  return {
    ok: true,
    dryRun: !args.write,
    queuePath: args.queuePath,
    rows: rows.map((item) => ({ key: buildItemKey(item), item })),
    summary: summarizeRows(rows),
  };
}

function importEvidenceExceptions(args) {
  const report = buildEvidenceExceptions(args);
  if (!args.write) return report;
  const written = report.rows.map((row) => upsertException(row.item, args.queuePath));
  return {
    ...report,
    dryRun: false,
    rows: written,
    summary: summarizeRows(written.map((row) => row.item)),
  };
}

function importPreflightExceptions(args) {
  if (!args.json) throw new Error('from-preflight requires --json');
  const payload = JSON.parse(args.json);
  const preflight = payload.preflight || payload;
  const asin = preflight.asin || preflight.currentAsin || args.asin;
  const blockers = Array.isArray(preflight.blockers) ? preflight.blockers : [];
  const risks = preflight.preflight && Array.isArray(preflight.preflight.risks) ? preflight.preflight.risks : [];
  const reasons = [...blockers, ...risks].filter(Boolean);
  const rows = reasons.map((reason) => validateItem({
    asin,
    productId: preflight.productId || '',
    stage: preflight.isEditPage ? 'edit_preflight' : 'page_context',
    reason,
    source: 'readonly_preflight',
    details: {
      currentUrl: preflight.currentUrl || payload.href || '',
      preflightPass: Boolean(preflight.preflightPass),
      safeToSaveToWaitPublish: Boolean(preflight.safeToSaveToWaitPublish),
    },
  }));
  const result = {
    ok: true,
    dryRun: !args.write,
    queuePath: args.queuePath,
    rows: rows.map((item) => ({ key: buildItemKey(item), item })),
    summary: summarizeRows(rows),
  };
  if (!args.write) return result;
  const written = rows.map((item) => upsertException(item, args.queuePath));
  return {
    ...result,
    dryRun: false,
    rows: written,
    summary: summarizeRows(written.map((row) => row.item)),
  };
}

function parseArgs(argv) {
  const args = {
    command: argv[2] || 'help',
    queuePath: process.env.DXM_EXCEPTION_QUEUE || DEFAULT_QUEUE_PATH,
    storePath: process.env.ALIEXPRESS_EVIDENCE_STORE || DEFAULT_STORE_PATH,
    priceStorePath: process.env.AMAZON_PRICE_STORE || DEFAULT_PRICE_STORE_PATH,
    asin: '',
    asinList: '',
    asinFile: '',
    productId: '',
    stage: '',
    reason: '',
    source: '',
    status: '',
    json: '',
    format: 'json',
    outPath: '',
    includeResolved: false,
    exchangeRate: process.env.TASK_EXCHANGE_RATE || '',
    multiplier: process.env.TASK_PRICE_MULTIPLIER || '',
    write: false,
  };
  for (let i = 3; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === '--queue' && next) {
      args.queuePath = path.resolve(next);
      i += 1;
    } else if (arg === '--store' && next) {
      args.storePath = path.resolve(next);
      i += 1;
    } else if (arg === '--price-store' && next) {
      args.priceStorePath = path.resolve(next);
      i += 1;
    } else if (arg === '--asin' && next) {
      args.asin = next;
      i += 1;
    } else if (arg === '--asins' && next) {
      args.asinList = next;
      i += 1;
    } else if (arg === '--asin-file' && next) {
      args.asinFile = path.resolve(next);
      i += 1;
    } else if (arg === '--product-id' && next) {
      args.productId = next;
      i += 1;
    } else if (arg === '--stage' && next) {
      args.stage = next;
      i += 1;
    } else if (arg === '--reason' && next) {
      args.reason = next;
      i += 1;
    } else if (arg === '--source' && next) {
      args.source = next;
      i += 1;
    } else if (arg === '--status' && next) {
      args.status = next;
      i += 1;
    } else if (arg === '--json' && next) {
      args.json = next;
      i += 1;
    } else if (arg === '--format' && next) {
      args.format = compactText(next).toLowerCase();
      i += 1;
    } else if (arg === '--out' && next) {
      args.outPath = path.resolve(next);
      i += 1;
    } else if (arg === '--include-resolved') {
      args.includeResolved = true;
    } else if (arg === '--exchange-rate' && next) {
      args.exchangeRate = next;
      i += 1;
    } else if (arg === '--multiplier' && next) {
      args.multiplier = next;
      i += 1;
    } else if (arg === '--write') {
      args.write = true;
    }
  }
  return args;
}

function output(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function usage() {
  return {
    tool: 'exception-queue',
    commands: {
      init: 'Create the exception queue if it does not exist.',
      list: 'List queued exceptions. Optional --status and --asin.',
      classify: 'Classify one reason. Requires --reason; optional --asin, --stage, --product-id.',
      upsert: 'Upsert one exception from --json.',
      resolve: 'Mark exceptions for one ASIN as resolved. Requires --asin; optional --reason.',
      ignore: 'Mark exceptions for one ASIN as ignored. Requires --asin; optional --reason.',
      report: 'Build a batch exception report. Optional --asins/--asin-file, --include-resolved, --format json|markdown, --out.',
      'from-evidence-status': 'Build exceptions from evidence status for --asins/--asin-file; writes only with --write.',
      'from-price-status': 'Build exceptions from Amazon price status for --asins/--asin-file; writes only with --write.',
      'from-preflight': 'Build exceptions from readonly preflight JSON; writes only with --write.',
    },
    defaultQueue: DEFAULT_QUEUE_PATH,
    defaultEvidenceStore: DEFAULT_STORE_PATH,
    defaultPriceStore: DEFAULT_PRICE_STORE_PATH,
  };
}

function buildPriceExceptions(args) {
  const status = buildPriceStatus({
    storePath: args.priceStorePath,
    asinList: args.asinList,
    asinFile: args.asinFile,
    exchangeRate: args.exchangeRate,
    multiplier: args.multiplier,
  });
  const rows = status.rows
    .filter((row) => !row.trusted || !row.formulaOk)
    .map((row) => {
      const reason = row.status === 'missing'
        ? 'amazon_displayed_price_missing'
        : row.status === 'out_of_range'
          ? 'amazon_original_price_out_of_range'
          : row.formulaOk
            ? row.reason || row.status
            : 'price_formula_missing_exchange_rate_or_multiplier';
      return validateItem({
        asin: row.asin,
        stage: 'price_preflight',
        reason,
        source: 'amazon_price_store_status',
        details: row,
        evidence: [path.relative(ROOT, args.priceStorePath)],
      });
    });
  return {
    ok: true,
    dryRun: !args.write,
    queuePath: args.queuePath,
    rows: rows.map((item) => ({ key: buildItemKey(item), item })),
    summary: summarizeRows(rows),
  };
}

function importPriceExceptions(args) {
  const report = buildPriceExceptions(args);
  if (!args.write) return report;
  const written = report.rows.map((row) => upsertException(row.item, args.queuePath));
  return {
    ...report,
    dryRun: false,
    rows: written,
    summary: summarizeRows(written.map((row) => row.item)),
  };
}

function main() {
  const args = parseArgs(process.argv);
  if (args.command === 'init') {
    const queue = readQueue(args.queuePath);
    writeQueue(queue, args.queuePath);
    output({ ok: true, queuePath: args.queuePath, summary: summarizeRows(Object.values(queue.items)) });
    return;
  }
  if (args.command === 'list') {
    output(listExceptions(args));
    return;
  }
  if (args.command === 'report') {
    const report = buildBatchReport(args);
    const rendered = args.format === 'markdown' ? renderBatchReportMarkdown(report) : `${JSON.stringify(report, null, 2)}\n`;
    if (args.outPath) {
      fs.mkdirSync(path.dirname(args.outPath), { recursive: true });
      fs.writeFileSync(args.outPath, rendered);
    }
    if (args.format === 'markdown') process.stdout.write(rendered);
    else output(report);
    return;
  }
  if (args.command === 'classify') {
    const item = validateItem({
      asin: args.asin,
      productId: args.productId,
      stage: args.stage || 'manual_classification',
      reason: args.reason,
      source: args.source || 'manual_classification',
    });
    output({ ok: true, dryRun: !args.write, key: buildItemKey(item), item, written: args.write ? upsertException(item, args.queuePath) : null });
    return;
  }
  if (args.command === 'upsert') {
    if (!args.json) throw new Error('upsert requires --json');
    output({ ok: true, ...upsertException(JSON.parse(args.json), args.queuePath) });
    return;
  }
  if (args.command === 'resolve') {
    output(resolveException(args, 'resolved'));
    return;
  }
  if (args.command === 'ignore') {
    output(resolveException(args, 'ignored'));
    return;
  }
  if (args.command === 'from-evidence-status') {
    output(importEvidenceExceptions(args));
    return;
  }
  if (args.command === 'from-price-status') {
    output(importPriceExceptions(args));
    return;
  }
  if (args.command === 'from-preflight') {
    output(importPreflightExceptions(args));
    return;
  }
  output(usage());
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    output({ ok: false, error: String(error && error.message ? error.message : error) });
    process.exitCode = 1;
  }
}

module.exports = {
  DEFAULT_QUEUE_PATH,
  SCHEMA_VERSION,
  buildEvidenceExceptions,
  buildBatchReport,
  buildPriceExceptions,
  classifyReason,
  importEvidenceExceptions,
  readQueue,
  upsertException,
  validateItem,
  writeQueue,
};
