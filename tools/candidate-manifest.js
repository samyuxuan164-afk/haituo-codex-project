#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  DEFAULT_STORE_PATH: DEFAULT_EVIDENCE_STORE_PATH,
} = require('./aliexpress-evidence-store');
const {
  DEFAULT_STORE_PATH: DEFAULT_PRICE_STORE_PATH,
  buildStatus: buildPriceStatus,
} = require('./amazon-price-store');
const {
  buildBatchStatus: buildEvidenceStatus,
} = require('./aliexpress-evidence-batch');
const {
  DEFAULT_QUEUE_PATH,
  buildBatchReport,
} = require('./exception-queue');
const {
  DEFAULT_RULES_PATH: DEFAULT_RISK_RULES_PATH,
  screenRecords: screenRiskRecords,
} = require('./product-risk-filter');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_MANIFEST_PATH = path.join(ROOT, 'runs', 'candidate-manifest.json');
const SCHEMA_VERSION = 'dxm-candidate-manifest-v1';

function nowIso() {
  return new Date().toISOString();
}

function compactText(value) {
  if (Array.isArray(value)) return value.map(compactText).filter(Boolean).join(' ');
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeAsin(value) {
  const asin = compactText(value).toUpperCase();
  if (!/^B0[A-Z0-9]{8}$/.test(asin)) throw new Error(`Invalid ASIN: ${value}`);
  return asin;
}

function parseNumber(value) {
  if (value == null || value === '') return null;
  const match = String(value).replace(/,/g, '').match(/\d+(?:\.\d+)?/);
  if (!match) return null;
  const number = Number(match[0]);
  return Number.isFinite(number) ? number : null;
}

function round2(value) {
  return Math.round(Number(value) * 100) / 100;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (quoted && char === '"' && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (!quoted && char === ',') {
      row.push(cell);
      cell = '';
    } else if (!quoted && (char === '\n' || char === '\r')) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(cell);
      if (row.some((value) => compactText(value))) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  row.push(cell);
  if (row.some((value) => compactText(value))) rows.push(row);
  if (!rows.length) return [];
  const headers = rows.shift().map(compactText);
  return rows.map((values) => {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = values[index] || '';
    });
    return record;
  });
}

function readRecordsFromFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  if (/\.csv$/i.test(filePath)) return parseCsv(raw);
  const parsed = raw.trim() ? JSON.parse(raw) : [];
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed.records)) return parsed.records;
  if (Array.isArray(parsed.rows)) return parsed.rows;
  if (parsed.records && typeof parsed.records === 'object') return Object.values(parsed.records);
  return [parsed];
}

function readInputRecords(args) {
  const rows = [];
  if (args.inputPath) rows.push(...readRecordsFromFile(args.inputPath));
  if (args.json) {
    const parsed = JSON.parse(args.json);
    if (Array.isArray(parsed)) rows.push(...parsed);
    else if (Array.isArray(parsed.records)) rows.push(...parsed.records);
    else if (Array.isArray(parsed.rows)) rows.push(...parsed.rows);
    else rows.push(parsed);
  }
  return rows;
}

function pick(record, aliases) {
  for (const key of aliases) {
    if (record[key] != null && compactText(record[key])) return record[key];
  }
  return '';
}

function boolish(value) {
  const text = compactText(value).toLowerCase();
  if (!text) return false;
  return ['1', 'true', 'yes', 'y', '允许', '是'].includes(text);
}

function normalizeCandidate(input, args = {}) {
  const asin = normalizeAsin(pick(input, ['asin', 'ASIN', 'Asin']));
  const displayedPrice = parseNumber(pick(input, [
    'amazonDisplayedPriceUsd',
    'Amazon 页面展示价格 USD',
    'amazon_displayed_price_usd',
    'amazonOriginalPriceUsd',
  ]));
  const exchangeRate = parseNumber(pick(input, ['exchangeRate', '汇率'])) || parseNumber(args.exchangeRate);
  const multiplier = parseNumber(pick(input, ['multiplier', 'priceMultiplier', '倍率'])) || parseNumber(args.multiplier);
  const expectedCnyOverride = parseNumber(pick(input, ['expectedCnyPrice', '期望CNY价格', 'expectedPrice']));
  const expectedCnyPrice = expectedCnyOverride != null
    ? expectedCnyOverride
    : displayedPrice != null && exchangeRate && multiplier
      ? round2(displayedPrice * exchangeRate * multiplier)
      : null;
  return {
    asin,
    productFamily: compactText(pick(input, ['productFamily', '商品族', '品类', '类目'])),
    amazon: {
      title: compactText(pick(input, ['title', '商品标题', 'Amazon Title', 'productTitle'])),
      url: compactText(pick(input, ['amazonUrl', 'Amazon URL', 'url', '链接'])),
      displayedPriceUsd: displayedPrice,
      brand: compactText(pick(input, ['brand', '品牌', 'byline'])),
      bullets: compactText(pick(input, ['bullets', 'bulletPoints', '卖点'])),
      description: compactText(pick(input, ['description', '商品描述', '描述'])),
      imageAlt: compactText(pick(input, ['imageAlt', '图片文字'])),
      imageNotes: compactText(pick(input, ['imageNotes', 'logoRisk', '图片风险', '视觉备注'])),
    },
    target: {
      businessLicenseGroup: compactText(pick(input, ['businessLicenseGroup', '营业执照组'])),
      store: compactText(pick(input, ['targetStore', '店铺', 'store'])),
      platform: compactText(pick(input, ['platform', '平台'])),
    },
    expected: {
      exchangeRate,
      multiplier,
      cnyPrice: expectedCnyPrice,
      stock: compactText(pick(input, ['expectedStock', 'stock', '库存']) || args.expectedStock),
      origin: compactText(pick(input, ['expectedOrigin', 'Origin', '产地']) || args.expectedOrigin),
      freightTemplate: compactText(pick(input, ['expectedFreightTemplate', 'freightTemplate', '运费模板']) || args.expectedFreightTemplate),
      safeAdjacentAllowed: boolish(pick(input, ['safeAdjacentAllowed', '允许安全相邻类目'])),
    },
    lifecycle: {
      collectionStatus: compactText(pick(input, ['collectionStatus', '采集状态'])),
      claimStatus: compactText(pick(input, ['claimStatus', '认领状态'])),
      editStatus: compactText(pick(input, ['editStatus', '编辑状态'])),
      waitPublishStatus: compactText(pick(input, ['waitPublishStatus', '待发布状态'])),
      finalStatus: compactText(pick(input, ['finalStatus', '最终状态'])),
    },
    notes: compactText(pick(input, ['notes', '备注'])),
    source: {
      raw: input,
    },
  };
}

function readAsins(args, candidates = []) {
  const values = [];
  if (args.asinList) values.push(...args.asinList.split(/[,\s]+/));
  if (args.asinFile) values.push(...fs.readFileSync(args.asinFile, 'utf8').split(/[,\s]+/));
  if (!values.length) values.push(...candidates.map((item) => item.asin));
  const seen = new Set();
  return values
    .map(compactText)
    .filter(Boolean)
    .map(normalizeAsin)
    .filter((asin) => {
      if (seen.has(asin)) return false;
      seen.add(asin);
      return true;
    });
}

function buildRiskInput(candidate) {
  return {
    asin: candidate.asin,
    title: candidate.amazon.title,
    brand: candidate.amazon.brand,
    bullets: candidate.amazon.bullets,
    description: candidate.amazon.description,
    imageAlt: candidate.amazon.imageAlt,
    imageNotes: candidate.amazon.imageNotes,
    category: candidate.productFamily,
    sourceUrl: candidate.amazon.url,
  };
}

function buildStatuses(args, candidates, asins) {
  const asinList = asins.join(',');
  const price = buildPriceStatus({
    storePath: args.priceStorePath,
    asinList,
    exchangeRate: args.exchangeRate,
    multiplier: args.multiplier,
  });
  const evidence = buildEvidenceStatus({
    storePath: args.evidenceStorePath,
    asinList,
  });
  const risk = screenRiskRecords({
    rulesPath: args.riskRulesPath,
    queuePath: args.queuePath,
    json: JSON.stringify(candidates.map(buildRiskInput)),
    filePath: '',
    writeExceptions: false,
  });
  const exceptions = buildBatchReport({
    queuePath: args.queuePath,
    asinList,
    asinFile: '',
    includeResolved: args.includeResolved,
  });
  return {
    priceByAsin: Object.fromEntries(price.rows.map((row) => [row.asin, row])),
    evidenceByAsin: Object.fromEntries(evidence.rows.map((row) => [row.asin, row])),
    riskByAsin: Object.fromEntries(risk.rows.map((row) => [row.asin, row])),
    exceptionByAsin: Object.fromEntries(exceptions.rows.map((row) => [row.asin, row])),
    summaries: {
      price: price.summary,
      evidence: evidence.summary,
      risk: risk.summary,
      exceptions: exceptions.summary,
    },
  };
}

function priceReady(candidate, priceRow) {
  if (priceRow && priceRow.trusted && priceRow.formulaOk) return true;
  return candidate.amazon.displayedPriceUsd != null
    && candidate.amazon.displayedPriceUsd > 0
    && candidate.expected.cnyPrice != null
    && candidate.expected.cnyPrice > 0;
}

function evidenceBlocker(evidenceRow) {
  if (!evidenceRow || evidenceRow.status === 'missing') return 'category_evidence_missing';
  if (evidenceRow.status === 'aliexpress_verification_required') return 'aliexpress_verification_required';
  if (evidenceRow.status === 'dxm_category_validation_required') return 'dxm_category_validation_required';
  if (evidenceRow.status === 'evidence_split') return 'aliexpress_category_evidence_split';
  if (evidenceRow.status === 'semantic_consensus_needs_dxm_mapping') return 'aliexpress_dxm_category_map_missing';
  if (!evidenceRow.dxmCandidateCategory) return 'aliexpress_dxm_category_map_missing';
  return evidenceRow.reason || evidenceRow.status || 'category_evidence_missing';
}

function routeCandidate(candidate, status) {
  const risk = status.riskByAsin[candidate.asin] || null;
  const price = status.priceByAsin[candidate.asin] || null;
  const evidence = status.evidenceByAsin[candidate.asin] || null;
  const exception = status.exceptionByAsin[candidate.asin] || null;
  const blockers = [];
  if (!risk) blockers.push('product_risk_record_missing');
  else if (!risk.pass) blockers.push(...risk.matchedRules.map((item) => item.category));
  if (!priceReady(candidate, price)) blockers.push(price && price.reason ? price.reason : 'amazon_displayed_price_missing');
  if (!evidence || !evidence.verified) {
    blockers.push(evidenceBlocker(evidence));
  }
  if (exception && exception.status !== 'clear') blockers.push(exception.primaryReason || 'open_exception');
  const uniqueBlockers = Array.from(new Set(blockers.filter(Boolean)));
  let precheckRoutingStatus = 'auto_ready';
  let nextAction = 'ready_for_controlled_collection_or_edit_preflight';
  if (risk && risk.status === 'blocked') {
    precheckRoutingStatus = 'skip_risk_filter';
    nextAction = risk.nextAction || 'skip_or_manual_risk_review';
  } else if (risk && risk.status === 'needs_review') {
    precheckRoutingStatus = 'needs_review';
    nextAction = risk.nextAction || 'manual_risk_review';
  } else if (uniqueBlockers.some((item) => /amazon_.*price|price_/.test(item))) {
    precheckRoutingStatus = 'price_missing_or_invalid';
    nextAction = 'recover_trusted_amazon_displayed_usd_price';
  } else if (uniqueBlockers.includes('aliexpress_verification_required')) {
    precheckRoutingStatus = 'category_evidence_verification_required';
    nextAction = 'resolve_aliexpress_verification_then_resume_detail_capture';
  } else if (uniqueBlockers.includes('dxm_category_validation_required')) {
    precheckRoutingStatus = 'dxm_category_validation_required';
    nextAction = 'run_dxm_readonly_category_validation';
  } else if (uniqueBlockers.some((item) => /category|evidence|mapping/.test(item))) {
    precheckRoutingStatus = 'category_evidence_not_ready';
    nextAction = 'run_aliexpress_category_verification_or_import_confirmed_evidence';
  } else if (exception && exception.status !== 'clear') {
    precheckRoutingStatus = exception.status;
    nextAction = exception.nextAction || 'manual_exception_review';
  }
  return {
    precheckRoutingStatus,
    autoReady: precheckRoutingStatus === 'auto_ready',
    nextAction,
    blockers: uniqueBlockers,
    risk,
    price,
    evidence,
    exception,
  };
}

function buildManifest(args) {
  const records = readInputRecords(args);
  const candidates = records.map((record) => normalizeCandidate(record, args));
  const asins = readAsins(args, candidates);
  const candidateByAsin = Object.fromEntries(candidates.map((candidate) => [candidate.asin, candidate]));
  const normalized = asins.map((asin) => {
    const candidate = candidateByAsin[asin];
    if (!candidate) throw new Error(`Missing candidate record for ASIN: ${asin}`);
    return candidate;
  });
  const statuses = buildStatuses(args, normalized, asins);
  const rows = normalized.map((candidate) => {
    const gates = routeCandidate(candidate, statuses);
    return {
      ...candidate,
      gates,
    };
  });
  const summary = summarizeRows(rows, statuses.summaries);
  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: nowIso(),
    source: {
      inputPath: args.inputPath,
      asinFile: args.asinFile,
      priceStorePath: args.priceStorePath,
      evidenceStorePath: args.evidenceStorePath,
      queuePath: args.queuePath,
      riskRulesPath: args.riskRulesPath,
    },
    summary,
    records: Object.fromEntries(rows.map((row) => [row.asin, row])),
  };
}

function summarizeRows(rows, sourceSummaries) {
  const byRoutingStatus = {};
  const byNextAction = {};
  rows.forEach((row) => {
    byRoutingStatus[row.gates.precheckRoutingStatus] = (byRoutingStatus[row.gates.precheckRoutingStatus] || 0) + 1;
    byNextAction[row.gates.nextAction] = (byNextAction[row.gates.nextAction] || 0) + 1;
  });
  return {
    total: rows.length,
    autoReady: rows.filter((row) => row.gates.autoReady).length,
    blockedOrNeedsWork: rows.filter((row) => !row.gates.autoReady).length,
    byRoutingStatus,
    byNextAction,
    sourceSummaries,
  };
}

function renderMarkdown(manifest) {
  const rows = Object.values(manifest.records);
  const lines = [];
  lines.push('# Candidate Manifest Report');
  lines.push('');
  lines.push(`Generated: ${manifest.generatedAt}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Total: ${manifest.summary.total}`);
  lines.push(`- Auto ready: ${manifest.summary.autoReady}`);
  lines.push(`- Blocked or needs work: ${manifest.summary.blockedOrNeedsWork}`);
  lines.push('');
  lines.push('## Routing');
  lines.push('');
  Object.entries(manifest.summary.byRoutingStatus).forEach(([status, count]) => {
    lines.push(`- ${status}: ${count}`);
  });
  lines.push('');
  lines.push('## Rows');
  lines.push('');
  lines.push('| ASIN | Routing | Next Action | Blockers |');
  lines.push('|---|---|---|---|');
  rows.forEach((row) => {
    lines.push(`| ${row.asin} | ${row.gates.precheckRoutingStatus} | ${row.gates.nextAction} | ${row.gates.blockers.join('; ') || '-'} |`);
  });
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function parseArgs(argv) {
  const args = {
    command: argv[2] || 'help',
    inputPath: '',
    json: '',
    asinList: '',
    asinFile: '',
    outPath: '',
    format: 'json',
    priceStorePath: process.env.AMAZON_PRICE_STORE || DEFAULT_PRICE_STORE_PATH,
    evidenceStorePath: process.env.ALIEXPRESS_EVIDENCE_STORE || DEFAULT_EVIDENCE_STORE_PATH,
    queuePath: process.env.DXM_EXCEPTION_QUEUE || DEFAULT_QUEUE_PATH,
    riskRulesPath: process.env.PRODUCT_RISK_RULES || DEFAULT_RISK_RULES_PATH,
    exchangeRate: process.env.TASK_EXCHANGE_RATE || '',
    multiplier: process.env.TASK_PRICE_MULTIPLIER || '',
    expectedStock: '',
    expectedOrigin: '',
    expectedFreightTemplate: '',
    includeResolved: false,
    write: false,
  };
  for (let i = 3; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === '--file' && next) {
      args.inputPath = path.resolve(next);
      i += 1;
    } else if (arg === '--json' && next) {
      args.json = next;
      i += 1;
    } else if (arg === '--asins' && next) {
      args.asinList = next;
      i += 1;
    } else if (arg === '--asin-file' && next) {
      args.asinFile = path.resolve(next);
      i += 1;
    } else if (arg === '--out' && next) {
      args.outPath = path.resolve(next);
      i += 1;
    } else if (arg === '--format' && next) {
      args.format = compactText(next).toLowerCase();
      i += 1;
    } else if (arg === '--price-store' && next) {
      args.priceStorePath = path.resolve(next);
      i += 1;
    } else if (arg === '--evidence-store' && next) {
      args.evidenceStorePath = path.resolve(next);
      i += 1;
    } else if (arg === '--queue' && next) {
      args.queuePath = path.resolve(next);
      i += 1;
    } else if (arg === '--risk-rules' && next) {
      args.riskRulesPath = path.resolve(next);
      i += 1;
    } else if (arg === '--exchange-rate' && next) {
      args.exchangeRate = next;
      i += 1;
    } else if (arg === '--multiplier' && next) {
      args.multiplier = next;
      i += 1;
    } else if (arg === '--expected-stock' && next) {
      args.expectedStock = next;
      i += 1;
    } else if (arg === '--expected-origin' && next) {
      args.expectedOrigin = next;
      i += 1;
    } else if (arg === '--expected-freight-template' && next) {
      args.expectedFreightTemplate = next;
      i += 1;
    } else if (arg === '--include-resolved') {
      args.includeResolved = true;
    } else if (arg === '--write') {
      args.write = true;
    }
  }
  if (!args.outPath) args.outPath = DEFAULT_MANIFEST_PATH;
  return args;
}

function usage() {
  return {
    tool: 'candidate-manifest',
    commands: {
      build: 'Build a unified ASIN candidate manifest from --file or --json. Default dry-run.',
    },
    inputFields: [
      'asin / ASIN',
      'title / 商品标题',
      'amazonDisplayedPriceUsd / Amazon 页面展示价格 USD',
      'productFamily',
      'Amazon URL',
      'businessLicenseGroup',
      'targetStore',
      'expectedStock',
      'expectedOrigin',
      'expectedFreightTemplate',
    ],
    outputs: {
      json: 'Default machine manifest.',
      markdown: 'Readable routing report with --format markdown.',
    },
    writeSafety: 'Writes to --out only with --write. Default prints dry-run output only.',
    defaultOut: DEFAULT_MANIFEST_PATH,
  };
}

function output(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function main() {
  const args = parseArgs(process.argv);
  if (args.command === 'help') {
    output(usage());
    return;
  }
  if (args.command !== 'build') {
    output(usage());
    return;
  }
  const manifest = buildManifest(args);
  const rendered = args.format === 'markdown' ? renderMarkdown(manifest) : `${JSON.stringify(manifest, null, 2)}\n`;
  if (args.write) {
    fs.mkdirSync(path.dirname(args.outPath), { recursive: true });
    fs.writeFileSync(args.outPath, rendered);
  }
  if (args.format === 'markdown') process.stdout.write(rendered);
  else output({ ok: true, dryRun: !args.write, outPath: args.write ? args.outPath : '', manifest });
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
  DEFAULT_MANIFEST_PATH,
  SCHEMA_VERSION,
  buildManifest,
  normalizeCandidate,
  renderMarkdown,
};
