#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_STORE_PATH = path.join(ROOT, 'runs', 'aliexpress-evidence-store.json');
const SCHEMA_VERSION = 'aliexpress-evidence-store-v1';
const VALID_STATUSES = new Set([
  'not_checked',
  'aliexpress_verified',
  'conditional_verified',
  'detail_verified',
  'dxm_category_validation_required',
  'semantic_consensus_needs_dxm_mapping',
  'aliexpress_verification_required',
  'evidence_missing',
  'evidence_split',
  'learned_rule_matched',
  'needs_manual_review',
]);
const VALID_SOURCES = new Set([
  'aliexpress_search',
  'aliexpress_detail_page',
  'aliexpress_image_search',
  'aliexpress_similar_product',
  'learned_rule',
  'manual_record',
  'not_checked',
]);

function nowIso() {
  return new Date().toISOString();
}

function normalizeAsin(value) {
  const asin = String(value || '').trim().toUpperCase();
  if (!/^B0[A-Z0-9]{8}$/.test(asin)) {
    throw new Error(`Invalid ASIN: ${value}`);
  }
  return asin;
}

function emptyStore() {
  return {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: nowIso(),
    records: {},
  };
}

function readStore(filePath = DEFAULT_STORE_PATH) {
  if (!fs.existsSync(filePath)) return emptyStore();
  const raw = fs.readFileSync(filePath, 'utf8');
  const store = raw.trim() ? JSON.parse(raw) : emptyStore();
  if (store.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(`Unsupported evidence store schemaVersion: ${store.schemaVersion || 'missing'}`);
  }
  if (!store.records || typeof store.records !== 'object' || Array.isArray(store.records)) {
    throw new Error('Invalid evidence store: records must be an object');
  }
  return store;
}

function writeStore(store, filePath = DEFAULT_STORE_PATH) {
  store.updatedAt = nowIso();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(store, null, 2)}\n`);
}

function validateRecord(record) {
  const normalized = { ...record };
  normalized.asin = normalizeAsin(normalized.asin);
  normalized.status = normalized.status || 'not_checked';
  if (!VALID_STATUSES.has(normalized.status)) {
    throw new Error(`Invalid evidence status for ${normalized.asin}: ${normalized.status}`);
  }
  normalized.source = normalized.source || (normalized.status === 'not_checked' ? 'not_checked' : 'manual_record');
  if (!VALID_SOURCES.has(normalized.source)) {
    throw new Error(`Invalid evidence source for ${normalized.asin}: ${normalized.source}`);
  }
  normalized.safeAdjacentUsed = Boolean(normalized.safeAdjacentUsed);
  normalized.updatedAt = normalized.updatedAt || nowIso();
  normalized.createdAt = normalized.createdAt || normalized.updatedAt;
  return normalized;
}

function upsertEvidence(input, filePath = DEFAULT_STORE_PATH) {
  const store = readStore(filePath);
  const incoming = validateRecord(input);
  const previous = store.records[incoming.asin] || {};
  const merged = validateRecord({
    ...previous,
    ...incoming,
    asin: incoming.asin,
    createdAt: previous.createdAt || incoming.createdAt || nowIso(),
    updatedAt: nowIso(),
  });
  store.records[merged.asin] = merged;
  writeStore(store, filePath);
  return merged;
}

function getEvidence(asin, filePath = DEFAULT_STORE_PATH) {
  const store = readStore(filePath);
  return store.records[normalizeAsin(asin)] || null;
}

function listEvidence(filePath = DEFAULT_STORE_PATH) {
  const store = readStore(filePath);
  return Object.values(store.records).sort((a, b) => a.asin.localeCompare(b.asin));
}

function markEvidenceStatus(asin, status, reason = '', filePath = DEFAULT_STORE_PATH) {
  return upsertEvidence({
    asin,
    status,
    reason,
    source: status === 'not_checked' ? 'not_checked' : 'manual_record',
  }, filePath);
}

function parseArgs(argv) {
  const args = {
    command: argv[2] || 'help',
    storePath: process.env.ALIEXPRESS_EVIDENCE_STORE || DEFAULT_STORE_PATH,
    asin: '',
    status: '',
    reason: '',
    json: '',
  };
  for (let i = 3; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === '--store' && next) {
      args.storePath = path.resolve(next);
      i += 1;
    } else if (arg === '--asin' && next) {
      args.asin = next;
      i += 1;
    } else if (arg === '--status' && next) {
      args.status = next;
      i += 1;
    } else if (arg === '--reason' && next) {
      args.reason = next;
      i += 1;
    } else if (arg === '--json' && next) {
      args.json = next;
      i += 1;
    }
  }
  return args;
}

function output(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function usage() {
  return {
    tool: 'aliexpress-evidence-store',
    commands: {
      init: 'Create the evidence store if it does not exist.',
      get: 'Get one ASIN evidence record. Requires --asin.',
      list: 'List all evidence records.',
      upsert: 'Upsert evidence from --json.',
      mark: 'Mark one ASIN status. Requires --asin and --status; optional --reason.',
    },
    statuses: Array.from(VALID_STATUSES),
    sources: Array.from(VALID_SOURCES),
    defaultStore: DEFAULT_STORE_PATH,
  };
}

function main() {
  const args = parseArgs(process.argv);
  if (args.command === 'init') {
    const store = readStore(args.storePath);
    writeStore(store, args.storePath);
    output({ ok: true, storePath: args.storePath, summary: { records: Object.keys(store.records).length } });
    return;
  }
  if (args.command === 'get') {
    output({ ok: true, record: getEvidence(args.asin, args.storePath) });
    return;
  }
  if (args.command === 'list') {
    const records = listEvidence(args.storePath);
    output({ ok: true, records, summary: { records: records.length } });
    return;
  }
  if (args.command === 'upsert') {
    if (!args.json) throw new Error('upsert requires --json');
    output({ ok: true, record: upsertEvidence(JSON.parse(args.json), args.storePath) });
    return;
  }
  if (args.command === 'mark') {
    if (!args.asin || !args.status) throw new Error('mark requires --asin and --status');
    output({ ok: true, record: markEvidenceStatus(args.asin, args.status, args.reason, args.storePath) });
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
  DEFAULT_STORE_PATH,
  SCHEMA_VERSION,
  getEvidence,
  listEvidence,
  markEvidenceStatus,
  readStore,
  upsertEvidence,
  validateRecord,
  writeStore,
};
