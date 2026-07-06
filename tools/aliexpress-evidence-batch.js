#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  DEFAULT_STORE_PATH,
  getEvidence,
  readStore,
  upsertEvidence,
  validateRecord,
} = require('./aliexpress-evidence-store');
const {
  DEFAULT_MAP_PATH,
} = require('./aliexpress-dxm-category-map');
const {
  buildEvidenceRecordFromResolver,
} = require('./aliexpress-evidence-capture');

const ROOT = path.resolve(__dirname, '..');
const VERIFIED_STATUSES = new Set(['aliexpress_verified', 'conditional_verified', 'detail_verified', 'learned_rule_matched']);

function compactText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeAsin(value) {
  const asin = compactText(value).toUpperCase();
  if (!/^B0[A-Z0-9]{8}$/.test(asin)) {
    throw new Error(`Invalid ASIN: ${value}`);
  }
  return asin;
}

function parseArgs(argv) {
  const args = {
    command: argv[2] || 'help',
    storePath: process.env.ALIEXPRESS_EVIDENCE_STORE || DEFAULT_STORE_PATH,
    mapPath: process.env.ALIEXPRESS_DXM_CATEGORY_MAP || DEFAULT_MAP_PATH,
    asinList: '',
    asinFile: '',
    resolverDir: '',
    resolverFiles: [],
    confirmToken: '',
    write: false,
  };
  for (let i = 3; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === '--store' && next) {
      args.storePath = path.resolve(next);
      i += 1;
    } else if (arg === '--map' && next) {
      args.mapPath = path.resolve(next);
      i += 1;
    } else if (arg === '--asins' && next) {
      args.asinList = next;
      i += 1;
    } else if (arg === '--asin-file' && next) {
      args.asinFile = path.resolve(next);
      i += 1;
    } else if (arg === '--resolver-dir' && next) {
      args.resolverDir = path.resolve(next);
      i += 1;
    } else if (arg === '--resolver-file' && next) {
      args.resolverFiles.push(path.resolve(next));
      i += 1;
    } else if (arg === '--confirm-token' && next) {
      args.confirmToken = next;
      i += 1;
    } else if (arg === '--write') {
      args.write = true;
    }
  }
  return args;
}

function output(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function usage() {
  return {
    tool: 'aliexpress-evidence-batch',
    commands: {
      status: 'Read evidence status for a batch. Use --asins or --asin-file.',
      'import-resolvers': 'Build evidence records from resolver JSON files. Use --resolver-dir or --resolver-file. Formal-store writes require --write plus --confirm-token from dry-run.',
      closure: 'Import resolver evidence if provided, then read back ASIN-level evidence readiness in one report. Default dry-run.',
      summary: 'Summarize the current evidence store.',
    },
    safety: [
      'Default mode is dry-run; formal evidence store is not changed unless --write and the matching --confirm-token are passed.',
      'Temporary/custom stores can still be written without a confirmation token for test verification.',
      'The tool imports evidence only; it never opens pages, clicks Dianxiaomi, saves, moves to wait-to-publish, publishes, carts, orders, or chats.',
    ],
    defaultStore: DEFAULT_STORE_PATH,
    defaultCategoryMap: DEFAULT_MAP_PATH,
  };
}

function readAsins(args) {
  const values = [];
  if (args.asinList) {
    values.push(...args.asinList.split(/[,\s]+/));
  }
  if (args.asinFile) {
    const text = fs.readFileSync(args.asinFile, 'utf8');
    values.push(...text.split(/[,\s]+/));
  }
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

function findResolverFiles(args) {
  const files = [...args.resolverFiles];
  if (args.resolverDir) {
    const entries = fs.readdirSync(args.resolverDir, { withFileTypes: true });
    entries.forEach((entry) => {
      if (entry.isFile() && entry.name.endsWith('.resolver.json')) {
        files.push(path.join(args.resolverDir, entry.name));
      }
    });
  }
  const seen = new Set();
  return files
    .map((file) => path.resolve(file))
    .filter((file) => {
      if (seen.has(file)) return false;
      seen.add(file);
      return true;
    })
    .sort();
}

function summarizeRecord(record) {
  if (!record) return null;
  return {
    asin: record.asin,
    status: record.status,
    verified: VERIFIED_STATUSES.has(record.status) && Boolean(compactText(record.dxmCandidateCategory)),
    aliexpressCategoryId: record.aliexpressCategoryId || '',
    dxmCandidateCategory: record.dxmCandidateCategory || '',
    evidenceConfidence: record.evidenceConfidence,
    confidenceTier: record.confidenceTier || '',
    verificationMode: record.verificationMode || '',
    reason: record.reason || '',
    updatedAt: record.updatedAt || '',
  };
}

function isFormalStorePath(storePath) {
  return path.resolve(storePath) === path.resolve(DEFAULT_STORE_PATH);
}

function buildConfirmationPayload(args, rows) {
  return {
    tool: 'aliexpress-evidence-batch',
    action: 'import-resolvers',
    storePath: path.relative(ROOT, path.resolve(args.storePath)) || '.',
    mapPath: path.relative(ROOT, path.resolve(args.mapPath)) || '.',
    rows: rows.map((row) => ({
      ok: Boolean(row.ok),
      file: row.file || '',
      asin: row.record ? row.record.asin : '',
      status: row.record ? row.record.status : '',
      verified: row.record ? Boolean(row.record.verified) : false,
      aliexpressCategoryId: row.record ? row.record.aliexpressCategoryId || '' : '',
      dxmCandidateCategory: row.record ? row.record.dxmCandidateCategory || '' : '',
      reason: row.record ? row.record.reason || '' : row.error || '',
    })),
  };
}

function buildConfirmationToken(args, rows) {
  const payload = buildConfirmationPayload(args, rows);
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex')
    .slice(0, 16);
}

function addImportConfirmation(args, rows, result) {
  const token = buildConfirmationToken(args, rows);
  return {
    ...result,
    confirmation: {
      requiredForFormalWrite: isFormalStorePath(args.storePath),
      token,
      accepted: Boolean(args.confirmToken && args.confirmToken === token),
      writeArgs: ['--write', '--confirm-token', token],
    },
  };
}

function buildBatchStatus(args) {
  const asins = readAsins(args);
  if (!asins.length) throw new Error('status requires --asins or --asin-file');
  const rows = asins.map((asin) => summarizeRecord(getEvidence(asin, args.storePath)) || {
    asin,
    status: 'missing',
    verified: false,
    aliexpressCategoryId: '',
    dxmCandidateCategory: '',
    reason: 'No evidence record in store.',
    updatedAt: '',
  });
  return {
    ok: true,
    storePath: args.storePath,
    rows,
    summary: {
      total: rows.length,
      verified: rows.filter((row) => row.verified).length,
      highConfidence: rows.filter((row) => row.status === 'aliexpress_verified').length,
      conditionalVerified: rows.filter((row) => row.status === 'conditional_verified').length,
      detailVerified: rows.filter((row) => row.status === 'detail_verified').length,
      dxmCategoryValidationRequired: rows.filter((row) => row.status === 'dxm_category_validation_required').length,
      semanticConsensusNeedsMapping: rows.filter((row) => row.status === 'semantic_consensus_needs_dxm_mapping').length,
      verificationRequired: rows.filter((row) => row.status === 'aliexpress_verification_required').length,
      missing: rows.filter((row) => row.status === 'missing').length,
      blockers: rows.filter((row) => !row.verified).length,
    },
  };
}

function nextActionForEvidence(row) {
  if (!row) return 'run_aliexpress_category_verification';
  if (row.status === 'conditional_verified') return 'ready_for_edit_preflight_after_price_gate_low_confidence';
  if (row.status === 'detail_verified') return 'ready_for_edit_preflight_after_price_gate_detail_low_confidence';
  if (row.verified) return 'ready_for_edit_preflight_after_price_gate';
  if (row.status === 'missing') return 'run_aliexpress_category_verification';
  if (row.status === 'aliexpress_verification_required') return 'resolve_aliexpress_verification_then_resume_detail_capture';
  if (row.status === 'dxm_category_validation_required') return 'run_dxm_readonly_category_validation';
  if (row.status === 'evidence_split') return 'manual_review_or_add_category_mapping';
  if (row.status === 'semantic_consensus_needs_dxm_mapping') return 'validate_and_add_aliexpress_dxm_category_mapping';
  if (!compactText(row.dxmCandidateCategory)) return 'validate_and_add_aliexpress_dxm_category_mapping';
  if (row.status === 'needs_manual_review') return 'manual_review_or_import_confirmed_evidence';
  return 'manual_evidence_review';
}

function blockersForEvidence(row) {
  if (!row || row.status === 'missing') return ['category_evidence_missing'];
  if (row.verified) return [];
  if (row.status === 'aliexpress_verification_required') return ['aliexpress_verification_required'];
  if (row.status === 'dxm_category_validation_required') return ['dxm_category_validation_required'];
  if (row.status === 'evidence_split') return ['aliexpress_category_evidence_split'];
  if (row.status === 'semantic_consensus_needs_dxm_mapping') return ['aliexpress_dxm_category_map_missing'];
  if (!compactText(row.dxmCandidateCategory)) return ['aliexpress_dxm_category_map_missing'];
  if (row.status === 'needs_manual_review') return ['aliexpress_evidence_needs_manual_review'];
  return [row.reason || row.status || 'category_evidence_missing'];
}

function normalizeTargetAsins(args, importResult) {
  const explicit = readAsins(args);
  if (explicit.length) return explicit;
  const imported = importResult && Array.isArray(importResult.rows)
    ? importResult.rows
      .map((row) => row.record && row.record.asin)
      .filter(Boolean)
    : [];
  const seen = new Set();
  return imported
    .map(normalizeAsin)
    .filter((asin) => {
      if (seen.has(asin)) return false;
      seen.add(asin);
      return true;
    });
}

function summarizeClosureRows(asins, storeStatus, importResult) {
  const storeByAsin = Object.fromEntries((storeStatus.rows || []).map((row) => [row.asin, row]));
  const importByAsin = {};
  (importResult && Array.isArray(importResult.rows) ? importResult.rows : []).forEach((row) => {
    if (row.record && row.record.asin) importByAsin[row.record.asin] = row.record;
  });
  return asins.map((asin) => {
    const storeRecord = storeByAsin[asin] || null;
    const importedRecord = importByAsin[asin] || null;
    const effective = storeRecord && storeRecord.status !== 'missing' ? storeRecord : importedRecord || storeRecord;
    const blockers = blockersForEvidence(effective);
    return {
      asin,
      verified: Boolean(effective && effective.verified),
      storeRecord,
      importedRecord,
      effectiveRecord: effective || null,
      blockers,
      nextAction: nextActionForEvidence(effective),
    };
  });
}

function summarizeClosure(rows) {
  return {
    total: rows.length,
    verified: rows.filter((row) => row.verified).length,
    blockers: rows.filter((row) => row.blockers.length).length,
    missing: rows.filter((row) => row.blockers.includes('category_evidence_missing')).length,
    split: rows.filter((row) => row.blockers.includes('aliexpress_category_evidence_split')).length,
    mapMissing: rows.filter((row) => row.blockers.includes('aliexpress_dxm_category_map_missing')).length,
    dxmCategoryValidationRequired: rows.filter((row) => row.blockers.includes('dxm_category_validation_required')).length,
    verificationRequired: rows.filter((row) => row.blockers.includes('aliexpress_verification_required')).length,
    needsManualReview: rows.filter((row) => row.blockers.includes('aliexpress_evidence_needs_manual_review')).length,
    byBlocker: rows.reduce((acc, row) => {
      row.blockers.forEach((reason) => {
        acc[reason] = (acc[reason] || 0) + 1;
      });
      return acc;
    }, {}),
  };
}

function buildClosure(args) {
  const files = findResolverFiles(args);
  const importResult = files.length ? importResolvers(args) : null;
  const asins = normalizeTargetAsins(args, importResult);
  if (!asins.length) throw new Error('closure requires --asins/--asin-file or resolver files with ASINs');
  const storeStatus = buildBatchStatus({ ...args, asinList: asins.join(','), asinFile: '' });
  const rows = summarizeClosureRows(asins, storeStatus, importResult);
  return {
    ok: rows.every((row) => row.blockers.length === 0) && (!importResult || importResult.ok),
    dryRun: !args.write,
    storePath: args.storePath,
    mapPath: args.mapPath,
    importResult,
    storeStatus,
    rows,
    summary: summarizeClosure(rows),
    nextActions: {
      readyAsins: rows.filter((row) => row.verified).map((row) => row.asin),
      missingAsins: rows.filter((row) => row.blockers.includes('category_evidence_missing')).map((row) => row.asin),
      splitAsins: rows.filter((row) => row.blockers.includes('aliexpress_category_evidence_split')).map((row) => row.asin),
      mapMissingAsins: rows.filter((row) => row.blockers.includes('aliexpress_dxm_category_map_missing')).map((row) => row.asin),
      dxmCategoryValidationRequiredAsins: rows.filter((row) => row.blockers.includes('dxm_category_validation_required')).map((row) => row.asin),
      verificationRequiredAsins: rows.filter((row) => row.blockers.includes('aliexpress_verification_required')).map((row) => row.asin),
      manualReviewAsins: rows.filter((row) => row.blockers.includes('aliexpress_evidence_needs_manual_review')).map((row) => row.asin),
    },
    safety: usage().safety,
  };
}

function importResolvers(args) {
  const files = findResolverFiles(args);
  if (!files.length) throw new Error('import-resolvers requires --resolver-dir or --resolver-file');
  const rows = files.map((file) => {
    try {
      const record = validateRecord(buildEvidenceRecordFromResolver({
        resolverFile: file,
        mapPath: args.mapPath,
      }));
      return {
        ok: true,
        file: path.relative(ROOT, file),
        written: false,
        record: summarizeRecord(record),
        rawRecord: record,
      };
    } catch (error) {
      return {
        ok: false,
        file: path.relative(ROOT, file),
        written: false,
        error: String(error && error.message ? error.message : error),
      };
    }
  });
  const summary = {
    files: rows.length,
    importable: rows.filter((row) => row.ok).length,
    verified: rows.filter((row) => row.ok && row.record && row.record.verified).length,
    blockers: rows.filter((row) => !row.ok || !row.record || !row.record.verified).length,
    written: 0,
  };
  const token = buildConfirmationToken(args, rows);
  if (args.write && isFormalStorePath(args.storePath) && args.confirmToken !== token) {
    return addImportConfirmation(args, rows, {
      ok: false,
      dryRun: false,
      storePath: args.storePath,
      mapPath: args.mapPath,
      rows: rows.map(({ rawRecord, ...row }) => row),
      summary,
      error: 'formal_store_write_requires_matching_confirm_token',
    });
  }
  if (args.write) {
    rows.forEach((row) => {
      if (!row.ok || !row.rawRecord) return;
      row.record = summarizeRecord(upsertEvidence(row.rawRecord, args.storePath));
      row.written = true;
    });
    summary.written = rows.filter((row) => row.written).length;
  }
  return addImportConfirmation(args, rows, {
    ok: rows.every((row) => row.ok),
    dryRun: !args.write,
    storePath: args.storePath,
    mapPath: args.mapPath,
    rows: rows.map(({ rawRecord, ...row }) => row),
    summary,
  });
}

function summarizeStore(args) {
  const store = readStore(args.storePath);
  const rows = Object.values(store.records || {}).map(summarizeRecord);
  return {
    ok: true,
    storePath: args.storePath,
    rows,
    summary: {
      records: rows.length,
      verified: rows.filter((row) => row.verified).length,
      blockers: rows.filter((row) => !row.verified).length,
    },
  };
}

function main() {
  const args = parseArgs(process.argv);
  if (args.command === 'status') {
    output(buildBatchStatus(args));
    return;
  }
  if (args.command === 'import-resolvers') {
    output(importResolvers(args));
    return;
  }
  if (args.command === 'closure') {
    output(buildClosure(args));
    return;
  }
  if (args.command === 'summary') {
    output(summarizeStore(args));
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
  buildBatchStatus,
  buildClosure,
  importResolvers,
  summarizeStore,
};
