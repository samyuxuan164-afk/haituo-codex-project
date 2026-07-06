#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  DEFAULT_STORE_PATH: DEFAULT_PRICE_STORE_PATH,
  buildStatus: buildPriceStatus,
} = require('./amazon-price-store');
const {
  DEFAULT_STORE_PATH: DEFAULT_EVIDENCE_STORE_PATH,
  getEvidence,
} = require('./aliexpress-evidence-store');
const {
  DEFAULT_QUEUE_PATH,
  upsertException,
} = require('./exception-queue');
const {
  extractWebBridgeValue,
  getToolError,
  postWebBridge,
} = require('./aliexpress-evidence-browser-cache');

const DEFAULT_ENDPOINT = 'http://127.0.0.1:10086/command';
const DEFAULT_SESSION = 'dxm-wait-publish-readback';
const DEFAULT_WAIT_PUBLISH_URL = 'https://www.dianxiaomi.com/web/smtlocalProduct/offline';

function compactText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeAsin(value) {
  const asin = compactText(value).toUpperCase();
  if (!/^B0[A-Z0-9]{8}$/.test(asin)) throw new Error(`Invalid ASIN: ${value}`);
  return asin;
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
    url: process.env.DXM_WAIT_PUBLISH_URL || DEFAULT_WAIT_PUBLISH_URL,
    timeoutMs: Number(process.env.WEBBRIDGE_TIMEOUT_MS || 12000),
    asinList: '',
    asinFile: '',
    priceStorePath: process.env.AMAZON_PRICE_STORE || DEFAULT_PRICE_STORE_PATH,
    evidenceStorePath: process.env.ALIEXPRESS_EVIDENCE_STORE || DEFAULT_EVIDENCE_STORE_PATH,
    queuePath: process.env.DXM_EXCEPTION_QUEUE || DEFAULT_QUEUE_PATH,
    readbackJson: '',
    readbackFile: '',
    expectedJson: '',
    expectedFile: '',
    exchangeRate: process.env.TASK_EXCHANGE_RATE || '',
    multiplier: process.env.TASK_PRICE_MULTIPLIER || '',
    expectedStock: '',
    expectedCategory: '',
    priceTolerance: Number(process.env.DXM_WAIT_PUBLISH_PRICE_TOLERANCE || 0.01),
    pageWaitMs: Number(process.env.DXM_WAIT_PUBLISH_READBACK_WAIT_MS || 8000),
    writeExceptions: false,
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
    } else if (arg === '--url' && next) {
      args.url = next;
      i += 1;
    } else if (arg === '--timeout-ms' && next) {
      args.timeoutMs = Number(next);
      i += 1;
    } else if (arg === '--asins' && next) {
      args.asinList = next;
      i += 1;
    } else if (arg === '--asin-file' && next) {
      args.asinFile = path.resolve(next);
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
    } else if (arg === '--readback-json' && next) {
      args.readbackJson = next;
      i += 1;
    } else if (arg === '--readback-file' && next) {
      args.readbackFile = path.resolve(next);
      i += 1;
    } else if (arg === '--expected-json' && next) {
      args.expectedJson = next;
      i += 1;
    } else if (arg === '--expected-file' && next) {
      args.expectedFile = path.resolve(next);
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
    } else if (arg === '--expected-category' && next) {
      args.expectedCategory = next;
      i += 1;
    } else if (arg === '--price-tolerance' && next) {
      args.priceTolerance = Number(next);
      i += 1;
    } else if (arg === '--page-wait-ms' && next) {
      args.pageWaitMs = Number(next);
      i += 1;
    } else if (arg === '--write-exceptions') {
      args.writeExceptions = true;
    }
  }
  return args;
}

function output(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function usage() {
  return {
    tool: 'dxm-wait-publish-readback',
    commands: {
      read: 'Readonly readback from Dianxiaomi wait-to-publish list. Optional --asins.',
      check: 'Readonly readback plus expected price/category/stock checks. Requires --asins or --asin-file.',
      analyze: 'Local-only analysis from --readback-json/--readback-file. No browser action.',
    },
    localAnalysisOptions: {
      '--readback-json / --readback-file': 'A readback object, or an object containing { readback: ... }.',
      '--expected-json / --expected-file': 'Optional expected row overrides: array, { rows: [...] }, or { records: [...] }.',
      '--price-tolerance': 'Numeric price comparison tolerance, default 0.01.',
    },
    safety: [
      'This tool only navigates to/readbacks the wait-to-publish list through WebBridge.',
      'It does not click edit rules, save, move products, publish, one-click publish, claim, collect, delete, or submit forms.',
      'Exception queue writes happen only with --write-exceptions.',
    ],
    defaultUrl: DEFAULT_WAIT_PUBLISH_URL,
  };
}

async function ensureWaitPublishPage(args) {
  const found = await postWebBridge(args, 'find_tab', { url: args.url, active: true });
  const foundError = getToolError(found);
  if (!found.error && !foundError) {
    const page = found.data && found.data.data ? found.data.data : found.data;
    if (page && String(page.url || '').includes('/web/smtlocalProduct/offline')) {
      return { ok: true, page, opened: false };
    }
  }
  const opened = await postWebBridge(args, 'navigate', {
    url: args.url,
    newTab: true,
    group_title: '待发布读回',
  });
  const openedError = getToolError(opened);
  if (opened.error || openedError) {
    return { ok: false, status: opened.error || openedError, message: opened.message || '', raw: opened.data || null };
  }
  return { ok: true, page: opened.data && opened.data.data ? opened.data.data : opened.data, opened: true };
}

async function readWaitPublishPage(args, asins = []) {
  const page = await ensureWaitPublishPage(args);
  if (!page.ok) return { ok: false, stage: 'open_wait_publish_page', page };
  const code = `(async () => {
    const wanted = ${JSON.stringify(asins)};
    const maxWaitMs = ${JSON.stringify(args.pageWaitMs)};
    const norm = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const isLoadedText = () => {
      const text = norm(document.body && document.body.innerText);
      return /待发布|产品管理|第\\s*\\d+\\s*-\\s*\\d+\\s*条|采集箱\\(\\d+\\)|发布失败\\s*\\(\\d+\\)/.test(text);
    };
    const deadline = Date.now() + Math.max(0, Number(maxWaitMs) || 0);
    while (!isLoadedText() && Date.now() < deadline) await sleep(500);
    const shortText = (value, max = 2200) => {
      const text = norm(value);
      return text.length > max ? text.slice(0, max) : text;
    };
    const rowLikeSelector = 'tr,.ant-table-row,.vxe-body--row,li,[class*="table-row"],[class*="product"],[class*="list-item"],[class*="goods"]';
    const allText = norm(document.body && document.body.innerText);
    const pageLoaded = isLoadedText();
    const rowTextForAsin = (asin) => {
      const nodes = Array.from(document.querySelectorAll('body *')).filter((node) => {
        const text = norm(node.innerText || node.textContent);
        return text.includes(asin);
      });
      let best = null;
      for (const node of nodes) {
        let current = node;
        for (let depth = 0; current && depth < 7; depth += 1, current = current.parentElement) {
          if (!current || current === document.body) break;
          const text = norm(current.innerText || current.textContent);
          if (!text.includes(asin)) continue;
          const rowLike = current.matches && current.matches(rowLikeSelector);
          const score = (rowLike ? 10000 : 0) - Math.abs(text.length - 800) - depth * 100;
          if (!best || score > best.score) best = { text, tag: current.tagName, className: current.className || '', score };
        }
      }
      return best ? best.text : '';
    };
    const priceNumbers = (text) => Array.from(new Set((text.match(/\\b\\d{1,5}\\.\\d{2}\\b/g) || []).map(String)));
    const integerNumbers = (text) => Array.from(new Set((text.match(/\\b\\d{1,6}\\b/g) || []).map(String)));
    const rowFor = (asin) => {
      const rowText = rowTextForAsin(asin);
      return {
        asin,
        found: Boolean(rowText),
        skuPresent: rowText.includes(asin),
        rowText: shortText(rowText),
        priceCandidates: priceNumbers(rowText),
        integerCandidates: integerNumbers(rowText),
      };
    };
    const rows = wanted.length ? wanted.map(rowFor) : [];
    return JSON.stringify({
      href: location.href,
      title: document.title,
      readyState: document.readyState,
      isWaitPublishPage: /\\/web\\/smtlocalProduct\\/offline/.test(location.pathname),
      pageLoaded,
      bodyHasPublishText: /发布|一键发布|待发布/.test(allText),
      bodySnippet: shortText(allText, 1600),
      rows,
      totalText: (allText.match(/第\\s*\\d+\\s*-\\s*\\d+\\s*条[，,]\\s*共\\s*\\d+\\s*条|共\\s*\\d+\\s*条/g) || []).slice(0, 5)
    });
  })()`;
  const response = await postWebBridge(args, 'evaluate', { code });
  const error = getToolError(response);
  if (response.error || error) return { ok: false, stage: 'evaluate_wait_publish_page', status: response.error || error, raw: response.data || null };
  try {
    return { ok: true, page, readback: JSON.parse(extractWebBridgeValue(response) || '{}') };
  } catch (parseError) {
    return { ok: false, stage: 'parse_wait_publish_readback', error: String(parseError), raw: response.data || null };
  }
}

function leafTerms(categoryPath) {
  const text = compactText(categoryPath);
  if (!text) return [];
  const parts = text.split(/[/>]/).map((part) => compactText(part)).filter(Boolean);
  const leaf = parts[parts.length - 1] || text;
  const terms = new Set([leaf]);
  const paren = leaf.match(/\(([^)]+)\)/g) || [];
  paren.forEach((item) => terms.add(item.replace(/[()]/g, '')));
  leaf.split(/[\s()（）、，,/-]+/).map(compactText).filter((item) => item.length >= 2).forEach((item) => terms.add(item));
  return Array.from(terms).filter(Boolean);
}

function parseNumber(value) {
  if (value == null || value === '') return null;
  const normalized = String(value).replace(/,/g, '').match(/\d+(?:\.\d+)?/);
  if (!normalized) return null;
  const number = Number(normalized[0]);
  return Number.isFinite(number) ? number : null;
}

function normalizeComparableText(value) {
  return compactText(value).toLowerCase();
}

function readJsonInput(jsonText, filePath, fallback) {
  if (jsonText) return JSON.parse(jsonText);
  if (filePath) {
    const raw = fs.readFileSync(filePath, 'utf8');
    return raw.trim() ? JSON.parse(raw) : fallback;
  }
  return fallback;
}

function asArrayPayload(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.rows)) return payload.rows;
  if (Array.isArray(payload.records)) return payload.records;
  if (payload.records && typeof payload.records === 'object') return Object.values(payload.records);
  return [payload];
}

function normalizeExpectedOverride(row) {
  const asin = row.asin ? normalizeAsin(row.asin) : '';
  return {
    asin,
    expectedPrice: compactText(row.expectedPrice || row.expectedCnyPrice || row.price || row.cnyPrice),
    expectedStock: compactText(row.expectedStock || row.stock),
    expectedCategory: compactText(row.expectedCategory || row.category || row.dxmCandidateCategory),
    expectedSku: compactText(row.expectedSku || row.sku || asin),
  };
}

function readExpectedOverrides(args) {
  const payload = readJsonInput(args.expectedJson, args.expectedFile, []);
  return Object.fromEntries(asArrayPayload(payload)
    .map(normalizeExpectedOverride)
    .filter((row) => row.asin)
    .map((row) => [row.asin, row]));
}

function buildExpectedRows(args, asins) {
  const priceStatus = asins.length
    ? buildPriceStatus({
      storePath: args.priceStorePath,
      asinList: asins.join(','),
      exchangeRate: args.exchangeRate,
      multiplier: args.multiplier,
    })
    : { rows: [] };
  const priceByAsin = Object.fromEntries((priceStatus.rows || []).map((row) => [row.asin, row]));
  const overrides = readExpectedOverrides(args);
  return asins.map((asin) => {
    const evidence = getEvidence(asin, args.evidenceStorePath);
    const override = overrides[asin] || {};
    const category = compactText(override.expectedCategory || args.expectedCategory || (evidence && evidence.dxmCandidateCategory));
    const overridePrice = compactText(override.expectedPrice);
    return {
      asin,
      expectedSku: compactText(override.expectedSku || asin),
      expectedPrice: compactText(overridePrice || (priceByAsin[asin] && priceByAsin[asin].expectedCnyPrice ? String(priceByAsin[asin].expectedCnyPrice) : '')),
      priceStatus: overridePrice ? null : priceByAsin[asin] || null,
      expectedPriceSource: overridePrice ? 'expected_override' : 'amazon_price_store_formula',
      expectedStock: compactText(override.expectedStock || args.expectedStock),
      expectedCategory: category,
      categoryTerms: leafTerms(category),
    };
  });
}

function buildCheck(pass, actual, expected, blocker = '', skippedReason = '') {
  return {
    pass,
    actual,
    expected,
    blocker,
    skippedReason,
  };
}

function priceCheck(row, expected, args = {}) {
  if (!expected.expectedPrice) return buildCheck(null, row.priceCandidates || [], '', '', 'expected_price_missing');
  const expectedNumber = parseNumber(expected.expectedPrice);
  const candidates = (row.priceCandidates || []).map(parseNumber).filter((value) => value != null);
  const tolerance = Number.isFinite(Number(args.priceTolerance)) ? Number(args.priceTolerance) : 0.01;
  const pass = expectedNumber != null && candidates.some((value) => Math.abs(value - expectedNumber) <= tolerance);
  return buildCheck(pass, candidates, expectedNumber, pass ? '' : 'wait_publish_price_mismatch');
}

function stockCheck(row, expected) {
  if (!expected.expectedStock) return buildCheck(null, row.integerCandidates || [], '', '', 'expected_stock_missing');
  const expectedStock = String(expected.expectedStock);
  const pass = (row.integerCandidates || []).includes(expectedStock) || compactText(row.rowText).includes(expectedStock);
  return buildCheck(pass, row.integerCandidates || [], expectedStock, pass ? '' : 'wait_publish_stock_mismatch');
}

function categoryCheck(row, expected) {
  if (!expected.categoryTerms.length) return buildCheck(null, '', '', '', 'expected_category_missing');
  const rowText = normalizeComparableText(row.rowText);
  const terms = expected.categoryTerms.map(normalizeComparableText).filter(Boolean);
  const matched = terms.filter((term) => rowText.includes(term));
  const pass = matched.length > 0;
  return buildCheck(pass, matched, terms, pass ? '' : 'wait_publish_category_mismatch');
}

function skuCheck(row, expected) {
  const expectedSku = compactText(expected.expectedSku || expected.asin);
  const pass = Boolean(row.found && expectedSku && compactText(row.rowText).includes(expectedSku));
  return buildCheck(pass, row.skuPresent ? expectedSku : '', expectedSku, pass ? '' : 'wait_publish_sku_missing');
}

function rowFoundCheck(row) {
  return buildCheck(Boolean(row.found), Boolean(row.found), true, row.found ? '' : 'wait_publish_row_missing');
}

function collectBlockers(checks) {
  return Object.values(checks)
    .map((check) => check && check.pass === false ? check.blocker : '')
    .filter(Boolean);
}

function analyzeRows(readback, expectedRows, args = {}) {
  if (!readback || !readback.isWaitPublishPage || !readback.pageLoaded) {
    const blocker = !readback || !readback.isWaitPublishPage ? 'not_wait_publish_page' : 'wait_publish_page_not_loaded';
    const results = expectedRows.map((expected) => ({
      asin: expected.asin,
      pass: false,
      found: false,
      skuPresent: false,
      priceOk: false,
      stockOk: expected.expectedStock ? false : null,
      categoryOk: expected.categoryTerms.length ? false : null,
      status: 'wait_publish_readback_blocked',
      checks: {
        page: buildCheck(false, readback && readback.isWaitPublishPage, true, blocker),
      },
      expected,
      row: { asin: expected.asin, found: false, rowText: '', priceCandidates: [], integerCandidates: [] },
      blockers: [blocker],
    }));
    return {
      rows: results,
      summary: {
        total: results.length,
        pass: 0,
        blockers: results.length,
        missingRows: 0,
        priceMismatches: 0,
        categoryMismatches: 0,
      },
    };
  }
  const rowsByAsin = Object.fromEntries((readback.rows || []).map((row) => [row.asin, row]));
  const results = expectedRows.map((expected) => {
    const row = rowsByAsin[expected.asin] || { asin: expected.asin, found: false, rowText: '', priceCandidates: [], integerCandidates: [] };
    if (!row.found) {
      const checks = {
        rowFound: rowFoundCheck(row),
        sku: buildCheck(null, '', expected.expectedSku || expected.asin, '', 'row_missing'),
        price: buildCheck(null, [], expected.expectedPrice, '', 'row_missing'),
        stock: buildCheck(null, [], expected.expectedStock, '', 'row_missing'),
        category: buildCheck(null, [], expected.categoryTerms, '', 'row_missing'),
      };
      const blockers = ['wait_publish_row_missing'];
      return {
        asin: expected.asin,
        pass: false,
        status: 'wait_publish_row_missing',
        found: false,
        skuPresent: false,
        priceOk: null,
        stockOk: null,
        categoryOk: null,
        checks,
        expected,
        row,
        blockers,
      };
    }
    const checks = {
      rowFound: rowFoundCheck(row),
      sku: skuCheck(row, expected),
      price: priceCheck(row, expected, args),
      stock: stockCheck(row, expected),
      category: categoryCheck(row, expected),
    };
    const blockers = collectBlockers(checks);
    if (expected.priceStatus && !expected.priceStatus.trusted) blockers.push(expected.priceStatus.reason || expected.priceStatus.status || 'amazon_displayed_price_missing');
    return {
      asin: expected.asin,
      pass: blockers.length === 0,
      status: blockers.length === 0 ? 'saved_to_wait_publish_readback_passed' : 'wait_publish_readback_mismatch',
      found: Boolean(row.found),
      skuPresent: checks.sku.pass,
      priceOk: checks.price.pass,
      stockOk: checks.stock.pass,
      categoryOk: checks.category.pass,
      checks,
      expected,
      row,
      blockers,
    };
  });
  return {
    rows: results,
    summary: {
      total: results.length,
      pass: results.filter((row) => row.pass).length,
      blockers: results.filter((row) => !row.pass).length,
      missingRows: results.filter((row) => row.blockers.includes('wait_publish_row_missing')).length,
      skuMismatches: results.filter((row) => row.blockers.includes('wait_publish_sku_missing')).length,
      priceMismatches: results.filter((row) => row.blockers.includes('wait_publish_price_mismatch')).length,
      stockMismatches: results.filter((row) => row.blockers.includes('wait_publish_stock_mismatch')).length,
      categoryMismatches: results.filter((row) => row.blockers.includes('wait_publish_category_mismatch')).length,
    },
  };
}

function writeExceptionsIfRequested(args, analysis) {
  if (!args.writeExceptions) return [];
  const written = [];
  analysis.rows.forEach((row) => {
    row.blockers.forEach((reason) => {
      written.push(upsertException({
        asin: row.asin,
        stage: 'wait_publish_readback',
        reason,
        source: 'dxm_wait_publish_readback',
        details: {
          expected: row.expected,
          found: row.found,
          skuPresent: row.skuPresent,
          priceOk: row.priceOk,
          stockOk: row.stockOk,
          categoryOk: row.categoryOk,
          status: row.status,
          checks: row.checks,
          row: row.row,
        },
      }, args.queuePath));
    });
  });
  return written;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.command === 'help') {
    output(usage());
    return;
  }
  const asins = readAsins(args);
  if (args.command === 'read') {
    output(await readWaitPublishPage(args, asins));
    return;
  }
  if (args.command === 'analyze') {
    if (!asins.length) throw new Error('analyze requires --asins or --asin-file');
    if (!args.readbackJson && !args.readbackFile) throw new Error('analyze requires --readback-json or --readback-file');
    const payload = readJsonInput(args.readbackJson, args.readbackFile, {});
    const readback = payload.readback || payload;
    const expected = buildExpectedRows(args, asins);
    const analysis = analyzeRows(readback, expected, args);
    output({ ok: true, dryRun: !args.writeExceptions, analysis, exceptionWrites: writeExceptionsIfRequested(args, analysis) });
    return;
  }
  if (args.command === 'check') {
    if (!asins.length) throw new Error('check requires --asins or --asin-file');
    const readback = await readWaitPublishPage(args, asins);
    if (!readback.ok) {
      output(readback);
      return;
    }
    const expected = buildExpectedRows(args, asins);
    const analysis = analyzeRows(readback.readback, expected, args);
    output({ ok: true, readback, analysis, exceptionWrites: writeExceptionsIfRequested(args, analysis) });
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
  analyzeRows,
  buildExpectedRows,
  readWaitPublishPage,
};
