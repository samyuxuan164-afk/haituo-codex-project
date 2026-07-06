# Userscript Pure Modules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract deterministic logic from the main Dianxiaomi userscript into Node-testable pure modules while preserving the installed single-file userscript behavior.

**Architecture:** Add CommonJS modules under `src/dxm-automation-core/` and a Node `assert` test runner under `tools/`. The first phase keeps DOM/page automation in `src/dianxiaomi-automation-v1-merged-new.user.js` unchanged, so no live Dianxiaomi behavior changes while pure logic gains tests.

**Tech Stack:** JavaScript CommonJS, Node built-in `assert`, existing `node --check` verification, Markdown project docs.

---

## File Structure

- Create `src/dxm-automation-core/text-rules.js`: pure text cleanup, title, brand, and description helpers.
- Create `src/dxm-automation-core/pricing-rules.js`: pure numeric parsing, price formula, dimensions, and weight helpers.
- Create `src/dxm-automation-core/pc-detail-rules.js`: pure PC detail HTML and image analysis helpers that do not require `document`.
- Create `src/dxm-automation-core/index.js`: one CommonJS export surface for tests and future userscript build work.
- Create `tools/dxm-automation-core.test.js`: hand-written Node `assert` tests.
- Modify `docs/current-status.md`: add module split status and safety boundary.
- Modify `docs/test-plan.md`: add the new explicit pure-module test command.
- Modify `docs/test-results.md`: record verification results.
- Modify `README.md` and `README.zh-CN.md`: update the local verification command list if it still claims only one explicit `.test.js` file.
- Modify `DEVELOPMENT_LOG.md`: add a concise implementation and verification entry.

## Task 1: Add Text Rules Module And Tests

**Files:**

- Create: `src/dxm-automation-core/text-rules.js`
- Create: `src/dxm-automation-core/index.js`
- Create: `tools/dxm-automation-core.test.js`

- [ ] **Step 1: Write failing text-rule tests**

Add this initial structure to `tools/dxm-automation-core.test.js`:

```javascript
#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { textRules } = require('../src/dxm-automation-core');

assert.strictEqual(
  textRules.sanitizePlatformText('Size 4.625" with smart “quote” and 3 in. label'),
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

process.stdout.write('dxm-automation-core.test.js passed\n');
```

- [ ] **Step 2: Run the test and confirm failure**

Run:

```powershell
node tools\dxm-automation-core.test.js
```

Expected: FAIL because `../src/dxm-automation-core` does not exist.

- [ ] **Step 3: Implement `text-rules.js`**

Create `src/dxm-automation-core/text-rules.js` with these exports:

```javascript
'use strict';

const DEFAULT_EDIT_RULES = Object.freeze({
  titleMaxChars: 80,
  pcDescriptionMinChars: 500,
});

const FORBIDDEN_COMMERCE_TERMS = [
  'amazon',
  'amazon.com',
  'aliexpress',
  'ebay',
  'walmart',
  'temu',
  'shein',
  'tiktok',
  'official',
  'guaranteed',
  'best seller',
  'best-selling',
  'free shipping',
  'limited time',
  'hot sale',
  'premium',
  'perfect',
  'amazing',
  'ultimate',
  'original',
];

function firstNonEmpty(...values) {
  return values.find((value) => value !== undefined && value !== null && String(value).trim() !== '') || '';
}

function escapeRegExp(text) {
  return String(text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function plainTextFromHtml(value) {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeSpaces(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function sanitizePlatformText(text) {
  return String(text || '')
    .replace(/(\d+(?:\.\d+)?)\s*(?:"|″|”|“|＂|''|′′)/g, '$1 inch')
    .replace(/(\d+(?:\.\d+)?)\s*in\.(?=\s|$|<|[),.;:!?])/gi, '$1 inch')
    .replace(/[“”„‟＂"]/g, '')
    .replace(/[′″‘’‚‛]/g, '')
    .replace(/\s+inch\b/gi, ' inch')
    .replace(/\binch\s+inch\b/gi, 'inch');
}

function sanitizePlatformTextDeep(value) {
  if (typeof value === 'string') return sanitizePlatformText(value);
  if (Array.isArray(value)) return value.map((item) => sanitizePlatformTextDeep(item));
  if (value && typeof value === 'object') {
    const output = {};
    for (const [key, item] of Object.entries(value)) output[key] = sanitizePlatformTextDeep(item);
    return output;
  }
  return value;
}

function findPlatformTextIssues(text) {
  const source = String(text || '');
  const issues = [];
  if (/[“”„‟＂"′″‘’‚‛]/.test(source)) issues.push('contains_quote_or_dimension_symbol');
  if (/\d+(?:\.\d+)?\s*in\./i.test(source)) issues.push('contains_abbreviated_in_dot');
  return issues;
}

function truncateAtWord(text, maxLength) {
  const source = normalizeSpaces(text);
  if (source.length <= maxLength) return source;
  const truncated = source.slice(0, maxLength + 1);
  const boundary = truncated.lastIndexOf(' ');
  return normalizeSpaces((boundary > 40 ? truncated.slice(0, boundary) : source.slice(0, maxLength)).replace(/[,\-:;|]+$/g, ''));
}

function toSimpleTitleCase(text) {
  const lowerWords = new Set(['and', 'or', 'for', 'with', 'to', 'of', 'in', 'on', 'by', 'from']);
  return normalizeSpaces(text).split(' ').map((word, index) => {
    const clean = word.toLowerCase();
    if (index > 0 && lowerWords.has(clean)) return clean;
    return clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : '';
  }).join(' ');
}

function collectBrandCandidates(item) {
  const candidates = [];
  if (!item || typeof item !== 'object') return candidates;
  for (const key of ['brand', 'brandName', 'brand_name', 'manufacturer', 'maker', 'sellerName']) {
    if (item[key]) candidates.push(String(item[key]));
  }
  const titleSource = String(firstNonEmpty(item.title, item.subject, ''));
  const titleTokens = normalizeSpaces(titleSource).split(/\s+/).filter(Boolean);
  const firstTitleToken = titleTokens[0] || '';
  const secondTitleToken = titleTokens[1] || '';
  if (/^[A-Z][A-Z0-9&.-]{1,20}$/.test(firstTitleToken)) candidates.push(firstTitleToken);
  if (/^[A-Z][A-Z0-9&.-]{1,20}$/.test(firstTitleToken) && /^[A-Z0-9][A-Z0-9.-]{1,20}$/i.test(secondTitleToken)) {
    candidates.push(`${firstTitleToken} ${secondTitleToken}`);
  }
  return Array.from(new Set(candidates.map((value) => normalizeSpaces(value).replace(/[™®©]/g, '')).filter((value) => value && value.length <= 40)));
}

function stripForbiddenCommerceTerms(text, item) {
  let output = String(text || '').replace(/[™®©]/g, ' ');
  const terms = [...FORBIDDEN_COMMERCE_TERMS, ...collectBrandCandidates(item)].sort((a, b) => String(b).length - String(a).length);
  for (const term of terms) {
    if (!term) continue;
    output = output.replace(new RegExp(`\\b${escapeRegExp(term)}\\b`, 'gi'), ' ');
  }
  return normalizeSpaces(output.replace(/\b(?:brand|trademark|store)\s*(?:name)?\s*[:：][^,\n.;]+/gi, ' '));
}

function findForbiddenTitleTerms(text, item = null) {
  const source = String(text || '').toLowerCase();
  const terms = [...FORBIDDEN_COMMERCE_TERMS, ...collectBrandCandidates(item)];
  return Array.from(new Set(terms
    .map((term) => normalizeSpaces(term).replace(/[™®©]/g, ''))
    .filter(Boolean)
    .filter((term) => source.includes(term.toLowerCase()))));
}

function fallbackProductTitle(item) {
  const source = `${item && item.title ? item.title : ''} ${item && item.categoryTerm ? item.categoryTerm : ''}`.toLowerCase();
  if (source.includes('sink') || source.includes('drain') || source.includes('strainer')) return 'Kitchen Sink Drain Strainer Stopper for Home Use';
  if (source.includes('organizer') || source.includes('storage')) return 'Home Storage Organizer for Everyday Household Use';
  if (source.includes('mat') || source.includes('rug')) return 'Household Mat for Everyday Indoor Use';
  return 'Home Utility Product for Everyday Use';
}

function buildCompliantProductTitle(originalTitle, item, rules = DEFAULT_EDIT_RULES) {
  let title = sanitizePlatformText(firstNonEmpty(originalTitle, item && item.title, fallbackProductTitle(item)));
  for (let attempt = 0; attempt < 4; attempt += 1) {
    title = stripForbiddenCommerceTerms(title, item)
      .replace(/\([^)]*(?:amazon|official|brand|store|trademark)[^)]*\)/gi, ' ')
      .replace(/\[[^\]]*(?:amazon|official|brand|store|trademark)[^\]]*\]/gi, ' ')
      .replace(/\b(?:new|sale|deal|cheap|discount|must-have)\b/gi, ' ')
      .replace(/[|_/]+/g, ' ')
      .replace(/\s*[-:;]\s*/g, ' ');
    title = toSimpleTitleCase(title);
    title = truncateAtWord(title, rules.titleMaxChars || DEFAULT_EDIT_RULES.titleMaxChars);
    if (!findForbiddenTitleTerms(title, item).length) break;
  }
  if (!title || findForbiddenTitleTerms(title, item).length) title = fallbackProductTitle(item);
  return sanitizePlatformText(title);
}

function inferMaterial(item) {
  const source = `${item && item.title ? item.title : ''} ${item && item.detailTextSample ? item.detailTextSample : ''}`.toLowerCase();
  if (source.includes('silicone')) return 'silicone';
  if (source.includes('stainless steel')) return 'stainless steel';
  if (source.includes('plastic')) return 'plastic';
  if (source.includes('metal')) return 'metal';
  if (source.includes('cotton')) return 'cotton';
  if (source.includes('polyester')) return 'polyester';
  return 'durable everyday material';
}

function buildCompliantPcDescription(item, compliantTitle, rules = DEFAULT_EDIT_RULES) {
  const productName = buildCompliantProductTitle(compliantTitle, item, rules);
  const material = inferMaterial(item);
  const usage = `${item && item.categoryTerm ? item.categoryTerm : 'home, kitchen, and everyday use'}`.toLowerCase();
  const lines = [
    `${productName} is designed for practical everyday use in U.S. homes, apartments, dorm rooms, offices, and light commercial spaces. The product focuses on simple function, easy handling, and a clean appearance without adding unnecessary decoration or complicated setup.`,
    'Key Details:',
    `- Material: made with ${material}, selected for regular handling, repeated use, and easy care during normal household routines.`,
    `- Function: helps organize, protect, cover, filter, drain, or support the related area based on the intended ${usage} application.`,
    '- Design: compact shape, smooth edges, and a simple structure make it easy to place, remove, clean, and store when not in use.',
    '- Daily Use: suitable for kitchens, utility areas, bathrooms, laundry rooms, storage spaces, and other common household settings.',
    '- Practical Advantage: provides a reusable solution for routine tasks while keeping the product easy to understand and simple to match with existing home items.',
  ];
  let description = sanitizePlatformText(stripForbiddenCommerceTerms(lines.join('\n'), item));
  while (plainTextFromHtml(description).length < (rules.pcDescriptionMinChars || DEFAULT_EDIT_RULES.pcDescriptionMinChars)) {
    description += '\n- Additional Detail: built for straightforward daily use, with neutral styling and practical proportions that make it suitable for repeated handling in common home environments.';
    description = sanitizePlatformText(stripForbiddenCommerceTerms(description, item));
  }
  return description;
}

module.exports = {
  DEFAULT_EDIT_RULES,
  FORBIDDEN_COMMERCE_TERMS,
  plainTextFromHtml,
  normalizeSpaces,
  sanitizePlatformText,
  sanitizePlatformTextDeep,
  findPlatformTextIssues,
  collectBrandCandidates,
  stripForbiddenCommerceTerms,
  findForbiddenTitleTerms,
  buildCompliantProductTitle,
  inferMaterial,
  buildCompliantPcDescription,
};
```

- [ ] **Step 4: Implement `index.js`**

Create `src/dxm-automation-core/index.js`:

```javascript
'use strict';

module.exports = {
  textRules: require('./text-rules'),
};
```

- [ ] **Step 5: Run text-rule test**

Run:

```powershell
node tools\dxm-automation-core.test.js
```

Expected: PASS with `dxm-automation-core.test.js passed`.

## Task 2: Add Pricing Rules Module And Tests

**Files:**

- Create: `src/dxm-automation-core/pricing-rules.js`
- Modify: `src/dxm-automation-core/index.js`
- Modify: `tools/dxm-automation-core.test.js`

- [ ] **Step 1: Add pricing assertions**

Append to the test before the final pass message:

```javascript
const { pricingRules } = require('../src/dxm-automation-core');

assert.strictEqual(pricingRules.calculateSupplyPriceCny(13.97, 7, 1.55), '151.57');
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
```

- [ ] **Step 2: Run test and confirm failure**

Run:

```powershell
node tools\dxm-automation-core.test.js
```

Expected: FAIL because `pricingRules` is missing.

- [ ] **Step 3: Implement `pricing-rules.js`**

Create `src/dxm-automation-core/pricing-rules.js`:

```javascript
'use strict';

function toNumber(value) {
  if (value == null || value === '') return null;
  const parsed = Number(String(value).replace(/[^\d.]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function round2(value) {
  return Math.round(Number(value) * 100) / 100;
}

function positiveNumber(value) {
  const number = toNumber(value);
  return number != null && number > 0 ? number : null;
}

function parseDimensionInches(text) {
  const source = String(text || '').replace(/\s+/g, ' ');
  const match = source.match(/(?:Product|Item|Package)?\s*Dimensions[^0-9]{0,30}([0-9.]+)\s*[x脳]\s*([0-9.]+)\s*[x脳]\s*([0-9.]+)\s*(?:inches|inch|in\b|")/i)
    || source.match(/\b([0-9.]+)\s*[x脳]\s*([0-9.]+)\s*[x脳]\s*([0-9.]+)\s*(?:inches|inch|in\b|")/i);
  if (!match) return null;
  return { length: Number(match[1]), width: Number(match[2]), height: Number(match[3]) };
}

function dimensionsInToCm(dimensionsIn) {
  if (!dimensionsIn) return null;
  return {
    length: round2(Number(dimensionsIn.length) * 2.54),
    width: round2(Number(dimensionsIn.width) * 2.54),
    height: round2(Number(dimensionsIn.height) * 2.54),
  };
}

function parseWeightKg(text) {
  const source = String(text || '').replace(/\s+/g, ' ');
  const match = source.match(/(?:Item|Package)?\s*Weight[^0-9]{0,30}([0-9.]+)\s*(pounds|pound|lbs|lb|ounces|ounce|oz|kilograms|kilogram|kg|g|grams)/i)
    || source.match(/\b([0-9.]+)\s*(pounds|pound|lbs|lb|ounces|ounce|oz|kilograms|kilogram|kg|g|grams)\b/i);
  if (!match) return '';
  const value = Number(match[1]);
  const unit = String(match[2] || '').toLowerCase();
  if (!Number.isFinite(value)) return '';
  if (['pounds', 'pound', 'lbs', 'lb'].includes(unit)) return String(round2(value * 0.453592));
  if (['ounces', 'ounce', 'oz'].includes(unit)) return String(round2(value * 0.0283495));
  if (['g', 'grams'].includes(unit)) return String(round2(value / 1000));
  return String(round2(value));
}

function calculateSupplyPriceCny(sourcePriceUsd, exchangeRate, multiplier) {
  const price = toNumber(sourcePriceUsd);
  const rate = toNumber(exchangeRate);
  const factor = toNumber(multiplier);
  if (price == null || rate == null || factor == null) return '';
  return String(round2(price * rate * factor));
}

function priceEqualsExpected(value, expected) {
  const actual = toNumber(value);
  const target = toNumber(expected);
  return actual != null && target != null && Math.abs(actual - target) < 0.01;
}

module.exports = {
  toNumber,
  round2,
  positiveNumber,
  parseDimensionInches,
  dimensionsInToCm,
  parseWeightKg,
  calculateSupplyPriceCny,
  priceEqualsExpected,
};
```

- [ ] **Step 4: Export pricing rules from `index.js`**

Update `src/dxm-automation-core/index.js`:

```javascript
'use strict';

module.exports = {
  textRules: require('./text-rules'),
  pricingRules: require('./pricing-rules'),
};
```

- [ ] **Step 5: Run pricing tests**

Run:

```powershell
node tools\dxm-automation-core.test.js
```

Expected: PASS.

## Task 3: Add PC Detail Rules Module And Tests

**Files:**

- Create: `src/dxm-automation-core/pc-detail-rules.js`
- Modify: `src/dxm-automation-core/index.js`
- Modify: `tools/dxm-automation-core.test.js`

- [ ] **Step 1: Add PC detail assertions**

Append to the test before the final pass message:

```javascript
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
```

- [ ] **Step 2: Run test and confirm failure**

Run:

```powershell
node tools\dxm-automation-core.test.js
```

Expected: FAIL because `pcDetailRules` is missing.

- [ ] **Step 3: Implement `pc-detail-rules.js`**

Create `src/dxm-automation-core/pc-detail-rules.js`:

```javascript
'use strict';

const { sanitizePlatformText } = require('./text-rules');

const DEFAULT_PC_DETAIL_RULES = Object.freeze({
  pcDescriptionMinImages: 2,
  pcDescriptionMaxImages: 5,
});

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeImageList(value) {
  const list = Array.isArray(value) ? value : [value];
  return list.map((item) => String(item || '').trim()).filter(Boolean);
}

function selectPcDetailImages(images, rules = DEFAULT_PC_DETAIL_RULES) {
  return normalizeImageList(images)
    .filter((url) => /^https?:\/\//i.test(url))
    .filter((url) => !/logo|avatar|icon|sprite|data:image/i.test(url))
    .slice(0, rules.pcDescriptionMaxImages || DEFAULT_PC_DETAIL_RULES.pcDescriptionMaxImages);
}

function textToStructuredDetailBodyHtml(text) {
  const lines = String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const html = [];
  let inList = false;
  const closeList = () => {
    if (inList) {
      html.push('</ul>');
      inList = false;
    }
  };
  for (const line of lines) {
    if (/^[-*]\s+/.test(line)) {
      if (!inList) {
        html.push('<ul>');
        inList = true;
      }
      html.push(`<li>${escapeHtml(line.replace(/^[-*]\s+/, ''))}</li>`);
      continue;
    }
    closeList();
    if (/^[A-Z][A-Za-z ]{2,}:$/.test(line)) html.push(`<h3>${escapeHtml(line.replace(/:$/, ''))}</h3>`);
    else html.push(`<p>${escapeHtml(line)}</p>`);
  }
  closeList();
  return html.join('\n');
}

function buildPcDetailWeb(text, images, altText, rules = DEFAULT_PC_DETAIL_RULES) {
  const selectedImages = selectPcDetailImages(images, rules);
  const alt = escapeHtml(sanitizePlatformText(altText || 'Product image'));
  const imageHtml = selectedImages
    .map((url) => `<p><img src="${escapeHtml(url)}" alt="${alt}" style="max-width:100%;height:auto;display:block;margin:0 auto 12px;"></p>`)
    .join('\n');
  const bodyHtml = textToStructuredDetailBodyHtml(text);
  return [imageHtml, bodyHtml].filter(Boolean).join('\n');
}

function normalizeImageUrlForCompare(url) {
  return String(url || '').trim().replace(/\?.*$/, '');
}

function getDetailWebImageUrls(detailWeb) {
  const urls = [];
  const pattern = /<img\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1/gi;
  let match = pattern.exec(String(detailWeb || ''));
  while (match) {
    if (match[2]) urls.push(match[2]);
    match = pattern.exec(String(detailWeb || ''));
  }
  return urls;
}

function countLeadingImageBlocks(detailWeb) {
  const blocks = String(detailWeb || '').match(/<p>\s*<img\b[^>]*>\s*<\/p>|<img\b[^>]*>/gi) || [];
  let count = 0;
  const source = String(detailWeb || '').trim();
  let offset = 0;
  for (const block of blocks) {
    const index = source.indexOf(block, offset);
    if (index !== offset) break;
    count += (block.match(/<img\b/gi) || []).length;
    offset += block.length;
    const whitespace = source.slice(offset).match(/^\s*/);
    offset += whitespace ? whitespace[0].length : 0;
  }
  return count;
}

function analyzePcDetailWebImages(detailWeb, currentImages, rules = DEFAULT_PC_DETAIL_RULES) {
  const detailImages = getDetailWebImageUrls(detailWeb);
  const currentSet = new Set(selectPcDetailImages(currentImages, rules).map(normalizeImageUrlForCompare));
  const currentProductImageCount = detailImages
    .map(normalizeImageUrlForCompare)
    .filter((url) => currentSet.has(url)).length;
  return {
    imageCount: detailImages.length,
    currentProductImageCount,
    leadingImageCount: countLeadingImageBlocks(detailWeb),
    required: rules.pcDescriptionMinImages || DEFAULT_PC_DETAIL_RULES.pcDescriptionMinImages,
  };
}

module.exports = {
  DEFAULT_PC_DETAIL_RULES,
  escapeHtml,
  selectPcDetailImages,
  textToStructuredDetailBodyHtml,
  buildPcDetailWeb,
  normalizeImageUrlForCompare,
  getDetailWebImageUrls,
  countLeadingImageBlocks,
  analyzePcDetailWebImages,
};
```

- [ ] **Step 4: Export PC detail rules from `index.js`**

Update `src/dxm-automation-core/index.js`:

```javascript
'use strict';

module.exports = {
  textRules: require('./text-rules'),
  pricingRules: require('./pricing-rules'),
  pcDetailRules: require('./pc-detail-rules'),
};
```

- [ ] **Step 5: Run full core test**

Run:

```powershell
node tools\dxm-automation-core.test.js
```

Expected: PASS.

## Task 4: Syntax Checks And Documentation Sync

**Files:**

- Modify: `docs/current-status.md`
- Modify: `docs/test-plan.md`
- Modify: `docs/test-results.md`
- Modify: `README.md`
- Modify: `README.zh-CN.md`
- Modify: `DEVELOPMENT_LOG.md`

- [ ] **Step 1: Run verification commands**

Run:

```powershell
node tools\dxm-automation-core.test.js
node tools\aliexpress-evidence-policy.test.js
node --check src\dianxiaomi-automation-v1-merged-new.user.js
git ls-files "*.js" "*.mjs" | ForEach-Object { node --check $_ }
```

Expected:

- `dxm-automation-core.test.js passed`
- `aliexpress-evidence-policy.test.js passed`
- `node --check` succeeds for all JS/MJS files

- [ ] **Step 2: Update docs to prevent drift**

Update documents with this exact status:

```text
Prepared source-level pure modules under src/dxm-automation-core for text rules, pricing/dimension rules, and PC detail image-first rules. Added tools/dxm-automation-core.test.js as the second explicit Node assertion test. No live Dianxiaomi page action, collection, claim, edit, save, publish, or one-click publish was executed.
```

Also replace any statement that says only one explicit `.test.js` exists with a current count of two explicit Node assertion tests:

```text
tools/aliexpress-evidence-policy.test.js
tools/dxm-automation-core.test.js
```

- [ ] **Step 3: Run drift checks**

Run:

```powershell
rg -n "only one explicit|Only one explicit|one explicit `.test.js`|尚无统一 `npm test`|no unified `npm test`" README.md README.zh-CN.md docs\test-plan.md docs\test-results.md docs\current-status.md
```

Expected: no stale claim that there is only one explicit test. It is acceptable for docs to say there is still no unified `npm test`.

- [ ] **Step 4: Commit**

Run:

```powershell
git add src\dxm-automation-core tools\dxm-automation-core.test.js docs\superpowers\specs docs\superpowers\plans docs\current-status.md docs\test-plan.md docs\test-results.md README.md README.zh-CN.md DEVELOPMENT_LOG.md
git commit -m "refactor: extract testable userscript core modules"
```

Expected: commit succeeds on branch `codex/userscript-pure-modules`.

## Self-Review

- Spec coverage: pure modules, tests, no live business action, and documentation drift control are each covered by tasks.
- Placeholder scan: no task uses placeholder markers or open-ended implementation language.
- Type consistency: exported names are `textRules`, `pricingRules`, and `pcDetailRules`; tests and `index.js` use the same names.
- Scope control: main userscript runtime behavior is not changed in this first phase; DOM/page automation remains in the adapter.
