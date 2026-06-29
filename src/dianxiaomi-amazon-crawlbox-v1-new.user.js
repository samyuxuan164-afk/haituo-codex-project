// ==UserScript==
// @name         DXM Amazon Crawlbox NEW V1
// @namespace    https://codex.local/dianxiaomi-automation-v1
// @version      0.1.23
// @description  Minimal Amazon product collector for DXM save.json validation.
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
// ==/UserScript==

(function () {
  'use strict';

  const APP_NAME = 'DXM Amazon Crawlbox NEW V1';
  const VERSION = '0.1.23';
  const PANEL_ID = 'dxm-amazon-crawlbox-new-v1-panel';
  const BATCH_KEY = 'dxm_amazon_crawlbox_batch_v1';
  const PUBLIC_BATCH_KEY = 'dxm_amazon_crawlbox_public_batch_v1';
  const PANEL_POS_KEY = 'dxm_amazon_crawlbox_new_panel_position_v1';
  const PANEL_COLLAPSED_KEY = 'dxm_amazon_crawlbox_new_panel_collapsed_v1';
  const AUTO_COLLECT_KEY = 'dxm_amazon_crawlbox_new_auto_collect_seen_v1';

  const DEFAULT_BATCH = {
    id: '',
    createdAt: '',
    updatedAt: '',
    version: VERSION,
    filters: {
      categoryTerm: '',
      maxItems: '1',
    },
    items: [],
  };

  const state = {
    batch: loadBatch(),
    logs: [],
  };

  function nowIso() {
    return new Date().toISOString();
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

  function toNumber(value) {
    if (value == null || value === '') return '';
    const text = String(value).replace(/[^0-9.]/g, '');
    if (!text) return '';
    const number = Number(text);
    return Number.isFinite(number) ? number : '';
  }

  function toPositiveInt(value, fallback) {
    const number = Number(String(value || '').replace(/[^0-9]/g, ''));
    return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback;
  }

  function round2(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.round(number * 100) / 100 : '';
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function loadJsonValue(key, fallback) {
    try {
      const raw = GM_getValue(key);
      if (!raw) return fallback;
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return parsed && typeof parsed === 'object' ? parsed : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function loadBatch() {
    const batch = loadJsonValue(BATCH_KEY, DEFAULT_BATCH);
    return {
      ...DEFAULT_BATCH,
      ...batch,
      filters: { ...DEFAULT_BATCH.filters, ...(batch.filters || {}) },
      items: Array.isArray(batch.items) ? batch.items : [],
    };
  }

  function addLog(action, detail = {}) {
    const entry = { at: nowIso(), action, detail };
    state.logs.unshift(entry);
    state.logs = state.logs.slice(0, 20);
    updatePanel();
  }

  function publicPayload() {
    return {
      app: APP_NAME,
      version: VERSION,
      updatedAt: nowIso(),
      batch: state.batch,
    };
  }

  function mirrorToLocalStorage() {
    try {
      localStorage.setItem(PUBLIC_BATCH_KEY, JSON.stringify(publicPayload()));
      return true;
    } catch (_) {
      return false;
    }
  }

  function saveState() {
    if (!state.batch.id) {
      state.batch.id = `amazon-batch-${Date.now()}`;
      state.batch.createdAt = nowIso();
    }
    state.batch.updatedAt = nowIso();
    state.batch.version = VERSION;
    GM_setValue(BATCH_KEY, JSON.stringify(state.batch));
    mirrorToLocalStorage();
  }

  function extractAsin(text) {
    const source = String(text || '');
    const match = source.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?:[/?#]|$)/i)
      || source.match(/\b(B0[A-Z0-9]{8})\b/i)
      || source.match(/\b([A-Z0-9]{10})\b/i);
    return match ? match[1].toUpperCase() : '';
  }

  function absolutizeUrl(url) {
    if (!url) return '';
    try {
      return new URL(url, location.href).toString();
    } catch (_) {
      return String(url || '');
    }
  }

  function cleanAmazonUrl(url, asin) {
    if (asin) return `https://www.amazon.com/dp/${asin}`;
    const value = absolutizeUrl(url);
    return value ? value.split('?')[0] : '';
  }

  function parseDynamicImage(value) {
    if (!value) return '';
    try {
      const parsed = JSON.parse(value);
      const first = Object.keys(parsed || {})[0];
      return first || '';
    } catch (_) {
      return '';
    }
  }

  function isUsableProductImage(url) {
    const value = String(url || '');
    if (!value) return false;
    if (/sprite|nav-|logo|icon|avatar|transparent|blank|grey-pixel|data:image/i.test(value)) return false;
    if (!/m\.media-amazon|images-na\.ssl-images-amazon|ssl-images-amazon|media-amazon/i.test(value)) return false;
    return true;
  }

  function bestImageFromNode(root) {
    const images = Array.from(root.querySelectorAll('#landingImage, #imgTagWrapperId img, #main-image-container img, img.s-image, img[data-a-dynamic-image], img'));
    for (const img of images) {
      const candidates = [
        img.getAttribute('data-old-hires'),
        parseDynamicImage(img.getAttribute('data-a-dynamic-image')),
        img.currentSrc,
        img.src,
        img.getAttribute('src'),
      ].map(absolutizeUrl);
      const picked = candidates.find(isUsableProductImage);
      if (picked) return picked;
    }
    return '';
  }

  function extractPrice(root) {
    const selectors = [
      '#corePrice_feature_div .a-offscreen',
      '#apex_desktop .a-offscreen',
      '.a-price .a-offscreen',
      '[data-a-color="price"] .a-offscreen',
      '#priceblock_ourprice',
      '#priceblock_dealprice',
    ];
    for (const selector of selectors) {
      const node = root.querySelector(selector);
      const value = toNumber(node && (node.textContent || node.innerText));
      if (value) return value;
    }
    const text = normalizeText(root.innerText || root.textContent);
    const translatedMatch = text.match(/价格，产品页面\s*([0-9]+(?:\.[0-9]{1,2})?)\s*美元/i)
      || text.match(/([0-9]+(?:\.[0-9]{1,2})?)\s*美元/i)
      || text.match(/\$\s*([0-9]+(?:\.[0-9]{1,2})?)/);
    if (translatedMatch) return Number(translatedMatch[1]);
    return '';
  }

  function parseDimensionInches(text) {
    const source = String(text || '').replace(/\s+/g, ' ');
    const match = source.match(/(?:Product|Item|Package)?\s*Dimensions[^0-9]{0,40}([0-9.]+)\s*[xX]\s*([0-9.]+)\s*[xX]\s*([0-9.]+)\s*(?:inches|inch|in\b|")/i)
      || source.match(/\b([0-9.]+)\s*[xX]\s*([0-9.]+)\s*[xX]\s*([0-9.]+)\s*(?:inches|inch|in\b|")/i);
    if (!match) return null;
    return { length: Number(match[1]), width: Number(match[2]), height: Number(match[3]) };
  }

  function inchesToCm(dimensionsIn) {
    if (!dimensionsIn) return null;
    return {
      length: round2(dimensionsIn.length * 2.54),
      width: round2(dimensionsIn.width * 2.54),
      height: round2(dimensionsIn.height * 2.54),
    };
  }

  function parseWeightKg(text) {
    const source = String(text || '').replace(/\s+/g, ' ');
    const match = source.match(/(?:Item|Package)?\s*Weight[^0-9]{0,40}([0-9.]+)\s*(pounds|pound|lbs|lb|ounces|ounce|oz|kilograms|kilogram|kg|g|grams)/i)
      || source.match(/\b([0-9.]+)\s*(pounds|pound|lbs|lb|ounces|ounce|oz|kilograms|kilogram|kg|g|grams)\b/i);
    if (!match) return '';
    const value = Number(match[1]);
    const unit = String(match[2] || '').toLowerCase();
    if (!Number.isFinite(value)) return '';
    if (['pounds', 'pound', 'lbs', 'lb'].includes(unit)) return String(round2(value * 0.453592));
    if (['ounces', 'ounce', 'oz'].includes(unit)) return String(round2(value * 0.0283495));
    if (['g', 'grams'].includes(unit)) return String(round2(value / 1000));
    return String(round2(value));
  }

  function getCategoryTerm() {
    const searchBox = document.querySelector('#twotabsearchtextbox');
    const breadcrumb = document.querySelector('#wayfinding-breadcrumbs_feature_div');
    return normalizeText(
      (searchBox && searchBox.value)
      || (breadcrumb && (breadcrumb.innerText || breadcrumb.textContent))
      || document.title.replace(/Amazon\.com[:\s]*/i, '')
    ).slice(0, 120);
  }

  function extractProductPageItem() {
    const asin = extractAsin(location.href)
      || extractAsin(document.querySelector('#ASIN') && document.querySelector('#ASIN').value)
      || extractAsin(document.body && document.body.innerHTML);
    const title = normalizeText(document.querySelector('#productTitle')?.textContent || document.title);
    const bodyText = document.body ? normalizeText(document.body.innerText || document.body.textContent) : '';
    const dimensionsIn = parseDimensionInches(bodyText);
    if (!asin || !title) return null;
    return {
      asin,
      url: cleanAmazonUrl(location.href, asin),
      rawUrl: location.href,
      title: title.slice(0, 500),
      image: bestImageFromNode(document),
      price: extractPrice(document),
      rating: normalizeText(document.querySelector('#acrPopover, [data-hook="rating-out-of-text"]')?.textContent),
      reviews: normalizeText(document.querySelector('#acrCustomerReviewText')?.textContent),
      categoryTerm: getCategoryTerm(),
      dimensionsIn,
      dimensionsCm: inchesToCm(dimensionsIn),
      weightKg: parseWeightKg(bodyText),
      detailTextSample: bodyText.slice(0, 1500),
      status: 'candidate',
      collectedAt: nowIso(),
      sourcePage: location.href,
    };
  }

  function buildSearchItemFromRow(row) {
    const asin = extractAsin(row.getAttribute('data-asin'));
    const link = row.querySelector('a[href*="/dp/"], a[href*="/gp/product/"]');
    const rowText = normalizeText(row.innerText || row.textContent);
    const title = normalizeText(row.querySelector('h2, [data-cy="title-recipe"]')?.textContent || link?.textContent)
      || rowText.split(/(?:\s+[0-5]\.[0-9]\s+|\s+价格，产品页面\s+)/)[0];
    const image = bestImageFromNode(row);
    const price = extractPrice(row);
    if (!asin || !title || !image || !price) return null;
    return {
      asin,
      url: cleanAmazonUrl(link && link.getAttribute('href'), asin),
      rawUrl: absolutizeUrl(link && link.getAttribute('href')),
      title: title.slice(0, 500),
      image,
      price,
      rating: normalizeText(row.querySelector('.a-icon-alt')?.textContent),
      reviews: normalizeText(row.querySelector('[aria-label$="ratings"], [aria-label$="rating"]')?.textContent),
      categoryTerm: getCategoryTerm(),
      dimensionsIn: null,
      dimensionsCm: null,
      weightKg: '',
      detailTextSample: normalizeText(row.innerText || row.textContent).slice(0, 1000),
      status: 'candidate',
      collectedAt: nowIso(),
      sourcePage: location.href,
      sourceMode: 'amazon_search_result',
    };
  }

  function extractSearchItems(limit) {
    const rows = Array.from(document.querySelectorAll('[data-component-type="s-search-result"][data-asin], [data-asin]'))
      .filter((row) => extractAsin(row.getAttribute('data-asin')));
    const items = [];
    const seen = new Set();
    for (const row of rows) {
      const item = buildSearchItemFromRow(row);
      if (!item || seen.has(item.asin)) continue;
      seen.add(item.asin);
      items.push(item);
      if (items.length >= limit) break;
    }
    return items;
  }

  function extractCurrentAmazonItems(limit) {
    const productItem = extractProductPageItem();
    if (productItem) return [productItem];
    return extractSearchItems(limit);
  }

  function upsertItems(items, options = {}) {
    const validItems = (Array.isArray(items) ? items : [items]).filter((item) => item && item.asin);
    if (!validItems.length) return { added: 0, updated: 0, total: (state.batch.items || []).length };
    const existing = new Map((state.batch.items || []).map((entry) => [extractAsin(`${entry.asin || ''} ${entry.url || ''}`), entry]));
    let added = 0;
    let updated = 0;
    for (const item of validItems) {
      const before = existing.get(item.asin);
      existing.set(item.asin, { ...(before || {}), ...item, status: item.status || 'candidate' });
      if (before) updated += 1;
      else added += 1;
    }
    state.batch.items = Array.from(existing.values());
    const firstItem = validItems[0];
    const maxItems = String(options.maxItems || state.batch.filters.maxItems || DEFAULT_BATCH.filters.maxItems);
    state.batch.filters = {
      ...state.batch.filters,
      categoryTerm: firstItem.categoryTerm || state.batch.filters.categoryTerm || '',
      maxItems,
    };
    saveState();
    return { added, updated, total: state.batch.items.length };
  }

  function collectCurrentAmazonItems() {
    if (!isAmazonPage()) {
      addLog('collect_wrong_page', { host: location.hostname });
      return;
    }
    const maxItems = toPositiveInt(state.batch.filters.maxItems, 1);
    const items = extractCurrentAmazonItems(maxItems);
    if (!items.length) {
      addLog('collect_failed', { reason: 'no amazon item found' });
      return;
    }
    const result = upsertItems(items, { maxItems });
    addLog('collect_ok', {
      pageItems: items.length,
      added: result.added,
      updated: result.updated,
      total: result.total,
      firstAsin: items[0].asin,
      firstTitle: items[0].title.slice(0, 80),
    });
  }

  function autoCollectCurrentAmazonItems() {
    if (!isAmazonPage()) return;
    const pageKey = `${location.pathname}${location.search}`.slice(0, 500);
    const seen = loadJsonValue(AUTO_COLLECT_KEY, {});
    const maxItems = toPositiveInt(state.batch.filters.maxItems, 1);
    const items = extractCurrentAmazonItems(maxItems);
    if (!items.length) {
      addLog('auto_collect_waiting', { pageKey });
      return;
    }
    const result = upsertItems(items, { maxItems });
    seen[pageKey] = { count: items.length, firstAsin: items[0].asin, at: nowIso() };
    GM_setValue(AUTO_COLLECT_KEY, JSON.stringify(seen));
    addLog('auto_collect_ok', {
      pageItems: items.length,
      added: result.added,
      updated: result.updated,
      total: result.total,
      firstAsin: items[0].asin,
      firstTitle: items[0].title.slice(0, 80),
    });
  }

  function clearBatch() {
    state.batch = {
      ...DEFAULT_BATCH,
      id: `amazon-batch-${Date.now()}`,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      version: VERSION,
      items: [],
    };
    saveState();
    addLog('clear_batch');
  }

  function latestItem() {
    return (state.batch.items || [])[0] || null;
  }

  function buildStatusLines() {
    const item = latestItem();
    const mirrored = mirrorToLocalStorage();
    return [
      `${APP_NAME} v${VERSION}`,
      `page: ${isAmazonPage() ? 'amazon' : isDxmPage() ? 'dxm' : 'other'}`,
      `items: ${(state.batch.items || []).length}`,
      `mirror: ${mirrored ? 'ok' : 'failed'}`,
      item ? `asin: ${item.asin}` : 'asin: none',
      item ? `title: ${item.title.slice(0, 90)}` : 'title: none',
      state.logs[0] ? `last: ${state.logs[0].action}` : 'last: ready',
    ];
  }

  function restorePanelPosition(panel) {
    try {
      const pos = JSON.parse(localStorage.getItem(PANEL_POS_KEY) || '{}');
      const width = window.innerWidth || document.documentElement.clientWidth || 1200;
      const height = window.innerHeight || document.documentElement.clientHeight || 800;
      if (Number.isFinite(pos.left) && Number.isFinite(pos.top)) {
        const left = Math.max(0, Math.min(pos.left, width - 170));
        const top = Math.max(0, Math.min(pos.top, height - 60));
        panel.style.left = `${left}px`;
        panel.style.top = `${top}px`;
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';
      }
    } catch (_) {
      // Ignore corrupt panel position.
    }
  }

  function makeDraggable(panel) {
    const head = panel.querySelector('[data-role="head"]');
    if (!head) return;
    let drag = null;
    head.addEventListener('mousedown', (event) => {
      if (event.target && event.target.closest('button')) return;
      const rect = panel.getBoundingClientRect();
      drag = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
      event.preventDefault();
    });
    document.addEventListener('mousemove', (event) => {
      if (!drag) return;
      const left = Math.max(0, Math.min(drag.left + event.clientX - drag.x, window.innerWidth - 170));
      const top = Math.max(0, Math.min(drag.top + event.clientY - drag.y, window.innerHeight - 60));
      panel.style.left = `${left}px`;
      panel.style.top = `${top}px`;
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
    });
    document.addEventListener('mouseup', () => {
      if (!drag) return;
      drag = null;
      localStorage.setItem(PANEL_POS_KEY, JSON.stringify({
        left: Math.round(panel.getBoundingClientRect().left),
        top: Math.round(panel.getBoundingClientRect().top),
      }));
    });
  }

  function renderPanel() {
    if (!document.body || document.getElementById(PANEL_ID)) return;
    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <style>
        #${PANEL_ID}{position:fixed;right:14px;bottom:${isDxmPage() ? '210px' : '14px'};z-index:2147483646;width:245px;min-height:34px;background:#fff;color:#111827;border:1px solid #94a3b8;border-radius:7px;box-shadow:0 10px 28px rgba(0,0,0,.18);font:11px/1.35 Arial,"Microsoft YaHei",sans-serif}
        #${PANEL_ID} *{box-sizing:border-box}
        #${PANEL_ID} .head{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:7px 8px;border-bottom:1px solid #e5e7eb;font-weight:700;cursor:move;user-select:none}
        #${PANEL_ID} .body{display:grid;gap:6px;padding:8px}
        #${PANEL_ID} button{border:1px solid #9ca3af;background:#f9fafb;border-radius:5px;padding:5px 6px;cursor:pointer;font:11px Arial}
        #${PANEL_ID} button:hover{background:#eef2ff}
        #${PANEL_ID} .row{display:grid;grid-template-columns:1fr 1fr;gap:5px}
        #${PANEL_ID} .summary{white-space:pre-wrap;background:#f3f4f6;border-radius:5px;padding:6px;max-height:120px;overflow:auto}
        #${PANEL_ID}.collapsed{width:172px}
        #${PANEL_ID}.collapsed .body{display:none}
      </style>
      <div class="head" data-role="head">
        <span>DXM Amazon NEW</span>
        <span>v${VERSION} <button data-action="collapse" title="collapse">-</button></span>
      </div>
      <div class="body">
        <div class="row">
          <button data-action="collect">Collect 1</button>
          <button data-action="sync">Sync DXM</button>
        </div>
        <div class="row">
          <button data-action="clear">Clear</button>
          <button data-action="refresh">Refresh</button>
        </div>
        <div class="summary" data-role="summary"></div>
      </div>
    `;
    document.body.appendChild(panel);
    restorePanelPosition(panel);
    if (localStorage.getItem(PANEL_COLLAPSED_KEY) === '1') panel.classList.add('collapsed');
    panel.addEventListener('click', (event) => {
      const button = event.target && event.target.closest('button[data-action]');
      if (!button) return;
      const action = button.getAttribute('data-action');
      if (action === 'collect') collectCurrentAmazonItems();
      if (action === 'sync') {
        state.batch = loadBatch();
        const ok = mirrorToLocalStorage();
        addLog('sync_dxm', { ok, items: (state.batch.items || []).length });
      }
      if (action === 'clear') clearBatch();
      if (action === 'refresh') {
        state.batch = loadBatch();
        addLog('refresh_state', { items: (state.batch.items || []).length });
      }
      if (action === 'collapse') {
        panel.classList.toggle('collapsed');
        localStorage.setItem(PANEL_COLLAPSED_KEY, panel.classList.contains('collapsed') ? '1' : '0');
      }
      updatePanel();
    });
    makeDraggable(panel);
    updatePanel();
  }

  function updatePanel() {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    const summary = panel.querySelector('[data-role="summary"]');
    if (summary) summary.textContent = buildStatusLines().join('\n');
  }

  function init() {
    if (!isAmazonPage() && !isDxmPage()) return;
    state.batch = loadBatch();
    mirrorToLocalStorage();
    renderPanel();
    updatePanel();
  }

  function startInit() {
    init();
    if (isAmazonPage()) {
      [1500, 3500, 7000, 12000].forEach((delay) => {
        window.setTimeout(() => {
          state.batch = loadBatch();
          autoCollectCurrentAmazonItems();
          updatePanel();
        }, delay);
      });
    }
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      init();
      if (document.getElementById(PANEL_ID) || attempts >= 30) window.clearInterval(timer);
    }, 1000);
    window.setInterval(() => {
      if (isDxmPage()) {
        state.batch = loadBatch();
        mirrorToLocalStorage();
        updatePanel();
      }
    }, 2000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startInit, { once: true });
  } else {
    startInit();
  }
})();
