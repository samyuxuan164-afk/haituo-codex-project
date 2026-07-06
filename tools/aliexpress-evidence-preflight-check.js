#!/usr/bin/env node
'use strict';

const path = require('path');
const {
  DEFAULT_STORE_PATH,
  readStore,
} = require('./aliexpress-evidence-store');
const {
  buildBatchStatus,
  summarizeStore,
} = require('./aliexpress-evidence-batch');
const {
  buildBrowserCache,
  extractWebBridgeValue,
  getToolError,
  postWebBridge,
  readBrowserCache,
  summarize,
  syncToBrowser,
} = require('./aliexpress-evidence-browser-cache');

const DEFAULT_ENDPOINT = 'http://127.0.0.1:10086/command';
const DEFAULT_SESSION = 'dxm-aliexpress-evidence-preflight-check';
const DEFAULT_DXM_URL = 'https://www.dianxiaomi.com/web/smtlocalProduct/draft';
const READONLY_PREFLIGHT_NODE_ID = 'dxm-automation-v1-readonly-preflight-json';
const READONLY_PREFLIGHT_FUNCTION = '__DXM_AUTOMATION_V1_READONLY_PREFLIGHT__';

function parseArgs(argv) {
  const args = {
    command: argv[2] || 'help',
    storePath: process.env.ALIEXPRESS_EVIDENCE_STORE || DEFAULT_STORE_PATH,
    endpoint: process.env.WEBBRIDGE_ENDPOINT || DEFAULT_ENDPOINT,
    session: process.env.WEBBRIDGE_SESSION || DEFAULT_SESSION,
    timeoutMs: Number(process.env.WEBBRIDGE_TIMEOUT_MS || 10000),
    asinList: '',
    asinFile: '',
    url: process.env.DXM_EVIDENCE_SYNC_URL || DEFAULT_DXM_URL,
    urlExplicit: false,
    sync: false,
    preflight: false,
  };
  for (let i = 3; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === '--store' && next) {
      args.storePath = path.resolve(next);
      i += 1;
    } else if (arg === '--endpoint' && next) {
      args.endpoint = next;
      i += 1;
    } else if (arg === '--session' && next) {
      args.session = next;
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
    } else if (arg === '--url' && next) {
      args.url = next;
      args.urlExplicit = true;
      i += 1;
    } else if (arg === '--sync') {
      args.sync = true;
    } else if (arg === '--preflight') {
      args.preflight = true;
    }
  }
  return args;
}

function output(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function usage() {
  return {
    tool: 'aliexpress-evidence-preflight-check',
    commands: {
      local: 'Read project evidence store summary and optional ASIN status without browser access.',
      'sync-read': 'Sync the evidence store into a Dianxiaomi browser page, then read browser cache summary back.',
      preflight: 'Read readonly edit-page preflight from the current or supplied Dianxiaomi edit page. Use --sync to sync first.',
      check: 'Run local checks, then optional --sync and optional --preflight in one report.',
    },
    options: {
      '--asins': 'Comma/space separated ASIN list for local evidence status.',
      '--asin-file': 'File containing ASINs for local evidence status.',
      '--sync': 'Write evidence store to browser localStorage through WebBridge.',
      '--preflight': 'Read readonly edit-page preflight through WebBridge.',
      '--url': 'Optional Dianxiaomi edit URL to open before readonly preflight.',
    },
    safety: [
      'This tool does not click edit rules, save, move to wait-to-publish, publish, one-click publish, claim, collect, cart, order, chat, or submit forms.',
      'Browser actions are limited to optional navigation, localStorage evidence-cache sync, and readonly JavaScript readback.',
    ],
    readonlyPreflightFunction: READONLY_PREFLIGHT_FUNCTION,
    readonlyPreflightNode: READONLY_PREFLIGHT_NODE_ID,
    defaultStore: DEFAULT_STORE_PATH,
    defaultDxmUrl: DEFAULT_DXM_URL,
  };
}

function hasBatchArgs(args) {
  return Boolean(args.asinList || args.asinFile);
}

function buildLocalReport(args) {
  const store = readStore(args.storePath);
  const cache = buildBrowserCache(store);
  const report = {
    ok: true,
    store: summarizeStore({ storePath: args.storePath }),
    browserPayload: summarize(cache),
  };
  if (hasBatchArgs(args)) {
    report.batch = buildBatchStatus({
      storePath: args.storePath,
      asinList: args.asinList,
      asinFile: args.asinFile,
    });
  }
  return report;
}

async function navigateIfRequested(args) {
  if (!args.urlExplicit) return { ok: true, skipped: true };
  const opened = await postWebBridge(args, 'navigate', {
    url: args.url,
    newTab: false,
    group_title: 'DXM证据Preflight',
  });
  const error = getToolError(opened);
  if (opened.error || error) {
    return { ok: false, status: opened.error || error, message: opened.message || '', raw: opened.data || null };
  }
  return { ok: true, page: opened.data && opened.data.data ? opened.data.data : opened.data };
}

async function readReadonlyPreflight(args) {
  const opened = await navigateIfRequested(args);
  if (!opened.ok) return { ok: false, stage: 'navigate', ...opened };
  const code = `(() => {
    const functionName = ${JSON.stringify(READONLY_PREFLIGHT_FUNCTION)};
    const nodeId = ${JSON.stringify(READONLY_PREFLIGHT_NODE_ID)};
    const base = {
      href: location.href,
      title: document.title,
      readyState: document.readyState,
      hasReadonlyFunction: typeof window[functionName] === 'function',
      hasReadonlyNode: Boolean(document.getElementById(nodeId))
    };
    try {
      if (typeof window[functionName] === 'function') {
        return JSON.stringify({ ...base, source: 'function', preflight: window[functionName]() });
      }
      const node = document.getElementById(nodeId);
      if (node && node.textContent) {
        return JSON.stringify({ ...base, source: 'dom-node', preflight: JSON.parse(node.textContent) });
      }
      return JSON.stringify({ ...base, source: 'missing', status: 'readonly_preflight_missing' });
    } catch (error) {
      return JSON.stringify({ ...base, source: 'error', status: 'readonly_preflight_error', error: String(error && error.message ? error.message : error) });
    }
  })()`;
  const response = await postWebBridge(args, 'evaluate', { code });
  const error = getToolError(response);
  if (response.error || error) {
    return { ok: false, stage: 'evaluate', status: response.error || error, message: response.message || '', raw: response.data || null };
  }
  try {
    const parsed = JSON.parse(extractWebBridgeValue(response) || '{}');
    return {
      ok: parsed.source === 'function' || parsed.source === 'dom-node',
      readonly: true,
      ...parsed,
      analysis: analyzePreflight(parsed.preflight),
    };
  } catch (parseError) {
    return { ok: false, stage: 'parse', status: 'readonly_preflight_parse_failed', error: String(parseError), raw: response.data || null };
  }
}

function analyzePreflight(preflight) {
  if (!preflight || typeof preflight !== 'object') {
    return {
      status: 'missing',
      currentAsin: '',
      evidenceStoreOk: false,
      categoryEvidenceOk: false,
      safeToSaveToWaitPublish: false,
      blockers: ['readonly preflight payload missing'],
    };
  }
  const categoryEvidence = preflight.categoryEvidence || {};
  const blockers = Array.isArray(preflight.blockers) ? preflight.blockers : [];
  return {
    status: preflight.safeToSaveToWaitPublish ? 'ready_for_wait_publish_save' : 'blocked',
    currentAsin: preflight.asin || preflight.currentAsin || '',
    evidenceStoreOk: Boolean(preflight.evidenceStore && preflight.evidenceStore.ok),
    categoryEvidenceOk: Boolean(categoryEvidence.ok || categoryEvidence.verified),
    categoryEvidenceReason: categoryEvidence.reason || '',
    preflightPass: Boolean(preflight.preflightPass),
    safeToSaveToWaitPublish: Boolean(preflight.safeToSaveToWaitPublish),
    blockers,
  };
}

async function syncAndRead(args) {
  const store = readStore(args.storePath);
  const cache = buildBrowserCache(store);
  const synced = await syncToBrowser(args, cache);
  if (!synced.ok) return { ok: false, sync: synced };
  const browserRead = await readBrowserCache(args);
  return {
    ok: Boolean(browserRead.ok),
    sync: synced,
    browserRead,
  };
}

async function runCheck(args) {
  const report = {
    ok: true,
    local: buildLocalReport(args),
  };
  if (args.sync) {
    report.syncRead = await syncAndRead(args);
    report.ok = report.ok && Boolean(report.syncRead.ok);
  }
  if (args.preflight) {
    report.preflight = await readReadonlyPreflight(args);
    report.ok = report.ok && Boolean(report.preflight.ok);
  }
  return report;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.command === 'local') {
    output(buildLocalReport(args));
    return;
  }
  if (args.command === 'sync-read') {
    output(await syncAndRead(args));
    return;
  }
  if (args.command === 'preflight') {
    if (args.sync) {
      const synced = await syncAndRead(args);
      if (!synced.ok) {
        output({ ok: false, syncRead: synced });
        return;
      }
      output({ ok: true, syncRead: synced, preflight: await readReadonlyPreflight(args) });
      return;
    }
    output(await readReadonlyPreflight(args));
    return;
  }
  if (args.command === 'check') {
    output(await runCheck(args));
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
  analyzePreflight,
  buildLocalReport,
  readReadonlyPreflight,
  runCheck,
  syncAndRead,
};
