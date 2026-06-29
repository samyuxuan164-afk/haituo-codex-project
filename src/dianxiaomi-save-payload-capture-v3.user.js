// ==UserScript==
// @name         店小秘自动化系统 V1 - save.json Payload 抓取器 V3
// @namespace    https://codex.local/dianxiaomi-automation-v1
// @version      0.6.3
// @description  专门抓取页面保存/发布时的 save.json FormData，解开 choiceSave.zip/choiceSave.txt，用于和自动 payload 做 diff。
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

  const APP_NAME = '店小秘 save.json Payload 抓取器 V3';
  const VERSION = '0.6.3';
  const STORAGE_KEY = 'dxm_save_payload_capture_v3';
  const PANEL_ID = 'dxm-save-payload-capture-v3-panel';
  const MAX_RECORDS = 80;

  const state = {
    records: loadRecords(),
    lastAction: null,
    hookError: null,
  };

  function nowIso() {
    return new Date().toISOString();
  }

  function loadRecords() {
    const value = GM_getValue(STORAGE_KEY, []);
    return Array.isArray(value) ? value : [];
  }

  function saveRecords() {
    GM_setValue(STORAGE_KEY, state.records.slice(-MAX_RECORDS));
    exposeRecords();
  }

  function exposeRecords() {
    const snapshot = {
      app: APP_NAME,
      version: VERSION,
      updatedAt: nowIso(),
      records: state.records.slice(-MAX_RECORDS),
    };
    try {
      window.__DXM_SAVE_PAYLOAD_CAPTURE_V3_RECORDS__ = snapshot;
      if (typeof unsafeWindow !== 'undefined' && unsafeWindow) unsafeWindow.__DXM_SAVE_PAYLOAD_CAPTURE_V3_RECORDS__ = snapshot;
    } catch (_) {
      window.__DXM_SAVE_PAYLOAD_CAPTURE_V3_RECORDS__ = snapshot;
    }
  }

  function shortText(value, limit = 500) {
    const text = value == null ? '' : String(value);
    return text.length > limit ? `${text.slice(0, limit)}...[truncated ${text.length - limit}]` : text;
  }

  function pageContext() {
    return {
      href: location.href,
      title: document.title || '',
      readyState: document.readyState,
    };
  }

  function recordAction(event) {
    const target = event.target && event.target.closest
      ? event.target.closest('button,a,input,[role="button"],.el-button,.ant-btn') || event.target
      : event.target;
    if (!target) return;
    state.lastAction = {
      at: nowIso(),
      tag: target.tagName,
      text: shortText((target.innerText || target.value || target.title || '').trim(), 300),
      page: pageContext(),
    };
  }

  function readU16(bytes, offset) {
    return bytes[offset] | (bytes[offset + 1] << 8);
  }

  function readU32(bytes, offset) {
    return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
  }

  async function inflateRaw(bytes) {
    if (!('DecompressionStream' in window)) {
      throw new Error('当前浏览器不支持 DecompressionStream，无法解压 deflate zip');
    }
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async function extractChoiceSaveFromZip(blob) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const decoder = new TextDecoder('utf-8');
    let offset = 0;
    const entries = [];
    while (offset + 30 < bytes.length) {
      const signature = readU32(bytes, offset);
      if (signature !== 0x04034b50) break;
      const method = readU16(bytes, offset + 8);
      const compressedSize = readU32(bytes, offset + 18);
      const uncompressedSize = readU32(bytes, offset + 22);
      const fileNameLength = readU16(bytes, offset + 26);
      const extraLength = readU16(bytes, offset + 28);
      const nameStart = offset + 30;
      const dataStart = nameStart + fileNameLength + extraLength;
      const name = decoder.decode(bytes.slice(nameStart, nameStart + fileNameLength));
      const compressed = bytes.slice(dataStart, dataStart + compressedSize);
      let data;
      if (method === 0) data = compressed;
      else if (method === 8) data = await inflateRaw(compressed);
      else throw new Error(`不支持的 zip 压缩方法：${method}`);
      const text = decoder.decode(data);
      entries.push({ name, method, compressedSize, uncompressedSize, text });
      offset = dataStart + compressedSize;
    }
    const choice = entries.find((entry) => /choiceSave\.txt$/i.test(entry.name)) || entries[0];
    if (!choice) return { entries: [], choiceSaveText: '', choiceSaveJson: null };
    let choiceSaveJson = null;
    try {
      choiceSaveJson = JSON.parse(choice.text);
    } catch (_) {
      choiceSaveJson = null;
    }
    return {
      entries: entries.map((entry) => ({
        name: entry.name,
        method: entry.method,
        compressedSize: entry.compressedSize,
        uncompressedSize: entry.uncompressedSize,
      })),
      choiceSaveText: choice.text,
      choiceSaveJson,
    };
  }

  async function serializeSaveBody(body) {
    const result = {
      kind: '',
      op: '',
      fields: [],
      choiceSaveText: '',
      choiceSaveJson: null,
      zipEntries: [],
    };
    if (body instanceof FormData) {
      result.kind = 'formdata';
      for (const [name, value] of body.entries()) {
        if (value instanceof Blob) {
          const info = {
            name,
            kind: value instanceof File ? 'file' : 'blob',
            fileName: value instanceof File ? value.name : '',
            type: value.type || '',
            size: value.size,
          };
          result.fields.push(info);
          if (name === 'file') {
            const extracted = await extractChoiceSaveFromZip(value);
            result.choiceSaveText = extracted.choiceSaveText;
            result.choiceSaveJson = extracted.choiceSaveJson;
            result.zipEntries = extracted.entries;
          }
        } else {
          const item = { name, kind: 'value', value: String(value) };
          result.fields.push(item);
          if (name === 'op') result.op = String(value);
        }
      }
      return result;
    }
    result.kind = typeof body;
    result.fields.push({ name: 'body', value: shortText(body, 1000) });
    return result;
  }

  function summarizePayload(payload) {
    if (!payload || typeof payload !== 'object') return null;
    let variations = [];
    try {
      variations = JSON.parse(payload.variationListStr || '[]');
    } catch (_) {
      variations = [];
    }
    return {
      id: payload.id,
      op: payload.op,
      categoryId: payload.categoryId,
      postageId: payload.postageId,
      optionValues: payload.optionValues,
      optionValueIds: payload.optionValueIds,
      shipFrom: payload.shipFrom,
      variationCount: Array.isArray(variations) ? variations.length : 0,
      firstVariationKeys: Array.isArray(variations) && variations[0] ? Object.keys(variations[0]) : [],
      firstVariation: Array.isArray(variations) && variations[0] ? variations[0] : null,
    };
  }

  function classifyUrl(url) {
    const text = String(url || '').toLowerCase();
    if (/\/api\/smtlocalproduct\/save\.json|save\.json/.test(text)) return 'save_payload';
    if (/\/api\/smtlocalproduct\/edit\.json|edit\.json/.test(text)) return 'edit_json';
    if (/collect|collection|crawl|spider|link|url|claim|%e9%87%87%e9%9b%86|%e8%ae%a4%e9%a2%86/.test(text)) return 'link_collection_or_claim';
    if (/\/api\/smtlocalproduct\/|\/smtlocalproduct\//.test(text)) return 'product_api';
    if (/\/api\/smtlocalcategory\/attributelist\.json|categoryattrmatch|attribute.*category|category.*attribute/.test(text)) {
      return 'category_attribute';
    }
    if (/\/api\/smtlocalcategory\/|\/smtlocalcategory\/|category|cate/.test(text)) return 'category_search_or_tree';
    return 'other';
  }

  async function captureRecord(url, method, body, responseText, status) {
    const serialized = await serializeSaveBody(body);
    const record = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      createdAt: nowIso(),
      version: VERSION,
      page: pageContext(),
      lastAction: state.lastAction,
      request: {
        url,
        method,
        type: classifyUrl(url),
        body: serialized,
        summary: summarizePayload(serialized.choiceSaveJson),
      },
      response: {
        status,
        text: shortText(responseText, 12000),
      },
    };
    state.records.push(record);
    saveRecords();
    updatePanel();
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const data = event.data || {};
    if (data.source !== 'dxm-save-payload-capture-v3') return;
    if (data.type === 'hook-ready') {
      state.hookReady = {
        at: nowIso(),
        version: data.version,
        href: data.href,
      };
      updatePanel();
      return;
    }
    if (data.type !== 'save-record') return;
    const record = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      createdAt: nowIso(),
      version: VERSION,
      page: pageContext(),
      lastAction: state.lastAction,
      request: {
        url: data.record.url,
        method: data.record.method,
        type: classifyUrl(data.record.url),
        body: data.record.body,
        summary: summarizePayload(data.record.body && data.record.body.choiceSaveJson),
      },
      response: data.record.response || { status: 0, text: '' },
    };
    state.records.push(record);
    saveRecords();
    updatePanel();
  });

  function injectPageHook() {
    const code = `(${function pageHook() {
      if (window.__DXM_SAVE_PAYLOAD_CAPTURE_V3__) return;
      window.__DXM_SAVE_PAYLOAD_CAPTURE_V3__ = true;

      function readU16(bytes, offset) {
        return bytes[offset] | (bytes[offset + 1] << 8);
      }

      function readU32(bytes, offset) {
        return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
      }

      async function inflateRaw(bytes) {
        if (!('DecompressionStream' in window)) throw new Error('DecompressionStream unavailable');
        const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        return new Uint8Array(await new Response(stream).arrayBuffer());
      }

      async function extractChoiceSaveFromZip(blob) {
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const decoder = new TextDecoder('utf-8');
        let offset = 0;
        const entries = [];
        while (offset + 30 < bytes.length) {
          const signature = readU32(bytes, offset);
          if (signature !== 0x04034b50) break;
          const method = readU16(bytes, offset + 8);
          const compressedSize = readU32(bytes, offset + 18);
          const uncompressedSize = readU32(bytes, offset + 22);
          const fileNameLength = readU16(bytes, offset + 26);
          const extraLength = readU16(bytes, offset + 28);
          const nameStart = offset + 30;
          const dataStart = nameStart + fileNameLength + extraLength;
          const name = decoder.decode(bytes.slice(nameStart, nameStart + fileNameLength));
          const compressed = bytes.slice(dataStart, dataStart + compressedSize);
          let data;
          if (method === 0) data = compressed;
          else if (method === 8) data = await inflateRaw(compressed);
          else throw new Error('unsupported zip method ' + method);
          const text = decoder.decode(data);
          entries.push({ name, method, compressedSize, uncompressedSize, text });
          offset = dataStart + compressedSize;
        }
        const choice = entries.find((entry) => /choiceSave\\.txt$/i.test(entry.name)) || entries[0];
        let choiceSaveJson = null;
        if (choice) {
          try { choiceSaveJson = JSON.parse(choice.text); } catch (_) {}
        }
        return {
          entries: entries.map((entry) => ({
            name: entry.name,
            method: entry.method,
            compressedSize: entry.compressedSize,
            uncompressedSize: entry.uncompressedSize,
          })),
          choiceSaveText: choice ? choice.text : '',
          choiceSaveJson,
        };
      }

      async function serializeBody(body) {
        const result = {
          kind: '',
          op: '',
          fields: [],
          choiceSaveText: '',
          choiceSaveJson: null,
          zipEntries: [],
        };
        if (body instanceof FormData) {
          result.kind = 'formdata';
          for (const [name, value] of body.entries()) {
            if (value instanceof Blob) {
              result.fields.push({
                name,
                kind: value instanceof File ? 'file' : 'blob',
                fileName: value instanceof File ? value.name : '',
                type: value.type || '',
                size: value.size,
              });
              if (name === 'file') {
                try {
                  const extracted = await extractChoiceSaveFromZip(value);
                  result.choiceSaveText = extracted.choiceSaveText;
                  result.choiceSaveJson = extracted.choiceSaveJson;
                  result.zipEntries = extracted.entries;
                } catch (error) {
                  result.fields.push({ name: 'file_extract_error', kind: 'error', value: error.message });
                }
              }
            } else {
              const item = { name, kind: 'value', value: String(value) };
              result.fields.push(item);
              if (name === 'op') result.op = String(value);
            }
          }
          return result;
        }
        result.kind = Object.prototype.toString.call(body);
        result.fields.push({ name: 'body', kind: 'unknown', value: String(body || '').slice(0, 1000) });
        return result;
      }

      function postSaveRecord(record) {
        window.postMessage({
          source: 'dxm-save-payload-capture-v3',
          type: 'save-record',
          record,
        }, '*');
      }

      window.postMessage({
        source: 'dxm-save-payload-capture-v3',
        type: 'hook-ready',
        version: '0.6.0',
        href: location.href,
      }, '*');

      function shouldCaptureUrl(url) {
        const text = String(url || '').toLowerCase();
        return (
          text.includes('/api/smtlocalproduct/') ||
          text.includes('/smtlocalproduct/') ||
          text.includes('/api/smtlocalcategory/') ||
          text.includes('/smtlocalcategory/') ||
          text.includes('categoryattrmatch') ||
          text.includes('category') ||
          text.includes('cate') ||
          text.includes('save.json') ||
          text.includes('edit.json') ||
          text.includes('publish')
        );
      }

      async function capture(url, method, body, response) {
        try {
          const serialized = await serializeBody(body);
          postSaveRecord({
            url: String(url || ''),
            method: method || 'GET',
            body: serialized,
            response,
          });
        } catch (error) {
          postSaveRecord({
            url: String(url || ''),
            method: method || 'GET',
            body: { kind: 'error', fields: [{ name: 'capture_error', value: error.message }] },
            response,
          });
        }
      }

      const originalFetch = window.fetch;
      if (originalFetch) {
        window.fetch = async function patchedFetch(input, init) {
          const url = typeof input === 'string' ? input : input && input.url;
          const method = (init && init.method) || (input && input.method) || 'GET';
          const body = init && init.body;
          const response = await originalFetch.apply(this, arguments);
          if (shouldCaptureUrl(url)) {
            let text = '';
            try { text = await response.clone().text(); } catch (error) { text = '[response read failed: ' + error.message + ']'; }
            await capture(url, method, body, { status: response.status, text });
          }
          return response;
        };
      }

      const XHRProto = window.XMLHttpRequest && window.XMLHttpRequest.prototype;
      if (XHRProto && !XHRProto.__DXM_SAVE_PAYLOAD_CAPTURE_V3_PATCHED__) {
        XHRProto.__DXM_SAVE_PAYLOAD_CAPTURE_V3_PATCHED__ = true;
        const originalOpen = XHRProto.open;
        const originalSend = XHRProto.send;
        XHRProto.open = function patchedOpen(method, url) {
          this.__dxmSavePayloadMeta = { method: method || 'GET', url: String(url || ''), body: null };
          return originalOpen.apply(this, arguments);
        };
        XHRProto.send = function patchedSend(body) {
          const meta = this.__dxmSavePayloadMeta || { method: 'GET', url: '', body: null };
          meta.body = body || null;
          this.__dxmSavePayloadMeta = meta;
          if (shouldCaptureUrl(meta.url)) {
            this.addEventListener('loadend', function () {
              capture(meta.url, meta.method, meta.body, { status: this.status, text: this.responseText || '' });
            });
          }
          return originalSend.apply(this, arguments);
        };
      }
    }.toString()})();`;
    const script = document.createElement('script');
    script.textContent = code;
    (document.documentElement || document.head || document.body).appendChild(script);
    script.remove();
  }

  function shouldCaptureUrl(url) {
    const text = String(url || '').toLowerCase();
    return (
      text.includes('/api/smtlocalproduct/') ||
      text.includes('/smtlocalproduct/') ||
      text.includes('/api/smtlocalcategory/') ||
      text.includes('/smtlocalcategory/') ||
      text.includes('categoryattrmatch') ||
      text.includes('collect') ||
      text.includes('collection') ||
      text.includes('crawl') ||
      text.includes('spider') ||
      text.includes('link') ||
      text.includes('claim') ||
      text.includes('%e9%87%87%e9%9b%86') ||
      text.includes('%e8%ae%a4%e9%a2%86') ||
      text.includes('category') ||
      text.includes('cate') ||
      text.includes('save.json') ||
      text.includes('edit.json') ||
      text.includes('publish')
    );
  }

  function installUnsafeWindowHook() {
    const target = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    if (!target || target.__DXM_SAVE_PAYLOAD_CAPTURE_V3_UNSAFE__) return false;
    target.__DXM_SAVE_PAYLOAD_CAPTURE_V3_UNSAFE__ = true;

    state.hookReady = {
      at: nowIso(),
      version: `${VERSION}-unsafe`,
      href: location.href,
    };
    updatePanel();

    const originalFetch = target.fetch;
    if (originalFetch) {
      target.fetch = async function patchedFetch(input, init = {}) {
        const url = typeof input === 'string' ? input : input && input.url;
        const method = (init && init.method) || (input && input.method) || 'GET';
        const body = init && init.body;
        const response = await originalFetch.apply(this, arguments);
        if (shouldCaptureUrl(url)) {
          try {
            const text = await response.clone().text();
            await captureRecord(String(url), method, body, text, response.status);
          } catch (error) {
            await captureRecord(String(url), method, body, `[capture failed: ${error.message}]`, response.status);
          }
        }
        return response;
      };
    }

    const proto = target.XMLHttpRequest && target.XMLHttpRequest.prototype;
    if (proto && !proto.__DXM_SAVE_PAYLOAD_CAPTURE_V3_UNSAFE_PATCHED__) {
      proto.__DXM_SAVE_PAYLOAD_CAPTURE_V3_UNSAFE_PATCHED__ = true;
      const originalOpen = proto.open;
      const originalSend = proto.send;
      proto.open = function patchedOpen(method, url) {
        this.__dxmSavePayloadMeta = { method: method || 'GET', url: String(url || ''), body: null };
        return originalOpen.apply(this, arguments);
      };
      proto.send = function patchedSend(body) {
        const meta = this.__dxmSavePayloadMeta || { method: 'GET', url: '', body: null };
        meta.body = body || null;
        this.__dxmSavePayloadMeta = meta;
        if (shouldCaptureUrl(meta.url)) {
          this.addEventListener('loadend', function () {
            captureRecord(meta.url, meta.method, meta.body, this.responseText || '', this.status).catch((error) => {
              console.error(`[${APP_NAME}] unsafe XHR capture failed`, error);
            });
          });
        }
        return originalSend.apply(this, arguments);
      };
    }
    return true;
  }

  function downloadJson(value, fileName) {
    const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    GM_download({ url, name: fileName, saveAs: false, onload: () => URL.revokeObjectURL(url), onerror: () => URL.revokeObjectURL(url) });
  }

  function updatePanel() {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    const count = panel.querySelector('[data-field="count"]');
    const last = panel.querySelector('[data-field="last"]');
    const ready = panel.querySelector('[data-field="ready"]');
    if (count) count.textContent = String(state.records.length);
    if (ready) {
      ready.textContent = state.hookError
        ? `hook 异常：${state.hookError}`
        : state.hookReady
          ? `hook ${state.hookReady.version} 已注入`
          : 'hook 未确认';
    }
    const lastRecord = state.records[state.records.length - 1];
    if (last) {
      last.textContent = lastRecord
        ? `${lastRecord.createdAt} op=${lastRecord.request.body.op || ''} id=${lastRecord.request.summary && lastRecord.request.summary.id || ''}`
        : '暂无';
    }
    exposeRecords();
  }

  function createPanel() {
    if (document.getElementById(PANEL_ID)) return;
    const style = document.createElement('style');
    style.textContent = `
      #${PANEL_ID}{position:fixed;right:18px;bottom:18px;z-index:2147483647;width:300px;background:#fff;border:1px solid #475569;border-radius:8px;box-shadow:0 12px 30px rgba(15,23,42,.22);font:12px/1.45 Arial,"Microsoft YaHei",sans-serif;color:#111827}
      #${PANEL_ID} .h{display:flex;justify-content:space-between;padding:8px 10px;border-bottom:1px solid #e5e7eb;font-weight:700}
      #${PANEL_ID} .b{padding:10px}
      #${PANEL_ID} button{width:100%;min-height:28px;border:1px solid #cbd5e1;border-radius:6px;background:#f8fafc;cursor:pointer;margin-top:6px}
      #${PANEL_ID} .log{margin-top:6px;max-height:72px;overflow:auto;background:#f8fafc;border:1px solid #e5e7eb;border-radius:6px;padding:6px;word-break:break-all}
    `;
    (document.head || document.documentElement).appendChild(style);
    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <div class="h"><span>save Payload V3 ${VERSION}</span><span>记录 <b data-field="count">0</b></span></div>
      <div class="b">
        <button type="button" data-action="export">导出保存payload JSON</button>
        <button type="button" data-action="clear">清空记录</button>
        <div class="log" data-field="ready">hook 未确认</div>
        <div class="log" data-field="last">暂无</div>
      </div>
    `;
    (document.body || document.documentElement).appendChild(panel);
    panel.addEventListener('click', (event) => {
      const action = event.target && event.target.getAttribute('data-action');
      if (action === 'export') downloadJson({ app: APP_NAME, version: VERSION, records: state.records }, `dxm-save-payload-v3-${Date.now()}.json`);
      if (action === 'clear') {
        state.records = [];
        GM_deleteValue(STORAGE_KEY);
        exposeRecords();
        updatePanel();
      }
    });
    updatePanel();
  }

  function installHooksSafely() {
    try {
      if (!installUnsafeWindowHook()) injectPageHook();
    } catch (error) {
      state.hookError = error && error.message ? error.message : String(error);
      console.error(`[${APP_NAME}] hook install failed`, error);
    }
  }

  function createPanelSafely() {
    try {
      createPanel();
    } catch (error) {
      const message = error && error.message ? error.message : String(error);
      console.error(`[${APP_NAME}] panel create failed`, error);
    }
  }

  document.addEventListener('click', recordAction, true);
  installHooksSafely();
  exposeRecords();
  if (document.body) createPanelSafely();
  else window.addEventListener('DOMContentLoaded', createPanelSafely, { once: true });
  setTimeout(createPanelSafely, 1000);
  setTimeout(createPanelSafely, 3000);
})();
