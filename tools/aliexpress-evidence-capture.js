#!/usr/bin/env node
'use strict';

const fs = require('fs');
const http = require('http');
const https = require('https');
const { execFileSync } = require('child_process');
const {
  DEFAULT_STORE_PATH,
  upsertEvidence,
} = require('./aliexpress-evidence-store');
const {
  DEFAULT_MAP_PATH,
  getActiveMapping,
} = require('./aliexpress-dxm-category-map');
const evidencePolicy = require('./aliexpress-evidence-policy');

const DEFAULT_ENDPOINT = 'http://127.0.0.1:10086/command';
const DEFAULT_SESSION = 'dxm-aliexpress-evidence-capture';
const ALIEXPRESS_SEARCH_URL = 'https://www.aliexpress.com/wholesale';
const VERIFIED_STATUSES = new Set(['aliexpress_verified', 'conditional_verified', 'detail_verified', 'learned_rule_matched']);

const SEMANTIC_FAMILY_RULES = [
  {
    id: 'faucet-mat-splash-guard',
    query: /faucet.*mat|faucet.*splash|splash.*guard|sink.*faucet|水龙头.*(垫|防溅)|水槽.*防溅/i,
    title: /(水龙头|水槽|faucet|sink).{0,24}(防溅|接水|排水|沥水|滴水|垫|mat)|(防溅|接水|排水|沥水|滴水).{0,24}(水龙头|水槽|faucet|sink)/i,
    platformTerms: [
      '水龙头防溅垫',
      '水槽防溅垫',
      '水龙头接水垫',
      '水槽接水垫',
      'faucet mat',
      'sink splash guard',
      'faucet splash guard',
    ],
    dxmSearchTerms: [
      '水龙头防溅垫',
      '水槽防溅垫',
      '水龙头接水垫',
      '水槽接水垫',
      '厨房水槽配件',
      '水槽配件',
      '水龙头配件',
      'Kitchen Sink Accessories',
      'Faucet Accessories',
      'Faucet Mat',
      'Sink Splash Guard',
    ],
  },
  {
    id: 'bag-holder-dispenser',
    query: /(trash|garbage|grocery|plastic)\s+bag.*(holder|dispenser|organizer)|袋.*(收纳|分配|架)/i,
    title: /(垃圾袋|购物袋|塑料袋|杂货袋|bag).{0,24}(收纳|架|分配器|整理|holder|dispenser)|(收纳|分配器|整理|holder|dispenser).{0,24}(垃圾袋|购物袋|塑料袋|杂货袋|bag)/i,
    platformTerms: ['bag holder', 'bag dispenser', '垃圾袋收纳', '购物袋收纳', '袋分配器'],
    dxmSearchTerms: [
      '袋收纳',
      '袋分配器',
      '袋架',
      '收纳架',
      'Racks & Holders',
      'Bag Holder',
      'Bag Dispenser',
      'Bag Organizer',
    ],
  },
  {
    id: 'fabric-storage-cubes-bins',
    query: /storage\s+cubes|fabric\s+storage\s+bins|布艺.*收纳|无纺布.*收纳/i,
    title: /(收纳箱|收纳盒|收纳篮|衣物收纳|玩具收纳|无纺布|布艺|fabric|storage bin|storage cube)/i,
    platformTerms: ['fabric storage bins', 'storage cubes', '布艺收纳箱', '折叠收纳盒', '收纳盒'],
    dxmSearchTerms: [
      'Storage Boxes & Bins',
      '收纳盒和收纳箱',
      'Home Storage & Organization',
      'Storage Boxes',
      'Storage Bins',
      '收纳盒',
      '收纳箱',
      '布艺收纳箱',
    ],
  },
  {
    id: 'chair-leg-floor-protectors',
    query: /chair\s+leg|floor\s+protector|furniture\s+pads?|椅腿|地板保护/i,
    title: /(椅腿|桌椅|家具|chair|furniture).{0,24}(保护|脚套|垫|套|防滑|防刮|降噪|protector|pad)|(地板保护|floor protector)/i,
    platformTerms: ['chair leg protectors', 'floor protectors', 'furniture pads', '椅腿保护套', '地板保护垫'],
    dxmSearchTerms: [
      '家具脚垫',
      '椅腿保护套',
      '地板保护垫',
      '家具配件',
      'Furniture Accessories',
      'Furniture Pads',
      'Chair Leg Protectors',
      'Floor Protectors',
    ],
  },
  {
    id: 'furniture-moving-sliders',
    query: /furniture\s+sliders?|moving\s+sliders?|家具.*滑垫/i,
    title: /(家具|furniture).{0,24}(滑垫|滑行|移动垫|mover|slider)|(滑垫|滑行|移动垫|slider).{0,24}(家具|furniture)/i,
    platformTerms: ['furniture sliders', 'moving sliders', '家具滑垫', '家具移动垫'],
    dxmSearchTerms: [
      '家具滑垫',
      '家具移动垫',
      '家具配件',
      'Furniture Accessories',
      'Furniture Sliders',
      'Moving Sliders',
      'Furniture Pads',
    ],
  },
];

function nowIso() {
  return new Date().toISOString();
}

function normalizeAsin(value) {
  const asin = String(value || '').trim().toUpperCase();
  if (!/^B0[A-Z0-9]{8}$/.test(asin)) throw new Error(`Invalid ASIN: ${value}`);
  return asin;
}

function parseArgs(argv) {
  const args = {
    command: argv[2] || 'help',
    endpoint: process.env.WEBBRIDGE_ENDPOINT || DEFAULT_ENDPOINT,
    session: process.env.WEBBRIDGE_SESSION || DEFAULT_SESSION,
    storePath: process.env.ALIEXPRESS_EVIDENCE_STORE || DEFAULT_STORE_PATH,
    mapPath: process.env.ALIEXPRESS_DXM_CATEGORY_MAP || DEFAULT_MAP_PATH,
    thresholdsPath: process.env.ALIEXPRESS_EVIDENCE_THRESHOLDS || evidencePolicy.DEFAULT_THRESHOLDS_PATH,
    timeoutMs: Number(process.env.WEBBRIDGE_TIMEOUT_MS || 12000),
    asin: '',
    query: '',
    amazonTitle: '',
    amazonImage: '',
    amazonUrl: '',
    productFamily: '',
    dxmCategory: '',
    dxmCategoryId: '',
    safeAdjacent: false,
    resolverFile: '',
    detailPages: Number(process.env.ALIEXPRESS_DETAIL_PAGES || 0),
    detailPageWaitMs: Number(process.env.ALIEXPRESS_DETAIL_PAGE_WAIT_MS || 8000),
    resolveVerificationSlider: process.env.ALIEXPRESS_RESOLVE_VERIFICATION_SLIDER === '1',
    verificationSliderMaxAttempts: Number(process.env.ALIEXPRESS_VERIFICATION_SLIDER_MAX_ATTEMPTS || 1),
    verificationSliderWaitMs: Number(process.env.ALIEXPRESS_VERIFICATION_SLIDER_WAIT_MS || 3000),
    verificationPageReopenAttempts: Number(process.env.ALIEXPRESS_VERIFICATION_PAGE_REOPEN_ATTEMPTS || 1),
    compactOutput: false,
    write: false,
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
    } else if (arg === '--store' && next) {
      args.storePath = next;
      i += 1;
    } else if (arg === '--map' && next) {
      args.mapPath = next;
      i += 1;
    } else if (arg === '--thresholds' && next) {
      args.thresholdsPath = next;
      i += 1;
    } else if (arg === '--timeout-ms' && next) {
      args.timeoutMs = Number(next);
      i += 1;
    } else if (arg === '--asin' && next) {
      args.asin = next;
      i += 1;
    } else if (arg === '--query' && next) {
      args.query = next;
      i += 1;
    } else if (arg === '--amazon-title' && next) {
      args.amazonTitle = next;
      i += 1;
    } else if (arg === '--amazon-image' && next) {
      args.amazonImage = next;
      i += 1;
    } else if (arg === '--amazon-url' && next) {
      args.amazonUrl = next;
      i += 1;
    } else if (arg === '--product-family' && next) {
      args.productFamily = next;
      i += 1;
    } else if (arg === '--dxm-category' && next) {
      args.dxmCategory = next;
      i += 1;
    } else if (arg === '--dxm-category-id' && next) {
      args.dxmCategoryId = next;
      i += 1;
    } else if (arg === '--resolver-file' && next) {
      args.resolverFile = next;
      i += 1;
    } else if (arg === '--detail-pages' && next) {
      args.detailPages = Math.max(0, Number(next) || 0);
      i += 1;
    } else if (arg === '--detail-page-wait-ms' && next) {
      args.detailPageWaitMs = Math.max(0, Number(next) || 0);
      i += 1;
    } else if (arg === '--resolve-verification-slider') {
      args.resolveVerificationSlider = true;
    } else if (arg === '--verification-slider-max-attempts' && next) {
      args.verificationSliderMaxAttempts = Math.max(1, Math.min(Number(next) || 1, 3));
      i += 1;
    } else if (arg === '--verification-slider-wait-ms' && next) {
      args.verificationSliderWaitMs = Math.max(0, Number(next) || 0);
      i += 1;
    } else if (arg === '--verification-page-reopen-attempts' && next) {
      args.verificationPageReopenAttempts = Math.max(0, Math.min(Number(next) || 0, 2));
      i += 1;
    } else if (arg === '--compact-output') {
      args.compactOutput = true;
    } else if (arg === '--safe-adjacent') {
      args.safeAdjacent = true;
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
    tool: 'aliexpress-evidence-capture',
    commands: {
      open: 'Open a readonly AliExpress search page. Requires --query.',
      capture: 'Capture readonly evidence from the current AliExpress search page. Requires --asin; --write persists.',
      'from-resolver': 'Convert an existing resolver JSON report into the evidence store. Requires --resolver-file.',
      manual: 'Write a manually verified evidence record. Requires --asin, --dxm-category, and --product-family or --query.',
    },
    importantRules: [
      'This tool does not click products, add to cart, order, chat, or submit forms.',
      'A record becomes aliexpress_verified only when a DXM candidate category is provided and evidence confidence is high enough.',
      'Low confidence or split category evidence is persisted as evidence_split or needs_manual_review, not as verified.',
      'When --detail-pages is supplied, low-confidence search evidence may be strengthened by reading readonly AliExpress detail-page specification type fields.',
      'By default, verification pages are recorded as aliexpress_verification_required; --resolve-verification-slider tries a WebBridge slider drag and reopens the detail page once before recording that blocker.',
      '--compact-output prints only the decision summary, avoiding large page snapshots.',
    ],
    defaultStore: DEFAULT_STORE_PATH,
    defaultCategoryMap: DEFAULT_MAP_PATH,
    defaultThresholds: evidencePolicy.DEFAULT_THRESHOLDS_PATH,
  };
}

function compactText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function uniqueCompactTerms(values) {
  return [...new Set((values || []).map(compactText).filter(Boolean))];
}

function normalizeUrl(value) {
  const text = compactText(value);
  if (!text) return '';
  try {
    return new URL(text, 'https://www.aliexpress.com').href;
  } catch (_) {
    return '';
  }
}

function normalizeConsensusText(value) {
  return compactText(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

function topEntries(counts, limit = 8) {
  return Object.entries(counts || {})
    .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
    .slice(0, limit)
    .map(([id, count]) => ({ id, count }));
}

function countCategoryIds(ids) {
  const counts = {};
  ids.forEach((id) => {
    const key = String(id || '').trim();
    if (!key) return;
    counts[key] = (counts[key] || 0) + 1;
  });
  return counts;
}

function tokenizeEvidenceText(value) {
  const stop = new Set([
    'with', 'for', 'and', 'the', 'from', 'pack', 'sets', 'set', 'pcs', 'piece',
    'home', 'kitchen', 'bathroom', 'storage', 'organizer', 'organizers',
    'black', 'white', 'clear', 'small', 'large', 'plastic', 'metal',
  ]);
  return compactText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map((item) => item.replace(/^-+|-+$/g, ''))
    .filter((item) => item.length >= 4 && !stop.has(item))
    .slice(0, 16);
}

function inferSemanticFamilyRule(args) {
  const basis = compactText([args.productFamily, args.query, args.amazonTitle].filter(Boolean).join(' '));
  return SEMANTIC_FAMILY_RULES.find((rule) => rule.query.test(basis)) || null;
}

function evaluateSemanticConsensus(snapshot, args) {
  const thresholds = evidencePolicy.readThresholds(args.thresholdsPath);
  const rule = inferSemanticFamilyRule(args);
  const titles = (snapshot.titles || []).map(compactText).filter(Boolean).slice(0, 8);
  if (!rule || !titles.length) {
    return {
      ok: false,
      family: rule ? rule.id : '',
      matchedTitleCount: 0,
      checkedTitleCount: titles.length,
      ratio: 0,
      matchedTitles: [],
    };
  }
  const matchedTitles = titles.filter((title) => rule.title.test(title));
  const ratio = titles.length ? matchedTitles.length / titles.length : 0;
  return {
    ok: ratio >= thresholds.semanticConsensusTitleRatio,
    family: rule.id,
    matchedTitleCount: matchedTitles.length,
    checkedTitleCount: titles.length,
    ratio: Number(ratio.toFixed(4)),
    matchedTitles: matchedTitles.slice(0, 4),
  };
}

function evaluateConditionalEvidence(snapshot, args) {
  const titles = (snapshot.titles || []).map(compactText).filter(Boolean).slice(0, 8);
  const basis = compactText([args.productFamily, args.query, args.amazonTitle].filter(Boolean).join(' '));
  const tokens = tokenizeEvidenceText(basis);
  const matchedTitles = tokens.length
    ? titles.filter((title) => {
      const normalized = title.toLowerCase();
      return tokens.some((token) => normalized.includes(token));
    })
    : [];
  const semanticConsensus = evaluateSemanticConsensus(snapshot, args);
  const tokenConsistency = Boolean(titles.length && tokens.length && matchedTitles.length / titles.length >= 0.4);
  const titleConsistency = tokenConsistency || semanticConsensus.ok;
  return {
    hasDxmCandidateCategory: Boolean(compactText(args.dxmCategory)),
    usageAndFormConsistent: titleConsistency,
    noObviousConflict: titleConsistency,
    nonRiskCategory: true,
    matchedTitleCount: matchedTitles.length,
    checkedTitleCount: titles.length,
    matchedTokens: tokens,
    semanticConsensus,
  };
}

function buildPlatformCategoryEvidence(snapshot, args, scored) {
  const semanticConsensus = scored
    && scored.conditionalChecks
    && scored.conditionalChecks.semanticConsensus;
  const semanticRule = inferSemanticFamilyRule(args);
  const platformCategoryConfirmed = Boolean(scored && scored.topCategoryId);
  const platformCategoryIntent = platformCategoryConfirmed
    ? ((semanticConsensus && semanticConsensus.family) || `postCategoryId:${scored.topCategoryId}`)
    : '';
  const platformCategoryTerms = platformCategoryConfirmed
    ? [
      ...((semanticRule && semanticRule.platformTerms) || []),
      ...((semanticConsensus && semanticConsensus.matchedTitles) || []).slice(0, 3),
      scored && scored.topCategoryId ? `postCategoryId:${scored.topCategoryId}` : '',
    ]
    : [];
  const dxmSearchTerms = [];
  return {
    platformCategoryConfirmed,
    platformCategoryIntent,
    platformCategoryTerms: uniqueCompactTerms(platformCategoryTerms),
    dxmSearchTerms: uniqueCompactTerms(dxmSearchTerms),
  };
}

function shouldCaptureDetailEvidence(scored, args) {
  return evidencePolicy.shouldCaptureDetailEvidence(scored, args, evidencePolicy.readThresholds(args.thresholdsPath));
}

function isVerificationText(value) {
  const text = compactText(value).toLowerCase();
  return /captcha|robot|verify you are human|security check|slide to verify|verification required|滑动验证|验证码|人机验证|验证你是真人|安全验证/.test(text);
}

function summarizeDetailEvidence(detailEvidence) {
  if (!detailEvidence) return '';
  if (detailEvidence.status === 'aliexpress_verification_required') {
    return `AliExpress detail-page verification required: ${detailEvidence.verificationUrls.join(' | ')}`;
  }
  if (!detailEvidence.ok) return detailEvidence.reason || '';
  return [
    `AliExpress detail pages checked: ${detailEvidence.checked}`,
    `detail type consensus: ${detailEvidence.consensusType}`,
    detailEvidence.items && detailEvidence.items.length
      ? `detail URLs: ${detailEvidence.items.map((item) => item.url).join(' | ')}`
      : '',
  ].filter(Boolean).join('; ');
}

function summarizeDetailVerificationBlock(detailEvidence) {
  const items = Array.isArray(detailEvidence && detailEvidence.items) ? detailEvidence.items : [];
  const sliderAttempts = items.flatMap((item) => Array.isArray(item.sliderAttempts) ? item.sliderAttempts : []);
  return {
    detailVerificationBlocked: true,
    detailVerificationBlockedUrls: Array.from(new Set([
      ...((detailEvidence && detailEvidence.verificationUrls) || []),
      ...items
        .filter((item) => item && item.status === 'aliexpress_verification_required')
        .map((item) => item.url)
        .filter(Boolean),
    ])),
    detailSliderAttempted: items.some((item) => item && item.sliderAttempted) || sliderAttempts.length > 0,
    detailSliderAttempts: sliderAttempts,
  };
}

function applyDetailEvidence(record, detailEvidence) {
  return applyDetailEvidenceWithArgs(record, detailEvidence, {});
}

function getDetailUniquePlatformCategory(detailEvidence) {
  const items = Array.isArray(detailEvidence && detailEvidence.items) ? detailEvidence.items : [];
  const readable = items.filter((item) => item && item.ok);
  const counts = {};
  for (const item of readable) {
    const id = compactText(item.detailCategoryId);
    const name = compactText(item.detailCategoryName);
    const pathText = compactText(item.detailCategoryPath);
    if (!id && !isValidDetailPlatformCategoryText(pathText || name)) continue;
    const key = id ? `id:${id}` : (pathText ? `path:${pathText.toLowerCase()}` : (name ? `name:${name.toLowerCase()}` : ''));
    if (!key) continue;
    if (!counts[key]) {
      counts[key] = {
        key,
        id,
        name,
        path: pathText || name,
        items: [],
      };
    }
    counts[key].items.push(item);
  }
  const best = Object.values(counts).sort((a, b) => b.items.length - a.items.length)[0] || null;
  if (!best) return null;
  return {
    ok: true,
    key: best.key,
    id: best.id,
    name: best.name,
    path: best.path,
    matched: best.items.length,
    checked: readable.length,
    urls: best.items.map((item) => item.url).filter(Boolean),
  };
}

function isValidDetailPlatformCategoryText(value) {
  const text = compactText(value).replace(/[,\s]+$/g, '');
  if (!text || text.length < 2 || text.length > 120) return false;
  return !/^(recalls?|intellectual property protection|privacy policy|terms of use|buyer protection|help center|customer service|report infringement)$/i.test(text);
}

function findDetailCategoryMapping(uniqueCategory, args = {}) {
  if (!uniqueCategory || !uniqueCategory.id) return null;
  try {
    return getActiveMapping(uniqueCategory.id, args.mapPath || DEFAULT_MAP_PATH);
  } catch (_) {
    return null;
  }
}

function applyDetailEvidenceWithArgs(record, detailEvidence, args = {}) {
  if (!detailEvidence) return record;
  const base = {
    ...record,
    detailEvidence,
  };
  const semanticConsensus = record
    && record.conditionalChecks
    && record.conditionalChecks.semanticConsensus;
  const searchResultsAlreadyAgree = Boolean(semanticConsensus && semanticConsensus.ok);
  const hasDxmCandidateCategory = Boolean(compactText(record.dxmCandidateCategory));
  if (detailEvidence.status === 'aliexpress_verification_required') {
    const verificationBlock = summarizeDetailVerificationBlock(detailEvidence);
    if (searchResultsAlreadyAgree) {
      return {
        ...base,
        ...verificationBlock,
        status: hasDxmCandidateCategory ? 'dxm_category_validation_required' : 'semantic_consensus_needs_dxm_mapping',
        confidenceTier: hasDxmCandidateCategory
          ? (record.confidenceTier || 'detail_or_dxm_validation_required')
          : 'platform_category_mapping_required',
        verificationMode: hasDxmCandidateCategory
          ? 'search_consensus_dxm_validation_required'
          : 'search_consensus_dxm_mapping_required',
        evidenceSummary: [record.evidenceSummary, summarizeDetailEvidence(detailEvidence)].filter(Boolean).join('; '),
        reason: hasDxmCandidateCategory
          ? `AliExpress search results already have semantic consensus (${semanticConsensus.family || 'same-product-family'}); detail page verification/slider blocked only the extra detail evidence, so keep the search conclusion and run Dianxiaomi readonly category validation`
          : 'aliexpress_category_confirmed_but_dxm_mapping_missing',
        source: 'aliexpress_search',
        aliexpressUniqueCategoryConfirmed: false,
        aliexpressDetailCategoryName: '',
        aliexpressDetailCategoryPath: '',
        updatedAt: nowIso(),
      };
    }
    return {
      ...base,
      ...verificationBlock,
      status: 'aliexpress_verification_required',
      confidenceTier: 'control_verification_required',
      verificationMode: 'detail_page_verification_required',
      evidenceSummary: [record.evidenceSummary, summarizeDetailEvidence(detailEvidence)].filter(Boolean).join('; '),
      reason: 'AliExpress detail page requires human verification before category type can be read',
      source: 'aliexpress_detail_page',
      updatedAt: nowIso(),
    };
  }
  if (!detailEvidence.ok) {
    const nextStatus = searchResultsAlreadyAgree && !hasDxmCandidateCategory
      ? 'semantic_consensus_needs_dxm_mapping'
      : record.status;
    return {
      ...base,
      status: nextStatus,
      confidenceTier: searchResultsAlreadyAgree && !hasDxmCandidateCategory
        ? 'platform_category_mapping_required'
        : (record.confidenceTier || 'detail_inconclusive'),
      verificationMode: searchResultsAlreadyAgree && !hasDxmCandidateCategory
        ? 'search_consensus_dxm_mapping_required'
        : 'detail_inconclusive_no_category_confirmation',
      evidenceSummary: [record.evidenceSummary, summarizeDetailEvidence(detailEvidence)].filter(Boolean).join('; '),
      reason: searchResultsAlreadyAgree && !hasDxmCandidateCategory
        ? 'aliexpress_category_confirmed_but_dxm_mapping_missing'
        : 'AliExpress detail evidence was inconclusive; category evidence is not safe for Dianxiaomi edit/save',
      source: 'aliexpress_detail_page',
      aliexpressUniqueCategoryConfirmed: false,
      aliexpressDetailCategoryName: '',
      aliexpressDetailCategoryPath: '',
      updatedAt: nowIso(),
    };
  }
  const consensusType = compactText(detailEvidence.consensusType);
  const uniqueCategory = getDetailUniquePlatformCategory(detailEvidence);
  if (uniqueCategory && uniqueCategory.ok) {
    const mapping = findDetailCategoryMapping(uniqueCategory, args);
    const dxmCandidateCategory = compactText(record.dxmCandidateCategory || (mapping && mapping.dxmCandidateCategory));
    const dxmCandidateCategoryId = compactText(record.dxmCandidateCategoryId || (mapping && mapping.dxmCandidateCategoryId));
    return {
      ...base,
      status: dxmCandidateCategory ? 'detail_verified' : 'semantic_consensus_needs_dxm_mapping',
      dxmCandidateCategory,
      dxmCandidateCategoryId,
      dxmSearchTerms: [],
      aliexpressCategoryId: uniqueCategory.id || record.aliexpressCategoryId || '',
      aliexpressMatchedCategory: uniqueCategory.id ? `postCategoryId:${uniqueCategory.id}` : (record.aliexpressMatchedCategory || ''),
      aliexpressDetailCategoryName: uniqueCategory.name || '',
      aliexpressDetailCategoryPath: uniqueCategory.path || '',
      aliexpressUniqueCategoryConfirmed: true,
      evidenceConfidence: Number(Math.max(Number(record.evidenceConfidence) || 0, dxmCandidateCategory ? 0.65 : 0.5).toFixed(4)),
      confidenceTier: dxmCandidateCategory ? 'detail_platform_category_mapped' : 'detail_platform_category_mapping_required',
      verificationMode: dxmCandidateCategory ? 'detail_unique_platform_category_mapped' : 'detail_unique_platform_category_mapping_required',
      conditionalChecks: {
        ...(record.conditionalChecks || {}),
        detailTypeConsensus: consensusType ? {
          ok: true,
          requiredMatchingDetailPages: detailEvidence.required,
          matchedDetailPages: detailEvidence.matched,
          checkedDetailPages: detailEvidence.checked,
          consensusType,
        } : undefined,
        detailUniquePlatformCategory: {
          ok: true,
          id: uniqueCategory.id,
          name: uniqueCategory.name,
          path: uniqueCategory.path,
          matchedDetailPages: uniqueCategory.matched,
          checkedDetailPages: uniqueCategory.checked,
        },
        hasDxmCandidateCategory: Boolean(dxmCandidateCategory),
        usageAndFormConsistent: true,
        noObviousConflict: true,
        nonRiskCategory: true,
      },
      evidenceSummary: [
        record.evidenceSummary,
        summarizeDetailEvidence(detailEvidence),
        uniqueCategory.id ? `detail unique AliExpress category postCategoryId ${uniqueCategory.id}` : '',
        uniqueCategory.path ? `detail category ${uniqueCategory.path}` : '',
        mapping ? `DXM category map matched ${uniqueCategory.id}` : '',
      ].filter(Boolean).join('; '),
      reason: dxmCandidateCategory
        ? `AliExpress detail page unique category is mapped to DXM: ${uniqueCategory.path || uniqueCategory.id}`
        : `AliExpress detail page unique category captured, but DXM mapping is missing: ${uniqueCategory.path || uniqueCategory.id}`,
      source: 'aliexpress_detail_page',
      updatedAt: nowIso(),
    };
  }
  return {
    ...base,
    status: 'semantic_consensus_needs_dxm_mapping',
    dxmSearchTerms: [],
    aliexpressUniqueCategoryConfirmed: false,
    aliexpressDetailCategoryName: '',
    aliexpressDetailCategoryPath: '',
    evidenceConfidence: Number(Math.max(Number(record.evidenceConfidence) || 0, 0.5).toFixed(4)),
    confidenceTier: 'detail_type_without_platform_category',
    verificationMode: 'detail_type_consensus_missing_unique_platform_category',
    conditionalChecks: {
      ...(record.conditionalChecks || {}),
      detailTypeConsensus: {
        ok: true,
        requiredMatchingDetailPages: detailEvidence.required,
        matchedDetailPages: detailEvidence.matched,
        checkedDetailPages: detailEvidence.checked,
        consensusType,
      },
      hasDxmCandidateCategory: Boolean(compactText(record.dxmCandidateCategory)),
      usageAndFormConsistent: true,
      noObviousConflict: true,
      nonRiskCategory: true,
    },
    evidenceSummary: [
      record.evidenceSummary,
      summarizeDetailEvidence(detailEvidence),
    ].filter(Boolean).join('; '),
    reason: `AliExpress detail pages show matching product type (${consensusType}), but unique platform category/DXM mapping is missing`,
    source: 'aliexpress_detail_page',
    updatedAt: nowIso(),
  };
}

function normalizeDetailConsensusItem(item, args) {
  const typeValue = compactText(item && item.typeValue);
  const fallback = { key: normalizeConsensusText(typeValue), type: typeValue };
  if (!typeValue || !isValidDetailTypeConsensusValue(typeValue)) return { key: '', type: '' };
  const semanticRule = inferSemanticFamilyRule(args);
  if (
    semanticRule
    && semanticRule.id === 'faucet-mat-splash-guard'
    && (
      /飞溅屏幕|防溅|splash/i.test(typeValue)
      || (/专用工具|special tool/i.test(typeValue) && semanticRule.title.test(compactText(item.titleHint)))
    )
  ) {
    return { key: 'faucetmatsplashguard', type: /飞溅屏幕|splash/i.test(typeValue) ? typeValue : '飞溅屏幕' };
  }
  return fallback;
}

function isValidDetailTypeConsensusValue(value) {
  const text = compactText(value).replace(/[,\s]+$/g, '');
  if (!text || text.length < 2 || text.length > 80) return false;
  return !/^(浏览|browse|shop|store|reviews?|评论|规格|specifications?|详情|details?|卖家推荐|recommended|加入购物车|add to cart|all popular.*|.*promotion.*|.*low price.*|.*great value.*|rev)$/i.test(text);
}

function findActiveCategoryMapping(postCategoryId, args) {
  if (!postCategoryId || compactText(args.dxmCategory)) return null;
  try {
    return getActiveMapping(postCategoryId, args.mapPath);
  } catch (_) {
    return null;
  }
}

function enrichArgsWithCategoryMapping(args, scored) {
  const mapping = findActiveCategoryMapping(scored.topCategoryId, args);
  if (!mapping) return { effectiveArgs: args, mapping: null };
  return {
    mapping,
    effectiveArgs: {
      ...args,
      productFamily: args.productFamily || mapping.productFamily || '',
      dxmCategory: args.dxmCategory || mapping.dxmCandidateCategory || '',
      dxmCategoryId: args.dxmCategoryId || mapping.dxmCandidateCategoryId || '',
    },
  };
}

function scoreEvidence(snapshot, args) {
  const thresholds = evidencePolicy.readThresholds(args.thresholdsPath);
  const counts = countCategoryIds(snapshot.postCategoryIds || []);
  const ranked = topEntries(counts);
  const resultCount = Math.max(snapshot.resultCount || 0, snapshot.titles ? snapshot.titles.length : 0, snapshot.postCategoryIds ? snapshot.postCategoryIds.length : 0);
  const top = ranked[0] || null;
  const topShare = top && resultCount ? top.count / resultCount : 0;
  const titleEvidenceCount = (snapshot.titles || []).filter(Boolean).length;
  const hasDxmCategory = Boolean(compactText(args.dxmCategory));
  const conditionalChecks = evaluateConditionalEvidence(snapshot, args);
  const classification = evidencePolicy.classifyEvidenceConfidence(topShare, hasDxmCategory, conditionalChecks, thresholds);
  let status = 'needs_manual_review';
  let reason = 'insufficient structured evidence';
  if (!resultCount && !titleEvidenceCount) {
    status = 'evidence_missing';
    reason = 'no readable AliExpress search results';
  } else if (classification.status === 'aliexpress_verified') {
    status = 'aliexpress_verified';
    reason = `top AliExpress category ${top.id} has ${(topShare * 100).toFixed(0)}% consensus and DXM candidate category is provided`;
  } else if (classification.status === 'conditional_verified') {
    status = 'conditional_verified';
    reason = `top AliExpress category ${top.id} has ${(topShare * 100).toFixed(0)}% conditional consensus with DXM candidate category, usage/form consistency, and no obvious conflict`;
  } else if (classification.status === 'dxm_category_validation_required') {
    status = hasDxmCategory ? 'conditional_verified' : 'semantic_consensus_needs_dxm_mapping';
    reason = hasDxmCategory
      ? `top AliExpress category ${top.id} is mapped to DXM candidate category`
      : 'aliexpress_category_confirmed_but_dxm_mapping_missing';
  } else if (topShare > 0 && topShare < thresholds.directPassTopShare) {
    status = hasDxmCategory ? 'conditional_verified' : 'semantic_consensus_needs_dxm_mapping';
    reason = hasDxmCategory
      ? `top AliExpress category ${top.id} is mapped to DXM candidate category`
      : 'aliexpress_category_confirmed_but_dxm_mapping_missing';
  } else if (!hasDxmCategory) {
    status = 'needs_manual_review';
    reason = 'DXM candidate category is missing';
  } else if (topShare >= thresholds.directPassTopShare && topShare < thresholds.highConfidenceTopShare) {
    status = 'needs_manual_review';
    reason = 'Conditional AliExpress evidence did not satisfy DXM category / usage-form consistency / no-conflict requirements';
  }
  return {
    status,
    reason,
    resultCount,
    topCategoryId: top ? top.id : '',
    topShare,
    confidenceTier: status === 'semantic_consensus_needs_dxm_mapping'
      ? 'platform_category_mapping_required'
      : (status === 'conditional_verified' && classification.confidenceTier === 'below_threshold'
        ? 'platform_category_mapped'
        : classification.confidenceTier),
    verificationMode: status === 'semantic_consensus_needs_dxm_mapping'
      ? 'aliexpress_category_confirmed_dxm_mapping_required'
      : (status === 'conditional_verified' && classification.verificationMode === 'not_verified'
        ? 'aliexpress_category_confirmed_dxm_mapped'
        : classification.verificationMode),
    conditionalChecks,
    ranked,
  };
}

function buildEvidenceRecordFromSnapshot(args, snapshot) {
  const asin = normalizeAsin(args.asin);
  const initialScore = scoreEvidence(snapshot, args);
  const { effectiveArgs, mapping } = enrichArgsWithCategoryMapping(args, initialScore);
  const scored = mapping ? scoreEvidence(snapshot, effectiveArgs) : initialScore;
  const platformCategory = buildPlatformCategoryEvidence(snapshot, effectiveArgs, scored);
  const titles = (snapshot.titles || []).slice(0, 6);
  const summaryParts = [
    scored.resultCount ? `AliExpress readable results: ${scored.resultCount}` : '',
    scored.topCategoryId ? `top postCategoryId ${scored.topCategoryId} (${(scored.topShare * 100).toFixed(0)}%)` : '',
    platformCategory.platformCategoryConfirmed ? `platform category confirmed: ${platformCategory.platformCategoryIntent}` : '',
    mapping ? `DXM category map matched ${mapping.postCategoryId}` : '',
    titles.length ? `sample titles: ${titles.join(' | ')}` : '',
  ].filter(Boolean);
  return {
    asin,
    amazonTitle: effectiveArgs.amazonTitle,
    amazonImage: effectiveArgs.amazonImage,
    amazonUrl: effectiveArgs.amazonUrl || (asin ? `https://www.amazon.com/dp/${asin}` : ''),
    productFamily: compactText(effectiveArgs.productFamily || snapshot.productFamily || effectiveArgs.query),
    status: scored.status,
    aliexpressKeyword: compactText(effectiveArgs.query || snapshot.query),
    aliexpressEvidenceUrl: snapshot.href || '',
    aliexpressMatchedCategory: scored.topCategoryId ? `postCategoryId:${scored.topCategoryId}` : '',
    aliexpressCategoryId: scored.topCategoryId || '',
    aliexpressUniqueCategoryConfirmed: Boolean(scored.topCategoryId),
    dxmCandidateCategory: compactText(effectiveArgs.dxmCategory),
    dxmCandidateCategoryId: compactText(effectiveArgs.dxmCategoryId),
    safeAdjacentUsed: Boolean(effectiveArgs.safeAdjacent),
    ...platformCategory,
    evidenceConfidence: Number(scored.topShare.toFixed(4)),
    confidenceTier: scored.confidenceTier,
    verificationMode: scored.verificationMode,
    conditionalChecks: scored.conditionalChecks,
    evidenceSummary: summaryParts.join('; '),
    reason: scored.reason,
    source: 'aliexpress_search',
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

function pickRepresentativeProductLinks(snapshot, args) {
  const semanticRule = inferSemanticFamilyRule(args);
  const links = Array.isArray(snapshot.productLinks) ? snapshot.productLinks : [];
  const seen = new Set();
  const scored = links
    .map((link, index) => {
      const href = normalizeUrl(link.href);
      const title = compactText(link.title);
      if (!href || seen.has(href)) return null;
      seen.add(href);
      const semanticHit = semanticRule && semanticRule.title.test(title);
      return {
        href,
        title,
        score: (semanticHit ? 10 : 0) + Math.max(0, 5 - index),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);
  return scored;
}

function buildEvidenceRecordFromResolver(args) {
  if (!args.resolverFile) throw new Error('from-resolver requires --resolver-file');
  const resolver = JSON.parse(fs.readFileSync(args.resolverFile, 'utf8'));
  const asin = normalizeAsin(args.asin || resolver.asin);
  const recommended = resolver.recommended || {};
  const recommendedDxmCategory = recommended.dxmVisibleCategoryPath || recommended.dxmVisibleCategory || '';
  const mapped = !args.dxmCategory && !recommendedDxmCategory && recommended.postCategoryId
    ? findActiveCategoryMapping(String(recommended.postCategoryId), args)
    : null;
  const dxmCategory = compactText(args.dxmCategory || recommendedDxmCategory || (mapped && mapped.dxmCandidateCategory));
  const rawConfidence = Number(recommended.confidence);
  const normalizedConfidence = Number.isFinite(rawConfidence)
    ? (rawConfidence > 1 ? rawConfidence / 100 : rawConfidence)
    : (/high_confidence|validated|confirmed/i.test(String(recommended.status || '')) ? evidencePolicy.readThresholds(args.thresholdsPath).highConfidenceTopShare : 0);
  const conditionalChecks = {
    hasDxmCandidateCategory: Boolean(dxmCategory),
    usageAndFormConsistent: Boolean(dxmCategory && (recommended.semanticFamily || resolver.query)),
    noObviousConflict: true,
    nonRiskCategory: true,
    matchedTitleCount: Array.isArray(resolver.evidenceTitles) ? resolver.evidenceTitles.length : 0,
    checkedTitleCount: Array.isArray(resolver.evidenceTitles) ? resolver.evidenceTitles.length : 0,
    matchedTokens: [],
  };
  const classification = evidencePolicy.classifyEvidenceConfidence(
    normalizedConfidence,
    Boolean(dxmCategory),
    conditionalChecks,
    evidencePolicy.readThresholds(args.thresholdsPath)
  );
  const status = classification.status || (dxmCategory ? 'needs_manual_review' : 'evidence_split');
  const titles = Array.isArray(resolver.evidenceTitles) ? resolver.evidenceTitles.slice(0, 6) : [];
  return {
    asin,
    amazonTitle: args.amazonTitle,
    amazonImage: args.amazonImage,
    amazonUrl: args.amazonUrl || `https://www.amazon.com/dp/${asin}`,
    productFamily: compactText(args.productFamily || recommended.semanticFamily || (mapped && mapped.productFamily) || resolver.query),
    status,
    aliexpressKeyword: compactText(args.query || resolver.query),
    aliexpressEvidenceUrl: args.resolverFile,
    aliexpressMatchedCategory: recommended.postCategoryId ? `postCategoryId:${recommended.postCategoryId}` : '',
    aliexpressCategoryId: String(recommended.postCategoryId || ''),
    dxmCandidateCategory: dxmCategory,
    dxmCandidateCategoryId: compactText(args.dxmCategoryId || (mapped && mapped.dxmCandidateCategoryId)),
    safeAdjacentUsed: Boolean(args.safeAdjacent),
    evidenceConfidence: Number(normalizedConfidence.toFixed(4)),
    confidenceTier: classification.confidenceTier,
    verificationMode: classification.verificationMode,
    conditionalChecks,
    evidenceSummary: [
      resolver.resultCount ? `AliExpress result count ${resolver.resultCount}` : '',
      recommended.confidence != null ? `confidence ${recommended.confidence}` : '',
      mapped ? `DXM category map matched ${mapped.postCategoryId}` : '',
      titles.length ? `sample titles: ${titles.join(' | ')}` : '',
    ].filter(Boolean).join('; '),
    reason: recommended.status || 'resolver report imported',
    source: VERIFIED_STATUSES.has(status) ? 'aliexpress_search' : 'manual_record',
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

function buildManualRecord(args) {
  const asin = normalizeAsin(args.asin);
  if (!args.dxmCategory) throw new Error('manual requires --dxm-category');
  if (!args.productFamily && !args.query) throw new Error('manual requires --product-family or --query');
  return {
    asin,
    amazonTitle: args.amazonTitle,
    amazonImage: args.amazonImage,
    amazonUrl: args.amazonUrl || `https://www.amazon.com/dp/${asin}`,
    productFamily: compactText(args.productFamily || args.query),
    status: 'aliexpress_verified',
    aliexpressKeyword: compactText(args.query),
    aliexpressEvidenceUrl: '',
    aliexpressMatchedCategory: '',
    aliexpressCategoryId: '',
    dxmCandidateCategory: compactText(args.dxmCategory),
    dxmCandidateCategoryId: compactText(args.dxmCategoryId),
    safeAdjacentUsed: Boolean(args.safeAdjacent),
    evidenceConfidence: 1,
    confidenceTier: 'high_confidence',
    verificationMode: 'manual_verified',
    conditionalChecks: {
      hasDxmCandidateCategory: true,
      usageAndFormConsistent: true,
      noObviousConflict: true,
      nonRiskCategory: true,
    },
    evidenceSummary: 'Manually verified AliExpress/DXM category evidence.',
    reason: 'manual verified record',
    source: 'manual_record',
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
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

function extractWebBridgeValue(payload) {
  const data = payload && payload.data;
  if (!data) return null;
  if (data.value != null) return data.value;
  if (data.data && data.data.value != null) return data.data.value;
  if (data.result && data.result.value != null) return data.result.value;
  if (data.type && data.value != null) return data.value;
  return null;
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
      transport: 'curl',
    };
  }
}

async function openAliExpressSearch(args) {
  if (!args.query) throw new Error('open requires --query');
  const url = `${ALIEXPRESS_SEARCH_URL}?SearchText=${encodeURIComponent(args.query)}`;
  const response = await postWebBridge(args, 'navigate', {
    url,
    newTab: true,
    group_title: 'AliExpress证据采集',
  });
  const error = getToolError(response);
  if (response.error || error) return { ok: false, status: response.error || error, raw: response.data || null };
  return { ok: true, page: response.data && response.data.data ? response.data.data : response.data };
}

async function captureCurrentAliExpressPage(args) {
  if (!args.asin) throw new Error('capture requires --asin');
  const code = `(() => {
    const compact = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
    const scripts = Array.from(document.scripts).map((script) => script.textContent || '').join('\\n').slice(0, 2000000);
    const ids = [];
    const patterns = [
      /"postCategoryId"\\s*:\\s*"?([0-9]{4,})"?/g,
      /postCategoryId=([0-9]{4,})/g
    ];
    for (const pattern of patterns) {
      let match = null;
      while ((match = pattern.exec(scripts)) && ids.length < 200) ids.push(match[1]);
    }
    const links = Array.from(document.querySelectorAll('a[href*="/item/"], a[href*="item/"]'));
    const titles = [];
    const productLinks = [];
    for (const link of links) {
      const text = compact(link.innerText || link.getAttribute('title') || link.getAttribute('aria-label'));
      if (text && text.length >= 12 && text.length <= 240 && !titles.includes(text)) titles.push(text);
      const href = link.href || link.getAttribute('href') || '';
      if (href && text && !productLinks.some((item) => item.href === href)) productLinks.push({ href, title: text });
      if (titles.length >= 20) break;
    }
    const params = new URLSearchParams(location.search);
    return JSON.stringify({
      href: location.href,
      title: document.title,
      query: compact(params.get('SearchText') || params.get('searchText') || ''),
      resultCount: Math.max(titles.length, ids.length),
      titles,
      productLinks: productLinks.slice(0, 20),
      postCategoryIds: ids
    });
  })()`;
  const response = await postWebBridge(args, 'evaluate', { code });
  const error = getToolError(response);
  if (response.error || error) return { ok: false, status: response.error || error, raw: response.data || null };
  try {
    return { ok: true, snapshot: JSON.parse(extractWebBridgeValue(response) || '{}') };
  } catch (parseError) {
    return { ok: false, status: 'capture_parse_failed', error: String(parseError), raw: response.data || null };
  }
}

async function waitMs(ms) {
  if (!ms) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function isDetailVerification(detail, url) {
  return Boolean(
    detail
    && (
      detail.isVerification
      || isVerificationText(detail.textSample || detail.title)
      || /\/punish\?|x5secdata=|x5step=/i.test(detail.href || url || '')
    )
  );
}

async function readCurrentAliExpressDetailPage(args) {
  const code = `(() => {
    const compact = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
    const unique = (items) => Array.from(new Set(items.map(compact).filter(Boolean)));
    const invalidTypeValue = /^(浏览|browse|shop|store|reviews?|评论|规格|specifications?|详情|details?|卖家推荐|recommended|加入购物车|add to cart|all popular.*|.*promotion.*|.*low price.*|.*great value.*|rev)$/i;
    const invalidCategoryText = /^(recalls?|intellectual property protection|privacy policy|terms of use|buyer protection|help center|customer service|report infringement)$/i;
    const isValidTypeValue = (value) => {
      const text = compact(value);
      if (!text || text.length < 2 || text.length > 80) return false;
      return !invalidTypeValue.test(text);
    };
    const isValidCategoryText = (value) => {
      const text = compact(value).replace(/[,\\s]+$/g, '');
      return Boolean(text && text.length >= 2 && text.length <= 120 && !invalidCategoryText.test(text));
    };
    const typePriority = (name) => {
      const text = compact(name).toLowerCase();
      if (/专用工具类型|special tool type/.test(text)) return 1;
      if (/产品类型|商品类型|product type/.test(text)) return 2;
      if (/^类型$|^type$/.test(text)) return 3;
      if (/类别|类目|category/.test(text)) return 4;
      return 9;
    };
    const scrollSteps = [0.2, 0.45, 0.7, 0.9];
    for (const ratio of scrollSteps) {
      window.scrollTo(0, Math.floor(document.body.scrollHeight * ratio));
    }
    const specs = [];
    const nodes = Array.from(document.querySelectorAll('tr, li, dl, div, span'));
    const keyPattern = /^(类型|类别|类目|产品类型|商品类型|专用工具类型|type|category|product type|special tool type)$/i;
    for (const node of nodes) {
      const text = compact(node.innerText || node.textContent || '');
      if (!text || text.length > 220) continue;
      let name = '';
      let value = '';
      const colon = text.match(/^(类型|类别|类目|产品类型|商品类型|专用工具类型|Type|Category|Product Type|Special Tool Type)\\s*[:：]\\s*(.+)$/i);
      if (colon) {
        name = compact(colon[1]);
        value = compact(colon[2]);
      } else {
        const parts = text.split(/\\n|\\t/).map(compact).filter(Boolean);
        if (parts.length >= 2 && keyPattern.test(parts[0])) {
          name = parts[0];
          value = parts.slice(1).join(' ');
        }
      }
      if (name && value && !specs.some((item) => item.name === name && item.value === value)) {
        specs.push({ name, value });
      }
      if (specs.length >= 12) break;
    }
    const rawPageText = document.body ? (document.body.innerText || '') : '';
    const pageText = compact(rawPageText);
    const scripts = Array.from(document.scripts).map((script) => script.textContent || '').join('\\n').slice(0, 2500000);
    const categoryIds = [];
    const categoryIdPatterns = [
      /"postCategoryId"\\s*:\\s*"?([0-9]{4,})"?/g,
      /"categoryId"\\s*:\\s*"?([0-9]{4,})"?/g,
      /postCategoryId=([0-9]{4,})/g,
      /categoryId=([0-9]{4,})/g
    ];
    for (const pattern of categoryIdPatterns) {
      let match = null;
      while ((match = pattern.exec(scripts)) && categoryIds.length < 40) categoryIds.push(match[1]);
    }
    const categoryNameCandidates = [];
    const categoryNamePatterns = [
      /"categoryName"\\s*:\\s*"([^"]{2,120})"/g,
      /"cateName"\\s*:\\s*"([^"]{2,120})"/g,
      /"postCategoryName"\\s*:\\s*"([^"]{2,120})"/g
    ];
    for (const pattern of categoryNamePatterns) {
      let match = null;
      while ((match = pattern.exec(scripts)) && categoryNameCandidates.length < 20) {
        if (isValidCategoryText(match[1])) categoryNameCandidates.push(match[1]);
      }
    }
    const breadcrumbTexts = Array.from(document.querySelectorAll('[class*="breadcrumb"] a,[class*="breadcrumb"] span,a[href*="/category/"],a[href*="categoryId"],a[href*="catId"]'))
      .map((node) => compact(node.innerText || node.textContent || node.getAttribute('title') || ''))
      .filter((text) => text && text.length >= 2 && text.length <= 80)
      .filter((text) => !/AliExpress|首页|Home|Store|Shop|Reviews?|评论/i.test(text))
      .filter(isValidCategoryText);
    const detailCategoryId = unique(categoryIds)[0] || '';
    const breadcrumbPath = unique(breadcrumbTexts).join('/');
    const detailCategoryName = unique(categoryNameCandidates)[0] || unique(breadcrumbTexts).slice(-1)[0] || '';
    const fallback = [];
    const regexes = [
      /(类型|类别|类目|产品类型|商品类型|专用工具类型)\\s*[:：]?\\s*([^\\n\\r]{2,60})/g,
      /(Type|Category|Product Type|Special Tool Type)\\s*[:：]?\\s*([^\\n\\r]{2,60})/gi
    ];
    for (const regex of regexes) {
      let match = null;
      while ((match = regex.exec(rawPageText)) && fallback.length < 6) {
        fallback.push({ name: compact(match[1]), value: compact(match[2]) });
      }
    }
    const allSpecs = [...specs];
    fallback.forEach((item) => {
      if (!allSpecs.some((existing) => existing.name === item.name && existing.value === item.value)) allSpecs.push(item);
    });
    const typeSpec = allSpecs
      .filter((item) => /^(类型|类别|类目|产品类型|商品类型|专用工具类型|type|category|product type|special tool type)$/i.test(item.name))
      .filter((item) => isValidTypeValue(item.value))
      .sort((a, b) => typePriority(a.name) - typePriority(b.name))[0] || null;
    return JSON.stringify({
      href: location.href,
      title: document.title,
      isVerification: /captcha|robot|verify you are human|security check|slide to verify|verification required|滑动验证|验证码|人机验证|验证你是真人|安全验证/i.test(pageText),
      detailCategoryId,
      detailCategoryName,
      detailCategoryPath: breadcrumbPath || detailCategoryName,
      detailCategoryIds: unique(categoryIds).slice(0, 12),
      detailCategoryNames: unique(categoryNameCandidates).slice(0, 12),
      detailBreadcrumbs: unique(breadcrumbTexts).slice(0, 12),
      typeValue: typeSpec ? typeSpec.value : '',
      typeName: typeSpec ? typeSpec.name : '',
      specs: allSpecs.slice(0, 20),
      textSample: pageText.slice(0, 1000)
    });
  })()`;
  const captured = await postWebBridge(args, 'evaluate', { code });
  const error = getToolError(captured);
  if (captured.error || error) {
    return { ok: false, reason: captured.error || error, raw: captured.data || null };
  }
  try {
    return { ok: true, detail: JSON.parse(extractWebBridgeValue(captured) || '{}') };
  } catch (parseError) {
    return { ok: false, reason: 'detail_page_parse_failed', error: String(parseError), raw: captured.data || null };
  }
}

async function findAliExpressVerificationSlider(args) {
  const code = `(() => {
    const visible = (element) => {
      if (!element) return false;
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.visibility !== 'hidden'
        && style.display !== 'none'
        && rect.width > 8
        && rect.height > 8
        && rect.bottom > 0
        && rect.right > 0
        && rect.top < window.innerHeight
        && rect.left < window.innerWidth;
    };
    const token = /slider|slide|captcha|verify|verification|nc_|btn_slide|滑块|滑动|验证|安全/i;
    const elements = Array.from(document.querySelectorAll('body *')).filter(visible);
    const scored = elements.map((element) => {
      const rect = element.getBoundingClientRect();
      const text = [element.className, element.id, element.getAttribute('aria-label'), element.innerText]
        .map((value) => String(value || ''))
        .join(' ');
      let score = token.test(text) ? 10 : 0;
      if (rect.width >= 24 && rect.width <= 110 && rect.height >= 24 && rect.height <= 80) score += 4;
      if (/滑块|按住|拖动|slide/i.test(text)) score += 4;
      if (score <= 0) return null;
      return { element, rect, score };
    }).filter(Boolean).sort((a, b) => b.score - a.score);
    const handle = scored[0] || null;
    if (!handle) {
      return JSON.stringify({ ok: false, reason: 'verification_slider_handle_not_found' });
    }
    let track = handle.element.parentElement;
    for (let i = 0; i < 6 && track; i += 1) {
      const rect = track.getBoundingClientRect();
      if (visible(track) && rect.width >= handle.rect.width + 80 && rect.height >= handle.rect.height * 0.6) break;
      track = track.parentElement;
    }
    const trackRect = track ? track.getBoundingClientRect() : null;
    const startX = Math.round(handle.rect.left + Math.min(handle.rect.width / 2, 24));
    const startY = Math.round(handle.rect.top + handle.rect.height / 2);
    const endX = trackRect
      ? Math.round(Math.min(trackRect.right - 8, startX + Math.max(120, trackRect.width - handle.rect.width - 12)))
      : Math.round(Math.min(window.innerWidth - 8, startX + 260));
    return JSON.stringify({
      ok: endX > startX + 60,
      reason: endX > startX + 60 ? '' : 'verification_slider_track_too_short',
      startX,
      startY,
      endX,
      distance: endX - startX
    });
  })()`;
  const response = await postWebBridge(args, 'evaluate', { code });
  const error = getToolError(response);
  if (response.error || error) return { ok: false, reason: response.error || error };
  try {
    return JSON.parse(extractWebBridgeValue(response) || '{}');
  } catch (parseError) {
    return { ok: false, reason: `verification_slider_target_parse_failed: ${String(parseError)}` };
  }
}

async function dispatchMouse(args, type, x, y, extra = {}) {
  const response = await postWebBridge(args, 'cdp', {
    method: 'Input.dispatchMouseEvent',
    params: {
      type,
      x,
      y,
      ...extra,
    },
  });
  const error = getToolError(response);
  if (response.error || error) return { ok: false, reason: response.error || error };
  return { ok: true };
}

async function dragAliExpressVerificationSlider(args) {
  const target = await findAliExpressVerificationSlider(args);
  if (!target.ok) return { ok: false, target, reason: target.reason || 'verification_slider_target_not_found' };
  const steps = 18;
  const startX = target.startX;
  const startY = target.startY;
  await dispatchMouse(args, 'mouseMoved', startX, startY, { button: 'none' });
  const pressed = await dispatchMouse(args, 'mousePressed', startX, startY, { button: 'left', buttons: 1, clickCount: 1 });
  if (!pressed.ok) return { ok: false, target, reason: pressed.reason };
  for (let step = 1; step <= steps; step += 1) {
    const ratio = step / steps;
    const eased = 1 - Math.pow(1 - ratio, 2);
    const x = Math.round(startX + target.distance * eased);
    const y = Math.round(startY + Math.sin(ratio * Math.PI) * 2);
    const moved = await dispatchMouse(args, 'mouseMoved', x, y, { button: 'left', buttons: 1 });
    if (!moved.ok) return { ok: false, target, reason: moved.reason };
    await waitMs(35);
  }
  const released = await dispatchMouse(args, 'mouseReleased', target.endX, startY, { button: 'left', buttons: 0, clickCount: 1 });
  if (!released.ok) return { ok: false, target, reason: released.reason };
  await waitMs(args.verificationSliderWaitMs || 0);
  return { ok: true, target };
}

async function tryResolveAliExpressVerification(args, url, readDetail) {
  const maxAttempts = Math.max(1, Math.min(Number(args.verificationSliderMaxAttempts) || 1, 3));
  const attempts = [];
  let latestDetail = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const drag = await dragAliExpressVerificationSlider(args);
    attempts.push({
      attempt,
      ok: Boolean(drag.ok),
      reason: drag.reason || '',
      targetFound: Boolean(drag.target && drag.target.ok),
    });
    if (!drag.ok) break;
    const reread = await readDetail();
    if (!reread.ok) {
      attempts[attempts.length - 1].rereadReason = reread.reason || '';
      continue;
    }
    latestDetail = reread.detail;
    if (!isDetailVerification(latestDetail, url)) {
      return { resolved: true, detail: latestDetail, attempts };
    }
  }
  return { resolved: false, detail: latestDetail, attempts };
}

function summarizeDetailPageOpenAttempt(detail, openAttempt) {
  return {
    openAttempt,
    status: detail.status || '',
    ok: Boolean(detail.ok),
    url: detail.url || '',
    reason: detail.reason || '',
    sliderAttempted: Boolean(detail.sliderAttempted),
    sliderAttempts: detail.sliderAttempts || [],
  };
}

async function captureAliExpressDetailPageAttempt(args, url, titleHint = '', openAttempt = 1) {
  const page = await postWebBridge(args, 'navigate', {
    url,
    newTab: true,
    group_title: 'AliExpress详情页证据',
  });
  const navError = getToolError(page);
  if (page.error || navError) {
    return {
        ok: false,
        url,
        titleHint,
        openAttempt,
        status: 'detail_page_navigation_failed',
        reason: page.error || navError,
        raw: page.data || null,
    };
  }
  try {
    await waitMs(args.detailPageWaitMs || 0);
    const firstRead = await readCurrentAliExpressDetailPage(args);
    if (!firstRead.ok || !firstRead.detail) {
      return {
        ok: false,
        url,
        titleHint,
        openAttempt,
        status: 'detail_page_read_failed',
        reason: firstRead.reason || 'detail_page_parse_failed',
        raw: firstRead.raw || null,
      };
    }
    let detail = firstRead.detail;
    let sliderResolution = null;
    if (isDetailVerification(detail, url) && args.resolveVerificationSlider) {
      sliderResolution = await tryResolveAliExpressVerification(
        args,
        detail.href || url,
        () => readCurrentAliExpressDetailPage(args),
      );
      if (sliderResolution.resolved && sliderResolution.detail) detail = sliderResolution.detail;
    }
    if (isDetailVerification(detail, url)) {
      return {
        ok: false,
        url: detail.href || url,
        titleHint,
        openAttempt,
        title: detail.title || '',
        status: 'aliexpress_verification_required',
        reason: 'AliExpress detail page requires human verification',
        sliderAttempted: Boolean(sliderResolution),
        sliderAttempts: sliderResolution ? sliderResolution.attempts : [],
      };
    }
    return {
      ok: Boolean(compactText(detail.typeValue)),
      url: detail.href || url,
      titleHint,
      openAttempt,
      title: detail.title || '',
      typeName: compactText(detail.typeName),
      typeValue: compactText(detail.typeValue),
      detailCategoryId: compactText(detail.detailCategoryId),
      detailCategoryName: compactText(detail.detailCategoryName),
      detailCategoryPath: compactText(detail.detailCategoryPath),
      detailCategoryIds: Array.isArray(detail.detailCategoryIds) ? detail.detailCategoryIds.map(compactText).filter(Boolean) : [],
      detailCategoryNames: Array.isArray(detail.detailCategoryNames) ? detail.detailCategoryNames.map(compactText).filter(Boolean) : [],
      detailBreadcrumbs: Array.isArray(detail.detailBreadcrumbs) ? detail.detailBreadcrumbs.map(compactText).filter(Boolean) : [],
      specs: detail.specs || [],
      status: compactText(detail.typeValue) ? 'detail_type_read' : 'detail_type_missing',
      reason: compactText(detail.typeValue) ? '' : 'detail page type/category field was not readable',
      sliderAttempted: Boolean(sliderResolution),
      sliderAttempts: sliderResolution ? sliderResolution.attempts : [],
    };
  } finally {
    await postWebBridge(args, 'close_tab', {});
  }
}

async function captureAliExpressDetailPage(args, url, titleHint = '') {
  const maxReopens = args.resolveVerificationSlider
    ? Math.max(0, Math.min(Number(args.verificationPageReopenAttempts) || 0, 2))
    : 0;
  const openAttempts = [];
  let lastDetail = null;
  for (let openAttempt = 1; openAttempt <= maxReopens + 1; openAttempt += 1) {
    const detail = await captureAliExpressDetailPageAttempt(args, url, titleHint, openAttempt);
    lastDetail = detail;
    openAttempts.push(summarizeDetailPageOpenAttempt(detail, openAttempt));
    if (detail.status !== 'aliexpress_verification_required') {
      return {
        ...detail,
        reopenedAfterVerification: openAttempt > 1,
        detailPageOpenAttempts: openAttempts,
      };
    }
    if (!detail.sliderAttempted) break;
  }
  return {
    ...lastDetail,
    reopenedAfterVerification: openAttempts.length > 1,
    detailPageOpenAttempts: openAttempts,
    reason: openAttempts.length > 1
      ? 'AliExpress detail page still requires verification after reopening and retrying slider'
      : lastDetail.reason,
  };
}

async function captureDetailEvidenceForSnapshot(args, snapshot, scored) {
  if (!shouldCaptureDetailEvidence(scored, args)) return null;
  const required = 2;
  const maxToCheck = Math.max(required, Math.min(Number(args.detailPages) || 2, 5));
  const candidates = pickRepresentativeProductLinks(snapshot, args).slice(0, maxToCheck);
  if (candidates.length < required) {
    return {
      ok: false,
      status: 'detail_evidence_missing',
      required,
      checked: 0,
      matched: 0,
      reason: `Need ${required} representative AliExpress product detail links, found ${candidates.length}`,
      items: [],
    };
  }
  const items = [];
  const verificationUrls = [];
  for (const candidate of candidates) {
    const detail = await captureAliExpressDetailPage(args, candidate.href, candidate.title);
    if (detail.status === 'aliexpress_verification_required') {
      verificationUrls.push(detail.url);
      items.push(detail);
      continue;
    }
    items.push(detail);
    const readable = items.filter((item) => item.ok && compactText(item.typeValue));
    const consensusCounts = {};
    readable.forEach((item) => {
      const normalized = normalizeDetailConsensusItem(item, args);
      if (!normalized.key) return;
      consensusCounts[normalized.key] = (consensusCounts[normalized.key] || 0) + 1;
    });
    if (Object.values(consensusCounts).some((count) => count >= required)) break;
  }
  const readable = items.filter((item) => item.ok && compactText(item.typeValue));
  const grouped = readable.reduce((acc, item) => {
    const normalized = normalizeDetailConsensusItem(item, args);
    const key = normalized.key;
    if (!key) return acc;
    if (!acc[key]) acc[key] = { type: normalized.type || item.typeValue, items: [] };
    acc[key].items.push(item);
    return acc;
  }, {});
  const best = Object.values(grouped).sort((a, b) => b.items.length - a.items.length)[0] || null;
  if (best && best.items.length >= required) {
    return {
      ok: true,
      status: 'detail_verified',
      required,
      checked: items.length,
      matched: best.items.length,
      consensusType: best.type,
      verificationUrls,
      items: best.items,
      allItems: items,
    };
  }
  if (verificationUrls.length) {
    return {
      ok: false,
      status: 'aliexpress_verification_required',
      required,
      checked: items.length,
      matched: best ? best.items.length : 0,
      consensusType: best ? best.type : '',
      verificationUrls,
      items,
      reason: 'AliExpress detail-page verification is required before enough type evidence can be read',
    };
  }
  return {
    ok: false,
    status: 'detail_evidence_missing',
    required,
    checked: items.length,
    matched: best ? best.items.length : 0,
    consensusType: best ? best.type : '',
    items,
    reason: `Need ${required} matching AliExpress detail-page type values`,
  };
}

function persistIfRequested(args, record) {
  const normalized = {
    ...record,
    status: VERIFIED_STATUSES.has(record.status) ? record.status : record.status,
  };
  if (!args.write) return { written: false, record: normalized };
  return { written: true, record: upsertEvidence(normalized, args.storePath) };
}

function compactCaptureResult(result) {
  const record = result.record || {};
  const detailEvidence = record.detailEvidence || null;
  return {
    ok: result.ok,
    written: result.written,
    asin: record.asin || '',
    status: record.status || '',
    dxmCandidateCategory: record.dxmCandidateCategory || '',
    aliexpressCategoryId: record.aliexpressCategoryId || '',
    aliexpressDetailCategoryName: record.aliexpressDetailCategoryName || '',
    aliexpressDetailCategoryPath: record.aliexpressDetailCategoryPath || '',
    aliexpressUniqueCategoryConfirmed: Boolean(record.aliexpressUniqueCategoryConfirmed),
    evidenceConfidence: record.evidenceConfidence,
    confidenceTier: record.confidenceTier || '',
    verificationMode: record.verificationMode || '',
    blockers: VERIFIED_STATUSES.has(record.status) ? [] : [record.status || 'unverified'],
    detailEvidence: detailEvidence ? {
      ok: Boolean(detailEvidence.ok),
      status: detailEvidence.status || '',
      required: detailEvidence.required,
      checked: detailEvidence.checked,
      matched: detailEvidence.matched,
      consensusType: detailEvidence.consensusType || '',
      uniqueCategory: getDetailUniquePlatformCategory(detailEvidence),
      reason: detailEvidence.reason || '',
      verificationUrls: detailEvidence.verificationUrls || [],
      items: (detailEvidence.items || []).map((item) => ({
        ok: Boolean(item.ok),
        status: item.status || '',
        typeName: item.typeName || '',
        typeValue: item.typeValue || '',
        detailCategoryId: item.detailCategoryId || '',
        detailCategoryName: item.detailCategoryName || '',
        detailCategoryPath: item.detailCategoryPath || '',
        url: item.url || '',
        reason: item.reason || '',
        sliderAttempted: Boolean(item.sliderAttempted),
        sliderAttempts: item.sliderAttempts || [],
        reopenedAfterVerification: Boolean(item.reopenedAfterVerification),
        detailPageOpenAttempts: item.detailPageOpenAttempts || [],
      })),
    } : null,
    evidenceSummary: record.evidenceSummary || '',
    reason: record.reason || '',
  };
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.command === 'help') {
    output(usage());
    return;
  }
  if (args.command === 'open') {
    output(await openAliExpressSearch(args));
    return;
  }
  if (args.command === 'capture') {
    const captured = await captureCurrentAliExpressPage(args);
    if (!captured.ok) {
      output(captured);
      return;
    }
    const scored = scoreEvidence(captured.snapshot, args);
    const detailEvidence = await captureDetailEvidenceForSnapshot(args, captured.snapshot, scored);
    const record = applyDetailEvidenceWithArgs(buildEvidenceRecordFromSnapshot(args, captured.snapshot), detailEvidence, args);
    const result = { ok: true, snapshot: captured.snapshot, ...persistIfRequested(args, record) };
    output(args.compactOutput ? compactCaptureResult(result) : result);
    return;
  }
  if (args.command === 'from-resolver') {
    const record = buildEvidenceRecordFromResolver(args);
    output({ ok: true, ...persistIfRequested({ ...args, write: true }, record) });
    return;
  }
  if (args.command === 'manual') {
    const record = buildManualRecord(args);
    output({ ok: true, ...persistIfRequested({ ...args, write: true }, record) });
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
  applyDetailEvidence,
  applyDetailEvidenceWithArgs,
  buildEvidenceRecordFromResolver,
  buildEvidenceRecordFromSnapshot,
  buildManualRecord,
  captureDetailEvidenceForSnapshot,
  getDetailUniquePlatformCategory,
  isValidDetailTypeConsensusValue,
  scoreEvidence,
};
