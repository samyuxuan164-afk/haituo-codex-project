#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { textRules } = require('../src/dxm-automation-core');

assert.strictEqual(
  textRules.sanitizePlatformText('Size 4.625" with smart "quote" and 3 in. label'),
  'Size 4.625 inch with smart quote and 3 inch label'
);

assert.deepStrictEqual(
  textRules.findPlatformTextIssues('4.625" and 3 in.'),
  ['contains_quote_or_dimension_symbol', 'contains_abbreviated_in_dot']
);

const brandedItem = {
  title: 'ACME Plastic Drawer Organizer for Desk',
  brand: 'ACME',
  categoryTerm: 'desk storage',
};

assert.strictEqual(
  textRules.buildCompliantProductTitle(brandedItem.title, brandedItem).includes('ACME'),
  false
);
assert(textRules.buildCompliantProductTitle(brandedItem.title, brandedItem).length <= 80);

const description = textRules.buildCompliantPcDescription(brandedItem, brandedItem.title, {
  titleMaxChars: 80,
  pcDescriptionMinChars: 500,
});
assert(description.length >= 500);
assert.strictEqual(/ACME|Amazon|best seller/i.test(description), false);

const { pricingRules } = require('../src/dxm-automation-core');
const { parseDisplayedPrice } = require('./amazon-displayed-price-capture');

assert.strictEqual(pricingRules.calculateSupplyPriceCny(13.97, 6.8, 1.4), '132.99');
assert.strictEqual(pricingRules.calculateSupplyPriceCny('$8.99 - $12.99', 1, 1), '12.99');
assert.strictEqual(
  pricingRules.calculateSupplyPriceCny('$8.99 - $12.99', 1, 1, { rangePolicy: 'highest_displayed_value' }),
  '12.99'
);
assert.strictEqual(
  pricingRules.calculateSupplyPriceCny('Price $19.94 List Price: $20.99', 1, 1),
  '20.99'
);
assert.strictEqual(
  pricingRules.calculateSupplyPriceCny(50, 7, { multiplier: 1.55, tiers: [{ minUsd: 20, multiplier: 1.35 }] }),
  '472.5'
);
assert.strictEqual(parseDisplayedPrice('$8.99 - $12.99').amazonDisplayedPriceUsd, 12.99);
assert.strictEqual(
  parseDisplayedPrice('$8.99 - $12.99', { rangePolicy: 'median_displayed_value' }).reason,
  'price_range_policy_invalid'
);
assert.strictEqual(
  parseDisplayedPrice('$8.99 - $12.99', { rangePolicy: 'highest_displayed_value' }).amazonDisplayedPriceUsd,
  12.99
);
assert.strictEqual(
  parseDisplayedPrice('Price $19.94 List Price: $20.99').amazonDisplayedPriceUsd,
  20.99
);
assert.strictEqual(pricingRules.priceEqualsExpected('151.570', '151.57'), true);
assert.deepStrictEqual(
  pricingRules.parseDimensionInches('Product Dimensions 4.5 x 3 x 2 inches'),
  { length: 4.5, width: 3, height: 2 }
);
assert.deepStrictEqual(
  pricingRules.dimensionsInToCm({ length: 4.5, width: 3, height: 2 }),
  { length: 11.43, width: 7.62, height: 5.08 }
);
assert.strictEqual(pricingRules.parseWeightKg('Item Weight 8 ounces'), '0.23');

const { pcDetailRules } = require('../src/dxm-automation-core');

const detailHtml = pcDetailRules.buildPcDetailWeb(
  'Key Details:\n- Easy to clean\n- Made for storage',
  ['https://img.example.com/a.jpg?x=1', 'data:image/png;base64,skip', 'https://img.example.com/logo.png', 'https://img.example.com/b.jpg'],
  'Safe Product'
);
assert(detailHtml.indexOf('<img') < detailHtml.indexOf('<h3>Key Details</h3>'));
assert.strictEqual(pcDetailRules.getDetailWebImageUrls(detailHtml).length, 2);
assert.deepStrictEqual(
  pcDetailRules.analyzePcDetailWebImages(detailHtml, ['https://img.example.com/a.jpg', 'https://img.example.com/b.jpg']),
  { imageCount: 2, currentProductImageCount: 2, leadingImageCount: 2, required: 2 }
);

const { workflowDiagnostics } = require('../src/dxm-automation-core');

const targetAsins = [
  'B0F2H4PF7R',
  'B0DPSVFQFW',
  'B0FRNMSG2Z',
  'B0BHMYH8GR',
  'B0GH7NDP4J',
  'B0CYT44JRK',
  'B0DNLYDFCF',
  'B07T3L3TV1',
  'B08S7BGF4C',
  'B0D5H7MZ63',
];
const crawlboxRows = [
  { asin: 'B0F2H4PF7R', priceUsd: '12.99' },
  { asin: 'B0DPSVFQFW', priceUsd: '9.49' },
  { asin: 'B0FRNMSG2Z', priceUsd: '16.99' },
  { asin: 'B0BHMYH8GR', priceUsd: '7.59' },
  { asin: 'B0GH7NDP4J', priceUsd: '11.99' },
  { asin: 'B0CYT44JRK', priceUsd: '18.49' },
  { asin: 'B0DNLYDFCF', priceUsd: '6.99' },
  { asin: 'B07T3L3TV1', priceUsd: '0.00' },
  { asin: 'B08S7BGF4C', priceUsd: '0.00' },
  { asin: 'B0D5H7MZ63', priceUsd: '0.00' },
  { asin: 'B0F2H4PF7R', priceUsd: '12.99' },
  { asin: 'B0DPSVFQFW', priceUsd: '9.49' },
  { asin: 'B0FRNMSG2Z', priceUsd: '16.99' },
  { asin: 'B07T3L3TV1', priceUsd: '0.00' },
  { asin: 'B08S7BGF4C', priceUsd: '0.00' },
  { asin: 'B0D5H7MZ63', priceUsd: '0.00' },
];

const crawlboxDiagnosis = workflowDiagnostics.analyzeCrawlboxBatch({
  targetAsins,
  rows: crawlboxRows,
  priceRange: { min: 5, max: 20 },
});
assert.strictEqual(crawlboxDiagnosis.targetCount, 10);
assert.strictEqual(crawlboxDiagnosis.rowCount, 16);
assert.strictEqual(crawlboxDiagnosis.duplicateRowCount, 6);
assert.deepStrictEqual(crawlboxDiagnosis.invalidPriceAsins, ['B07T3L3TV1', 'B08S7BGF4C', 'B0D5H7MZ63']);
assert.deepStrictEqual(crawlboxDiagnosis.safeClaimAsins, targetAsins.slice(0, 7));
assert.deepStrictEqual(crawlboxDiagnosis.rootCauses, ['crawlbox_duplicate_rows', 'price_out_of_range_or_zero']);

const editPreflightDiagnosis = workflowDiagnostics.analyzeEditPreflightReadback({
  asin: 'B0F2H4PF7R',
  safeToSaveToWaitPublish: false,
  preflightPass: false,
  blockers: [
    'AliExpress category evidence required: category_evidence_missing',
    'product category is not selected',
    'postage template is not 111: --- 请选择运费模板 ---',
    'ships from is not United States: empty',
  ],
});
assert.strictEqual(editPreflightDiagnosis.stage, 'edit_preflight_blocked');
assert.strictEqual(editPreflightDiagnosis.saveAllowed, false);
assert.strictEqual(editPreflightDiagnosis.rootCause, 'category_evidence_missing');
assert.deepStrictEqual(editPreflightDiagnosis.normalizedBlockers, [
  'category_evidence_missing',
  'product_category_not_selected',
  'postage_template_not_111',
  'ships_from_not_united_states',
]);
assert.strictEqual(editPreflightDiagnosis.nextAction, 'run_aliexpress_category_verification_before_save');

const { businessGates } = require('../src/dxm-automation-core');

const crawlboxGate = businessGates.evaluateCrawlboxClaimGate({
  targetAsins,
  rows: crawlboxRows,
  priceRange: { min: 5, max: 20 },
});
assert.strictEqual(crawlboxGate.allowed, false);
assert.deepStrictEqual(crawlboxGate.blockers, ['crawlbox_duplicate_rows', 'price_out_of_range_or_zero']);
assert.deepStrictEqual(crawlboxGate.normalized.safeClaimAsins, targetAsins.slice(0, 7));
assert.strictEqual(crawlboxGate.nextAction, 'skip_or_confirm_price_range_exception');

const categoryMissingGate = businessGates.evaluateCategoryEvidenceGate({
  status: 'missing',
  dxmCandidateCategory: '',
});
assert.strictEqual(categoryMissingGate.allowed, false);
assert.deepStrictEqual(categoryMissingGate.blockers, ['category_evidence_missing']);

const categoryVerifiedGate = businessGates.evaluateCategoryEvidenceGate({
  status: 'conditional_verified',
  confidenceTier: 'low_confidence',
  dxmCandidateCategory: 'Home & Garden > Storage Boxes & Bins',
});
assert.strictEqual(categoryVerifiedGate.allowed, true);
assert.deepStrictEqual(categoryVerifiedGate.blockers, []);

const safeAdjacentWithoutDxmGate = businessGates.evaluateCategoryEvidenceGate({
  status: 'conditional_verified',
  confidenceTier: 'low_confidence',
  safeAdjacentAllowed: true,
});
assert.strictEqual(safeAdjacentWithoutDxmGate.allowed, false);
assert.deepStrictEqual(safeAdjacentWithoutDxmGate.blockers, ['aliexpress_dxm_category_map_missing']);

const missingPriceGate = businessGates.evaluatePriceGate({
  asin: 'B0F2H4PF7R',
  status: 'missing',
  trusted: false,
  sourcePriceUsd: '',
  exchangeRate: 7,
  multiplier: 1.55,
});
assert.strictEqual(missingPriceGate.allowed, false);
assert.deepStrictEqual(missingPriceGate.blockers, ['amazon_displayed_price_missing']);

const formulaPriceGate = businessGates.evaluatePriceGate({
  asin: 'B0F2H4PF7R',
  status: 'trusted',
  trusted: true,
  sourcePriceUsd: 12.99,
  exchangeRate: '',
  multiplier: 1.55,
});
assert.strictEqual(formulaPriceGate.allowed, false);
assert.deepStrictEqual(formulaPriceGate.blockers, ['price_formula_missing_exchange_rate_or_multiplier']);

const readyPriceGate = businessGates.evaluatePriceGate({
  asin: 'B0F2H4PF7R',
  status: 'trusted',
  trusted: true,
  sourcePriceUsd: 12.99,
  exchangeRate: 7,
  multiplier: 1.55,
  priceRange: { min: 5, max: 20 },
});
assert.strictEqual(readyPriceGate.allowed, true);
assert.strictEqual(readyPriceGate.normalized.expectedCnyPrice, '140.94');

const uncoveredTierPriceGate = businessGates.evaluatePriceGate({
  asin: 'B0F2H4PF7R',
  status: 'trusted',
  trusted: true,
  sourcePriceUsd: 12.99,
  exchangeRate: 7,
  multiplier: { tiers: [{ minUsd: 20, multiplier: 1.35 }] },
});
assert.strictEqual(uncoveredTierPriceGate.allowed, false);
assert.deepStrictEqual(uncoveredTierPriceGate.blockers, ['price_formula_missing_exchange_rate_or_multiplier']);
assert.strictEqual(uncoveredTierPriceGate.normalized.expectedCnyPrice, '');

assert.strictEqual(businessGates.evaluateTemplateGate({ selectedText: '--- 请选择运费模板 ---' }).allowed, false);
assert.deepStrictEqual(
  businessGates.evaluateTemplateGate({ selectedText: '--- 请选择运费模板 ---' }).blockers,
  ['postage_template_not_111']
);
assert.strictEqual(businessGates.evaluateTemplateGate({ selectedText: '111' }).allowed, true);

assert.strictEqual(businessGates.evaluateShipsFromGate({ selectedText: '中国大陆(Mainland China)' }).allowed, false);
assert.deepStrictEqual(
  businessGates.evaluateShipsFromGate({ selectedText: '中国大陆(Mainland China)' }).blockers,
  ['ships_from_not_united_states']
);
assert.strictEqual(businessGates.evaluateShipsFromGate({ selectedText: '美国(United States)' }).allowed, true);
assert.strictEqual(businessGates.evaluateShipsFromGate({ origin: 'United States' }).allowed, false);

const editSaveGate = businessGates.evaluateEditSaveGate({
  categoryEvidence: categoryVerifiedGate,
  price: readyPriceGate,
  freight: businessGates.evaluateTemplateGate({ selectedText: '111' }),
  shipsFrom: businessGates.evaluateShipsFromGate({ selectedText: 'United States' }),
  preflightBlockers: [],
});
assert.strictEqual(editSaveGate.allowed, true);
assert.strictEqual(editSaveGate.nextAction, 'save_to_wait_publish_only_after_final_visible_confirmation');

const blockedEditSaveGate = businessGates.evaluateEditSaveGate({
  categoryEvidence: categoryMissingGate,
  price: readyPriceGate,
  freight: businessGates.evaluateTemplateGate({ selectedText: '--- 请选择运费模板 ---' }),
  shipsFrom: businessGates.evaluateShipsFromGate({ selectedText: '' }),
  preflightBlockers: ['product category is not selected'],
});
assert.strictEqual(blockedEditSaveGate.allowed, false);
assert.deepStrictEqual(blockedEditSaveGate.blockers, [
  'category_evidence_missing',
  'postage_template_not_111',
  'ships_from_not_united_states',
  'product_category_not_selected',
]);
assert.strictEqual(blockedEditSaveGate.nextAction, 'run_aliexpress_category_verification_before_save');

process.stdout.write('dxm-automation-core.test.js passed\n');
