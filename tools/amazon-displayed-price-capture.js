#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  DEFAULT_STORE_PATH,
  upsertPrice,
  validateRecord,
} = require('./amazon-price-store');
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
const DEFAULT_SESSION = 'amazon-displayed-price-capture';
const PRICE_SELECTORS = [
  '#corePriceDisplay_desktop_feature_div',
  '#corePrice_feature_div',
  '#apex_desktop',
  '#desktop_buybox',
  '#centerCol',
  '#priceblock_ourprice',
  '#priceblock_dealprice',
  '#priceblock_saleprice',
  '#price_inside_buybox',
  '#newBuyBoxPrice',
  '#sns-base-price',
  '#tp_price_block_total_price_ww',
  '[data-feature-name="corePrice"]',
  '[data-feature-name="apex_desktop"]',
];

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

function round2(value) {
  return Math.round(Number(value) * 100) / 100;
}

function amazonUrlForAsin(asin) {
  return `https://www.amazon.com/dp/${normalizeAsin(asin)}`;
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
    asin: '',
    url: '',
    text: '',
    file: '',
    minPrice: '',
    maxPrice: '',
    rangePolicy: process.env.TASK_PRICE_RANGE_POLICY || 'highest_displayed_value',
    write: false,
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
    } else if (arg === '--asin' && next) {
      args.asin = normalizeAsin(next);
      i += 1;
    } else if (arg === '--url' && next) {
      args.url = next;
      i += 1;
    } else if (arg === '--text' && next) {
      args.text = next;
      i += 1;
    } else if (arg === '--file' && next) {
      args.file = path.resolve(next);
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
    } else if (arg === '--write') {
      args.write = true;
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
    tool: 'amazon-displayed-price-capture',
    commands: {
      'parse-text': 'Parse Amazon displayed-price text locally. Use --text or --file.',
      capture: 'Open an Amazon product page through WebBridge and capture the displayed USD price. Use --asin or --url. Price-store writes only with --write; exception writes only with --write-exceptions.',
    },
    priceRule: [
      'Use the price displayed on the Amazon product page at capture time.',
      'Displayed price candidates include the buy-box price, displayed ranges, variant prices, and strike/list prices.',
      'Default displayed-price candidate policy is highest_displayed_value; use --range-policy or TASK_PRICE_RANGE_POLICY only to override it.',
      'Supported override policies: highest_displayed_value, lowest_displayed_value.',
    ],
    safety: [
      'Readonly browser navigation/evaluation only.',
      'No Dianxiaomi action, save, publish, one-click publish, cart, order, chat, or form submit.',
      'Price-store writes happen only with --write.',
      'Exception queue writes happen only with --write-exceptions.',
    ],
    defaultStore: DEFAULT_STORE_PATH,
  };
}

function selectRangeValue(values, rangePolicy) {
  const usableValues = values.filter((value) => value > 0 && value < 100000);
  if (!usableValues.length) return null;
  if (rangePolicy === 'highest_displayed_value') return round2(Math.max(...usableValues));
  if (rangePolicy === 'lowest_displayed_value') return round2(Math.min(...usableValues));
  return null;
}

function parseDisplayedPrice(text, options = {}) {
  const sourceText = compactText(text);
  const rangePolicy = compactText(options.rangePolicy || 'highest_displayed_value');
  const candidates = [];
  const nonPriceContext = (index, raw) => {
    const start = Math.max(0, index - 14);
    const end = Math.min(sourceText.length, index + String(raw || '').length + 24);
    const context = sourceText.slice(start, end).toLowerCase();
    const before = sourceText.slice(start, index).toLowerCase();
    return /(?:购买量|销量|卖出|售出|bought|sold|超过|over|立减)\s*$/.test(before)
      || /(?:订单满|配送.*满|满)\s*$/.test(before)
      || /(?:bought|sold)\s+in\s+past/.test(context)
      || /(?:即可享受免费送货|免费送货|免运|free shipping)/.test(context)
      || /ratings?|reviews?/.test(context);
  };
  const rangeRe = /\$\s*([\d,]+(?:\.\d{1,2})?)\s*(?:-|–|—|to|~)\s*\$?\s*([\d,]+(?:\.\d{1,2})?)/gi;
  let match = null;
  while ((match = rangeRe.exec(sourceText)) !== null) {
    const low = parseNumber(match[1]);
    const high = parseNumber(match[2]);
    if (low != null && high != null) {
      candidates.push({
        type: 'range',
        source: 'symbol',
        raw: match[0],
        values: [round2(low), round2(high)],
        selected: selectRangeValue([round2(low), round2(high)], rangePolicy),
      });
    }
  }
  const localizedRangeRe = /(?<![\d.])([\d,]+(?:\.\d{1,2})?)\s*(?:美元|usd)\s*(?:-|–|—|to|~)\s*([\d,]+(?:\.\d{1,2})?)\s*(?:美元|usd)?/gi;
  while ((match = localizedRangeRe.exec(sourceText)) !== null) {
    if (nonPriceContext(match.index, match[0])) continue;
    const low = parseNumber(match[1]);
    const high = parseNumber(match[2]);
    if (low != null && high != null) {
      candidates.push({
        type: 'range',
        source: 'localized',
        raw: match[0],
        values: [round2(low), round2(high)],
        selected: selectRangeValue([round2(low), round2(high)], rangePolicy),
      });
    }
  }
  const priceRe = /\$\s*([\d,]+(?:\.\d{1,2})?)/g;
  while ((match = priceRe.exec(sourceText)) !== null) {
    const price = parseNumber(match[1]);
    if (price != null) {
      candidates.push({
        type: 'single',
        source: 'symbol',
        raw: match[0],
        values: [round2(price)],
        selected: round2(price),
      });
    }
  }
  const localizedPriceRe = /(?<![\d.])([\d,]+(?:\.\d{1,2})?)\s*(?:美元|usd)/gi;
  while ((match = localizedPriceRe.exec(sourceText)) !== null) {
    if (nonPriceContext(match.index, match[0])) continue;
    const price = parseNumber(match[1]);
    if (price != null) {
      candidates.push({
        type: 'single',
        source: 'localized',
        raw: match[0],
        values: [round2(price)],
        selected: round2(price),
      });
    }
  }
  const splitLocalizedPriceRe = /(?<![\d.])(\d{1,5})\s*美元\s*(?:[。.]|\s)\s*(\d{2})(?!\d)/g;
  while ((match = splitLocalizedPriceRe.exec(sourceText)) !== null) {
    if (nonPriceContext(match.index, match[0])) continue;
    const price = parseNumber(`${match[1]}.${match[2]}`);
    if (price != null) {
      candidates.push({
        type: 'single',
        source: 'localized',
        raw: match[0],
        values: [round2(price)],
        selected: round2(price),
      });
    }
  }
  const usable = candidates.filter((item) => {
    if (item.type === 'range') return item.values.some((value) => value > 0 && value < 100000);
    return item.selected > 0 && item.selected < 100000;
  });
  const rangeCandidates = usable.filter((item) => item.type === 'range');
  const supportedRangePolicies = ['highest_displayed_value', 'lowest_displayed_value'];
  if (rangeCandidates.length && !supportedRangePolicies.includes(rangePolicy)) {
    return {
      ok: false,
      amazonDisplayedPriceUsd: null,
      reason: 'price_range_policy_invalid',
      candidates: usable,
      rule: `range_policy_invalid:${rangePolicy}`,
      sourceText: sourceText.slice(0, 1200),
    };
  }
  const source = rangeCandidates.length ? rangeCandidates : usable;
  const selectedValues = source.map((item) => item.selected).filter((value) => value > 0 && value < 100000);
  const selected = selectedValues.length ? round2(Math.max(...selectedValues)) : null;
  return {
    ok: selected != null,
    amazonDisplayedPriceUsd: selected,
    reason: selected == null ? 'amazon_displayed_price_missing' : '',
    candidates: usable,
    rule: rangeCandidates.length ? `range_${rangePolicy}` : 'single_displayed_price',
    sourceText: sourceText.slice(0, 1200),
  };
}

function readParseText(args) {
  if (args.text) return args.text;
  if (args.file) return fs.readFileSync(args.file, 'utf8');
  throw new Error('parse-text requires --text or --file');
}

function buildRecord(args, capture) {
  const parsed = capture.price || capture;
  const record = validateRecord({
    asin: args.asin || capture.asin,
    amazonDisplayedPriceUsd: parsed.amazonDisplayedPriceUsd,
    currency: 'USD',
    source: 'amazon_product_page',
    status: parsed.ok ? 'trusted' : 'missing',
    reason: parsed.reason || '',
    amazonUrl: capture.url || args.url || (args.asin ? amazonUrlForAsin(args.asin) : ''),
    evidenceUrl: capture.href || capture.url || args.url || '',
    title: capture.title || '',
    priceRange: { min: args.minPrice, max: args.maxPrice },
    capture: {
      rule: parsed.rule || '',
      selectedSelector: capture.selectedSelector || '',
      capturedAt: new Date().toISOString(),
    },
  });
  return record;
}

async function ensureAmazonPage(args) {
  const url = args.url || amazonUrlForAsin(args.asin);
  const opened = await postWebBridge(args, 'navigate', {
    url,
    newTab: args.newTab !== false,
    group_title: 'Amazon价格采集',
  });
  const error = getToolError(opened);
  if (opened.error || error) {
    return { ok: false, status: opened.error || error, message: opened.message || '', raw: opened.data || null };
  }
  return {
    ok: true,
    url,
    page: opened.data && opened.data.data ? opened.data.data : opened.data,
  };
}

function reasonFromCapture(capture) {
  if (!capture || typeof capture !== 'object') return 'amazon_price_capture_failed';
  if (capture.price && capture.price.reason) return capture.price.reason;
  if (capture.stage === 'open_amazon_page') {
    const status = capture.page && capture.page.status ? capture.page.status : '';
    return status || 'amazon_price_capture_failed';
  }
  if (capture.status) return capture.status;
  if (capture.captcha) return 'amazon_page_captcha_or_robot_check';
  if (capture.unavailable) return 'amazon_product_unavailable_no_displayed_price';
  return 'amazon_displayed_price_missing';
}

function buildExceptionItem(args, capture) {
  const reason = reasonFromCapture(capture);
  return {
    asin: args.asin || capture.asin || '',
    productId: args.asin || capture.asin ? '' : compactText(args.url || capture.url || capture.href || 'amazon_price_capture'),
    stage: 'amazon_price_capture',
    reason,
    source: 'amazon_displayed_price_capture',
    details: {
      url: capture.url || args.url || (args.asin ? amazonUrlForAsin(args.asin) : ''),
      href: capture.href || '',
      title: capture.title || '',
      selectedSelector: capture.selectedSelector || '',
      captcha: Boolean(capture.captcha),
      unavailable: Boolean(capture.unavailable),
      selectedText: compactText(capture.selectedText || '').slice(0, 500),
      stage: capture.stage || '',
      status: capture.status || (capture.page && capture.page.status) || '',
    },
  };
}

function writeExceptionIfRequested(args, capture) {
  if (!capture || capture.ok) return { dryRun: !args.writeExceptions, rows: [] };
  const item = buildExceptionItem(args, capture);
  if (!args.writeExceptions) {
    return {
      dryRun: true,
      rows: [{ item }],
    };
  }
  return {
    dryRun: false,
    rows: [upsertException(item, args.queuePath)],
  };
}

async function captureFromPage(args) {
  const page = await ensureAmazonPage(args);
  if (!page.ok) return { ok: false, stage: 'open_amazon_page', page };
  const code = `(async () => {
    const selectors = ${JSON.stringify(PRICE_SELECTORS)};
    const maxWaitMs = ${JSON.stringify(args.pageWaitMs)};
    const norm = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const visible = (el) => {
      if (!el) return false;
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
    };
    const extractFromNode = (selector) => {
      const root = document.querySelector(selector);
      if (!root || !visible(root)) return null;
      const texts = [];
      root.querySelectorAll('.a-price .a-offscreen,.a-price-whole,#priceblock_ourprice,#priceblock_dealprice,#priceblock_saleprice,#price_inside_buybox,#newBuyBoxPrice,.a-color-price').forEach((node) => {
        const text = norm(node.textContent || node.getAttribute('aria-label') || '');
        if (text) texts.push(text);
      });
      const rootText = norm(root.innerText || root.textContent || '');
      if (rootText) texts.push(rootText);
      const text = Array.from(new Set(texts)).join(' | ');
      return text ? { selector, text } : null;
    };
    const hasPrice = (text) => /\\$\\s*\\d/.test(text || '');
    const deadline = Date.now() + Math.max(0, Number(maxWaitMs) || 0);
    let selected = null;
    while (Date.now() < deadline && !selected) {
      for (const selector of selectors) {
        const hit = extractFromNode(selector);
        if (hit && hasPrice(hit.text)) {
          selected = hit;
          break;
        }
      }
      if (!selected) await sleep(500);
    }
    const fallbackText = norm(document.body && document.body.innerText);
    const captcha = /captcha|enter the characters|robot check|sorry, we just need to make sure/i.test(fallbackText);
    const unavailable = /currently unavailable|temporarily out of stock|see all buying options/i.test(fallbackText);
    const bodyText = fallbackText.slice(0, 2500);
    return JSON.stringify({
      href: location.href,
      title: document.title,
      readyState: document.readyState,
      selectedSelector: selected ? selected.selector : '',
      selectedText: selected ? selected.text.slice(0, 2500) : '',
      bodyText,
      captcha,
      unavailable,
      hasPrice: Boolean(selected && hasPrice(selected.text))
    });
  })()`;
  const response = await postWebBridge(args, 'evaluate', { code });
  const error = getToolError(response);
  if (response.error || error) return { ok: false, stage: 'evaluate_amazon_page', status: response.error || error, raw: response.data || null };
  let browser = null;
  try {
    browser = JSON.parse(extractWebBridgeValue(response) || '{}');
  } catch (parseError) {
    return { ok: false, stage: 'parse_amazon_capture', error: String(parseError), raw: response.data || null };
  }
  const price = parseDisplayedPrice(browser.selectedText || browser.bodyText || '', { rangePolicy: args.rangePolicy });
  const reason = !price.ok
    ? browser.captcha
      ? 'amazon_page_captcha_or_robot_check'
      : browser.unavailable
        ? 'amazon_product_unavailable_no_displayed_price'
        : 'amazon_displayed_price_missing'
    : '';
  return {
    ok: price.ok,
    asin: args.asin || '',
    url: page.url,
    href: browser.href || '',
    title: browser.title || '',
    selectedSelector: browser.selectedSelector || '',
    selectedText: browser.selectedText || '',
    captcha: Boolean(browser.captcha),
    unavailable: Boolean(browser.unavailable),
    price: {
      ...price,
      reason,
    },
    page,
  };
}

async function runCapture(args) {
  if (!args.asin && !args.url) throw new Error('capture requires --asin or --url');
  if (!args.asin && args.url) {
    const match = String(args.url).match(/\/dp\/(B0[A-Z0-9]{8})|\/gp\/product\/(B0[A-Z0-9]{8})/i);
    if (match) args.asin = normalizeAsin(match[1] || match[2]);
  }
  const capture = await captureFromPage(args);
  const result = {
    ok: Boolean(capture.ok),
    dryRun: !args.write,
    capture,
    record: null,
    written: null,
    exceptionWrites: writeExceptionIfRequested(args, capture),
  };
  if (capture.ok && args.asin) {
    result.record = buildRecord(args, capture);
    if (args.write) result.written = upsertPrice(result.record, args.storePath);
  }
  return result;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.command === 'help') {
    output(usage());
    return;
  }
  if (args.command === 'parse-text') {
    output({ ok: true, price: parseDisplayedPrice(readParseText(args), { rangePolicy: args.rangePolicy }) });
    return;
  }
  if (args.command === 'capture') {
    output(await runCapture(args));
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
  parseDisplayedPrice,
  runCapture,
};
