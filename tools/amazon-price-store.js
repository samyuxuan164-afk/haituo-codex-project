#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_STORE_PATH = path.join(ROOT, 'runs', 'amazon-price-store.json');
const SCHEMA_VERSION = 'amazon-price-store-v1';
const VALID_STATUSES = new Set(['trusted', 'missing', 'needs_review', 'out_of_range']);
const VALID_SOURCES = new Set([
  'amazon_search_result',
  'amazon_product_page',
  'imported_task_list',
  'manual_verified',
  'not_checked',
]);

function nowIso() {
  return new Date().toISOString();
}

function compactText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeAsin(value) {
  const asin = compactText(value).toUpperCase();
  if (!/^B0[A-Z0-9]{8}$/.test(asin)) throw new Error(`Invalid ASIN: ${value}`);
  return asin;
}

function parseNumber(value) {
  if (value == null || value === '') return null;
  const number = Number(String(value).replace(/[^\d.]/g, ''));
  return Number.isFinite(number) ? number : null;
}

function getDisplayedPrice(record) {
  if (!record || typeof record !== 'object') return null;
  const displayed = parseNumber(record.amazonDisplayedPriceUsd);
  if (displayed != null) return displayed;
  return parseNumber(record.amazonOriginalPriceUsd);
}

function round2(value) {
  return Math.round(Number(value) * 100) / 100;
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
    throw new Error(`Unsupported Amazon price store schemaVersion: ${store.schemaVersion || 'missing'}`);
  }
  if (!store.records || typeof store.records !== 'object' || Array.isArray(store.records)) {
    throw new Error('Invalid Amazon price store: records must be an object');
  }
  return store;
}

function writeStore(store, filePath = DEFAULT_STORE_PATH) {
  store.updatedAt = nowIso();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(store, null, 2)}\n`);
}

function validateRecord(input) {
  const record = { ...input };
  record.asin = normalizeAsin(record.asin);
  record.amazonDisplayedPriceUsd = getDisplayedPrice(record);
  record.amazonOriginalPriceUsd = record.amazonDisplayedPriceUsd;
  record.currency = compactText(record.currency || 'USD').toUpperCase();
  record.source = compactText(record.source || 'not_checked');
  if (!VALID_SOURCES.has(record.source)) throw new Error(`Invalid Amazon price source for ${record.asin}: ${record.source}`);
  record.status = compactText(record.status || inferStatus(record));
  if (!VALID_STATUSES.has(record.status)) throw new Error(`Invalid Amazon price status for ${record.asin}: ${record.status}`);
  record.amazonUrl = compactText(record.amazonUrl || (record.asin ? `https://www.amazon.com/dp/${record.asin}` : ''));
  record.evidenceUrl = compactText(record.evidenceUrl || record.amazonUrl);
  record.title = compactText(record.title);
  record.reason = compactText(record.reason || inferReason(record));
  record.priceRange = normalizePriceRange(record.priceRange);
  record.updatedAt = record.updatedAt || nowIso();
  record.createdAt = record.createdAt || record.updatedAt;
  if (record.status === 'trusted') {
    if (!record.amazonDisplayedPriceUsd || record.amazonDisplayedPriceUsd <= 0) {
      throw new Error(`Trusted Amazon displayed price requires positive amazonDisplayedPriceUsd for ${record.asin}`);
    }
    if (record.currency !== 'USD') {
      throw new Error(`Trusted Amazon price must use USD for ${record.asin}`);
    }
  }
  return record;
}

function normalizePriceRange(range) {
  const source = range && typeof range === 'object' ? range : {};
  const min = parseNumber(source.min);
  const max = parseNumber(source.max);
  return {
    min: min != null ? min : null,
    max: max != null ? max : null,
  };
}

function inferStatus(record) {
  const displayedPrice = getDisplayedPrice(record);
  if (!displayedPrice || displayedPrice <= 0) return 'missing';
  if (record.priceRange) {
    const range = normalizePriceRange(record.priceRange);
    if (range.min != null && displayedPrice < range.min) return 'out_of_range';
    if (range.max != null && displayedPrice > range.max) return 'out_of_range';
  }
  return record.source === 'not_checked' ? 'needs_review' : 'trusted';
}

function inferReason(record) {
  const displayedPrice = getDisplayedPrice(record);
  if (!displayedPrice || displayedPrice <= 0) return 'amazon_displayed_price_missing';
  if (record.status === 'out_of_range') return 'amazon_original_price_out_of_range';
  if (record.status === 'needs_review') return 'amazon_original_price_needs_review';
  return '';
}

function upsertPrice(input, filePath = DEFAULT_STORE_PATH) {
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

function getPrice(asin, filePath = DEFAULT_STORE_PATH) {
  const store = readStore(filePath);
  return store.records[normalizeAsin(asin)] || null;
}

function listPrices(filePath = DEFAULT_STORE_PATH) {
  const store = readStore(filePath);
  return Object.values(store.records).sort((a, b) => a.asin.localeCompare(b.asin));
}

function computeExpectedCny(record, exchangeRate, multiplier) {
  const price = getDisplayedPrice(record);
  const rate = parseNumber(exchangeRate);
  const factor = parseNumber(multiplier);
  if (!price || !rate || !factor) {
    return {
      ok: false,
      reason: !price ? 'amazon_displayed_price_missing' : 'price_formula_missing_exchange_rate_or_multiplier',
      amazonDisplayedPriceUsd: price,
      amazonOriginalPriceUsd: price,
      exchangeRate: rate,
      multiplier: factor,
      expectedCnyPrice: '',
    };
  }
  return {
    ok: true,
    amazonDisplayedPriceUsd: price,
    amazonOriginalPriceUsd: price,
    exchangeRate: rate,
    multiplier: factor,
    expectedCnyPrice: round2(price * rate * factor),
    formula: 'amazonDisplayedPriceUsd * exchangeRate * multiplier',
  };
}

function summarizeRecord(record, args = {}) {
  const computed = computeExpectedCny(record, args.exchangeRate, args.multiplier);
  const displayedPrice = getDisplayedPrice(record);
  const trusted = record && record.status === 'trusted' && record.currency === 'USD' && displayedPrice > 0;
  return {
    asin: record ? record.asin : '',
    status: record ? record.status : 'missing',
    trusted: Boolean(trusted),
    amazonDisplayedPriceUsd: displayedPrice,
    amazonOriginalPriceUsd: displayedPrice,
    currency: record ? record.currency : 'USD',
    source: record ? record.source : '',
    expectedCnyPrice: computed.ok ? computed.expectedCnyPrice : '',
    formulaOk: computed.ok,
    reason: record ? record.reason || computed.reason || '' : 'amazon_displayed_price_missing',
    updatedAt: record ? record.updatedAt || '' : '',
  };
}

function readAsins(args) {
  const values = [];
  if (args.asinList) values.push(...args.asinList.split(/[,\s]+/));
  if (args.asinFile) values.push(...fs.readFileSync(args.asinFile, 'utf8').split(/[,\s]+/));
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

function buildStatus(args) {
  const asins = readAsins(args);
  if (!asins.length) throw new Error('status requires --asins or --asin-file');
  const rows = asins.map((asin) => {
    const record = getPrice(asin, args.storePath);
    if (!record) {
      return {
        asin,
        status: 'missing',
        trusted: false,
        amazonDisplayedPriceUsd: null,
        amazonOriginalPriceUsd: null,
        currency: 'USD',
        source: '',
        expectedCnyPrice: '',
        formulaOk: false,
        reason: 'amazon_displayed_price_missing',
        updatedAt: '',
      };
    }
    return summarizeRecord(record, args);
  });
  return {
    ok: true,
    storePath: args.storePath,
    rows,
    summary: summarizeRows(rows),
  };
}

function summarizeRows(rows) {
  return {
    total: rows.length,
    trusted: rows.filter((row) => row.trusted).length,
    missing: rows.filter((row) => row.status === 'missing').length,
    outOfRange: rows.filter((row) => row.status === 'out_of_range').length,
    needsReview: rows.filter((row) => row.status === 'needs_review').length,
    formulaOk: rows.filter((row) => row.formulaOk).length,
    blockers: rows.filter((row) => !row.trusted || !row.formulaOk).length,
  };
}

function parseCsvLine(line) {
  const cells = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      cells.push(cell);
      cell = '';
    } else {
      cell += char;
    }
  }
  cells.push(cell);
  return cells.map((value) => value.trim());
}

function importCsv(args) {
  if (!args.file) throw new Error('import-csv requires --file');
  const lines = fs.readFileSync(args.file, 'utf8').split(/\r?\n/).filter((line) => compactText(line));
  if (!lines.length) throw new Error('CSV is empty');
  const headers = parseCsvLine(lines[0]).map((header) => compactText(header).toLowerCase());
  const rows = lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    const raw = {};
    headers.forEach((header, index) => {
      raw[header] = cells[index] || '';
    });
    return buildRecordFromObject(raw, args);
  });
  if (args.write) rows.forEach((row) => row.ok && upsertPrice(row.record, args.storePath));
  return {
    ok: rows.every((row) => row.ok),
    dryRun: !args.write,
    storePath: args.storePath,
    rows: rows.map((row) => row.ok ? { ok: true, record: summarizeRecord(row.record, args) } : row),
    summary: {
      rows: rows.length,
      importable: rows.filter((row) => row.ok).length,
      written: args.write ? rows.filter((row) => row.ok).length : 0,
    },
  };
}

function buildRecordFromObject(raw, args = {}) {
  try {
    const asin = raw.asin || raw.ASIN;
    const price = raw.amazon_displayed_price_usd
      || raw.amazonDisplayedPriceUsd
      || raw.amazondisplayedpriceusd
      || raw['amazon 页面展示价格 usd']
      || raw['amazon页面展示价格usd']
      || raw['amazon展示价格usd']
      || raw.displayed_price_usd
      || raw.amazon_original_price_usd
      || raw.amazonOriginalPriceUsd
      || raw.amazonoriginalpriceusd
      || raw['amazon 原价 usd']
      || raw['amazon原价usd']
      || raw.price
      || raw.original_price_usd;
    const record = validateRecord({
      asin,
      amazonDisplayedPriceUsd: price,
      source: raw.source || args.source || 'imported_task_list',
      evidenceUrl: raw.evidenceUrl || raw.evidence_url || raw.amazonUrl || raw.amazon_url || '',
      amazonUrl: raw.amazonUrl || raw.amazon_url || '',
      title: raw.title || raw['商品标题'] || '',
      priceRange: { min: args.minPrice, max: args.maxPrice },
    });
    return { ok: true, record };
  } catch (error) {
    return { ok: false, raw, error: String(error && error.message ? error.message : error) };
  }
}

function parseArgs(argv) {
  const args = {
    command: argv[2] || 'help',
    storePath: process.env.AMAZON_PRICE_STORE || DEFAULT_STORE_PATH,
    asin: '',
    asinList: '',
    asinFile: '',
    json: '',
    file: '',
    source: '',
    exchangeRate: process.env.TASK_EXCHANGE_RATE || '',
    multiplier: process.env.TASK_PRICE_MULTIPLIER || '',
    minPrice: '',
    maxPrice: '',
    write: false,
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
    } else if (arg === '--asins' && next) {
      args.asinList = next;
      i += 1;
    } else if (arg === '--asin-file' && next) {
      args.asinFile = path.resolve(next);
      i += 1;
    } else if (arg === '--json' && next) {
      args.json = next;
      i += 1;
    } else if (arg === '--file' && next) {
      args.file = path.resolve(next);
      i += 1;
    } else if (arg === '--source' && next) {
      args.source = next;
      i += 1;
    } else if (arg === '--exchange-rate' && next) {
      args.exchangeRate = next;
      i += 1;
    } else if (arg === '--multiplier' && next) {
      args.multiplier = next;
      i += 1;
    } else if (arg === '--min-price' && next) {
      args.minPrice = next;
      i += 1;
    } else if (arg === '--max-price' && next) {
      args.maxPrice = next;
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
    tool: 'amazon-price-store',
    commands: {
      init: 'Create the Amazon price store if it does not exist.',
      get: 'Get one ASIN price record. Requires --asin.',
      list: 'List all price records.',
      status: 'Read trusted Amazon displayed-price status for --asins or --asin-file. Optional formula args.',
      upsert: 'Upsert one price record from --json. Prefer amazonDisplayedPriceUsd; amazonOriginalPriceUsd remains accepted as a compatibility fallback.',
      'import-csv': 'Import CSV rows. Default dry-run; writes only with --write.',
      compute: 'Compute expected CNY from Amazon displayed price for one ASIN. Requires --asin, --exchange-rate, --multiplier.',
    },
    acceptedSources: Array.from(VALID_SOURCES),
    statuses: Array.from(VALID_STATUSES),
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
    output({ ok: true, record: getPrice(args.asin, args.storePath) });
    return;
  }
  if (args.command === 'list') {
    const records = listPrices(args.storePath);
    output({ ok: true, records, summary: summarizeRows(records.map((record) => summarizeRecord(record, args))) });
    return;
  }
  if (args.command === 'status') {
    output(buildStatus(args));
    return;
  }
  if (args.command === 'upsert') {
    if (!args.json) throw new Error('upsert requires --json');
    output({ ok: true, record: upsertPrice(JSON.parse(args.json), args.storePath) });
    return;
  }
  if (args.command === 'import-csv') {
    output(importCsv(args));
    return;
  }
  if (args.command === 'compute') {
    const record = getPrice(args.asin, args.storePath);
    output({ ok: Boolean(record), record: record ? summarizeRecord(record, args) : null, compute: computeExpectedCny(record, args.exchangeRate, args.multiplier) });
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
  buildStatus,
  computeExpectedCny,
  getPrice,
  getDisplayedPrice,
  listPrices,
  readStore,
  summarizeRecord,
  upsertPrice,
  validateRecord,
  writeStore,
};
