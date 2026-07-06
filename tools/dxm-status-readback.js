#!/usr/bin/env node
'use strict';

const DEFAULT_ENDPOINT = 'http://127.0.0.1:10086/command';
const DEFAULT_SESSION = 'dxm-status-readback';
const DATA_ACQUISITION_PATH = '/web/productCrawl/dataAcquisition';
const http = require('http');
const https = require('https');
const { execFileSync } = require('child_process');

function parseArgs(argv) {
  const args = {
    endpoint: process.env.WEBBRIDGE_ENDPOINT || DEFAULT_ENDPOINT,
    session: process.env.WEBBRIDGE_SESSION || DEFAULT_SESSION,
    url: '',
    timeoutMs: Number(process.env.WEBBRIDGE_TIMEOUT_MS || 8000),
  };
  for (let i = 2; i < argv.length; i += 1) {
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
    }
  }
  return args;
}

function result(status, extra = {}) {
  return {
    tool: 'dxm-status-readback',
    status,
    ok: status === 'ok',
    updatedAt: new Date().toISOString(),
    ...extra,
  };
}

async function postWebBridge(args, action, commandArgs = {}) {
  const requestBody = JSON.stringify({ action, args: commandArgs, session: args.session });
  return new Promise((resolve) => {
    const endpoint = new URL(args.endpoint);
    const body = requestBody;
    const client = endpoint.protocol === 'https:' ? https : http;
    const request = client.request({
      method: 'POST',
      hostname: endpoint.hostname,
      port: endpoint.port || (endpoint.protocol === 'https:' ? 443 : 80),
      path: `${endpoint.pathname}${endpoint.search}`,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
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
    request.on('error', (error) => {
      const code = error && error.message === 'webbridge_timeout' ? 'webbridge_timeout' : 'webbridge_daemon_unreachable';
      if (/EPERM|EACCES/.test(String(error && error.message))) {
        resolve(postWebBridgeWithCurl(args, requestBody));
      } else {
        resolve({ error: code, message: String(error && error.message ? error.message : error) });
      }
    });
    request.write(body);
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
      maxBuffer: 1024 * 1024 * 10,
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
      transport: 'curl',
    };
  }
}

function getTabs(payload) {
  if (!payload || !payload.data) return [];
  if (Array.isArray(payload.data.tabs)) return payload.data.tabs;
  if (payload.data.data && Array.isArray(payload.data.data.tabs)) return payload.data.data.tabs;
  if (payload.data.value && Array.isArray(payload.data.value.tabs)) return payload.data.value.tabs;
  if (payload.data.result && Array.isArray(payload.data.result.tabs)) return payload.data.result.tabs;
  return [];
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

function pickDxmTab(tabs, explicitUrl) {
  if (explicitUrl) {
    return tabs.find((tab) => tab.url === explicitUrl || String(tab.url || '').includes(explicitUrl)) || null;
  }
  return tabs.find((tab) => String(tab.url || '').includes(DATA_ACQUISITION_PATH))
    || tabs.find((tab) => /dianxiaomi\.com/.test(String(tab.url || '')))
    || null;
}

function extractEvaluateValue(payload) {
  const data = payload && payload.data;
  if (!data) return null;
  if (data.value != null) return data.value;
  if (data.data && data.data.value != null) return data.data.value;
  if (data.result && data.result.value != null) return data.result.value;
  if (data.type && data.value != null) return data.value;
  return null;
}

async function main() {
  const args = parseArgs(process.argv);
  const tabsResponse = await postWebBridge(args, 'list_tabs', {});
  const firstError = getToolError(tabsResponse);
  if (tabsResponse.error) {
    console.log(JSON.stringify(result(tabsResponse.error, { message: tabsResponse.message }), null, 2));
    return;
  }
  if (/no extension connected/i.test(firstError)) {
    console.log(JSON.stringify(result('webbridge_extension_not_connected', { error: firstError }), null, 2));
    return;
  }
  if (firstError) {
    console.log(JSON.stringify(result('webbridge_error', { error: firstError, raw: tabsResponse.data }), null, 2));
    return;
  }

  const tabs = getTabs(tabsResponse);
  const targetTab = pickDxmTab(tabs, args.url);
  if (!targetTab || !targetTab.url) {
    console.log(JSON.stringify(result('wrong_page', { tabs: tabs.map((tab) => ({ title: tab.title, url: tab.url })) }), null, 2));
    return;
  }

  const findResponse = await postWebBridge(args, 'find_tab', { url: targetTab.url });
  const findError = getToolError(findResponse);
  if (findResponse.error || findError) {
    console.log(JSON.stringify(result('page_uncontrollable', { error: findResponse.error || findError, tab: targetTab }), null, 2));
    return;
  }

  const code = `(() => {
    const norm = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
    const node = document.getElementById('dxm-amazon-crawlbox-status-readback-json');
    let status = window.__DXM_AMAZON_CRAWLBOX_STATUS_READBACK__ || null;
    if (!status && node) {
      try { status = JSON.parse(node.textContent || '{}'); } catch (error) { status = { parseError: String(error) }; }
    }
    return JSON.stringify({
      href: location.href,
      title: document.title,
      statusFound: !!status,
      status,
      versionAttr: document.documentElement.getAttribute('data-dxm-amazon-status-readback-version') || document.documentElement.getAttribute('data-dxm-amazon-version'),
      statusAttr: document.documentElement.getAttribute('data-dxm-amazon-status-readback'),
      bodyVersionHint: (norm(document.body && document.body.innerText).match(/DXM Amazon Crawlbox V1\\s*v?\\d+\\.\\d+\\.\\d+|v\\d+\\.\\d+\\.\\d+/) || [null])[0]
    });
  })()`;
  const evalResponse = await postWebBridge(args, 'evaluate', { code });
  const evalError = getToolError(evalResponse);
  if (evalResponse.error || evalError) {
    console.log(JSON.stringify(result('page_uncontrollable', { error: evalResponse.error || evalError, tab: targetTab }), null, 2));
    return;
  }

  let parsed = null;
  try {
    parsed = JSON.parse(extractEvaluateValue(evalResponse) || '{}');
  } catch (error) {
    console.log(JSON.stringify(result('status_parse_failed', { error: String(error), raw: evalResponse.data }), null, 2));
    return;
  }
  if (!parsed.statusFound) {
    console.log(JSON.stringify(result('script_status_not_exposed', { page: parsed, tab: targetTab }), null, 2));
    return;
  }
  console.log(JSON.stringify(result('ok', { page: parsed, statusReadback: parsed.status }), null, 2));
}

main().catch((error) => {
  console.log(JSON.stringify(result('tool_exception', { error: String(error && error.stack ? error.stack : error) }), null, 2));
});
