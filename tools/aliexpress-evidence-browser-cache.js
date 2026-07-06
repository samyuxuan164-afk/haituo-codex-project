#!/usr/bin/env node
'use strict';

const {
  DEFAULT_STORE_PATH,
  readStore,
} = require('./aliexpress-evidence-store');
const http = require('http');
const https = require('https');
const { execFileSync } = require('child_process');

const BROWSER_CACHE_KEY = 'dxm_aliexpress_evidence_store_v1';
const SCHEMA_VERSION = 'aliexpress-evidence-store-v1';
const VERIFIED_STATUSES = new Set(['aliexpress_verified', 'conditional_verified', 'detail_verified', 'learned_rule_matched']);
const DEFAULT_ENDPOINT = 'http://127.0.0.1:10086/command';
const DEFAULT_SESSION = 'dxm-aliexpress-evidence-sync';
const DEFAULT_DXM_URL = 'https://www.dianxiaomi.com/web/smtlocalProduct/draft';

function buildBrowserCache(store) {
  return {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: store.updatedAt,
    records: store.records || {},
  };
}

function summarize(cache) {
  const records = Object.values(cache.records || {});
  const verified = records.filter((record) => VERIFIED_STATUSES.has(record.status));
  const missingDxmCandidate = verified.filter((record) => !String(record.dxmCandidateCategory || '').trim());
  return {
    records: records.length,
    verified: verified.length,
    missingDxmCandidate: missingDxmCandidate.length,
    cacheKey: BROWSER_CACHE_KEY,
    updatedAt: cache.updatedAt || '',
  };
}

function output(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function usage() {
  return {
    tool: 'aliexpress-evidence-browser-cache',
    commands: {
      inspect: 'Validate and summarize the browser cache payload.',
      export: 'Print the browser cache JSON payload.',
      script: 'Print a JavaScript snippet that writes the cache to localStorage.',
      sync: 'Write the cache into the current Dianxiaomi browser page through WebBridge.',
      read: 'Read the browser-side evidence cache summary through WebBridge.',
    },
    cacheKey: BROWSER_CACHE_KEY,
    defaultStore: DEFAULT_STORE_PATH,
    defaultEndpoint: DEFAULT_ENDPOINT,
    defaultSession: DEFAULT_SESSION,
    defaultDxmUrl: DEFAULT_DXM_URL,
  };
}

function parseArgs(argv) {
  const args = {
    command: argv[2] || 'inspect',
    storePath: process.env.ALIEXPRESS_EVIDENCE_STORE || DEFAULT_STORE_PATH,
    endpoint: process.env.WEBBRIDGE_ENDPOINT || DEFAULT_ENDPOINT,
    session: process.env.WEBBRIDGE_SESSION || DEFAULT_SESSION,
    url: process.env.DXM_EVIDENCE_SYNC_URL || DEFAULT_DXM_URL,
    timeoutMs: Number(process.env.WEBBRIDGE_TIMEOUT_MS || 10000),
  };
  for (let i = 3; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === '--store' && next) {
      args.storePath = next;
      i += 1;
    } else if (arg === '--endpoint' && next) {
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
    }
  }
  return args;
}

function buildScript(cache) {
  return (
    `localStorage.setItem(${JSON.stringify(BROWSER_CACHE_KEY)}, ${JSON.stringify(JSON.stringify(cache))});\n` +
    `window.__DXM_ALIEXPRESS_EVIDENCE_STORE__ = JSON.parse(localStorage.getItem(${JSON.stringify(BROWSER_CACHE_KEY)}));\n`
  );
}

function extractWebBridgeValue(payload) {
  const data = payload && payload.data;
  if (!data) return null;
  if (data.value != null) return data.value;
  if (data.data && data.data.value != null) return data.data.value;
  if (data.result && data.result.value != null) return data.result.value;
  if (data.type && data.value != null) return data.value;
  return null;
}

function getToolError(payload) {
  if (!payload) return '';
  if (payload.error) return payload.error;
  const data = payload.data || {};
  if (data.ok === false && data.error) return data.error.code || data.error.message || JSON.stringify(data.error);
  if (data.data && data.data.success === false && data.data.error) return data.data.error.code || data.data.error.message || JSON.stringify(data.data.error);
  if (data.success === false && data.error) return data.error.code || data.error.message || JSON.stringify(data.error);
  return '';
}

async function postWebBridge(args, action, commandArgs = {}) {
  const requestBody = JSON.stringify({ action, args: commandArgs, session: args.session });
  return new Promise((resolve) => {
    const endpoint = new URL(args.endpoint);
    const client = endpoint.protocol === 'https:' ? https : http;
    const request = client.request({
      method: 'POST',
      hostname: endpoint.hostname,
      port: endpoint.port || (endpoint.protocol === 'https:' ? 443 : 80),
      path: `${endpoint.pathname}${endpoint.search}`,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody),
      },
      timeout: args.timeoutMs,
    }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let data = null;
        try {
          data = JSON.parse(text);
        } catch (_) {
          data = { raw: text };
        }
        resolve({ httpOk: response.statusCode >= 200 && response.statusCode < 300, status: response.statusCode, data });
      });
    });
    request.on('timeout', () => {
      request.destroy(new Error('webbridge_timeout'));
    });
    request.on('error', () => {
      resolve(postWebBridgeWithCurl(args, requestBody));
    });
    request.write(requestBody);
    request.end();
  });
}

function postWebBridgeWithCurl(args, requestBody) {
  try {
    const text = execFileSync('curl', [
      '-s',
      '-X',
      'POST',
      args.endpoint,
      '-H',
      'Content-Type: application/json',
      '-d',
      requestBody,
    ], {
      encoding: 'utf8',
      timeout: args.timeoutMs,
      maxBuffer: 1024 * 1024 * 20,
    });
    let data = null;
    try {
      data = JSON.parse(text);
    } catch (_) {
      data = { raw: text };
    }
    return { httpOk: true, status: 200, data, transport: 'curl' };
  } catch (error) {
    return {
      error: 'webbridge_daemon_unreachable',
      message: String(error && error.message ? error.message : error),
      stderr: String(error && error.stderr ? error.stderr : ''),
      stdout: String(error && error.stdout ? error.stdout : ''),
      transport: 'curl',
    };
  }
}

async function ensureDxmPage(args) {
  const find = await postWebBridge(args, 'find_tab', { url: 'https://www.dianxiaomi.com', active: true });
  const findError = getToolError(find);
  if (!find.error && !findError) return { ok: true, page: find.data && find.data.data ? find.data.data : find.data };

  const opened = await postWebBridge(args, 'navigate', {
    url: args.url,
    newTab: true,
    group_title: 'AliExpress证据同步',
  });
  const openError = getToolError(opened);
  if (opened.error || openError) {
    return { ok: false, status: opened.error || openError, message: opened.message || '', raw: opened.data || null };
  }
  return { ok: true, page: opened.data && opened.data.data ? opened.data.data : opened.data, opened: true };
}

async function syncToBrowser(args, cache) {
  const page = await ensureDxmPage(args);
  if (!page.ok) return { ok: false, status: page.status, page };
  const payload = JSON.stringify(cache);
  const code = `(() => {
    const key = ${JSON.stringify(BROWSER_CACHE_KEY)};
    const cache = ${JSON.stringify(payload)};
    localStorage.setItem(key, cache);
    window.__DXM_ALIEXPRESS_EVIDENCE_STORE__ = JSON.parse(localStorage.getItem(key));
    const parsed = window.__DXM_ALIEXPRESS_EVIDENCE_STORE__;
    return JSON.stringify({
      href: location.href,
      title: document.title,
      cacheKey: key,
      schemaVersion: parsed.schemaVersion || '',
      updatedAt: parsed.updatedAt || '',
      records: parsed.records ? Object.keys(parsed.records).length : 0,
      rawLength: cache.length
    });
  })()`;
  const written = await postWebBridge(args, 'evaluate', { code });
  const writeError = getToolError(written);
  if (written.error || writeError) return { ok: false, status: written.error || writeError, message: written.message || '', page, raw: written.data || null };
  let browser = null;
  try {
    browser = JSON.parse(extractWebBridgeValue(written) || '{}');
  } catch (error) {
    return { ok: false, status: 'browser_sync_parse_failed', error: String(error), page, raw: written.data || null };
  }
  return { ok: true, page, browser, summary: summarize(cache) };
}

async function readBrowserCache(args) {
  const page = await ensureDxmPage(args);
  if (!page.ok) return { ok: false, status: page.status, page };
  const code = `(() => {
    const key = ${JSON.stringify(BROWSER_CACHE_KEY)};
    const raw = localStorage.getItem(key) || '';
    let parsed = null;
    try { parsed = raw ? JSON.parse(raw) : null; } catch (error) { return JSON.stringify({ href: location.href, cacheKey: key, parseError: String(error), rawLength: raw.length }); }
    return JSON.stringify({
      href: location.href,
      title: document.title,
      cacheKey: key,
      schemaVersion: parsed && parsed.schemaVersion || '',
      updatedAt: parsed && parsed.updatedAt || '',
      records: parsed && parsed.records ? Object.keys(parsed.records).length : 0,
      rawLength: raw.length
    });
  })()`;
  const read = await postWebBridge(args, 'evaluate', { code });
  const readError = getToolError(read);
  if (read.error || readError) return { ok: false, status: read.error || readError, message: read.message || '', page, raw: read.data || null };
  try {
    return { ok: true, page, browser: JSON.parse(extractWebBridgeValue(read) || '{}') };
  } catch (error) {
    return { ok: false, status: 'browser_read_parse_failed', error: String(error), page, raw: read.data || null };
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const store = readStore(args.storePath);
  const cache = buildBrowserCache(store);
  if (args.command === 'inspect') {
    output({ ok: true, summary: summarize(cache) });
    return;
  }
  if (args.command === 'export') {
    output(cache);
    return;
  }
  if (args.command === 'script') {
    process.stdout.write(buildScript(cache));
    return;
  }
  if (args.command === 'sync') {
    output(await syncToBrowser(args, cache));
    return;
  }
  if (args.command === 'read') {
    output(await readBrowserCache(args));
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
  BROWSER_CACHE_KEY,
  buildBrowserCache,
  extractWebBridgeValue,
  getToolError,
  postWebBridge,
  readBrowserCache,
  summarize,
  syncToBrowser,
};
