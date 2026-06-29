// ==UserScript==
// @name         店小秘自动化系统 V1 - 接口探测器
// @namespace    https://codex.local/dianxiaomi-automation-v1
// @version      0.1.0
// @description  Hook fetch 和 XMLHttpRequest，记录店小秘模板保存、采集箱、助手设置、开始、暂停/结束、任务状态等接口候选。
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

  const APP_NAME = '店小秘自动化系统 V1';
  const STORAGE_KEY = 'dxm_interface_detector_records_v1';
  const MAX_BODY_LENGTH = 8000;
  const MAX_RESPONSE_LENGTH = 12000;
  const PANEL_ID = 'dxm-interface-detector-panel';

  const categoryRules = [
    {
      type: 'template_save',
      label: '模板保存接口',
      keywords: ['save', 'update', 'edit', 'product', 'goods', 'item', '刊登', '产品', '保存'],
    },
    {
      type: 'collection_list',
      label: '采集箱列表接口',
      keywords: ['collect', 'collection', 'box', 'list', 'page', 'query', '采集', '采集箱', '列表'],
    },
    {
      type: 'assistant_setting',
      label: '助手设置接口',
      keywords: ['assistant', 'setting', 'config', 'rule', 'template', 'category', 'attribute', 'price', '助手', '设置', '分类', '属性', '价格'],
    },
    {
      type: 'start',
      label: '开始接口',
      keywords: ['start', 'run', 'execute', 'publish', 'batch', '开始', '启动', '发布', '批量'],
    },
    {
      type: 'pause_or_finish',
      label: '暂停/结束接口',
      keywords: ['pause', 'stop', 'finish', 'end', 'cancel', 'close', '暂停', '结束', '停止'],
    },
    {
      type: 'task_status',
      label: '任务状态接口',
      keywords: ['status', 'progress', 'result', 'task', 'job', 'log', '状态', '进度', '结果', '任务'],
    },
  ];

  const state = {
    enabled: GM_getValue('dxm_detector_enabled', true),
    records: loadRecords(),
    panelReady: false,
  };

  function nowIso() {
    return new Date().toISOString();
  }

  function safeString(value, maxLength = MAX_BODY_LENGTH) {
    if (value == null) return '';
    try {
      if (typeof value === 'string') return value.slice(0, maxLength);
      if (value instanceof URLSearchParams) return value.toString().slice(0, maxLength);
      if (value instanceof FormData) {
        const pairs = [];
        value.forEach((entryValue, key) => {
          if (entryValue instanceof File) {
            pairs.push([key, `[File:${entryValue.name}:${entryValue.size}]`]);
          } else {
            pairs.push([key, String(entryValue)]);
          }
        });
        return JSON.stringify(pairs).slice(0, maxLength);
      }
      if (value instanceof Blob) return `[Blob:${value.type}:${value.size}]`;
      if (value instanceof ArrayBuffer) return `[ArrayBuffer:${value.byteLength}]`;
      return JSON.stringify(value).slice(0, maxLength);
    } catch (error) {
      return `[Unserializable:${error && error.message ? error.message : 'unknown'}]`;
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

  function normalizeUrl(input) {
    try {
      if (typeof input === 'string') return input;
      if (input && typeof input.url === 'string') return input.url;
      return String(input);
    } catch (_) {
      return '';
    }
  }

  function getPageContext() {
    return {
      href: location.href,
      pathname: location.pathname,
      title: document.title || '',
    };
  }

  function classify(record) {
    const haystack = [
      record.url,
      record.method,
      record.requestBody,
      record.responseText,
      record.page && record.page.href,
      record.page && record.page.title,
    ].join(' ').toLowerCase();

    const matches = [];
    categoryRules.forEach((rule) => {
      const score = rule.keywords.reduce((count, keyword) => {
        return count + (haystack.includes(String(keyword).toLowerCase()) ? 1 : 0);
      }, 0);
      if (score > 0) {
        matches.push({ type: rule.type, label: rule.label, score });
      }
    });
    matches.sort((a, b) => b.score - a.score);
    return matches;
  }

  function loadRecords() {
    const value = GM_getValue(STORAGE_KEY, []);
    return Array.isArray(value) ? value : [];
  }

  function saveRecords() {
    GM_setValue(STORAGE_KEY, state.records.slice(-1000));
  }

  function addRecord(record) {
    if (!state.enabled) return;
    const fullRecord = Object.assign(
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        createdAt: nowIso(),
        page: getPageContext(),
        matches: [],
      },
      record
    );
    fullRecord.matches = classify(fullRecord);
    state.records.push(fullRecord);
    saveRecords();
    updatePanel();
    if (fullRecord.matches.length > 0) {
      console.info(`[${APP_NAME}] 捕获候选接口`, fullRecord.matches[0].label, fullRecord);
    }
  }

  function hookFetch() {
    if (!window.fetch || window.fetch.__dxmHooked) return;
    const originalFetch = window.fetch;

    window.fetch = async function dxmFetchHook(input, init = {}) {
      const startedAt = performance.now();
      const url = normalizeUrl(input);
      const method =
        (init && init.method) ||
        (input && input.method) ||
        'GET';
      const requestHeaders = headersToObject((init && init.headers) || (input && input.headers));
      const requestBody = safeString(init && init.body);

      try {
        const response = await originalFetch.apply(this, arguments);
        const cloned = response.clone();
        cloned
          .text()
          .then((text) => {
            addRecord({
              source: 'fetch',
              url,
              method: String(method).toUpperCase(),
              requestHeaders,
              requestBody,
              status: response.status,
              ok: response.ok,
              durationMs: Math.round(performance.now() - startedAt),
              responseText: safeString(text, MAX_RESPONSE_LENGTH),
              responseHeaders: headersToObject(response.headers),
            });
          })
          .catch((error) => {
            addRecord({
              source: 'fetch',
              url,
              method: String(method).toUpperCase(),
              requestHeaders,
              requestBody,
              status: response.status,
              ok: response.ok,
              durationMs: Math.round(performance.now() - startedAt),
              responseError: error && error.message ? error.message : String(error),
            });
          });
        return response;
      } catch (error) {
        addRecord({
          source: 'fetch',
          url,
          method: String(method).toUpperCase(),
          requestHeaders,
          requestBody,
          durationMs: Math.round(performance.now() - startedAt),
          networkError: error && error.message ? error.message : String(error),
        });
        throw error;
      }
    };
    window.fetch.__dxmHooked = true;
  }

  function hookXhr() {
    if (!window.XMLHttpRequest || window.XMLHttpRequest.prototype.__dxmHooked) return;

    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;
    const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;

    XMLHttpRequest.prototype.open = function dxmOpenHook(method, url) {
      this.__dxmMeta = {
        source: 'xhr',
        method: String(method || 'GET').toUpperCase(),
        url: normalizeUrl(url),
        requestHeaders: {},
        startedAt: 0,
      };
      return originalOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.setRequestHeader = function dxmHeaderHook(key, value) {
      if (this.__dxmMeta) {
        this.__dxmMeta.requestHeaders[key] = value;
      }
      return originalSetRequestHeader.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function dxmSendHook(body) {
      const xhr = this;
      const meta = xhr.__dxmMeta || {
        source: 'xhr',
        method: 'GET',
        url: '',
        requestHeaders: {},
      };
      meta.startedAt = performance.now();
      meta.requestBody = safeString(body);

      xhr.addEventListener('loadend', function () {
        let responseText = '';
        try {
          const contentType = xhr.getResponseHeader('content-type') || '';
          if (xhr.responseType === '' || xhr.responseType === 'text' || contentType.includes('json')) {
            responseText = safeString(xhr.responseText, MAX_RESPONSE_LENGTH);
          } else {
            responseText = `[responseType:${xhr.responseType}]`;
          }
        } catch (error) {
          responseText = `[UnreadableResponse:${error && error.message ? error.message : 'unknown'}]`;
        }

        addRecord({
          source: 'xhr',
          url: meta.url,
          method: meta.method,
          requestHeaders: meta.requestHeaders,
          requestBody: meta.requestBody,
          status: xhr.status,
          ok: xhr.status >= 200 && xhr.status < 300,
          durationMs: Math.round(performance.now() - meta.startedAt),
          responseText,
          responseHeadersRaw: safeString(xhr.getAllResponseHeaders(), 4000),
        });
      });

      return originalSend.apply(this, arguments);
    };

    XMLHttpRequest.prototype.__dxmHooked = true;
  }

  function countByType() {
    const counts = {};
    categoryRules.forEach((rule) => {
      counts[rule.type] = 0;
    });
    state.records.forEach((record) => {
      const top = record.matches && record.matches[0];
      if (top) counts[top.type] = (counts[top.type] || 0) + 1;
    });
    return counts;
  }

  function exportRecords() {
    const payload = {
      app: APP_NAME,
      version: '0.1.0',
      exportedAt: nowIso(),
      page: getPageContext(),
      records: state.records,
    };
    const text = JSON.stringify(payload, null, 2);
    const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    GM_download({
      url,
      name: `dxm-interface-records-${Date.now()}.json`,
      saveAs: true,
      onload: () => URL.revokeObjectURL(url),
      onerror: () => URL.revokeObjectURL(url),
    });
  }

  function clearRecords() {
    state.records = [];
    GM_deleteValue(STORAGE_KEY);
    updatePanel();
  }

  function createPanel() {
    if (document.getElementById(PANEL_ID)) return;
    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <div class="dxm-header">
        <strong>店小秘自动化 V1</strong>
        <button type="button" data-action="toggle"></button>
      </div>
      <div class="dxm-body">
        <div class="dxm-row">捕获总数：<span data-field="total">0</span></div>
        <div class="dxm-grid" data-field="counts"></div>
        <div class="dxm-actions">
          <button type="button" data-action="export">导出 JSON</button>
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
        width: 280px;
        color: #17202a;
        background: #ffffff;
        border: 1px solid #9aa4b2;
        border-radius: 8px;
        box-shadow: 0 10px 28px rgba(15, 23, 42, 0.22);
        font: 12px/1.45 Arial, "Microsoft YaHei", sans-serif;
      }
      #${PANEL_ID} .dxm-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 10px;
        border-bottom: 1px solid #e5e7eb;
      }
      #${PANEL_ID} .dxm-body {
        padding: 8px 10px 10px;
      }
      #${PANEL_ID} .dxm-row {
        margin-bottom: 6px;
      }
      #${PANEL_ID} .dxm-grid {
        display: grid;
        gap: 4px;
        margin-bottom: 8px;
      }
      #${PANEL_ID} .dxm-count {
        display: flex;
        justify-content: space-between;
        gap: 8px;
      }
      #${PANEL_ID} .dxm-actions {
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
      #${PANEL_ID} [data-action="toggle"] {
        width: 54px;
      }
      #${PANEL_ID} .dxm-actions button {
        flex: 1;
      }
    `;
    document.documentElement.appendChild(style);
    document.documentElement.appendChild(panel);

    panel.addEventListener('click', (event) => {
      const action = event.target && event.target.getAttribute('data-action');
      if (action === 'toggle') {
        state.enabled = !state.enabled;
        GM_setValue('dxm_detector_enabled', state.enabled);
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
    const total = panel.querySelector('[data-field="total"]');
    const toggle = panel.querySelector('[data-action="toggle"]');
    const counts = panel.querySelector('[data-field="counts"]');
    if (total) total.textContent = String(state.records.length);
    if (toggle) toggle.textContent = state.enabled ? '记录中' : '已暂停';
    if (counts) {
      const byType = countByType();
      counts.innerHTML = categoryRules
        .map((rule) => `<div class="dxm-count"><span>${rule.label}</span><strong>${byType[rule.type] || 0}</strong></div>`)
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
  bootPanelWhenReady();

  const publicApi = {
    getRecords: () => state.records.slice(),
    clearRecords,
    exportRecords,
    enable: () => {
      state.enabled = true;
      GM_setValue('dxm_detector_enabled', true);
      updatePanel();
    },
    disable: () => {
      state.enabled = false;
      GM_setValue('dxm_detector_enabled', false);
      updatePanel();
    },
  };
  window.__DXM_INTERFACE_DETECTOR_V1__ = publicApi;
  if (typeof unsafeWindow !== 'undefined') {
    unsafeWindow.__DXM_INTERFACE_DETECTOR_V1__ = publicApi;
  }
})();
