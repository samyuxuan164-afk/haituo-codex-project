#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_MAP_PATH = path.join(ROOT, 'config', 'aliexpress-dxm-category-map.json');
const SCHEMA_VERSION = 'aliexpress-dxm-category-map-v1';
const VALID_STATUSES = new Set(['active', 'auto_validation_required', 'needs_review', 'blocked', 'deprecated']);

function nowIso() {
  return new Date().toISOString();
}

function compactText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizePostCategoryId(value) {
  const id = compactText(value);
  if (!/^[0-9]{2,}$/.test(id)) {
    throw new Error(`Invalid postCategoryId: ${value}`);
  }
  return id;
}

function emptyMap() {
  return {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: nowIso(),
    mappings: {},
  };
}

function readCategoryMap(filePath = DEFAULT_MAP_PATH) {
  if (!fs.existsSync(filePath)) return emptyMap();
  const raw = fs.readFileSync(filePath, 'utf8');
  const map = raw.trim() ? JSON.parse(raw) : emptyMap();
  if (map.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(`Unsupported category map schemaVersion: ${map.schemaVersion || 'missing'}`);
  }
  if (!map.mappings || typeof map.mappings !== 'object' || Array.isArray(map.mappings)) {
    throw new Error('Invalid category map: mappings must be an object');
  }
  return map;
}

function writeCategoryMap(map, filePath = DEFAULT_MAP_PATH) {
  map.updatedAt = nowIso();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(map, null, 2)}\n`);
}

function validateMapping(input) {
  const mapping = { ...input };
  mapping.postCategoryId = normalizePostCategoryId(mapping.postCategoryId);
  mapping.status = mapping.status || 'auto_validation_required';
  if (!VALID_STATUSES.has(mapping.status)) {
    throw new Error(`Invalid mapping status for ${mapping.postCategoryId}: ${mapping.status}`);
  }
  mapping.productFamily = compactText(mapping.productFamily);
  mapping.dxmCandidateCategory = compactText(mapping.dxmCandidateCategory);
  mapping.dxmCandidateCategoryId = compactText(mapping.dxmCandidateCategoryId);
  mapping.confidence = Number.isFinite(Number(mapping.confidence)) ? Number(mapping.confidence) : 0;
  mapping.safeAdjacentAllowed = Boolean(mapping.safeAdjacentAllowed);
  mapping.source = compactText(mapping.source || 'auto_mapping_candidate');
  mapping.evidence = Array.isArray(mapping.evidence) ? mapping.evidence.map(compactText).filter(Boolean) : [];
  mapping.blockedWrongCategories = Array.isArray(mapping.blockedWrongCategories)
    ? mapping.blockedWrongCategories.map(compactText).filter(Boolean)
    : [];
  mapping.notes = compactText(mapping.notes);
  mapping.updatedAt = mapping.updatedAt || nowIso();
  mapping.createdAt = mapping.createdAt || mapping.updatedAt;
  if (mapping.status === 'active' && !mapping.dxmCandidateCategory) {
    throw new Error(`Active mapping ${mapping.postCategoryId} requires dxmCandidateCategory`);
  }
  return mapping;
}

function getMapping(postCategoryId, filePath = DEFAULT_MAP_PATH) {
  const id = normalizePostCategoryId(postCategoryId);
  const map = readCategoryMap(filePath);
  return map.mappings[id] || null;
}

function getActiveMapping(postCategoryId, filePath = DEFAULT_MAP_PATH) {
  const mapping = getMapping(postCategoryId, filePath);
  if (!mapping || mapping.status !== 'active' || !compactText(mapping.dxmCandidateCategory)) return null;
  return mapping;
}

function listMappings(filePath = DEFAULT_MAP_PATH) {
  const map = readCategoryMap(filePath);
  return Object.values(map.mappings)
    .sort((a, b) => String(a.postCategoryId).localeCompare(String(b.postCategoryId)));
}

function upsertMapping(input, filePath = DEFAULT_MAP_PATH) {
  const map = readCategoryMap(filePath);
  const incoming = validateMapping(input);
  const previous = map.mappings[incoming.postCategoryId] || {};
  const merged = validateMapping({
    ...previous,
    ...incoming,
    postCategoryId: incoming.postCategoryId,
    createdAt: previous.createdAt || incoming.createdAt || nowIso(),
    updatedAt: nowIso(),
  });
  map.mappings[merged.postCategoryId] = merged;
  writeCategoryMap(map, filePath);
  return merged;
}

function buildMappingFromResolver(resolverFile, overrides = {}) {
  const resolver = JSON.parse(fs.readFileSync(resolverFile, 'utf8'));
  const recommended = resolver.recommended || {};
  const postCategoryId = normalizePostCategoryId(overrides.postCategoryId || recommended.postCategoryId);
  const dxmCandidateCategory = compactText(overrides.dxmCandidateCategory || recommended.dxmVisibleCategoryPath || recommended.dxmVisibleCategory);
  const confidence = Number.isFinite(Number(overrides.confidence))
    ? Number(overrides.confidence)
    : Number(recommended.confidence || 0);
  const statusText = String(overrides.status || recommended.status || '');
  const isValidated = /validated|confirmed|high_confidence/i.test(statusText);
  return validateMapping({
    postCategoryId,
    status: overrides.status || (isValidated && dxmCandidateCategory ? 'active' : 'auto_validation_required'),
    productFamily: compactText(overrides.productFamily || recommended.semanticFamily || resolver.query),
    dxmCandidateCategory,
    dxmCandidateCategoryId: compactText(overrides.dxmCandidateCategoryId),
    confidence,
    safeAdjacentAllowed: Boolean(overrides.safeAdjacentAllowed),
    source: 'resolver_import',
    evidence: [path.relative(ROOT, path.resolve(resolverFile))],
    blockedWrongCategories: Array.isArray(resolver.blockedWrongCategories) ? resolver.blockedWrongCategories : [],
    notes: compactText(overrides.notes || 'Imported from readonly AliExpress category resolver output.'),
  });
}

function findResolverFiles(args) {
  const files = [...(args.resolverFiles || [])];
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

function topCategoryCounts(resolver) {
  return Object.entries(resolver.postCategoryIdCounts || {})
    .sort((a, b) => Number(b[1]) - Number(a[1]) || String(a[0]).localeCompare(String(b[0])))
    .map(([postCategoryId, count]) => ({ postCategoryId, count: Number(count) || 0 }));
}

function reviewResolverFile(file, args) {
  try {
    const resolver = JSON.parse(fs.readFileSync(file, 'utf8'));
    const recommended = resolver.recommended || {};
    const topCounts = topCategoryCounts(resolver);
    const dxmCandidateCategory = compactText(recommended.dxmVisibleCategoryPath || recommended.dxmVisibleCategory);
    if (!recommended.postCategoryId) {
      return {
        ok: false,
        file: path.relative(ROOT, file),
        asin: compactText(resolver.asin),
        productFamily: compactText(recommended.semanticFamily || resolver.query),
        status: 'blocked',
        reason: 'resolver_missing_recommended_post_category_id',
        topPostCategoryIds: topCounts.slice(0, 5),
        suggestedNextAction: topCounts.length > 1 ? 'rerun_aliexpress_category_verification_with_more_results' : 'rerun_aliexpress_category_verification',
      };
    }
    const mapping = buildMappingFromResolver(file, args.overrides || {});
    const existing = getMapping(mapping.postCategoryId, args.mapPath);
    return {
      ok: true,
      file: path.relative(ROOT, file),
      asin: compactText(resolver.asin),
      postCategoryId: mapping.postCategoryId,
      productFamily: mapping.productFamily,
      status: mapping.status,
      confidence: mapping.confidence,
      dxmCandidateCategory: mapping.dxmCandidateCategory,
      existingStatus: existing ? existing.status : 'missing',
      existingDxmCandidateCategory: existing ? existing.dxmCandidateCategory || '' : '',
      changed: !existing || existing.status !== mapping.status || existing.dxmCandidateCategory !== mapping.dxmCandidateCategory,
      mapping,
      blocker: dxmCandidateCategory ? '' : 'aliexpress_category_confirmed_but_dxm_mapping_missing',
      suggestedNextAction: mapping.status === 'active'
        ? 'ready_to_import_validated_mapping'
        : 'validate_dxm_auto_mapping_with_readonly_category_search',
    };
  } catch (error) {
    return {
      ok: false,
      file: path.relative(ROOT, file),
      status: 'blocked',
      reason: String(error && error.message ? error.message : error),
      suggestedNextAction: 'rerun_resolver_or_skip_to_next_product',
    };
  }
}

function reviewResolvers(args) {
  const files = findResolverFiles(args);
  if (!files.length) throw new Error('review-resolvers requires --resolver-dir or --resolver-file');
  const rows = files.map((file) => reviewResolverFile(file, args));
  return addImportConfirmation(args, rows, {
    ok: rows.every((row) => row.ok),
    dryRun: true,
    mapPath: args.mapPath,
    rows: rows.map(({ mapping, ...row }) => row),
    summary: summarizeReviewRows(rows),
  });
}

function summarizeReviewRows(rows) {
  return {
    files: rows.length,
    importable: rows.filter((row) => row.ok && row.mapping).length,
    activeCandidates: rows.filter((row) => row.ok && row.mapping && row.mapping.status === 'active').length,
    autoValidationRequiredCandidates: rows.filter((row) => row.ok && row.mapping && row.mapping.status === 'auto_validation_required').length,
    needsReviewCandidates: rows.filter((row) => row.ok && row.mapping && row.mapping.status === 'needs_review').length,
    blocked: rows.filter((row) => !row.ok).length,
    changed: rows.filter((row) => row.changed).length,
    byPostCategoryId: rows.reduce((acc, row) => {
      if (row.postCategoryId) acc[row.postCategoryId] = (acc[row.postCategoryId] || 0) + 1;
      return acc;
    }, {}),
  };
}

function isFormalMapPath(mapPath) {
  return path.resolve(mapPath) === path.resolve(DEFAULT_MAP_PATH);
}

function buildConfirmationPayload(args, rows) {
  return {
    tool: 'aliexpress-dxm-category-map',
    action: 'import-resolvers',
    mapPath: path.relative(ROOT, path.resolve(args.mapPath)) || '.',
    rows: rows.map((row) => ({
      ok: Boolean(row.ok),
      file: row.file || '',
      postCategoryId: row.mapping ? row.mapping.postCategoryId : row.postCategoryId || '',
      status: row.mapping ? row.mapping.status : row.status || '',
      dxmCandidateCategory: row.mapping ? row.mapping.dxmCandidateCategory : row.dxmCandidateCategory || '',
      reason: row.reason || row.blocker || '',
    })),
  };
}

function buildConfirmationToken(args, rows) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(buildConfirmationPayload(args, rows)))
    .digest('hex')
    .slice(0, 16);
}

function addImportConfirmation(args, rows, result) {
  const token = buildConfirmationToken(args, rows);
  return {
    ...result,
    confirmation: {
      requiredForFormalWrite: isFormalMapPath(args.mapPath),
      token,
      accepted: Boolean(args.confirmToken && args.confirmToken === token),
      writeArgs: ['--write', '--confirm-token', token],
    },
  };
}

function importResolvers(args) {
  const files = findResolverFiles(args);
  if (!files.length) throw new Error('import-resolvers requires --resolver-dir or --resolver-file');
  const rows = files.map((file) => reviewResolverFile(file, args));
  const summary = summarizeReviewRows(rows);
  const token = buildConfirmationToken(args, rows);
  if (args.write && isFormalMapPath(args.mapPath) && args.confirmToken !== token) {
    return addImportConfirmation(args, rows, {
      ok: false,
      dryRun: false,
      mapPath: args.mapPath,
      rows: rows.map(({ mapping, ...row }) => row),
      summary: { ...summary, written: 0 },
      error: 'formal_map_write_requires_matching_confirm_token',
    });
  }
  let written = 0;
  if (args.write) {
    rows.forEach((row) => {
      if (!row.ok || !row.mapping) return;
      row.mapping = upsertMapping(row.mapping, args.mapPath);
      row.written = true;
      written += 1;
    });
  }
  return addImportConfirmation(args, rows, {
    ok: rows.every((row) => row.ok),
    dryRun: !args.write,
    mapPath: args.mapPath,
    rows: rows.map(({ mapping, ...row }) => ({
      ...row,
      mapping: mapping ? {
        postCategoryId: mapping.postCategoryId,
        status: mapping.status,
        productFamily: mapping.productFamily,
        dxmCandidateCategory: mapping.dxmCandidateCategory,
        confidence: mapping.confidence,
      } : null,
    })),
    summary: { ...summary, written },
  });
}

function coverageReport(args) {
  const files = findResolverFiles(args);
  if (!files.length) throw new Error('coverage requires --resolver-dir or --resolver-file');
  const review = files.map((file) => reviewResolverFile(file, args));
  const rows = review.map((row) => {
    const postCategoryId = row.postCategoryId || (row.topPostCategoryIds && row.topPostCategoryIds[0] && row.topPostCategoryIds[0].postCategoryId) || '';
    const resolved = postCategoryId ? resolveMapping(postCategoryId, args.mapPath) : null;
    return {
      file: row.file,
      asin: row.asin || '',
      postCategoryId,
      resolverStatus: row.status || '',
      mapStatus: resolved ? resolved.status : 'missing',
      usableForAutomation: Boolean(resolved && resolved.ok),
      dxmCandidateCategory: resolved && resolved.ok ? resolved.dxmCandidateCategory : row.dxmCandidateCategory || '',
      blocker: resolved && resolved.ok ? '' : row.reason || (resolved && resolved.reason) || row.blocker || 'mapping_missing_or_not_active',
      nextAction: resolved && resolved.ok ? 'mapping_ready' : row.suggestedNextAction || 'validate_and_add_mapping',
    };
  });
  return {
    ok: true,
    mapPath: args.mapPath,
    rows,
    summary: {
      total: rows.length,
      usable: rows.filter((row) => row.usableForAutomation).length,
      blocked: rows.filter((row) => !row.usableForAutomation).length,
      missing: rows.filter((row) => row.mapStatus === 'missing').length,
      autoValidationRequired: rows.filter((row) => row.mapStatus === 'auto_validation_required').length,
      needsReview: rows.filter((row) => row.mapStatus === 'needs_review').length,
      active: rows.filter((row) => row.mapStatus === 'active').length,
    },
  };
}

function resolveMapping(postCategoryId, filePath = DEFAULT_MAP_PATH) {
  const mapping = getMapping(postCategoryId, filePath);
  if (!mapping) {
    return {
      ok: false,
      status: 'missing',
      postCategoryId: normalizePostCategoryId(postCategoryId),
      reason: 'No AliExpress-to-DXM category mapping exists yet.',
    };
  }
  if (mapping.status !== 'active') {
    return {
      ok: false,
      status: mapping.status,
      postCategoryId: mapping.postCategoryId,
      mapping,
      reason: 'Mapping exists but is not active, so automation must validate DXM category search before using it for save.',
    };
  }
  return {
    ok: true,
    status: 'active',
    postCategoryId: mapping.postCategoryId,
    dxmCandidateCategory: mapping.dxmCandidateCategory,
    dxmCandidateCategoryId: mapping.dxmCandidateCategoryId || '',
    productFamily: mapping.productFamily || '',
    confidence: mapping.confidence,
    mapping,
  };
}

function parseArgs(argv) {
  const args = {
    command: argv[2] || 'help',
    mapPath: process.env.ALIEXPRESS_DXM_CATEGORY_MAP || DEFAULT_MAP_PATH,
    postCategoryId: '',
    resolverFile: '',
    resolverDir: '',
    resolverFiles: [],
    confirmToken: '',
    json: '',
    write: false,
    overrides: {},
  };
  for (let i = 3; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === '--map' && next) {
      args.mapPath = path.resolve(next);
      i += 1;
    } else if (arg === '--post-category-id' && next) {
      args.postCategoryId = next;
      i += 1;
    } else if (arg === '--resolver-file' && next) {
      args.resolverFile = next;
      args.resolverFiles.push(path.resolve(next));
      i += 1;
    } else if (arg === '--resolver-dir' && next) {
      args.resolverDir = path.resolve(next);
      i += 1;
    } else if (arg === '--confirm-token' && next) {
      args.confirmToken = next;
      i += 1;
    } else if (arg === '--status' && next) {
      args.overrides.status = next;
      i += 1;
    } else if (arg === '--dxm-category' && next) {
      args.overrides.dxmCandidateCategory = next;
      i += 1;
    } else if (arg === '--dxm-category-id' && next) {
      args.overrides.dxmCandidateCategoryId = next;
      i += 1;
    } else if (arg === '--product-family' && next) {
      args.overrides.productFamily = next;
      i += 1;
    } else if (arg === '--write') {
      args.write = true;
    } else if (arg === '--json' && next) {
      args.json = next;
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
    tool: 'aliexpress-dxm-category-map',
    commands: {
      list: 'List all AliExpress postCategoryId to DXM category mappings.',
      get: 'Get one raw mapping. Requires --post-category-id.',
      resolve: 'Resolve one active mapping for automation use. Requires --post-category-id.',
      upsert: 'Upsert a mapping from --json.',
      'from-resolver': 'Import one mapping from a readonly resolver JSON. Requires --resolver-file. Writes immediately for backward compatibility.',
      'review-resolvers': 'Review resolver files and produce mapping candidates without writing.',
      'import-resolvers': 'Import resolver mapping candidates. Default dry-run; formal map writes require --write plus --confirm-token from review.',
      coverage: 'Report resolver postCategoryId coverage against current active/auto-validation mappings.',
    },
    statuses: Array.from(VALID_STATUSES),
    defaultMap: DEFAULT_MAP_PATH,
  };
}

function main() {
  const args = parseArgs(process.argv);
  if (args.command === 'list') {
    const mappings = listMappings(args.mapPath);
    output({ ok: true, mappings, summary: { mappings: mappings.length } });
    return;
  }
  if (args.command === 'get') {
    output({ ok: true, mapping: getMapping(args.postCategoryId, args.mapPath) });
    return;
  }
  if (args.command === 'resolve') {
    output(resolveMapping(args.postCategoryId, args.mapPath));
    return;
  }
  if (args.command === 'upsert') {
    if (!args.json) throw new Error('upsert requires --json');
    output({ ok: true, mapping: upsertMapping(JSON.parse(args.json), args.mapPath) });
    return;
  }
  if (args.command === 'from-resolver') {
    if (!args.resolverFile) throw new Error('from-resolver requires --resolver-file');
    const mapping = buildMappingFromResolver(args.resolverFile);
    output({ ok: true, mapping: upsertMapping(mapping, args.mapPath) });
    return;
  }
  if (args.command === 'review-resolvers') {
    output(reviewResolvers(args));
    return;
  }
  if (args.command === 'import-resolvers') {
    output(importResolvers(args));
    return;
  }
  if (args.command === 'coverage') {
    output(coverageReport(args));
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
  DEFAULT_MAP_PATH,
  SCHEMA_VERSION,
  buildMappingFromResolver,
  coverageReport,
  getActiveMapping,
  getMapping,
  importResolvers,
  listMappings,
  readCategoryMap,
  resolveMapping,
  reviewResolvers,
  upsertMapping,
  validateMapping,
  writeCategoryMap,
};
