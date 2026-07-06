#!/usr/bin/env node
'use strict';

const assert = require('assert');
const policy = require('./aliexpress-evidence-policy');
const capture = require('./aliexpress-evidence-capture');

const checks = {
  usageAndFormConsistent: true,
  noObviousConflict: true,
  nonRiskCategory: true,
  semanticConsensus: { ok: true, family: 'test-family' },
};
const thresholds = {
  highConfidenceTopShare: 0.8,
  directPassTopShare: 0.5,
  semanticConsensusTitleRatio: 0.6,
  detailEvidencePages: 2,
  maxDetailEvidencePages: 5,
};

assert.strictEqual(
  policy.classifyEvidenceConfidence(0.5, true, checks, thresholds).status,
  'conditional_verified'
);
assert.strictEqual(
  policy.classifyEvidenceConfidence(0.49, true, checks, thresholds).status,
  'dxm_category_validation_required'
);
assert.strictEqual(
  policy.classifyEvidenceConfidence(0.5, false, checks, thresholds).status,
  'dxm_category_validation_required'
);
assert.strictEqual(
  policy.shouldCaptureDetailEvidence({ topShare: 0.49, conditionalChecks: checks }, { detailPages: 2 }, thresholds),
  true
);
assert.strictEqual(
  policy.shouldCaptureDetailEvidence({ topShare: 0.38, topCategoryId: '100003327', conditionalChecks: checks }, { detailPages: 2 }, thresholds),
  false
);
assert.strictEqual(
  policy.shouldCaptureDetailEvidence(
    { topShare: 0.38, conditionalChecks: { ...checks, semanticConsensus: { ok: false, family: 'test-family' } } },
    { detailPages: 2 },
    thresholds
  ),
  true
);
assert.strictEqual(
  policy.shouldCaptureDetailEvidence({ topShare: 0.5, conditionalChecks: checks }, { detailPages: 2 }, thresholds),
  false
);

const detailFailed = capture.applyDetailEvidence({
  asin: 'B0TEST0000',
  status: 'evidence_split',
  confidenceTier: 'below_threshold',
  evidenceSummary: 'search summary',
}, {
  ok: false,
  status: 'detail_evidence_missing',
  reason: 'no readable detail type',
});
assert.strictEqual(detailFailed.status, 'evidence_split');
assert.strictEqual(detailFailed.verificationMode, 'detail_inconclusive_no_category_confirmation');

const verificationAfterSearchConsensus = capture.applyDetailEvidence({
  asin: 'B0TEST0001',
  status: 'dxm_category_validation_required',
  confidenceTier: 'detail_or_dxm_validation_required',
  evidenceSummary: 'search summary',
  conditionalChecks: {
    semanticConsensus: { ok: true, family: 'faucet-mat-splash-guard' },
  },
}, {
  ok: false,
  status: 'aliexpress_verification_required',
  reason: 'detail pages require verification',
  verificationUrls: ['https://www.aliexpress.com/item/example.html'],
  items: [
    {
      status: 'aliexpress_verification_required',
      url: 'https://www.aliexpress.com/item/example.html',
      sliderAttempted: true,
      sliderAttempts: [{ attempt: 1, ok: false, reason: 'verification_slider_handle_not_found' }],
    },
  ],
});
assert.strictEqual(verificationAfterSearchConsensus.status, 'semantic_consensus_needs_dxm_mapping');
assert.strictEqual(verificationAfterSearchConsensus.verificationMode, 'search_consensus_dxm_mapping_required');
assert.strictEqual(verificationAfterSearchConsensus.detailVerificationBlocked, true);
assert.strictEqual(verificationAfterSearchConsensus.detailSliderAttempted, true);
assert.strictEqual(verificationAfterSearchConsensus.detailVerificationBlockedUrls[0], 'https://www.aliexpress.com/item/example.html');

const verificationWithoutSearchConsensus = capture.applyDetailEvidence({
  asin: 'B0TEST0003',
  status: 'evidence_split',
  confidenceTier: 'below_threshold',
  evidenceSummary: 'search summary',
  conditionalChecks: {
    semanticConsensus: { ok: false, family: 'faucet-mat-splash-guard' },
  },
}, {
  ok: false,
  status: 'aliexpress_verification_required',
  reason: 'detail pages require verification',
  verificationUrls: ['https://www.aliexpress.com/item/blocked.html'],
});
assert.strictEqual(verificationWithoutSearchConsensus.status, 'aliexpress_verification_required');
assert.strictEqual(verificationWithoutSearchConsensus.detailVerificationBlocked, true);

const faucetSearchRecord = capture.buildEvidenceRecordFromSnapshot({
  asin: 'B0TEST0002',
  query: 'faucet mat splash guard',
  productFamily: 'faucet mat splash guard',
  amazonUrl: 'https://www.amazon.com/dp/B0TEST0002',
}, {
  href: 'https://www.aliexpress.com/w/wholesale-faucet-mat-splash-guard.html',
  query: 'faucet mat splash guard',
  resultCount: 8,
  postCategoryIds: ['100003261', '100003261', '100003261', '2001', '2002', '2003', '2004', '2005'],
  titles: [
    'Kitchen Faucet Splash Pad Silicone Sink Splash Guard',
    'Silicone Faucet Mat for Sink Splash Guard',
    '水龙头防溅垫 硅胶水槽接水垫',
    '厨房水槽防溅垫 水龙头沥水垫',
    'Faucet Mat Splash Guard for Kitchen Sink',
    'Silicone Water Control Drain Pad Faucet Mat',
    '水槽水龙头接水垫 防溅排水垫',
    'Kitchen sink splash guard faucet mat',
  ],
});
assert.strictEqual(faucetSearchRecord.status, 'semantic_consensus_needs_dxm_mapping');
assert.strictEqual(faucetSearchRecord.reason, 'aliexpress_category_confirmed_but_dxm_mapping_missing');
assert.strictEqual(faucetSearchRecord.aliexpressUniqueCategoryConfirmed, true);
assert.strictEqual(faucetSearchRecord.platformCategoryConfirmed, true);
assert.strictEqual(faucetSearchRecord.platformCategoryIntent, 'faucet-mat-splash-guard');
assert(faucetSearchRecord.platformCategoryTerms.includes('faucet mat'));
assert.deepStrictEqual(faucetSearchRecord.dxmSearchTerms, []);
assert(/platform category confirmed/.test(faucetSearchRecord.evidenceSummary));

const detailVerifiedWithSearchTerms = capture.applyDetailEvidence(faucetSearchRecord, {
  ok: true,
  status: 'detail_verified',
  required: 2,
  matched: 2,
  checked: 3,
  consensusType: '飞溅屏幕',
  items: [
    { url: 'https://www.aliexpress.com/item/one.html', typeValue: '飞溅屏幕' },
    { url: 'https://www.aliexpress.com/item/two.html', typeValue: '飞溅屏幕' },
  ],
});
assert.strictEqual(detailVerifiedWithSearchTerms.status, 'semantic_consensus_needs_dxm_mapping');
assert.strictEqual(detailVerifiedWithSearchTerms.dxmCandidateCategory || '', '');
assert.deepStrictEqual(detailVerifiedWithSearchTerms.dxmSearchTerms, []);

const detailUniqueCategory = capture.getDetailUniquePlatformCategory({
  items: [
    {
      ok: true,
      url: 'https://www.aliexpress.com/item/one.html',
      detailCategoryId: '200231151',
      detailCategoryName: 'Kitchen Drains & Strainers',
      detailCategoryPath: 'Home Improvement/Kitchen Fixture/Kitchen Drains & Strainers',
    },
    {
      ok: true,
      url: 'https://www.aliexpress.com/item/two.html',
      detailCategoryId: '200231151',
      detailCategoryName: 'Kitchen Drains & Strainers',
      detailCategoryPath: 'Home Improvement/Kitchen Fixture/Kitchen Drains & Strainers',
    },
  ],
});
assert.strictEqual(detailUniqueCategory.id, '200231151');

const footerNoiseUniqueCategory = capture.getDetailUniquePlatformCategory({
  items: [
    {
      ok: true,
      url: 'https://www.aliexpress.com/item/noise-one.html',
      detailCategoryName: 'Recalls,',
      detailCategoryPath: 'Recalls,',
    },
    {
      ok: true,
      url: 'https://www.aliexpress.com/item/noise-two.html',
      detailCategoryName: 'Recalls,',
      detailCategoryPath: 'Recalls,',
    },
  ],
});
assert.strictEqual(footerNoiseUniqueCategory, null);

assert.strictEqual(
  capture.isValidDetailTypeConsensusValue('All Popular, Product, Promotion, Low Price, Great Value, Rev'),
  false
);

const detailVerifiedWithMappedUniqueCategory = capture.applyDetailEvidenceWithArgs(faucetSearchRecord, {
  ok: true,
  status: 'detail_verified',
  required: 2,
  matched: 2,
  checked: 2,
  consensusType: 'Kitchen Drains & Strainers',
  items: [
    {
      ok: true,
      url: 'https://www.aliexpress.com/item/one.html',
      typeValue: 'Kitchen Drains & Strainers',
      detailCategoryId: '200231151',
      detailCategoryName: 'Kitchen Drains & Strainers',
      detailCategoryPath: 'Home Improvement/Kitchen Fixture/Kitchen Drains & Strainers',
    },
    {
      ok: true,
      url: 'https://www.aliexpress.com/item/two.html',
      typeValue: 'Kitchen Drains & Strainers',
      detailCategoryId: '200231151',
      detailCategoryName: 'Kitchen Drains & Strainers',
      detailCategoryPath: 'Home Improvement/Kitchen Fixture/Kitchen Drains & Strainers',
    },
  ],
}, {});
assert.strictEqual(detailVerifiedWithMappedUniqueCategory.status, 'detail_verified');
assert.strictEqual(detailVerifiedWithMappedUniqueCategory.aliexpressCategoryId, '200231151');
assert(detailVerifiedWithMappedUniqueCategory.dxmCandidateCategory.includes('Kitchen Drains & Strainers'));

process.stdout.write('aliexpress-evidence-policy.test.js passed\n');
