#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  DEFAULT_MANIFEST_PATH,
  buildManifest,
} = require('./candidate-manifest');
const {
  buildLocalGate,
  runCheck,
} = require('./dxm-batch-execution-gate');
const {
  DEFAULT_QUEUE_PATH,
  buildBatchReport,
} = require('./exception-queue');
const {
  DEFAULT_STORE_PATH: DEFAULT_PRICE_STORE_PATH,
} = require('./amazon-price-store');
const {
  DEFAULT_STORE_PATH: DEFAULT_EVIDENCE_STORE_PATH,
} = require('./aliexpress-evidence-store');
const {
  DEFAULT_RULES_PATH: DEFAULT_RISK_RULES_PATH,
} = require('./product-risk-filter');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_PIPELINE_REPORT_PATH = path.join(ROOT, 'runs', 'batch-pipeline-report.json');
const SCHEMA_VERSION = 'dxm-batch-pipeline-report-v1';
const DEFAULT_ENDPOINT = 'http://127.0.0.1:10086/command';
const DEFAULT_SESSION = 'dxm-batch-pipeline';
const DEFAULT_DXM_EDIT_URL = 'https://www.dianxiaomi.com/web/smtlocalProduct/draft';
const DEFAULT_WAIT_PUBLISH_URL = 'https://www.dianxiaomi.com/web/smtlocalProduct/offline';

function nowIso() {
  return new Date().toISOString();
}

function compactText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function parseArgs(argv) {
  const args = {
    command: argv[2] || 'help',
    inputPath: '',
    json: '',
    asinList: '',
    asinFile: '',
    outPath: DEFAULT_PIPELINE_REPORT_PATH,
    format: 'json',
    endpoint: process.env.WEBBRIDGE_ENDPOINT || DEFAULT_ENDPOINT,
    session: process.env.WEBBRIDGE_SESSION || DEFAULT_SESSION,
    timeoutMs: Number(process.env.WEBBRIDGE_TIMEOUT_MS || 12000),
    priceStorePath: process.env.AMAZON_PRICE_STORE || DEFAULT_PRICE_STORE_PATH,
    evidenceStorePath: process.env.ALIEXPRESS_EVIDENCE_STORE || DEFAULT_EVIDENCE_STORE_PATH,
    queuePath: process.env.DXM_EXCEPTION_QUEUE || DEFAULT_QUEUE_PATH,
    riskRulesPath: process.env.PRODUCT_RISK_RULES || DEFAULT_RISK_RULES_PATH,
    exchangeRate: process.env.TASK_EXCHANGE_RATE || '',
    multiplier: process.env.TASK_PRICE_MULTIPLIER || '',
    expectedStock: '',
    expectedOrigin: '',
    expectedFreightTemplate: '',
    expectedCategory: '',
    includeResolved: false,
    editUrl: process.env.DXM_EVIDENCE_SYNC_URL || DEFAULT_DXM_EDIT_URL,
    editUrlExplicit: false,
    waitPublishUrl: process.env.DXM_WAIT_PUBLISH_URL || DEFAULT_WAIT_PUBLISH_URL,
    pageWaitMs: Number(process.env.DXM_WAIT_PUBLISH_READBACK_WAIT_MS || 8000),
    syncEvidence: false,
    editPreflight: false,
    waitReadback: false,
    captureMissingPrices: false,
    writePriceCaptures: false,
    writePriceCaptureExceptions: false,
    priceCapturePageWaitMs: Number(process.env.AMAZON_PRICE_CAPTURE_WAIT_MS || 10000),
    priceCaptureDelayMs: 500,
    writeExceptions: false,
    write: false,
  };
  for (let i = 3; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === '--file' && next) {
      args.inputPath = path.resolve(next);
      i += 1;
    } else if (arg === '--json' && next) {
      args.json = next;
      i += 1;
    } else if (arg === '--asins' && next) {
      args.asinList = next;
      i += 1;
    } else if (arg === '--asin-file' && next) {
      args.asinFile = path.resolve(next);
      i += 1;
    } else if (arg === '--out' && next) {
      args.outPath = path.resolve(next);
      i += 1;
    } else if (arg === '--format' && next) {
      args.format = compactText(next).toLowerCase();
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
    } else if (arg === '--price-store' && next) {
      args.priceStorePath = path.resolve(next);
      i += 1;
    } else if (arg === '--evidence-store' && next) {
      args.evidenceStorePath = path.resolve(next);
      i += 1;
    } else if (arg === '--queue' && next) {
      args.queuePath = path.resolve(next);
      i += 1;
    } else if (arg === '--risk-rules' && next) {
      args.riskRulesPath = path.resolve(next);
      i += 1;
    } else if (arg === '--exchange-rate' && next) {
      args.exchangeRate = next;
      i += 1;
    } else if (arg === '--multiplier' && next) {
      args.multiplier = next;
      i += 1;
    } else if (arg === '--expected-stock' && next) {
      args.expectedStock = next;
      i += 1;
    } else if (arg === '--expected-origin' && next) {
      args.expectedOrigin = next;
      i += 1;
    } else if (arg === '--expected-freight-template' && next) {
      args.expectedFreightTemplate = next;
      i += 1;
    } else if (arg === '--expected-category' && next) {
      args.expectedCategory = next;
      i += 1;
    } else if (arg === '--include-resolved') {
      args.includeResolved = true;
    } else if (arg === '--edit-url' && next) {
      args.editUrl = next;
      args.editUrlExplicit = true;
      i += 1;
    } else if (arg === '--wait-publish-url' && next) {
      args.waitPublishUrl = next;
      i += 1;
    } else if (arg === '--page-wait-ms' && next) {
      args.pageWaitMs = Number(next);
      i += 1;
    } else if (arg === '--sync-evidence') {
      args.syncEvidence = true;
    } else if (arg === '--edit-preflight') {
      args.editPreflight = true;
    } else if (arg === '--wait-readback') {
      args.waitReadback = true;
    } else if (arg === '--capture-missing-prices') {
      args.captureMissingPrices = true;
    } else if (arg === '--write-price-captures') {
      args.writePriceCaptures = true;
    } else if (arg === '--write-price-capture-exceptions') {
      args.writePriceCaptureExceptions = true;
    } else if (arg === '--price-capture-page-wait-ms' && next) {
      args.priceCapturePageWaitMs = Number(next);
      i += 1;
    } else if (arg === '--price-capture-delay-ms' && next) {
      args.priceCaptureDelayMs = Number(next);
      i += 1;
    } else if (arg === '--write-exceptions') {
      args.writeExceptions = true;
    } else if (arg === '--write') {
      args.write = true;
    }
  }
  return args;
}

function usage() {
  return {
    tool: 'dxm-batch-pipeline',
    commands: {
      plan: 'Local-only batch pipeline report. Builds manifest, local gate, exception report, and next-action order.',
      check: 'Same pipeline plus optional explicit readonly browser checks when flags are supplied.',
    },
    inputs: {
      '--file / --json': 'Candidate CSV/JSON input. Required for plan/check.',
      '--asins / --asin-file': 'Optional ASIN subset from the candidate input.',
      '--exchange-rate / --multiplier': 'Runtime price formula inputs.',
    },
    optionalReadonlyBrowserSteps: [
      '--capture-missing-prices',
      '--sync-evidence',
      '--edit-preflight',
      '--wait-readback',
    ],
    writes: {
      report: '--write --out <path>',
      exceptionQueue: '--write-exceptions',
      priceStore: '--capture-missing-prices --write-price-captures',
      priceCaptureExceptions: '--capture-missing-prices --write-price-capture-exceptions',
    },
    safety: [
      'Default mode is local dry-run and does not open browser pages.',
      'This tool does not collect, claim, edit fields, save, move to wait-to-publish, publish, one-click publish, delete, order, cart, chat, or submit forms.',
      'Browser reads happen only when explicit readonly browser flags are supplied.',
      'Writes require their explicit write flags.',
    ],
    defaultOut: DEFAULT_PIPELINE_REPORT_PATH,
    related: {
      manifest: DEFAULT_MANIFEST_PATH,
      priceStore: DEFAULT_PRICE_STORE_PATH,
      evidenceStore: DEFAULT_EVIDENCE_STORE_PATH,
      exceptionQueue: DEFAULT_QUEUE_PATH,
    },
  };
}

function output(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function validateInput(args) {
  if (!args.inputPath && !args.json) {
    throw new Error(`${args.command} requires --file or --json candidate input`);
  }
  if (!['plan', 'check'].includes(args.command)) {
    throw new Error(`Unsupported command: ${args.command}`);
  }
}

function riskRowsFromManifest(manifest) {
  return Object.values(manifest.records).map((row) => ({
    asin: row.asin,
    title: row.amazon ? row.amazon.title : '',
    brand: row.amazon ? row.amazon.brand : '',
    bullets: row.amazon ? row.amazon.bullets : '',
    description: row.amazon ? row.amazon.description : '',
    imageAlt: row.amazon ? row.amazon.imageAlt : '',
    imageNotes: row.amazon ? row.amazon.imageNotes : '',
    category: row.productFamily || '',
    sourceUrl: row.amazon ? row.amazon.url : '',
  }));
}

function buildManifestArgs(args) {
  return {
    inputPath: args.inputPath,
    json: args.json,
    asinList: args.asinList,
    asinFile: args.asinFile,
    outPath: '',
    format: 'json',
    priceStorePath: args.priceStorePath,
    evidenceStorePath: args.evidenceStorePath,
    queuePath: args.queuePath,
    riskRulesPath: args.riskRulesPath,
    exchangeRate: args.exchangeRate,
    multiplier: args.multiplier,
    expectedStock: args.expectedStock,
    expectedOrigin: args.expectedOrigin,
    expectedFreightTemplate: args.expectedFreightTemplate,
    includeResolved: args.includeResolved,
    write: false,
  };
}

function buildGateArgs(args, manifest) {
  return {
    endpoint: args.endpoint,
    session: args.session,
    timeoutMs: args.timeoutMs,
    asinList: '',
    asinFile: '',
    evidenceStorePath: args.evidenceStorePath,
    priceStorePath: args.priceStorePath,
    queuePath: args.queuePath,
    riskRulesPath: args.riskRulesPath,
    riskFilePath: '',
    riskJson: JSON.stringify(riskRowsFromManifest(manifest)),
    exchangeRate: args.exchangeRate,
    multiplier: args.multiplier,
    expectedStock: args.expectedStock,
    expectedCategory: args.expectedCategory,
    editUrl: args.editUrl,
    editUrlExplicit: args.editUrlExplicit,
    waitPublishUrl: args.waitPublishUrl,
    pageWaitMs: args.pageWaitMs,
    syncEvidence: args.syncEvidence,
    editPreflight: args.editPreflight,
    waitReadback: args.waitReadback,
    captureMissingPrices: args.captureMissingPrices,
    writePriceCaptures: args.writePriceCaptures,
    writePriceCaptureExceptions: args.writePriceCaptureExceptions,
    priceCapturePageWaitMs: args.priceCapturePageWaitMs,
    priceCaptureDelayMs: args.priceCaptureDelayMs,
    writeExceptions: args.writeExceptions,
  };
}

function buildExceptionReport(args, asins) {
  return buildBatchReport({
    queuePath: args.queuePath,
    asinList: asins.join(','),
    asinFile: '',
    includeResolved: args.includeResolved,
  });
}

function addToGroup(groups, action, asin) {
  if (!action || !asin) return;
  if (!groups[action]) groups[action] = [];
  if (!groups[action].includes(asin)) groups[action].push(asin);
}

function hasBlocker(row, pattern) {
  return (row.blockers || []).some((reason) => pattern.test(reason));
}

function isRiskBlocked(row) {
  return hasBlocker(row, /risk|logo|brand|food|medical|children|battery|electric|weapon|hazardous|adult|fragile|apparel/);
}

function buildNextActionGroups(manifest, gate, exceptionReport) {
  const groups = {};
  Object.values(manifest.records).forEach((row) => addToGroup(groups, row.gates.nextAction, row.asin));
  (gate.rows || []).forEach((row) => addToGroup(groups, row.nextAction, row.asin));
  Object.entries(exceptionReport.nextActionGroups || {}).forEach(([action, asins]) => {
    asins.forEach((asin) => addToGroup(groups, action, asin));
  });
  return groups;
}

function buildRecommendedOrder(manifest, gate, exceptionReport) {
  const rows = gate.rows || [];
  const byStatus = Object.fromEntries(Object.values(manifest.records).map((row) => [row.asin, row.gates.precheckRoutingStatus]));
  const exceptionByAsin = Object.fromEntries((exceptionReport.rows || []).map((row) => [row.asin, row]));
  const collect = (predicate) => rows.filter(predicate).map((row) => row.asin);
  const steps = [
    {
      step: 'manual_risk_review_or_skip',
      asins: collect(isRiskBlocked),
    },
    {
      step: 'recover_prices',
      asins: collect((row) => !isRiskBlocked(row) && hasBlocker(row, /^amazon_|^price_/)),
    },
    {
      step: 'verify_aliexpress_categories',
      asins: collect((row) => !isRiskBlocked(row) && hasBlocker(row, /^category_|^aliexpress_|mapping/)),
    },
    {
      step: 'retry_control_readback',
      asins: rows
        .filter((row) => {
          const exception = exceptionByAsin[row.asin];
          return exception && exception.status === 'control_retryable';
        })
        .map((row) => row.asin),
    },
    {
      step: 'readonly_edit_preflight',
      asins: collect((row) => row.localReady && byStatus[row.asin] === 'auto_ready'),
    },
    {
      step: 'wait_publish_readback',
      asins: collect((row) => hasBlocker(row, /^wait_publish_/)),
    },
    {
      step: 'batch_exception_report',
      asins: (exceptionReport.rows || [])
        .filter((row) => row.status !== 'clear')
        .map((row) => row.asin),
    },
  ];
  return steps.map((step) => ({
    ...step,
    asins: Array.from(new Set(step.asins)),
  }));
}

function summarize(manifest, gate, exceptionReport, checkReport) {
  const finalGate = checkReport && checkReport.finalGate ? checkReport.finalGate : gate;
  return {
    total: Object.keys(manifest.records).length,
    manifestAutoReady: manifest.summary.autoReady,
    gateReady: finalGate.summary ? finalGate.summary.ready : 0,
    blocked: finalGate.summary ? finalGate.summary.blocked : 0,
    controlRetryable: exceptionReport.summary.controlRetryable,
    manifestNextActionCounts: manifest.summary.byNextAction,
    gateBlockerCounts: finalGate.summary ? finalGate.summary.byBlocker : {},
    exceptionNextActionCounts: exceptionReport.summary.byNextAction,
  };
}

function safety(args) {
  return {
    businessActions: false,
    browserActions: Boolean(args.captureMissingPrices || args.syncEvidence || args.editPreflight || args.waitReadback),
    writesManifestReport: Boolean(args.write),
    writesExceptionQueue: Boolean(args.writeExceptions || (args.captureMissingPrices && args.writePriceCaptureExceptions)),
    writesPriceStore: Boolean(args.captureMissingPrices && args.writePriceCaptures),
  };
}

async function buildPipelineReport(args) {
  validateInput(args);
  const manifest = buildManifest(buildManifestArgs(args));
  const asins = Object.keys(manifest.records);
  const gateArgs = buildGateArgs(args, manifest);
  const localGate = buildLocalGate(gateArgs, asins);
  const checkReport = args.command === 'check' ? await runCheck(gateArgs, asins) : null;
  const finalGate = checkReport && checkReport.finalGate ? checkReport.finalGate : localGate;
  const exceptionReport = buildExceptionReport(args, asins);
  return {
    ok: Boolean(!checkReport || checkReport.ok),
    schemaVersion: SCHEMA_VERSION,
    generatedAt: nowIso(),
    command: args.command,
    dryRun: !args.write
      && !args.writeExceptions
      && !(args.captureMissingPrices && args.writePriceCaptures)
      && !(args.captureMissingPrices && args.writePriceCaptureExceptions),
    safety: safety(args),
    inputs: {
      inputPath: args.inputPath,
      jsonSupplied: Boolean(args.json),
      asinList: args.asinList,
      asinFile: args.asinFile,
      exchangeRate: args.exchangeRate,
      multiplier: args.multiplier,
      expectedStock: args.expectedStock,
      expectedOrigin: args.expectedOrigin,
      expectedFreightTemplate: args.expectedFreightTemplate,
      expectedCategory: args.expectedCategory,
      priceStorePath: args.priceStorePath,
      evidenceStorePath: args.evidenceStorePath,
      queuePath: args.queuePath,
      riskRulesPath: args.riskRulesPath,
    },
    candidateManifest: manifest,
    localGate,
    checkReport,
    finalGate,
    exceptionReport,
    summary: summarize(manifest, localGate, exceptionReport, checkReport),
    nextActionGroups: buildNextActionGroups(manifest, finalGate, exceptionReport),
    recommendedOrder: buildRecommendedOrder(manifest, finalGate, exceptionReport),
  };
}

function renderMarkdown(report) {
  const lines = [];
  lines.push('# DXM Batch Pipeline Report');
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Command: ${report.command}`);
  lines.push(`Dry run: ${report.dryRun}`);
  lines.push('');
  lines.push('## Safety');
  lines.push('');
  Object.entries(report.safety).forEach(([key, value]) => {
    lines.push(`- ${key}: ${value}`);
  });
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Total: ${report.summary.total}`);
  lines.push(`- Manifest auto ready: ${report.summary.manifestAutoReady}`);
  lines.push(`- Gate ready: ${report.summary.gateReady}`);
  lines.push(`- Blocked: ${report.summary.blocked}`);
  lines.push(`- Control retryable: ${report.summary.controlRetryable}`);
  lines.push('');
  lines.push('## Recommended Order');
  lines.push('');
  report.recommendedOrder.forEach((item) => {
    lines.push(`- ${item.step}: ${item.asins.length ? item.asins.join(', ') : 'none'}`);
  });
  lines.push('');
  lines.push('## Gate Rows');
  lines.push('');
  lines.push('| ASIN | Ready | Next Action | Blockers |');
  lines.push('|---|---:|---|---|');
  (report.finalGate.rows || []).forEach((row) => {
    lines.push(`| ${row.asin} | ${row.localReady ? 'yes' : 'no'} | ${row.nextAction || '-'} | ${(row.blockers || []).join('; ') || '-'} |`);
  });
  lines.push('');
  return `${lines.join('\n')}\n`;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.command === 'help') {
    output(usage());
    return;
  }
  const report = await buildPipelineReport(args);
  const rendered = args.format === 'markdown' ? renderMarkdown(report) : `${JSON.stringify(report, null, 2)}\n`;
  if (args.write) {
    fs.mkdirSync(path.dirname(args.outPath), { recursive: true });
    fs.writeFileSync(args.outPath, rendered);
  }
  if (args.format === 'markdown') process.stdout.write(rendered);
  else output({ ok: report.ok, dryRun: report.dryRun, outPath: args.write ? args.outPath : '', report });
}

if (require.main === module) {
  main().catch((error) => {
    output({ ok: false, error: String(error && error.message ? error.message : error) });
    process.exitCode = 1;
  });
}

module.exports = {
  DEFAULT_PIPELINE_REPORT_PATH,
  SCHEMA_VERSION,
  buildPipelineReport,
  renderMarkdown,
};
