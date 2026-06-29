// ==UserScript==
// @name         店小秘自动化系统 V1 - 接口探测器 V2
// @namespace    https://codex.local/dianxiaomi-automation-v1
// @version      0.3.0
// @description  V2: 展开 FormData / File / Blob，记录点击路径和页面跳转链路，重点分析 save.json 与助手执行链路。
// @author       Codex
// @match        https://*.dianxiaomi.com/*
// @match        http://*.dianxiaomi.com/*
// @run-at       document-start
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_download
// @grant        unsafeWindow
// ==/UserScript==

(function () {
  'use strict';

  const APP_NAME = '店小秘自动化系统 V1 - 接口探测器 V2';
  const VERSION = '0.3.0';
  const STORAGE_KEY = 'dxm_interface_detector_records_v2';
  const NAV_KEY = 'dxm_interface_detector_nav_v2';
  const PANEL_ID = 'dxm-interface-detector-v2-panel';
  const MAX_RESPONSE_LENGTH = 12000;
  const MAX_TEXT_BLOB_LENGTH = 200000;
  const MAX_RECORDS = 1500;

  const state = {
    enabled: GM_getValue('dxm_detector_v2_enabled', true),
    records: loadRecords(),
    navEvents: loadNavEvents(),
    panelReady: false,
    lastAction: null,
  };

  const rules = [
    {
      type: 'product_save',
      label: 'save.json 提交接口',
      test: (r) => /\/api\/smtlocalProduct\/save\.json/i.test(r.url),
      critical: true,
    },
    {
      type: 'link_collection_or_claim',
      label: 'link collection / claim candidate',
      test: (r) => /collect|collection|crawl|spider|link|url|claim|%e9%87%87%e9%9b%86|%e8%ae%a4%e9%a2%86/i.test(`${r.url} ${r.requestBodyText || ''} ${r.responseText || ''}`),
      critical: true,
    },
    {
      type: 'draft_list',
      label: '采集箱产品列表接口',
      test: (r) => /\/api\/smtlocalProduct\/pageList\.json/i.test(r.url),
      critical: true,
    },
    {
      type: 'offline_counts',
      label: '采集箱数量接口',
      test: (r) => /\/api\/smtlocalProduct\/getOfflineCounts\.json/i.test(r.url),
      critical: true,
    },
    {
      type: 'category_attr',
      label: '类目属性接口',
      test: (r) => /\/api\/smtlocalCategory\/attributeList\.json|\/api\/categoryAttrMatch\//i.test(r.url),
      critical: true,
    },
    {
      type: 'assistant_possible',
      label: '助手相关候选接口',
      test: (r) => /assistant|helper|auto|rule|config|setting|start|finish|pause|stop|task|process/i.test(`${r.url} ${r.requestBodyText || ''} ${r.responseText || ''}`),
      critical: true,
    },
    {
      type: 'category_search',
      label: '类目搜索/类目树接口',
      test: (r) => /\/api\/smtlocalCategory\/|\/smtlocalCategory\/|category|cate/i.test(`${r.url} ${r.requestBodyText || ''}`),
      critical: true,
    },
    {
      type: 'image_upload',
      label: '图片上传接口',
      test: (r) => /\/api\/cos\/|wxalbum|myqcloud/i.test(r.url),
      critical: false,
    },
    {
      type: 'noise',
      label: '噪音接口',
      test: (r) => /qiyukf\.com|\/api\/userInfo\.json|\/api\/message\/|\/api\/notice\/|\/api\/getVipActiveTime|\/api\/getplatformNameMap|\/api\/stat\/emailVerify/i.test(r.url),
      critical: false,
    },
  ];

  function nowIso() {
    return new Date().toISOString();
  }

  function loadRecords() {
    const value = GM_getValue(STORAGE_KEY, []);
    return Array.isArray(value) ? value : [];
  }

  function loadNavEvents() {
    const value = GM_getValue(NAV_KEY, []);
    return Array.isArray(value) ? value : [];
  }

  function saveRecords() {
    GM_setValue(STORAGE_KEY, state.records.slice(-MAX_RECORDS));
  }

  function saveNavEvents() {
    GM_setValue(NAV_KEY, state.navEvents.slice(-300));
  }

  function getPageContext() {
    return {
      href: location.href,
      pathname: location.pathname,
      title: document.title || '',
      readyState: document.readyState,
    };
  }

  function normalizeUrl(input) {
    try {
      if (typeof input === 'string') return input;
      if (input && typeof input.url === 'string') return input.url;
      return String(input);
    } catch (_) {
      return '';
    }
  }

  function headersToObject(headers) {
    const result = {};
    try {
      if (!headers) return result;
      if (headers instanceof Headers) {
        headers.forEach((value, key) => {
          result[key] = value;
        });
        return result;
      }
      if (Array.isArray(headers)) {
        headers.forEach(([key, value]) => {
          result[key] = value;
        });
        return result;
      }
      return Object.assign({}, headers);
    } catch (_) {
      return result;
    }
  }

  function shortText(value, limit) {
    if (value == null) return '';
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    return text.length > limit ? `${text.slice(0, limit)}...[truncated ${text.length - limit}]` : text;
  }

  function isProbablyText(type, name) {
    const text = `${type || ''} ${name || ''}`.toLowerCase();
    return (
      !type ||
      text.includes('json') ||
      text.includes('text') ||
      text.includes('xml') ||
      text.includes('csv') ||
      text.includes('plain') ||
      text.endsWith('.json') ||
      text.endsWith('.txt')
    );
  }

  async function blobToBase64(blob, limit = 250000) {
    const sliced = blob.size > limit ? blob.slice(0, limit) : blob;
    const buffer = await sliced.arrayBuffer();
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
    }
    return {
      base64: btoa(binary),
      truncated: blob.size > limit,
      capturedBytes: bytes.length,
    };
  }

  async function serializeBody(body) {
    if (body == null) return { kind: 'empty', text: '', fields: [] };

    try {
      if (typeof body === 'string') {
        return { kind: 'string', text: shortText(body, MAX_TEXT_BLOB_LENGTH), fields: [] };
      }

      if (body instanceof URLSearchParams) {
        const text = body.toString();
        return {
          kind: 'urlsearchparams',
          text: shortText(text, MAX_TEXT_BLOB_LENGTH),
          fields: Array.from(body.entries()).map(([name, value]) => ({ name, value })),
        };
      }

      if (body instanceof FormData) {
        const fields = [];
        for (const [name, value] of body.entries()) {
          if (value instanceof Blob) {
            const fileInfo = {
              name,
              kind: value instanceof File ? 'file' : 'blob',
              fileName: value instanceof File ? value.name : '',
              type: value.type || '',
              size: value.size,
              text: '',
              textParse: null,
              base64Preview: null,
            };

            if (value.size <= MAX_TEXT_BLOB_LENGTH && isProbablyText(value.type, fileInfo.fileName)) {
              try {
                fileInfo.text = await value.text();
                fileInfo.textParse = tryParseText(fileInfo.text);
              } catch (error) {
                fileInfo.text = `[Blob text read failed: ${error.message}]`;
              }
            } else if (value.size <= 250000 && !isProbablyText(value.type, fileInfo.fileName)) {
              try {
                fileInfo.base64Preview = await blobToBase64(value);
              } catch (error) {
                fileInfo.base64Preview = { error: error.message };
              }
            } else {
              fileInfo.text = `[Blob not expanded: type=${value.type || 'unknown'} size=${value.size}]`;
            }
            fields.push(fileInfo);
          } else {
            fields.push({ name, kind: 'value', value: String(value) });
          }
        }
        return {
          kind: 'formdata',
          text: JSON.stringify(fields),
          fields,
        };
      }

      if (body instanceof Blob) {
        const info = {
          kind: 'blob',
          type: body.type || '',
          size: body.size,
          text: '',
          textParse: null,
          base64Preview: null,
        };
        if (body.size <= MAX_TEXT_BLOB_LENGTH && isProbablyText(body.type, '')) {
          info.text = await body.text();
          info.textParse = tryParseText(info.text);
        } else if (body.size <= 250000) {
          info.base64Preview = await blobToBase64(body);
        } else {
          info.text = `[Blob not expanded: type=${body.type || 'unknown'} size=${body.size}]`;
        }
        return { kind: 'blob', text: info.text || JSON.stringify(info), fields: [info] };
      }

      if (body instanceof ArrayBuffer) {
        return { kind: 'arraybuffer', text: `[ArrayBuffer:${body.byteLength}]`, fields: [] };
      }

      const text = JSON.stringify(body);
      return { kind: 'object', text: shortText(text, MAX_TEXT_BLOB_LENGTH), fields: [] };
    } catch (error) {
      return { kind: 'error', text: `[Body serialize failed: ${error.message}]`, fields: [] };
    }
  }

  function tryParseText(text) {
    const trimmed = String(text || '').trim();
    if (!trimmed) return null;
    try {
      return { type: 'json', value: JSON.parse(trimmed) };
    } catch (_) {
      if (trimmed.includes('&') && trimmed.includes('=')) {
        try {
          return { type: 'urlencoded', value: Object.fromEntries(new URLSearchParams(trimmed).entries()) };
        } catch (_) {
          return { type: 'text', value: shortText(trimmed, 8000) };
        }
      }
      return { type: 'text', value: shortText(trimmed, 8000) };
    }
  }

  function classify(record) {
    const matches = [];
    for (const rule of rules) {
      try {
        if (rule.test(record)) {
          matches.push({ type: rule.type, label: rule.label, critical: rule.critical });
        }
      } catch (_) {
        // Ignore rule failures.
      }
    }
    if (!matches.length) {
      matches.push({ type: 'other', label: '其他接口', critical: false });
    }
    return matches;
  }

  function recordNav(eventType, detail = {}) {
    const event = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      createdAt: nowIso(),
      eventType,
      page: getPageContext(),
      lastAction: state.lastAction,
      detail,
    };
    state.navEvents.push(event);
    saveNavEvents();
    updatePanel();
  }

  function makeActionFromElement(element, eventType) {
    if (!element) return null;
    const target = element.closest('button,a,input,[role="button"],.el-button,.ant-btn') || element;
    return {
      eventType,
      at: nowIso(),
      page: getPageContext(),
      tag: target.tagName,
      text: shortText((target.innerText || target.value || target.getAttribute('title') || target.getAttribute('aria-label') || '').trim(), 300),
      id: target.id || '',
      className: String(target.className || ''),
      href: target.getAttribute && target.getAttribute('href'),
      dataAction: target.getAttribute && target.getAttribute('data-action'),
    };
  }

  function attachActionListeners() {
    document.addEventListener(
      'click',
      (event) => {
        state.lastAction = makeActionFromElement(event.target, 'click');
        if (state.lastAction) recordNav('click', state.lastAction);
      },
      true
    );
    document.addEventListener(
      'submit',
      (event) => {
        state.lastAction = makeActionFromElement(event.target, 'submit');
        if (state.lastAction) recordNav('submit', state.lastAction);
      },
      true
    );
    window.addEventListener('beforeunload', () => recordNav('beforeunload'));
    window.addEventListener('hashchange', () => recordNav('hashchange'));
    window.addEventListener('popstate', () => recordNav('popstate'));
  }

  function addRecord(record) {
    if (!state.enabled) return;
    const full = Object.assign(
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        createdAt: nowIso(),
        version: VERSION,
        page: getPageContext(),
        lastAction: state.lastAction,
      },
      record
    );
    full.matches = classify(full);
    full.critical = full.matches.some((match) => match.critical);
    state.records.push(full);
    saveRecords();
    updatePanel();
    if (full.critical) {
      console.info(`[${APP_NAME}] 关键接口`, full.matches[0].label, full);
    }
  }

  function hookFetch() {
    if (!window.fetch || window.fetch.__dxmV2Hooked) return;
    const original = window.fetch;
    window.fetch = async function dxmFetchV2(input, init = {}) {
      const startedAt = performance.now();
      const url = normalizeUrl(input);
      const method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
      const requestHeaders = headersToObject((init && init.headers) || (input && input.headers));
      const requestBody = await serializeBody(init && init.body);
      try {
        const response = await original.apply(this, arguments);
        const clone = response.clone();
        clone
          .text()
          .then((text) => {
            addRecord({
              source: 'fetch',
              url,
              method,
              requestHeaders,
              requestBodyKind: requestBody.kind,
              requestBodyText: requestBody.text,
              requestBodyFields: requestBody.fields,
              status: response.status,
              ok: response.ok,
              durationMs: Math.round(performance.now() - startedAt),
              responseText: shortText(text, MAX_RESPONSE_LENGTH),
              responseParse: tryParseText(text),
              responseHeaders: headersToObject(response.headers),
            });
          })
          .catch((error) => {
            addRecord({
              source: 'fetch',
              url,
              method,
              requestHeaders,
              requestBodyKind: requestBody.kind,
              requestBodyText: requestBody.text,
              requestBodyFields: requestBody.fields,
              status: response.status,
              ok: response.ok,
              durationMs: Math.round(performance.now() - startedAt),
              responseError: error.message,
            });
          });
        return response;
      } catch (error) {
        addRecord({
          source: 'fetch',
          url,
          method,
          requestHeaders,
          requestBodyKind: requestBody.kind,
          requestBodyText: requestBody.text,
          requestBodyFields: requestBody.fields,
          durationMs: Math.round(performance.now() - startedAt),
          networkError: error.message,
        });
        throw error;
      }
    };
    window.fetch.__dxmV2Hooked = true;
  }

  function hookXhr() {
    if (!window.XMLHttpRequest || window.XMLHttpRequest.prototype.__dxmV2Hooked) return;
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;
    const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;

    XMLHttpRequest.prototype.open = function dxmOpenV2(method, url) {
      this.__dxmV2Meta = {
        source: 'xhr',
        method: String(method || 'GET').toUpperCase(),
        url: normalizeUrl(url),
        requestHeaders: {},
        requestBodyPromise: Promise.resolve({ kind: 'empty', text: '', fields: [] }),
        startedAt: 0,
        lastAction: state.lastAction,
      };
      return originalOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.setRequestHeader = function dxmHeaderV2(key, value) {
      if (this.__dxmV2Meta) this.__dxmV2Meta.requestHeaders[key] = value;
      return originalSetRequestHeader.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function dxmSendV2(body) {
      const xhr = this;
      const meta =
        xhr.__dxmV2Meta ||
        {
          source: 'xhr',
          method: 'GET',
          url: '',
          requestHeaders: {},
          lastAction: state.lastAction,
        };
      meta.startedAt = performance.now();
      meta.requestBodyPromise = serializeBody(body);

      xhr.addEventListener('loadend', async function () {
        const requestBody = await meta.requestBodyPromise;
        let responseText = '';
        try {
          const contentType = xhr.getResponseHeader('content-type') || '';
          if (xhr.responseType === '' || xhr.responseType === 'text' || contentType.includes('json')) {
            responseText = shortText(xhr.responseText, MAX_RESPONSE_LENGTH);
          } else {
            responseText = `[responseType:${xhr.responseType}]`;
          }
        } catch (error) {
          responseText = `[UnreadableResponse:${error.message}]`;
        }

        addRecord({
          source: 'xhr',
          url: meta.url,
          method: meta.method,
          requestHeaders: meta.requestHeaders,
          requestBodyKind: requestBody.kind,
          requestBodyText: requestBody.text,
          requestBodyFields: requestBody.fields,
          status: xhr.status,
          ok: xhr.status >= 200 && xhr.status < 300,
          durationMs: Math.round(performance.now() - meta.startedAt),
          responseText,
          responseParse: tryParseText(responseText),
          responseHeadersRaw: shortText(xhr.getAllResponseHeaders(), 4000),
          lastAction: meta.lastAction || state.lastAction,
        });
      });

      return originalSend.apply(this, arguments);
    };
    XMLHttpRequest.prototype.__dxmV2Hooked = true;
  }

  function countRecords() {
    const result = { total: state.records.length, critical: 0 };
    for (const rule of rules) result[rule.type] = 0;
    for (const record of state.records) {
      if (record.critical) result.critical += 1;
      const first = record.matches && record.matches[0];
      if (first) result[first.type] = (result[first.type] || 0) + 1;
    }
    return result;
  }

  function exportRecords() {
    const payload = {
      app: APP_NAME,
      version: VERSION,
      exportedAt: nowIso(),
      page: getPageContext(),
      records: state.records,
      navEvents: state.navEvents,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    GM_download({
      url,
      name: `dxm-interface-v2-records-${Date.now()}.json`,
      saveAs: true,
      onload: () => URL.revokeObjectURL(url),
      onerror: () => URL.revokeObjectURL(url),
    });
  }

  function clearRecords() {
    state.records = [];
    state.navEvents = [];
    GM_deleteValue(STORAGE_KEY);
    GM_deleteValue(NAV_KEY);
    updatePanel();
  }

  function createPanel() {
    if (document.getElementById(PANEL_ID)) return;
    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <div class="dxm-v2-header">
        <strong>店小秘探测器 V2</strong>
        <button type="button" data-action="toggle"></button>
      </div>
      <div class="dxm-v2-body">
        <div>总数：<strong data-field="total">0</strong> / 关键：<strong data-field="critical">0</strong></div>
        <div class="dxm-v2-grid" data-field="counts"></div>
        <div class="dxm-v2-actions">
          <button type="button" data-action="export">导出 V2 JSON</button>
          <button type="button" data-action="clear">清空</button>
        </div>
      </div>
    `;
    const style = document.createElement('style');
    style.textContent = `
      #${PANEL_ID} {
        position: fixed;
        right: 16px;
        bottom: 16px;
        z-index: 2147483647;
        width: 310px;
        color: #17202a;
        background: #ffffff;
        border: 1px solid #475569;
        border-radius: 8px;
        box-shadow: 0 10px 28px rgba(15, 23, 42, 0.22);
        font: 12px/1.45 Arial, "Microsoft YaHei", sans-serif;
      }
      #${PANEL_ID} .dxm-v2-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 10px;
        border-bottom: 1px solid #e5e7eb;
      }
      #${PANEL_ID} .dxm-v2-body {
        padding: 8px 10px 10px;
      }
      #${PANEL_ID} .dxm-v2-grid {
        display: grid;
        gap: 4px;
        margin: 8px 0;
      }
      #${PANEL_ID} .dxm-v2-count {
        display: flex;
        justify-content: space-between;
        gap: 8px;
      }
      #${PANEL_ID} .dxm-v2-actions {
        display: flex;
        gap: 6px;
      }
      #${PANEL_ID} button {
        min-height: 26px;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        background: #f8fafc;
        color: #111827;
        cursor: pointer;
        font: inherit;
      }
      #${PANEL_ID} button:hover {
        background: #eef2ff;
      }
      #${PANEL_ID} .dxm-v2-actions button {
        flex: 1;
      }
    `;
    document.documentElement.appendChild(style);
    document.documentElement.appendChild(panel);
    panel.addEventListener('click', (event) => {
      const action = event.target && event.target.getAttribute('data-action');
      if (action === 'toggle') {
        state.enabled = !state.enabled;
        GM_setValue('dxm_detector_v2_enabled', state.enabled);
        updatePanel();
      }
      if (action === 'export') exportRecords();
      if (action === 'clear') clearRecords();
    });
    state.panelReady = true;
    updatePanel();
  }

  function updatePanel() {
    if (!state.panelReady) return;
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    const counts = countRecords();
    const total = panel.querySelector('[data-field="total"]');
    const critical = panel.querySelector('[data-field="critical"]');
    const toggle = panel.querySelector('[data-action="toggle"]');
    const grid = panel.querySelector('[data-field="counts"]');
    if (total) total.textContent = String(counts.total);
    if (critical) critical.textContent = String(counts.critical);
    if (toggle) toggle.textContent = state.enabled ? '记录中' : '已暂停';
    if (grid) {
      grid.innerHTML = rules
        .filter((rule) => rule.critical)
        .map((rule) => `<div class="dxm-v2-count"><span>${rule.label}</span><strong>${counts[rule.type] || 0}</strong></div>`)
        .join('');
    }
  }

  function bootPanelWhenReady() {
    if (document.documentElement && document.body) {
      createPanel();
      return;
    }
    window.addEventListener('DOMContentLoaded', createPanel, { once: true });
  }

  hookFetch();
  hookXhr();
  attachActionListeners();
  recordNav('script_loaded');
  bootPanelWhenReady();

  const publicApi = {
    version: VERSION,
    getRecords: () => state.records.slice(),
    getNavEvents: () => state.navEvents.slice(),
    clearRecords,
    exportRecords,
    enable: () => {
      state.enabled = true;
      GM_setValue('dxm_detector_v2_enabled', true);
      updatePanel();
    },
    disable: () => {
      state.enabled = false;
      GM_setValue('dxm_detector_v2_enabled', false);
      updatePanel();
    },
  };
  window.__DXM_INTERFACE_DETECTOR_V2__ = publicApi;
  if (typeof unsafeWindow !== 'undefined') {
    unsafeWindow.__DXM_INTERFACE_DETECTOR_V2__ = publicApi;
  }
})();
