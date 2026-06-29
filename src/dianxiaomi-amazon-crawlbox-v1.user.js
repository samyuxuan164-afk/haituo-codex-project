// ==UserScript==
// @name         DXM Amazon Crawlbox V1
// @namespace    https://codex.local/dianxiaomi-automation-v1
// @version      0.1.27
// @description  Collect Amazon US candidate links, dedupe ASINs, and prepare batches for Dianxiaomi link collection.
// @author       Codex
// @match        https://www.amazon.com/*
// @match        https://amazon.com/*
// @match        https://*.dianxiaomi.com/*
// @match        http://*.dianxiaomi.com/*
// @match        https://dianxiaomi.com/*
// @match        http://dianxiaomi.com/*
// @run-at       document-start
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_download
// @grant        unsafeWindow
// ==/UserScript==

(function () {
  'use strict';

  const APP_NAME = 'DXM Amazon Crawlbox V1';
  const VERSION = '0.1.27';
  const PANEL_ID = 'dxm-amazon-crawlbox-v1-panel';
  const BATCH_KEY = 'dxm_amazon_crawlbox_batch_v1';
  const PUBLIC_BATCH_KEY = 'dxm_amazon_crawlbox_public_batch_v1';
  const DEDUP_KEY = 'dxm_amazon_crawlbox_dedup_v1';
  const LOG_KEY = 'dxm_amazon_crawlbox_log_v1';
  const PANEL_POS_KEY = 'dxm_amazon_crawlbox_panel_position_v2';
  const PANEL_COLLAPSED_KEY = 'dxm_amazon_crawlbox_panel_collapsed_v1';
  const COLLECTION_PROGRESS_KEY = 'dxm_amazon_crawlbox_collection_progress_v1';
  const PIPELINE_KEY = 'dxm_amazon_crawlbox_pipeline_v1';
  const AUTO_DXM_JOB_KEY = 'dxm_amazon_crawlbox_auto_dxm_job_v1';
  const AMAZON_FRESH_REOPEN_KEY = 'dxm_amazon_crawlbox_fresh_reopen_v1';
  const RUN_METRICS_KEY = 'dxm_amazon_crawlbox_run_metrics_v1';
  const WEBBRIDGE_PREFLIGHT_NODE_ID = 'dxm-webbridge-preflight-json';
  const DXM_COLLECTION_URL = 'https://www.dianxiaomi.com/web/productCrawl/dataAcquisition';
  const COLLECTION_STALE_MS = 30000;
  const TARGET_E2E_MS = 120000;
  const DANGEROUS_DXM_ACTION_TEXTS = [
    '采集并一键发布',
    '采集并自动认领',
    '批量认领',
    '一键发布',
    '发布',
  ];
  const SAFE_DXM_ACTION_TEXTS = [
    '开始采集',
    '本批批量认领',
  ];
  const DXM_PREFLIGHT_SELECTORS = {
    collectorInput: 'textarea[placeholder*="网址"], textarea[placeholder*="链接"], textarea, input[type="text"], [contenteditable="true"]',
    checkbox: 'input[type="checkbox"]',
    actionControl: 'button,a,span,[role="button"],input[type="button"],input[type="submit"]',
    collectionCounts: 'body',
  };
  const DEFAULT_CATEGORY_QUEUE = [
    'silicone sink strainer',
    'kitchen sink strainer',
    'sink drain strainer',
    'drawer organizer',
    'cabinet organizer',
    'storage bins',
  ].join('\n');
  const GENERIC_BRAND_VALUES = new Set([
    'generic',
    'unbranded',
    'unknown',
    'n/a',
    'na',
    'none',
    'no brand',
  ]);

  const DEFAULT_FILTERS = {
    categoryTerm: '',
    priceMin: '5',
    priceMax: '20',
    ratingMin: '4.2',
    reviewMin: '20',
    shippingMax: '0',
    maxDeliveryDays: '10',
    maxPages: '2',
    maxItems: '100',
    similarCategoryLimit: '15',
    requirePrimeOrFreeShipping: '1',
    requireLogoApproval: '1',
    autoExcludeTitleBrandRisk: '1',
    targetStoreName: '',
    categoryQueue: DEFAULT_CATEGORY_QUEUE,
    logoApprovedAsins: '',
    bannedTerms: [
      'clothing',
      'clothes',
      'shirt',
      'dress',
      'pants',
      'jacket',
      'hoodie',
      'socks',
      'underwear',
      'lingerie',
      'shoe',
      'baby',
      'infant',
      'newborn',
      'maternity',
      'food',
      'snack',
      'candy',
      'coffee',
      'tea',
      'drink',
      'liquid',
      'cream',
      'paste',
      'gel',
      'lotion',
      'soap',
      'shampoo',
      'detergent',
      'makeup',
      'cosmetic',
      'beauty',
      'skincare',
      'nail',
      'pet food',
      'dog food',
      'cat food',
      'pet medicine',
      'pet shampoo',
      'disney',
      'marvel',
      'pokemon',
      'anime',
      'cartoon',
      'star wars',
      'harry potter',
      'barbie',
      'hello kitty',
      'minecraft',
      'glass',
      'crystal',
      'ceramic',
      'fragile',
      'battery',
      'lithium',
      'charger',
      'power bank',
      'adapter',
      'plug',
      'socket',
      'outlet',
      'electric',
      'heater',
      'chemical',
      'fertilizer',
      'pesticide',
      'seed',
      'fuel',
      'solvent',
      'adhesive',
      'epoxy',
      'knife',
      'blade',
      'razor',
      'cutter',
      'weapon',
      'medical',
      'medicine',
      'drug',
      'supplement',
      'vitamin',
      'treatment',
      'weight loss',
      'adult',
      'sexy',
      'condom',
      'logo',
      'trademark',
      'branded',
      'officially licensed',
    ].join('\n'),
  };

  const MONTH_INDEX = {
    jan: 0,
    feb: 1,
    mar: 2,
    apr: 3,
    may: 4,
    jun: 5,
    jul: 6,
    aug: 7,
    sep: 8,
    oct: 9,
    nov: 10,
    dec: 11,
  };

  const state = {
    batch: loadObject(BATCH_KEY, { id: '', createdAt: '', updatedAt: '', filters: DEFAULT_FILTERS, items: [] }),
    dedup: loadObject(DEDUP_KEY, {}),
    logs: loadArray(LOG_KEY),
  };

  function loadObject(key, fallback) {
    const value = GM_getValue(key, fallback);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : fallback;
  }

  function loadArray(key) {
    const value = GM_getValue(key, []);
    return Array.isArray(value) ? value : [];
  }

  function saveState() {
    GM_setValue(BATCH_KEY, state.batch);
    GM_setValue(DEDUP_KEY, state.dedup);
    GM_setValue(LOG_KEY, state.logs.slice(-500));
    try {
      localStorage.setItem(PUBLIC_BATCH_KEY, JSON.stringify({
        version: VERSION,
        updatedAt: nowIso(),
        batch: state.batch,
      }));
    } catch (_) {
      // Keep Tampermonkey storage as the source of truth if localStorage is full.
    }
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function addLog(action, detail = {}) {
    state.logs.push({ at: nowIso(), action, detail });
    saveState();
    updatePanel();
  }

  function getRunMetrics() {
    return loadObject(RUN_METRICS_KEY, {
      active: false,
      runId: '',
      label: '',
      target: 0,
      startedAtMs: 0,
      endedAtMs: 0,
      elapsedMs: 0,
      result: '',
      stages: [],
    });
  }

  function setRunMetrics(patch) {
    const next = {
      ...getRunMetrics(),
      ...patch,
      updatedAt: nowIso(),
      updatedAtMs: Date.now(),
    };
    GM_setValue(RUN_METRICS_KEY, next);
    return next;
  }

  function startRunMetrics(label, target = 0) {
    const startedAtMs = Date.now();
    return setRunMetrics({
      active: true,
      runId: `run-${startedAtMs}`,
      label,
      target: Number(target || 0),
      startedAtMs,
      endedAtMs: 0,
      elapsedMs: 0,
      result: '',
      stages: [{ atMs: startedAtMs, at: nowIso(), stage: label }],
    });
  }

  function addRunStage(stage, detail = {}) {
    const metrics = getRunMetrics();
    if (!metrics.active && !metrics.runId) return metrics;
    const nextStages = Array.isArray(metrics.stages) ? metrics.stages.slice(-30) : [];
    nextStages.push({ atMs: Date.now(), at: nowIso(), stage, detail });
    return setRunMetrics({ stages: nextStages });
  }

  function finishRunMetrics(result, extra = {}) {
    const metrics = getRunMetrics();
    if (!metrics.runId) return metrics;
    const endedAtMs = Date.now();
    return setRunMetrics({
      active: false,
      endedAtMs,
      elapsedMs: metrics.startedAtMs ? endedAtMs - metrics.startedAtMs : 0,
      result,
      withinTarget: metrics.startedAtMs ? endedAtMs - metrics.startedAtMs <= TARGET_E2E_MS : false,
      ...extra,
    });
  }

  function isAmazonPage() {
    return /(^|\.)amazon\.com$/i.test(location.hostname);
  }

  function isDxmPage() {
    return /(^|\.)dianxiaomi\.com$/i.test(location.hostname);
  }

  function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function parseNumber(value) {
    const match = String(value || '').replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : null;
  }

  function extractAsin(text) {
    const value = String(text || '');
    const patterns = [
      /\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?:[/?#]|$)/i,
      /(?:^|[^A-Z0-9])([A-Z0-9]{10})(?:[^A-Z0-9]|$)/i,
    ];
    for (const pattern of patterns) {
      const match = value.match(pattern);
      if (match) return match[1].toUpperCase();
    }
    return '';
  }

  function canonicalAmazonUrl(asin) {
    return `https://www.amazon.com/dp/${asin}`;
  }

  function normalizeDuplicateText(value) {
    return normalizeText(value)
      .toLowerCase()
      .replace(/[™®©]/g, '')
      .replace(/\b(?:amazon|prime|new|sale|deal|official|store|brand|trademark)\b/g, ' ')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function duplicateVariantSignature(title) {
    const normalized = normalizeDuplicateText(title);
    if (!normalized) return '';
    return normalized
      .replace(/\b(?:for|with|and|the|a|an|of|to|in|on|by)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 180);
  }

  function duplicateKeysForItem(item) {
    const keys = [];
    const asin = extractAsin(`${item && item.asin || ''} ${item && item.url || ''} ${item && item.rawUrl || ''}`);
    const signature = duplicateVariantSignature(item && item.title);
    if (asin) keys.push(`asin:${asin}`);
    if (asin) keys.push(`url:${canonicalAmazonUrl(asin).toLowerCase()}`);
    if (signature) keys.push(`variant:${signature}`);
    return Array.from(new Set(keys));
  }

  function findKnownDuplicate(item) {
    const keys = duplicateKeysForItem(item);
    for (const key of keys) {
      if (state.dedup[key]) return { key, record: state.dedup[key] };
    }
    const batchDuplicate = (state.batch.items || []).find((entry) => {
      if (!entry || entry === item) return false;
      const existingKeys = new Set(duplicateKeysForItem(entry));
      return keys.some((key) => existingKeys.has(key));
    });
    if (batchDuplicate) return { key: duplicateKeysForItem(batchDuplicate)[0] || 'batch', record: batchDuplicate };
    return null;
  }

  function rememberDedupItem(item, status, extra = {}) {
    const record = {
      status,
      batchId: state.batch.id,
      url: item.url,
      title: item.title,
      categoryTerm: item.categoryTerm,
      price: item.price,
      logoCheck: item.logoCheck,
      duplicateKeys: duplicateKeysForItem(item),
      updatedAt: nowIso(),
      ...extra,
    };
    for (const key of record.duplicateKeys) state.dedup[key] = record;
    if (item.asin) state.dedup[item.asin] = record;
  }

  function textFrom(root, selectors) {
    for (const selector of selectors) {
      const node = root.querySelector(selector);
      const text = normalizeText(node && node.textContent);
      if (text) return text;
    }
    return '';
  }

  function attrFrom(root, selectors, attr) {
    for (const selector of selectors) {
      const node = root.querySelector(selector);
      const value = node && node.getAttribute(attr);
      if (value) return value;
    }
    return '';
  }

  function getCurrentSearchPage() {
    const page = parseNumber(new URLSearchParams(location.search).get('page'));
    return page || 1;
  }

  function parseTermList(value) {
    return String(value || '')
      .split(/[\n,，;；]+/)
      .map((item) => normalizeText(item).toLowerCase())
      .filter(Boolean);
  }

  function parseAsinList(value) {
    const result = new Set();
    String(value || '')
      .split(/[\s,，;；]+/)
      .map((item) => extractAsin(item))
      .filter(Boolean)
      .forEach((asin) => result.add(asin));
    return result;
  }

  function parseCategoryQueue(value) {
    return String(value || '')
      .split(/[\n,，;；]+/)
      .map((item) => normalizeText(item))
      .filter(Boolean);
  }

  function configuredPositiveNumber(value, defaultValue) {
    const parsed = parseNumber(value);
    if (parsed != null && parsed > 0) return parsed;
    return parseNumber(defaultValue);
  }

  function normalizeCategory(value) {
    return normalizeText(value).toLowerCase();
  }

  function getCategoryDedupCount(categoryTerm) {
    const category = normalizeCategory(categoryTerm);
    if (!category) return 0;
    return Object.values(state.dedup || {}).filter((item) => {
      if (!item || normalizeCategory(item.categoryTerm) !== category) return false;
      return ['imported', 'claimed', 'published', 'collected'].includes(String(item.status || ''));
    }).length;
  }

  function productRiskReasons(text, filters) {
    const reasons = [];
    const haystack = normalizeText(text).toLowerCase();
    for (const term of parseTermList(filters.bannedTerms)) {
      if (haystack.includes(term)) reasons.push(`banned_term:${term}`);
    }
    return reasons;
  }

  function normalizeBrandValue(value) {
    return normalizeText(value)
      .replace(/^[：:：\s]+/, '')
      .replace(/[|,，;；].*$/, '')
      .trim();
  }

  function isGenericBrandValue(value) {
    const normalized = normalizeBrandValue(value).toLowerCase();
    return !normalized || GENERIC_BRAND_VALUES.has(normalized);
  }

  function brandFieldRiskReasons(text) {
    const haystack = normalizeText(text);
    const reasons = [];
    const patterns = [
      { name: 'brand_name', re: /\bBrand\s*Name\s*[:：]\s*([^|;,，；\n\r]+)/i },
      { name: 'brand', re: /\bBrand\s*[:：]\s*([^|;,，；\n\r]+)/i },
      { name: 'manufacturer', re: /\bManufacturer\s*[:：]\s*([^|;,，；\n\r]+)/i },
      { name: 'trademark', re: /\bTrademark\s*[:：]?\s*([^|;,，；\n\r]*)/i },
    ];
    for (const item of patterns) {
      const match = haystack.match(item.re);
      if (!match) continue;
      const value = normalizeBrandValue(match[1] || item.name);
      if (!isGenericBrandValue(value)) reasons.push(`${item.name}:${value || 'present'}`);
    }
    if (/\b(logo|trademark|branded|officially licensed)\b/i.test(haystack)) reasons.push('logo_or_trademark_text');
    return Array.from(new Set(reasons));
  }

  function automaticLogoRiskReasons(title, cardText, imageAlt = '') {
    const haystack = `${title || ''} ${cardText || ''} ${imageAlt || ''}`;
    return brandFieldRiskReasons(haystack);
  }

  function isPrimeOrFreeShipping(cardText) {
    return /\bprime\b/i.test(cardText) || /free delivery|free shipping|ships from amazon|fulfilled by amazon/i.test(cardText);
  }

  function extractShippingCost(cardText) {
    if (/free delivery|free shipping|prime/i.test(cardText)) return 0;
    const match = cardText.match(/\$([0-9]+(?:\.[0-9]+)?)\s+(?:delivery|shipping)/i);
    return match ? Number(match[1]) : null;
  }

  function extractDeliveryDays(cardText) {
    if (/arrives today|delivery today|today/i.test(cardText)) return 0;
    if (/arrives tomorrow|delivery tomorrow|tomorrow/i.test(cardText)) return 1;
    const match = cardText.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+([0-9]{1,2})\b/i);
    if (!match) return null;
    const now = new Date();
    const month = MONTH_INDEX[match[1].slice(0, 3).toLowerCase()];
    const day = Number(match[2]);
    if (month == null || !day) return null;
    let target = new Date(now.getFullYear(), month, day);
    if (target < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
      target = new Date(now.getFullYear() + 1, month, day);
    }
    return Math.ceil((target - now) / 86400000);
  }

  function parseDimensionInches(text) {
    const source = normalizeText(text);
    const match = source.match(/(?:Product|Item|Package)?\s*Dimensions[^0-9]{0,30}([0-9.]+)\s*[x×]\s*([0-9.]+)\s*[x×]\s*([0-9.]+)\s*(?:inches|inch|in\b|")/i)
      || source.match(/\b([0-9.]+)\s*[x×]\s*([0-9.]+)\s*[x×]\s*([0-9.]+)\s*(?:inches|inch|in\b|")/i);
    if (!match) return null;
    return {
      length: Number(match[1]),
      width: Number(match[2]),
      height: Number(match[3]),
    };
  }

  function parseWeightKg(text) {
    const source = normalizeText(text);
    const match = source.match(/(?:Item|Package)?\s*Weight[^0-9]{0,30}([0-9.]+)\s*(pounds|pound|lbs|lb|ounces|ounce|oz|kilograms|kilogram|kg|g|grams)/i)
      || source.match(/\b([0-9.]+)\s*(pounds|pound|lbs|lb|ounces|ounce|oz|kilograms|kilogram|kg|g|grams)\b/i);
    if (!match) return null;
    const value = Number(match[1]);
    const unit = String(match[2] || '').toLowerCase();
    if (!Number.isFinite(value)) return null;
    if (['pounds', 'pound', 'lbs', 'lb'].includes(unit)) return Math.round(value * 0.453592 * 1000) / 1000;
    if (['ounces', 'ounce', 'oz'].includes(unit)) return Math.round(value * 0.0283495 * 1000) / 1000;
    if (['g', 'grams'].includes(unit)) return Math.round((value / 1000) * 1000) / 1000;
    return Math.round(value * 1000) / 1000;
  }

  function inchesToCmDimensions(dimensionsIn) {
    if (!dimensionsIn) return null;
    return {
      length: Math.round(Number(dimensionsIn.length) * 2.54 * 100) / 100,
      width: Math.round(Number(dimensionsIn.width) * 2.54 * 100) / 100,
      height: Math.round(Number(dimensionsIn.height) * 2.54 * 100) / 100,
    };
  }

  function collectAmazonItems(filters) {
    return collectAmazonItemsFromRoot(document, filters, {
      page: getCurrentSearchPage(),
      sourcePage: location.href,
      categoryTerm: normalizeText(filters.categoryTerm || document.querySelector('#twotabsearchtextbox')?.value || document.title),
      maxItems: configuredPositiveNumber(filters.maxItems, DEFAULT_FILTERS.maxItems),
    });
  }

  function collectAmazonItemsFromRoot(root, filters, options = {}) {
    const cards = Array.from(root.querySelectorAll('[data-asin]'));
    const items = [];
    const seen = new Set();
    const priceMin = parseNumber(filters.priceMin);
    const priceMax = parseNumber(filters.priceMax);
    const ratingMin = parseNumber(filters.ratingMin);
    const reviewMin = parseNumber(filters.reviewMin);
    const shippingMax = parseNumber(filters.shippingMax);
    const maxDeliveryDays = parseNumber(filters.maxDeliveryDays);
    const maxPages = configuredPositiveNumber(filters.maxPages, DEFAULT_FILTERS.maxPages);
    const maxItems = configuredPositiveNumber(filters.maxItems, DEFAULT_FILTERS.maxItems);
    const similarCategoryLimit = configuredPositiveNumber(filters.similarCategoryLimit, DEFAULT_FILTERS.similarCategoryLimit);
    const requirePrimeOrFreeShipping = String(filters.requirePrimeOrFreeShipping || '1') !== '0';
    const requireLogoApproval = String(filters.requireLogoApproval || '1') !== '0';
    const logoApprovedAsins = parseAsinList(filters.logoApprovedAsins);
    const categoryTerm = normalizeText(options.categoryTerm || filters.categoryTerm || root.querySelector('#twotabsearchtextbox')?.value || document.title);
    const currentPage = Number(options.page || getCurrentSearchPage());
    const existingCategoryCount = getCategoryDedupCount(categoryTerm);
    const maxItemsForRoot = Number(options.maxItems || maxItems);
    let acceptedInScan = 0;

    if (currentPage > maxPages) {
      addLog('skip_amazon_page_over_limit', { currentPage, maxPages });
      return [];
    }

    for (const card of cards) {
      const asin = extractAsin(card.getAttribute('data-asin') || '');
      if (!asin || seen.has(asin)) continue;
      seen.add(asin);

      const title = textFrom(card, ['h2 span', 'h2 a span', '.a-size-medium.a-color-base.a-text-normal', '.a-text-normal']);
      const href = attrFrom(card, ['a[href*="/dp/"]', 'a[href*="/gp/product/"]'], 'href');
      const price = parseNumber(textFrom(card, ['.a-price .a-offscreen', '.a-price-whole']));
      const rating = parseNumber(textFrom(card, ['.a-icon-alt']));
      const reviews = parseNumber(textFrom(card, ['a[href*="#customerReviews"] span', 'span[aria-label$="ratings"]']));
      const image = attrFrom(card, ['img.s-image', 'img'], 'src');
      const imageAlt = attrFrom(card, ['img.s-image', 'img'], 'alt');
      const cardText = normalizeText(card.textContent);
      const shippingCost = extractShippingCost(cardText);
      const deliveryDays = extractDeliveryDays(cardText);
      const primeOrFreeShipping = isPrimeOrFreeShipping(cardText);
      const candidateIdentity = {
        asin,
        title,
        url: canonicalAmazonUrl(asin),
        rawUrl: href ? new URL(href, location.origin).toString() : '',
      };
      const knownDuplicate = findKnownDuplicate(candidateIdentity);
      const filterReasons = [];

      if (priceMin != null && (price == null || price < priceMin)) filterReasons.push('price_below_range');
      if (priceMax != null && (price == null || price > priceMax)) filterReasons.push('price_above_range');
      if (ratingMin != null && (rating == null || rating < ratingMin)) filterReasons.push('rating_below_min');
      if (reviewMin != null && (reviews == null || reviews < reviewMin)) filterReasons.push('reviews_below_min');
      if (requirePrimeOrFreeShipping && !primeOrFreeShipping) filterReasons.push('not_prime_or_free_shipping');
      if (shippingMax != null && (shippingCost == null || shippingCost > shippingMax)) filterReasons.push('shipping_over_max_or_unknown');
      if (maxDeliveryDays != null && (deliveryDays == null || deliveryDays > maxDeliveryDays)) filterReasons.push('delivery_over_max_or_unknown');
      if (knownDuplicate) filterReasons.push(`dedup_exact:${knownDuplicate.key}:${knownDuplicate.record.status || 'seen'}`);
      filterReasons.push(...productRiskReasons(`${title} ${cardText}`, filters));
      const titleBrandRisk = inferTitleBrandRisk(title);
      if (String(filters.autoExcludeTitleBrandRisk || '1') !== '0' && titleBrandRisk) {
        filterReasons.push(`title_brand_risk:${titleBrandRisk}`);
      }
      for (const reason of automaticLogoRiskReasons(title, cardText, imageAlt)) {
        filterReasons.push(`auto_logo_brand_risk:${reason}`);
      }
      const logoApproved = logoApprovedAsins.has(asin);
      if (requireLogoApproval && !logoApproved) filterReasons.push('logo_review_required');
      if (existingCategoryCount + acceptedInScan >= similarCategoryLimit) filterReasons.push('similar_category_limit_reached');
      const status = filterReasons.length
        ? filterReasons.includes('logo_review_required') && filterReasons.length === 1
          ? 'needs_logo_review'
          : 'excluded'
        : 'candidate';
      if (status === 'candidate') acceptedInScan += 1;

      items.push({
        asin,
        title,
        url: canonicalAmazonUrl(asin),
        rawUrl: href ? new URL(href, location.origin).toString() : '',
        price,
        rating,
        reviews,
        shippingCost,
        deliveryDays,
        primeOrFreeShipping,
        image,
        categoryTerm,
        similarCategoryLimit,
        existingCategoryCount,
        searchPage: currentPage,
        sourcePage: options.sourcePage || location.href,
        logoCheck: logoApproved ? 'approved' : 'pending',
        manualChecks: logoApproved ? [] : ['main_image_packaging_product_logo_or_trademark'],
        status,
        filterReasons,
        duplicateKeys: duplicateKeysForItem(candidateIdentity),
        collectedAt: nowIso(),
      });
      if (items.filter((item) => item.status === 'candidate').length >= maxItemsForRoot) break;
    }
    return items;
  }

  function buildAmazonSearchPageUrl(page) {
    const url = new URL(location.href);
    url.searchParams.set('page', String(page));
    url.searchParams.set('ref', `sr_pg_${page}`);
    return url.toString();
  }

  function buildFreshAmazonPageUrl() {
    const url = new URL(location.href);
    url.searchParams.delete('page');
    url.searchParams.delete('ref');
    url.searchParams.set('dxmFresh', String(Date.now()));
    return url.toString();
  }

  function buildAmazonSearchUrlForTerm(term, filters = getFiltersFromPanel()) {
    const rawTerm = normalizeText(term);
    const url = /^https?:\/\//i.test(rawTerm) ? new URL(rawTerm) : new URL('https://www.amazon.com/s');
    if (!/^https?:\/\//i.test(rawTerm)) url.searchParams.set('k', rawTerm);
    const priceMin = parseNumber(filters.priceMin);
    const priceMax = parseNumber(filters.priceMax);
    if ((priceMin != null || priceMax != null) && /(^|\.)amazon\.com$/i.test(url.hostname) && url.pathname === '/s') {
      const minCents = Math.max(0, Math.round((priceMin || 0) * 100));
      const maxCents = Math.max(0, Math.round((priceMax || 999999) * 100));
      url.searchParams.set('rh', `p_36:${minCents}-${maxCents}`);
    }
    return url.toString();
  }

  function openNextCategoryFromQueue(reason = 'supplement') {
    const filters = { ...DEFAULT_FILTERS, ...(state.batch.filters || {}), ...getFiltersFromPanel() };
    if (!normalizeText(filters.categoryQueue)) filters.categoryQueue = DEFAULT_CATEGORY_QUEUE;
    const queue = parseCategoryQueue(filters.categoryQueue);
    const currentTerm = isAmazonPage()
      ? normalizeText(filters.categoryTerm || document.querySelector('#twotabsearchtextbox')?.value || location.href)
      : '';
    const nextTerm = queue.find((term) => normalizeText(term).toLowerCase() !== currentTerm.toLowerCase()) || queue[0];
    if (!nextTerm) {
      addLog('open_next_category_queue_empty', { reason });
      return false;
    }
    const url = buildAmazonSearchUrlForTerm(nextTerm, filters);
    addLog('open_next_category_from_queue', { reason, nextTerm, url });
    addRunStage('open_next_category_from_queue', { reason, nextTerm });
    window.open(url, '_blank', 'noopener');
    return true;
  }

  function openFreshAmazonPage(reason = 'manual') {
    if (!isAmazonPage()) return false;
    const url = buildFreshAmazonPageUrl();
    GM_setValue(AMAZON_FRESH_REOPEN_KEY, {
      reason,
      from: location.href,
      to: url,
      atMs: Date.now(),
      version: VERSION,
    });
    addLog('open_fresh_amazon_page', { reason, url });
    window.open(url, '_blank', 'noopener');
    return true;
  }

  function watchAmazonPageHealth() {
    if (!isAmazonPage()) return;
    setTimeout(() => {
      const bodyText = normalizeText(document.body && document.body.innerText);
      const hasSearchResults = Boolean(document.querySelector('[data-component-type="s-search-result"], [data-asin]'));
      const blocked = /captcha|unusual traffic|enter the characters|sorry/.test(bodyText.toLowerCase());
      if (!hasSearchResults && blocked) {
        openFreshAmazonPage('amazon_block_or_bad_page');
      }
    }, 12000);
  }

  async function fetchAmazonSearchDocument(page) {
    const url = buildAmazonSearchPageUrl(page);
    const response = await fetch(url, { credentials: 'include' });
    if (!response.ok) throw new Error(`Amazon page ${page} HTTP ${response.status}`);
    const html = await response.text();
    return {
      url,
      document: new DOMParser().parseFromString(html, 'text/html'),
    };
  }

  function parseAmazonDetailMetadata(documentRoot) {
    const selectors = [
      '#productDetails_techSpec_section_1',
      '#productDetails_detailBullets_sections1',
      '#detailBullets_feature_div',
      '#prodDetails',
      '#feature-bullets',
    ];
    const detailText = selectors
      .map((selector) => documentRoot.querySelector(selector))
      .filter(Boolean)
      .map((node) => normalizeText(node.innerText || node.textContent))
      .join(' | ');
    const dimensionsIn = parseDimensionInches(detailText);
    const weightKg = parseWeightKg(detailText);
    return {
      dimensionsIn,
      dimensionsCm: inchesToCmDimensions(dimensionsIn),
      weightKg,
      detailTextSample: detailText.slice(0, 1200),
    };
  }

  async function fetchAmazonDetailMetadata(item) {
    const response = await fetch(item.url, { credentials: 'include' });
    if (!response.ok) throw new Error(`Amazon detail ${item.asin} HTTP ${response.status}`);
    const html = await response.text();
    const documentRoot = new DOMParser().parseFromString(html, 'text/html');
    return parseAmazonDetailMetadata(documentRoot);
  }

  async function enrichCandidateDetails(limit) {
    const items = getCandidateItems()
      .filter((item) => item && item.asin && (!item.dimensionsCm || !item.weightKg))
      .slice(0, Math.max(0, Number(limit || 0)));
    if (!items.length) return { enriched: 0, failed: 0 };
    let enriched = 0;
    let failed = 0;
    for (let index = 0; index < items.length; index += 6) {
      const chunk = items.slice(index, index + 6);
      const results = await Promise.allSettled(chunk.map((item) => fetchAmazonDetailMetadata(item)));
      results.forEach((result, offset) => {
        const item = chunk[offset];
        if (result.status === 'fulfilled') {
          Object.assign(item, result.value, { detailEnrichedAt: nowIso() });
          enriched += 1;
        } else {
          item.detailEnrichError = String(result.reason && result.reason.message ? result.reason.message : result.reason);
          failed += 1;
        }
      });
      state.batch.updatedAt = nowIso();
      saveState();
    }
    addLog('amazon_detail_enrichment_done', { enriched, failed, requested: items.length });
    return { enriched, failed, requested: items.length };
  }

  async function fastCollectAmazonCategory(options = {}) {
    if (!isAmazonPage()) return;
    const startedAtMs = Date.now();
    const rawFilters = getFiltersFromPanel();
    const target = configuredPositiveNumber(rawFilters.maxItems, DEFAULT_FILTERS.maxItems);
    if (options.trackRun) startRunMetrics('amazon_fast_collect_to_dxm', target);
    addRunStage('amazon_fast_collect_start', { target });
    const filters = {
      ...rawFilters,
      similarCategoryLimit: String(configuredPositiveNumber(rawFilters.similarCategoryLimit, DEFAULT_FILTERS.similarCategoryLimit)),
    };
    const configuredMaxPages = configuredPositiveNumber(filters.maxPages, DEFAULT_FILTERS.maxPages);
    const maxPages = Math.max(configuredMaxPages, Math.ceil(target / 20));
    const categoryTerm = normalizeText(filters.categoryTerm || document.querySelector('#twotabsearchtextbox')?.value || document.title);
    const resetBatch = Boolean(options.resetBatch);
    if (resetBatch) {
      state.batch = {
        id: `amazon-batch-${Date.now()}`,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        version: VERSION,
        filters,
        items: [],
      };
      saveState();
    }
    const byAsin = new Map((resetBatch ? [] : (state.batch.items || [])).map((item) => [item.asin, item]));
    let fetchedPages = 0;
    let failedPages = 0;

    const mergeFastItems = (items) => {
      for (const item of items) {
        const existing = byAsin.get(item.asin);
        byAsin.set(item.asin, { ...existing, ...item });
      }
      state.batch = {
        id: state.batch.id || `amazon-batch-${Date.now()}`,
        createdAt: state.batch.createdAt || nowIso(),
        updatedAt: nowIso(),
        version: VERSION,
        filters,
        items: Array.from(byAsin.values()),
      };
      saveState();
    };

    mergeFastItems(collectAmazonItemsFromRoot(document, filters, {
      page: getCurrentSearchPage(),
      sourcePage: location.href,
      categoryTerm,
      maxItems: target,
    }));

    for (let page = 2; page <= maxPages && getCandidateItems().length < target; page += 4) {
      const pages = [];
      for (let offset = 0; offset < 4 && page + offset <= maxPages; offset += 1) {
        pages.push(page + offset);
      }
      const results = await Promise.allSettled(pages.map((itemPage) => fetchAmazonSearchDocument(itemPage)));
      for (let i = 0; i < results.length; i += 1) {
        const result = results[i];
        const itemPage = pages[i];
        if (result.status === 'fulfilled') {
          fetchedPages += 1;
          mergeFastItems(collectAmazonItemsFromRoot(result.value.document, filters, {
            page: itemPage,
            sourcePage: result.value.url,
            categoryTerm,
            maxItems: Math.max(1, target - getCandidateItems().length),
          }));
        } else {
          failedPages += 1;
          addLog('fast_collect_amazon_page_failed', { page: itemPage, error: String(result.reason && result.reason.message ? result.reason.message : result.reason) });
        }
        if (getCandidateItems().length >= target) break;
      }
      if (Date.now() - startedAtMs > 115000) break;
    }

    const detailResult = await enrichCandidateDetails(target);
    const elapsedMs = Date.now() - startedAtMs;
    addLog('fast_collect_amazon_category_done', {
      target,
      candidates: getCandidateItems().length,
      total: state.batch.items.length,
      fetchedPages,
      failedPages,
      detailResult,
      elapsedMs,
      elapsedSeconds: Math.round(elapsedMs / 1000),
      maxPages,
      configuredMaxPages,
    });
    addRunStage('amazon_fast_collect_done', {
      target,
      candidates: getCandidateItems().length,
      elapsedMs,
      maxPages,
      detailResult,
    });
    updatePanel();
    return {
      target,
      candidates: getCandidateItems().length,
      elapsedMs,
      elapsedSeconds: Math.round(elapsedMs / 1000),
      batchId: state.batch.id,
    };
  }

  async function fastCollectAndOpenDxm() {
    const result = await fastCollectAmazonCategory({ resetBatch: true, trackRun: true });
    if (!result || !result.candidates) {
      finishRunMetrics('amazon_no_candidates', { target: result && result.target, candidates: result && result.candidates });
      if (!openNextCategoryFromQueue('no_candidates_after_fast_collect')) {
        openFreshAmazonPage('no_candidates_after_fast_collect');
      }
      return;
    }
    GM_setValue(AUTO_DXM_JOB_KEY, {
      active: true,
      batchId: state.batch.id,
      target: result.target,
      candidates: result.candidates,
      startedAtMs: Date.now(),
      sourcePage: location.href,
      categoryTerm: state.batch.filters && state.batch.filters.categoryTerm,
    });
    addRunStage('open_dxm_collection_page', result);
    addLog('fast_collect_open_dxm', result);
    location.href = DXM_COLLECTION_URL;
  }

  function mergeBatchItems(items, filters) {
    const existing = new Map((state.batch.items || []).map((item) => [item.asin, item]));
    for (const item of items) {
      existing.set(item.asin, { ...existing.get(item.asin), ...item });
    }
    state.batch = {
      id: state.batch.id || `amazon-batch-${Date.now()}`,
      createdAt: state.batch.createdAt || nowIso(),
      updatedAt: nowIso(),
      version: VERSION,
      filters,
      items: Array.from(existing.values()),
    };
    saveState();
  }

  function getCandidateItems() {
    return (state.batch.items || []).filter((item) => item.status === 'candidate');
  }

  function getCandidateLinks() {
    return getCandidateItems().map((item) => item.url).join('\n');
  }

  function markItems(currentStatus, nextStatus) {
    const items = (state.batch.items || []).filter((item) => item.status === currentStatus);
    for (const item of items) {
      item.status = nextStatus;
      rememberDedupItem(item, nextStatus);
    }
    state.batch.updatedAt = nowIso();
    addLog(`mark_${nextStatus}`, { count: items.length });
    saveState();
  }

  function markBatchAsinExcluded(asin, reasons = []) {
    const normalizedAsin = extractAsin(asin);
    if (!normalizedAsin) return;
    const item = (state.batch.items || []).find((entry) => entry.asin === normalizedAsin);
    if (item) {
      item.status = 'excluded';
      item.filterReasons = Array.from(new Set([...(item.filterReasons || []), ...reasons]));
      item.updatedAt = nowIso();
      rememberDedupItem(item, 'excluded', {
        logoCheck: 'auto_rejected_after_dxm_collect',
        filterReasons: item.filterReasons,
      });
      state.batch.updatedAt = nowIso();
      saveState();
    }
  }

  function summarizeBatch() {
    const summary = { total: 0, candidate: 0, needs_logo_review: 0, excluded: 0, imported: 0, claimed: 0 };
    const reasonCounts = {};
    for (const item of state.batch.items || []) {
      summary.total += 1;
      if (summary[item.status] == null) summary[item.status] = 0;
      summary[item.status] += 1;
      for (const reason of item.filterReasons || []) {
        reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
      }
    }
    summary.reasonCounts = reasonCounts;
    summary.target = parseNumber(state.batch.filters && state.batch.filters.maxItems) || 0;
    summary.readyLinks = summary.candidate;
    summary.remainingToTarget = Math.max(0, summary.target - summary.candidate - summary.imported - summary.claimed);
    summary.remainingAfterClaimed = Math.max(0, summary.target - summary.imported - summary.claimed);
    summary.categoryQueueCount = parseCategoryQueue(state.batch.filters && state.batch.filters.categoryQueue).length;
    return summary;
  }

  function downloadText(name, text, type = 'text/plain') {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    GM_download({ url, name, saveAs: false, onload: () => URL.revokeObjectURL(url), onerror: () => URL.revokeObjectURL(url) });
  }

  function exportBatch() {
    const report = {
      app: APP_NAME,
      version: VERSION,
      exportedAt: nowIso(),
      batch: state.batch,
      summary: summarizeBatch(),
      nextAction: buildNextAction(),
      runMetrics: getRunMetrics(),
      logs: state.logs,
    };
    downloadText(`${state.batch.id || 'amazon-batch'}-report.json`, JSON.stringify(report, null, 2), 'application/json');
  }

  function exportRunMetrics() {
    downloadText(`dxm-run-metrics-${Date.now()}.json`, JSON.stringify(getRunMetrics(), null, 2), 'application/json');
  }

  function copyLinks() {
    const text = getCandidateLinks();
    if (!text) {
      addLog('copy_links_empty');
      return;
    }
    navigator.clipboard.writeText(text).then(
      () => addLog('copy_links', { count: getCandidateItems().length }),
      (error) => addLog('copy_links_failed', { error: String(error && error.message ? error.message : error) })
    );
  }

  function buildNextAction() {
    const summary = summarizeBatch();
    if (summary.needs_logo_review > 0) {
      return 'review_main_images_and_add_logo_free_asins_before_export';
    }
    if (summary.candidate === 0) {
      return 'scan_next_category_or_relax_filters';
    }
    if (summary.remainingToTarget > 0) {
      return summary.categoryQueueCount > 0
        ? 'open_next_category_from_queue_and_supplement_remaining_count'
        : 'collect_candidates_then_supplement_remaining_count';
    }
    return 'fill_dianxiaomi_link_collection';
  }

  function inferTitleBrandRisk(title) {
    const first = normalizeText(title).split(/\s+/)[0] || '';
    if (!first) return '';
    const generic = new Set([
      'adjustable',
      'black',
      'cable',
      'clear',
      'desk',
      'drawer',
      'grey',
      'gray',
      'large',
      'metal',
      'mini',
      'pack',
      'plastic',
      'round',
      'set',
      'shelf',
      'small',
      'storage',
      'tray',
      'under',
      'white',
    ]);
    if (generic.has(first.toLowerCase())) return '';
    if (/^[A-Z0-9]{3,}$/.test(first) || /^[A-Z][a-z]+$/.test(first)) return first;
    return '';
  }

  function buildLogoReviewHtml() {
    const items = (state.batch.items || []).filter((item) => item.status === 'needs_logo_review');
    const cards = items.map((item) => {
      const brandRisk = inferTitleBrandRisk(item.title);
      return `
        <article class="card">
          <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.asin)}">
          <div class="asin">${escapeHtml(item.asin)}</div>
          <div class="meta">价格 ${escapeHtml(item.price)} / 评分 ${escapeHtml(item.rating)} / 评论 ${escapeHtml(item.reviews)}</div>
          ${brandRisk ? `<div class="risk">标题疑似品牌：${escapeHtml(brandRisk)}</div>` : ''}
          <p>${escapeHtml(item.title)}</p>
        </article>
      `;
    }).join('\n');
    return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <title>Logo复核 ${escapeHtml(state.batch.id || '')}</title>
  <style>
    body{font:13px/1.45 Arial,"Microsoft YaHei",sans-serif;margin:18px;color:#111827;background:#f8fafc}
    .top{position:sticky;top:0;background:#f8fafc;padding:0 0 12px;border-bottom:1px solid #e5e7eb;margin-bottom:14px}
    .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:12px}
    .card{background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:10px}
    img{width:100%;height:170px;object-fit:contain;background:#fff}
    .asin{font-weight:700;margin-top:8px}
    .meta{color:#4b5563;font-size:12px}
    .risk{color:#b91c1c;background:#fef2f2;border:1px solid #fecaca;border-radius:5px;padding:4px 6px;margin-top:6px}
    p{margin:7px 0 0}
  </style>
</head>
<body>
  <div class="top">
    <h2>Logo复核：${items.length} 个待确认</h2>
    <p>只放行主图、包装、产品本体无 Logo / 商标的商品。通过后把 ASIN 填回插件“无 Logo ASIN”。标题疑似品牌不是最终判断，但优先复查。</p>
  </div>
  <section class="grid">${cards}</section>
</body>
</html>`;
  }

  function exportLogoReviewHtml() {
    const count = (state.batch.items || []).filter((item) => item.status === 'needs_logo_review').length;
    downloadText(`${state.batch.id || 'amazon-batch'}-logo-review.html`, buildLogoReviewHtml(), 'text/html');
    addLog('export_logo_review_html', { count });
  }

  function visibleElement(element) {
    if (!element) return false;
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
  }

  function setNativeValue(element, value) {
    const proto = Object.getPrototypeOf(element);
    const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
    if (descriptor && descriptor.set) descriptor.set.call(element, value);
    else element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function getDxmCollectorInput() {
    const all = Array.from(document.querySelectorAll(DXM_PREFLIGHT_SELECTORS.collectorInput))
      .filter((node) => !isInPluginPanel(node))
      .filter(visibleElement);
    const scored = all
      .map((node) => {
        const text = normalizeText([
          node.placeholder,
          node.getAttribute('aria-label'),
          node.getAttribute('title'),
          node.closest('.modal,.ant-modal,.layui-layer,.el-dialog,[role="dialog"],.ant-modal-root,form,section,div') &&
            node.closest('.modal,.ant-modal,.layui-layer,.el-dialog,[role="dialog"],.ant-modal-root,form,section,div').innerText,
        ].join(' '));
        const rect = node.getBoundingClientRect();
        let score = rect.width * rect.height;
        if (node.tagName === 'TEXTAREA') score += 100000;
        if (/网址|链接|URL|Amazon|产品的网址/i.test(text)) score += 500000;
        if (/链接采集|产品网址|采集链接/i.test(text)) score += 250000;
        if (/搜索|筛选|店铺|类目|库存|价格|SKU/i.test(text) && node.tagName !== 'TEXTAREA') score -= 200000;
        return { node, score };
      })
      .sort((a, b) => b.score - a.score);
    return scored[0] ? scored[0].node : null;
  }

  function getElementTextValue(element) {
    if (!element) return '';
    if (element.isContentEditable) return element.textContent || '';
    return element.value || element.getAttribute('value') || '';
  }

  function parseAmazonLinksFromText(text) {
    const seen = new Set();
    return String(text || '')
      .split(/\s+/)
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const asin = extractAsin(part);
        return asin ? { asin, url: canonicalAmazonUrl(asin), rawUrl: part } : null;
      })
      .filter(Boolean)
      .filter((item) => {
        if (seen.has(item.asin)) return false;
        seen.add(item.asin);
        return true;
      });
  }

  function countAmazonLinksInText(text) {
    return parseAmazonLinksFromText(text).length;
  }

  function createBatchFromDxmInput() {
    const input = getDxmCollectorInput();
    const links = parseAmazonLinksFromText(getElementTextValue(input));
    if (!links.length) return 0;
    const categoryTerm = normalizeText(state.batch.filters && state.batch.filters.categoryTerm) || 'manual-dxm-links';
    state.batch = {
      id: `manual-dxm-${Date.now()}`,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      version: VERSION,
      filters: { ...DEFAULT_FILTERS, ...(state.batch.filters || {}) },
      items: links.map((item) => ({
        asin: item.asin,
        title: '',
        url: item.url,
        rawUrl: item.rawUrl,
        price: null,
        rating: null,
        reviews: null,
        shippingCost: null,
        deliveryDays: null,
        primeOrFreeShipping: null,
        image: '',
        categoryTerm,
        similarCategoryLimit: configuredPositiveNumber(state.batch.filters && state.batch.filters.similarCategoryLimit, DEFAULT_FILTERS.similarCategoryLimit),
        existingCategoryCount: getCategoryDedupCount(categoryTerm),
        searchPage: null,
        sourcePage: location.href,
        logoCheck: 'manual_input',
        manualChecks: [],
        status: 'candidate',
        filterReasons: [],
        collectedAt: nowIso(),
      })),
    };
    addLog('create_batch_from_dxm_input', { count: links.length });
    saveState();
    return links.length;
  }

  function fillDxmCollector() {
    const links = getCandidateLinks();
    if (!links) {
      addLog('fill_dxm_empty');
      return false;
    }
    const target = getDxmCollectorInput();
    if (!target) {
      addLog('fill_dxm_no_input');
      alert('没有找到可填入链接的输入框。请进入店小秘“链接采集”页面后再点击。');
      return false;
    }
    if (target.isContentEditable) {
      target.textContent = links;
      target.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      setNativeValue(target, links);
    }
    target.focus();
    const expected = getCandidateItems().length;
    const actual = countAmazonLinksInText(getElementTextValue(target));
    const ok = actual === expected;
    addLog('fill_dxm_links', { count: expected, actual, ok, page: location.href });
    if (!ok) {
      alert(`采集框链接数量校验失败：应填 ${expected} 条，实际读取 ${actual} 条。已停止，避免只采到部分商品。`);
      return false;
    }
    return true;
  }

  function getDxmCollectionModalText() {
    const nodes = Array.from(document.querySelectorAll('.modal,.ant-modal,.layui-layer,.el-dialog,[role="dialog"],.ant-modal-root'));
    const texts = nodes
      .map((node) => normalizeText(node.innerText || node.textContent))
      .filter((text) => text && text.includes('链接采集'));
    return texts[0] || '';
  }

  function parseDxmCollectionProgress(text) {
    const statusMatch = text.match(/状态[:：]\s*([^详]+)/);
    const successMatch = text.match(/(?:成功采集|已成功采集|已成功执行)\s*(\d+)\s*条/);
    const failMatch = text.match(/(?:失败|失败:)\s*(\d+)/);
    return {
      visible: Boolean(text),
      rawText: text,
      status: normalizeText(statusMatch && statusMatch[1]),
      success: successMatch ? Number(successMatch[1]) : null,
      fail: failMatch ? Number(failMatch[1]) : null,
      completed: /已完成|完成/.test(text),
      running: /进行中/.test(text),
    };
  }

  function getDxmCollectionProgress() {
    const current = parseDxmCollectionProgress(getDxmCollectionModalText());
    const saved = loadObject(COLLECTION_PROGRESS_KEY, { lastText: '', lastChangedAt: 0, lastSeenAt: 0 });
    const now = Date.now();
    if (!current.visible) {
      return { ...current, stale: false, secondsSinceChange: 0 };
    }
    if (current.rawText !== saved.lastText) {
      const next = { lastText: current.rawText, lastChangedAt: now, lastSeenAt: now };
      GM_setValue(COLLECTION_PROGRESS_KEY, next);
      return { ...current, stale: false, secondsSinceChange: 0 };
    }
    GM_setValue(COLLECTION_PROGRESS_KEY, { ...saved, lastSeenAt: now });
    const secondsSinceChange = Math.floor((now - (saved.lastChangedAt || now)) / 1000);
    return {
      ...current,
      stale: current.running && secondsSinceChange >= Math.floor(COLLECTION_STALE_MS / 1000),
      secondsSinceChange,
    };
  }

  function closeVisibleDxmModal() {
    const buttons = Array.from(document.querySelectorAll('button,a,span,i'))
      .filter(visibleElement)
      .filter((node) => {
        const text = normalizeText(node.innerText || node.textContent || node.getAttribute('title') || node.getAttribute('aria-label'));
        const className = String(node.className || '');
        return text === '关闭' || text === '完成' || /close/i.test(className);
      });
    const button = buttons[buttons.length - 1];
    if (button) dispatchUserClick(button);
    addLog('close_dxm_modal', { found: Boolean(button) });
  }

  function refreshDxmForCollectionCheck() {
    addLog('refresh_after_collection_progress_check', getDxmCollectionProgress());
    location.reload();
  }

  function openSmtLocalCollectionBox() {
    const candidates = Array.from(document.querySelectorAll('a,button,span,div'))
      .filter(visibleElement)
      .map((node) => ({ node, text: normalizeText(node.innerText || node.textContent) }))
      .filter((item) => /^速卖通海外托管(?:\s*\(|数据|$)/.test(item.text) || item.text === '速卖通海外托管');
    const best = candidates.find((item) => /\(\d+\)/.test(item.text)) || candidates[0];
    if (best) {
      best.node.click();
      addLog('open_smtlocal_collection_box', { clickedText: best.text });
    } else {
      addLog('open_smtlocal_collection_box_failed');
      alert('没有找到“速卖通海外托管”采集箱入口，请从左侧 产品 > 采集箱 > 速卖通海外托管 手动进入。');
    }
  }

  function summarizeDxmCollectionBox() {
    const bodyText = document.body ? document.body.innerText || '' : '';
    const countMatch = bodyText.match(/全部\((\d+)\)\s*未认领\((\d+)\)\s*已认领\((\d+)\)/);
    const rows = Array.from(document.querySelectorAll('tr,.vxe-body--row,.el-table__row'))
      .map((row) => normalizeText(row.innerText || row.textContent))
      .filter((text) => /亚马逊|ASIN|认领|编辑/.test(text))
      .slice(0, 10);
    const summary = {
      all: countMatch ? Number(countMatch[1]) : null,
      unclaimed: countMatch ? Number(countMatch[2]) : null,
      claimed: countMatch ? Number(countMatch[3]) : null,
      visibleRows: rows.length,
      rows,
    };
    addLog('verify_smtlocal_collection_box', summary);
    updatePanel();
    return summary;
  }

  function getDxmDataAcquisitionCounts() {
    const bodyText = document.body ? document.body.innerText || '' : '';
    const match = bodyText.match(/全部\((\d+)\)\s*未认领\((\d+)\)\s*已认领\((\d+)\)/);
    return {
      all: match ? Number(match[1]) : null,
      unclaimed: match ? Number(match[2]) : null,
      claimed: match ? Number(match[3]) : null,
    };
  }

  function getDxmVisibleControlText(node) {
    return normalizeText(node && (
      node.innerText ||
      node.textContent ||
      node.value ||
      node.placeholder ||
      node.getAttribute('title') ||
      node.getAttribute('aria-label')
    ));
  }

  function findDxmAutoClaimCheckbox() {
    const boxes = Array.from(document.querySelectorAll(DXM_PREFLIGHT_SELECTORS.checkbox));
    return boxes.find((box) => {
      const scope = box.closest('label') || box.parentElement || box;
      const text = normalizeText(scope && (scope.innerText || scope.textContent));
      return text.includes('自动认领');
    }) || null;
  }

  function findDxmDangerousControls() {
    return Array.from(document.querySelectorAll(DXM_PREFLIGHT_SELECTORS.actionControl))
      .filter((node) => !isInPluginPanel(node))
      .filter(visibleElement)
      .map((node) => ({
        node,
        text: getDxmVisibleControlText(node),
        tag: node.tagName,
        disabled: Boolean(node.disabled || node.getAttribute('aria-disabled') === 'true'),
      }))
      .filter((item) => DANGEROUS_DXM_ACTION_TEXTS.includes(item.text));
  }

  function getDxmWebBridgePreflight(targetButtonText = '') {
    const input = getDxmCollectorInput();
    const autoClaim = findDxmAutoClaimCheckbox();
    const counts = getDxmDataAcquisitionCounts();
    const dangerousControls = findDxmDangerousControls();
    const warnings = [];
    const blockReasons = [];
    const normalizedTarget = normalizeText(targetButtonText);

    if (!/\/web\/productCrawl\/dataAcquisition/i.test(location.pathname)) {
      blockReasons.push('not_dxm_data_acquisition_page');
    }
    if (autoClaim && autoClaim.checked) blockReasons.push('auto_claim_enabled');
    if (!input) blockReasons.push('collector_input_missing');
    if (dangerousControls.length) warnings.push('dangerous_dxm_controls_visible');
    const safeTarget = SAFE_DXM_ACTION_TEXTS.includes(normalizedTarget);
    if (DANGEROUS_DXM_ACTION_TEXTS.includes(normalizedTarget) && !safeTarget) {
      blockReasons.push(`dangerous_action_blocked:${normalizedTarget}`);
    }

    const blocked = blockReasons.length > 0;
    return {
      source: 'webbridge_dom_preflight',
      url: location.href,
      title: document.title,
      targetButtonText: normalizedTarget,
      isDataAcquisitionPage: /\/web\/productCrawl\/dataAcquisition/i.test(location.pathname),
      autoClaim: {
        found: Boolean(autoClaim),
        checked: autoClaim ? Boolean(autoClaim.checked) : null,
        closed: autoClaim ? !autoClaim.checked : null,
      },
      collectorInput: {
        found: Boolean(input),
        selector: DXM_PREFLIGHT_SELECTORS.collectorInput,
        currentLength: input ? String(getElementTextValue(input) || '').length : null,
        linkCount: input ? countAmazonLinksInText(getElementTextValue(input)) : null,
      },
      dangerousControls: dangerousControls.map((item) => ({
        text: item.text,
        tag: item.tag,
        disabled: item.disabled,
      })),
      collectionCounts: {
        readable: counts.all != null || counts.unclaimed != null || counts.claimed != null,
        ...counts,
      },
      selectors: DXM_PREFLIGHT_SELECTORS,
      dangerousTexts: DANGEROUS_DXM_ACTION_TEXTS.slice(),
      safeTargetTexts: SAFE_DXM_ACTION_TEXTS.slice(),
      warnings,
      warning: warnings,
      blockReason: blockReasons,
      blockReasons,
      blocked,
      allowed: !blocked,
      risks: blockReasons,
      okForCollection: !blocked,
      updatedAt: nowIso(),
    };
  }

  function exposeDxmWebBridgePreflight(targetButtonText = '') {
    const preflight = getDxmWebBridgePreflight(targetButtonText);
    const payload = JSON.stringify(preflight);
    window.__DXM_WEBBRIDGE_PREFLIGHT__ = preflight;
    try {
      if (typeof unsafeWindow !== 'undefined') {
        unsafeWindow.__DXM_WEBBRIDGE_PREFLIGHT__ = preflight;
      }
    } catch (_) {
      // Some userscript sandboxes may deny unsafeWindow writes.
    }
    try {
      let node = document.getElementById(WEBBRIDGE_PREFLIGHT_NODE_ID);
      if (!node) {
        node = document.createElement('script');
        node.id = WEBBRIDGE_PREFLIGHT_NODE_ID;
        node.type = 'application/json';
        node.setAttribute('data-purpose', 'dxm-webbridge-preflight');
        (document.head || document.documentElement).appendChild(node);
      }
      node.textContent = payload;
      node.setAttribute('data-status', preflight.allowed ? 'allowed' : 'blocked');
      node.setAttribute('data-updated-at', preflight.updatedAt);
    } catch (_) {
      // DOM fallback is best effort; data attributes below still expose status.
    }
    try {
      const script = document.createElement('script');
      script.textContent = [
        `window.__DXM_WEBBRIDGE_PREFLIGHT__ = ${payload};`,
        'window.dispatchEvent(new CustomEvent("dxm-webbridge-preflight-updated", { detail: window.__DXM_WEBBRIDGE_PREFLIGHT__ }));',
      ].join('\n');
      (document.head || document.documentElement).appendChild(script);
      script.remove();
    } catch (_) {
      // Page-context export is best effort; DOM JSON node remains readable.
    }
    document.documentElement.setAttribute('data-dxm-webbridge-preflight', preflight.allowed ? 'allowed' : 'blocked');
    document.documentElement.setAttribute('data-dxm-webbridge-preflight-updated-at', preflight.updatedAt);
    document.documentElement.setAttribute('data-dxm-webbridge-target-button-text', preflight.targetButtonText);
    document.documentElement.setAttribute('data-dxm-webbridge-block-reason', preflight.blockReason.join('|'));
    document.documentElement.setAttribute('data-dxm-webbridge-warning', preflight.warnings.join('|'));
    document.documentElement.setAttribute('data-dxm-webbridge-auto-claim', preflight.autoClaim.checked === true ? 'enabled' : preflight.autoClaim.checked === false ? 'disabled' : 'unknown');
    document.documentElement.setAttribute('data-dxm-webbridge-collector-input', preflight.collectorInput.found ? 'present' : 'missing');
    document.documentElement.setAttribute('data-dxm-webbridge-counts', preflight.collectionCounts.readable ? 'readable' : 'missing');
    return preflight;
  }

  function assertDxmWebBridgeSafe(actionText) {
    const preflight = exposeDxmWebBridgePreflight(actionText);
    const reasons = preflight.blockReason.slice();
    if (preflight.autoClaim.checked && !reasons.includes('auto_claim_enabled_blocks_collection')) reasons.push('auto_claim_enabled_blocks_collection');
    const blocked = Array.from(new Set(reasons));
    if (blocked.length) {
      addLog('webbridge_preflight_blocked', { actionText, preflight, blocked });
      alert(`WebBridge 安全检查未通过，已拦截：${blocked.join('；')}`);
      return { ok: false, preflight, blocked };
    }
    addLog('webbridge_preflight_passed', { actionText, preflight, warnings: preflight.warnings });
    return { ok: true, preflight, blocked: [] };
  }

  function getPipelineState() {
    return loadObject(PIPELINE_KEY, {
      active: false,
      stage: 'idle',
      targetCount: 0,
      startedAtMs: 0,
      updatedAtMs: 0,
      result: '',
    });
  }

  function setPipelineState(patch) {
    const next = {
      ...getPipelineState(),
      ...patch,
      updatedAt: nowIso(),
      updatedAtMs: Date.now(),
    };
    GM_setValue(PIPELINE_KEY, next);
    updatePanel();
    return next;
  }

  function finishPipeline(result, extra = {}) {
    const next = setPipelineState({
      active: false,
      stage: 'idle',
      result,
      ...extra,
    });
    const finishResults = new Set([
      'claimed_and_opened_smtlocal_box',
      'partial_collection_needs_supplement',
      'stale_refresh_no_unclaimed_products',
      'no_current_batch_rows_to_claim',
      'current_batch_rows_rejected_needs_supplement',
      'no_start_button',
    ]);
    if (finishResults.has(result)) {
      finishRunMetrics(result, {
        pipeline: next,
        targetCount: extra.targetCount || next.targetCount,
        successCount: extra.successCount,
        remainingCount: extra.remainingCount,
        nextAction: extra.nextAction,
      });
    }
    addLog('dxm_pipeline_finish', { result, ...extra });
    return next;
  }

  function getPipelineTargetCount(pipeline) {
    return Number((pipeline && pipeline.targetCount) || getCandidateItems().length || 0);
  }

  function isCollectionCompleteEnough(progress, pipeline) {
    const targetCount = getPipelineTargetCount(pipeline);
    if (!targetCount) return true;
    if (progress.success == null) return true;
    return Number(progress.success) >= targetCount;
  }

  function handlePartialCollection(progress, pipeline) {
    const targetCount = getPipelineTargetCount(pipeline);
    const successCount = Number(progress.success || 0);
    const remainingCount = Math.max(0, targetCount - successCount);
    closeVisibleDxmModal();
    addRunStage('dxm_partial_collection', { targetCount, successCount, remainingCount });
    finishPipeline('partial_collection_needs_supplement', {
      targetCount,
      successCount,
      remainingCount,
      collection: progress,
      nextAction: 'keep_unclaimed_products_and_collect_remaining_links',
    });
    if (remainingCount > 0) openNextCategoryFromQueue('partial_collection_needs_supplement');
  }

  function findVisibleTextElement(texts, root = document) {
    const wanted = Array.isArray(texts) ? texts : [texts];
    return Array.from(root.querySelectorAll('button,a,span,div,label'))
      .filter(visibleElement)
      .find((node) => wanted.includes(normalizeText(node.innerText || node.textContent)));
  }

  function clickVisibleText(texts, root = document) {
    const node = findVisibleTextElement(texts, root);
    if (!node) return false;
    dispatchUserClick(node);
    return true;
  }

  function isInPluginPanel(node) {
    const panel = document.getElementById(PANEL_ID);
    return Boolean(panel && node && panel.contains(node));
  }

  function dispatchUserClick(node) {
    if (!node) return false;
    try {
      node.scrollIntoView({ block: 'center', inline: 'center' });
    } catch (_) {
      // Ignore scroll errors from detached nodes.
    }
    const rect = node.getBoundingClientRect();
    const options = {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
    };
    for (const type of ['mouseover', 'mousemove', 'mousedown', 'mouseup', 'click']) {
      node.dispatchEvent(new MouseEvent(type, options));
    }
    if (typeof node.click === 'function') node.click();
    return true;
  }

  function getVisibleDialogs() {
    return Array.from(document.querySelectorAll('.modal,.ant-modal,.layui-layer,.el-dialog,[role="dialog"],.ant-modal-root'))
      .filter(visibleElement);
  }

  function getVisibleDialogEntries() {
    return getVisibleDialogs().map((node) => ({
      node,
      text: normalizeText(node.innerText || node.textContent),
    }));
  }

  function clickDialogButton(dialog, labels) {
    const wanted = new Set(labels.map((item) => normalizeText(item)));
    const button = Array.from(dialog.querySelectorAll('button,a,span'))
      .filter(visibleElement)
      .find((node) => wanted.has(normalizeText(node.innerText || node.textContent || node.getAttribute('title') || node.getAttribute('aria-label'))));
    return dispatchUserClick(button);
  }

  function skipDuplicateCollectionDialog() {
    const entry = getVisibleDialogEntries().find((item) => item.text.includes('\u91cd\u590d\u91c7\u96c6'));
    if (!entry) return false;
    const clicked = clickDialogButton(entry.node, ['\u8df3\u8fc7', '\u5173\u95ed']);
    addLog('dxm_duplicate_collection_skipped', { clicked, text: entry.text.slice(0, 500) });
    addRunStage('dxm_duplicate_collection_skipped', { clicked });
    return clicked;
  }

  function closeZeroSuccessCollectionDialog() {
    const entry = getVisibleDialogEntries().find((item) => {
      const text = item.text;
      return text.includes('\u91c7\u96c6\u4efb\u52a1\u5b8c\u6210') || text.includes('\u5df2\u5b8c\u6210') || /success\s*0/i.test(text) || /\u6210\u529f\s*0/.test(text);
    });
    if (!entry) return false;
    const zeroSuccess = /\u6210\u529f(?:\u91c7\u96c6)?\s*0|\u5df2\u6210\u529f\u91c7\u96c6\s*0|success\s*0/i.test(entry.text);
    if (!zeroSuccess) return false;
    const clicked = clickDialogButton(entry.node, ['\u5173\u95ed', '\u7ee7\u7eed\u91c7\u96c6', '\u5b8c\u6210']);
    addLog('dxm_zero_success_collection_closed', { clicked, text: entry.text.slice(0, 500) });
    addRunStage('dxm_zero_success_collection_closed', { clicked });
    return clicked;
  }

  function getDxmClaimResultText() {
    return getVisibleDialogs()
      .map((node) => normalizeText(node.innerText || node.textContent))
      .find((text) => /认领到采集箱|认领执行完成|成功\s*\d+\s*条/.test(text)) || '';
  }

  function parseDxmClaimResult(text) {
    const successMatch = text.match(/成功\s*(\d+)\s*条/);
    const failMatch = text.match(/失败\s*(\d+)\s*条/);
    const skipMatch = text.match(/跳过重复数据\s*(\d+)\s*条/);
    return {
      visible: Boolean(text),
      rawText: text,
      completed: /完成/.test(text),
      success: successMatch ? Number(successMatch[1]) : null,
      fail: failMatch ? Number(failMatch[1]) : null,
      skipped: skipMatch ? Number(skipMatch[1]) : null,
    };
  }

  function clickDxmStartCollection() {
    const guard = assertDxmWebBridgeSafe('开始采集');
    if (!guard.ok) return false;
    const startText = '\u5f00\u59cb\u91c7\u96c6';
    const buttons = Array.from(document.querySelectorAll('button,a'))
      .filter((node) => !isInPluginPanel(node))
      .filter(visibleElement)
      .filter((node) => normalizeText(node.innerText || node.textContent) === startText);
    const button = buttons.find((node) => !node.disabled && !node.classList.contains('disabled')) || buttons[0];
    return dispatchUserClick(button);
  }

  function waitAndClickDxmStartCollection(startedAtMs = Date.now(), timeoutMs = 10000) {
    if (clickDxmStartCollection()) return;
    if (Date.now() - startedAtMs >= timeoutMs) {
      finishPipeline('no_start_button');
      alert('\u6ca1\u6709\u627e\u5230\u201c\u5f00\u59cb\u91c7\u96c6\u201d\u6309\u94ae\uff0c\u8bf7\u786e\u8ba4\u5f53\u524d\u5728\u5e97\u5c0f\u79d8\u94fe\u63a5\u91c7\u96c6\u9875\u3002');
      return;
    }
    setTimeout(() => waitAndClickDxmStartCollection(startedAtMs, timeoutMs), 200);
  }

  function collapsePanelForPageWork() {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    panel.classList.add('collapsed');
    localStorage.setItem(PANEL_COLLAPSED_KEY, '1');
  }

  function startDxmPipeline() {
    const guard = assertDxmWebBridgeSafe('开始采集');
    if (!guard.ok) return;
    let targetCount = getCandidateItems().length;
    if (!targetCount) {
      targetCount = createBatchFromDxmInput();
      if (!targetCount) {
        const counts = getDxmDataAcquisitionCounts();
        if (counts.unclaimed && counts.unclaimed > 0 && getClaimableBatchAsins().length > 0) {
          startClaimCurrentBatchUnclaimed(getClaimableBatchAsins().length, counts);
          return;
        }
        addLog('dxm_pipeline_no_links');
        alert('没有找到本批 Amazon 链接。为避免跨品类混认，不能直接认领全部未认领商品。请先粘贴本批链接，或从本批采集流程继续。');
        return;
      }
    }
    if (getCandidateLinks() && !fillDxmCollector()) return;
    collapsePanelForPageWork();
    addRunStage('dxm_pipeline_start', { targetCount });
    setPipelineState({
      active: true,
      stage: 'collecting',
      targetCount,
      startedAtMs: Date.now(),
      result: '',
    });
    addLog('dxm_pipeline_start', { targetCount });
    waitAndClickDxmStartCollection();
  }

  function startClaimCurrentBatchUnclaimed(targetCount, counts = null) {
    const guard = assertDxmWebBridgeSafe('本批批量认领');
    if (!guard.ok) return;
    const asins = getClaimableBatchAsins();
    if (!asins.length) {
      addLog('dxm_pipeline_claim_current_batch_no_asins');
      alert('当前没有本批 ASIN 识别依据，不能直接认领全部未认领商品，避免跨品类混认。');
      return;
    }
    collapsePanelForPageWork();
    setPipelineState({
      active: true,
      stage: 'claim_opening',
      targetCount: Number(targetCount || 0),
      counts: counts || getDxmDataAcquisitionCounts(),
      claimAsins: asins,
      startedAtMs: Date.now(),
      result: '',
    });
    addLog('dxm_pipeline_claim_current_batch_unclaimed_start', { targetCount, counts, asins: asins.length });
    setTimeout(tickDxmPipeline, 100);
  }

  function maybeStartAutoDxmJob() {
    if (!isDxmPage()) return;
    const job = loadObject(AUTO_DXM_JOB_KEY, {});
    if (!job.active || !job.batchId || job.batchId !== state.batch.id) return;
    const links = getCandidateLinks();
    if (!links) {
      GM_setValue(AUTO_DXM_JOB_KEY, { ...job, active: false, result: 'no_candidate_links', endedAtMs: Date.now() });
      addLog('auto_dxm_job_no_candidate_links', { job });
      return;
    }
    GM_setValue(AUTO_DXM_JOB_KEY, { ...job, active: false, startedDxmAtMs: Date.now() });
    addLog('auto_dxm_job_start_pipeline', { batchId: job.batchId, target: job.target, candidates: job.candidates });
    setTimeout(startDxmPipeline, 300);
  }

  function getClaimableBatchAsins() {
    return Array.from(new Set((state.batch.items || [])
      .filter((item) => ['candidate', 'imported'].includes(String(item.status || '')))
      .map((item) => extractAsin(item.asin || item.url || item.rawUrl || ''))
      .filter(Boolean)));
  }

  function getRowTextForCheckbox(box) {
    let node = box;
    for (let i = 0; i < 8 && node; i += 1) {
      if (node.matches && node.matches('tr,.vxe-body--row,.el-table__row,.ant-table-row')) {
        return normalizeText(node.innerText || node.textContent);
      }
      node = node.parentElement;
    }
    return normalizeText((box.closest('tr,.vxe-body--row,.el-table__row,.ant-table-row') || box.parentElement || {}).innerText || '');
  }

  function dxmRowBrandLogoRiskReasons(rowText) {
    return brandFieldRiskReasons(rowText).map((reason) => `dxm_row_${reason}`);
  }

  function selectCurrentBatchUnclaimedRows(pipeline = getPipelineState()) {
    const asins = Array.from(new Set([...(pipeline.claimAsins || []), ...getClaimableBatchAsins()])).filter(Boolean);
    if (!asins.length) {
      addLog('dxm_pipeline_select_rows_no_batch_asins');
      return { ok: false, selected: 0, matched: 0, reason: 'no_batch_asins' };
    }
    const boxes = Array.from(document.querySelectorAll('input[type="checkbox"]'))
      .filter(visibleElement)
      .filter((box) => {
        const rect = box.getBoundingClientRect();
        return rect.top > Math.min(620, window.innerHeight * 0.55) && rect.left < window.innerWidth * 0.45;
      });
    let selected = 0;
    let matched = 0;
    let skippedRisk = 0;
    const skippedRiskDetails = [];
    for (const box of boxes) {
      const rowText = getRowTextForCheckbox(box);
      const matchedAsin = asins.find((asin) => rowText.includes(asin));
      if (!matchedAsin) continue;
      matched += 1;
      const riskReasons = dxmRowBrandLogoRiskReasons(rowText);
      if (riskReasons.length) {
        skippedRisk += 1;
        skippedRiskDetails.push({ asin: matchedAsin, reasons: riskReasons });
        markBatchAsinExcluded(matchedAsin, riskReasons);
        continue;
      }
      if (!box.checked) dispatchUserClick(box);
      if (box.checked) selected += 1;
    }
    return { ok: selected > 0, selected, matched, asins: asins.length, skippedRisk, skippedRiskDetails };
  }

  function openBatchClaimModal() {
    const guard = assertDxmWebBridgeSafe('本批批量认领');
    if (!guard.ok) return false;
    const selected = selectCurrentBatchUnclaimedRows();
    if (!selected.ok) {
      addLog('dxm_pipeline_select_rows_failed', selected);
      if (selected.skippedRisk > 0) {
        finishPipeline('current_batch_rows_rejected_needs_supplement', {
          selected,
          targetCount: getPipelineTargetCount(),
          successCount: 0,
          remainingCount: getPipelineTargetCount(),
          nextAction: 'skip_logo_or_brand_rows_and_collect_next_product',
        });
        openNextCategoryFromQueue('dxm_row_logo_or_brand_risk');
        return false;
      }
      finishPipeline('no_current_batch_rows_to_claim', {
        selected,
        nextAction: 'paste_current_batch_links_or_filter_to_current_category_before_claim',
      });
      return false;
    }
    const clicked = clickVisibleText('\u6279\u91cf\u8ba4\u9886');
    addLog('dxm_pipeline_click_batch_claim', { selected, clicked });
    return clicked;
  }

  function getPanelInputValue(field) {
    const panel = document.getElementById(PANEL_ID);
    const input = panel && panel.querySelector(`[data-field="${field}"]`);
    return normalizeText(input && input.value);
  }

  function findSmtLocalSection() {
    const headings = Array.from(document.querySelectorAll('div,span,td,th,label'))
      .filter(visibleElement)
      .filter((node) => normalizeText(node.innerText || node.textContent).includes('速卖通海外托管'));
    return headings
      .map((node) => {
        let scope = node;
        for (let i = 0; i < 4 && scope; i += 1) {
          if (scope.querySelector && scope.querySelector('input[type="checkbox"]')) return scope;
          scope = scope.parentElement;
        }
        return node.parentElement;
      })
      .find(Boolean);
  }

  function findStoreCheckboxNearText(textNode) {
    let scope = textNode;
    for (let i = 0; i < 5 && scope; i += 1) {
      const checkbox = scope.querySelector && scope.querySelector('input[type="checkbox"]');
      if (checkbox && visibleElement(checkbox)) return checkbox;
      scope = scope.parentElement;
    }
    return null;
  }

  function findSmtLocalStoreCheckbox() {
    const section = findSmtLocalSection();
    if (!section) return null;
    const preferredStoreName = getPanelInputValue('targetStoreName') || normalizeText(state.batch.filters && state.batch.filters.targetStoreName);
    const labels = Array.from(section.querySelectorAll('label,span,div,td'))
      .filter(visibleElement)
      .map((node) => ({ node, text: normalizeText(node.innerText || node.textContent) }))
      .filter((item) => item.text && item.text !== '速卖通海外托管' && item.text !== '全选');

    if (preferredStoreName) {
      const preferred = labels.find((item) => item.text.includes(preferredStoreName));
      const preferredCheckbox = preferred && findStoreCheckboxNearText(preferred.node);
      if (preferredCheckbox) return { checkbox: preferredCheckbox, storeText: preferred.text, preferredStoreName };
    }

    const directBoxes = Array.from(section.querySelectorAll('input[type="checkbox"]')).filter(visibleElement);
    const storeBox = directBoxes.find((box) => {
      const text = normalizeText((box.closest('label,div,tr,li') || box.parentElement || {}).innerText || '');
      return text && !text.includes('速卖通海外托管') && !text.includes('全选');
    });
    if (storeBox) {
      const text = normalizeText((storeBox.closest('label,div,tr,li') || storeBox.parentElement || {}).innerText || '');
      return { checkbox: storeBox, storeText: text, preferredStoreName };
    }

    const fallback = labels
      .map((item) => ({ item, checkbox: findStoreCheckboxNearText(item.node) }))
      .find((entry) => entry.checkbox);
    return fallback ? { checkbox: fallback.checkbox, storeText: fallback.item.text, preferredStoreName } : null;
  }

  function checkSmtLocalStore() {
    const target = findSmtLocalStoreCheckbox();
    if (!target) {
      addLog('dxm_pipeline_smtlocal_store_not_found', {
        preferredStoreName: getPanelInputValue('targetStoreName'),
      });
      return false;
    }
    if (!target.checkbox.checked) {
      target.checkbox.click();
      if (!target.checkbox.checked) {
        const label = target.checkbox.closest('label') || target.checkbox.parentElement;
        if (label) label.click();
      }
    }
    addLog('dxm_pipeline_smtlocal_store_checked', {
      storeText: target.storeText,
      preferredStoreName: target.preferredStoreName,
    });
    return true;
  }

  function confirmClaimModal() {
    const checked = checkSmtLocalStore();
    const confirmed = checked && clickVisibleText('\u786e\u5b9a');
    addLog('dxm_pipeline_confirm_claim', { checked, confirmed });
    return confirmed;
  }

  function tickDxmPipeline() {
    if (!isDxmPage()) return;
    const pipeline = getPipelineState();
    if (!pipeline.active) return;

    if (pipeline.stage === 'collecting') {
      if (skipDuplicateCollectionDialog()) {
        setTimeout(tickDxmPipeline, 300);
        return;
      }
      const progress = getDxmCollectionProgress();
      if (closeZeroSuccessCollectionDialog()) {
        handlePartialCollection({ ...progress, success: 0, fail: progress.fail || 0, completed: true }, pipeline);
        return;
      }
      if (progress.completed) {
        if (!isCollectionCompleteEnough(progress, pipeline)) {
          handlePartialCollection(progress, pipeline);
          return;
        }
        addRunStage('dxm_collection_completed', progress);
        markItems('candidate', 'imported');
        closeVisibleDxmModal();
        setPipelineState({ stage: 'claim_opening', collection: progress });
        setTimeout(tickDxmPipeline, 200);
        return;
      }
      if (progress.stale) {
        addRunStage('dxm_collection_stale_refresh', progress);
        setPipelineState({ stage: 'collection_stale_refresh', collection: progress });
        addLog('dxm_pipeline_collection_stale_refresh', progress);
        location.reload();
      }
      return;
    }

    if (pipeline.stage === 'claim_opening') {
      if (openBatchClaimModal()) {
        addRunStage('dxm_claim_modal_opened');
        setPipelineState({ stage: 'claim_modal' });
        setTimeout(tickDxmPipeline, 300);
      }
      return;
    }

    if (pipeline.stage === 'collection_stale_refresh') {
      const counts = getDxmDataAcquisitionCounts();
      const targetCount = getPipelineTargetCount(pipeline);
      if (counts.unclaimed && counts.unclaimed > 0 && (!targetCount || counts.unclaimed >= targetCount)) {
        markItems('candidate', 'imported');
        setPipelineState({ stage: 'claim_opening', counts });
        setTimeout(tickDxmPipeline, 200);
      } else if (counts.unclaimed && counts.unclaimed > 0) {
        finishPipeline('partial_collection_needs_supplement', {
          targetCount,
          counts,
          successCount: counts.unclaimed,
          remainingCount: Math.max(0, targetCount - counts.unclaimed),
          nextAction: 'keep_unclaimed_products_and_collect_remaining_links',
        });
        openNextCategoryFromQueue('stale_refresh_partial_collection');
      } else {
        finishPipeline('stale_refresh_no_unclaimed_products', { counts });
        openNextCategoryFromQueue('stale_refresh_no_unclaimed_products');
      }
      return;
    }

    if (pipeline.stage === 'claim_modal') {
      if (confirmClaimModal()) {
        setPipelineState({ stage: 'claim_result' });
        setTimeout(tickDxmPipeline, 300);
      }
      return;
    }

    if (pipeline.stage === 'claim_result') {
      const result = parseDxmClaimResult(getDxmClaimResultText());
      if (result.completed || result.success != null) {
        addRunStage('dxm_claim_completed', result);
        markItems('imported', 'claimed');
        closeVisibleDxmModal();
        setTimeout(() => {
          openSmtLocalCollectionBox();
          finishPipeline('claimed_and_opened_smtlocal_box', { claim: result });
        }, 150);
      }
    }
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[char]));
  }

  function getFiltersFromPanel() {
    const panel = document.getElementById(PANEL_ID);
    const filters = { ...DEFAULT_FILTERS };
    for (const key of Object.keys(filters)) {
      const input = panel && panel.querySelector(`[data-field="${key}"]`);
      if (input) filters[key] = input.value.trim();
    }
    return filters;
  }

  function renderAmazonControls() {
    const filters = { ...DEFAULT_FILTERS, ...(state.batch.filters || {}) };
    if (!normalizeText(filters.categoryQueue)) filters.categoryQueue = DEFAULT_CATEGORY_QUEUE;
    return `
      <div class="line">Amazon 选品采集</div>
      <label>类目词<input data-field="categoryTerm" value="${escapeHtml(filters.categoryTerm)}" placeholder="Furniture Pads"></label>
      <div class="grid">
        <label>最低价<input data-field="priceMin" value="${escapeHtml(filters.priceMin)}"></label>
        <label>最高价<input data-field="priceMax" value="${escapeHtml(filters.priceMax)}"></label>
        <label>评分<input data-field="ratingMin" value="${escapeHtml(filters.ratingMin)}"></label>
        <label>评论<input data-field="reviewMin" value="${escapeHtml(filters.reviewMin)}"></label>
        <label>运费<input data-field="shippingMax" value="${escapeHtml(filters.shippingMax)}"></label>
        <label>发货天数<input data-field="maxDeliveryDays" value="${escapeHtml(filters.maxDeliveryDays)}"></label>
        <label>页数<input data-field="maxPages" value="${escapeHtml(filters.maxPages)}"></label>
        <label>数量<input data-field="maxItems" value="${escapeHtml(filters.maxItems)}"></label>
        <label>包邮<input data-field="requirePrimeOrFreeShipping" value="${escapeHtml(filters.requirePrimeOrFreeShipping)}"></label>
      </div>
      <div class="grid">
        <label>类目上限<input data-field="similarCategoryLimit" value="${escapeHtml(filters.similarCategoryLimit)}"></label>
        <label>Logo确认<input data-field="requireLogoApproval" value="${escapeHtml(filters.requireLogoApproval)}"></label>
        <label>品牌词排除<input data-field="autoExcludeTitleBrandRisk" value="${escapeHtml(filters.autoExcludeTitleBrandRisk)}"></label>
      </div>
      <label>类目队列<textarea data-field="categoryQueue" placeholder="一个类目一行；当前类目不足时用于补缺口">${escapeHtml(filters.categoryQueue)}</textarea></label>
      <label>无 Logo ASIN<textarea data-field="logoApprovedAsins" placeholder="视觉确认主图/包装/本体无 Logo 后填写 ASIN，每行一个">${escapeHtml(filters.logoApprovedAsins)}</textarea></label>
      <label>敏感词<textarea data-field="bannedTerms">${escapeHtml(filters.bannedTerms)}</textarea></label>
      <button data-action="scanAmazon">扫描当前页</button>
      <button data-action="openFreshAmazon">新开当前类目页面</button>
      <button data-action="openNextCategory">打开队列下个类目</button>
      <button data-action="fastCollectAmazon">快速批量采集当前类目</button>
      <button data-action="fastCollectToDxm">快速采集并进店小秘</button>
      <button data-action="exportLogoReview">下载Logo复核页</button>
      <button data-action="exportLinks">下载链接</button>
    `;
  }

  function renderDxmControls() {
    const filters = { ...DEFAULT_FILTERS, ...(state.batch.filters || {}) };
    return `
      <div class="line">店小秘链接采集</div>
      <label>店铺名可空<input data-field="targetStoreName" value="${escapeHtml(filters.targetStoreName)}" placeholder="不填则选托管分组第一个店铺"></label>
      <button data-action="webBridgePreflight">WebBridge只读安全检查</button>
      <button data-action="startDxmPipeline">一键采集+认领</button>
      <button data-action="claimCurrentBatchUnclaimed">认领当前批次未认领</button>
      <button data-action="fillDxm">填入链接采集框</button>
      <button data-action="copyLinks">复制链接</button>
      <button data-action="checkDxmProgress">检查采集进度</button>
      <button data-action="closeDxmModal">关闭弹窗</button>
      <button data-action="markImported">标记已采集</button>
      <button data-action="markClaimed">标记已认领</button>
      <button data-action="refreshDxm">刷新检查结果</button>
      <button data-action="openSmtLocalBox">打开托管采集箱</button>
      <button data-action="verifySmtLocalBox">确认采集箱</button>
    `;
  }

  function renderPanel() {
    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    const collapsedValue = localStorage.getItem(PANEL_COLLAPSED_KEY);
    const startCollapsed = collapsedValue == null ? isDxmPage() : collapsedValue === '1';
    if (startCollapsed) panel.classList.add('collapsed');
    panel.innerHTML = `
      <style>
        #${PANEL_ID}{position:fixed;right:${isDxmPage() ? '18px' : '10px'};top:${isDxmPage() ? '104px' : 'auto'};bottom:${isDxmPage() ? 'auto' : '14px'};z-index:2147483646;width:220px;min-width:148px;max-width:420px;min-height:34px;max-height:${isDxmPage() ? '42vh' : '56vh'};resize:both;overflow:auto;background:#fff;color:#111827;border:1px solid #d1d5db;border-radius:7px;box-shadow:0 10px 26px rgba(0,0,0,.14);font:11px/1.35 Arial,"Microsoft YaHei",sans-serif}
        #${PANEL_ID} *{box-sizing:border-box}
        #${PANEL_ID} .head{display:flex;justify-content:space-between;gap:6px;align-items:center;padding:6px 8px;border-bottom:1px solid #e5e7eb;font-weight:700;cursor:move;user-select:none}
        #${PANEL_ID} .head-actions{display:flex;align-items:center;gap:6px}
        #${PANEL_ID} .icon-btn{width:24px;min-height:22px;padding:0}
        #${PANEL_ID} .body{padding:7px;display:grid;gap:6px}
        #${PANEL_ID} label{display:grid;gap:3px;color:#374151}
        #${PANEL_ID} input{height:24px;border:1px solid #d1d5db;border-radius:5px;padding:0 5px;font:11px Arial}
        #${PANEL_ID} textarea{height:48px;border:1px solid #d1d5db;border-radius:5px;padding:4px 5px;font:11px Arial;resize:vertical}
        #${PANEL_ID} button{border:1px solid #9ca3af;background:#f9fafb;border-radius:5px;padding:5px 6px;cursor:pointer;font:11px Arial}
        #${PANEL_ID} button:hover{background:#eef2ff}
        #${PANEL_ID} .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:4px}
        #${PANEL_ID} .line{font-weight:700;color:#111827}
        #${PANEL_ID} .summary{background:#f3f4f6;border-radius:5px;padding:5px;white-space:pre-wrap}
        #${PANEL_ID} .summary.warn{background:#fff7ed;border:1px solid #fdba74;color:#9a3412}
        #${PANEL_ID} .actions{display:flex;flex-wrap:wrap;gap:5px}
        #${PANEL_ID}.collapsed{width:154px;height:auto;resize:none;overflow:hidden}
        #${PANEL_ID}.collapsed .body{display:none}
      </style>
      <div class="head">
        <span>${APP_NAME}</span>
        <span class="head-actions"><span>v${VERSION}</span><button class="icon-btn" data-action="collapse" title="收起/展开">-</button></span>
      </div>
      <div class="body">
        ${isAmazonPage() ? renderAmazonControls() : ''}
        ${isDxmPage() ? renderDxmControls() : ''}
        <div class="summary" data-field="summary"></div>
        <div class="actions">
          <button data-action="exportBatch">下载批次报告</button>
          <button data-action="exportRunMetrics">下载运行指标</button>
          <button data-action="clearBatch">清空本批</button>
        </div>
      </div>
    `;
    document.body.appendChild(panel);
    restorePanelPosition(panel);
    makePanelDraggable(panel);
    panel.addEventListener('click', onPanelClick);
    updatePanel();
  }

  function updatePanel() {
    const panel = document.getElementById(PANEL_ID);
    const summary = summarizeBatch();
    const latest = state.logs[state.logs.length - 1];
    const progress = isDxmPage() ? getDxmCollectionProgress() : null;
    const pipeline = isDxmPage() ? getPipelineState() : null;
    const webBridgePreflight = isDxmPage() ? exposeDxmWebBridgePreflight() : null;
    const runMetrics = getRunMetrics();
    exposeRuntimeState({ summary, latest, progress, pipeline, webBridgePreflight, runMetrics });
    if (!panel) return;
    const node = panel.querySelector('[data-field="summary"]');
    if (node) {
      node.classList.toggle('warn', Boolean(progress && progress.stale));
      const lines = [
        `批次：${state.batch.id || '未创建'}`,
        `可采集：${summary.candidate} / 待Logo复核：${summary.needs_logo_review} / 排除：${summary.excluded}`,
        `已采集：${summary.imported} / 已认领：${summary.claimed} / 缺口：${summary.remainingToTarget}`,
      ];
      if (progress && progress.visible) {
        lines.push(
          progress.stale
            ? `采集卡住：${progress.secondsSinceChange}s未更新，刷新检查`
            : `采集弹窗：${progress.status || '有'} 成功${progress.success ?? '-'} 失败${progress.fail ?? '-'}`
        );
      }
      if (pipeline && (pipeline.active || pipeline.result)) {
        lines.push(`流水线：${pipeline.active ? pipeline.stage : pipeline.result}`);
      }
      if (webBridgePreflight) {
        const safetyText = webBridgePreflight.allowed
          ? `允许${webBridgePreflight.warnings && webBridgePreflight.warnings.length ? `，警告 ${webBridgePreflight.warnings.join(',')}` : ''}`
          : `拦截 ${webBridgePreflight.blockReason.join(',')}`;
        lines.push(`安全检查：${safetyText}`);
      }
      if (runMetrics && runMetrics.runId) {
        const elapsedSeconds = Math.round(((runMetrics.active ? Date.now() : runMetrics.endedAtMs) - runMetrics.startedAtMs) / 1000);
        lines.push(`耗时：${elapsedSeconds}s / 目标120s / ${runMetrics.result || (runMetrics.active ? '运行中' : '已结束')}`);
      }
      lines.push(latest ? `最近：${latest.action}` : '最近：无');
      node.textContent = lines.join('\n');
    }
  }

  function exposeRuntimeState(snapshot = {}) {
    const status = {
      app: APP_NAME,
      version: VERSION,
      page: isAmazonPage() ? 'amazon' : isDxmPage() ? 'dianxiaomi' : 'other',
      batchId: state.batch.id || '',
      summary: snapshot.summary || summarizeBatch(),
      pipeline: snapshot.pipeline || (isDxmPage() ? getPipelineState() : null),
      progress: snapshot.progress || (isDxmPage() ? getDxmCollectionProgress() : null),
      webBridgePreflight: snapshot.webBridgePreflight || (isDxmPage() ? exposeDxmWebBridgePreflight() : null),
      runMetrics: snapshot.runMetrics || getRunMetrics(),
      latest: snapshot.latest || state.logs[state.logs.length - 1] || null,
      updatedAt: nowIso(),
    };
    window.__DXM_AMAZON_CRAWLBOX_STATE__ = status;
    document.documentElement.setAttribute('data-dxm-amazon-version', VERSION);
    if (status.pipeline) {
      document.documentElement.setAttribute('data-dxm-amazon-pipeline-result', status.pipeline.result || status.pipeline.stage || '');
    }
    return status;
  }

  function clearBatch() {
    state.batch = { id: '', createdAt: '', updatedAt: '', filters: DEFAULT_FILTERS, items: [] };
    addLog('clear_batch');
    saveState();
  }

  function onPanelClick(event) {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const action = button.getAttribute('data-action');
    try {
      if (action === 'scanAmazon') {
        const filters = getFiltersFromPanel();
        const items = collectAmazonItems(filters);
        mergeBatchItems(items, filters);
        addLog('scan_amazon_page', { found: items.length, candidates: items.filter((item) => item.status === 'candidate').length });
      } else if (action === 'openFreshAmazon') {
        openFreshAmazonPage('panel_button');
      } else if (action === 'openNextCategory') {
        openNextCategoryFromQueue('panel_button');
      } else if (action === 'fastCollectAmazon') {
        fastCollectAmazonCategory();
      } else if (action === 'fastCollectToDxm') {
        fastCollectAndOpenDxm();
      } else if (action === 'exportLinks') {
        downloadText(`${state.batch.id || 'amazon-batch'}-links.txt`, getCandidateLinks());
      } else if (action === 'exportBatch') exportBatch();
      else if (action === 'exportRunMetrics') exportRunMetrics();
      else if (action === 'exportLogoReview') exportLogoReviewHtml();
      else if (action === 'copyLinks') copyLinks();
      else if (action === 'webBridgePreflight') {
        const preflight = exposeDxmWebBridgePreflight();
        addLog('webbridge_preflight_manual_check', preflight);
        alert(`WebBridge 安全检查：${preflight.allowed ? `允许${preflight.warnings.length ? `；警告 ${preflight.warnings.join('；')}` : ''}` : `拦截 ${preflight.blockReason.join('；')}`}`);
      }
      else if (action === 'startDxmPipeline') startDxmPipeline();
      else if (action === 'claimCurrentBatchUnclaimed') {
        const counts = getDxmDataAcquisitionCounts();
        if (counts.unclaimed && counts.unclaimed > 0) startClaimCurrentBatchUnclaimed(getClaimableBatchAsins().length, counts);
        else alert('当前没有未认领商品。');
      }
      else if (action === 'fillDxm') fillDxmCollector();
      else if (action === 'checkDxmProgress') addLog('check_dxm_collection_progress', getDxmCollectionProgress());
      else if (action === 'closeDxmModal') closeVisibleDxmModal();
      else if (action === 'markImported') markItems('candidate', 'imported');
      else if (action === 'markClaimed') markItems('imported', 'claimed');
      else if (action === 'refreshDxm') refreshDxmForCollectionCheck();
      else if (action === 'openSmtLocalBox') openSmtLocalCollectionBox();
      else if (action === 'verifySmtLocalBox') summarizeDxmCollectionBox();
      else if (action === 'clearBatch') clearBatch();
      else if (action === 'collapse') togglePanelCollapsed();
    } catch (error) {
      addLog('error', { action, error: String(error && error.message ? error.message : error) });
    }
  }

  function togglePanelCollapsed() {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    panel.classList.toggle('collapsed');
    localStorage.setItem(PANEL_COLLAPSED_KEY, panel.classList.contains('collapsed') ? '1' : '0');
  }

  function restorePanelPosition(panel) {
    try {
      const saved = JSON.parse(localStorage.getItem(PANEL_POS_KEY) || 'null');
      if (!saved) return;
      const maxLeft = Math.max(0, window.innerWidth - Math.max(panel.offsetWidth, 148));
      const maxTop = Math.max(0, window.innerHeight - Math.max(panel.offsetHeight, 34));
      const left = Math.min(Math.max(0, Number(saved.left) || 0), maxLeft);
      const top = Math.min(Math.max(0, Number(saved.top) || 0), maxTop);
      panel.style.left = `${left}px`;
      panel.style.top = `${top}px`;
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
      if (left !== saved.left || top !== saved.top) {
        localStorage.setItem(PANEL_POS_KEY, JSON.stringify({ left: Math.round(left), top: Math.round(top) }));
      }
    } catch (_) {
      // Ignore bad saved position.
    }
  }

  function makePanelDraggable(panel) {
    const header = panel.querySelector('.head');
    if (!header) return;
    let dragging = false;
    let offsetX = 0;
    let offsetY = 0;

    header.addEventListener('mousedown', (event) => {
      if (event.target && event.target.closest('button')) return;
      dragging = true;
      const rect = panel.getBoundingClientRect();
      offsetX = event.clientX - rect.left;
      offsetY = event.clientY - rect.top;
      panel.style.left = `${rect.left}px`;
      panel.style.top = `${rect.top}px`;
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
      event.preventDefault();
    });

    document.addEventListener('mousemove', (event) => {
      if (!dragging) return;
      const maxLeft = window.innerWidth - panel.offsetWidth;
      const maxTop = window.innerHeight - panel.offsetHeight;
      const left = Math.min(Math.max(0, event.clientX - offsetX), Math.max(0, maxLeft));
      const top = Math.min(Math.max(0, event.clientY - offsetY), Math.max(0, maxTop));
      panel.style.left = `${left}px`;
      panel.style.top = `${top}px`;
    });

    document.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      localStorage.setItem(
        PANEL_POS_KEY,
        JSON.stringify({
          left: Math.round(panel.getBoundingClientRect().left),
          top: Math.round(panel.getBoundingClientRect().top),
        })
      );
    });
  }

  function init() {
    if (!isAmazonPage() && !isDxmPage()) return;
    if (document.getElementById(PANEL_ID)) return;
    renderPanel();
    if (isAmazonPage()) watchAmazonPageHealth();
    if (isDxmPage()) {
      setInterval(updatePanel, 3000);
      setInterval(tickDxmPipeline, 250);
      setTimeout(maybeStartAutoDxmJob, 800);
    }
  }

  if (isAmazonPage()) {
    setTimeout(() => {
      if (!document.body && !new URL(location.href).searchParams.has('dxmFresh')) {
        location.replace(buildFreshAmazonPageUrl());
      }
    }, 15000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
