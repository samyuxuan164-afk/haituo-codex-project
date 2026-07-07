#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  DEFAULT_STORE_PATH: DEFAULT_EVIDENCE_STORE_PATH,
} = require('./aliexpress-evidence-store');
const {
  DEFAULT_STORE_PATH: DEFAULT_PRICE_STORE_PATH,
  buildStatus: buildPriceStatus,
} = require('./amazon-price-store');
const {
  buildBatchStatus: buildEvidenceStatus,
} = require('./aliexpress-evidence-batch');
const {
  DEFAULT_QUEUE_PATH,
  upsertException,
} = require('./exception-queue');
const {
  readReadonlyPreflight,
  syncAndRead,
} = require('./aliexpress-evidence-preflight-check');
const {
  analyzeRows: analyzeWaitPublishRows,
  buildExpectedRows: buildWaitPublishExpectedRows,
  readWaitPublishPage,
} = require('./dxm-wait-publish-readback');
const {
  runBatchCapture: runAmazonDisplayedPriceBatchCapture,
} = require('./amazon-displayed-price-batch');
const {
  DEFAULT_RULES_PATH: DEFAULT_RISK_RULES_PATH,
  screenRecords: screenProductRiskRecords,
} = require('./product-risk-filter');
const { businessGates } = require('../src/dxm-automation-core');

const DEFAULT_ENDPOINT = 'http://127.0.0.1:10086/command';
const DEFAULT_SESSION = 'dxm-batch-execution-gate';
const DEFAULT_DXM_EDIT_URL = 'https://www.dianxiaomi.com/web/smtlocalProduct/draft';
const DEFAULT_WAIT_PUBLISH_URL = 'https://www.dianxiaomi.com/web/smtlocalProduct/offline';

function compactText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeAsin(value) {
  const asin = compactText(value).toUpperCase();
  if (!/^B0[A-Z0-9]{8}$/.test(asin)) throw new Error(`Invalid ASIN: ${value}`);
  return asin;
}

function readAsins(args) {
  const values = [];
  if (args.asinList) values.push(...args.asinList.split(/[,\s]+/));
  if (args.asinFile) values.push(...fs.readFileSync(args.asinFile, 'utf8').split(/[,\s]+/));
  const seen = new Set();
  return values
    .map(compactText)
    .filter(Boolean)
    .map(normalizeAsin)
    .filter((asin) => {
      if (seen.has(asin)) return false;
      seen.add(asin);
      return true;
    });
}

function parseArgs(argv) {
  const args = {
    command: argv[2] || 'help',
    endpoint: process.env.WEBBRIDGE_ENDPOINT || DEFAULT_ENDPOINT,
    session: process.env.WEBBRIDGE_SESSION || DEFAULT_SESSION,
    timeoutMs: Number(process.env.WEBBRIDGE_TIMEOUT_MS || 12000),
    asinList: '',
    asinFile: '',
    evidenceStorePath: process.env.ALIEXPRESS_EVIDENCE_STORE || DEFAULT_EVIDENCE_STORE_PATH,
    priceStorePath: process.env.AMAZON_PRICE_STORE || DEFAULT_PRICE_STORE_PATH,
    queuePath: process.env.DXM_EXCEPTION_QUEUE || DEFAULT_QUEUE_PATH,
    riskRulesPath: process.env.PRODUCT_RISK_RULES || DEFAULT_RISK_RULES_PATH,
    riskFilePath: '',
    riskJson: '',
    exchangeRate: process.env.TASK_EXCHANGE_RATE || '',
    multiplier: process.env.TASK_PRICE_MULTIPLIER || '',
    expectedStock: '',
    expectedCategory: '',
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
    } else if (arg === '--timeout-ms' && next) {
      args.timeoutMs = Number(next);
      i += 1;
    } else if (arg === '--asins' && next) {
      args.asinList = next;
      i += 1;
    } else if (arg === '--asin-file' && next) {
      args.asinFile = path.resolve(next);
      i += 1;
    } else if (arg === '--evidence-store' && next) {
      args.evidenceStorePath = path.resolve(next);
      i += 1;
    } else if (arg === '--price-store' && next) {
      args.priceStorePath = path.resolve(next);
      i += 1;
    } else if (arg === '--queue' && next) {
      args.queuePath = path.resolve(next);
      i += 1;
    } else if (arg === '--risk-rules' && next) {
      args.riskRulesPath = path.resolve(next);
      i += 1;
    } else if (arg === '--risk-file' && next) {
      args.riskFilePath = path.resolve(next);
      i += 1;
    } else if (arg === '--risk-json' && next) {
      args.riskJson = next;
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
    } else if (arg === '--expected-category' && next) {
      args.expectedCategory = next;
      i += 1;
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
    }
  }
  return args;
}

function output(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function usage() {
  return {
    tool: 'dxm-batch-execution-gate',
    commands: {
      plan: 'Local-only batch gate: evidence + Amazon displayed price/formula + next action per ASIN.',
      check: 'Run local gate plus optional --sync-evidence, --edit-preflight, and --wait-readback.',
    },
    options: {
      '--asins / --asin-file': 'Required batch ASIN input.',
      '--exchange-rate / --multiplier': 'Required for price formula readiness.',
      '--expected-stock': 'Optional wait-to-publish stock check value.',
      '--risk-file / --risk-json': 'Optional product candidate records for machine risk screening.',
      '--risk-rules': 'Optional custom product risk rules file.',
      '--sync-evidence': 'Readonly browser localStorage sync/readback through WebBridge.',
      '--edit-preflight': 'Readonly current/supplied edit-page preflight through WebBridge.',
      '--wait-readback': 'Readonly wait-to-publish list readback through WebBridge.',
      '--capture-missing-prices': 'Readonly Amazon displayed-price batch capture for ASINs missing trusted prices. Dry-run unless --write-price-captures is also used.',
      '--write-price-captures': 'Write captured Amazon displayed prices to the price store. Requires --capture-missing-prices.',
      '--write-price-capture-exceptions': 'Write Amazon price-capture failures to the exception queue. Requires --capture-missing-prices.',
      '--write-exceptions': 'Write blockers to the exception queue. Omit for dry-run.',
    },
    safety: [
      'This tool is a gate/orchestrator only.',
      'It does not collect, claim, edit fields, save, move products, publish, one-click publish, delete, order, cart, chat, or submit forms.',
      'Exception queue writes happen only with --write-exceptions.',
      'Amazon price-store writes happen only with --capture-missing-prices --write-price-captures.',
    ],
  };
}

function buildLocalGate(args, asins) {
  const evidence = buildEvidenceStatus({
    storePath: args.evidenceStorePath,
    asinList: asins.join(','),
  });
  const prices = buildPriceStatus({
    storePath: args.priceStorePath,
    asinList: asins.join(','),
    exchangeRate: args.exchangeRate,
    multiplier: args.multiplier,
  });
  const evidenceByAsin = Object.fromEntries(evidence.rows.map((row) => [row.asin, row]));
  const priceByAsin = Object.fromEntries(prices.rows.map((row) => [row.asin, row]));
  const riskStatus = buildRiskStatus(args, asins);
  const riskByAsin = Object.fromEntries((riskStatus.rows || []).map((row) => [row.asin, row]));
  const rows = asins.map((asin) => {
    const evidenceRow = evidenceByAsin[asin] || { asin, verified: false, status: 'missing', reason: 'category_evidence_missing' };
    const priceRow = priceByAsin[asin] || { asin, trusted: false, formulaOk: false, reason: 'amazon_displayed_price_missing' };
    const riskRow = riskByAsin[asin] || null;
    const blockers = [];
    if (!evidenceRow.verified) {
      blockers.push(evidenceReason(evidenceRow));
    }
    if (!priceRow.trusted) {
      blockers.push(priceRow.reason || (priceRow.status === 'out_of_range' ? 'amazon_original_price_out_of_range' : 'amazon_displayed_price_missing'));
    } else if (!priceRow.formulaOk) {
      blockers.push(priceRow.reason || 'price_formula_missing_exchange_rate_or_multiplier');
    }
    if (riskStatus.enabled && !riskRow) {
      blockers.push('product_risk_record_missing');
    } else if (riskRow && !riskRow.pass) {
      blockers.push(...riskReasons(riskRow));
    }
    return {
      asin,
      localReady: blockers.length === 0,
      readyForEditPreflight: blockers.length === 0,
      evidence: evidenceRow,
      price: priceRow,
      risk: riskRow,
      blockers: Array.from(new Set(blockers)),
      nextAction: blockers.length ? nextActionForBlockers(blockers) : 'open_edit_page_and_run_readonly_preflight',
    };
  });
  return {
    ok: true,
    rows,
    summary: summarizeRows(rows),
    evidenceSummary: evidence.summary,
    priceSummary: prices.summary,
    riskSummary: riskStatus.summary,
    riskScreening: {
      enabled: riskStatus.enabled,
      rulesPath: riskStatus.rulesPath || args.riskRulesPath,
      rows: riskStatus.rows || [],
    },
    amazonPriceCapturePlan: buildAmazonPriceCapturePlan(args, rows),
  };
}

function buildRiskStatus(args, asins) {
  if (!args.riskFilePath && !args.riskJson) {
    return {
      enabled: false,
      rows: [],
      summary: {
        enabled: false,
        total: 0,
      },
    };
  }
  const report = screenProductRiskRecords({
    rulesPath: args.riskRulesPath,
    queuePath: args.queuePath,
    filePath: args.riskFilePath,
    json: args.riskJson,
    writeExceptions: false,
  });
  const asinSet = new Set(asins);
  const rows = report.rows.filter((row) => asinSet.has(row.asin));
  const present = new Set(rows.map((row) => row.asin));
  return {
    enabled: true,
    rulesPath: report.rulesPath,
    rows,
    missingAsins: asins.filter((asin) => !present.has(asin)),
    summary: {
      ...report.summary,
      enabled: true,
      inBatch: rows.length,
      missingInRiskInput: asins.filter((asin) => !present.has(asin)).length,
    },
  };
}

function riskReasons(row) {
  const categories = row.matchedRules.map((match) => match.category).filter(Boolean);
  if (!categories.length) return ['product_risk_needs_review'];
  return Array.from(new Set(categories));
}

function needsAmazonDisplayedPrice(row) {
  if (!row || !row.price) return false;
  if (row.price.trusted) return false;
  const reason = compactText(row.price.reason || row.price.status || row.blockers.join(' '));
  return /amazon_displayed_price_missing|amazon_original_price_missing|missing/.test(reason);
}

function shellQuote(value) {
  const text = String(value || '');
  if (/^[A-Za-z0-9_./:=,@+-]+$/.test(text)) return text;
  return `'${text.replace(/'/g, "'\\''")}'`;
}

function buildAmazonPriceCapturePlan(args, rows) {
  const missingAsins = rows.filter(needsAmazonDisplayedPrice).map((row) => row.asin);
  const base = [
    'node',
    'tools/amazon-displayed-price-batch.js',
    'capture',
    '--asins',
    missingAsins.join(','),
    '--store',
    args.priceStorePath,
    '--page-wait-ms',
    args.priceCapturePageWaitMs,
    '--delay-ms',
    args.priceCaptureDelayMs,
  ];
  if (args.exchangeRate) base.push('--exchange-rate', args.exchangeRate);
  if (args.multiplier) base.push('--multiplier', args.multiplier);
  const dryRunCommand = missingAsins.length ? base.map(shellQuote).join(' ') : '';
  const writeCommand = missingAsins.length ? [...base, '--write-prices'].map(shellQuote).join(' ') : '';
  return {
    needed: missingAsins.length > 0,
    missingAsins,
    count: missingAsins.length,
    dryRunCommand,
    writeCommand,
    note: missingAsins.length
      ? 'Run dryRunCommand first. Use writeCommand only after the readonly capture result is trusted.'
      : 'No missing Amazon displayed prices detected.',
  };
}

function evidenceReason(row) {
  if (!row || row.status === 'missing') return 'category_evidence_missing';
  if (row.status === 'aliexpress_verification_required') return 'aliexpress_verification_required';
  if (row.status === 'dxm_category_validation_required') return 'dxm_category_validation_required';
  if (row.status === 'evidence_split') return 'aliexpress_category_evidence_split';
  if (row.status === 'semantic_consensus_needs_dxm_mapping') return 'aliexpress_dxm_category_map_missing';
  if (!row.dxmCandidateCategory) return 'aliexpress_dxm_category_map_missing';
  return row.reason || row.status || 'category_evidence_missing';
}

function nextActionForBlockers(blockers) {
  if (blockers.some((reason) => /^readonly_preflight_|^webbridge_/.test(reason))) return businessGates.nextActionForBlockers(blockers);
  if (blockers.some((reason) => /risk|logo|brand|food|medical|children|battery|electric|weapon|hazardous|adult|fragile|apparel/.test(reason))) return 'skip_or_manual_risk_review_before_collection';
  if (blockers.includes('aliexpress_verification_required')) return 'resolve_aliexpress_verification_then_resume_detail_capture';
  if (blockers.includes('dxm_category_validation_required')) return 'run_dxm_readonly_category_validation';
  if (blockers.some((reason) => /^category_|^aliexpress_/.test(reason))) return 'run_aliexpress_category_verification_or_import_confirmed_evidence';
  if (blockers.some((reason) => /^amazon_|^price_/.test(reason))) return 'recover_trusted_amazon_price_or_task_formula';
  if (blockers.some((reason) => /^wait_publish_/.test(reason))) return 'repair_saved_product_or_confirm_wait_publish_page';
  if (blockers.some((reason) => /^edit_preflight_/.test(reason))) return 'open_correct_edit_page_and_rerun_readonly_preflight';
  return 'manual_exception_review';
}

function summarizeRows(rows) {
  return {
    total: rows.length,
    ready: rows.filter((row) => row.localReady).length,
    blocked: rows.filter((row) => !row.localReady).length,
    byBlocker: rows.reduce((acc, row) => {
      row.blockers.forEach((reason) => {
        acc[reason] = (acc[reason] || 0) + 1;
      });
      return acc;
    }, {}),
  };
}

function mergePreflight(localGate, preflightReport) {
  const preflight = preflightReport && preflightReport.preflight ? preflightReport.preflight : null;
  const analysis = preflightReport && preflightReport.analysis ? preflightReport.analysis : null;
  const reportGate = businessGates.evaluateReadonlyPreflightReport(preflightReport || {});
  const currentAsin = analysis
    ? normalizeOptionalAsin(analysis.currentAsin)
    : normalizeOptionalAsin(reportGate.normalized && reportGate.normalized.asin);
  const rows = localGate.rows.map((row) => {
    if (!preflightReport || !preflightReport.ok || !analysis) {
      const blockers = Array.from(new Set([...row.blockers, ...reportGate.blockers]));
      return {
        ...row,
        editPreflight: {
          matchedCurrentPage: false,
          currentAsin,
          safeToSaveToWaitPublish: false,
          preflightPass: false,
          blockers: reportGate.blockers,
          nextAction: reportGate.nextAction,
          environmentStatus: reportGate.environmentStatus,
        },
        blockers,
      };
    }
    if (!currentAsin) {
      return {
        ...row,
        editPreflight: {
          matchedCurrentPage: false,
          currentAsin,
          safeToSaveToWaitPublish: false,
          preflightPass: false,
          blockers: ['edit_preflight_current_asin_missing'],
        },
        blockers: Array.from(new Set([...row.blockers, 'edit_preflight_current_asin_missing'])),
      };
    }
    if (row.asin !== currentAsin) {
      return {
        ...row,
        editPreflight: {
          matchedCurrentPage: false,
          currentAsin,
          safeToSaveToWaitPublish: false,
          preflightPass: false,
          blockers: ['edit_preflight_current_asin_mismatch'],
        },
        blockers: Array.from(new Set([...row.blockers, 'edit_preflight_current_asin_mismatch'])),
      };
    }
    const preflightBlockers = reportGate.blockers.length
      ? reportGate.blockers
      : (analysis && Array.isArray(analysis.blockers) ? analysis.blockers : []);
    const blockers = reportGate.allowed ? row.blockers : [...row.blockers, ...preflightBlockers];
    if ((!analysis || !analysis.safeToSaveToWaitPublish) && !preflightBlockers.length) {
      blockers.push('edit_preflight_not_safe_to_save');
    }
    return {
      ...row,
      editPreflight: {
        matchedCurrentPage: Boolean(currentAsin && row.asin === currentAsin),
        currentAsin,
        safeToSaveToWaitPublish: Boolean(reportGate.allowed),
        preflightPass: Boolean(analysis && analysis.preflightPass),
        blockers: preflightBlockers,
        nextAction: reportGate.nextAction,
        environmentStatus: reportGate.environmentStatus,
      },
      blockers: Array.from(new Set(blockers)),
    };
  });
  const finalRows = rows.map((row) => ({
    ...row,
    localReady: row.blockers.length === 0,
    readyForEditPreflight: row.blockers.length === 0,
    nextAction: row.blockers.length ? nextActionForBlockers(row.blockers) : 'save_to_wait_publish_only_after_final_visible_confirmation',
  }));
  return {
    ...localGate,
    rows: finalRows,
    summary: summarizeRows(finalRows),
    editPreflightReport: {
      ok: Boolean(preflightReport && preflightReport.ok),
      currentAsin,
      href: preflightReport ? preflightReport.href : '',
      source: preflightReport ? preflightReport.source : '',
      analysis,
      preflight,
    },
  };
}

function normalizeOptionalAsin(value) {
  const asin = compactText(value).toUpperCase();
  return /^B0[A-Z0-9]{8}$/.test(asin) ? asin : '';
}

function mergeWaitReadback(localGate, waitAnalysis) {
  const waitByAsin = Object.fromEntries((waitAnalysis.rows || []).map((row) => [row.asin, row]));
  const rows = localGate.rows.map((row) => {
    const waitRow = waitByAsin[row.asin] || null;
    if (!waitRow) return row;
    const blockers = Array.from(new Set([...row.blockers, ...waitRow.blockers]));
    return {
      ...row,
      waitPublishReadback: {
        pass: Boolean(waitRow.pass),
        found: Boolean(waitRow.found),
        skuPresent: Boolean(waitRow.skuPresent),
        priceOk: waitRow.priceOk,
        stockOk: waitRow.stockOk,
        categoryOk: waitRow.categoryOk,
        blockers: waitRow.blockers,
      },
      blockers,
      localReady: blockers.length === 0,
      readyForEditPreflight: blockers.length === 0,
      nextAction: blockers.length ? nextActionForBlockers(blockers) : 'wait_publish_readback_passed_keep_unpublished',
    };
  });
  return {
    ...localGate,
    rows,
    summary: summarizeRows(rows),
  };
}

function writeExceptions(args, rows) {
  if (!args.writeExceptions) return [];
  const written = [];
  rows.forEach((row) => {
    row.blockers.forEach((reason) => {
      written.push(upsertException({
        asin: row.asin,
        stage: stageForReason(reason),
        reason,
        source: 'dxm_batch_execution_gate',
        details: {
          nextAction: row.nextAction,
          evidence: row.evidence,
          price: row.price,
          risk: row.risk || null,
          editPreflight: row.editPreflight || null,
          waitPublishReadback: row.waitPublishReadback || null,
        },
      }, args.queuePath));
    });
  });
  return written;
}

function stageForReason(reason) {
  if (/^category_|^aliexpress_/.test(reason)) return 'evidence_preflight';
  if (/^amazon_|^price_/.test(reason)) return 'price_preflight';
  if (/risk|logo|brand|food|medical|children|battery|electric|weapon|hazardous|adult|fragile|apparel/.test(reason)) return 'product_risk_filter';
  if (/^wait_publish_/.test(reason)) return 'wait_publish_readback';
  if (/edit_preflight/.test(reason)) return 'edit_preflight';
  return 'batch_execution_gate';
}

async function runCheck(args, asins) {
  let gate = buildLocalGate(args, asins);
  const report = {
    ok: true,
    dryRun: !args.writeExceptions
      && !(args.captureMissingPrices && args.writePriceCaptures)
      && !(args.captureMissingPrices && args.writePriceCaptureExceptions),
    safety: {
      businessActions: false,
      writesExceptionQueue: Boolean(args.writeExceptions),
      writesPriceStore: Boolean(args.captureMissingPrices && args.writePriceCaptures),
    },
    localGate: gate,
  };
  if (args.captureMissingPrices) {
    const missingAsins = gate.amazonPriceCapturePlan ? gate.amazonPriceCapturePlan.missingAsins : [];
    report.amazonPriceCapture = missingAsins.length
      ? await runAmazonDisplayedPriceBatchCapture({
        endpoint: args.endpoint,
        session: `${args.session}-amazon-price`,
        timeoutMs: args.timeoutMs,
        pageWaitMs: args.priceCapturePageWaitMs,
        storePath: args.priceStorePath,
        queuePath: args.queuePath,
        asinList: missingAsins.join(','),
        asinFile: '',
        limit: '',
        startIndex: 0,
        delayMs: args.priceCaptureDelayMs,
        minPrice: '',
        maxPrice: '',
        exchangeRate: args.exchangeRate,
        multiplier: args.multiplier,
        writePrices: args.writePriceCaptures,
        writeExceptions: args.writePriceCaptureExceptions,
        newTabEach: false,
      })
      : { ok: true, skipped: true, reason: 'no_missing_amazon_displayed_prices' };
    report.ok = report.ok && Boolean(report.amazonPriceCapture.ok);
    if (args.writePriceCaptures) {
      gate = buildLocalGate(args, asins);
      report.afterAmazonPriceCaptureGate = gate;
    }
  }
  if (args.syncEvidence) {
    report.evidenceBrowserSync = await syncAndRead({
      endpoint: args.endpoint,
      session: args.session,
      timeoutMs: args.timeoutMs,
      storePath: args.evidenceStorePath,
      url: args.editUrl,
      urlExplicit: args.editUrlExplicit,
    });
    report.ok = report.ok && Boolean(report.evidenceBrowserSync.ok);
  }
  if (args.editPreflight) {
    const preflight = await readReadonlyPreflight({
      endpoint: args.endpoint,
      session: args.session,
      timeoutMs: args.timeoutMs,
      storePath: args.evidenceStorePath,
      url: args.editUrl,
      urlExplicit: args.editUrlExplicit,
    });
    gate = mergePreflight(gate, preflight);
    report.editPreflight = preflight;
    report.afterEditPreflightGate = gate;
    report.ok = report.ok && Boolean(preflight.ok);
  }
  if (args.waitReadback) {
    const waitArgs = {
      endpoint: args.endpoint,
      session: args.session,
      timeoutMs: args.timeoutMs,
      url: args.waitPublishUrl,
      pageWaitMs: args.pageWaitMs,
      priceStorePath: args.priceStorePath,
      evidenceStorePath: args.evidenceStorePath,
      exchangeRate: args.exchangeRate,
      multiplier: args.multiplier,
      expectedStock: args.expectedStock,
      expectedCategory: args.expectedCategory,
    };
    const readback = await readWaitPublishPage(waitArgs, asins);
    report.waitPublishReadback = readback;
    if (readback.ok) {
      const expected = buildWaitPublishExpectedRows(waitArgs, asins);
      const analysis = analyzeWaitPublishRows(readback.readback, expected, waitArgs);
      gate = mergeWaitReadback(gate, analysis);
      report.waitPublishAnalysis = analysis;
      report.afterWaitPublishGate = gate;
    }
    report.ok = report.ok && Boolean(readback.ok);
  }
  report.finalGate = gate;
  report.exceptionWrites = writeExceptions(args, gate.rows);
  return report;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.command === 'help') {
    output(usage());
    return;
  }
  const asins = readAsins(args);
  if (!asins.length) throw new Error(`${args.command} requires --asins or --asin-file`);
  if (args.command === 'plan') {
    const gate = buildLocalGate(args, asins);
    output({ ok: true, dryRun: true, finalGate: gate, exceptionWrites: [] });
    return;
  }
  if (args.command === 'check') {
    output(await runCheck(args, asins));
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
  buildLocalGate,
  mergePreflight,
  mergeWaitReadback,
  runCheck,
};
