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

assert.strictEqual(pricingRules.calculateSupplyPriceCny(13.97, 7, 1.55), '151.57');
assert.strictEqual(pricingRules.calculateSupplyPriceCny('$8.99 - $12.99', 7, 1.55), '140.94');
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

process.stdout.write('dxm-automation-core.test.js passed\n');
