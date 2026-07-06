#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  DEFAULT_STORE_PATH,
  summarizeRecord,
} = require('./amazon-price-store');
const {
  DEFAULT_QUEUE_PATH,
} = require('./exception-queue');
const {
  runCapture,
} = require('./amazon-displayed-price-capture');

const DEFAULT_ENDPOINT = 'http://127.0.0.1:10086/command';
const DEFAULT_SESSION = 'amazon-displayed-price-batch';

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

function parseArgs(argv) {
  const args = {
    command: argv[2] || 'help',
    endpoint: process.env.WEBBRIDGE_ENDPOINT || DEFAULT_ENDPOINT,
    session: process.env.WEBBRIDGE_SESSION || DEFAULT_SESSION,
    timeoutMs: Number(process.env.WEBBRIDGE_TIMEOUT_MS || 15000),
    pageWaitMs: Number(process.env.AMAZON_PRICE_CAPTURE_WAIT_MS || 10000),
    storePath: process.env.AMAZON_PRICE_STORE || DEFAULT_STORE_PATH,
    queuePath: process.env.DXM_EXCEPTION_QUEUE || DEFAULT_QUEUE_PATH,
    asinList: '',
    asinFile: '',
    limit: '',
    startIndex: 0,
    delayMs: 500,
    minPrice: '',
    maxPrice: '',
    rangePolicy: process.env.TASK_PRICE_RANGE_POLICY || 'highest_displayed_value',
    exchangeRate: process.env.TASK_EXCHANGE_RATE || '',
    multiplier: process.env.TASK_PRICE_MULTIPLIER || '',
    writePrices: false,
    writeExceptions: false,
    newTabEach: false,
  };
  for (let i = 3; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === '--endpoint' && next) {
      args.endpoint = next;
      i += 1;
    } else if (arg === '--session' && next) {
      args.session = next;
      i += 1;
    } else if (arg === '--timeout-ms' && next) {
      args.timeoutMs = Number(next);
      i += 1;
    } else if (arg === '--page-wait-ms' && next) {
      args.pageWaitMs = Number(next);
      i += 1;
    } else if (arg === '--store' && next) {
      args.storePath = path.resolve(next);
      i += 1;
    } else if (arg === '--queue' && next) {
      args.queuePath = path.resolve(next);
      i += 1;
    } else if (arg === '--asins' && next) {
      args.asinList = next;
      i += 1;
    } else if (arg === '--asin-file' && next) {
      args.asinFile = path.resolve(next);
      i += 1;
    } else if (arg === '--limit' && next) {
      args.limit = Number(next);
      i += 1;
    } else if (arg === '--start-index' && next) {
      args.startIndex = Number(next);
      i += 1;
    } else if (arg === '--delay-ms' && next) {
      args.delayMs = Number(next);
      i += 1;
    } else if (arg === '--min-price' && next) {
      args.minPrice = next;
      i += 1;
    } else if (arg === '--max-price' && next) {
      args.maxPrice = next;
      i += 1;
    } else if (arg === '--range-policy' && next) {
      args.rangePolicy = next;
      i += 1;
    } else if (arg === '--exchange-rate' && next) {
      args.exchangeRate = next;
      i += 1;
    } else if (arg === '--multiplier' && next) {
      args.multiplier = next;
      i += 1;
    } else if (arg === '--write-prices' || arg === '--write') {
      args.writePrices = true;
    } else if (arg === '--write-exceptions') {
      args.writeExceptions = true;
    } else if (arg === '--new-tab-each') {
      args.newTabEach = true;
    }
  }
  return args;
}

function output(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function usage() {
  return {
    tool: 'amazon-displayed-price-batch',
    commands: {
      capture: 'Capture Amazon displayed USD prices for --asins or --asin-file, one ASIN at a time.',
    },
    defaultBehavior: [
      'Dry-run by default: no price-store write and no exception-queue write.',
      'Use --write-prices to write trusted captured prices.',
      'Use --write-exceptions to write failed captures to the exception queue.',
      'The batch reuses one browser tab by default; use --new-tab-each only for manual diagnosis.',
    ],
    priceRule: [
      'Use the price displayed on the Amazon product page at capture time.',
      'Displayed price candidates include buy-box price, displayed ranges, variant prices, and strike/list prices.',
      'Default displayed-price candidate policy is highest_displayed_value; use --range-policy or TASK_PRICE_RANGE_POLICY only to override it.',
    ],
    safety: [
      'Readonly Amazon browser navigation/evaluation only.',
      'No Dianxiaomi action, save, publish, one-click publish, Product Development draft handling, cart, order, chat, or form submit.',
    ],
    defaultStore: DEFAULT_STORE_PATH,
    defaultQueue: DEFAULT_QUEUE_PATH,
  };
}

function sleep(ms) {
  const safeMs = Math.max(0, parseNumber(ms) || 0);
  return new Promise((resolve) => setTimeout(resolve, safeMs));
}

function selectBatchAsins(args) {
  const all = readAsins(args);
  const start = Math.max(0, parseNumber(args.startIndex) || 0);
  const limit = parseNumber(args.limit);
  return {
    all,
    selected: all.slice(start, limit && limit > 0 ? start + limit : undefined),
    startIndex: start,
    limit: limit && limit > 0 ? limit : null,
  };
}

function summarizeCaptureResult(asin, result, args) {
  const capture = result.capture || {};
  const exceptionRows = result.exceptionWrites && Array.isArray(result.exceptionWrites.rows)
    ? result.exceptionWrites.rows
    : [];
  const exceptionDryRun = !result.exceptionWrites || result.exceptionWrites.dryRun !== false;
  const writtenExceptions = exceptionDryRun ? 0 : exceptionRows.length;
  const exceptionPreviews = exceptionDryRun ? exceptionRows.length : 0;
  return {
    asin,
    ok: Boolean(result.ok),
    amazonDisplayedPriceUsd: result.record ? result.record.amazonDisplayedPriceUsd : null,
    expectedCnyPrice: result.record
      ? summarizeRecord(result.record, { exchangeRate: args.exchangeRate, multiplier: args.multiplier }).expectedCnyPrice
      : '',
    priceWritten: Boolean(result.written),
    exceptionWritten: writtenExceptions,
    exceptionPreviewed: exceptionPreviews,
    reason: capture.price && capture.price.reason
      ? capture.price.reason
      : capture.status || capture.error || (capture.page && capture.page.status) || '',
    selectedSelector: capture.selectedSelector || '',
    href: capture.href || '',
    title: capture.title || '',
  };
}

function summarizeRows(rows) {
  return {
    total: rows.length,
    captured: rows.filter((row) => row.ok).length,
    failed: rows.filter((row) => !row.ok).length,
    priceWritten: rows.filter((row) => row.priceWritten).length,
    exceptionWritten: rows.reduce((sum, row) => sum + row.exceptionWritten, 0),
    exceptionPreviewed: rows.reduce((sum, row) => sum + row.exceptionPreviewed, 0),
  };
}

async function runBatchCapture(args) {
  const batch = selectBatchAsins(args);
  if (!batch.selected.length) throw new Error('capture requires --asins or --asin-file');
  const rows = [];
  const details = [];
  for (let index = 0; index < batch.selected.length; index += 1) {
    const asin = batch.selected[index];
    try {
      const result = await runCapture({
        ...args,
        asin,
        url: '',
        write: args.writePrices,
        writeExceptions: args.writeExceptions,
        newTab: args.newTabEach || index === 0,
      });
      rows.push(summarizeCaptureResult(asin, result, args));
      details.push({ asin, result });
    } catch (error) {
      rows.push({
        asin,
        ok: false,
        amazonDisplayedPriceUsd: null,
        expectedCnyPrice: '',
        priceWritten: false,
        exceptionWritten: 0,
        exceptionPreviewed: 0,
        reason: String(error && error.message ? error.message : error),
        selectedSelector: '',
        href: '',
        title: '',
      });
      details.push({ asin, error: String(error && error.message ? error.message : error) });
    }
    if (index < batch.selected.length - 1 && args.delayMs > 0) await sleep(args.delayMs);
  }
  return {
    ok: rows.every((row) => row.ok),
    dryRun: !args.writePrices,
    exceptionDryRun: !args.writeExceptions,
    storePath: args.storePath,
    queuePath: args.queuePath,
    batch: {
      totalInput: batch.all.length,
      selected: batch.selected.length,
      startIndex: batch.startIndex,
      limit: batch.limit,
    },
    rows,
    summary: summarizeRows(rows),
    details,
    safety: usage().safety,
  };
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.command === 'help') {
    output(usage());
    return;
  }
  if (args.command === 'capture') {
    output(await runBatchCapture(args));
    return;
  }
  output(usage());
}

if (require.main === module) {
  main().catch((error) => {
    output({ ok: false, error: String(error && error.message ? error.message : error) });
    process.exitCode = 1;
  });
}

module.exports = {
  readAsins,
  runBatchCapture,
};
