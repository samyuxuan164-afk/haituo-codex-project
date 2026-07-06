#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  DEFAULT_QUEUE_PATH,
  upsertException,
} = require('./exception-queue');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_RULES_PATH = path.join(ROOT, 'config', 'product-risk-rules.json');
const SCHEMA_VERSION = 'product-risk-report-v1';
const VALID_SEVERITIES = new Set(['blocker', 'review']);

function nowIso() {
  return new Date().toISOString();
}

function compactText(value) {
  if (Array.isArray(value)) return value.map(compactText).filter(Boolean).join(' ');
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeAsin(value, required = true) {
  const asin = compactText(value).toUpperCase();
  if (!asin && !required) return '';
  if (!/^B0[A-Z0-9]{8}$/.test(asin)) throw new Error(`Invalid ASIN: ${value}`);
  return asin;
}

function readJsonFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return raw.trim() ? JSON.parse(raw) : {};
}

function readRules(rulesPath = DEFAULT_RULES_PATH) {
  const rules = readJsonFile(rulesPath);
  if (rules.schemaVersion !== 'product-risk-rules-v1') {
    throw new Error(`Unsupported product risk rules schemaVersion: ${rules.schemaVersion || 'missing'}`);
  }
  if (!Array.isArray(rules.rules)) throw new Error('Invalid product risk rules: rules must be an array');
  rules.rules.forEach((rule) => {
    if (!rule.id) throw new Error('Product risk rule is missing id');
    if (!VALID_SEVERITIES.has(rule.severity)) throw new Error(`Invalid severity for rule ${rule.id}: ${rule.severity}`);
    if (!rule.category) throw new Error(`Product risk rule ${rule.id} is missing category`);
  });
  return rules;
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
  const headers = rows.shift().map((value) => compactText(value));
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
  if (parsed.records && typeof parsed.records === 'object') return Object.values(parsed.records);
  return [parsed];
}

function parseRecords(args) {
  const rows = [];
  if (args.filePath) rows.push(...readRecordsFromFile(args.filePath));
  if (args.json) {
    const parsed = JSON.parse(args.json);
    if (Array.isArray(parsed)) rows.push(...parsed);
    else if (Array.isArray(parsed.records)) rows.push(...parsed.records);
    else rows.push(parsed);
  }
  return rows;
}

function pickRecordValue(record, field) {
  const aliases = {
    asin: ['asin', 'ASIN'],
    title: ['title', 'productTitle', 'name', '商品标题', '标题'],
    brand: ['brand', 'byline', 'brandName', '品牌'],
    bullets: ['bullets', 'bulletPoints', 'features', '卖点'],
    description: ['description', 'detail', 'details', '商品描述', '描述'],
    imageAlt: ['imageAlt', 'mainImageAlt', 'imageText', '图片文字'],
    imageNotes: ['imageNotes', 'visualNotes', 'logoRisk', '图片风险', '视觉备注'],
    category: ['category', 'amazonCategory', 'productFamily', '类目', '品类'],
    sourceUrl: ['sourceUrl', 'amazonUrl', 'url', '链接'],
  };
  const keys = aliases[field] || [field];
  for (const key of keys) {
    if (record[key] != null && compactText(record[key])) return record[key];
  }
  return '';
}

function normalizeRecord(input) {
  const record = { ...input };
  return {
    asin: normalizeAsin(pickRecordValue(record, 'asin'), false),
    title: compactText(pickRecordValue(record, 'title')),
    brand: compactText(pickRecordValue(record, 'brand')),
    bullets: compactText(pickRecordValue(record, 'bullets')),
    description: compactText(pickRecordValue(record, 'description')),
    imageAlt: compactText(pickRecordValue(record, 'imageAlt')),
    imageNotes: compactText(pickRecordValue(record, 'imageNotes')),
    category: compactText(pickRecordValue(record, 'category')),
    sourceUrl: compactText(pickRecordValue(record, 'sourceUrl')),
    raw: record,
  };
}

function matchTerm(text, term) {
  const source = text.toLowerCase();
  const needle = compactText(term).toLowerCase();
  if (!needle) return false;
  return source.includes(needle);
}

function matchRegex(text, regex) {
  try {
    return new RegExp(regex, 'i').test(text);
  } catch (error) {
    throw new Error(`Invalid risk regex ${regex}: ${error.message}`);
  }
}

function fieldText(record, fields) {
  const parts = {};
  fields.forEach((field) => {
    parts[field] = compactText(record[field]);
  });
  return parts;
}

function matchRule(record, rule, defaultFields) {
  const fields = Array.isArray(rule.fields) && rule.fields.length ? rule.fields : defaultFields;
  const texts = fieldText(record, fields);
  const matchedFields = [];
  const matchedTerms = [];
  Object.entries(texts).forEach(([field, text]) => {
    if (!text) return;
    (rule.terms || []).forEach((term) => {
      if (matchTerm(text, term)) {
        matchedFields.push(field);
        matchedTerms.push(compactText(term));
      }
    });
    (rule.regexes || []).forEach((regex) => {
      if (matchRegex(text, regex)) {
        matchedFields.push(field);
        matchedTerms.push(`/${regex}/`);
      }
    });
  });
  const uniqueFields = Array.from(new Set(matchedFields));
  const uniqueTerms = Array.from(new Set(matchedTerms));
  if (!uniqueTerms.length) return null;
  return {
    ruleId: rule.id,
    category: rule.category,
    severity: rule.severity,
    reason: rule.reason || rule.id,
    nextAction: rule.nextAction || (rule.severity === 'blocker' ? 'skip_product' : 'manual_risk_review'),
    matchedFields: uniqueFields,
    matchedTerms: uniqueTerms,
  };
}

function applyHeuristics(record, rulesConfig) {
  const matches = [];
  const brandRule = rulesConfig.heuristics && rulesConfig.heuristics.brandFieldPresent;
  if (brandRule && brandRule.enabled && record.brand) {
    matches.push({
      ruleId: 'heuristic-brand-field-present',
      category: brandRule.category,
      severity: brandRule.severity,
      reason: brandRule.reason,
      nextAction: brandRule.nextAction,
      matchedFields: ['brand'],
      matchedTerms: [record.brand],
    });
  }
  return matches;
}

function chooseNextAction(matches) {
  const blocker = matches.find((match) => match.severity === 'blocker');
  if (blocker) return blocker.nextAction || 'skip_product';
  const review = matches.find((match) => match.severity === 'review');
  if (review) return review.nextAction || 'manual_risk_review';
  return 'allow_collect';
}

function screenRecord(input, rulesConfig) {
  const record = normalizeRecord(input);
  const defaultFields = Array.isArray(rulesConfig.defaultFields) ? rulesConfig.defaultFields : [];
  const matches = [
    ...rulesConfig.rules.map((rule) => matchRule(record, rule, defaultFields)).filter(Boolean),
    ...applyHeuristics(record, rulesConfig),
  ];
  const blockers = matches.filter((match) => match.severity === 'blocker');
  const reviews = matches.filter((match) => match.severity === 'review');
  const status = blockers.length ? 'blocked' : reviews.length ? 'needs_review' : 'allow';
  return {
    asin: record.asin,
    status,
    riskLevel: status,
    pass: status === 'allow',
    nextAction: chooseNextAction(matches),
    blockers,
    reviews,
    matchedRules: matches,
    normalized: {
      asin: record.asin,
      title: record.title,
      brand: record.brand,
      category: record.category,
      sourceUrl: record.sourceUrl,
    },
  };
}

function summarize(rows) {
  const byStatus = {};
  const byCategory = {};
  rows.forEach((row) => {
    byStatus[row.status] = (byStatus[row.status] || 0) + 1;
    row.matchedRules.forEach((match) => {
      byCategory[match.category] = (byCategory[match.category] || 0) + 1;
    });
  });
  return {
    total: rows.length,
    allow: byStatus.allow || 0,
    needsReview: byStatus.needs_review || 0,
    blocked: byStatus.blocked || 0,
    byStatus,
    byCategory,
  };
}

function buildExceptionItem(row) {
  const first = row.blockers[0] || row.reviews[0];
  if (!first) return null;
  return {
    asin: row.asin,
    stage: 'product_risk_filter',
    reason: first.category,
    category: 'risk_filter',
    severity: first.severity,
    source: 'product_risk_filter',
    nextAction: row.nextAction,
    details: {
      status: row.status,
      normalized: row.normalized,
      matchedRules: row.matchedRules,
    },
  };
}

function screenRecords(args) {
  const rulesConfig = readRules(args.rulesPath);
  const records = parseRecords(args);
  const rows = records.map((record) => screenRecord(record, rulesConfig));
  const exceptionPreview = rows
    .filter((row) => row.status !== 'allow')
    .map(buildExceptionItem)
    .filter(Boolean);
  const result = {
    ok: true,
    schemaVersion: SCHEMA_VERSION,
    generatedAt: nowIso(),
    dryRun: !args.writeExceptions,
    rulesPath: args.rulesPath,
    queuePath: args.queuePath,
    rows,
    exceptionPreview,
    summary: {
      ...summarize(rows),
      exceptionPreviewed: exceptionPreview.length,
      exceptionWritten: 0,
    },
  };
  if (!args.writeExceptions) return result;
  const written = exceptionPreview.map((item) => upsertException(item, args.queuePath));
  return {
    ...result,
    dryRun: false,
    exceptionWritten: written,
    summary: {
      ...result.summary,
      exceptionWritten: written.length,
    },
  };
}

function parseArgs(argv) {
  const args = {
    command: argv[2] || 'help',
    rulesPath: process.env.PRODUCT_RISK_RULES || DEFAULT_RULES_PATH,
    queuePath: process.env.DXM_EXCEPTION_QUEUE || DEFAULT_QUEUE_PATH,
    filePath: '',
    json: '',
    writeExceptions: false,
  };
  for (let i = 3; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === '--rules' && next) {
      args.rulesPath = path.resolve(next);
      i += 1;
    } else if (arg === '--queue' && next) {
      args.queuePath = path.resolve(next);
      i += 1;
    } else if (arg === '--file' && next) {
      args.filePath = path.resolve(next);
      i += 1;
    } else if (arg === '--json' && next) {
      args.json = next;
      i += 1;
    } else if (arg === '--write-exceptions') {
      args.writeExceptions = true;
    }
  }
  return args;
}

function usage() {
  return {
    tool: 'product-risk-filter',
    commands: {
      screen: 'Screen product records from --json or --file. Default is dry-run.',
    },
    inputs: {
      json: 'One record, an array of records, or { records: [...] }.',
      file: 'JSON or CSV file. CSV headers may include ASIN/title/brand/bullets/description/imageAlt/imageNotes/category/sourceUrl.',
    },
    outputStatuses: ['allow', 'needs_review', 'blocked'],
    defaultRules: DEFAULT_RULES_PATH,
    defaultQueue: DEFAULT_QUEUE_PATH,
    writeSafety: 'Exception queue writes require --write-exceptions; default mode does not write.',
  };
}

function output(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function main() {
  const args = parseArgs(process.argv);
  if (args.command === 'screen') {
    output(screenRecords(args));
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
  DEFAULT_RULES_PATH,
  readRules,
  screenRecord,
  screenRecords,
};
