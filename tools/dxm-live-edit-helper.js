#!/usr/bin/env node
'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_ENDPOINT = 'http://127.0.0.1:10086/command';
const DEFAULT_SESSION = 'dxm-live-edit-helper';
const DEFAULT_DRAFT_URL = 'https://www.dianxiaomi.com/web/smtlocalProduct/draft';
const DEFAULT_WAIT_URL = 'https://www.dianxiaomi.com/web/smtlocalProduct/offline';
const DEFAULT_PRICE_STORE = path.join(ROOT, 'runs', 'amazon-price-store.json');
const DEFAULT_EVIDENCE_STORE = path.join(ROOT, 'runs', 'aliexpress-evidence-store.json');
const DEFAULT_SOURCE = path.join(ROOT, 'src', 'dianxiaomi-automation-v1-merged-new.user.js');

function parseArgs(argv) {
  const args = {
    command: argv[2] || 'help',
    endpoint: process.env.WEBBRIDGE_ENDPOINT || DEFAULT_ENDPOINT,
    session: process.env.WEBBRIDGE_SESSION || DEFAULT_SESSION,
    url: '',
    asin: '',
    title: '',
    field: '',
    x: '',
    y: '',
    timeoutMs: Number(process.env.WEBBRIDGE_TIMEOUT_MS || 20000),
    loadTimeoutMs: Number(process.env.DXM_EDIT_LOAD_TIMEOUT_MS || 20000),
    retries: Number(process.env.DXM_EDIT_OPEN_RETRIES || 2),
    editId: '',
    expectedVersion: process.env.DXM_EXPECTED_VERSION || '',
    groupTitle: '店小秘编辑验证',
    newTab: undefined,
    priceStore: DEFAULT_PRICE_STORE,
    evidenceStore: DEFAULT_EVIDENCE_STORE,
    source: DEFAULT_SOURCE,
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
    } else if (arg === '--asin' && next) {
      args.asin = next.trim().toUpperCase();
      i += 1;
    } else if (arg === '--title' && next) {
      args.title = next.trim();
      i += 1;
    } else if (arg === '--field' && next) {
      args.field = next.trim();
      i += 1;
    } else if (arg === '--x' && next) {
      args.x = Number(next);
      i += 1;
    } else if (arg === '--y' && next) {
      args.y = Number(next);
      i += 1;
    } else if (arg === '--timeout-ms' && next) {
      args.timeoutMs = Number(next);
      i += 1;
    } else if (arg === '--load-timeout-ms' && next) {
      args.loadTimeoutMs = Number(next);
      i += 1;
    } else if (arg === '--retries' && next) {
      args.retries = Number(next);
      i += 1;
    } else if (arg === '--edit-id' && next) {
      args.editId = next.trim();
      i += 1;
    } else if (arg === '--expected-version' && next) {
      args.expectedVersion = next.trim();
      i += 1;
    } else if (arg === '--group-title' && next) {
      args.groupTitle = next.trim();
      i += 1;
    } else if (arg === '--new-tab') {
      args.newTab = true;
    } else if (arg === '--same-tab') {
      args.newTab = false;
    } else if (arg === '--price-store' && next) {
      args.priceStore = path.resolve(next);
      i += 1;
    } else if (arg === '--evidence-store' && next) {
      args.evidenceStore = path.resolve(next);
      i += 1;
    } else if (arg === '--source' && next) {
      args.source = path.resolve(next);
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
    tool: 'dxm-live-edit-helper',
    commands: {
      bind: 'Find or open a Dianxiaomi tab for this session.',
      forceEdit: 'Open a clean direct edit URL, accept intentional leave-site dialogs, inject userscript, and verify URL/ASIN/version before editing.',
      sync: 'Sync local price/evidence stores into the current Dianxiaomi page localStorage.',
      locate: 'Readonly locate an ASIN row and candidate edit links/buttons on the current page.',
      resolveEditId: 'Readonly resolve the real DXM edit id/edit URL for --asin from the current collection-box row.',
      list: 'Readonly list visible Dianxiaomi collection-box rows with titles, prices, and action controls.',
      openEditByTitle: 'Click the edit control in the visible row whose title contains --title. This opens edit page only.',
      openEditByTitleCdp: 'Use browser-level mouse events on the edit control in the row whose title contains --title.',
      inspectEditByTitle: 'Readonly inspect the edit control DOM/attributes for the row whose title contains --title.',
      inspectVueByTitle: 'Readonly inspect nearby Vue component props/state for product ids in the row whose title contains --title.',
      elementAt: 'Readonly inspect document.elementFromPoint(--x,--y).',
      clickTextCdp: 'Use browser-level mouse events to click the smallest visible button/control containing --title text.',
      inject: 'Inject the current local DXM userscript into the active Dianxiaomi page runtime.',
      readonly: 'Read window.__DXM_AUTOMATION_V1_READONLY_PREFLIGHT__ from the active page.',
      inspectRequiredAttr: 'Readonly inspect one required attribute DOM by --field.',
      apply: 'Run window.__DXM_AUTOMATION_V1_APPLY_EDIT_RULES__ on the active edit page. This edits fields but does not save.',
      resetPipeline: 'Readonly reset the visible edit pipeline runtime lock after a timed-out field fill.',
      categoryPrice: 'Run only category selection/finalize and current-ASIN price fill. This edits fields but does not save.',
      shippingPostage: 'Run only Ships From and postage template 111 selection. This edits fields but does not save.',
      requiredAttrs: 'Run only required attribute dropdown selection. This edits fields but does not save.',
      requiredAttrField: 'Run one required attribute field by --field. This edits that field but does not save.',
      variationPreflight: 'Run only required variation handling and final preflight. This edits fields but does not save.',
      resume: 'Run segmented remaining-field recovery on the active edit page. This edits fields but does not save.',
      save: 'Run the page panel preflight-save button equivalent if final preflight passes. This can save/move to wait-publish.',
      snapshot: 'Return a compact page snapshot.',
    },
    safety: [
      'bind/sync/locate/inject/readonly/inspectRequiredAttr/snapshot do not click business buttons.',
      'forceEdit only opens/reopens the target edit page and accepts leave-site dialogs caused by that intentional page change; it does not edit or save.',
      'apply/categoryPrice/shippingPostage/requiredAttrs/variationPreflight/resume edit visible fields on the current edit page but do not save.',
      'requiredAttrField supports --field brand|feature|high_concerned_chemical|origin|material|function|use.',
      'When --asin is provided, apply/resume/save and segmented edit commands refuse to run unless the edit page ASIN matches.',
      'save can click native save/move-to-wait-publish only through the userscript preflight gate.',
      'This helper never publishes, one-click publishes, collects, claims, deletes, carts, orders, or chats.',
    ],
  };
}

function normalize(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function buildExpectedAsinGuard(args) {
  return `
    const expectedAsin = ${JSON.stringify(args.asin || '')};
    const normalizeAsin = (value) => {
      const match = String(value || '').toUpperCase().match(/\\bB0[A-Z0-9]{8}\\b/);
      return match ? match[0] : '';
    };
    const checkExpectedAsin = (readback) => {
      if (!expectedAsin) return { ok: true, expectedAsin: '', actualAsin: '' };
      const actualAsin = normalizeAsin((readback && readback.asin) || (readback && readback.sourceUrl) || '');
      return {
        ok: actualAsin === expectedAsin,
        expectedAsin,
        actualAsin,
        sourceUrl: readback && readback.sourceUrl || '',
      };
    };
    const readAndCheckExpectedAsin = () => {
      if (!expectedAsin) return { ok: true, expectedAsin: '', actualAsin: '', readback: null };
      if (typeof window.__DXM_AUTOMATION_V1_READONLY_PREFLIGHT__ !== 'function') {
        return { ok: false, reason: 'readonly_function_missing_for_asin_guard', expectedAsin };
      }
      const readback = window.__DXM_AUTOMATION_V1_READONLY_PREFLIGHT__();
      const guard = checkExpectedAsin(readback);
      return { ...guard, readback, reason: guard.ok ? '' : 'expected_asin_mismatch' };
    };
  `;
}

async function post(args, action, commandArgs = {}) {
  const body = JSON.stringify({ action, args: commandArgs, session: args.session });
  return new Promise((resolve) => {
    const endpoint = new URL(args.endpoint);
    const req = http.request({
      method: 'POST',
      hostname: endpoint.hostname,
      port: endpoint.port || 80,
      path: `${endpoint.pathname}${endpoint.search}`,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: args.timeoutMs,
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        try {
          resolve(JSON.parse(text));
        } catch (_) {
          resolve({ ok: false, raw: text });
        }
      });
    });
    req.on('timeout', () => {
      req.destroy(new Error('webbridge_timeout'));
    });
    req.on('error', (error) => {
      resolve({ ok: false, error: String(error && error.message ? error.message : error) });
    });
    req.write(body);
    req.end();
  });
}

function extractValue(response) {
  if (!response) return '';
  const data = response.data || {};
  if (data.value != null) return data.value;
  if (data.data && data.data.value != null) return data.data.value;
  if (data.result && data.result.value != null) return data.result.value;
  return '';
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout(args, timeoutMs) {
  return { ...args, timeoutMs: Number(timeoutMs || args.timeoutMs || 20000) };
}

function isOkResponse(response) {
  return response && response.ok !== false && !response.error;
}

function getEditIdFromUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.searchParams.get('id') || '';
  } catch (_) {
    const match = String(url || '').match(/[?&]id=([^&#]+)/);
    return match ? decodeURIComponent(match[1]) : '';
  }
}

function buildTargetEditUrl(args) {
  if (args.url) return args.url;
  if (args.editId) return `https://www.dianxiaomi.com/web/smtlocalProduct/edit?id=${encodeURIComponent(args.editId)}`;
  return '';
}

async function acceptIntentionalLeaveDialog(args) {
  const response = await post(withTimeout(args, 5000), 'cdp', {
    method: 'Page.handleJavaScriptDialog',
    params: { accept: true },
  });
  return {
    ok: isOkResponse(response),
    note: isOkResponse(response) ? 'accepted_leave_site_dialog' : 'no_dialog_or_not_supported',
    raw: response,
  };
}

async function verifyCleanEditPage(args, targetUrl) {
  const targetEditId = getEditIdFromUrl(targetUrl) || args.editId || '';
  const code = `(() => {
    const normalizeAsin = (value) => {
      const match = String(value || '').toUpperCase().match(/\\bB0[A-Z0-9]{8}\\b/);
      return match ? match[0] : '';
    };
    const getVersionFromPage = () => (
      document.documentElement.getAttribute('data-dxm-automation-version') ||
      (document.body ? String(document.body.innerText || '').match(/DXM Automation V1[^\\n]*/)?.[0] || '' : '')
    );
    let readonly = null;
    let readonlyError = '';
    try {
      if (typeof window.__DXM_AUTOMATION_V1_READONLY_PREFLIGHT__ === 'function') {
        readonly = window.__DXM_AUTOMATION_V1_READONLY_PREFLIGHT__();
      }
    } catch (error) {
      readonlyError = String(error && error.message ? error.message : error);
    }
    return JSON.stringify({
      href: location.href,
      title: document.title,
      readyState: document.readyState,
      isEditPage: /\\/web\\/smtlocalProduct\\/edit\\b/.test(location.href),
      editId: new URL(location.href).searchParams.get('id') || '',
      version: readonly && readonly.version || getVersionFromPage(),
      asin: normalizeAsin((readonly && readonly.asin) || (readonly && readonly.sourceUrl) || document.body && document.body.innerText || ''),
      sourceUrl: readonly && readonly.sourceUrl || '',
      hasReadonly: typeof window.__DXM_AUTOMATION_V1_READONLY_PREFLIGHT__ === 'function',
      readonlyError,
    });
  })()`;
  const response = await post(args, 'evaluate', { code });
  const page = JSON.parse(extractValue(response) || '{}');
  const expectedVersion = args.expectedVersion || '';
  const issues = [];
  if (!isOkResponse(response)) issues.push(`evaluate_failed: ${response && response.error || 'unknown'}`);
  if (page.readyState !== 'complete' && page.readyState !== 'interactive') issues.push(`page_not_loaded: ${page.readyState || 'unknown'}`);
  if (!page.isEditPage) issues.push('not_edit_page');
  if (targetEditId && page.editId !== targetEditId) issues.push(`edit_id_mismatch: expected ${targetEditId}, actual ${page.editId || '(empty)'}`);
  if (args.asin && page.asin !== args.asin) issues.push(`asin_mismatch: expected ${args.asin}, actual ${page.asin || '(empty)'}`);
  if (expectedVersion && !String(page.version || '').includes(expectedVersion)) {
    issues.push(`version_mismatch: expected ${expectedVersion}, actual ${page.version || '(empty)'}`);
  }
  if (!page.hasReadonly) issues.push('readonly_function_missing');
  if (page.readonlyError) issues.push(`readonly_error: ${page.readonlyError}`);
  return {
    ok: issues.length === 0,
    issues,
    page,
    raw: response,
  };
}

async function forceEdit(args) {
  const targetUrl = buildTargetEditUrl(args);
  if (!targetUrl) {
    return { ok: false, reason: 'missing_target_edit_url', hint: 'Use --url or --edit-id.' };
  }

  const attempts = [];
  const maxAttempts = Math.max(1, Number(args.retries || 2));
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const attemptRecord = { attempt };
    const navigateArgs = {
      url: targetUrl,
      newTab: args.newTab === undefined ? attempt === 1 : Boolean(args.newTab),
      group_title: args.groupTitle || '店小秘编辑验证',
    };
    attemptRecord.navigate = await post(withTimeout(args, args.loadTimeoutMs), 'navigate', navigateArgs);
    if (!isOkResponse(attemptRecord.navigate)) {
      attemptRecord.leaveDialogAfterNavigateFailure = await acceptIntentionalLeaveDialog(args);
      attemptRecord.navigateRetrySameTab = await post(withTimeout(args, args.loadTimeoutMs), 'navigate', {
        ...navigateArgs,
        newTab: false,
      });
    }

    await sleep(1500);
    attemptRecord.inject = await inject(args);
    await sleep(500);
    attemptRecord.verify = await verifyCleanEditPage(args, targetUrl);
    attempts.push(attemptRecord);

    if (attemptRecord.verify.ok) {
      return {
        ok: true,
        mode: 'clean_edit_page_ready',
        targetUrl,
        expectedAsin: args.asin || '',
        expectedVersion: args.expectedVersion || '',
        attempts,
        page: attemptRecord.verify.page,
      };
    }

    if (attempt < maxAttempts) {
      attemptRecord.leaveDialogBeforeRetry = await acceptIntentionalLeaveDialog(args);
    }
  }

  return {
    ok: false,
    reason: 'clean_edit_page_not_ready',
    targetUrl,
    expectedAsin: args.asin || '',
    expectedVersion: args.expectedVersion || '',
    attempts,
    nextAction: 'stop_and_record_environment_control_exception',
  };
}

async function bind(args) {
  if (args.url) {
    const opened = await post(withTimeout(args, args.loadTimeoutMs), 'navigate', {
      url: args.url,
      newTab: args.newTab === undefined ? true : Boolean(args.newTab),
      group_title: args.groupTitle || '店小秘编辑验证',
    });
    return { ok: !(opened && opened.error), page: opened.data || opened };
  }
  const found = await post(args, 'find_tab', { url: 'https://www.dianxiaomi.com', active: true });
  if (found && found.ok !== false && !(found.error)) return { ok: true, page: found.data || found };
  const opened = await post(args, 'navigate', {
    url: args.url || DEFAULT_DRAFT_URL,
    newTab: true,
    group_title: args.groupTitle || '店小秘编辑验证',
  });
  return { ok: !(opened && opened.error), page: opened.data || opened };
}

async function syncStores(args) {
  const bound = await bind(args);
  if (!bound.ok) return { ok: false, stage: 'bind', bound };
  const price = JSON.parse(fs.readFileSync(args.priceStore, 'utf8'));
  const evidence = JSON.parse(fs.readFileSync(args.evidenceStore, 'utf8'));
  const pricePayload = {
    schemaVersion: 'amazon-price-store-v1',
    updatedAt: price.updatedAt || '',
    records: price.records || {},
  };
  const evidencePayload = {
    schemaVersion: 'aliexpress-evidence-store-v1',
    updatedAt: evidence.updatedAt || '',
    records: evidence.records || {},
  };
  const code = `(() => {
    const priceKey = 'dxm_amazon_price_store_v1';
    const evidenceKey = 'dxm_aliexpress_evidence_store_v1';
    localStorage.setItem(priceKey, ${JSON.stringify(JSON.stringify(pricePayload))});
    localStorage.setItem(evidenceKey, ${JSON.stringify(JSON.stringify(evidencePayload))});
    window.__DXM_AMAZON_PRICE_STORE__ = JSON.parse(localStorage.getItem(priceKey));
    window.__DXM_ALIEXPRESS_EVIDENCE_STORE__ = JSON.parse(localStorage.getItem(evidenceKey));
    return JSON.stringify({
      href: location.href,
      title: document.title,
      priceRecords: Object.keys(window.__DXM_AMAZON_PRICE_STORE__.records || {}).length,
      evidenceRecords: Object.keys(window.__DXM_ALIEXPRESS_EVIDENCE_STORE__.records || {}).length,
      b0f1Price: window.__DXM_AMAZON_PRICE_STORE__.records.B0F1DDLKBB && window.__DXM_AMAZON_PRICE_STORE__.records.B0F1DDLKBB.amazonDisplayedPriceUsd,
      b0ctPrice: window.__DXM_AMAZON_PRICE_STORE__.records.B0CTBQCKL9 && window.__DXM_AMAZON_PRICE_STORE__.records.B0CTBQCKL9.amazonDisplayedPriceUsd
    });
  })()`;
  const response = await post(args, 'evaluate', { code });
  return { ok: response && response.ok !== false && !response.error, bound, sync: JSON.parse(extractValue(response) || '{}'), raw: response };
}

async function locate(args) {
  if (!args.asin) throw new Error('locate requires --asin');
  const code = `(() => {
    const asin = ${JSON.stringify(args.asin)};
    const norm = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
    const rowSelector = 'tr,.ant-table-row,.vxe-body--row,li,[class*="table-row"],[class*="product"],[class*="list-item"],[class*="goods"],[class*="row"]';
    const candidates = Array.from(document.querySelectorAll('body *')).filter((node) => norm(node.innerText || node.textContent).includes(asin));
    let best = null;
    for (const node of candidates) {
      let current = node;
      for (let depth = 0; current && depth < 8; depth += 1, current = current.parentElement) {
        if (!current || current === document.body) break;
        const text = norm(current.innerText || current.textContent);
        if (!text.includes(asin)) continue;
        const rowLike = current.matches && current.matches(rowSelector);
        const links = Array.from(current.querySelectorAll('a,button,[role="button"]')).map((item, index) => ({
          index,
          text: norm(item.innerText || item.textContent || item.value),
          href: item.href || '',
          title: item.getAttribute('title') || '',
          aria: item.getAttribute('aria-label') || '',
          onclick: String(item.getAttribute('onclick') || '').slice(0, 220),
        })).filter((item) => item.text || item.href || item.title || item.aria || item.onclick).slice(0, 40);
        const score = (rowLike ? 10000 : 0) - Math.abs(text.length - 1000) - depth * 100;
        if (!best || score > best.score) {
          best = {
            tag: current.tagName,
            className: String(current.className || '').slice(0, 160),
            score,
            text: text.slice(0, 3500),
            links,
          };
        }
      }
    }
    return JSON.stringify({
      href: location.href,
      title: document.title,
      asin,
      found: Boolean(best),
      row: best,
      bodySnippet: norm(document.body && document.body.innerText).slice(0, 1200),
    });
  })()`;
  const response = await post(args, 'evaluate', { code });
  return { ok: response && response.ok !== false && !response.error, locate: JSON.parse(extractValue(response) || '{}'), raw: response };
}

async function resolveEditId(args) {
  if (!args.asin) throw new Error('resolveEditId requires --asin');
  const code = `(() => {
    const asin = ${JSON.stringify(args.asin)};
    const norm = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
    const extractRowId = (node) => {
      let current = node;
      for (let depth = 0; current && depth < 8; depth += 1, current = current.parentElement) {
        const attrs = [
          current.getAttribute && current.getAttribute('rowid'),
          current.getAttribute && current.getAttribute('data-rowid'),
          current.getAttribute && current.getAttribute('data-id'),
          current.dataset && current.dataset.rowid,
          current.dataset && current.dataset.id,
          current.dataset && current.dataset.productId,
        ].filter(Boolean);
        const id = attrs.find((value) => /^\\d{12,}$/.test(String(value || '').trim()));
        if (id) return String(id).trim();
      }
      return '';
    };
    const rowSelector = 'tr,.ant-table-row,.vxe-body--row,li,[class*="table-row"],[class*="product"],[class*="list-item"],[class*="goods"],[class*="row"]';
    const rows = Array.from(document.querySelectorAll(rowSelector))
      .map((row) => {
        const text = norm(row.innerText || row.textContent);
        const links = Array.from(row.querySelectorAll('a[href]')).map((link) => ({
          text: norm(link.innerText || link.textContent || link.getAttribute('title') || ''),
          href: link.href || link.getAttribute('href') || '',
        }));
        const sourceLink = links.find((link) => link.href.includes(asin) && /amazon\\./i.test(link.href))
          || links.find((link) => link.href.includes(asin));
        const rowId = extractRowId(row);
        const textHasAsin = text.includes(asin);
        const linkHasAsin = Boolean(sourceLink);
        const score = (linkHasAsin ? 1000 : 0) + (textHasAsin ? 200 : 0) + (rowId ? 100 : 0) - Math.min(text.length, 5000) / 100;
        return {
          row,
          score,
          text,
          rowId,
          sourceUrl: sourceLink ? sourceLink.href : '',
          links: links.slice(0, 20),
        };
      })
      .filter((item) => (item.text.includes(asin) || item.sourceUrl.includes(asin)) && item.rowId)
      .sort((a, b) => b.score - a.score || a.text.length - b.text.length);
    const best = rows[0] || null;
    const editUrl = best ? new URL('/web/smtlocalProduct/edit', location.origin).toString() + '?id=' + encodeURIComponent(best.rowId) : '';
    return JSON.stringify({
      ok: Boolean(best && best.rowId),
      href: location.href,
      title: document.title,
      asin,
      editId: best ? best.rowId : '',
      editUrl,
      sourceUrl: best ? best.sourceUrl : '',
      rowText: best ? best.text.slice(0, 2400) : '',
      candidates: rows.slice(0, 5).map((item) => ({
        rowId: item.rowId,
        sourceUrl: item.sourceUrl,
        score: item.score,
        text: item.text.slice(0, 700),
      })),
      reason: best ? '' : 'matching_row_with_rowid_not_found'
    });
  })()`;
  const response = await post(args, 'evaluate', { code });
  return { ok: response && response.ok !== false && !response.error, resolveEditId: JSON.parse(extractValue(response) || '{}'), raw: response };
}

async function listRows(args) {
  const code = `(() => {
    const norm = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
    const rowSelector = 'tr,.ant-table-row,.vxe-body--row,[class*="table-row"],[class*="product"],[class*="list-item"],[class*="goods"],[class*="row"]';
    const candidates = Array.from(document.querySelectorAll(rowSelector))
      .map((node) => {
        const text = norm(node.innerText || node.textContent);
        const actionTexts = Array.from(node.querySelectorAll('a,button,[role="button"]'))
          .map((item) => norm(item.innerText || item.textContent || item.value || item.getAttribute('title') || item.getAttribute('aria-label')))
          .filter(Boolean);
        const priceCandidates = Array.from(new Set((text.match(/CNY\\s*\\d+(?:\\.\\d+)?|\\b\\d{1,5}\\.\\d{2}\\b/g) || []).map(norm)));
        return {
          tag: node.tagName,
          className: String(node.className || '').slice(0, 140),
          text,
          actionTexts,
          priceCandidates,
          score: (text.includes('亚马逊') ? 100 : 0) + (actionTexts.includes('编辑') ? 50 : 0) + (text.includes('Halo Home Store') ? 20 : 0),
        };
      })
      .filter((row) => row.score >= 100 && row.text.length > 80)
      .sort((a, b) => b.score - a.score || b.text.length - a.text.length);
    const seen = new Set();
    const rows = [];
    for (const row of candidates) {
      const title = row.text.replace(/^.*?亚马逊\\(美国\\)\\s*/, '').split('「Halo Home Store」')[0].trim();
      const key = title.slice(0, 120);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      rows.push({
        index: rows.length,
        title,
        priceCandidates: row.priceCandidates.slice(0, 20),
        actionTexts: row.actionTexts.slice(0, 20),
        text: row.text.slice(0, 3000),
      });
      if (rows.length >= 20) break;
    }
    return JSON.stringify({ href: location.href, title: document.title, rows });
  })()`;
  const response = await post(args, 'evaluate', { code });
  return { ok: response && response.ok !== false && !response.error, list: JSON.parse(extractValue(response) || '{}'), raw: response };
}

async function openEditByTitle(args) {
  const titleNeedle = normalize(args.title || '');
  if (!titleNeedle) throw new Error('openEditByTitle requires --title');
  const code = `(async () => {
    const needle = ${JSON.stringify(titleNeedle.toLowerCase())};
    const norm = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
    const rowSelector = 'tr,.ant-table-row,.vxe-body--row,[class*="table-row"],[class*="product"],[class*="list-item"],[class*="goods"],[class*="row"]';
    const rows = Array.from(document.querySelectorAll(rowSelector));
    const matches = [];
    for (const row of rows) {
      const text = norm(row.innerText || row.textContent);
      if (!text.toLowerCase().includes(needle)) continue;
      const edit = Array.from(row.querySelectorAll('a,button,[role="button"]'))
        .find((item) => norm(item.innerText || item.textContent || item.value || item.getAttribute('title') || item.getAttribute('aria-label')) === '编辑');
      if (edit) {
        matches.push({ row, edit, text, length: text.length });
      }
    }
    matches.sort((a, b) => a.length - b.length);
    const target = matches[0] || null;
    if (!target) return JSON.stringify({ ok: false, reason: 'target_edit_row_not_found', href: location.href, needle });
    target.edit.click();
    await new Promise((resolve) => setTimeout(resolve, 5000));
    return JSON.stringify({
      ok: true,
      href: location.href,
      title: document.title,
      clicked: '编辑',
      rowText: target.text.slice(0, 1800),
      bodySnippet: norm(document.body && document.body.innerText).slice(0, 1400)
    });
  })()`;
  const response = await post(args, 'evaluate', { code });
  return { ok: response && response.ok !== false && !response.error, openEditByTitle: JSON.parse(extractValue(response) || '{}'), raw: response };
}

async function openEditByTitleCdp(args) {
  const titleNeedle = normalize(args.title || '');
  if (!titleNeedle) throw new Error('openEditByTitleCdp requires --title');
  const locateCode = `(() => {
    const needle = ${JSON.stringify(titleNeedle.toLowerCase())};
    const norm = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
    const rowSelector = 'tr,.ant-table-row,.vxe-body--row,[class*="table-row"],[class*="product"],[class*="list-item"],[class*="goods"],[class*="row"]';
    const matches = [];
    for (const row of Array.from(document.querySelectorAll(rowSelector))) {
      const text = norm(row.innerText || row.textContent);
      if (!text.toLowerCase().includes(needle)) continue;
      const edit = Array.from(row.querySelectorAll('a,button,[role="button"]'))
        .find((item) => norm(item.innerText || item.textContent || item.value || item.getAttribute('title') || item.getAttribute('aria-label')) === '编辑');
      if (!edit) continue;
      matches.push({ row, edit, text, length: text.length });
    }
    matches.sort((a, b) => a.length - b.length);
    const target = matches[0] || null;
    if (target) {
      target.edit.scrollIntoView({ block: 'center', inline: 'center' });
    }
    const rect = target ? target.edit.getBoundingClientRect() : null;
    return JSON.stringify({
      ok: Boolean(target),
      href: location.href,
      title: document.title,
      viewport: { width: window.innerWidth, height: window.innerHeight, scrollY: window.scrollY },
      target: target && rect ? {
        rect: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, width: rect.width, height: rect.height, left: rect.left, top: rect.top },
        rowText: target.text.slice(0, 1800)
      } : null,
      reason: target ? '' : 'target_edit_row_not_found'
    });
  })()`;
  const locatedResponse = await post(args, 'evaluate', { code: locateCode });
  const located = JSON.parse(extractValue(locatedResponse) || '{}');
  if (!located.ok || !located.target) return { ok: false, stage: 'locate', located, raw: locatedResponse };
  const { x, y } = located.target.rect;
  const moved = await post(args, 'cdp', {
    method: 'Input.dispatchMouseEvent',
    params: { type: 'mouseMoved', x, y, button: 'none' },
  });
  const pressed = await post(args, 'cdp', {
    method: 'Input.dispatchMouseEvent',
    params: { type: 'mousePressed', x, y, button: 'left', clickCount: 1 },
  });
  const released = await post(args, 'cdp', {
    method: 'Input.dispatchMouseEvent',
    params: { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 },
  });
  await new Promise((resolve) => setTimeout(resolve, 6000));
  const readCode = `(() => JSON.stringify({
    href: location.href,
    title: document.title,
    bodySnippet: String(document.body && document.body.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 1800)
  }))()`;
  const readResponse = await post(args, 'evaluate', { code: readCode });
  return {
    ok: true,
    openEditByTitleCdp: {
      clicked: '编辑',
      located,
      page: JSON.parse(extractValue(readResponse) || '{}'),
      cdp: { moved, pressed, released },
    },
    raw: { locatedResponse, readResponse },
  };
}

async function inspectEditByTitle(args) {
  const titleNeedle = normalize(args.title || '');
  if (!titleNeedle) throw new Error('inspectEditByTitle requires --title');
  const code = `(() => {
    const needle = ${JSON.stringify(titleNeedle.toLowerCase())};
    const norm = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
    const rowSelector = 'tr,.ant-table-row,.vxe-body--row,[class*="table-row"],[class*="product"],[class*="list-item"],[class*="goods"],[class*="row"]';
    const matches = [];
    for (const row of Array.from(document.querySelectorAll(rowSelector))) {
      const text = norm(row.innerText || row.textContent);
      if (!text.toLowerCase().includes(needle)) continue;
      const controls = Array.from(row.querySelectorAll('a,button,[role="button"],span,div')).map((item, index) => {
        const label = norm(item.innerText || item.textContent || item.value || item.getAttribute('title') || item.getAttribute('aria-label'));
        if (label !== '编辑') return null;
        const rect = item.getBoundingClientRect();
        return {
          index,
          tag: item.tagName,
          text: label,
          href: item.href || '',
          role: item.getAttribute('role') || '',
          className: String(item.className || ''),
          onclick: String(item.getAttribute('onclick') || ''),
          dataset: { ...item.dataset },
          outerHTML: String(item.outerHTML || '').slice(0, 1200),
          parentHTML: item.parentElement ? String(item.parentElement.outerHTML || '').slice(0, 1800) : '',
          rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
        };
      }).filter(Boolean);
      if (controls.length) matches.push({ text: text.slice(0, 1800), length: text.length, controls });
    }
    matches.sort((a, b) => a.length - b.length);
    return JSON.stringify({ href: location.href, title: document.title, match: matches[0] || null });
  })()`;
  const response = await post(args, 'evaluate', { code });
  return { ok: response && response.ok !== false && !response.error, inspectEditByTitle: JSON.parse(extractValue(response) || '{}'), raw: response };
}

async function inspectVueByTitle(args) {
  const titleNeedle = normalize(args.title || '');
  if (!titleNeedle) throw new Error('inspectVueByTitle requires --title');
  const code = `(() => {
    const needle = ${JSON.stringify(titleNeedle.toLowerCase())};
    const norm = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
    const seen = new Set();
    const safe = (value, depth = 0) => {
      if (value == null) return value;
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
      if (depth > 2) return '[depth]';
      if (typeof value !== 'object') return String(value);
      if (seen.has(value)) return '[circular]';
      seen.add(value);
      if (Array.isArray(value)) return value.slice(0, 8).map((item) => safe(item, depth + 1));
      const out = {};
      for (const key of Object.keys(value).slice(0, 80)) {
        if (/id|sku|asin|product|title|name|item|row|goods|draft|source|url/i.test(key)) {
          try { out[key] = safe(value[key], depth + 1); } catch (_) {}
        }
      }
      return out;
    };
    const rowSelector = 'tr,.ant-table-row,.vxe-body--row,[class*="table-row"],[class*="product"],[class*="list-item"],[class*="goods"],[class*="row"]';
    const rows = Array.from(document.querySelectorAll(rowSelector))
      .map((row) => ({ row, text: norm(row.innerText || row.textContent) }))
      .filter((item) => item.text.toLowerCase().includes(needle))
      .sort((a, b) => a.text.length - b.text.length);
    const row = rows[0] && rows[0].row;
    if (!row) return JSON.stringify({ ok: false, reason: 'row_not_found', href: location.href });
    const components = [];
    let current = row;
    for (let depth = 0; current && depth < 8; depth += 1, current = current.parentElement) {
      const comp = current.__vueParentComponent || current.__vue__;
      if (!comp) continue;
      components.push({
        depth,
        tag: current.tagName,
        className: String(current.className || '').slice(0, 140),
        typeName: comp.type && (comp.type.name || comp.type.__name || comp.type.displayName) || '',
        props: safe(comp.props),
        data: safe(comp.data),
        setupState: safe(comp.setupState),
        ctx: safe(comp.ctx),
      });
    }
    return JSON.stringify({
      ok: true,
      href: location.href,
      title: document.title,
      rowText: rows[0].text.slice(0, 1800),
      components,
      html: String(row.outerHTML || '').slice(0, 3000),
    });
  })()`;
  const response = await post(args, 'evaluate', { code });
  return { ok: response && response.ok !== false && !response.error, inspectVueByTitle: JSON.parse(extractValue(response) || '{}'), raw: response };
}

async function elementAt(args) {
  const x = Number(args.x);
  const y = Number(args.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('elementAt requires --x and --y');
  const code = `(() => {
    const x = ${JSON.stringify(x)};
    const y = ${JSON.stringify(y)};
    const norm = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
    const chain = [];
    let current = document.elementFromPoint(x, y);
    for (let depth = 0; current && depth < 8; depth += 1, current = current.parentElement) {
      chain.push({
        tag: current.tagName,
        text: norm(current.innerText || current.textContent).slice(0, 500),
        className: String(current.className || '').slice(0, 240),
        outerHTML: String(current.outerHTML || '').slice(0, 800),
      });
    }
    return JSON.stringify({ href: location.href, title: document.title, x, y, chain });
  })()`;
  const response = await post(args, 'evaluate', { code });
  return { ok: response && response.ok !== false && !response.error, elementAt: JSON.parse(extractValue(response) || '{}'), raw: response };
}

async function clickTextCdp(args) {
  const needle = normalize(args.title || '');
  if (!needle) throw new Error('clickTextCdp requires --title');
  const locateCode = `(() => {
    const needle = ${JSON.stringify(needle)};
    const norm = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
    const controls = Array.from(document.querySelectorAll('button,a,[role="button"]'))
      .map((node) => {
        const text = norm(node.innerText || node.textContent || node.value || node.getAttribute('title') || node.getAttribute('aria-label'));
        const rect = node.getBoundingClientRect();
        return {
          node,
          text,
          rect,
          area: rect.width * rect.height,
          visible: rect.width > 0 && rect.height > 0,
        };
      })
      .filter((item) => item.visible && item.text.includes(needle))
      .sort((a, b) => a.area - b.area || a.text.length - b.text.length);
    const target = controls[0] || null;
    if (target) target.node.scrollIntoView({ block: 'center', inline: 'center' });
    const rect = target ? target.node.getBoundingClientRect() : null;
    return JSON.stringify({
      ok: Boolean(target),
      href: location.href,
      title: document.title,
      target: target && rect ? {
        text: target.text,
        rect: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, width: rect.width, height: rect.height, left: rect.left, top: rect.top },
        outerHTML: String(target.node.outerHTML || '').slice(0, 1000),
      } : null,
      allMatches: controls.slice(0, 8).map((item) => ({ text: item.text, area: item.area })),
    });
  })()`;
  const locatedResponse = await post(args, 'evaluate', { code: locateCode });
  const located = JSON.parse(extractValue(locatedResponse) || '{}');
  if (!located.ok || !located.target) return { ok: false, stage: 'locate', located, raw: locatedResponse };
  const { x, y } = located.target.rect;
  const moved = await post(args, 'cdp', { method: 'Input.dispatchMouseEvent', params: { type: 'mouseMoved', x, y, button: 'none' } });
  const pressed = await post(args, 'cdp', { method: 'Input.dispatchMouseEvent', params: { type: 'mousePressed', x, y, button: 'left', clickCount: 1 } });
  const released = await post(args, 'cdp', { method: 'Input.dispatchMouseEvent', params: { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 } });
  await new Promise((resolve) => setTimeout(resolve, 7000));
  const readCode = `(() => JSON.stringify({
    href: location.href,
    title: document.title,
    bodySnippet: String(document.body && document.body.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 1800)
  }))()`;
  const readResponse = await post(args, 'evaluate', { code: readCode });
  return {
    ok: true,
    clickTextCdp: {
      located,
      page: JSON.parse(extractValue(readResponse) || '{}'),
      cdp: { moved, pressed, released },
    },
    raw: { locatedResponse, readResponse },
  };
}

async function inject(args) {
  const source = fs.readFileSync(args.source, 'utf8');
  const code = `(() => {
    const script = document.createElement('script');
    script.textContent = ${JSON.stringify(source)};
    document.documentElement.appendChild(script);
    script.remove();
    return JSON.stringify({
      href: location.href,
      versionText: document.body ? String(document.body.innerText || '').match(/DXM Automation V1[^\\n]*/)?.[0] || '' : '',
      hasApply: typeof window.__DXM_AUTOMATION_V1_APPLY_EDIT_RULES__ === 'function',
      hasReadonly: typeof window.__DXM_AUTOMATION_V1_READONLY_PREFLIGHT__ === 'function',
      hasResetPipeline: typeof window.__DXM_AUTOMATION_V1_RESET_PIPELINE_LOCK__ === 'function',
      hasRemaining: typeof window.__DXM_AUTOMATION_V1_APPLY_REMAINING_EDIT_RULES__ === 'function',
      hasCategoryPrice: typeof window.__DXM_AUTOMATION_V1_CATEGORY_PRICE_ONLY__ === 'function',
      hasShippingPostage: typeof window.__DXM_AUTOMATION_V1_SHIPPING_POSTAGE_ONLY__ === 'function',
      hasRequiredAttrs: typeof window.__DXM_AUTOMATION_V1_REQUIRED_ATTRS_ONLY__ === 'function',
      hasRequiredAttrField: typeof window.__DXM_AUTOMATION_V1_REQUIRED_ATTR_FIELD_ONLY__ === 'function',
      hasVariationPreflight: typeof window.__DXM_AUTOMATION_V1_VARIATION_PREFLIGHT_ONLY__ === 'function'
    });
  })()`;
  const response = await post(args, 'evaluate', { code });
  return { ok: response && response.ok !== false && !response.error, inject: JSON.parse(extractValue(response) || '{}'), raw: response };
}

async function readonly(args) {
  const code = `(() => {
    try {
      ${buildExpectedAsinGuard(args)}
      if (typeof window.__DXM_AUTOMATION_V1_READONLY_PREFLIGHT__ !== 'function') {
        return JSON.stringify({ ok: false, reason: 'readonly_function_missing', href: location.href, title: document.title });
      }
      const preflight = window.__DXM_AUTOMATION_V1_READONLY_PREFLIGHT__();
      return JSON.stringify({ ok: true, href: location.href, title: document.title, expectedAsin: checkExpectedAsin(preflight), preflight });
    } catch (error) {
      return JSON.stringify({ ok: false, reason: 'readonly_failed', error: String(error && error.message ? error.message : error), href: location.href });
    }
  })()`;
  const response = await post(args, 'evaluate', { code });
  return { ok: response && response.ok !== false && !response.error, readonly: JSON.parse(extractValue(response) || '{}'), raw: response };
}

function requiredAttrClassName(field) {
  const map = {
    frame_material: 'smtDynamicAttr906',
    function: 'smtDynamicAttr43',
    high_concerned_chemical: 'smtDynamicAttr400000603',
    origin: 'smtDynamicAttr219',
    material: 'smtDynamicAttr10',
  };
  return map[field] || '';
}

async function inspectRequiredAttr(args) {
  if (!args.field) throw new Error('inspectRequiredAttr requires --field');
  const className = requiredAttrClassName(args.field);
  if (!className) throw new Error(`Unsupported required attribute field: ${args.field}`);
  const code = `(() => {
    const normalize = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
    const root = document.querySelector(${JSON.stringify(`.${className}`)});
    const item = root && (root.closest('.ant-form-item') || root);
    if (!item) return JSON.stringify({ ok: false, reason: 'required_attribute_node_not_found', field: ${JSON.stringify(args.field)}, className: ${JSON.stringify(className)}, href: location.href });
    const inputs = Array.from(item.querySelectorAll('input')).map((input) => ({
      type: input.type || '',
      value: input.value || '',
      title: input.title || '',
      placeholder: input.getAttribute('placeholder') || '',
      ariaExpanded: input.getAttribute('aria-expanded') || '',
      ariaControls: input.getAttribute('aria-controls') || '',
      ariaActiveDescendant: input.getAttribute('aria-activedescendant') || '',
      className: String(input.className || '').slice(0, 220)
    }));
    const selects = Array.from(item.querySelectorAll('.ant-select,.ant-select-selector,.ant-select-selection-item,.ant-select-selection-search')).map((node) => ({
      tag: node.tagName,
      className: String(node.className || '').slice(0, 220),
      title: node.getAttribute('title') || '',
      text: normalize(node.innerText || node.textContent).slice(0, 500),
      html: String(node.outerHTML || '').slice(0, 1200)
    }));
    const dropdowns = Array.from(document.querySelectorAll('.ant-select-dropdown:not(.ant-select-dropdown-hidden),.ant-select-dropdown')).filter((node) => {
      const style = window.getComputedStyle(node);
      return style && style.display !== 'none' && style.visibility !== 'hidden' && node.getBoundingClientRect().width > 0;
    }).map((node, dropdownIndex) => ({
      dropdownIndex,
      className: String(node.className || '').slice(0, 220),
      text: normalize(node.innerText || node.textContent).slice(0, 1200),
      options: Array.from(node.querySelectorAll('.ant-select-item-option,[role="option"],li')).filter((option) => {
        const rect = option.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }).map((option, optionIndex) => ({
        optionIndex,
        title: option.getAttribute('title') || '',
        text: normalize(option.innerText || option.textContent).slice(0, 300),
        className: String(option.className || '').slice(0, 180)
      })).slice(0, 80)
    }));
    return JSON.stringify({
      ok: true,
      field: ${JSON.stringify(args.field)},
      className: ${JSON.stringify(className)},
      href: location.href,
      title: document.title,
      text: normalize(item.innerText || item.textContent).slice(0, 1200),
      inputs,
      selects,
      dropdowns,
      html: String(item.outerHTML || '').slice(0, 3500)
    });
  })()`;
  const response = await post(args, 'evaluate', { code });
  return { ok: response && response.ok !== false && !response.error, inspectRequiredAttr: JSON.parse(extractValue(response) || '{}'), raw: response };
}

async function runEditPageFunction(args, commandName, functionName, options = {}) {
  const code = `(async () => {
    try {
      ${buildExpectedAsinGuard(args)}
      const asinGuard = readAndCheckExpectedAsin();
      if (!asinGuard.ok) {
        return JSON.stringify({ ok: false, reason: asinGuard.reason || 'expected_asin_guard_failed', href: location.href, title: document.title, asinGuard });
      }
      if (typeof window[${JSON.stringify(functionName)}] !== 'function') {
        return JSON.stringify({ ok: false, reason: ${JSON.stringify(`${commandName}_function_missing`)}, functionName: ${JSON.stringify(functionName)}, href: location.href, title: document.title });
      }
      const result = await window[${JSON.stringify(functionName)}](${JSON.stringify({ manual: true, preSave: true, ...options })});
      const finalReadback = typeof window.__DXM_AUTOMATION_V1_READONLY_PREFLIGHT__ === 'function'
        ? window.__DXM_AUTOMATION_V1_READONLY_PREFLIGHT__()
        : null;
      return JSON.stringify({ ok: true, href: location.href, title: document.title, command: ${JSON.stringify(commandName)}, asinGuard, result, finalReadback });
    } catch (error) {
      return JSON.stringify({ ok: false, reason: ${JSON.stringify(`${commandName}_failed`)}, error: String(error && error.message ? error.message : error), href: location.href });
    }
  })()`;
  const response = await post(args, 'evaluate', { code });
  return { ok: response && response.ok !== false && !response.error, [commandName]: JSON.parse(extractValue(response) || '{}'), raw: response };
}

async function apply(args) {
  return runEditPageFunction(args, 'apply', '__DXM_AUTOMATION_V1_APPLY_EDIT_RULES__');
}

async function resetPipeline(args) {
  return runEditPageFunction(args, 'resetPipeline', '__DXM_AUTOMATION_V1_RESET_PIPELINE_LOCK__', { resetReason: 'helper_reset_pipeline' });
}

async function categoryPrice(args) {
  return runEditPageFunction(args, 'categoryPrice', '__DXM_AUTOMATION_V1_CATEGORY_PRICE_ONLY__');
}

async function shippingPostage(args) {
  return runEditPageFunction(args, 'shippingPostage', '__DXM_AUTOMATION_V1_SHIPPING_POSTAGE_ONLY__');
}

async function requiredAttrs(args) {
  return runEditPageFunction(args, 'requiredAttrs', '__DXM_AUTOMATION_V1_REQUIRED_ATTRS_ONLY__');
}

async function requiredAttrField(args) {
  if (!args.field) throw new Error('requiredAttrField requires --field');
  return runEditPageFunction(args, 'requiredAttrField', '__DXM_AUTOMATION_V1_REQUIRED_ATTR_FIELD_ONLY__', {
    field: args.field,
    forceReset: true,
    resetReason: `helper_required_attr_field_${args.field}`,
  });
}

async function variationPreflight(args) {
  return runEditPageFunction(args, 'variationPreflight', '__DXM_AUTOMATION_V1_VARIATION_PREFLIGHT_ONLY__');
}

async function resume(args) {
  return runEditPageFunction(args, 'resume', '__DXM_AUTOMATION_V1_APPLY_REMAINING_EDIT_RULES__', {
    forceReset: true,
    resetReason: 'helper_resume_remaining',
  });
}

async function save(args) {
  const code = `(async () => {
    try {
      ${buildExpectedAsinGuard(args)}
      if (typeof window.__DXM_AUTOMATION_V1_READONLY_PREFLIGHT__ !== 'function') {
        return JSON.stringify({ ok: false, reason: 'readonly_function_missing', href: location.href, title: document.title });
      }
      const preflightReadback = window.__DXM_AUTOMATION_V1_READONLY_PREFLIGHT__();
      const asinGuard = checkExpectedAsin(preflightReadback);
      if (!asinGuard.ok) {
        return JSON.stringify({
          ok: false,
          reason: 'expected_asin_mismatch',
          href: location.href,
          title: document.title,
          asinGuard,
          preflight: preflightReadback
        });
      }
      const pass = Boolean(preflightReadback && preflightReadback.pass === true && Array.isArray(preflightReadback.blockers) && preflightReadback.blockers.length === 0);
      if (!pass) {
        return JSON.stringify({
          ok: false,
          reason: 'final_preflight_failed',
          href: location.href,
          title: document.title,
          preflight: preflightReadback
        });
      }
      const buttons = Array.from(document.querySelectorAll('button,[role="button"]'))
        .filter((button) => !button.closest('#dxm-automation-v1-panel') && !button.closest('#dxm-automation-v1-new-panel'));
      const nativeButton = buttons.find((button) => String(button.innerText || button.textContent || '').trim() === '保存并移入待发布');
      if (!nativeButton) {
        return JSON.stringify({ ok: false, reason: 'native_save_to_wait_publish_button_missing', href: location.href, title: document.title, preflight: preflightReadback });
      }
      nativeButton.click();
      await new Promise((resolve) => setTimeout(resolve, 7000));
      const bodySnippet = String(document.body && document.body.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 2400);
      const stillEditPage = /\/web\/smtlocalProduct\/edit/.test(location.href);
      const nativeProductAttributeError = /请选择产品属性|product attribute/i.test(bodySnippet);
      const nativeErrors = Array.from(document.querySelectorAll('.ant-form-item-explain-error,.ant-form-show-help-item'))
        .filter((node) => {
          const style = window.getComputedStyle(node);
          const rect = node.getBoundingClientRect();
          return style && style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
        })
        .map((node) => String(node.innerText || node.textContent || '').replace(/\\s+/g, ' ').trim())
        .filter(Boolean)
        .slice(0, 20);
      const postSavePreflight = typeof window.__DXM_AUTOMATION_V1_READONLY_PREFLIGHT__ === 'function'
        ? window.__DXM_AUTOMATION_V1_READONLY_PREFLIGHT__()
        : null;
      if (stillEditPage && (nativeProductAttributeError || nativeErrors.length)) {
        return JSON.stringify({
          ok: false,
          reason: nativeProductAttributeError ? 'native_required_attribute_validation_failed' : 'native_save_validation_failed',
          mode: 'native_button_after_readonly_preflight',
          clicked: '保存并移入待发布',
          href: location.href,
          title: document.title,
          asinGuard,
          preflight: preflightReadback,
          postSavePreflight,
          nativeErrors,
          bodySnippet
        });
      }
      return JSON.stringify({
        ok: true,
        mode: 'native_button_after_readonly_preflight',
        clicked: '保存并移入待发布',
        href: location.href,
        title: document.title,
        asinGuard,
        preflight: preflightReadback,
        postSavePreflight,
        lastResult: window.__DXM_AUTOMATION_V1_LAST_RESULT__ || null,
        bodySnippet
      });
    } catch (error) {
      return JSON.stringify({ ok: false, reason: 'save_failed', error: String(error && error.message ? error.message : error), href: location.href });
    }
  })()`;
  const response = await post(args, 'evaluate', { code });
  return { ok: response && response.ok !== false && !response.error, save: JSON.parse(extractValue(response) || '{}'), raw: response };
}

async function snapshot(args) {
  const response = await post(args, 'snapshot', {});
  return { ok: response && response.ok !== false && !response.error, snapshot: response.data || response };
}

async function main() {
  const args = parseArgs(process.argv);
  try {
    if (args.command === 'help') return output(usage());
    if (args.command === 'bind') return output(await bind(args));
    if (args.command === 'forceEdit') return output(await forceEdit(args));
    if (args.command === 'sync') return output(await syncStores(args));
    if (args.command === 'locate') return output(await locate(args));
    if (args.command === 'resolveEditId') return output(await resolveEditId(args));
    if (args.command === 'list') return output(await listRows(args));
    if (args.command === 'openEditByTitle') return output(await openEditByTitle(args));
    if (args.command === 'openEditByTitleCdp') return output(await openEditByTitleCdp(args));
    if (args.command === 'inspectEditByTitle') return output(await inspectEditByTitle(args));
    if (args.command === 'inspectVueByTitle') return output(await inspectVueByTitle(args));
    if (args.command === 'elementAt') return output(await elementAt(args));
    if (args.command === 'clickTextCdp') return output(await clickTextCdp(args));
    if (args.command === 'inject') return output(await inject(args));
    if (args.command === 'readonly') return output(await readonly(args));
    if (args.command === 'inspectRequiredAttr') return output(await inspectRequiredAttr(args));
    if (args.command === 'apply') return output(await apply(args));
    if (args.command === 'resetPipeline') return output(await resetPipeline(args));
    if (args.command === 'categoryPrice') return output(await categoryPrice(args));
    if (args.command === 'shippingPostage') return output(await shippingPostage(args));
    if (args.command === 'requiredAttrs') return output(await requiredAttrs(args));
    if (args.command === 'requiredAttrField') return output(await requiredAttrField(args));
    if (args.command === 'variationPreflight') return output(await variationPreflight(args));
    if (args.command === 'resume') return output(await resume(args));
    if (args.command === 'save') return output(await save(args));
    if (args.command === 'snapshot') return output(await snapshot(args));
    throw new Error(`Unsupported command: ${args.command}`);
  } catch (error) {
    output({ ok: false, error: String(error && error.message ? error.message : error) });
    process.exitCode = 1;
  }
}

if (require.main === module) main();
