// ==UserScript==
// @name         DXM Automation V1 - NEW v1.1.49
// @namespace    https://codex.local/dianxiaomi-automation-v1
// @version      1.1.49
// @description  DXM listing automation: edit.json, choiceSave payload, dry-run, save validation, run bundle.
// @author       Codex
// @match        https://*.dianxiaomi.com/*
// @match        http://*.dianxiaomi.com/*
// @match        https://dianxiaomi.com/*
// @match        http://dianxiaomi.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const APP_NAME = 'DXM Automation V1';
  const VERSION = '1.1.49';
  const PANEL_ID = 'dxm-automation-v1-new-panel';
  const POS_KEY = 'dxm-automation-v1-new-position';
  const COLLAPSED_KEY = 'dxm-automation-v1-new-collapsed';
  const DEFAULT_POSTAGE_ID_KEY = 'dxm-single-submit-default-postage-id';
  const DEFAULT_WEIGHT_KEY = 'dxm-single-submit-default-weight';
  const DEFAULT_SUPPLY_PRICE_KEY = 'dxm-single-submit-default-supply-price';
  const DEFAULT_SOURCE_PRICE_KEY = 'dxm-single-submit-default-source-price';
  const DEFAULT_STOCK_KEY = 'dxm-single-submit-default-stock';
  const DEFAULT_SHOP_ID_KEY = 'dxm-single-submit-default-shop-id';
  const TASK_EXCHANGE_RATE_KEY = 'dxm-automation-task-exchange-rate';
  const TASK_PRICE_MULTIPLIER_KEY = 'dxm-automation-task-price-multiplier';
  const DEFAULT_LENGTH_IN_KEY = 'dxm-single-submit-default-length-in';
  const DEFAULT_WIDTH_IN_KEY = 'dxm-single-submit-default-width-in';
  const DEFAULT_HEIGHT_IN_KEY = 'dxm-single-submit-default-height-in';
  const DEFAULT_LENGTH_KEY = 'dxm-single-submit-default-length';
  const DEFAULT_WIDTH_KEY = 'dxm-single-submit-default-width';
  const DEFAULT_HEIGHT_KEY = 'dxm-single-submit-default-height';
  const AMAZON_PUBLIC_BATCH_KEY = 'dxm_amazon_crawlbox_public_batch_v1';
  const AMAZON_SOURCE_ASIN_KEY = 'dxm-automation-amazon-source-asin';
  const CURRENT_PUBLISH_TEST = Object.freeze({
    productId: '167487782002154045',
    asin: 'B09D5Y5HBW',
    titleToken: 'Silicone Sink Strainer',
  });

  const EDIT_PAGE_RULES = Object.freeze({
    postageTemplateId: '111',
    titleMaxChars: 80,
    pcDescriptionMinChars: 500,
    pcDescriptionMinImages: 2,
    pcDescriptionMaxImages: 5,
    marketingImageCount: 2,
    customAttributesDefaultSkip: true,
    customAttributeMaxChars: 70,
    saveRetryLimit: 1,
    aiTitleCapability: 'title optimization',
    aiDescriptionCapability: 'description rewrite',
    flow: 'Amazon -> collection box -> claim -> edit page -> save -> collection box -> publish',
    forbiddenEditPageAction: 'publish from edit page',
  });
  let visibleEditRulesAutoAppliedUrl = '';
  let visibleEditRulesWatcherStarted = false;
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
  function getDefaultPostageId() {
    return EDIT_PAGE_RULES.postageTemplateId;
  }

  function getDefaultWeightKg() {
    return getPanelInputValue('defaultWeight', localStorage.getItem(DEFAULT_WEIGHT_KEY) || '0.1');
  }

  function getDefaultSupplyPrice() {
    return getPanelInputValue('defaultSupplyPrice', localStorage.getItem(DEFAULT_SUPPLY_PRICE_KEY) || '');
  }

  function getDefaultSourcePrice() {
    return getPanelInputValue('defaultSourcePrice', localStorage.getItem(DEFAULT_SOURCE_PRICE_KEY) || '');
  }

  function getDefaultStock() {
    return getPanelInputValue('defaultStock', localStorage.getItem(DEFAULT_STOCK_KEY) || '15');
  }

  function getDefaultShopId() {
    return getPanelInputValue('defaultShopId', localStorage.getItem(DEFAULT_SHOP_ID_KEY) || '8438115');
  }

  function getTaskExchangeRate() {
    return getPanelInputValue('taskExchangeRate', localStorage.getItem(TASK_EXCHANGE_RATE_KEY) || '7');
  }

  function getTaskPriceMultiplier() {
    return getPanelInputValue('taskPriceMultiplier', localStorage.getItem(TASK_PRICE_MULTIPLIER_KEY) || '1.55');
  }

  function getDefaultLengthIn() {
    return getPanelInputValue('defaultLengthIn', localStorage.getItem(DEFAULT_LENGTH_IN_KEY) || '');
  }

  function getDefaultWidthIn() {
    return getPanelInputValue('defaultWidthIn', localStorage.getItem(DEFAULT_WIDTH_IN_KEY) || '');
  }

  function getDefaultHeightIn() {
    return getPanelInputValue('defaultHeightIn', localStorage.getItem(DEFAULT_HEIGHT_IN_KEY) || '');
  }

  function getDefaultLength() {
    return getPanelInputValue('defaultLength', localStorage.getItem(DEFAULT_LENGTH_KEY) || '12.7');
  }

  function getDefaultWidth() {
    return getPanelInputValue('defaultWidth', localStorage.getItem(DEFAULT_WIDTH_KEY) || '12.7');
  }

  function getDefaultHeight() {
    return getPanelInputValue('defaultHeight', localStorage.getItem(DEFAULT_HEIGHT_KEY) || '1.27');
  }

  function getAmazonSourceAsin() {
    return getPanelInputValue('amazonAsin', localStorage.getItem(AMAZON_SOURCE_ASIN_KEY) || '');
  }
  const SAVE_FIELDS = [
    'shopId',
    'categoryId',
    'subject',
    'sourceUrl',
    'fullCid',
    'productPropertyListJson',
    'mainImageListJson',
    'imgUrl',
    'marketImage2',
    'marketImage1',
    'videoListJson',
    'optionValues',
    'optionValueIds',
    'shipFrom',
    'productUnit',
    'packageType',
    'lotNum',
    'supportCountrySupplyPrice',
    'variationListStr',
    'sizeChartId',
    'detailMobile',
    'detailWeb',
    'sizeChartIdListJson',
    'deliveryTime',
    'postageId',
    'aeopQualificationStructListJson',
    'manufactureId',
    'msrEuId',
    'msrTrId',
    'op',
    'id',
    'currencyCode',
    'dxmState',
    'productId',
  ];

  const REQUIRED_FIELDS = [
    'id',
    'shopId',
    'categoryId',
    'subject',
    'productPropertyListJson',
    'mainImageListJson',
    'variationListStr',
    'postageId',
    'deliveryTime',
    'detailMobile',
    'detailWeb',
  ];

  const DEFAULT_PROPERTY_LIST_BY_CATEGORY = {
    '200291142': [
      {
        attr_name_id: '2',
        attr_name: 'Brand Name',
        attr_value_id: '201512802',
        attr_value: 'None',
        attr_value_unit: null,
        attr_value_start: null,
        attr_value_end: null,
      },
      {
        attr_name_id: '400000603',
        attr_name: 'High-concerned chemical',
        attr_value_id: '23399591357',
        attr_value: '\u5929\u7136\u672a\u5904\u7406(None)',
      },
      {
        attr_name_id: '219',
        attr_name: 'Origin',
        attr_value_id: '9442295690',
        attr_value: '\u7f8e\u56fd(Origin)(US(Origin))',
        attr_value_unit: null,
        attr_value_start: null,
        attr_value_end: null,
      },
    ],
  };

  const CATEGORY_RESOLVER_AUTO_APPLY_CONFIDENCE = 0.85;
  // CATEGORY_RESOLVER_RULES is generated from skills/category-resolver/learned_rules.json.
  const CATEGORY_RESOLVER_RULES = [
      {
          "id": "bumpers-200291142",
          "status": "active",
          "categoryId": "200291142",
          "categoryPath": "Home Improvement > Hardware > Furniture Hardware > Cabinet Bumpers",
          "match": {
              "anyTitleTerms": [
                  "bumper",
                  "bumpers",
                  "rubber bumper",
                  "cabinet bumper",
                  "door stopper",
                  "furniture pad",
                  "self adhesive bumper"
              ],
              "anySourceCategoryTerms": [
                  "cabinet bumpers",
                  "rubber bumpers"
              ]
          },
          "defaults": {
              "productPropertyListJson": [
                  {
                      "attr_name_id": "2",
                      "attr_name": "Brand Name",
                      "attr_value_id": "201512802",
                      "attr_value": "None",
                      "attr_value_unit": null,
                      "attr_value_start": null,
                      "attr_value_end": null
                  },
                  {
                      "attr_name_id": "400000603",
                      "attr_name": "High-concerned chemical",
                      "attr_value_id": "23399591357",
                      "attr_value": "\u5929\u7136\u672a\u5904\u7406(None)"
                  },
                  {
                      "attr_name_id": "219",
                      "attr_name": "Origin",
                      "attr_value_id": "9442295690",
                      "attr_value": "\u7f8e\u56fd(Origin)(US(Origin))",
                      "attr_value_unit": null,
                      "attr_value_start": null,
                      "attr_value_end": null
                  }
              ]
          },
          "evidence": [
              "analysis/save-json-3/choiceSave.pretty.json"
          ]
      }
  ];

  const US_SHIPS_FROM_PROPERTY = {
    sku_property_id: '200007763',
    sku_property_name: 'Ships From',
    property_value_id: '201336106',
    sku_property_value: 'United States',
    property_value_definition_name: '',
    sku_image: '',
  };

  function normalizeCategoryText(value) {
    return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
  }

  function getRuleProperties(rule) {
    const defaults = rule && rule.defaults ? rule.defaults : {};
    return Array.isArray(defaults.productPropertyListJson) ? defaults.productPropertyListJson : null;
  }

  function getCategoryPropertiesById(categoryId) {
    if (DEFAULT_PROPERTY_LIST_BY_CATEGORY[categoryId]) return DEFAULT_PROPERTY_LIST_BY_CATEGORY[categoryId];
    const rule = CATEGORY_RESOLVER_RULES.find((item) => item.status === 'active' && String(item.categoryId) === String(categoryId));
    return getRuleProperties(rule);
  }

  function countMatchedTerms(haystack, terms) {
    const matched = [];
    for (const term of terms || []) {
      const normalized = normalizeCategoryText(term);
      if (normalized && haystack.includes(normalized)) matched.push(term);
    }
    return matched;
  }

  function scoreCategoryRule(rule, haystack, asin) {
    const match = rule.match || {};
    const exactAsins = (match.exactAsins || []).map((item) => String(item).toUpperCase());
    if (asin && exactAsins.includes(String(asin).toUpperCase())) {
      return { confidence: 1, matchedTerms: [`asin:${asin}`] };
    }

    const titleMatches = countMatchedTerms(haystack, match.anyTitleTerms || []);
    const sourceMatches = countMatchedTerms(haystack, match.anySourceCategoryTerms || []);
    let confidence = 0;
    if (titleMatches.length) confidence += Math.min(0.72, 0.38 + titleMatches.length * 0.11);
    if (sourceMatches.length) confidence += Math.min(0.38, 0.2 + sourceMatches.length * 0.09);
    confidence = Math.min(0.98, confidence);
    return {
      confidence,
      matchedTerms: [...titleMatches, ...sourceMatches],
    };
  }

  function resolveCategoryForProduct(payload, product) {
    const existingProperties = getCategoryPropertiesById(payload.categoryId);
    if (existingProperties) {
      const directRule = CATEGORY_RESOLVER_RULES.find((item) => item.status === 'active' && String(item.categoryId) === String(payload.categoryId));
      return {
        status: 'resolved',
        source: 'existing_category',
        publishCategoryId: payload.categoryId,
        categoryPath: directRule ? directRule.categoryPath : '',
        properties: existingProperties,
        confidence: 1,
        ruleId: directRule ? directRule.id : `category-${payload.categoryId}`,
        matchedTerms: [String(payload.categoryId)],
      };
    }

    const asin = extractAsin(`${product.sourceUrl || ''} ${product.sourceId || ''} ${product.platformProductId || ''} ${payload.sourceUrl || ''} ${payload.subject || ''}`);
    const haystack = normalizeCategoryText(
      [
        payload.categoryId,
        payload.fullCid,
        payload.subject,
        payload.sourceUrl,
        product.categoryName,
        product.categoryNameZh,
        product.sourceCategoryId,
        product.platformCategoryId,
        product.sourceCategoryName,
      ].join(' ')
    );
    let best = null;
    for (const rule of CATEGORY_RESOLVER_RULES.filter((item) => item.status === 'active')) {
      const scored = scoreCategoryRule(rule, haystack, asin);
      if (!best || scored.confidence > best.confidence) {
        best = { rule, ...scored };
      }
    }
    if (best && best.confidence >= CATEGORY_RESOLVER_AUTO_APPLY_CONFIDENCE) {
      return {
        status: 'resolved',
        source: 'learned_rules',
        publishCategoryId: String(best.rule.categoryId),
        categoryPath: best.rule.categoryPath || '',
        properties: getRuleProperties(best.rule),
        confidence: best.confidence,
        ruleId: best.rule.id,
        matchedTerms: best.matchedTerms,
      };
    }
    return {
      status: 'unresolved',
      source: 'manual_learning_required',
      publishCategoryId: '',
      categoryPath: '',
      properties: null,
      confidence: best ? best.confidence : 0,
      ruleId: best && best.rule ? best.rule.id : '',
      matchedTerms: best ? best.matchedTerms : [],
    };
  }

  function getDefaultPropertiesForProduct(payload, product) {
    return resolveCategoryForProduct(payload, product || {});
  }

  function isNumericPublishCategoryId(value) {
    return /^\d+$/.test(String(value || ''));
  }

  function walkJson(root, visit, maxDepth = 8) {
    const queue = [{ value: root, depth: 0 }];
    const seen = new Set();
    while (queue.length) {
      const item = queue.shift();
      const value = item.value;
      if (!value || typeof value !== 'object' || item.depth > maxDepth) continue;
      if (seen.has(value)) continue;
      seen.add(value);
      visit(value);
      if (Array.isArray(value)) {
        for (const child of value) queue.push({ value: child, depth: item.depth + 1 });
      } else {
        for (const child of Object.values(value)) queue.push({ value: child, depth: item.depth + 1 });
      }
    }
  }

  function firstObjectString(object, keys) {
    for (const key of keys) {
      if (object && object[key] !== undefined && object[key] !== null && String(object[key]).trim() !== '') {
        return String(object[key]).trim();
      }
    }
    return '';
  }

  function collectCategoryCandidates(json) {
    const candidates = [];
    const seen = new Set();
    walkJson(json, (object) => {
      if (Array.isArray(object)) return;
      const categoryId = firstObjectString(object, ['categoryId', 'cateId', 'id']);
      const categoryName = firstObjectString(object, ['categoryName', 'name', 'categoryNameEn', 'title']);
      if (!isNumericPublishCategoryId(categoryId) || !categoryName) return;
      const key = `${categoryId}|${categoryName}`;
      if (seen.has(key)) return;
      seen.add(key);
      candidates.push({
        categoryId,
        categoryName,
        categoryParentId: firstObjectString(object, ['categoryParentId', 'parentId', 'pid']),
        categoryPath: firstObjectString(object, ['nodePath', 'categoryPath', 'path', 'fullName', 'fullPath']),
        isLeaf: String(firstObjectString(object, ['isLeaf', 'leaf'])) === '1' || object.isLeaf === true || object.leaf === true,
        raw: object,
      });
    });
    return candidates;
  }

  const CATEGORY_SEARCH_STOP_WORDS = new Set([
    'the', 'and', 'for', 'with', 'from', 'into', 'onto', 'this', 'that', 'these', 'those', 'your', 'our',
    'men', 'women', 'kids', 'baby', 'new', 'set', 'pack', 'piece', 'pieces', 'pcs', 'pc', 'of', 'to', 'in',
    'a', 'an', 'by', 'on', 'as', 'at', 'or', 'mini', 'portable', 'rechargeable', 'powerful', 'personal',
  ]);

  function tokenizeCategoryTitle(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .split(/\s+/)
      .map((item) => item.trim())
      .filter((item) => item && item.length > 2 && !CATEGORY_SEARCH_STOP_WORDS.has(item) && !/^\d+$/.test(item));
  }

  function rawCategoryTitleTokens(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .split(/\s+/)
      .map((item) => item.trim())
      .filter((item) => item && item.length > 2 && !/^\d+$/.test(item));
  }

  function titleCaseWords(words) {
    return words
      .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : word))
      .join(' ');
  }

  function pluralizeCategoryWord(word) {
    if (!word) return word;
    if (/s$/i.test(word)) return word;
    if (/y$/i.test(word)) return `${word.slice(0, -1)}ies`;
    return `${word}s`;
  }

  const CATEGORY_HEAD_NOUNS = new Set([
    'fan', 'fans', 'bumper', 'bumpers', 'stopper', 'stoppers', 'pad', 'pads', 'protector', 'protectors',
    'cover', 'covers', 'case', 'cases', 'holder', 'holders', 'rack', 'racks', 'bag', 'bags', 'box', 'boxes',
    'organizer', 'organizers', 'light', 'lights', 'lamp', 'lamps', 'brush', 'brushes', 'tool', 'tools',
    'strainer', 'strainers', 'drain', 'drains', 'sink', 'sinks', 'basket', 'baskets', 'filter', 'filters',
    'catcher', 'catchers', 'plug', 'plugs', 'mat', 'mats', 'tray', 'trays', 'container', 'containers',
  ]);

  const CATEGORY_MODIFIER_PRIORITY = [
    'handheld', 'portable', 'personal', 'cooling', 'cool', 'desk', 'table', 'floor', 'wall', 'ceiling',
    'cabinet', 'door', 'rubber', 'silicone', 'adhesive', 'furniture', 'corner', 'baby', 'safety',
    'kitchen', 'bathroom', 'shower', 'sink', 'drain', 'mesh', 'stainless', 'steel', 'anti', 'clog',
  ];

  const CATEGORY_MAPPING_RULES = [
    {
      id: 'desk-stationery-pen-holders',
      dxmCategoryPath: 'Office & School Supplies > Desk Accessories & Organizer > Pen Holders',
      searchTerms: ['Pen Holders', '\u7b14\u7b52', 'Pencil Holders', 'Pencil Cup', 'Desk Pen Holder'],
      positivePatterns: [
        /\b(?:pen|pencil)\s+(?:holder|holders|cup|cups)\b/i,
        /\bdesk\s+(?:pen|pencil)\s+(?:holder|holders|organizer|organizers)\b/i,
        /\brotating\s+(?:pen|pencil)\s+organizer\b/i,
        /\brotating\s+organizer\b.*\b(?:pencil|pencils|pen|pens|office supplies|school supplies)\b/i,
        /\b(?:pencil|pencils|pen|pens|scissors|office supplies|school supplies)\b.*\brotating\s+organizer\b/i,
        /\b(?:desktop|desk)\s+stationery\s+(?:storage|organizer)\b/i,
        /\b(?:stationery|office supplies|school supplies)\s+(?:holder|organizer|storage)\b/i,
        /\u684c\u9762\u6587\u5177\u6536\u7eb3|\u7b14\u7b52/i,
      ],
      negativePatterns: [
        /\bcable\b/i,
        /\bmakeup\b/i,
        /\bbathroom\b/i,
        /\bkitchen\b/i,
        /\bclothing\b/i,
        /\bwardrobe\b/i,
        /\bdrawer\b/i,
        /\bfile\b/i,
        /\bletter\b/i,
        /\bshoe\b/i,
        /\btoy\b/i,
      ],
    },
    {
      id: 'broad-drawer-organizer-trays',
      dxmCategoryPath: 'Home & Garden > Home Storage & Organization > Storage Boxes & Bins',
      searchTerms: ['Storage Boxes', 'Storage Bins', 'Storage Trays', 'Drawer Organizers', 'Desk Organizers', 'Makeup Organizer', 'Bathroom Storage', 'Kitchen Drawer Organizers'],
      positivePatterns: [
        /\bdrawer\s+(?:organizer|organizers|tray|trays|storage)\b/i,
        /\b(?:clear|plastic|acrylic)\s+(?:organizer|organizers|tray|trays|storage|bins?)\b/i,
        /\b(?:makeup|cosmetic|office supplies|desk|bathroom|kitchen)\b.*\b(?:organizer|organizers|tray|trays|storage|bins?)\b/i,
        /\b(?:organizer|organizers|tray|trays|storage|bins?)\b.*\b(?:makeup|cosmetic|office supplies|desk|bathroom|kitchen)\b/i,
      ],
      negativePatterns: [
        /\b(?:bra|bras|panty|panties|underwear|lingerie|sock|socks|clothing|wardrobe)\b/i,
      ],
    },
    {
      id: 'adhesive-cable-clips',
      dxmCategoryPath: 'Home Improvement > Electrical Equipment & Supplies > Cable Clips',
      searchTerms: ['Cable Clips', 'Cable Holders', 'Cable Management', 'Wire Clips', 'Cord Holder'],
      positivePatterns: [
        /\b(?:cable|wire|cord)\s+(?:clip|clips|holder|holders|organizer|organizers)\b/i,
        /\b(?:adhesive|self adhesive)\s+(?:cable|wire|cord)\b/i,
        /\b(?:charger|cord)\s+(?:holder|keeper|management)\b/i,
      ],
      negativePatterns: [
        /\b(?:electronic|charger\s+block|usb|battery|power\s+bank)\b/i,
      ],
    },
    {
      id: 'adhesive-wall-hooks',
      dxmCategoryPath: 'Home & Garden > Home Storage & Organization > Hooks & Rails',
      searchTerms: ['Adhesive Hooks', 'Wall Hooks', 'Utility Hooks', 'Hooks & Rails', 'Storage Hooks'],
      positivePatterns: [
        /\b(?:adhesive|self adhesive|wall|utility)\s+(?:hook|hooks)\b/i,
        /\b(?:hook|hooks)\b.*\b(?:wall|towel|coat|hanger|adhesive|kitchen|bathroom)\b/i,
      ],
      negativePatterns: [
        /\b(?:fishing|carabiner|baby|toy)\b/i,
      ],
    },
    {
      id: 'kitchen-sink-strainers',
      dxmCategoryPath: 'Home & Garden > Kitchen Fixtures > Sink Strainers',
      searchTerms: ['Sink Strainer', 'Kitchen Sink Strainer', 'Drain Strainer', 'Sink Drain Strainer', 'Sink Filter'],
      positivePatterns: [
        /\b(?:sink|drain)\s+(?:strainer|strainers|filter|filters|catcher|catchers|stopper|stoppers)\b/i,
        /\bkitchen\s+sink\b.*\b(?:strainer|filter|drain)\b/i,
      ],
      negativePatterns: [
        /\b(?:faucet|sprayer|pump)\b/i,
      ],
    },
    {
      id: 'bathroom-soap-dishes',
      dxmCategoryPath: 'Home & Garden > Bathroom Products > Soap Dishes',
      searchTerms: ['Soap Dishes', 'Soap Dish', 'Soap Holder', 'Bathroom Soap Holder', 'Soap Tray'],
      positivePatterns: [
        /\b(?:soap)\s+(?:dish|dishes|holder|holders|tray|trays|saver|savers)\b/i,
        /\b(?:bathroom|shower)\b.*\bsoap\b/i,
      ],
      negativePatterns: [
        /\b(?:dispenser|pump|liquid)\b/i,
      ],
    },
  ];

  function getMatchedCategoryMappingRules(contextText) {
    const source = String(contextText || '');
    return CATEGORY_MAPPING_RULES.filter((rule) => {
      const hasPositiveSignal = rule.positivePatterns.some((pattern) => pattern.test(source));
      if (!hasPositiveSignal) return false;
      return !rule.negativePatterns.some((pattern) => pattern.test(source));
    });
  }

  function pushCategoryMappingTerms(contextText, push) {
    for (const rule of getMatchedCategoryMappingRules(contextText)) {
      for (const term of rule.searchTerms) push(term);
    }
  }

  function isUsefulCategoryModifier(token) {
    return token && token.length > 2 && !CATEGORY_SEARCH_STOP_WORDS.has(token) && !/^\d+$/.test(token);
  }

  function buildCoreNounCategoryTerms(rawTitle) {
    const rawTokens = rawCategoryTitleTokens(rawTitle);
    const terms = [];
    const push = (words) => {
      const clean = words.filter(isUsefulCategoryModifier);
      if (clean.length) terms.push(titleCaseWords(clean));
    };

    for (let index = 0; index < rawTokens.length; index += 1) {
      const token = rawTokens[index];
      if (!CATEGORY_HEAD_NOUNS.has(token)) continue;
      const singular = token.replace(/s$/i, '');
      const plural = pluralizeCategoryWord(singular);
      const prev1 = rawTokens[index - 1];
      const prev2 = rawTokens[index - 2];

      push([singular]);
      if (plural !== singular) push([plural]);
      if (isUsefulCategoryModifier(prev1)) {
        push([prev1, singular]);
        push([prev1, plural]);
      }
      if (isUsefulCategoryModifier(prev2) && isUsefulCategoryModifier(prev1)) {
        push([prev2, prev1, singular]);
        push([prev2, prev1, plural]);
      }
    }

    return terms;
  }

  function buildHeadNounCategoryTerms(rawTitle) {
    const rawTokens = rawCategoryTitleTokens(rawTitle);
    const terms = [];
    const push = (words) => {
      const clean = words.filter(Boolean);
      if (clean.length >= 2) terms.push(titleCaseWords(clean));
    };
    for (let index = 0; index < rawTokens.length; index += 1) {
      const noun = rawTokens[index];
      if (!CATEGORY_HEAD_NOUNS.has(noun)) continue;
      const pluralNoun = pluralizeCategoryWord(noun.replace(/s$/i, ''));
      const windowStart = Math.max(0, index - 4);
      const previous = rawTokens.slice(windowStart, index);
      const prioritized = CATEGORY_MODIFIER_PRIORITY.filter((modifier) => previous.includes(modifier));
      for (const modifier of prioritized) push([modifier, pluralNoun]);
      if (previous.length) push([previous[previous.length - 1], pluralNoun]);
      if (previous.length >= 2) push([previous[previous.length - 2], previous[previous.length - 1], pluralNoun]);
    }
    return terms;
  }

  function buildCategorySearchTerms(payload, product, amazonItem = null) {
    const rawTitle = firstNonEmpty(payload.subject, product.subject, product.title, product.productTitle, '');
    const tokens = tokenizeCategoryTitle(rawTitle);
    const terms = [];
    const push = (value) => {
      const text = String(value || '').replace(/\s+/g, ' ').trim();
      if (text && !terms.some((item) => item.toLowerCase() === text.toLowerCase())) terms.push(text);
    };

    pushCategoryMappingTerms(
      [
        rawTitle,
        amazonItem && amazonItem.title,
        amazonItem && amazonItem.categoryTerm,
        amazonItem && amazonItem.detailTextSample,
        product.categoryName,
        product.categoryNameZh,
        product.sourceCategoryName,
      ].join(' '),
      push
    );

    if (amazonItem && amazonItem.categoryTerm) push(amazonItem.categoryTerm);
    for (const term of buildCoreNounCategoryTerms(rawTitle)) push(term);
    for (const term of buildHeadNounCategoryTerms(rawTitle)) push(term);
    const importantTokens = tokens.filter((token) => token.length >= 4);
    for (let size = Math.min(3, importantTokens.length); size >= 2; size -= 1) {
      for (let index = 0; index <= importantTokens.length - size; index += 1) {
        const slice = importantTokens.slice(index, index + size);
        push(titleCaseWords(slice));
        push(titleCaseWords([...slice.slice(0, -1), pluralizeCategoryWord(slice[slice.length - 1])]));
      }
    }
    for (const token of importantTokens.slice(0, 8)) {
      push(titleCaseWords([token]));
      push(titleCaseWords([pluralizeCategoryWord(token)]));
    }
    return terms.slice(0, 18);
  }

  function buildCategorySemanticContext(payload, product, amazonItem) {
    return normalizeCategoryText([
      payload && payload.subject,
      product && (product.subject || product.title || product.productTitle),
      product && (product.categoryName || product.categoryNameZh || product.sourceCategoryName),
      amazonItem && (amazonItem.title || amazonItem.categoryTerm || amazonItem.detailTextSample || amazonItem.rawText),
    ].filter(Boolean).join(' '));
  }

  function getCategoryPathSemanticPenalty(candidate, payload, product, searchTerm) {
    const amazonItem = getAmazonBatchItem(product || {});
    const context = buildCategorySemanticContext(payload, product, amazonItem);
    const pathText = normalizeCategoryText(`${candidate.categoryName || ''} ${candidate.categoryPath || ''}`);
    const isClothingStoragePath = /衣物|内衣|clothing|wardrobe|underwear|lingerie/.test(pathText);
    const hasClothingSignal = /\b(?:bra|bras|panty|panties|underwear|lingerie|sock|socks|clothing|wardrobe|closet|drawer\s+divider\s+for\s+clothes)\b|衣物|内衣|袜|衣柜/.test(context);
    const hasBroadOrganizerSignal = /\b(?:drawer\s+organizer|organizer\s+tray|storage\s+tray|storage\s+bin|makeup|cosmetic|office supplies|desk|bathroom|kitchen|pantry|plastic|acrylic)\b/.test(context);
    if (isClothingStoragePath && !hasClothingSignal && hasBroadOrganizerSignal) {
      return {
        penalty: 0.55,
        reason: 'category_path_too_narrow_clothing_or_underwear_without_product_evidence',
        searchTerm,
      };
    }
    return { penalty: 0, reason: '' };
  }

  function scoreDxmCategoryCandidate(candidate, payload, product, searchTerm) {
    const title = normalizeCategoryText(firstNonEmpty(payload.subject, product.subject, product.title, product.productTitle, ''));
    const categoryText = normalizeCategoryText(`${candidate.categoryName || ''} ${candidate.categoryPath || ''}`);
    const tokens = tokenizeCategoryTitle(title);
    const uniqueTokens = [...new Set(tokens)];
    const matchedCount = uniqueTokens.filter((token) => categoryText.includes(token)).length;
    const denominator = Math.max(1, Math.min(6, uniqueTokens.length));
    let score = matchedCount / denominator;
    const normalizedTerm = normalizeCategoryText(searchTerm);
    if (normalizedTerm && categoryText.includes(normalizedTerm)) score += 0.35;
    if (candidate.isLeaf) score += 0.12;
    if (normalizeCategoryText(candidate.categoryName) === normalizedTerm) score += 0.18;
    const semantic = getCategoryPathSemanticPenalty(candidate, payload, product, searchTerm);
    if (semantic.penalty) {
      candidate.semanticPenalty = semantic;
      score -= semantic.penalty;
    }
    return Math.max(0, Math.min(1, Math.round(score * 100) / 100));
  }

  async function fetchDxmCategoryAttributes(categoryId, shopId) {
    const calls = [];
    const attributeBodies = [
      {
        url: '/api/smtlocalCategory/attributeList.json',
        options: {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
          body: new URLSearchParams({ categoryId: String(categoryId) }),
        },
      },
      {
        url: '/api/categoryAttrMatch/getCategoryAttr10464dd7.json',
        options: {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=UTF-8' },
          body: JSON.stringify({ platform: 'smtlocal', categoryId: String(categoryId), shopId: String(shopId || '') }),
        },
      },
    ];

    for (const item of attributeBodies) {
      try {
        const response = await apiFetchJson(item.url, item.options);
        calls.push({ url: item.url, ok: true });
        if (response) return { response, calls };
      } catch (error) {
        calls.push({ url: item.url, ok: false, error: String(error && error.message ? error.message : error) });
      }
    }
    return { response: null, calls };
  }

  function parseDxmNames(value) {
    const parsed = parseMaybeJson(value, null);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return {
        en: String(firstNonEmpty(parsed.en, parsed.EN, parsed.name, parsed.value, '')).trim(),
        zh: String(firstNonEmpty(parsed.zh, parsed.ZH, '')).trim(),
      };
    }
    return { en: String(value || '').trim(), zh: '' };
  }

  function getDxmAttributeValues(attribute) {
    const rawValues = parseMaybeJson(attribute && attribute.values, []);
    if (!Array.isArray(rawValues)) return [];
    return rawValues
      .map((item) => {
        const names = parseDxmNames(item && item.names);
        const name = firstNonEmpty(names.en, names.zh, item && item.name, item && item.value, item && item.id);
        return {
          id: item && item.id == null ? '' : String(item.id),
          name: String(name || '').trim(),
          raw: item,
        };
      })
      .filter((item) => item.id || item.name);
  }

  function findDxmValue(values, patterns) {
    for (const pattern of patterns) {
      const matcher = pattern instanceof RegExp ? pattern : new RegExp(`^${String(pattern).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
      const found = values.find((item) => matcher.test(String(item.name || '').trim()));
      if (found) return found;
    }
    return null;
  }

  function inferMaterialCandidates(payload, product) {
    const amazonItem = getAmazonBatchItem(product || {});
    const source = normalizeCategoryText([
      payload && payload.subject,
      product && (product.subject || product.title || product.productTitle || product.detailText || product.detailWeb),
      amazonItem && (amazonItem.title || amazonItem.detailTextSample || amazonItem.rawText),
    ].filter(Boolean).join(' '));
    const candidates = [];
    const push = (value, patterns) => {
      if (patterns.some((pattern) => pattern.test(source)) && !candidates.includes(value)) candidates.push(value);
    };
    push('acrylic', [/\bacrylic\b/, /\bplexiglass\b/, /\bpmma\b/]);
    push('plastic', [/\bplastic\b/, /\bpp\b/, /\bpet\b/, /\babs\b/, /\bpolypropylene\b/, /\bpolyethylene\b/]);
    push('silicone', [/\bsilicone\b/]);
    push('rubber', [/\brubber\b/]);
    push('metal', [/\bmetal\b/, /\bstainless steel\b/, /\baluminum\b/, /\baluminium\b/, /\bcopper\b/]);
    push('wood', [/\bwood\b/, /\bbamboo\b/]);
    push('fiberglass', [/\bfiberglass\b/, /\bglass fiber\b/]);
    return candidates.length ? candidates : ['plastic'];
  }

  function chooseDxmAttributeValue(attribute, payload, product) {
    const values = getDxmAttributeValues(attribute);
    if (!values.length) return null;
    const attrName = normalizeCategoryText(firstNonEmpty(attribute.attrName, attribute.attrNameZh, attribute.attrNameId));
    const title = normalizeCategoryText(firstNonEmpty(payload.subject, product.subject, product.title, product.productTitle, ''));

    if (attrName.includes('brand')) return findDxmValue(values, [/^none$/i, /^no brand$/i]) || values[0];
    if (attrName.includes('high-concerned chemical')) return findDxmValue(values, [/\u5929\u7136\u672a\u5904\u7406/i, /^none$/i, /^no$/i]) || values[0];
    if (attrName.includes('origin')) {
      return findDxmValue(values, [/us\(origin\)/i, /united states/i, /\busa\b/i, /\bus\b/i, /\u7f8e\u56fd/i]) || values[0];
    }
    if (attrName.includes('function')) {
      return findDxmValue(values, [/^other$/i, /\u5176\u4ed6/i, /reusable/i, /\u53ef\u91cd\u590d\u4f7f\u7528/i]) || values[0];
    }
    if (attrName === 'use' || attrName.includes(' use') || attrName.includes('\u7528\u9014')) {
      return findDxmValue(values, [/^other$/i, /\u5176\u4ed6/i, /home/i, /household/i, /office/i, /storage/i]) || values[0];
    }
    if (attrName.includes('electric')) {
      if (/rechargeable|battery|usb|electric|power/i.test(title)) return findDxmValue(values, [/^yes$/i]) || values[0];
      return findDxmValue(values, [/^no$/i]) || values[0];
    }
    if (attrName.includes('foldable')) {
      return findDxmValue(values, title.includes('fold') ? [/^yes$/i] : [/^no$/i]) || values[0];
    }
    if (attrName.includes('remote control')) {
      return findDxmValue(values, title.includes('remote') ? [/^yes$/i] : [/^no$/i]) || values[0];
    }
    if (attrName.includes('number') && (attrName.includes('rib') || attrName.includes('blade'))) {
      const numberMatch = title.match(/\b(\d{1,2})\s*(?:blade|blades|rib|ribs)\b/);
      if (numberMatch) {
        const exact = findDxmValue(values, [new RegExp(`^${numberMatch[1]}$`, 'i')]);
        if (exact) return exact;
      }
      return findDxmValue(values, [/^none$/i, /^1$/i]) || values[0];
    }
    if (attrName.includes('material')) {
      const materialTerms = inferMaterialCandidates(payload, product);
      for (const term of materialTerms) {
        const matched = findDxmValue(values, [new RegExp(term, 'i')]);
        if (matched) return matched;
      }
      return findDxmValue(values, [/^plastic$/i, /^abs$/i, /acrylic/i, /silicone/i, /rubber/i, /^metal$/i]) || values[0];
    }
    return findDxmValue(values, [/^none$/i, /^no$/i, /^other$/i]) || values[0];
  }

  function buildDxmRequiredProperties(attributeResponse, payload, product) {
    const attributes = attributeResponse && Array.isArray(attributeResponse.data) ? attributeResponse.data : [];
    return attributes
      .filter((attribute) => Number(attribute && attribute.isRequired) === 1 && Number(attribute && attribute.isSku) !== 1)
      .map((attribute) => {
        const selected = chooseDxmAttributeValue(attribute, payload, product);
        if (!selected) return null;
        return {
          attr_name_id: String(attribute.attrNameId),
          attr_name: String(firstNonEmpty(attribute.attrName, attribute.attrNameZh, attribute.attrNameId)),
          attr_value_id: selected.id,
          attr_value: selected.name,
          attr_value_unit: null,
          attr_value_start: null,
          attr_value_end: null,
        };
      })
      .filter(Boolean);
  }

  const SKU_VALUE_SYNONYMS = {
    color: {
      apricot: [/^creamy white$/i, /^khaki$/i, /^light yellow$/i, /^orange$/i],
      beige: [/^khaki$/i, /^creamy white$/i, /^light yellow$/i],
      cream: [/^creamy white$/i, /^white$/i],
      creamy: [/^creamy white$/i, /^white$/i],
      ivory: [/^creamy white$/i, /^white$/i],
      grey: [/^grey$/i, /^light grey$/i, /^dark gray$/i],
      gray: [/^grey$/i, /^light grey$/i, /^dark gray$/i],
      black: [/^black$/i],
      white: [/^white$/i, /^pure white$/i],
      blue: [/^blue$/i, /blue/i],
      green: [/^green$/i, /green/i],
      red: [/^red$/i],
      yellow: [/^yellow$/i, /^light yellow$/i],
      orange: [/^orange$/i],
      brown: [/^brown$/i],
      silver: [/^silver$/i],
      gold: [/^gold$/i],
      purple: [/violet/i],
      violet: [/violet/i],
      navy: [/^navy$/i, /blue/i],
      khaki: [/^khaki$/i, /^dark khaki$/i],
    },
  };

  function chooseSkuAttributeValue(attribute, rawValue) {
    const values = getDxmAttributeValues(attribute);
    if (!values.length) return null;
    const normalizedRaw = normalizeCategoryText(rawValue);
    if (!normalizedRaw) return null;
    const exact = values.find((item) => normalizeCategoryText(item.name) === normalizedRaw);
    if (exact) return exact;

    const attrName = normalizeCategoryText(firstNonEmpty(attribute.attrName, attribute.attrNameZh, attribute.attrNameId));
    const synonymGroup = SKU_VALUE_SYNONYMS[attrName];
    if (synonymGroup) {
      for (const [sourceTerm, patterns] of Object.entries(synonymGroup)) {
        if (!normalizedRaw.includes(sourceTerm)) continue;
        const found = findDxmValue(values, patterns);
        if (found) return found;
      }
    }
    return null;
  }

  function applyDxmSkuAttributeIds(payload, attributeResponse) {
    const attributes = attributeResponse && Array.isArray(attributeResponse.data) ? attributeResponse.data : [];
    const skuAttributes = attributes.filter((attribute) => Number(attribute && attribute.isSku) === 1);
    if (!skuAttributes.length) return { changed: false, rowsChanged: 0 };
    const variations = parseMaybeJson(payload.variationListStr, []);
    if (!Array.isArray(variations) || !variations.length) return { changed: false, rowsChanged: 0 };
    let rowsChanged = 0;

    for (const sku of variations) {
      const skuProperties = parseMaybeJson(sku.skuPropertyListJson, []);
      if (!Array.isArray(skuProperties) || !skuProperties.length) continue;
      let rowChanged = false;
      for (const property of skuProperties) {
        const propertyName = normalizeCategoryText(firstNonEmpty(property.sku_property_name, property.propertyName, ''));
        const attribute = skuAttributes.find((item) => normalizeCategoryText(item.attrName) === propertyName);
        if (!attribute) continue;
        if (String(property.sku_property_id || '') !== String(attribute.attrNameId)) {
          property.sku_property_id = String(attribute.attrNameId);
          rowChanged = true;
        }
        if (!property.property_value_id) {
          const currentValue = normalizeCategoryText(firstNonEmpty(property.sku_property_value, property.property_value_definition_name, ''));
          const selected = chooseSkuAttributeValue(attribute, currentValue);
          if (selected && selected.id) {
            property.property_value_id = selected.id;
            if (normalizeCategoryText(selected.name) !== currentValue) {
              property.property_value_definition_name = firstNonEmpty(property.property_value_definition_name, property.sku_property_value);
              property.sku_property_value = selected.name;
            }
            rowChanged = true;
          }
        }
      }
      if (rowChanged) {
        sku.skuPropertyListJson = JSON.stringify(skuProperties);
        rowsChanged += 1;
      }
    }
    if (rowsChanged) payload.variationListStr = JSON.stringify(variations);
    return { changed: rowsChanged > 0, rowsChanged };
  }

  async function resolveCategoryWithDxmApi(payload, editData) {
    const product = getProductFromEdit(editData) || {};
    const diagnostics = payload.__diagnostics && payload.__diagnostics.derived ? payload.__diagnostics.derived : null;
    const currentResolver = diagnostics ? diagnostics.categoryResolver : null;
    if (currentResolver && currentResolver.status === 'resolved' && isNumericPublishCategoryId(payload.categoryId)) {
      return currentResolver;
    }

    const shopId = String(firstNonEmpty(payload.shopId, product.shopId, product.shop_id, ''));
    if (!shopId) return currentResolver;
    const amazonItem = getAmazonBatchItem(product);
    const terms = buildCategorySearchTerms(payload, product, amazonItem);
    const attempts = [];
    let best = null;

    for (const term of terms) {
      try {
        const response = await apiFetchJson('/api/smtlocalCategory/listByCategoryName.json', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
          body: new URLSearchParams({ shopId, categoryName: term }),
        });
        const candidates = collectCategoryCandidates(response)
          .map((candidate) => ({
            ...candidate,
            confidence: scoreDxmCategoryCandidate(candidate, payload, product, term),
            searchTerm: term,
          }))
          .sort((a, b) => b.confidence - a.confidence);
        attempts.push({
          term,
          count: candidates.length,
          top: candidates.slice(0, 5).map((candidate) => ({
            categoryId: candidate.categoryId,
            categoryName: candidate.categoryName,
            categoryPath: candidate.categoryPath,
            confidence: candidate.confidence,
            semanticPenalty: candidate.semanticPenalty || null,
          })),
        });
        if (candidates[0] && (!best || candidates[0].confidence > best.confidence)) best = candidates[0];
        if (best && best.confidence >= 0.9) break;
      } catch (error) {
        attempts.push({ term, error: String(error && error.message ? error.message : error) });
      }
    }

    const resolved = best && best.confidence >= 0.72 && isNumericPublishCategoryId(best.categoryId);
    const resolver = resolved
      ? {
          status: 'resolved',
          source: 'dianxiaomi_category_search_api',
          publishCategoryId: String(best.categoryId),
          categoryPath: best.categoryPath || best.categoryName || '',
          properties: getCategoryPropertiesById(best.categoryId),
          confidence: best.confidence,
          ruleId: `dxm-category-search:${best.categoryId}`,
          matchedTerms: [best.searchTerm, best.categoryName].filter(Boolean),
          attempts,
          selected: {
            categoryId: best.categoryId,
            categoryName: best.categoryName,
            categoryPath: best.categoryPath,
            isLeaf: best.isLeaf,
            semanticPenalty: best.semanticPenalty || null,
          },
        }
      : {
          status: 'unresolved',
          source: 'dianxiaomi_category_search_api',
          publishCategoryId: '',
          categoryPath: '',
          properties: null,
          confidence: best ? best.confidence : 0,
          ruleId: best ? `dxm-category-search-candidate:${best.categoryId}` : '',
          matchedTerms: best ? [best.searchTerm, best.categoryName].filter(Boolean) : [],
          attempts,
          selected: best
            ? {
                categoryId: best.categoryId,
                categoryName: best.categoryName,
                categoryPath: best.categoryPath,
                isLeaf: best.isLeaf,
                semanticPenalty: best.semanticPenalty || null,
              }
            : null,
        };

    if (diagnostics) {
      diagnostics.categoryResolver = resolver;
      diagnostics.defaultRulesApplied = diagnostics.defaultRulesApplied || [];
    }

    if (resolved) {
      payload.categoryId = String(best.categoryId);
      if (diagnostics && diagnostics.defaultRulesApplied) {
        diagnostics.defaultRulesApplied.push(`categoryId resolved by Dianxiaomi category search API: ${best.categoryId} ${best.categoryName}`);
      }
      const attrResult = await fetchDxmCategoryAttributes(best.categoryId, shopId);
      resolver.attributeFetch = attrResult.calls;
      resolver.attributeResponseCaptured = Boolean(attrResult.response);
      if (attrResult.response) {
        const requiredProperties = buildDxmRequiredProperties(attrResult.response, payload, product);
        if (requiredProperties.length) {
          const beforeProperties = parseMaybeJson(payload.productPropertyListJson, []);
          payload.productPropertyListJson = JSON.stringify(mergeRequiredProperties(beforeProperties, requiredProperties));
          resolver.properties = requiredProperties;
          resolver.requiredPropertyCount = requiredProperties.length;
          if (diagnostics && diagnostics.defaultRulesApplied) {
            diagnostics.defaultRulesApplied.push(`dynamic category required properties applied: ${requiredProperties.map((item) => item.attr_name).join(', ')}`);
          }
        }
        const skuPatch = applyDxmSkuAttributeIds(payload, attrResult.response);
        resolver.skuAttributePatch = skuPatch;
        if (skuPatch.changed && diagnostics && diagnostics.defaultRulesApplied) {
          diagnostics.defaultRulesApplied.push(`dynamic SKU attribute ids applied on ${skuPatch.rowsChanged} rows`);
        }
      }
    } else if (diagnostics && diagnostics.defaultRulesApplied) {
      diagnostics.defaultRulesApplied.push('category search API did not find a high-confidence publish category; keep dry-run blocked');
    }

    return resolver;
  }

  const state = {
    productId: '',
    editData: null,
    inputEditData: null,
    afterOp1EditData: null,
    payload: null,
    zipBlob: null,
    report: null,
    savePayloadLearning: null,
    apiRecords: [],
    publishResult: null,
    submitting: false,
  };

  function $(selector) {
    return document.querySelector(selector);
  }

  function getPanelInputValue(field, fallback = '') {
    const input = $(`#${PANEL_ID} [data-field="${field}"]`);
    if (input && input.value != null && String(input.value).trim() !== '') {
      return String(input.value).trim();
    }
    return fallback;
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function rememberApiRecord(record) {
    state.apiRecords.push({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      createdAt: nowIso(),
      page: location.href,
      ...record,
    });
    state.apiRecords = state.apiRecords.slice(-200);
  }

  function installPublishNetworkObserver() {
    if (window.__dxmAutomationPublishObserverInstalled) return;
    window.__dxmAutomationPublishObserverInstalled = true;
    const shouldRecord = (url) => /smtlocalProduct|publish|online|offline|save\.json/i.test(String(url || ''));

    const originalFetch = window.fetch;
    if (typeof originalFetch === 'function') {
      window.fetch = async function dxmAutomationFetch(input, init) {
        const url = typeof input === 'string' ? input : input && input.url;
        const method = (init && init.method) || (input && input.method) || 'GET';
        const startedAt = performance.now();
        const response = await originalFetch.apply(this, arguments);
        if (shouldRecord(url)) {
          response.clone().text().then((text) => {
            rememberApiRecord({
              source: 'window.fetch',
              url: String(url || ''),
              method: String(method).toUpperCase(),
              status: response.status,
              ok: response.ok,
              durationMs: Math.round(performance.now() - startedAt),
              responseText: text.slice(0, 2000),
            });
          }).catch(() => {});
        }
        return response;
      };
    }

    const OriginalXHR = window.XMLHttpRequest;
    if (typeof OriginalXHR === 'function') {
      window.XMLHttpRequest = function DxmAutomationXMLHttpRequest() {
        const xhr = new OriginalXHR();
        let meta = { method: '', url: '' };
        const originalOpen = xhr.open;
        xhr.open = function open(method, url) {
          meta = { method: String(method || 'GET').toUpperCase(), url: String(url || '') };
          return originalOpen.apply(xhr, arguments);
        };
        xhr.addEventListener('loadend', () => {
          if (!shouldRecord(meta.url)) return;
          rememberApiRecord({
            source: 'XMLHttpRequest',
            url: meta.url,
            method: meta.method,
            status: xhr.status,
            ok: xhr.status >= 200 && xhr.status < 300,
            responseText: String(xhr.responseText || '').slice(0, 2000),
          });
        });
        return xhr;
      };
    }
  }

  function log(message, detail) {
    const box = $(`#${PANEL_ID} [data-field="log"]`);
    if (!box) return;
    const line = document.createElement('div');
    line.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    box.prepend(line);
    if (detail !== undefined) console.info(`[${APP_NAME}] ${message}`, detail);
  }

  function setText(name, value) {
    const node = $(`#${PANEL_ID} [data-field="${name}"]`);
    if (node) node.textContent = value == null ? '' : String(value);
  }

  function updateUi() {
    setText('productId', state.productId || '\u672a\u8bfb\u53d6');
    setText('dryRun', state.report ? (state.report.pass ? '\u901a\u8fc7' : '\u672a\u901a\u8fc7') : '\u672a\u6267\u884c');
    setText('riskCount', state.report ? state.report.risks.length : 0);
    setText('publishStatus', state.publishResult ? state.publishResult.status : '未执行');
    setText(
      'op1Persistence',
      state.report && state.report.persistenceCheck
        ? state.report.persistenceCheck.persisted
          ? '\u5df2\u843d\u5e93'
          : '\u672a\u901a\u8fc7'
        : '\u672a\u9a8c\u8bc1'
    );
    const submitButton = $(`#${PANEL_ID} [data-action="submit"]`);
    const saveCompletionButton = $(`#${PANEL_ID} [data-action="saveCompletion"]`);
    const downloadButton = $(`#${PANEL_ID} [data-action="downloadZip"]`);
    const reportButton = $(`#${PANEL_ID} [data-action="downloadReport"]`);
    const runBundleButton = $(`#${PANEL_ID} [data-action="downloadRunBundle"]`);
    const learnSavePayloadButton = $(`#${PANEL_ID} [data-action="learnSavePayload"]`);
    const publishCurrentButton = $(`#${PANEL_ID} [data-action="publishCurrentTest"]`);
    const allow = $(`#${PANEL_ID} [data-field="allowSubmit"]`);
    const code = $(`#${PANEL_ID} [data-field="submitCode"]`);
    const canSubmit = false;
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.title = '本阶段禁止 op=2；仅允许 save.json op=1 落库验证';
    }
    if (saveCompletionButton) saveCompletionButton.disabled = !state.report || !state.report.pass || state.submitting;
    if (downloadButton) downloadButton.disabled = !state.zipBlob;
    if (reportButton) reportButton.disabled = !state.report;
    if (runBundleButton) runBundleButton.disabled = !state.report;
    if (learnSavePayloadButton) learnSavePayloadButton.disabled = state.submitting;
    if (publishCurrentButton) publishCurrentButton.disabled = state.submitting || !/\/web\/smtlocalProduct\/offline/i.test(location.pathname);
    if (saveCompletionButton) {
      saveCompletionButton.title = '调用 save.json op=1，验证是否可替代 UI 保存并进入 DXM 产品库；不会调用 op=2 发布。';
    }
  }

  function extractProductIdFromCurrentPage() {
    const search = new URLSearchParams(location.search);
    const queryId = firstNonEmpty(search.get('id'), search.get('productId'), search.get('ids'));
    if (/^\d{10,}$/.test(String(queryId || ''))) return String(queryId);

    const inputs = Array.from(document.querySelectorAll('input[name="id"], input[name="productId"], input[data-field*="id" i]'));
    for (const input of inputs) {
      if (/^\d{10,}$/.test(String(input.value || ''))) return String(input.value);
    }

    const hrefMatch = location.href.match(/(?:id|productId)[=/](\d{10,})/i);
    if (hrefMatch) return hrefMatch[1];

    const text = document.body ? document.body.innerText : '';
    const idMatch = text.match(/\b(1\d{17})\b/);
    return idMatch ? idMatch[1] : '';
  }

  function extractProductIdFromText(text) {
    const source = String(text || '');
    const patterns = [
      /(?:id|productId|product_id|ids)[^\d]{0,12}(1\d{17})/i,
      /\b(1\d{17})\b/,
    ];
    for (const pattern of patterns) {
      const match = source.match(pattern);
      if (match) return match[1];
    }
    return '';
  }

  function extractProductIdFromNode(node) {
    if (!node) return '';
    const chunks = [];
    const push = (value) => {
      if (value !== undefined && value !== null) chunks.push(String(value));
    };

    if (node.matches && node.matches('input')) push(node.value);
    if (node.getAttribute) {
      for (const attr of ['href', 'onclick', 'data-id', 'data-product-id', 'data-productid', 'value']) {
        push(node.getAttribute(attr));
      }
    }
    for (const child of Array.from(node.querySelectorAll ? node.querySelectorAll('a,button,input,[onclick],[data-id],[data-product-id],[data-productid]') : [])) {
      push(child.value);
      for (const attr of ['href', 'onclick', 'data-id', 'data-product-id', 'data-productid', 'value']) {
        push(child.getAttribute && child.getAttribute(attr));
      }
    }
    return extractProductIdFromText(chunks.join(' '));
  }

  function getProductRowsFromCurrentList() {
    const rows = Array.from(document.querySelectorAll('tbody tr, table tr')).filter((row) => {
      const text = row.innerText || '';
      return row.querySelector('img') && (text.includes('\u7f16\u8f91') || text.includes('\u53d1\u5e03') || text.includes('\u66f4\u591a') || text.includes('\u4e9a\u9a6c\u900a'));
    });
    return rows.length ? rows : Array.from(document.querySelectorAll('tr')).filter((row) => row.querySelector('input[type="checkbox"]'));
  }

  function extractProductIdFromCurrentList() {
    const rows = getProductRowsFromCurrentList();
    const checkedRow = rows.find((row) => row.querySelector('input[type="checkbox"]:checked'));
    const candidates = checkedRow ? [checkedRow, ...rows.filter((row) => row !== checkedRow)] : rows;
    for (const row of candidates) {
      const id = extractProductIdFromNode(row);
      if (id) return id;
    }
    return '';
  }

  function visibleElement(element) {
    if (!element) return false;
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
  }

  function getInputText(element) {
    if (!element) return '';
    if (element.isContentEditable) return String(element.textContent || '').trim();
    return String(element.value || element.getAttribute('value') || '').trim();
  }

  function getVisibleInputValues() {
    return Array.from(document.querySelectorAll('input,textarea,[contenteditable="true"]'))
      .filter(visibleElement)
      .map((node) => ({
        node,
        text: getInputText(node),
        placeholder: String(node.getAttribute('placeholder') || ''),
        name: String(node.getAttribute('name') || ''),
        title: String(node.getAttribute('title') || ''),
        type: String(node.getAttribute('type') || ''),
      }))
      .filter((item) => item.text);
  }

  function findVisibleInputValue(test) {
    const item = getVisibleInputValues().find(test);
    return item ? item.text : '';
  }

  function extractShopIdFromCurrentPage() {
    const html = document.documentElement ? document.documentElement.innerHTML : '';
    const patterns = [
      /["']shopId["']\s*[:=]\s*["']?(\d{5,})["']?/i,
      /shopId[^\d]{0,20}(\d{5,})/i,
      /shop_id[^\d]{0,20}(\d{5,})/i,
    ];
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match && match[1] !== '-1') return match[1];
    }
    return getDefaultShopId();
  }

  function extractSubjectFromCurrentEditPage() {
    const titleLike = findVisibleInputValue((item) => {
      const text = item.text;
      if (text.length < 20) return false;
      if (/^https?:\/\//i.test(text)) return false;
      if (/^\d+(\.\d+)?$/.test(text)) return false;
      return /[a-z]/i.test(text);
    });
    return titleLike;
  }

  function extractSourceUrlFromCurrentEditPage() {
    return findVisibleInputValue((item) => /amazon\.com|\/dp\/B0/i.test(item.text));
  }

  function extractMainImagesFromCurrentEditPage() {
    const urls = Array.from(document.querySelectorAll('img'))
      .map((img) => img.currentSrc || img.src || img.getAttribute('data-src') || '')
      .filter((url) => /^https?:\/\//i.test(url))
      .filter((url) => !/logo|avatar|icon|sprite|data:image/i.test(url))
      .filter((url) => /amazon|alicdn|cos|wxalbum|images/i.test(url));
    return Array.from(new Set(urls)).slice(0, 8);
  }

  function extractEditPageSkuSnapshot(sourceUrl, subject) {
    const asin = extractAsin(`${sourceUrl} ${subject}`);
    const values = getVisibleInputValues();
    const numericValues = values
      .map((item) => Number(String(item.text).replace(/[^\d.]/g, '')))
      .filter((value) => Number.isFinite(value) && value > 0);
    const price = numericValues.find((value) => value >= 5 && value <= 1000) || '';
    const stock = numericValues.find((value) => value > 0 && value <= 9999 && value !== price) || Number(getDefaultStock() || 15);
    const skuText = values.map((item) => item.text).find((text) => /^[A-Z0-9][A-Z0-9 -]{1,40}$/i.test(text) && !/请输入|please enter/i.test(text));
    const skuCode = asin || skuText || extractProductIdFromCurrentPage();
    return [{
      id: null,
      skuId: null,
      skuCode,
      gloGoodsValue: price || '',
      gloLogisticValue: 0,
      supplyPrice: price || '',
      specialProductTypeListJson: '',
      skuStockWareType: '',
      skuWarehouseStockListJson: '',
      sellableQuantity: stock,
      effectiveSupplyPrice: null,
      packageWeight: getDefaultWeightKg(),
      packageLength: getDefaultLength(),
      packageWidth: getDefaultWidth(),
      packageHeight: getDefaultHeight(),
      packageWeightUnit: null,
      status: 'active',
      skuPropertyListJson: JSON.stringify([{ ...US_SHIPS_FROM_PROPERTY }]),
      imageList: null,
      destCountrySupplyPriceListJson: '',
    }];
  }

  function buildDomProductSnapshot(editData) {
    if (!/\/web\/smtlocalProduct\/edit/i.test(location.pathname)) return null;
    const id = extractProductIdFromCurrentPage();
    const subject = extractSubjectFromCurrentEditPage();
    const sourceUrl = extractSourceUrlFromCurrentEditPage();
    const images = extractMainImagesFromCurrentEditPage();
    const detailText = subject ? `Product Description\n${subject}` : '';
    if (!subject && !sourceUrl && !images.length) return null;
    return {
      __domFallback: true,
      id,
      shopId: extractShopIdFromCurrentPage(),
      subject,
      sourceUrl,
      fullCid: '',
      categoryId: '',
      dxmState: 'draft',
      currencyCode: 'USD',
      mainImageListJson: JSON.stringify(images),
      detailWeb: detailText ? buildPcDetailWeb(detailText, images, subject) : '',
      detailMobile: JSON.stringify({
        moduleList: detailText ? [{ type: 'text', texts: [{ class: 'body', content: detailText }] }] : [],
        version: '2.0.0',
      }),
      variationList: extractEditPageSkuSnapshot(sourceUrl, subject),
      productPropertyListJson: '[]',
      postageId: getDefaultPostageId(),
      deliveryTime: '7',
      productUnit: '100000015',
      productId: null,
      __editDataKeys: editData && editData.data ? Object.keys(editData.data) : Object.keys(editData || {}),
    };
  }

  function isMetadataOnlyEditProduct(product) {
    if (!product || typeof product !== 'object') return true;
    const keys = Object.keys(product);
    if (!keys.length) return true;
    const productSignals = ['id', 'shopId', 'subject', 'sourceUrl', 'mainImageListJson', 'variationList', 'variationListStr'];
    return !productSignals.some((key) => isUsableValue(product[key]));
  }

  function normalizeJsonString(value, fallback) {
    if (value == null || value === '') return fallback == null ? '' : JSON.stringify(fallback);
    if (typeof value === 'string') return value;
    return JSON.stringify(value);
  }

  function firstNonEmpty(...values) {
    for (const value of values) {
      if (value !== undefined && value !== null && value !== '') return value;
    }
    return '';
  }

  function extractAsin(text) {
    const source = String(text || '');
    const direct = source.match(/\/dp\/([A-Z0-9]{10})(?:[/?]|$)/i) || source.match(/\b(B0[A-Z0-9]{8})\b/i);
    return direct ? direct[1].toUpperCase() : '';
  }

  function readAmazonPublicBatch() {
    try {
      const parsed = JSON.parse(localStorage.getItem(AMAZON_PUBLIC_BATCH_KEY) || '{}');
      return parsed && parsed.batch && Array.isArray(parsed.batch.items) ? parsed.batch : null;
    } catch (_) {
      return null;
    }
  }

  function getAmazonBatchItem(product) {
    const asin = extractAsin(`${product.sourceUrl || ''} ${product.sourceId || ''} ${product.platformProductId || ''} ${product.subject || ''}`);
    if (!asin) return null;
    const batch = readAmazonPublicBatch();
    if (!batch) return null;
    return (batch.items || []).find((item) => extractAsin(`${item.asin || ''} ${item.url || ''} ${item.rawUrl || ''}`) === asin) || null;
  }

  function getSelectedAmazonBatchItem(options = {}) {
    const batch = readAmazonPublicBatch();
    const items = batch && Array.isArray(batch.items) ? batch.items : [];
    const requestedAsin = extractAsin(getAmazonSourceAsin());
    const usableItems = items.filter((item) => item && extractAsin(`${item.asin || ''} ${item.url || ''} ${item.rawUrl || ''}`));
    let item = null;
    if (requestedAsin) {
      item = usableItems.find((entry) => extractAsin(`${entry.asin || ''} ${entry.url || ''} ${entry.rawUrl || ''}`) === requestedAsin) || null;
    }
    if (!item) {
      item = usableItems.find((entry) => entry.status === 'candidate' && entry.title && entry.image) ||
        usableItems.find((entry) => entry.title && entry.image) ||
        usableItems[0] ||
        null;
    }
    if (!item && !options.silent) {
      throw new Error('未读取到 Amazon 采集商品。请先在 Amazon 采集插件生成批次，或在 Amazon ASIN 输入框指定一个已采集 ASIN。');
    }
    return item;
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

  function sanitizeJsonTextFields(jsonText, fallback) {
    const parsed = parseMaybeJson(jsonText, fallback);
    return JSON.stringify(sanitizePlatformTextDeep(parsed));
  }

  function sanitizeHtmlTextContent(html) {
    const source = String(html || '');
    if (!source.includes('<')) return sanitizePlatformText(source);
    const root = document.createElement('div');
    root.innerHTML = source;
    const visit = (node) => {
      if (node.nodeType === 3) {
        node.nodeValue = sanitizePlatformText(node.nodeValue);
        return;
      }
      if (node.nodeType !== 1) return;
      for (const attr of ['alt', 'title']) {
        if (node.hasAttribute && node.hasAttribute(attr)) {
          node.setAttribute(attr, sanitizePlatformText(node.getAttribute(attr)));
        }
      }
      Array.from(node.childNodes || []).forEach(visit);
    };
    Array.from(root.childNodes || []).forEach(visit);
    return root.innerHTML;
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
    const detailSource = `${item.detailTextSample || ''}\n${item.rawText || ''}`;
    const brandMatch = detailSource.match(/\bbrand\s*(?:name)?\s*[:：]\s*([^\n,;|]+)/i);
    if (brandMatch && brandMatch[1]) candidates.push(brandMatch[1]);
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

  function hasForbiddenCommerceTerms(text, item = null) {
    return findForbiddenTitleTerms(text, item).length > 0;
  }

  function fallbackProductTitle(item) {
    const source = `${item && item.title ? item.title : ''} ${item && item.categoryTerm ? item.categoryTerm : ''}`.toLowerCase();
    if (source.includes('sink') || source.includes('drain') || source.includes('strainer')) {
      return 'Kitchen Sink Drain Strainer Stopper for Home Use';
    }
    if (source.includes('organizer') || source.includes('storage')) {
      return 'Home Storage Organizer for Everyday Household Use';
    }
    if (source.includes('mat') || source.includes('rug')) {
      return 'Household Mat for Everyday Indoor Use';
    }
    return 'Home Utility Product for Everyday Use';
  }

  function buildCompliantProductTitle(originalTitle, item) {
    let title = sanitizePlatformText(firstNonEmpty(originalTitle, item && item.title, fallbackProductTitle(item)));
    for (let attempt = 0; attempt < 4; attempt += 1) {
      title = stripForbiddenCommerceTerms(title, item)
        .replace(/\([^)]*(?:amazon|official|brand|store|trademark)[^)]*\)/gi, ' ')
        .replace(/\[[^\]]*(?:amazon|official|brand|store|trademark)[^\]]*\]/gi, ' ')
        .replace(/\b(?:new|sale|deal|cheap|discount|must-have)\b/gi, ' ')
        .replace(/[|_/]+/g, ' ')
        .replace(/\s*[-:;]\s*/g, ' ');
      title = toSimpleTitleCase(title);
      title = truncateAtWord(title, EDIT_PAGE_RULES.titleMaxChars);
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

  function buildCompliantPcDescription(item, compliantTitle) {
    const productName = buildCompliantProductTitle(compliantTitle, item);
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
    while (plainTextFromHtml(description).length < EDIT_PAGE_RULES.pcDescriptionMinChars) {
      description += '\n- Additional Detail: built for straightforward daily use, with neutral styling and practical proportions that make it suitable for repeated handling in common home environments.';
      description = sanitizePlatformText(stripForbiddenCommerceTerms(description, item));
    }
    return description;
  }

  function buildDetailMobileFromText(text) {
    return JSON.stringify({
      moduleList: [{ type: 'text', texts: [{ class: 'body', content: text }] }],
      version: '2.0.0',
    });
  }

  function normalizeImageList(value) {
    const parsed = typeof value === 'string' ? parseMaybeJson(value, value) : value;
    const list = Array.isArray(parsed) ? parsed : [parsed];
    const urls = [];
    for (const item of list) {
      if (!item) continue;
      if (typeof item === 'string') {
        const nested = parseMaybeJson(item, null);
        if (Array.isArray(nested) || (nested && typeof nested === 'object')) {
          urls.push(...normalizeImageList(nested));
          continue;
        }
        if (item.includes('|')) urls.push(...item.split('|'));
        else urls.push(item);
        continue;
      }
      if (typeof item === 'object') {
        urls.push(item.url || item.imgUrl || item.image || item.src || item.imageUrl || '');
      }
    }
    return Array.from(new Set(urls.map((url) => String(url || '').trim()).filter(Boolean)));
  }

  function selectMarketingImages(product, mainImages) {
    const generatedImages = normalizeImageList([
      product && product.marketImage1,
      product && product.marketImage2,
      product && product.marketImageListJson,
      product && product.marketingImages,
    ]);
    const sourceImages = generatedImages.length >= EDIT_PAGE_RULES.marketingImageCount ? generatedImages : normalizeImageList(mainImages);
    const selected = sourceImages.slice(0, EDIT_PAGE_RULES.marketingImageCount);
    while (selected.length === 1 && selected.length < EDIT_PAGE_RULES.marketingImageCount) selected.push(selected[0]);
    return {
      images: selected,
      source: generatedImages.length >= EDIT_PAGE_RULES.marketingImageCount ? 'one_key_generated_or_existing' : 'main_image_fallback',
      issue: selected.length < EDIT_PAGE_RULES.marketingImageCount
        ? '营销图片不足 2 张：一键生成或图片源未提供足够结果'
        : generatedImages.length >= EDIT_PAGE_RULES.marketingImageCount
          ? ''
          : '未检测到一键生成的 2 张营销图，已临时使用主图兜底；正式执行需优先一键生成',
    };
  }

  function buildAmazonVariationList(item) {
    const asin = extractAsin(`${item.asin || ''} ${item.url || ''} ${item.rawUrl || ''}`);
    const sourcePrice = firstNonEmpty(positiveNumber(getDefaultSourcePrice()), positiveNumber(item.price));
    const supplyPrice = firstNonEmpty(getDefaultSupplyPrice(), calculateSupplyPriceCny(sourcePrice));
    const dimensionsCm = item.dimensionsCm || dimensionsInToCm(item.dimensionsIn);
    const length = firstNonEmpty(dimensionsCm && dimensionsCm.length, inchToCm(getDefaultLengthIn()), getDefaultLength());
    const width = firstNonEmpty(dimensionsCm && dimensionsCm.width, inchToCm(getDefaultWidthIn()), getDefaultWidth());
    const height = firstNonEmpty(dimensionsCm && dimensionsCm.height, inchToCm(getDefaultHeightIn()), getDefaultHeight());
    return [{
      id: null,
      skuId: null,
      skuCode: asin,
      gloGoodsValue: supplyPrice ? Number(supplyPrice) : '',
      gloLogisticValue: 0,
      supplyPrice: supplyPrice ? Number(supplyPrice) : '',
      specialProductTypeListJson: '',
      skuStockWareType: '',
      skuWarehouseStockListJson: '',
      sellableQuantity: Number(getDefaultStock() || 15),
      effectiveSupplyPrice: null,
      packageWeight: firstNonEmpty(item.weightKg, getDefaultWeightKg()),
      packageLength: length,
      packageWidth: width,
      packageHeight: height,
      packageWeightUnit: null,
      status: 'active',
      skuPropertyListJson: JSON.stringify([{ ...US_SHIPS_FROM_PROPERTY }]),
      imageList: item.image ? [item.image] : null,
      destCountrySupplyPriceListJson: '',
    }];
  }

  function buildAmazonProductSnapshot(editData, options = {}) {
    const item = getSelectedAmazonBatchItem({ silent: true });
    if (!item) {
      if (!options.silent) getSelectedAmazonBatchItem();
      return null;
    }
    const asin = extractAsin(`${item.asin || ''} ${item.url || ''} ${item.rawUrl || ''}`);
    const sourceUrl = firstNonEmpty(item.url, item.rawUrl, asin ? `https://www.amazon.com/dp/${asin}` : '');
    const title = buildCompliantProductTitle(String(firstNonEmpty(item.title, asin ? `Product ${asin}` : '')).trim(), item);
    const detailText = buildCompliantPcDescription(item, title);
    const images = normalizeImageList([item.images, item.imageList, item.image]);
    const marketingSelection = selectMarketingImages(item, images);
    return {
      __amazonSource: true,
      __sourceMode: 'amazon_crawlbox_empty_form',
      __editDataKeys: editData && editData.data ? Object.keys(editData.data) : Object.keys(editData || {}),
      id: extractProductIdFromCurrentPage(),
      shopId: extractShopIdFromCurrentPage(),
      categoryId: '',
      fullCid: '',
      subject: title,
      sourceUrl,
      sourceId: asin,
      platformProductId: asin,
      sourceCategoryName: item.categoryTerm || '',
      categoryName: item.categoryTerm || '',
      dxmState: 'draft',
      currencyCode: 'USD',
      minPrice: item.price,
      maxPrice: item.price,
      mainImageListJson: JSON.stringify(images),
      marketImage1: marketingSelection.images[0] || '',
      marketImage2: marketingSelection.images[1] || '',
      detailWeb: detailText ? buildPcDetailWeb(detailText, images, title) : '',
      detailMobile: detailText ? buildDetailMobileFromText(detailText) : JSON.stringify({ moduleList: [], version: '2.0.0' }),
      variationList: buildAmazonVariationList(item),
      productPropertyListJson: '[]',
      postageId: getDefaultPostageId(),
      deliveryTime: '7',
      productUnit: '100000015',
      productId: null,
      optionValues: ensureUsShipFromOptionValues({}),
      optionValueIds: ensureUsShipFromOptionValueIds({}),
      shipFrom: 'United States',
    };
  }

  function buildAmazonEditDataContext() {
    const product = buildAmazonProductSnapshot({}, { silent: false });
    return {
      code: 0,
      msg: 'amazon crawlbox source',
      data: {
        product,
        categoryTree: [],
        unitList: [],
      },
      sourceMode: 'amazon_crawlbox_empty_form',
      createdAt: nowIso(),
    };
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

  function productTextForMetadata(product) {
    return [
      product.subject,
      product.platformTitle,
      product.platformShortDescription,
      product.platformOtherInfo,
      product.platformDescription,
      product.detailWeb,
      product.detailMobile,
    ].filter(Boolean).join(' ');
  }

  function toNumber(value) {
    if (value == null || value === '') return null;
    const parsed = Number(String(value).replace(/[^\d.]/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }

  function round2(value) {
    return Math.round(Number(value) * 100) / 100;
  }

  function inchToCm(value) {
    const number = toNumber(value);
    return number == null ? '' : String(round2(number * 2.54));
  }

  function calculateSupplyPriceCny(sourcePriceUsd) {
    const price = toNumber(sourcePriceUsd);
    if (price == null) return '';
    const exchangeRate = toNumber(getTaskExchangeRate());
    const taskMultiplier = toNumber(getTaskPriceMultiplier());
    if (exchangeRate != null && taskMultiplier != null) {
      return String(round2(price * exchangeRate * taskMultiplier));
    }
    let multiplier = null;
    if (price >= 5 && price <= 20) multiplier = 1.55;
    if (price >= 21 && price <= 45) multiplier = 1.6;
    if (price >= 50 && price <= 250) multiplier = 1.1;
    if (multiplier == null) return '';
    return String(round2(price * 7 * multiplier));
  }

  function inferSourcePrice(product, amazonItem = null) {
    return firstNonEmpty(
      positiveNumber(getDefaultSourcePrice()),
      positiveNumber(amazonItem && amazonItem.price),
      positiveNumber(product.sourcePrice),
      positiveNumber(product.price),
      positiveNumber(product.minPrice),
      positiveNumber(product.maxPrice)
    );
  }

  function inferAmazonDimensionsCm(product, amazonItem = null) {
    if (amazonItem && amazonItem.dimensionsCm) return amazonItem.dimensionsCm;
    const fromItemIn = amazonItem && amazonItem.dimensionsIn ? amazonItem.dimensionsIn : null;
    if (fromItemIn) return dimensionsInToCm(fromItemIn);
    const fromProductIn = parseDimensionInches(productTextForMetadata(product));
    return dimensionsInToCm(fromProductIn);
  }

  function inferAmazonWeightKg(product, amazonItem = null) {
    if (amazonItem && positiveNumber(amazonItem.weightKg)) return String(positiveNumber(amazonItem.weightKg));
    return parseWeightKg(productTextForMetadata(product));
  }

  function getProductFromEdit(editData) {
    const product = (
      editData &&
      editData.data &&
      (editData.data.product || editData.data.smtLocalProduct || editData.data.localProduct || editData.data)
    );
    if (isMetadataOnlyEditProduct(product)) {
      return buildDomProductSnapshot(editData) || buildAmazonProductSnapshot(editData, { silent: true }) || product;
    }
    return product;
  }

  function assertDraftProductForMainFlow(editData) {
    const product = getProductFromEdit(editData) || {};
    const dxmState = product.dxmState || '';
    const dxmOfflineState = product.dxmOfflineState || '';
    const productState = product.productState || '';
    const isWaitPublish = dxmState === 'offline' && dxmOfflineState === 'waitPublish';
    const isPublishFail = dxmState === 'offline' && dxmOfflineState === 'publishFail';
    if (isWaitPublish) {
      throw new Error('\u5f53\u524d\u4ea7\u54c1\u5df2\u5728\u5f85\u53d1\u5e03\u72b6\u6001\uff0c\u91c7\u96c6\u7bb1 op=1 \u4e0d\u80fd\u518d\u6b21\u79fb\u5165\u5f85\u53d1\u5e03\u3002\u8bf7\u6362\u4e00\u6761\u91c7\u96c6\u7bb1\u8349\u7a3f\u4ea7\u54c1\uff1b\u5f85\u53d1\u5e03\u72b6\u6001\u9700\u8981\u53e6\u6293\u9875\u9762\u4fdd\u5b58 payload \u5b66\u4e60\u4fdd\u5b58\u7ed3\u6784\u3002');
    }
    if (isPublishFail) {
      throw new Error('\u5f53\u524d\u4ea7\u54c1\u5728\u53d1\u5e03\u5931\u8d25\u5217\u8868\uff0c\u4e0d\u5c5e\u4e8e\u91c7\u96c6\u7bb1\u8349\u7a3f\u4e3b\u6d41\u7a0b\u3002\u8bf7\u6362\u4e00\u6761\u91c7\u96c6\u7bb1\u8349\u7a3f\u4ea7\u54c1\uff0c\u6216\u5148\u6293\u53d1\u5e03\u5931\u8d25\u72b6\u6001\u7684\u9875\u9762\u4fdd\u5b58 payload\u3002');
    }
    if (dxmState && dxmState !== 'draft') {
      throw new Error(`\u5f53\u524d\u4ea7\u54c1\u72b6\u6001\u4e0d\u662f\u91c7\u96c6\u7bb1\u8349\u7a3f\uff1adxmState=${dxmState}, dxmOfflineState=${dxmOfflineState}, productState=${productState}`);
    }
  }

  function parseMaybeJson(value, fallback) {
    if (value == null || value === '') return fallback;
    if (typeof value !== 'string') return value;
    try {
      return JSON.parse(value);
    } catch (_) {
      return fallback;
    }
  }

  function mergeRequiredProperties(currentProperties, requiredProperties) {
    const current = Array.isArray(currentProperties) ? currentProperties.slice() : [];
    const required = Array.isArray(requiredProperties) ? requiredProperties : [];
    const requiredIds = new Set(required.map((item) => String(item.attr_name_id)));
    const kept = current.filter((item) => item && !requiredIds.has(String(item.attr_name_id)));
    return kept.concat(required.map((item) => ({ ...item })));
  }

  function findMissingRequiredPropertyNames(properties, requiredProperties) {
    if (!Array.isArray(requiredProperties) || !requiredProperties.length) return [];
    const propertyIds = new Set((Array.isArray(properties) ? properties : []).map((item) => String(item && item.attr_name_id)));
    return requiredProperties
      .filter((item) => !propertyIds.has(String(item.attr_name_id)))
      .map((item) => item.attr_name || item.attr_name_id);
  }

  function ensureUsShipsFromOnSku(sku) {
    const parsed = parseMaybeJson(sku.skuPropertyListJson, []);
    const list = Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    const withoutShipsFrom = list.filter((item) => String(item.sku_property_id) !== US_SHIPS_FROM_PROPERTY.sku_property_id);
    sku.skuPropertyListJson = JSON.stringify(withoutShipsFrom.concat([{ ...US_SHIPS_FROM_PROPERTY }]));
    return withoutShipsFrom.length !== list.length ? 'replaced' : 'added';
  }

  function hasUsShipsFromOnSku(sku) {
    const parsed = parseMaybeJson(sku && sku.skuPropertyListJson, []);
    if (!Array.isArray(parsed)) return false;
    return parsed.some(
      (item) =>
        String(item && item.sku_property_id) === US_SHIPS_FROM_PROPERTY.sku_property_id &&
        /united states/i.test(String(item && item.sku_property_value))
    );
  }

  function ensureUsShipFromOptionValues(rawOptionValues) {
    const optionValues = parseMaybeJson(rawOptionValues, {});
    const normalized = optionValues && typeof optionValues === 'object' && !Array.isArray(optionValues) ? optionValues : {};
    normalized['\u53d1\u8d27\u5730'] = ['United States'];
    normalized['Ships From'] = ['United States'];
    return normalized;
  }

  function ensureUsShipFromOptionValueIds(rawOptionValueIds) {
    const optionValueIds = parseMaybeJson(rawOptionValueIds, {});
    const normalized = optionValueIds && typeof optionValueIds === 'object' && !Array.isArray(optionValueIds) ? optionValueIds : {};
    normalized['\u53d1\u8d27\u5730'] = [US_SHIPS_FROM_PROPERTY.property_value_id];
    normalized['Ships From'] = [US_SHIPS_FROM_PROPERTY.property_value_id];
    return normalized;
  }

  function hasUsShipFromOptionValues(rawOptionValues, rawOptionValueIds) {
    const optionValuesText = JSON.stringify(parseMaybeJson(rawOptionValues, {})).toLowerCase();
    const optionValueIdsText = JSON.stringify(parseMaybeJson(rawOptionValueIds, {}));
    return optionValuesText.includes('united states') || optionValueIdsText.includes(US_SHIPS_FROM_PROPERTY.property_value_id);
  }

  function isBlank(value) {
    return value === undefined || value === null || value === '';
  }

  function setIfBlank(target, keys, value) {
    if (isBlank(value)) return false;
    let changed = false;
    for (const key of keys) {
      if (isBlank(target[key])) {
        target[key] = value;
        changed = true;
      }
    }
    return changed;
  }

  function setAlways(target, keys, value) {
    if (isBlank(value)) return false;
    let changed = false;
    for (const key of keys) {
      if (target[key] !== value) {
        target[key] = value;
        changed = true;
      }
    }
    return changed;
  }

  function ensureSkuCommercialFields(sku, defaults) {
    let changed = false;
    changed = setAlways(sku, ['skuCode', 'sku_code', 'merchantSku', 'sku'], defaults.skuCode) || changed;
    changed = setAlways(
      sku,
      ['gloGoodsValue', 'goodsValue', 'skuGoodsValue', 'skuValue', 'supplyPrice', 'countrySupplyPrice'],
      defaults.supplyPrice
    ) || changed;
    changed = setAlways(sku, ['gloLogisticValue', 'logisticValue', 'freight', 'freightPrice', 'skuFreight'], 0) || changed;
    changed = setAlways(sku, ['sellableQuantity', 'inventory', 'skuStock', 'stock', 'skuStockNum'], defaults.stock) || changed;
    changed = setAlways(sku, ['packageWeight', 'weight', 'skuWeight'], defaults.weight) || changed;
    changed = setAlways(sku, ['packageLength', 'length', 'skuLength'], defaults.length) || changed;
    changed = setAlways(sku, ['packageWidth', 'width', 'skuWidth'], defaults.width) || changed;
    changed = setAlways(sku, ['packageHeight', 'height', 'skuHeight'], defaults.height) || changed;
    return changed;
  }

  function escapeHtml(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function textToDetailWeb(text) {
    return escapeHtml(text)
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .map((line) => line.trim())
      .join('<br>\n');
  }

  function selectPcDetailImages(images) {
    return normalizeImageList(images)
      .filter((url) => /^https?:\/\//i.test(url))
      .filter((url) => !/logo|avatar|icon|sprite|data:image/i.test(url))
      .slice(0, EDIT_PAGE_RULES.pcDescriptionMaxImages);
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
      if (/^[A-Z][A-Za-z ]{2,}:$/.test(line)) {
        html.push(`<h3>${escapeHtml(line.replace(/:$/, ''))}</h3>`);
      } else {
        html.push(`<p>${escapeHtml(line)}</p>`);
      }
    }
    closeList();
    return html.join('\n');
  }

  function buildPcDetailWeb(text, images, altText) {
    const selectedImages = selectPcDetailImages(images);
    const alt = escapeHtml(sanitizePlatformText(altText || 'Product image'));
    const imageHtml = selectedImages
      .map((url) => {
        const safeUrl = escapeHtml(url);
        return `<p><img src="${safeUrl}" alt="${alt}" style="max-width:100%;height:auto;display:block;margin:0 auto 12px;"></p>`;
      })
      .join('\n');
    const bodyHtml = textToStructuredDetailBodyHtml(text);
    return [imageHtml, bodyHtml].filter(Boolean).join('\n');
  }

  function normalizeImageUrlForCompare(url) {
    return String(url || '').trim().replace(/\?.*$/, '');
  }

  function getDetailWebImageUrls(detailWeb) {
    const root = document.createElement('div');
    root.innerHTML = String(detailWeb || '');
    return Array.from(root.querySelectorAll('img'))
      .map((img) => img.currentSrc || img.src || img.getAttribute('src') || '')
      .filter(Boolean);
  }

  function countLeadingImageBlocks(detailWeb) {
    const root = document.createElement('div');
    root.innerHTML = String(detailWeb || '');
    let count = 0;
    for (const node of Array.from(root.childNodes || [])) {
      if (node.nodeType === 3 && !String(node.nodeValue || '').trim()) continue;
      if (node.nodeType !== 1) break;
      const text = String(node.textContent || '').trim();
      const images = node.querySelectorAll ? node.querySelectorAll('img') : [];
      if (images.length && !text) {
        count += images.length;
        continue;
      }
      if (node.tagName === 'IMG') {
        count += 1;
        continue;
      }
      break;
    }
    return count;
  }

  function analyzePcDetailWebImages(detailWeb, currentImages) {
    const detailImages = getDetailWebImageUrls(detailWeb);
    const currentSet = new Set(selectPcDetailImages(currentImages).map(normalizeImageUrlForCompare));
    const currentProductImageCount = detailImages
      .map(normalizeImageUrlForCompare)
      .filter((url) => currentSet.has(url)).length;
    return {
      imageCount: detailImages.length,
      currentProductImageCount,
      leadingImageCount: countLeadingImageBlocks(detailWeb),
      required: EDIT_PAGE_RULES.pcDescriptionMinImages,
    };
  }

  function extractTextFromDetailMobile(detailMobile) {
    const parsed = parseMaybeJson(detailMobile, null);
    if (!parsed || !Array.isArray(parsed.moduleList)) return '';
    const lines = [];
    for (const module of parsed.moduleList) {
      if (module.type === 'text' && Array.isArray(module.texts)) {
        for (const textItem of module.texts) {
          if (textItem && textItem.content) lines.push(String(textItem.content));
        }
      }
    }
    return lines.join('\n\n').trim();
  }

  function isUsableValue(value) {
    if (value === undefined || value === null || value === '') return false;
    if (Array.isArray(value)) return value.length > 0;
    return true;
  }

  function findDeepByKeys(root, keys, maxDepth = 8) {
    const queue = [{ value: root, path: '', depth: 0 }];
    const seen = new Set();
    while (queue.length) {
      const item = queue.shift();
      const value = item.value;
      if (!value || typeof value !== 'object' || item.depth > maxDepth) continue;
      if (seen.has(value)) continue;
      seen.add(value);

      for (const key of Object.keys(value)) {
        const child = value[key];
        if (keys.includes(key) && isUsableValue(child)) {
          return { value: child, path: item.path ? `${item.path}.${key}` : key };
        }
        if (child && typeof child === 'object') {
          queue.push({
            value: child,
            path: item.path ? `${item.path}.${key}` : key,
            depth: item.depth + 1,
          });
        }
      }
    }
    return { value: '', path: '' };
  }

  function deepValue(editData, product, keys) {
    for (const key of keys) {
      if (product && isUsableValue(product[key])) return { value: product[key], path: `product.${key}` };
    }
    return findDeepByKeys(editData, keys);
  }

  function buildPayloadFromEdit(editData) {
    const product = getProductFromEdit(editData);
    if (!product || typeof product !== 'object') {
      throw new Error('edit.json \u672a\u627e\u5230 product \u5bf9\u8c61');
    }

    const found = {
      mainImages: deepValue(editData, product, ['mainImageListJson', 'mainImageList', 'imgList', 'imageList', 'mainImages']),
      variations: deepValue(editData, product, ['variationListStr', 'variationList', 'skuList', 'variations', 'skuInfoList']),
      properties: deepValue(editData, product, [
        'productPropertyListJson',
        'productPropertyList',
        'propertyList',
        'productProperties',
        'aeopAeProductPropertys',
        'attributeList',
      ]),
      postageId: deepValue(editData, product, ['postageId', 'freightTemplateId', 'shippingTemplateId', 'templateId']),
      deliveryTime: deepValue(editData, product, ['deliveryTime', 'delivery_time']),
      detailMobile: deepValue(editData, product, ['detailMobile', 'mobileDetail', 'mobileDesc']),
      detailWeb: deepValue(editData, product, ['detailWeb', 'description', 'detail', 'productDetail']),
      categoryId: deepValue(editData, product, ['categoryId', 'category_id', 'cateId']),
      optionValues: deepValue(editData, product, ['optionValues', 'optionValueMap']),
      optionValueIds: deepValue(editData, product, ['optionValueIds', 'optionValueIdMap']),
      shipFrom: deepValue(editData, product, ['shipFrom']),
    };

    const payload = {};
    for (const field of SAVE_FIELDS) {
      payload[field] = product[field] === undefined ? null : product[field];
    }

    payload.id = String(firstNonEmpty(product.id, product.productId, state.productId));
    payload.shopId = String(firstNonEmpty(product.shopId, product.shop_id, extractShopIdFromCurrentPage()));
    payload.categoryId = String(firstNonEmpty(found.categoryId.value, product.fullCid));
    payload.subject = String(firstNonEmpty(product.subject, product.title, product.productTitle));
    payload.sourceUrl = firstNonEmpty(product.sourceUrl, product.url, '');
    payload.fullCid = firstNonEmpty(product.fullCid, '');
    payload.productPropertyListJson = normalizeJsonString(found.properties.value, []);
    payload.mainImageListJson = normalizeJsonString(found.mainImages.value, []);
    payload.variationListStr = normalizeJsonString(found.variations.value, []);
    const mainImagesForMarketing = normalizeImageList(payload.mainImageListJson);
    const marketingSelection = selectMarketingImages(product, mainImagesForMarketing);
    payload.optionValues = JSON.stringify(ensureUsShipFromOptionValues(found.optionValues.value));
    payload.optionValueIds = JSON.stringify(ensureUsShipFromOptionValueIds(firstNonEmpty(found.optionValueIds.value, product.optionValueIds)));
    payload.shipFrom = firstNonEmpty(found.shipFrom.value, product.shipFrom, 'United States');
    payload.videoListJson = product.videoListJson == null ? null : normalizeJsonString(product.videoListJson, []);
    payload.sizeChartIdListJson = product.sizeChartIdListJson == null ? '' : normalizeJsonString(product.sizeChartIdListJson, []);
    payload.aeopQualificationStructListJson = normalizeJsonString(
      firstNonEmpty(product.aeopQualificationStructListJson, product.aeopQualificationStructList),
      []
    );
    payload.imgUrl = firstNonEmpty(
      product.imgUrl,
      mainImagesForMarketing.join('|')
    );
    payload.marketImage1 = marketingSelection.images[0] || '';
    payload.marketImage2 = marketingSelection.images[1] || '';
    payload.productUnit = firstNonEmpty(product.productUnit, product.unit, '100000015');
    payload.packageType = firstNonEmpty(product.packageType, 0);
    payload.lotNum = firstNonEmpty(product.lotNum, 0);
    payload.supportCountrySupplyPrice = firstNonEmpty(product.supportCountrySupplyPrice, 0);
    payload.sizeChartId = firstNonEmpty(product.sizeChartId, '');
    payload.detailMobile = normalizeJsonString(found.detailMobile.value, {});
    payload.detailWeb = String(firstNonEmpty(found.detailWeb.value, product.detailWeb, ''));
    const fallbackWebText = extractTextFromDetailMobile(payload.detailMobile);
    const detailWebDerived = !payload.detailWeb && fallbackWebText;
    if (detailWebDerived) {
      payload.detailWeb = buildPcDetailWeb(fallbackWebText, mainImagesForMarketing, payload.subject);
    }
    payload.deliveryTime = String(firstNonEmpty(found.deliveryTime.value, '7'));
    payload.postageId = String(firstNonEmpty(found.postageId.value, ''));
    payload.manufactureId = firstNonEmpty(product.manufactureId, '');
    payload.msrEuId = product.msrEuId == null ? -2 : product.msrEuId;
    payload.msrTrId = product.msrTrId == null ? -2 : product.msrTrId;
    payload.op = 2;
    payload.currencyCode = firstNonEmpty(product.currencyCode, 'USD');
    payload.dxmState = firstNonEmpty(product.dxmState, 'draft');
    payload.productId = product.productId == null ? null : product.productId;
    const defaultRulesApplied = [];
    const asin = extractAsin(`${product.sourceUrl || ''} ${product.sourceId || ''} ${product.platformProductId || ''} ${product.subject || ''}`);
    const amazonItem = getAmazonBatchItem(product);
    const complianceSource = amazonItem || product;
    const compliantTitle = buildCompliantProductTitle(payload.subject, complianceSource);
    if (compliantTitle && compliantTitle !== payload.subject) {
      payload.subject = compliantTitle;
      defaultRulesApplied.push(`标题已按编辑页规则重写，长度 ${payload.subject.length}/${EDIT_PAGE_RULES.titleMaxChars}`);
    }
    const detailImageStateBefore = analyzePcDetailWebImages(payload.detailWeb, mainImagesForMarketing);
    const detailPlainText = plainTextFromHtml(payload.detailWeb) || extractTextFromDetailMobile(payload.detailMobile);
    if (
      !detailPlainText ||
      detailPlainText.length < EDIT_PAGE_RULES.pcDescriptionMinChars ||
      hasForbiddenCommerceTerms(detailPlainText) ||
      detailImageStateBefore.currentProductImageCount < EDIT_PAGE_RULES.pcDescriptionMinImages ||
      detailImageStateBefore.leadingImageCount < EDIT_PAGE_RULES.pcDescriptionMinImages
    ) {
      const compliantDescription = buildCompliantPcDescription(complianceSource, payload.subject);
      payload.detailWeb = buildPcDetailWeb(compliantDescription, mainImagesForMarketing, payload.subject);
      payload.detailMobile = buildDetailMobileFromText(compliantDescription);
      defaultRulesApplied.push(
        `PC端描述已按规则重写为先图片后描述，字符数 ${plainTextFromHtml(compliantDescription).length}/${EDIT_PAGE_RULES.pcDescriptionMinChars}，当前商品图片 ${selectPcDetailImages(mainImagesForMarketing).length}`
      );
    }
    if (payload.postageId !== EDIT_PAGE_RULES.postageTemplateId) {
      payload.postageId = EDIT_PAGE_RULES.postageTemplateId;
      defaultRulesApplied.push(`运费模板已固定为 ${EDIT_PAGE_RULES.postageTemplateId}`);
    }
    const beforeSanitizeSubject = payload.subject;
    payload.subject = sanitizePlatformText(payload.subject);
    payload.detailWeb = sanitizeHtmlTextContent(payload.detailWeb);
    payload.detailMobile = sanitizeJsonTextFields(payload.detailMobile, {});
    payload.productPropertyListJson = sanitizeJsonTextFields(payload.productPropertyListJson, []);
    payload.variationListStr = sanitizeJsonTextFields(payload.variationListStr, []);
    if (payload.subject !== beforeSanitizeSubject) {
      defaultRulesApplied.push('发布前字符清洗：标题中的引号/尺寸符号已替换或删除');
    }
    if (marketingSelection.issue) {
      defaultRulesApplied.push(marketingSelection.issue);
    } else {
      defaultRulesApplied.push(`营销图片已固定选择 ${EDIT_PAGE_RULES.marketingImageCount} 张`);
    }
    const variationsParsed = parseMaybeJson(payload.variationListStr, []);
    const inferredAmazonWeightKg = inferAmazonWeightKg(product, amazonItem);
    const inferredAmazonDimensionsCm = inferAmazonDimensionsCm(product, amazonItem);
    const defaultWeightKg = firstNonEmpty(inferredAmazonWeightKg, getDefaultWeightKg());
    const defaultPostageId = getDefaultPostageId();
    const defaultSupplyPrice = getDefaultSupplyPrice();
    const defaultStock = getDefaultStock();
    const inferredSourcePrice = inferSourcePrice(product, amazonItem);
    const calculatedSupplyPrice = calculateSupplyPriceCny(inferredSourcePrice);
    const effectiveSupplyPrice = firstNonEmpty(defaultSupplyPrice, calculatedSupplyPrice);
    const defaultLength = firstNonEmpty(inferredAmazonDimensionsCm && inferredAmazonDimensionsCm.length, inchToCm(getDefaultLengthIn()), getDefaultLength());
    const defaultWidth = firstNonEmpty(inferredAmazonDimensionsCm && inferredAmazonDimensionsCm.width, inchToCm(getDefaultWidthIn()), getDefaultWidth());
    const defaultHeight = firstNonEmpty(inferredAmazonDimensionsCm && inferredAmazonDimensionsCm.height, inchToCm(getDefaultHeightIn()), getDefaultHeight());
    const valueSources = {
      sourcePriceUsd: getDefaultSourcePrice() ? 'task_override' : amazonItem && positiveNumber(amazonItem.price) ? 'amazon_crawlbox_batch' : 'edit_nonzero_price',
      supplyPriceCny: getDefaultSupplyPrice() ? 'task_manual_override' : 'task_formula',
      stock: 'task_config',
      skuCode: asin ? 'amazon_asin' : 'fallback_product_id',
      weight: inferredAmazonWeightKg ? 'amazon_detail_or_edit_metadata' : 'default_missing_amazon_weight',
      dimensions: inferredAmazonDimensionsCm ? 'amazon_detail_or_edit_metadata' : getDefaultLengthIn() || getDefaultWidthIn() || getDefaultHeightIn()
        ? 'task_inches_converted_to_cm'
        : 'default_or_task_cm',
      taskFormula: {
        exchangeRate: getTaskExchangeRate(),
        multiplier: getTaskPriceMultiplier(),
      },
    };
    const skuDefaults = {
      skuCode: asin,
      supplyPrice: effectiveSupplyPrice ? Number(effectiveSupplyPrice) : '',
      stock: Number(defaultStock || 15),
      weight: defaultWeightKg,
      length: defaultLength,
      width: defaultWidth,
      height: defaultHeight,
    };
    const categoryDefault = getDefaultPropertiesForProduct(payload, product);
    if (categoryDefault.publishCategoryId && payload.categoryId !== categoryDefault.publishCategoryId) {
      payload.categoryId = categoryDefault.publishCategoryId;
      defaultRulesApplied.push(`\u5df2\u6309 Bumpers \u7c7b\u89c4\u5219\u6620\u5c04\u53d1\u5e03\u7c7b\u76ee ${payload.categoryId}`);
    }
    if (categoryDefault.properties) {
      const beforeProperties = parseMaybeJson(payload.productPropertyListJson, []);
      const missingBefore = findMissingRequiredPropertyNames(beforeProperties, categoryDefault.properties);
      payload.categoryId = categoryDefault.publishCategoryId || payload.categoryId;
      payload.productPropertyListJson = JSON.stringify(mergeRequiredProperties(beforeProperties, categoryDefault.properties));
      if (missingBefore.length) {
        defaultRulesApplied.push(`\u7c7b\u76ee\u5fc5\u586b\u5c5e\u6027\u7f3a\u5931\uff0c\u5df2\u5f3a\u5236\u8865\u9f50\uff1a${missingBefore.join(', ')}`);
      } else {
        defaultRulesApplied.push(`\u7c7b\u76ee\u5fc5\u586b\u5c5e\u6027\u5df2\u6309 Bumpers \u89c4\u5219\u590d\u6838\uff1aBrand Name / High-concerned chemical / Origin`);
      }
    }
    if (categoryDefault.status === 'unresolved') {
      defaultRulesApplied.push(
        `\u7c7b\u76ee\u672a\u547d\u4e2d\u5df2\u5b66\u4e60\u89c4\u5219\uff0c\u9700\u5148\u5b8c\u6210\u4e00\u6b21\u7c7b\u76ee\u5b66\u4e60\uff1b\u6700\u4f73\u5019\u9009=${categoryDefault.ruleId || 'none'}\uff0c\u7f6e\u4fe1\u5ea6=${categoryDefault.confidence}`
      );
    }
    if ((!Array.isArray(variationsParsed) || !variationsParsed.length) && asin && effectiveSupplyPrice) {
      payload.variationListStr = JSON.stringify([
        {
          id: null,
          skuId: null,
          skuCode: asin,
          gloGoodsValue: Number(effectiveSupplyPrice),
          gloLogisticValue: 0,
          supplyPrice: Number(effectiveSupplyPrice),
          specialProductTypeListJson: '',
          skuStockWareType: '',
          skuWarehouseStockListJson: '',
          sellableQuantity: Number(defaultStock || 15),
          effectiveSupplyPrice: null,
          packageWeight: defaultWeightKg,
          packageLength: defaultLength,
          packageWidth: defaultWidth,
          packageHeight: defaultHeight,
          packageWeightUnit: null,
          status: 'active',
          skuPropertyListJson: JSON.stringify([{ ...US_SHIPS_FROM_PROPERTY }]),
          imageList: null,
          destCountrySupplyPriceListJson: '',
        },
      ]);
      defaultRulesApplied.push(`variationListStr \u4e3a\u7a7a\uff0c\u5df2\u7528 ASIN + \u4f9b\u8d27\u4ef7 ${effectiveSupplyPrice} \u751f\u6210 1 \u6761 SKU`);
    } else if (Array.isArray(variationsParsed) && variationsParsed.length) {
      let changed = false;
      for (let index = 0; index < variationsParsed.length; index += 1) {
        const sku = variationsParsed[index];
        const perSkuDefaults = {
          ...skuDefaults,
          skuCode: variationsParsed.length > 1 && skuDefaults.skuCode ? `${skuDefaults.skuCode}-${index + 1}` : skuDefaults.skuCode,
        };
        if (ensureSkuCommercialFields(sku, perSkuDefaults)) {
          changed = true;
          defaultRulesApplied.push(`SKU \u884c\u5b57\u6bb5\u4e3a\u7a7a\uff0c\u5df2\u8865\u8d27\u503c/\u7269\u6d41\u8d39/\u5e93\u5b58/SKU/\u91cd\u91cf/\u5c3a\u5bf8`);
        }
        if (!hasUsShipsFromOnSku(sku)) {
          ensureUsShipsFromOnSku(sku);
          changed = true;
          defaultRulesApplied.push('SKU \u53d8\u79cd\u53d1\u8d27\u5730\u4e3a\u7a7a\uff0c\u5df2\u8865 Ships From=United States');
        }
      }
      if (changed) payload.variationListStr = JSON.stringify(variationsParsed);
    }
    if (!payload.postageId && defaultPostageId) {
      payload.postageId = defaultPostageId;
      defaultRulesApplied.push(`\u7269\u6d41\u6a21\u677f\u4e3a\u7a7a\uff0c\u5df2\u6309\u9ed8\u8ba4 postageId=${defaultPostageId} \u8865\u9f50`);
    }
    Object.defineProperty(payload, '__diagnostics', {
      enumerable: false,
      value: {
        topLevelKeys: editData && editData.data ? Object.keys(editData.data) : Object.keys(editData || {}),
        productKeys: Object.keys(product).slice(0, 200),
        domFallback: Boolean(product.__domFallback),
        amazonSource: Boolean(product.__amazonSource),
        editDataKeys: product.__editDataKeys || null,
        foundPaths: Object.fromEntries(Object.entries(found).map(([key, item]) => [key, item.path || 'NOT_FOUND'])),
        derived: {
          sourceMode: product.__sourceMode || (product.__amazonSource ? 'amazon_crawlbox_empty_form' : 'edit_json'),
          detailWebFromDetailMobile: Boolean(detailWebDerived),
          asin,
          sourcePriceUsd: inferredSourcePrice,
          calculatedSupplyPriceCny: calculatedSupplyPrice,
          effectiveSupplyPriceCny: effectiveSupplyPrice,
          amazonBatchItem: amazonItem ? {
            asin: amazonItem.asin,
            price: amazonItem.price,
            categoryTerm: amazonItem.categoryTerm,
            dimensionsCm: amazonItem.dimensionsCm || null,
            weightKg: amazonItem.weightKg || null,
            detailEnrichedAt: amazonItem.detailEnrichedAt || '',
          } : null,
          valueSources,
          categoryResolver: categoryDefault,
          editPageRules: EDIT_PAGE_RULES,
          defaultRulesApplied,
        },
      },
    });

    return payload;
  }

  function validatePayload(payload) {
    const risks = [];
    const warnings = [];
    const diagnostics = payload.__diagnostics && payload.__diagnostics.derived ? payload.__diagnostics.derived : {};
    const amazonEmptyFormMode = diagnostics.sourceMode === 'amazon_crawlbox_empty_form';

    for (const field of REQUIRED_FIELDS) {
      if (field === 'id' && amazonEmptyFormMode && !payload[field]) {
        warnings.push('Amazon 空白表单模式：payload 没有旧店小秘产品 ID，将以 save.json op=1 返回的产品 ID 做落库校验');
        continue;
      }
      if (payload[field] === undefined || payload[field] === null || payload[field] === '') {
        risks.push(`\u7f3a\u5c11\u5fc5\u586b\u5b57\u6bb5\uff1a${field}`);
      }
    }

    const properties = parseMaybeJson(payload.productPropertyListJson, null);
    const images = parseMaybeJson(payload.mainImageListJson, null);
    const variations = parseMaybeJson(payload.variationListStr, null);
    const mobile = parseMaybeJson(payload.detailMobile, null);

    if (!Array.isArray(properties) || properties.length === 0) {
      risks.push('productPropertyListJson \u4e0d\u662f\u6709\u6548\u6570\u7ec4\u6216\u4e3a\u7a7a');
    }
    const requiredCategoryProperties = getCategoryPropertiesById(payload.categoryId);
    const missingCategoryProperties = findMissingRequiredPropertyNames(properties, requiredCategoryProperties);
    if (missingCategoryProperties.length) {
      risks.push(`\u7c7b\u76ee\u5fc5\u586b\u5c5e\u6027\u672a\u8865\u9f50\uff1a${missingCategoryProperties.join(', ')}`);
    }
    const categoryResolver = payload.__diagnostics && payload.__diagnostics.derived
      ? payload.__diagnostics.derived.categoryResolver
      : null;
    if (categoryResolver && categoryResolver.status === 'unresolved') {
      risks.push(`categoryResolver unresolved: learn category from a real edit-page save payload before continuing; best=${categoryResolver.ruleId || 'none'}`);
    }
    if (payload.categoryId && !/^\d+$/.test(String(payload.categoryId))) {
      risks.push(`categoryId is not a publish category id: ${payload.categoryId}`);
    }
    if (categoryResolver && categoryResolver.status === 'unresolved') {
      warnings.push(`\u7c7b\u76ee\u672a\u8fdb\u5165\u5df2\u5b66\u4e60\u89c4\u5219\u5e93\uff0c\u9700\u5148\u6293\u53d6\u4e00\u6b21\u771f\u5b9e\u7f16\u8f91\u9875\u4fdd\u5b58 payload \u5b66\u4e60\u7c7b\u76ee\uff1bbest=${categoryResolver.ruleId || 'none'}`);
    }
    if (!Array.isArray(images) || images.length === 0) {
      risks.push('mainImageListJson \u4e0d\u662f\u6709\u6548\u6570\u7ec4\u6216\u4e3a\u7a7a');
    }
    if (!Array.isArray(variations) || variations.length === 0) {
      risks.push('variationListStr \u4e0d\u662f\u6709\u6548\u6570\u7ec4\u6216\u4e3a\u7a7a');
    }
    if (!hasUsShipFromOptionValues(payload.optionValues, payload.optionValueIds)) {
      risks.push('\u53d8\u79cd\u53c2\u6570\u7f3a\u5c11\u5fc5\u586b\u53d1\u8d27\u5730\uff1aUnited States');
    }
    if (!mobile || typeof mobile !== 'object') {
      risks.push('detailMobile \u4e0d\u662f\u6709\u6548 JSON \u5bf9\u8c61');
    }
    const subjectText = String(payload.subject || '').trim();
    const detailPlain = plainTextFromHtml(payload.detailWeb) || extractTextFromDetailMobile(payload.detailMobile);
    const detailImageState = analyzePcDetailWebImages(payload.detailWeb, images || []);
    const marketingImages = [payload.marketImage1, payload.marketImage2].filter(Boolean);
    const complianceSource = getCurrentEditComplianceSource(subjectText);
    if (subjectText.length > EDIT_PAGE_RULES.titleMaxChars) {
      risks.push(`标题超过 ${EDIT_PAGE_RULES.titleMaxChars} 字符：当前 ${subjectText.length}`);
    }
    const subjectForbiddenTerms = findForbiddenTitleTerms(subjectText, complianceSource);
    if (subjectForbiddenTerms.length) {
      risks.push(`标题包含品牌词/商标/平台词，必须重新生成后再保存：${subjectForbiddenTerms.join(', ')}`);
    }
    const platformTextCheck = [
      ['标题', payload.subject],
      ['PC端描述', payload.detailWeb],
      ['移动端描述', payload.detailMobile],
      ['属性', payload.productPropertyListJson],
      ['规格/SKU', payload.variationListStr],
    ];
    for (const [label, value] of platformTextCheck) {
      const issues = findPlatformTextIssues(value);
      if (issues.length) {
        risks.push(`${label}包含平台不允许的引号或尺寸符号，必须先执行发布前字符清洗`);
      }
    }
    if (detailPlain.length < EDIT_PAGE_RULES.pcDescriptionMinChars) {
      risks.push(`PC端描述少于 ${EDIT_PAGE_RULES.pcDescriptionMinChars} 英文字符：当前 ${detailPlain.length}`);
    }
    if (detailImageState.currentProductImageCount < EDIT_PAGE_RULES.pcDescriptionMinImages) {
      risks.push(
        `PC端描述缺少当前商品图片：当前 ${detailImageState.currentProductImageCount}/${EDIT_PAGE_RULES.pcDescriptionMinImages}`
      );
    }
    if (detailImageState.leadingImageCount < EDIT_PAGE_RULES.pcDescriptionMinImages) {
      risks.push(
        `PC端描述排版错误：必须先图片后描述，开头图片 ${detailImageState.leadingImageCount}/${EDIT_PAGE_RULES.pcDescriptionMinImages}`
      );
    }
    if (hasForbiddenCommerceTerms(detailPlain)) {
      risks.push('PC端描述包含平台词或违规营销词，必须重新生成后再保存');
    }
    if (String(payload.postageId || '') !== EDIT_PAGE_RULES.postageTemplateId) {
      risks.push(`运费模板必须固定为 ${EDIT_PAGE_RULES.postageTemplateId}`);
    }
    if (marketingImages.length < EDIT_PAGE_RULES.marketingImageCount) {
      risks.push(`营销图片必须固定保留 ${EDIT_PAGE_RULES.marketingImageCount} 张`);
    } else if (new Set(marketingImages).size < EDIT_PAGE_RULES.marketingImageCount) {
      warnings.push('营销图片当前存在重复图；正式执行应优先使用系统一键生成的 2 张图');
    }
    warnings.push(`编辑页流程约束：${EDIT_PAGE_RULES.flow}；禁止 ${EDIT_PAGE_RULES.forbiddenEditPageAction}`);
    if (payload.__diagnostics && payload.__diagnostics.derived && payload.__diagnostics.derived.detailWebFromDetailMobile) {
      warnings.push('detailWeb \u4e3a\u7a7a\uff0c\u5df2\u5728 dry-run \u4e2d\u4ece detailMobile \u81ea\u52a8\u751f\u6210 PC \u63cf\u8ff0');
    }
    if (payload.__diagnostics && payload.__diagnostics.derived && payload.__diagnostics.derived.defaultRulesApplied) {
      for (const item of payload.__diagnostics.derived.defaultRulesApplied) {
        warnings.push(item);
      }
    }
    if (payload.__diagnostics && payload.__diagnostics.derived && payload.__diagnostics.derived.valueSources) {
      const sources = payload.__diagnostics.derived.valueSources;
      warnings.push(`\u4efb\u52a1\u4ef7\u683c\u516c\u5f0f\uff1aAmazon\u539f\u4ef7 \u00d7 ${sources.taskFormula.exchangeRate} \u00d7 ${sources.taskFormula.multiplier}`);
      if (sources.weight === 'default_missing_amazon_weight') warnings.push('\u91cd\u91cf\u4f7f\u7528\u9ed8\u8ba4 0.1kg\uff1aAmazon \u91cd\u91cf\u7f3a\u5931\u6216\u672a\u6293\u53d6');
      if (sources.dimensions === 'default_or_task_cm') warnings.push('\u5c3a\u5bf8\u4f7f\u7528\u4efb\u52a1/\u9ed8\u8ba4 cm\uff1aAmazon \u5c3a\u5bf8\u7f3a\u5931\u6216\u672a\u6293\u53d6');
    }

    if (Array.isArray(variations)) {
      const firstSku = variations[0] || {};
      if (!firstSku.skuCode) warnings.push('SKU \u4e3a\u7a7a\uff0c\u53ef\u80fd\u5f71\u54cd\u8ffd\u8e2a');
      if (firstSku.skuCode && !/^B0[A-Z0-9]{8}(?:-\d+)?$/i.test(String(firstSku.skuCode))) {
        warnings.push('SKU \u7f16\u7801\u4e0d\u662f Amazon ASIN \u683c\u5f0f\uff0c\u63d2\u4ef6\u5c06\u6309 ASIN \u89c4\u5219\u8986\u76d6');
      }
      if (!firstSku.supplyPrice && !firstSku.gloGoodsValue) risks.push('SKU \u4ef7\u683c\u4e3a\u7a7a');
      if (!firstSku.packageWeight) risks.push('SKU \u91cd\u91cf\u4e3a\u7a7a');
      if (!firstSku.packageLength || !firstSku.packageWidth || !firstSku.packageHeight) {
        risks.push('SKU \u5c3a\u5bf8\u4e0d\u5b8c\u6574');
      }
      if (!firstSku.sellableQuantity) warnings.push('\u5e93\u5b58\u4e3a\u7a7a\u6216\u4e3a 0');
      const incompleteSkuRows = variations.filter((sku) => {
        return (
          (!sku.skuCode && !sku.sku && !sku.merchantSku) ||
          (!sku.gloGoodsValue && !sku.supplyPrice && !sku.goodsValue) ||
          isBlank(sku.gloLogisticValue) ||
          (!sku.sellableQuantity && !sku.inventory && !sku.stock) ||
          (!sku.packageWeight && !sku.weight) ||
          (!sku.packageLength && !sku.length) ||
          (!sku.packageWidth && !sku.width) ||
          (!sku.packageHeight && !sku.height)
        );
      }).length;
      if (incompleteSkuRows) {
        risks.push(`\u6709 ${incompleteSkuRows} \u6761 SKU \u53d8\u79cd\u4fe1\u606f\u4e0d\u5b8c\u6574`);
      }
      const missingShipsFromCount = variations.filter((sku) => !hasUsShipsFromOnSku(sku)).length;
      if (missingShipsFromCount) {
        risks.push(`\u6709 ${missingShipsFromCount} \u6761 SKU \u7f3a\u5c11 Ships From=United States`);
      }
      const missingSkuEnumRows = variations.filter((sku) => {
        const skuProperties = parseMaybeJson(sku && sku.skuPropertyListJson, []);
        if (!Array.isArray(skuProperties)) return false;
        return skuProperties.some((property) => {
          if (!property || String(property.sku_property_id) === US_SHIPS_FROM_PROPERTY.sku_property_id) return false;
          return property.sku_property_id && !property.property_value_id;
        });
      }).length;
      if (missingSkuEnumRows) {
        risks.push(`\u6709 ${missingSkuEnumRows} \u6761 SKU \u53d8\u79cd\u5c5e\u6027\u7f3a\u5c11 property_value_id`);
      }
    }

    const propertyText = JSON.stringify(properties || '').toLowerCase();
    if (!propertyText.includes('brand')) warnings.push('\u5c5e\u6027\u91cc\u672a\u68c0\u6d4b\u5230 Brand Name \u5b57\u6bb5');
    if (propertyText.includes('nike') || propertyText.includes('adidas') || propertyText.includes('disney')) {
      risks.push('\u5c5e\u6027\u91cc\u7591\u4f3c\u5305\u542b\u54c1\u724c\u8bcd\uff0c\u9700\u8981\u4eba\u5de5\u786e\u8ba4');
    }

    return {
      app: APP_NAME,
      version: VERSION,
      createdAt: nowIso(),
      pass: risks.length === 0,
      productId: payload.id,
      subject: payload.subject,
      fieldCount: Object.keys(payload).length,
      missingSaveFields: SAVE_FIELDS.filter((field) => !(field in payload)),
      risks,
      warnings,
      diagnostics: payload.__diagnostics || null,
      categoryState: {
        categoryId: payload.categoryId,
        resolver: payload.__diagnostics && payload.__diagnostics.derived ? payload.__diagnostics.derived.categoryResolver : null,
        productPropertySource: payload.__diagnostics && payload.__diagnostics.foundPaths ? payload.__diagnostics.foundPaths.properties : '',
        optionValuesSource: payload.__diagnostics && payload.__diagnostics.foundPaths ? payload.__diagnostics.foundPaths.optionValues : '',
        optionValueIdsSource: payload.__diagnostics && payload.__diagnostics.foundPaths ? payload.__diagnostics.foundPaths.optionValueIds : '',
        shipFromSource: payload.__diagnostics && payload.__diagnostics.foundPaths ? payload.__diagnostics.foundPaths.shipFrom : '',
        variationSource: payload.__diagnostics && payload.__diagnostics.foundPaths ? payload.__diagnostics.foundPaths.variations : '',
        defaultRulesApplied:
          payload.__diagnostics && payload.__diagnostics.derived && payload.__diagnostics.derived.defaultRulesApplied
            ? payload.__diagnostics.derived.defaultRulesApplied
            : [],
      },
      payloadPreview: {
        id: payload.id,
        shopId: payload.shopId,
        categoryId: payload.categoryId,
        subject: payload.subject,
        postageId: payload.postageId,
        imageCount: Array.isArray(images) ? images.length : 0,
        skuCount: Array.isArray(variations) ? variations.length : 0,
      },
    };
  }

  async function apiFetchJson(url, options = {}) {
    const startedAt = performance.now();
    const method = String(options.method || 'GET').toUpperCase();
    const response = await fetch(url, {
      credentials: 'include',
      ...options,
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        ...(options.headers || {}),
      },
    });
    const text = await response.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch (_) {
      rememberApiRecord({
        url,
        method,
        status: response.status,
        ok: response.ok,
        durationMs: Math.round(performance.now() - startedAt),
        responseText: text.slice(0, 2000),
        parseError: true,
      });
      throw new Error(`\u63a5\u53e3\u8fd4\u56de\u4e0d\u662f JSON\uff1a${text.slice(0, 200)}`);
    }
    rememberApiRecord({
      url,
      method,
      status: response.status,
      ok: response.ok,
      durationMs: Math.round(performance.now() - startedAt),
      response: json,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
    return json;
  }

  function findListInResponse(json) {
    const candidates = [
      json && json.data && json.data.page && json.data.page.list,
      json && json.data && json.data.list,
      json && json.data && json.data.rows,
      json && json.data && json.data.result,
      json && json.page && json.page.list,
      json && json.list,
      json && json.rows,
    ];
    return candidates.find((value) => Array.isArray(value)) || [];
  }

  function guessStateCandidatesFromPage() {
    const candidates = [
      { dxmState: 'draft', productState: '' },
      { dxmState: 'draft', productState: '0' },
    ];
    const seen = new Set();
    return candidates.filter((item) => {
      const key = `${item.dxmState}|${item.dxmOfflineState || ''}|${item.productState || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  async function loadFirstDraftProduct() {
    const stateCandidates = guessStateCandidatesFromPage();
    const bodies = [];
    for (const item of stateCandidates) {
      bodies.push(new URLSearchParams({
        pageNo: '1',
        pageSize: '1',
        total: '0',
        shopId: '-1',
        searchType: '0',
        searchValue: '',
        sortName: '1',
        sortValue: '2',
        dxmState: item.dxmState,
        dxmOfflineState: item.dxmOfflineState || '',
        productSearchType: '1',
        fullCid: '',
        productState: item.productState,
      }));
      bodies.push(new URLSearchParams({
        pageNo: '1',
        pageSize: '1',
        dxmState: item.dxmState,
        dxmOfflineState: item.dxmOfflineState || '',
        productState: item.productState,
      }));
    }

    let lastError = null;
    for (const body of bodies) {
      try {
        const json = await apiFetchJson('/api/smtlocalProduct/pageList.json', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
          body,
        });
        const list = findListInResponse(json);
        if (list.length && list[0].id) {
          state.productId = String(list[0].id);
          const manualId = $(`#${PANEL_ID} [data-field="manualProductId"]`);
          if (manualId) manualId.value = state.productId;
          log(`\u5df2\u901a\u8fc7 pageList \u63a5\u53e3\u8bfb\u53d6\u5f53\u524d\u5217\u8868\u7b2c 1 \u6761\u4ea7\u54c1\uff1a${state.productId}`);
          updateUi();
          return state.productId;
        }
        lastError = new Error('pageList \u8fd4\u56de\u4e3a\u7a7a');
      } catch (error) {
        lastError = error;
      }
    }

    const domProductId = extractProductIdFromCurrentList();
    if (domProductId) {
      state.productId = domProductId;
      const manualId = $(`#${PANEL_ID} [data-field="manualProductId"]`);
      if (manualId) manualId.value = domProductId;
      log(`pageList \u672a\u53d6\u5230\uff0c\u5df2\u4ece\u5f53\u524d\u9875\u9762 DOM \u515c\u5e95\u8bfb\u53d6\u4ea7\u54c1 ID\uff1a${state.productId}`);
      updateUi();
      return state.productId;
    }

    throw lastError || new Error('\u672a\u80fd\u8bfb\u53d6\u5f53\u524d\u4ea7\u54c1\u5217\u8868');
  }

  async function loadEditJson() {
    const manualId = $(`#${PANEL_ID} [data-field="manualProductId"]`);
    const productId =
      (manualId && manualId.value.trim()) ||
      state.productId ||
      extractProductIdFromCurrentList() ||
      extractProductIdFromCurrentPage();
    if (!productId) throw new Error('\u8fd8\u6ca1\u6709\u4ea7\u54c1 ID\uff0c\u8bf7\u5148\u8bfb\u53d6\u5f53\u524d\u7b2c 1 \u6761\uff0c\u6216\u8fdb\u5165\u4ea7\u54c1\u7f16\u8f91\u9875\uff0c\u6216\u624b\u52a8\u586b\u5199\u4ea7\u54c1 ID');
    state.productId = productId;
    if (manualId && !manualId.value.trim()) manualId.value = productId;
    const json = await apiFetchJson(`/api/smtlocalProduct/edit.json?id=${encodeURIComponent(productId)}`);
    state.editData = json;
    state.inputEditData = json;
    state.afterOp1EditData = null;
    log(`\u5df2\u8bfb\u53d6 edit.json\uff1a${productId}`);
    if (/\/web\/smtlocalProduct\/edit/i.test(location.pathname)) {
      try {
        const visibleFill = fillVisibleVariationFields();
        log(`\u5df2\u81ea\u52a8\u8865\u7f16\u8f91\u9875\u53ef\u89c1\u53d8\u79cd\u5b57\u6bb5\uff1a${visibleFill.rows} \u884c`);
      } catch (error) {
        log(`\u7f16\u8f91\u9875\u53ef\u89c1\u5b57\u6bb5\u81ea\u52a8\u8865\u5168\u672a\u6267\u884c\uff1a${error.message}`);
      }
    }
    updateUi();
    return json;
  }

  async function ensureEditDataForDryRun() {
    if (state.editData) return state.editData;
    const manualId = $(`#${PANEL_ID} [data-field="manualProductId"]`);
    const productId =
      (manualId && manualId.value.trim()) ||
      state.productId ||
      extractProductIdFromCurrentList() ||
      extractProductIdFromCurrentPage();
    if (productId) return loadEditJson();

    const json = buildAmazonEditDataContext();
    state.editData = json;
    state.inputEditData = json;
    state.afterOp1EditData = null;
    state.productId = '';
    log('鏈娴嬪埌搴楀皬绉樹骇鍝?ID锛屽凡鍒囨崲涓?Amazon 閲囬泦鏁版嵁 -> 绌虹櫧琛ㄥ崟 payload 妯″紡');
    updateUi();
    return json;
  }

  function makeCrc32Table() {
    const table = [];
    for (let i = 0; i < 256; i += 1) {
      let c = i;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[i] = c >>> 0;
    }
    return table;
  }

  const CRC_TABLE = makeCrc32Table();

  function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i += 1) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  function dosDateTime(date) {
    const year = Math.max(date.getFullYear(), 1980);
    const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
    const day = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
    return { time, day };
  }

  function writeU16(view, offset, value) {
    view.setUint16(offset, value, true);
  }

  function writeU32(view, offset, value) {
    view.setUint32(offset, value >>> 0, true);
  }

  function concatBytes(parts) {
    const total = parts.reduce((sum, part) => sum + part.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) {
      out.set(part, offset);
      offset += part.length;
    }
    return out;
  }

  function makeStoredZip(fileName, text) {
    return makeStoredZipFiles([{ fileName, text }]);
  }

  function makeStoredZipFiles(files) {
    const encoder = new TextEncoder();
    const stamp = dosDateTime(new Date());
    const localParts = [];
    const centralParts = [];
    let offset = 0;

    for (const file of files) {
      const nameBytes = encoder.encode(file.fileName);
      const dataBytes = file.bytes || encoder.encode(file.text == null ? '' : String(file.text));
      const checksum = crc32(dataBytes);

      const localHeader = new Uint8Array(30 + nameBytes.length);
      const localView = new DataView(localHeader.buffer);
      writeU32(localView, 0, 0x04034b50);
      writeU16(localView, 4, 20);
      writeU16(localView, 6, 0x0800);
      writeU16(localView, 8, 0);
      writeU16(localView, 10, stamp.time);
      writeU16(localView, 12, stamp.day);
      writeU32(localView, 14, checksum);
      writeU32(localView, 18, dataBytes.length);
      writeU32(localView, 22, dataBytes.length);
      writeU16(localView, 26, nameBytes.length);
      writeU16(localView, 28, 0);
      localHeader.set(nameBytes, 30);

      const centralHeader = new Uint8Array(46 + nameBytes.length);
      const centralView = new DataView(centralHeader.buffer);
      writeU32(centralView, 0, 0x02014b50);
      writeU16(centralView, 4, 20);
      writeU16(centralView, 6, 20);
      writeU16(centralView, 8, 0x0800);
      writeU16(centralView, 10, 0);
      writeU16(centralView, 12, stamp.time);
      writeU16(centralView, 14, stamp.day);
      writeU32(centralView, 16, checksum);
      writeU32(centralView, 20, dataBytes.length);
      writeU32(centralView, 24, dataBytes.length);
      writeU16(centralView, 28, nameBytes.length);
      writeU16(centralView, 30, 0);
      writeU16(centralView, 32, 0);
      writeU16(centralView, 34, 0);
      writeU16(centralView, 36, 0);
      writeU32(centralView, 38, 0);
      writeU32(centralView, 42, offset);
      centralHeader.set(nameBytes, 46);

      localParts.push(localHeader, dataBytes);
      centralParts.push(centralHeader);
      offset += localHeader.length + dataBytes.length;
    }

    const centralOffset = offset;
    const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
    const end = new Uint8Array(22);
    const endView = new DataView(end.buffer);
    writeU32(endView, 0, 0x06054b50);
    writeU16(endView, 4, 0);
    writeU16(endView, 6, 0);
    writeU16(endView, 8, files.length);
    writeU16(endView, 10, files.length);
    writeU32(endView, 12, centralSize);
    writeU32(endView, 16, centralOffset);
    writeU16(endView, 20, 0);

    return new Blob([concatBytes([...localParts, ...centralParts, end])], {
      type: 'application/zip',
    });
  }

  async function runDryRun() {
    await ensureEditDataForDryRun();
    assertDraftProductForMainFlow(state.editData);
    const payload = buildPayloadFromEdit(state.editData);
    await resolveCategoryWithDxmApi(payload, state.editData);
    const report = validatePayload(payload);
    const text = JSON.stringify(payload);
    const zipBlob = makeStoredZip('choiceSave.txt', text);

    state.payload = payload;
    state.zipBlob = zipBlob;
    state.report = {
      ...report,
      apiRecords: state.apiRecords.slice(),
      zip: {
        fileName: 'choiceSave.zip',
        entryName: 'choiceSave.txt',
        contentBytes: new TextEncoder().encode(text).length,
        zipBytes: zipBlob.size,
        formData: { file: 'Blob(application/zip)', op: '2' },
      },
    };

    if (report.pass) {
      log('dry-run \u901a\u8fc7\uff1a\u53ef\u4ee5\u4e0b\u8f7d run \u62a5\u544a\u5305\u68c0\u67e5\uff1b\u786e\u8ba4\u540e\u624d\u8fdb\u5165 op=1 \u4fdd\u5b58\u9a8c\u8bc1\u3002', state.report);
    } else {
      const riskSummary = report.risks && report.risks.length ? report.risks.slice(0, 5).join(' | ') : '\u672a\u77e5\u98ce\u9669';
      log(`dry-run \u672a\u901a\u8fc7\uff1a\u4e0d\u8981\u70b9 op=1 / \u4e0d\u8981\u771f\u5b9e\u63d0\u4ea4\u3002\u4e0b\u4e00\u6b65\u8bf7\u70b9\u51fb\u201c\u4e0b\u8f7drun\u62a5\u544a\u5305\u201d\u53d1\u7ed9 Codex\u3002\u98ce\u9669\uff1a${riskSummary}`, state.report);
    }
    updateUi();
  }

  function getCapturedSavePayloadRecords() {
    const sources = [
      window.__DXM_SAVE_PAYLOAD_CAPTURE_V3_RECORDS__,
      window.unsafeWindow && window.unsafeWindow.__DXM_SAVE_PAYLOAD_CAPTURE_V3_RECORDS__,
    ].filter(Boolean);
    const records = [];
    for (const source of sources) {
      if (Array.isArray(source.records)) records.push(...source.records);
    }
    return records
      .filter((record) => record && record.request && record.request.body && record.request.body.choiceSaveJson)
      .filter((record) => /save_payload|save\.json/i.test(`${record.request.type || ''} ${record.request.url || ''}`))
      .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
  }

  function getLatestCapturedSavePayload() {
    const records = getCapturedSavePayloadRecords();
    return records[records.length - 1] || null;
  }

  function valueKind(value) {
    if (value == null) return 'blank';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  }

  function normalizedPayloadValue(value) {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    if (!trimmed) return '';
    if (!/^[\[{]/.test(trimmed)) return trimmed;
    return parseMaybeJson(trimmed, trimmed);
  }

  function payloadValueSummary(value) {
    const normalized = normalizedPayloadValue(value);
    if (Array.isArray(normalized)) return { kind: 'array', count: normalized.length, sampleKeys: normalized[0] && typeof normalized[0] === 'object' ? Object.keys(normalized[0]).slice(0, 30) : [] };
    if (normalized && typeof normalized === 'object') return { kind: 'object', keys: Object.keys(normalized).slice(0, 50) };
    return { kind: valueKind(normalized), value: String(normalized == null ? '' : normalized).slice(0, 240) };
  }

  function comparePayloadValues(generatedValue, capturedValue) {
    const generated = normalizedPayloadValue(generatedValue);
    const captured = normalizedPayloadValue(capturedValue);
    const generatedJson = JSON.stringify(generated);
    const capturedJson = JSON.stringify(captured);
    if (generatedJson === capturedJson) return null;
    return {
      generated: payloadValueSummary(generatedValue),
      captured: payloadValueSummary(capturedValue),
    };
  }

  function summarizePayloadCore(payload) {
    const variations = parseMaybeJson(payload && payload.variationListStr, []);
    const properties = parseMaybeJson(payload && payload.productPropertyListJson, []);
    return {
      id: payload && payload.id,
      op: payload && payload.op,
      categoryId: payload && payload.categoryId,
      postageId: payload && payload.postageId,
      shipFrom: payload && payload.shipFrom,
      propertyCount: Array.isArray(properties) ? properties.length : 0,
      variationSummary: summarizeVariationRows(payload && payload.variationListStr),
      optionValues: payloadValueSummary(payload && payload.optionValues),
      optionValueIds: payloadValueSummary(payload && payload.optionValueIds),
      fieldCount: payload && typeof payload === 'object' ? Object.keys(payload).length : 0,
      variationKeys: Array.isArray(variations) && variations[0] ? Object.keys(variations[0]).slice(0, 80) : [],
    };
  }

  function compareGeneratedWithCapturedSavePayload(generatedPayload, capturedPayload) {
    const generatedKeys = Object.keys(generatedPayload || {});
    const capturedKeys = Object.keys(capturedPayload || {});
    const allKeys = Array.from(new Set([...generatedKeys, ...capturedKeys])).sort();
    const missingInGenerated = capturedKeys.filter((key) => !(key in (generatedPayload || {}))).sort();
    const missingInCaptured = generatedKeys.filter((key) => !(key in (capturedPayload || {}))).sort();
    const changed = {};
    const importantFields = new Set([
      'id',
      'shopId',
      'categoryId',
      'productPropertyListJson',
      'variationListStr',
      'optionValues',
      'optionValueIds',
      'shipFrom',
      'postageId',
      'deliveryTime',
      'detailMobile',
      'detailWeb',
      'op',
    ]);
    for (const key of allKeys) {
      if (!(key in (generatedPayload || {})) || !(key in (capturedPayload || {}))) continue;
      const diff = comparePayloadValues(generatedPayload[key], capturedPayload[key]);
      if (diff && importantFields.has(key)) changed[key] = diff;
    }
    return {
      comparedAt: nowIso(),
      passShape: missingInGenerated.length === 0,
      missingInGenerated,
      missingInCaptured,
      importantDiffs: changed,
      generatedCore: summarizePayloadCore(generatedPayload || {}),
      capturedCore: summarizePayloadCore(capturedPayload || {}),
      nextAction: missingInGenerated.length
        ? 'map_missing_captured_fields_into_generated_payload'
        : Object.keys(changed).length
        ? 'verify_important_field_differences_before_save'
        : 'ready_to_build_edit_page_save_payload_dry_run',
    };
  }

  async function learnLatestCapturedSavePayload() {
    if (!state.payload) await runDryRun();
    const record = getLatestCapturedSavePayload();
    if (!record) {
      throw new Error('没有读取到 V3 抓包记录。请保持 V3 抓包插件启用，并触发一次保存以抓取真实 save.json payload。');
    }
    const capturedPayload = record.request.body.choiceSaveJson;
    const comparison = compareGeneratedWithCapturedSavePayload(state.payload, capturedPayload);
    state.savePayloadLearning = {
      recordId: record.id,
      capturedAt: record.createdAt,
      page: record.page,
      lastAction: record.lastAction,
      request: {
        url: record.request.url,
        method: record.request.method,
        op: record.request.body.op,
        zipEntries: record.request.body.zipEntries,
        responseStatus: record.response && record.response.status,
      },
      comparison,
    };
    if (state.report) state.report.savePayloadLearning = state.savePayloadLearning;
    log(
      comparison.passShape
        ? `已学习真实保存 payload：字段结构可对齐，关键差异 ${Object.keys(comparison.importantDiffs).length} 项`
        : `已学习真实保存 payload：生成 payload 缺 ${comparison.missingInGenerated.length} 个字段`,
      state.savePayloadLearning
    );
    updateUi();
    return state.savePayloadLearning;
  }

  function makeZipForPayload(payload, op) {
    const payloadForOp = {
      ...payload,
      op,
    };
    const text = JSON.stringify(payloadForOp);
    return {
      payload: payloadForOp,
      text,
      zipBlob: makeStoredZip('choiceSave.txt', text),
      contentBytes: new TextEncoder().encode(text).length,
    };
  }

  async function callSaveJson(op) {
    if (!state.report || !state.report.pass || !state.payload) {
      throw new Error('dry-run \u672a\u901a\u8fc7\uff0c\u7981\u6b62\u8c03\u7528 save.json');
    }
    if (Number(op) !== 1) {
      throw new Error('本阶段禁止调用 op=2；当前只允许 save.json op=1 落库验证');
    }
    const built = makeZipForPayload(state.payload, op);
    const form = new FormData();
    form.append('file', built.zipBlob, 'blob');
    form.append('op', String(op));
    const json = await apiFetchJson('/api/smtlocalProduct/save.json', {
      method: 'POST',
      body: form,
    });
    const returnedProductId = extractProductIdFromText(JSON.stringify(json && json.data !== undefined ? json.data : json || ''));
    if ((!state.payload.id || !/^\d{10,}$/.test(String(state.payload.id))) && returnedProductId) {
      state.payload.id = returnedProductId;
      state.productId = returnedProductId;
    }
    return {
      op,
      response: json,
      payloadPreview: {
        id: state.payload.id || built.payload.id,
        returnedProductId,
        categoryId: built.payload.categoryId,
        postageId: built.payload.postageId,
        skuCount: Array.isArray(parseMaybeJson(built.payload.variationListStr, []))
          ? parseMaybeJson(built.payload.variationListStr, []).length
          : 0,
      },
      zip: {
        entryName: 'choiceSave.txt',
        contentBytes: built.contentBytes,
        zipBytes: built.zipBlob.size,
      },
      at: nowIso(),
    };
  }

  function summarizeVariationRows(rawVariationList) {
    const rows = parseMaybeJson(rawVariationList, []);
    if (!Array.isArray(rows)) return { rowCount: 0, completeRows: 0, rows: [] };
    const summaries = rows.map((sku) => ({
      skuCode: firstNonEmpty(sku.skuCode, sku.sku, sku.merchantSku, sku.sku_code),
      goodsValue: firstNonEmpty(sku.gloGoodsValue, sku.goodsValue, sku.skuGoodsValue, sku.skuValue, sku.supplyPrice, sku.countrySupplyPrice),
      logisticValue: firstNonEmpty(sku.gloLogisticValue, sku.logisticValue, sku.freight, sku.freightPrice, sku.skuFreight),
      stock: firstNonEmpty(sku.sellableQuantity, sku.inventory, sku.skuStock, sku.stock, sku.skuStockNum),
      weight: firstNonEmpty(sku.packageWeight, sku.weight, sku.skuWeight),
      length: firstNonEmpty(sku.packageLength, sku.length, sku.skuLength),
      width: firstNonEmpty(sku.packageWidth, sku.width, sku.skuWidth),
      height: firstNonEmpty(sku.packageHeight, sku.height, sku.skuHeight),
      hasUsShipsFrom: hasUsShipsFromOnSku(sku),
    }));
    const completeRows = summaries.filter((sku) => {
      return (
        !isBlank(sku.skuCode) &&
        !isBlank(sku.goodsValue) &&
        !isBlank(sku.logisticValue) &&
        !isBlank(sku.stock) &&
        !isBlank(sku.weight) &&
        !isBlank(sku.length) &&
        !isBlank(sku.width) &&
        !isBlank(sku.height) &&
        sku.hasUsShipsFrom
      );
    }).length;
    return { rowCount: rows.length, completeRows, rows: summaries };
  }

  async function verifyOp1Persistence() {
    if (!state.payload || !state.payload.id) return null;
    const before = summarizeVariationRows(state.payload.variationListStr);
    const json = await apiFetchJson(`/api/smtlocalProduct/edit.json?id=${encodeURIComponent(state.payload.id)}`);
    const product = getProductFromEdit(json) || {};
    const afterSource = product.variationListStr || product.variationList;
    const after = summarizeVariationRows(afterSource);
    const alreadyWaitPublish = product.dxmState === 'offline' && product.dxmOfflineState === 'waitPublish';
    const result = {
      checkedAt: nowIso(),
      productId: state.payload.id,
      dxmState: product.dxmState,
      dxmOfflineState: product.dxmOfflineState,
      alreadyWaitPublish,
      afterSourceField: product.variationListStr ? 'variationListStr' : product.variationList ? 'variationList' : 'NONE',
      note: alreadyWaitPublish
        ? '\u5f53\u524d\u4ea7\u54c1\u5df2\u5728\u5f85\u53d1\u5e03\u72b6\u6001\uff0c\u91c7\u96c6\u7bb1 op=1 \u4e0d\u80fd\u518d\u6b21\u79fb\u5165\u5f85\u53d1\u5e03\uff1b\u9700\u8981\u6293\u9875\u9762\u4fdd\u5b58 save.json payload \u5b66\u4e60\u5f85\u53d1\u5e03\u4fdd\u5b58\u7ed3\u6784\u3002'
        : '',
      beforePayload: before,
      afterEditJson: after,
      persisted:
        !alreadyWaitPublish &&
        before.rowCount > 0 &&
        after.rowCount === before.rowCount &&
        after.completeRows === before.completeRows &&
        after.completeRows === after.rowCount,
      productKeys: Object.keys(product).slice(0, 160),
    };
    state.editData = json;
    state.afterOp1EditData = json;
    return result;
  }

  async function saveCompletionOnly() {
    const result = await callSaveJson(1);
    state.report.completionSaveResult = result;
    state.report.apiRecords = state.apiRecords.slice();
    log(`save.json op=1 宸茶皟鐢細${JSON.stringify(result.response).slice(0, 300)}`, result);
    if (!isSaveResponseSuccess(result.response)) {
      state.report.persistenceCheck = {
        checkedAt: nowIso(),
        productId: state.payload && state.payload.id,
        persisted: false,
        skipped: true,
        reason: 'op=1 save.json 返回失败，禁止用 edit.json 旧数据误判为落库成功',
        response: result.response,
      };
      log('op=1 返回失败，已停止落库校验；禁止继续 op=2', state.report.persistenceCheck);
      updateUi();
      return;
    }
    try {
      const persistence = await verifyOp1Persistence();
      state.report.persistenceCheck = persistence;
      if (persistence && persistence.persisted) {
        log(`op=1 \u843d\u5e93\u6821\u9a8c\u901a\u8fc7\uff1a${persistence.afterEditJson.completeRows}/${persistence.afterEditJson.rowCount} \u6761\u53d8\u79cd\u5b8c\u6574`);
      } else if (persistence && persistence.alreadyWaitPublish) {
        log('\u5f53\u524d\u4ea7\u54c1\u5df2\u5728\u5f85\u53d1\u5e03\uff0c\u4e0d\u80fd\u7528\u91c7\u96c6\u7bb1 op=1 \u590d\u5199\u53d8\u79cd\uff1b\u8bf7\u7528 V3 \u6293\u9875\u9762\u4fdd\u5b58 payload', persistence);
      } else if (persistence) {
        log(`op=1 \u843d\u5e93\u6821\u9a8c\u672a\u901a\u8fc7\uff1a${persistence.afterEditJson.completeRows}/${persistence.afterEditJson.rowCount} \u6761\u53d8\u79cd\u5b8c\u6574`, persistence);
      }
    } catch (error) {
      log(`op=1 \u843d\u5e93\u6821\u9a8c\u5931\u8d25\uff1a${error.message}`);
    }
    updateUi();
  }

  function dispatchInputEvents(input) {
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  function setInputValue(input, value) {
    if (!input || value === null || value === undefined) return false;
    const prototype = input instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
    if (descriptor && descriptor.set) descriptor.set.call(input, String(value));
    else input.value = String(value);
    dispatchInputEvents(input);
    return true;
  }

  function sleep(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function isEditPage() {
    return /\/web\/smtlocalProduct\/edit/i.test(location.pathname);
  }

  function setEditableHtml(element, html) {
    if (!element || isBlank(html)) return false;
    element.innerHTML = String(html);
    dispatchInputEvents(element);
    return true;
  }

  function getCurrentEditComplianceSource(titleText) {
    const product = getProductFromEdit(state.editData) || {};
    const sourceUrl = firstNonEmpty(product.sourceUrl, extractSourceUrlFromCurrentEditPage());
    const asin = extractAsin(`${sourceUrl} ${product.sourceId || ''} ${product.platformProductId || ''} ${titleText || ''}`);
    const item = getAmazonBatchItem(product) || {};
    return {
      ...item,
      ...product,
      asin: firstNonEmpty(item.asin, asin),
      sourceUrl,
      title: firstNonEmpty(titleText, item.title, product.subject),
      subject: firstNonEmpty(titleText, product.subject, item.title),
      detailTextSample: firstNonEmpty(item.detailTextSample, product.detailText, product.detailWeb, plainTextFromHtml(product.detailWeb || '')),
    };
  }

  function isLikelyTitleInput(input) {
    if (!input || input.closest(`#${PANEL_ID}`) || !visibleElement(input)) return false;
    const text = getInputText(input);
    const name = `${input.name || ''} ${input.id || ''} ${input.getAttribute('placeholder') || ''}`.toLowerCase();
    if (text.length < 20 || text.length > 260) return false;
    if (/^https?:\/\//i.test(text) || /amazon\.com|\/dp\/B0/i.test(text)) return false;
    if (/^\d+(\.\d+)?$/.test(text) || /^[A-Z0-9]{8,16}(?:-\d+)?$/i.test(text)) return false;
    if (/sku|price|weight|length|width|height|source|url|asin|brand|attr|stock|postage|freight|template/i.test(name)) return false;
    return /[a-z]/i.test(text);
  }

  function findProductTitleInput() {
    const candidates = Array.from(document.querySelectorAll('input[type="text"], textarea'))
      .filter(isLikelyTitleInput)
      .map((input) => ({ input, text: getInputText(input), rect: input.getBoundingClientRect() }));
    if (!candidates.length) return null;
    candidates.sort((a, b) => {
      const aScore = (a.text.length > 80 ? 20 : 0) + (a.rect.top < 900 ? 10 : 0);
      const bScore = (b.text.length > 80 ? 20 : 0) + (b.rect.top < 900 ? 10 : 0);
      return bScore - aScore || a.rect.top - b.rect.top;
    });
    return candidates[0].input;
  }

  function applyVisibleTitleRule() {
    const input = findProductTitleInput();
    if (!input) return { changed: false, reason: 'title input not found' };
    const original = getInputText(input);
    const source = getCurrentEditComplianceSource(original);
    let title = buildCompliantProductTitle(original, source);
    let attempts = 1;
    while (findForbiddenTitleTerms(title, source).length && attempts < 4) {
      title = buildCompliantProductTitle(title, source);
      attempts += 1;
    }
    const changed = setInputValue(input, title);
    return { changed, original, value: title, length: title.length, attempts, forbiddenTerms: findForbiddenTitleTerms(title, source) };
  }

  function findVisiblePcDescriptionTarget() {
    const contentEditable = Array.from(document.querySelectorAll('[contenteditable="true"]'))
      .filter((node) => !node.closest(`#${PANEL_ID}`) && visibleElement(node))
      .map((node) => {
        const rect = node.getBoundingClientRect();
        return { node, area: rect.width * rect.height, text: getInputText(node) };
      })
      .filter((item) => item.area > 10000 || item.text.length > 100)
      .sort((a, b) => b.area - a.area);
    if (contentEditable.length) return { type: 'contenteditable', node: contentEditable[0].node };

    const iframes = Array.from(document.querySelectorAll('iframe')).filter(visibleElement);
    for (const iframe of iframes) {
      try {
        const body = iframe.contentDocument && iframe.contentDocument.body;
        if (body) return { type: 'iframe', node: body };
      } catch (_) {
        // Cross-origin editors cannot be edited directly.
      }
    }

    const textarea = Array.from(document.querySelectorAll('textarea'))
      .filter((node) => !node.closest(`#${PANEL_ID}`) && visibleElement(node))
      .sort((a, b) => b.getBoundingClientRect().height - a.getBoundingClientRect().height)[0];
    if (textarea) return { type: 'textarea', node: textarea };
    return null;
  }

  function syncHiddenDetailFields(html) {
    let count = 0;
    const selector = [
      'textarea[name*="detail" i]',
      'textarea[id*="detail" i]',
      'input[name*="detail" i]',
      'input[id*="detail" i]',
      'textarea[id^="ckeditor"]',
      'textarea[name^="ckeditor"]',
    ].join(',');
    Array.from(document.querySelectorAll(selector)).forEach((node) => {
      if (node.closest(`#${PANEL_ID}`)) return;
      if (setInputValue(node, html)) count += 1;
    });
    return count;
  }

  function syncCkeditorDescription(html) {
    let count = 0;
    const editor = window.CKEDITOR;
    if (!editor || !editor.instances) return count;
    Object.keys(editor.instances).forEach((key) => {
      const instance = editor.instances[key];
      if (!instance || typeof instance.setData !== 'function') return;
      const element = instance.element && instance.element.$;
      const name = `${key} ${element && element.id ? element.id : ''} ${element && element.name ? element.name : ''}`.toLowerCase();
      if (!/ckeditor|detail|desc|web|content/.test(name)) return;
      try {
        instance.setData(html);
        if (typeof instance.updateElement === 'function') instance.updateElement();
        if (typeof instance.fire === 'function') instance.fire('change');
        count += 1;
      } catch (_) {
        // Ignore individual editor failures; hidden fields are also synchronized.
      }
    });
    return count;
  }

  function getDescriptionImageUrls() {
    const all = Array.from(document.querySelectorAll('img'))
      .filter((img) => {
        const src = img.currentSrc || img.src || img.getAttribute('data-src') || '';
        if (!/^https?:\/\//i.test(src)) return false;
        if (/loading|addImg|logo|avatar|icon|sprite|translate|qiyukf|static\/img/i.test(src)) return false;
        const rect = img.getBoundingClientRect();
        if (rect.width < 50 || rect.height < 50) return false;
        const aspect = rect.width / Math.max(1, rect.height);
        return rect.height >= 120 && aspect < 4;
      })
      .map((img) => img.currentSrc || img.src || img.getAttribute('data-src') || '');
    const unique = Array.from(new Set(all));
    const generated = unique.filter((url) => /wxalbum|dianxiaomi/i.test(url));
    const product = unique.filter((url) => !/wxalbum|dianxiaomi/i.test(url));
    return [...generated, ...product].slice(0, 4);
  }

  function buildPcDescriptionHtml(text, imageUrls) {
    const textHtml = textToDetailWeb(text);
    const imageHtml = imageUrls
      .map((url) => {
        const safeUrl = escapeHtml(url);
        return [
          '<p style="text-align:center;margin:18px 0;">',
          `<img src="${safeUrl}" style="max-width:100%;height:auto;display:block;margin:0 auto;" />`,
          '</p>',
        ].join('');
      })
      .join('\n');
    return imageHtml ? `${imageHtml}<br>\n${textHtml}` : textHtml;
  }

  function applyVisiblePcDescriptionRule(titleValue) {
    const source = getCurrentEditComplianceSource(titleValue);
    const description = buildCompliantPcDescription(source, titleValue);
    const imageUrls = getDescriptionImageUrls();
    const html = buildPcDescriptionHtml(description, imageUrls);
    const target = findVisiblePcDescriptionTarget();
    const hiddenCount = syncHiddenDetailFields(html);
    const ckeditorCount = syncCkeditorDescription(html);
    if (!target) {
      return {
        changed: ckeditorCount > 0 || hiddenCount > 0,
        reason: 'pc description editor not found',
        hiddenCount,
        ckeditorCount,
        imageCount: imageUrls.length,
        chars: description.length,
      };
    }
    const changed = target.type === 'textarea' ? setInputValue(target.node, html) : setEditableHtml(target.node, html);
    syncHiddenDetailFields(html);
    return {
      changed: changed || ckeditorCount > 0 || hiddenCount > 0,
      target: target.type,
      hiddenCount,
      ckeditorCount,
      imageCount: imageUrls.length,
      chars: description.length,
    };
  }

  function applyVisiblePlatformTextSanitization() {
    let changed = 0;
    const touched = [];
    const cleanInput = (node, label) => {
      const before = getInputText(node);
      const after = sanitizePlatformText(before);
      if (after !== before && setInputValue(node, after)) {
        changed += 1;
        touched.push(label);
      }
    };

    Array.from(document.querySelectorAll('input[type="text"], textarea'))
      .filter((node) => !node.closest(`#${PANEL_ID}`) && node.type !== 'hidden')
      .forEach((node) => cleanInput(node, node.name || node.id || node.getAttribute('placeholder') || 'input'));

    Array.from(document.querySelectorAll('[contenteditable="true"]'))
      .filter((node) => !node.closest(`#${PANEL_ID}`) && visibleElement(node))
      .forEach((node) => {
        const before = node.innerHTML;
        const after = sanitizeHtmlTextContent(before);
        if (after !== before && setEditableHtml(node, after)) {
          changed += 1;
          touched.push('contenteditable');
        }
      });

    const editor = window.CKEDITOR;
    if (editor && editor.instances) {
      Object.keys(editor.instances).forEach((key) => {
        const instance = editor.instances[key];
        if (!instance || typeof instance.getData !== 'function' || typeof instance.setData !== 'function') return;
        try {
          const before = instance.getData();
          const after = sanitizeHtmlTextContent(before);
          if (after !== before) {
            instance.setData(after);
            if (typeof instance.updateElement === 'function') instance.updateElement();
            if (typeof instance.fire === 'function') instance.fire('change');
            changed += 1;
            touched.push(`ckeditor:${key}`);
          }
        } catch (_) {
          // Ignore editor instances that cannot be read or written.
        }
      });
    }

    const hiddenSelector = [
      'textarea[name*="detail" i]',
      'textarea[id*="detail" i]',
      'input[name*="detail" i]',
      'input[id*="detail" i]',
      'textarea[id^="ckeditor"]',
      'textarea[name^="ckeditor"]',
    ].join(',');
    Array.from(document.querySelectorAll(hiddenSelector)).forEach((node) => {
      if (node.closest(`#${PANEL_ID}`)) return;
      const before = getInputText(node);
      const after = sanitizeHtmlTextContent(before);
      if (after !== before && setInputValue(node, after)) {
        changed += 1;
        touched.push('hidden-detail');
      }
    });
    return { changed: changed > 0, fields: changed, touched: Array.from(new Set(touched)).slice(0, 20) };
  }

  function elementText(element) {
    return String((element && (element.innerText || element.textContent || element.value)) || '').replace(/\s+/g, ' ').trim();
  }

  function clickElement(element) {
    if (!element) return false;
    element.scrollIntoView({ block: 'center', inline: 'nearest' });
    if (typeof element.focus === 'function') element.focus();
    element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
    element.click();
    return true;
  }

  function clickSelectOption(element) {
    const option = element && (element.closest('.ant-select-item-option,[role="option"]') || element);
    if (!option) return false;
    option.scrollIntoView({ block: 'center', inline: 'nearest' });
    const rect = option.getBoundingClientRect();
    const init = {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: Math.round(rect.left + rect.width / 2),
      clientY: Math.round(rect.top + rect.height / 2),
      button: 0,
      buttons: 1,
    };
    if (window.PointerEvent) {
      option.dispatchEvent(new PointerEvent('pointerover', init));
      option.dispatchEvent(new PointerEvent('pointermove', init));
      option.dispatchEvent(new PointerEvent('pointerdown', init));
      option.dispatchEvent(new PointerEvent('pointerup', { ...init, buttons: 0 }));
    }
    option.dispatchEvent(new MouseEvent('mouseover', init));
    option.dispatchEvent(new MouseEvent('mousemove', init));
    option.dispatchEvent(new MouseEvent('mousedown', init));
    option.dispatchEvent(new MouseEvent('mouseup', { ...init, buttons: 0 }));
    option.dispatchEvent(new MouseEvent('click', { ...init, buttons: 0 }));
    return true;
  }

  function getReactProps(element) {
    if (!element) return null;
    const key = Object.keys(element).find((name) => name.startsWith('__reactProps$'));
    return key ? element[key] : null;
  }

  function callReactHandler(element, handlerName, eventTarget) {
    const props = getReactProps(element);
    const handler = props && props[handlerName];
    if (typeof handler !== 'function') return false;
    const event = {
      type: handlerName.replace(/^on/, '').toLowerCase(),
      target: eventTarget || element,
      currentTarget: element,
      button: 0,
      buttons: 1,
      preventDefault() {},
      stopPropagation() {},
      nativeEvent: {
        target: eventTarget || element,
        currentTarget: element,
        button: 0,
        preventDefault() {},
        stopPropagation() {},
      },
    };
    handler(event);
    return true;
  }

  function forceSelectOption(element) {
    const option = element && (element.closest('.ant-select-item-option,[role="option"]') || element);
    if (!option) return false;
    const content = option.querySelector('.ant-select-item-option-content') || element || option;
    let handled = false;
    handled = callReactHandler(option, 'onMouseMove', content) || handled;
    handled = callReactHandler(option, 'onMouseDown', content) || handled;
    handled = callReactHandler(option, 'onClick', content) || handled;
    handled = callReactHandler(content, 'onMouseDown', content) || handled;
    handled = callReactHandler(content, 'onClick', content) || handled;
    return clickSelectOption(option) || handled;
  }

  function pressKey(element, key) {
    if (!element) return;
    element.dispatchEvent(new KeyboardEvent('keydown', { key, code: key, bubbles: true, cancelable: true }));
    element.dispatchEvent(new KeyboardEvent('keypress', { key, code: key, bubbles: true, cancelable: true }));
    element.dispatchEvent(new KeyboardEvent('keyup', { key, code: key, bubbles: true, cancelable: true }));
  }

  function findFieldContainerByText(text) {
    const nodes = Array.from(document.querySelectorAll('label,.ant-form-item,.form-group,.row,div,td,th')).filter(visibleElement);
    const matches = nodes
      .filter((node) => elementText(node).includes(text) && node.querySelector('input,.ant-select,button'))
      .map((node) => ({ node, length: elementText(node).length, area: node.getBoundingClientRect().width * node.getBoundingClientRect().height }))
      .sort((a, b) => a.length - b.length || a.area - b.area);
    return matches[0] ? matches[0].node : null;
  }

  function findVisibleSelectOptionExact(value) {
    const textValue = String(value);
    const visibleDropdowns = Array.from(document.querySelectorAll('.ant-select-dropdown')).filter((node) => {
      if (!visibleElement(node)) return false;
      return !String(node.className || '').includes('ant-select-dropdown-hidden');
    });
    const roots = visibleDropdowns.length ? visibleDropdowns : [document];
    for (const root of roots) {
      const options = Array.from(root.querySelectorAll('.ant-select-item-option,[role="option"]')).filter(visibleElement);
      const exact = options.find((node) => elementText(node) === textValue || String(node.getAttribute('title') || '').trim() === textValue);
      if (exact) return exact;
      const contentExact = Array.from(root.querySelectorAll('.ant-select-item-option-content'))
        .filter(visibleElement)
        .find((node) => elementText(node) === textValue);
      if (contentExact) return contentExact.closest('.ant-select-item-option,[role="option"]') || contentExact;
      const contains = options.find((node) => elementText(node).split(/\s+/).includes(textValue));
      if (contains) return contains;
      const fallback = Array.from(root.querySelectorAll('div,span'))
        .filter(visibleElement)
        .map((node) => ({ node, text: elementText(node), rect: node.getBoundingClientRect() }))
        .filter((item) => item.text === textValue && item.rect.width > 10 && item.rect.height > 10)
        .sort((a, b) => a.rect.width * a.rect.height - b.rect.width * b.rect.height)[0];
      if (fallback) return fallback.node.closest('.ant-select-item-option,[role="option"]') || fallback.node;
    }
    return null;
  }

  function clearSelectSearchValue(container) {
    Array.from(container.querySelectorAll('input[role="combobox"],input[type="search"]')).forEach((input) => {
      setInputValue(input, '');
    });
  }

  async function selectPostageTemplate111() {
    const container = findFieldContainerByText('\u8fd0\u8d39\u6a21\u677f') || document.body;
    const selectors = [
      '.ant-select-selector',
      '.ant-select',
      'input[role="combobox"]',
      'input[type="search"]',
      'input[type="text"]',
    ];
    let opener = null;
    for (const selector of selectors) {
      opener = Array.from(container.querySelectorAll(selector)).find(visibleElement);
      if (opener) break;
    }
    if (!opener) return { changed: false, reason: 'postage selector not found' };
    const getSelectedText = () => {
      return getSelectedTextInContainer(container);
    };
    for (let attempt = 0; attempt < 5; attempt += 1) {
      clearSelectSearchValue(container);
      clickElement(opener);
      await sleep(400);
      const searchInput = Array.from(document.querySelectorAll('.ant-select-dropdown input[role="combobox"],.ant-select-dropdown input[type="search"],input[role="combobox"],input[type="search"],input[type="text"]'))
        .filter((node) => visibleElement(node) && !node.closest(`#${PANEL_ID}`))
        .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)[0];
      if (searchInput) {
        setInputValue(searchInput, EDIT_PAGE_RULES.postageTemplateId);
        pressKey(searchInput, 'Enter');
        await sleep(500);
      }
      let option = findVisibleSelectOptionExact(EDIT_PAGE_RULES.postageTemplateId);
      if (option) {
        forceSelectOption(option);
        await sleep(500);
        const selectedText = getSelectedText();
        if (selectedText === EDIT_PAGE_RULES.postageTemplateId || selectedText.includes(EDIT_PAGE_RULES.postageTemplateId)) {
          return { changed: true, value: EDIT_PAGE_RULES.postageTemplateId, selectedText, attempts: attempt + 1, mode: 'direct-option' };
        }
      }
      await sleep(600);
      option = findVisibleSelectOptionExact(EDIT_PAGE_RULES.postageTemplateId);
      if (option) {
        forceSelectOption(option);
        await sleep(500);
      }
      const selectedText = getSelectedText();
      if (selectedText === EDIT_PAGE_RULES.postageTemplateId || selectedText.includes(EDIT_PAGE_RULES.postageTemplateId)) {
        return { changed: true, value: EDIT_PAGE_RULES.postageTemplateId, selectedText, attempts: attempt + 1 };
      }
    }
    clearSelectSearchValue(container);
    return { changed: false, reason: 'postage option 111 not selected', selectedText: getSelectedText(), attempts: 3 };
  }

  function getSelectedTextInContainer(container) {
    if (!container) return '';
    const selected = Array.from(container.querySelectorAll('.ant-select-selection-item,.ant-select-selection-selected-value,.ant-select-selection__choice__content,.ant-select-selection-placeholder,.select2-selection__rendered,input[type="text"]'))
      .filter(visibleElement)
      .map((node) => elementText(node))
      .find(Boolean);
    return String(selected || '').trim();
  }

  function isBlankSelectionText(text) {
    const normalized = String(text || '').replace(/\s+/g, ' ').trim();
    if (!normalized) return true;
    return /\u8bf7\u9009\u62e9|\u672a\u9009\u62e9|select\s+category|choose\s+category/i.test(normalized);
  }

  function isDrawerStorageProductText(text) {
    return /drawer\s+organizer|drawer\s+organizers|organizer\s+tray|storage\s+tray|storage\s+bin|acrylic\s+organizer|plastic\s+drawer/i.test(String(text || ''));
  }

  function isWrongDrawerStorageCategory(text) {
    return /\u5185\u8863|\u8863\u7269\u6536\u7eb3|underwear|clothing\s*&?\s*wardrobe/i.test(String(text || ''));
  }

  function isGoodDrawerStorageCategory(text) {
    const value = String(text || '');
    return /\u5bb6\u5c45\u7528\u54c1|home\s*&\s*garden|\u5bb6\u7528\u50a8\u5b58|\u6536\u7eb3|home\s+storage|home\s+office\s+storage|storage\s+box/i.test(value) && !isWrongDrawerStorageCategory(value);
  }

  function getCurrentEditTitleText() {
    const titleInput = findProductTitleInput();
    return firstNonEmpty(titleInput ? getInputText(titleInput) : '', (getProductFromEdit(state.editData) || {}).subject, '');
  }

  function findProductCategoryContainer() {
    const label = '\u4ea7\u54c1\u5206\u7c7b';
    const nodes = Array.from(document.querySelectorAll('.ant-form-item,.form-group,.row,div,td,tr'))
      .filter((node) => !node.closest(`#${PANEL_ID}`) && visibleElement(node))
      .filter((node) => elementText(node).includes(label) && node.querySelector('.ant-select,input,button'));
    const ranked = nodes
      .map((node) => ({ node, text: elementText(node), rect: node.getBoundingClientRect() }))
      .filter((item) => item.text.length < 500)
      .sort((a, b) => a.text.length - b.text.length || a.rect.top - b.rect.top);
    return ranked[0] ? ranked[0].node : findFieldContainerByText(label);
  }

  function getProductCategorySelectedText() {
    const container = findProductCategoryContainer();
    return {
      container,
      selectedText: getSelectedTextInContainer(container),
    };
  }

  function buildVisibleCategoryTerms() {
    const product = getProductFromEdit(state.editData) || {};
    const titleInput = findProductTitleInput();
    const title = firstNonEmpty(
      titleInput ? getInputText(titleInput) : '',
      product.subject,
      product.title,
      product.productTitle,
      ''
    );
    const payload = {
      subject: title,
      categoryName: firstNonEmpty(product.categoryName, product.sourceCategoryName, ''),
    };
    const terms = [];
    const push = (value) => {
      const text = String(value || '').replace(/\s+/g, ' ').trim();
      if (text && !terms.some((item) => item.toLowerCase() === text.toLowerCase())) terms.push(text);
    };
    pushCategoryMappingTerms(
      [
        title,
        product.subject,
        product.title,
        product.productTitle,
        product.categoryName,
        product.categoryNameZh,
        product.sourceCategoryName,
      ].join(' '),
      push
    );
    push(product.categoryName);
    push(product.categoryNameZh);
    push(product.sourceCategoryName);
    push(product.sourceCategoryNameZh);
    buildCategorySearchTerms(payload, product, getAmazonBatchItem(product)).forEach(push);
    return terms.slice(0, 12);
  }

  function categoryOptionMatchesTerm(optionText, term) {
    const option = normalizeCategoryText(optionText);
    const wanted = normalizeCategoryText(term);
    if (!option || !wanted) return false;
    if (option === wanted || option.includes(wanted)) return true;
    const wantedTokens = tokenizeCategoryTitle(wanted);
    const optionTokens = tokenizeCategoryTitle(option);
    if (!wantedTokens.length) return false;
    const matched = wantedTokens.filter((token) => optionTokens.includes(token)).length;
    return matched >= Math.max(2, Math.ceil(wantedTokens.length * 0.75));
  }

  function findVisibleCategoryOptionForTerms(terms) {
    const visibleDropdowns = Array.from(document.querySelectorAll('.ant-select-dropdown')).filter((node) => {
      if (!visibleElement(node)) return false;
      return !String(node.className || '').includes('ant-select-dropdown-hidden');
    });
    const roots = visibleDropdowns.length ? visibleDropdowns : [document];
    for (const root of roots) {
      const options = Array.from(root.querySelectorAll('.ant-select-item-option,[role="option"],li,div,span'))
        .filter(visibleElement)
        .map((node) => ({ node, text: elementText(node) }))
        .filter((item) => item.text && item.text.length < 240);
      for (const term of terms) {
        const exact = options.find((item) => categoryOptionMatchesTerm(item.text, term));
        if (exact) return { option: exact.node.closest('.ant-select-item-option,[role="option"]') || exact.node, term, optionText: exact.text };
      }
    }
    return null;
  }

  function getVisibleCategoryModal() {
    return Array.from(document.querySelectorAll('.ant-modal,.ant-drawer,[role="dialog"]'))
      .filter((node) => visibleElement(node) && /选择|分类|类目|category/i.test(elementText(node)))
      .sort((a, b) => elementText(a).length - elementText(b).length)[0] || null;
  }

  function findCategoryModalItemByText(texts, columnIndex = null) {
    const modal = getVisibleCategoryModal();
    if (!modal) return null;
    const boxes = Array.from(modal.querySelectorAll('.categories-box,.category-box,.ant-tree,.ant-list,ul,div'))
      .filter(visibleElement)
      .map((box) => ({ box, rect: box.getBoundingClientRect(), text: elementText(box) }))
      .filter((item) => item.rect.width > 40 && item.rect.height > 40 && item.text.length < 6000)
      .sort((a, b) => a.rect.left - b.rect.left || a.rect.top - b.rect.top);
    const roots = columnIndex == null || !boxes[columnIndex] ? boxes.map((item) => item.box) : [boxes[columnIndex].box];
    const wanted = texts.map((text) => normalizeCategoryText(text));
    for (const root of roots) {
      const items = Array.from(root.querySelectorAll('.categories-item,.category-item,li,span,div'))
        .filter(visibleElement)
        .map((node) => ({ node, text: elementText(node), rect: node.getBoundingClientRect() }))
        .filter((item) => item.text && item.text.length < 260 && item.rect.width > 20 && item.rect.height > 8)
        .sort((a, b) => a.text.length - b.text.length);
      for (const item of items) {
        const text = normalizeCategoryText(item.text);
        if (wanted.some((value) => value && (text.includes(value) || value.includes(text)))) return item.node;
      }
    }
    return null;
  }

  async function clickCategoryModalItem(texts, columnIndex = null) {
    const item = findCategoryModalItemByText(texts, columnIndex);
    if (!item) return { ok: false, reason: `category item not found: ${texts.join(' / ')}` };
    clickElement(item);
    await sleep(700);
    return { ok: true, text: elementText(item) };
  }

  async function selectFastDrawerStorageCategory() {
    const title = getCurrentEditTitleText();
    if (!isDrawerStorageProductText(title)) return { skipped: true, reason: 'not drawer storage product' };
    const current = getProductCategorySelectedText();
    if (current.selectedText && isGoodDrawerStorageCategory(current.selectedText)) {
      return { ok: true, changed: false, selectedText: current.selectedText, mode: 'already-good-fast-path' };
    }
    const button = Array.from(document.querySelectorAll('button,a,.ant-btn'))
      .filter((node) => !node.closest(`#${PANEL_ID}`) && visibleElement(node))
      .find((node) => elementText(node).includes('\u9009\u62e9\u5206\u7c7b') || elementText(node).includes('\u9009\u62e9\u7c7b\u76ee'));
    if (!button) return { ok: false, reason: 'category choose button not found' };
    clickElement(button);
    await sleep(900);

    const searchInput = Array.from(document.querySelectorAll('.ant-modal input[type="text"],.ant-modal input[type="search"],input[type="text"],input[type="search"]'))
      .filter((node) => visibleElement(node) && !node.closest(`#${PANEL_ID}`))
      .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)[0];
    if (searchInput) setInputValue(searchInput, '');

    const top = await clickCategoryModalItem(['\u5bb6\u5c45\u7528\u54c1', 'Home & Garden'], 0);
    if (!top.ok) return top;
    const mid = await clickCategoryModalItem(['\u5bb6\u7528\u50a8\u5b58\u6536\u85cf\u7528\u5177', 'Home Storage & Organization'], 1);
    if (!mid.ok) return mid;
    const leaf =
      (await clickCategoryModalItem(['\u5bb6\u7528\u529e\u516c\u6536\u7eb3\u7528\u54c1', 'Home Office Storage'], 2)).ok
        ? { ok: true, text: '\u5bb6\u7528\u529e\u516c\u6536\u7eb3\u7528\u54c1(Home Office Storage)' }
        : await clickCategoryModalItem(['\u6536\u7eb3\u76d2\u548c\u6536\u7eb3\u7bb1', 'Storage Boxes & Bins'], 2);
    if (!leaf.ok) return leaf;

    const confirmButton = Array.from(document.querySelectorAll('.ant-modal button,.ant-drawer button,button,a,.ant-btn'))
      .filter((node) => visibleElement(node) && !node.closest(`#${PANEL_ID}`))
      .find((node) => /\u9009\u62e9|\u786e\u5b9a|\u4fdd\u5b58/.test(elementText(node)) && !/\u53d6\u6d88|\u5173\u95ed/.test(elementText(node)));
    if (confirmButton) {
      clickElement(confirmButton);
      await sleep(1200);
    }
    const after = getProductCategorySelectedText();
    return {
      ok: !isBlankSelectionText(after.selectedText) && isGoodDrawerStorageCategory(after.selectedText),
      changed: true,
      selectedText: after.selectedText,
      mode: 'fast-drawer-storage-path',
      leaf: leaf.text,
    };
  }

  async function selectVisibleProductCategory() {
    const current = getProductCategorySelectedText();
    if (!current.container) return { changed: false, ok: false, reason: 'product category container not found' };
    const title = getCurrentEditTitleText();
    if (isDrawerStorageProductText(title)) {
      const fast = await selectFastDrawerStorageCategory();
      if (fast.ok) return fast;
    }
    if (!isBlankSelectionText(current.selectedText) && !isWrongDrawerStorageCategory(current.selectedText)) {
      return { changed: false, ok: true, selectedText: current.selectedText, mode: 'already-selected' };
    }

    const terms = buildVisibleCategoryTerms();
    const opener = Array.from(current.container.querySelectorAll('.ant-select-selector,.ant-select,input[role="combobox"],input[type="search"],input[type="text"],button'))
      .filter(visibleElement)[0];
    if (!opener) return { changed: false, ok: false, reason: 'product category selector not found', terms };

    for (const term of terms) {
      clickElement(opener);
      await sleep(350);
      const searchInput = Array.from(document.querySelectorAll('.ant-select-dropdown input[role="combobox"],.ant-select-dropdown input[type="search"],input[role="combobox"],input[type="search"]'))
        .filter((node) => visibleElement(node) && !node.closest(`#${PANEL_ID}`))[0];
      if (searchInput) {
        setInputValue(searchInput, term);
        pressKey(searchInput, 'Enter');
        await sleep(650);
      }
      const matched = findVisibleCategoryOptionForTerms([term]);
      if (!matched) continue;
      forceSelectOption(matched.option);
      await sleep(700);
      const after = getProductCategorySelectedText();
      if (!isBlankSelectionText(after.selectedText)) {
        return {
          changed: true,
          ok: true,
          selectedText: after.selectedText,
          matchedTerm: matched.term,
          optionText: matched.optionText,
          mode: 'dropdown-search',
        };
      }
    }

    const categoryButton = Array.from(current.container.querySelectorAll('button,a,.ant-btn'))
      .filter(visibleElement)
      .find((node) => elementText(node).includes('\u9009\u62e9\u5206\u7c7b'));
    if (categoryButton) {
      clickElement(categoryButton);
      await sleep(900);
      for (const term of terms) {
        const searchInput = Array.from(document.querySelectorAll('.ant-modal input[type="text"],.ant-modal input[type="search"],.ant-drawer input[type="text"],.ant-drawer input[type="search"],input[type="text"],input[type="search"]'))
          .filter((node) => visibleElement(node) && !node.closest(`#${PANEL_ID}`))
          .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)[0];
        if (searchInput) {
          setInputValue(searchInput, term);
          pressKey(searchInput, 'Enter');
          await sleep(700);
        }
        const matched = findVisibleCategoryOptionForTerms([term]);
        if (!matched) continue;
        forceSelectOption(matched.option);
        clickElement(matched.option);
        await sleep(500);
        const confirmButton = Array.from(document.querySelectorAll('.ant-modal button,.ant-drawer button,button,a,.ant-btn'))
          .filter((node) => visibleElement(node) && !node.closest(`#${PANEL_ID}`))
          .find((node) => /\u786e\u5b9a|\u4fdd\u5b58|\u9009\u62e9/.test(elementText(node)) && !/\u53d6\u6d88/.test(elementText(node)));
        if (confirmButton) {
          clickElement(confirmButton);
          await sleep(800);
        }
        const after = getProductCategorySelectedText();
        if (!isBlankSelectionText(after.selectedText)) {
          return {
            changed: true,
            ok: true,
            selectedText: after.selectedText,
            matchedTerm: matched.term,
            optionText: matched.optionText,
            mode: 'category-button-modal',
          };
        }
      }
    }

    return { changed: false, ok: false, reason: 'no high-confidence category option selected', terms };
  }

  const VISIBLE_REQUIRED_ATTRIBUTE_RULES = [
    {
      id: 'brand',
      label: /\u54c1\u724c|brand/i,
      values: ['None', 'NONE', 'No Brand', 'NoBrand'],
    },
    {
      id: 'high_concerned_chemical',
      label: /\u9ad8\u5173\u6ce8\u5316\u5b66\u54c1|high[-\s]?concerned chemical/i,
      values: ['\u5929\u7136\u672a\u5904\u7406(None)', '\u5929\u7136\u672a\u5904\u7406', 'None', 'No', '\u65e0'],
    },
    {
      id: 'function',
      label: /\u529f\u80fd|function/i,
      values: ['Other', '\u5176\u4ed6', 'Reusable', '\u53ef\u91cd\u590d\u4f7f\u7528'],
    },
    {
      id: 'feature',
      label: /\u7279\u6027|\u7279\u70b9|feature/i,
      values: ['Multi-Purpose', '\u591a\u7528\u9014', 'Reusable', '\u53ef\u91cd\u590d\u4f7f\u7528', 'Other', '\u5176\u4ed6'],
    },
    {
      id: 'use',
      label: /\u7528\u9014|^use$|\(use\)/i,
      values: ['Other', '\u5176\u4ed6', 'Home', 'Household', 'Office', 'Storage'],
    },
    {
      id: 'origin',
      label: /\u4ea7\u5730|\u56fd\u5bb6\u6216\u5730\u533a|origin/i,
      values: ['\u7f8e\u56fd(Origin)(US(Origin))', 'US(Origin)', 'United States', '\u7f8e\u56fd', 'USA', 'US'],
    },
  ];

  function getVisibleMaterialCandidateValues() {
    const product = getProductFromEdit(state.editData) || {};
    const titleInput = findProductTitleInput();
    const payload = {
      subject: firstNonEmpty(titleInput ? getInputText(titleInput) : '', product.subject, product.title, product.productTitle, ''),
    };
    const candidates = inferMaterialCandidates(payload, product);
    const values = [];
    for (const candidate of candidates) {
      if (/pet/i.test(candidate)) values.push('PET', 'Plastic', '\u5851\u6599');
      else if (/acrylic/i.test(candidate)) values.push('Acrylic', '\u4e9a\u514b\u529b', 'Plastic', '\u5851\u6599');
      else if (/plastic|abs/i.test(candidate)) values.push('Plastic', '\u5851\u6599', 'ABS');
      else if (/silicone/i.test(candidate)) values.push('Silicone', '\u7845\u80f6');
      else if (/rubber/i.test(candidate)) values.push('Rubber', '\u6a61\u80f6');
      else if (/metal/i.test(candidate)) values.push('Metal', '\u91d1\u5c5e');
      else if (/wood/i.test(candidate)) values.push('Wood', '\u6728');
      else if (/fiberglass/i.test(candidate)) values.push('Fiberglass', 'Glass Fiber', '\u73bb\u7483\u7ea4\u7ef4');
    }
    values.push('PET', 'Plastic', '\u5851\u6599');
    return Array.from(new Set(values));
  }

  function findVisibleAttributeContainers() {
    return Array.from(document.querySelectorAll('.ant-form-item,.form-group,.row,div,td,tr'))
      .filter((node) => !node.closest(`#${PANEL_ID}`) && visibleElement(node))
      .filter((node) => node.querySelector('.ant-select,input[role="combobox"],input[type="search"],input[type="text"]'))
      .map((node) => ({ node, text: elementText(node), rect: node.getBoundingClientRect() }))
      .filter((item) => item.text && item.text.length < 700)
      .sort((a, b) => a.text.length - b.text.length || a.rect.top - b.rect.top);
  }

  function findVisibleOptionByCandidateValues(values) {
    const normalizedValues = values.map((value) => normalizeCategoryText(value)).filter(Boolean);
    const visibleDropdowns = Array.from(document.querySelectorAll('.ant-select-dropdown')).filter((node) => {
      if (!visibleElement(node)) return false;
      return !String(node.className || '').includes('ant-select-dropdown-hidden');
    });
    const roots = visibleDropdowns.length ? visibleDropdowns : [document];
    for (const root of roots) {
      const options = Array.from(root.querySelectorAll('.ant-select-item-option,[role="option"],li,div,span'))
        .filter(visibleElement)
        .map((node) => ({ node, text: elementText(node) }))
        .filter((item) => item.text && item.text.length < 220);
      for (const value of normalizedValues) {
        const found = options.find((item) => {
          const text = normalizeCategoryText(item.text);
          return text === value || text.includes(value);
        });
        if (found) return { option: found.node.closest('.ant-select-item-option,[role="option"]') || found.node, optionText: found.text };
      }
    }
    return null;
  }

  function selectedTextMatchesCandidateValues(selectedText, values) {
    const selected = normalizeCategoryText(selectedText);
    if (!selected) return false;
    return values.some((value) => {
      const wanted = normalizeCategoryText(value);
      return wanted && (selected === wanted || selected.includes(wanted) || wanted.includes(selected));
    });
  }

  async function selectAttributeContainerValue(container, values, options = {}) {
    const selectedText = getSelectedTextInContainer(container);
    if (!isBlankSelectionText(selectedText) && selectedTextMatchesCandidateValues(selectedText, values)) {
      return { changed: false, ok: true, selectedText, mode: 'already-selected' };
    }
    if (!isBlankSelectionText(selectedText) && options.keepNonBlank) {
      return { changed: false, ok: true, selectedText, mode: 'already-selected-nonblank' };
    }
    const checkboxes = Array.from(container.querySelectorAll('input[type="checkbox"]')).filter((node) => !node.closest(`#${PANEL_ID}`));
    if (checkboxes.length) {
      const checkedText = checkboxes.filter((node) => node.checked).map((node) => checkboxNearbyText(node)).join(' ');
      if (selectedTextMatchesCandidateValues(checkedText, values)) {
        return { changed: false, ok: true, selectedText: checkedText, mode: 'already-checked' };
      }
      for (const value of values) {
        const wanted = normalizeCategoryText(value);
        const box = checkboxes.find((node) => {
          const text = normalizeCategoryText(checkboxNearbyText(node));
          return wanted && (text.includes(wanted) || wanted.includes(text));
        });
        if (box) {
          const changed = setCheckboxChecked(box, true);
          await sleep(250);
          return { changed, ok: Boolean(box.checked), selectedText: checkboxNearbyText(box), mode: 'checkbox' };
        }
      }
    }
    const opener = Array.from(container.querySelectorAll('.ant-select-selector,.ant-select,input[role="combobox"],input[type="search"],input[type="text"]'))
      .filter(visibleElement)[0];
    if (!opener) return { changed: false, ok: false, reason: 'attribute selector not found' };
    for (const value of values) {
      clickElement(opener);
      await sleep(250);
      const searchInput = Array.from(document.querySelectorAll('.ant-select-dropdown input[role="combobox"],.ant-select-dropdown input[type="search"],input[role="combobox"],input[type="search"]'))
        .filter((node) => visibleElement(node) && !node.closest(`#${PANEL_ID}`))[0];
      if (searchInput) {
        setInputValue(searchInput, value);
        pressKey(searchInput, 'Enter');
        await sleep(400);
      }
      const option = findVisibleOptionByCandidateValues([value]);
      if (!option) continue;
      forceSelectOption(option.option);
      await sleep(450);
      const afterText = getSelectedTextInContainer(container);
      if (!isBlankSelectionText(afterText)) {
        return { changed: true, ok: true, selectedText: afterText, optionText: option.optionText };
      }
    }
    return { changed: false, ok: false, reason: 'attribute value not selected', values };
  }

  async function fillVisibleRequiredAttributeFields() {
    const containers = findVisibleAttributeContainers();
    const results = [];
    const dynamicRules = VISIBLE_REQUIRED_ATTRIBUTE_RULES.concat([
      {
        id: 'frame_material',
        label: /\u6846\u67b6\u6750\u8d28|frame material/i,
        values: getVisibleMaterialCandidateValues(),
      },
      {
        id: 'material',
        label: /\u6750\u8d28|material/i,
        exclude: /\u6846\u67b6\u6750\u8d28|frame material/i,
        values: getVisibleMaterialCandidateValues(),
      },
    ]);
    for (const rule of dynamicRules) {
      const matches = containers.filter((candidate) => rule.label.test(candidate.text) && !(rule.exclude && rule.exclude.test(candidate.text)));
      if (!matches.length) {
        results.push({ id: rule.id, ok: true, changed: false, skipped: true, reason: 'container not visible on this category' });
        continue;
      }
      const item = matches[0];
      const result = await selectAttributeContainerValue(item.node, rule.values);
      results.push({ id: rule.id, ...result });
    }
    return {
      changed: results.some((item) => item.changed),
      ok: results.every((item) => item.ok),
      results,
    };
  }

  function findVisibleShipFromSection() {
    const nodes = Array.from(document.querySelectorAll('.ant-form-item,.form-group,.row,section,div,td,tr'))
      .filter((node) => !node.closest(`#${PANEL_ID}`) && visibleElement(node))
      .map((node) => ({ node, text: elementText(node), rect: node.getBoundingClientRect() }))
      .filter((item) => /\u53d1\u8d27\u5730|ships?\s*from/i.test(item.text) && /united states|\u7f8e\u56fd/i.test(item.text) && item.text.length < 1800)
      .sort((a, b) => a.text.length - b.text.length || a.rect.top - b.rect.top);
    return nodes[0] ? nodes[0].node : null;
  }

  function checkboxNearbyText(input) {
    if (!input) return '';
    const label = input.closest('label');
    if (label) return elementText(label);
    const parent = input.parentElement;
    const siblingText = [input.nextSibling, parent && parent.nextSibling]
      .map((node) => String((node && (node.innerText || node.textContent)) || ''))
      .join(' ');
    return normalizeSpaces(`${elementText(parent)} ${siblingText}`);
  }

  function setCheckboxChecked(input, checked) {
    if (!input) return false;
    if (Boolean(input.checked) === Boolean(checked)) return false;
    const label = input.closest('label') || input.parentElement;
    clickElement(label || input);
    if (Boolean(input.checked) === Boolean(checked)) return true;
    input.checked = Boolean(checked);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return Boolean(input.checked) === Boolean(checked);
  }

  function getVisibleShipsFromStatus() {
    const section = findVisibleShipFromSection();
    if (!section) return { ok: false, reason: 'ships from section not found' };
    const checkboxes = Array.from(section.querySelectorAll('input[type="checkbox"]'))
      .filter((node) => !node.closest(`#${PANEL_ID}`));
    const usCheckbox = checkboxes.find((node) => /united states|\u7f8e\u56fd/i.test(checkboxNearbyText(node)));
    return {
      ok: Boolean(usCheckbox && usCheckbox.checked),
      hasSection: true,
      hasUnitedStates: Boolean(usCheckbox),
      selectedText: usCheckbox ? checkboxNearbyText(usCheckbox) : '',
    };
  }

  function selectVisibleShipsFromUnitedStates() {
    const section = findVisibleShipFromSection();
    if (!section) return { changed: false, ok: false, reason: 'ships from section not found' };
    const checkboxes = Array.from(section.querySelectorAll('input[type="checkbox"]'))
      .filter((node) => !node.closest(`#${PANEL_ID}`));
    const usCheckbox = checkboxes.find((node) => /united states|\u7f8e\u56fd/i.test(checkboxNearbyText(node)));
    if (!usCheckbox) return { changed: false, ok: false, reason: 'United States checkbox not found' };
    const changed = setCheckboxChecked(usCheckbox, true);
    return { changed, ok: Boolean(usCheckbox.checked), selectedText: checkboxNearbyText(usCheckbox) };
  }

  function findCustomAttributeSection() {
    const label = '\u81ea\u5b9a\u4e49\u5c5e\u6027';
    const nodes = Array.from(document.querySelectorAll('.ant-form-item,.form-group,.row,table,tbody,section,div'))
      .filter((node) => !node.closest(`#${PANEL_ID}`) && visibleElement(node))
      .filter((node) => elementText(node).includes(label) && node.querySelector('input,button,a,span'));
    const ranked = nodes
      .map((node) => ({ node, text: elementText(node), rect: node.getBoundingClientRect() }))
      .filter((item) => item.text.length < 1600)
      .sort((a, b) => a.text.length - b.text.length || a.rect.top - b.rect.top);
    if (ranked[0]) return ranked[0].node;
    const fallback = nodes
      .map((node) => ({ node, text: elementText(node), rect: node.getBoundingClientRect() }))
      .filter((item) => item.text.length < 6000)
      .sort((a, b) => a.rect.width * a.rect.height - b.rect.width * b.rect.height || a.text.length - b.text.length);
    return fallback[0] ? fallback[0].node : null;
  }

  function getCustomAttributeInputs(section) {
    if (!section) return [];
    return Array.from(section.querySelectorAll('input[type="text"],textarea'))
      .filter((node) => !node.closest(`#${PANEL_ID}`) && node.type !== 'hidden' && visibleElement(node));
  }

  function normalizeCustomAttributeText(value) {
    const sanitized = normalizeSpaces(sanitizePlatformText(value));
    if (sanitized.length <= EDIT_PAGE_RULES.customAttributeMaxChars) return sanitized;
    return sanitized.slice(0, EDIT_PAGE_RULES.customAttributeMaxChars).trim();
  }

  function getVisibleCustomAttributeValues() {
    const section = findCustomAttributeSection();
    if (!section) return { section: null, values: [] };
    const values = getCustomAttributeInputs(section)
      .map((node) => getInputText(node))
      .filter((value) => String(value || '').trim() !== '');
    return { section, values };
  }

  function getVisibleCustomAttributeStatus() {
    const current = getVisibleCustomAttributeValues();
    const invalid = current.values
      .map((value, index) => ({
        index,
        value,
        length: String(value || '').length,
        issues: findPlatformTextIssues(value),
      }))
      .filter((item) => item.length > EDIT_PAGE_RULES.customAttributeMaxChars || item.issues.length);
    return {
      ok: invalid.length === 0,
      section: current.section,
      values: current.values,
      count: current.values.length,
      invalid,
    };
  }

  async function clearVisibleCustomAttributes() {
    if (!EDIT_PAGE_RULES.customAttributesDefaultSkip) return { changed: false, skipped: true };
    const current = getVisibleCustomAttributeValues();
    if (!current.section) return { changed: false, ok: true, reason: 'custom attribute section not found' };
    const beforeCount = current.values.length;
    let clicked = 0;
    const controls = Array.from(current.section.querySelectorAll('button,a,span,i,.anticon,.anticon-close,.anticon-delete,.anticon-minus-circle,.icon-close,.icon-delete'))
      .filter((node) => !node.closest(`#${PANEL_ID}`) && visibleElement(node))
      .filter((node) => {
        const text = elementText(node);
        const className = String(node.className || '');
        const aria = String(node.getAttribute('aria-label') || node.getAttribute('title') || '');
        return /^[xX×]$/.test(text) || /delete|remove|close|minus|trash/i.test(`${className} ${aria}`);
      })
      .slice(0, 20);
    for (const control of controls.reverse()) {
      clickElement(control);
      clicked += 1;
      await sleep(120);
    }
    let cleared = 0;
    getCustomAttributeInputs(current.section).forEach((node) => {
      if (getInputText(node) && setInputValue(node, '')) cleared += 1;
    });
    await sleep(300);
    let after = getVisibleCustomAttributeStatus();
    let normalized = 0;
    if (!after.ok) {
      getCustomAttributeInputs(after.section || current.section).forEach((node) => {
        const before = getInputText(node);
        const next = normalizeCustomAttributeText(before);
        if (before && before !== next && setInputValue(node, next)) normalized += 1;
      });
      await sleep(200);
      after = getVisibleCustomAttributeStatus();
    }
    return {
      changed: clicked > 0 || cleared > 0 || normalized > 0,
      ok: after.ok,
      beforeCount,
      afterCount: after.count,
      invalidCount: after.invalid.length,
      clicked,
      cleared,
      normalized,
    };
  }

  function getVisiblePcDescriptionChars() {
    const target = findVisiblePcDescriptionTarget();
    if (!target) return 0;
    const text = target.type === 'iframe' || target.type === 'contenteditable'
      ? String(target.node.innerText || target.node.textContent || '')
      : getInputText(target.node).replace(/<[^>]+>/g, ' ');
    return text.replace(/\s+/g, ' ').trim().length;
  }

  function verifyEditTemplateSelections() {
    const postageContainer = findFieldContainerByText('\u8fd0\u8d39\u6a21\u677f') || document.body;
    const postageSelectedText = getSelectedTextInContainer(postageContainer);
    const category = getProductCategorySelectedText();
    return {
      postage111: postageSelectedText === EDIT_PAGE_RULES.postageTemplateId || postageSelectedText.includes(EDIT_PAGE_RULES.postageTemplateId),
      postageSelectedText,
      categorySelected: !isBlankSelectionText(category.selectedText),
      categorySelectedText: category.selectedText,
    };
  }

  function getVisibleRequiredAttributeStatus() {
    const containers = findVisibleAttributeContainers();
    const rules = VISIBLE_REQUIRED_ATTRIBUTE_RULES.concat([
      {
        id: 'frame_material',
        label: /\u6846\u67b6\u6750\u8d28|frame material/i,
        values: getVisibleMaterialCandidateValues(),
      },
      {
        id: 'material',
        label: /\u6750\u8d28|material/i,
        exclude: /\u6846\u67b6\u6750\u8d28|frame material/i,
        values: getVisibleMaterialCandidateValues(),
      },
    ]);
    const fields = rules.map((rule) => {
      const item = containers.find((candidate) => rule.label.test(candidate.text) && !(rule.exclude && rule.exclude.test(candidate.text)));
      if (!item) return { id: rule.id, ok: true, skipped: true, reason: 'container not visible on this category' };
      const selectedText = getSelectedTextInContainer(item.node);
      return {
        id: rule.id,
        ok: !isBlankSelectionText(selectedText) && selectedTextMatchesCandidateValues(selectedText, rule.values),
        selectedText,
      };
    });
    return {
      ok: fields.every((item) => item.ok),
      fields,
      missing: fields.filter((item) => !item.ok).map((item) => item.id),
    };
  }

  function getVisibleEditPreflightStatus() {
    const titleInput = findProductTitleInput();
    const titleText = titleInput ? getInputText(titleInput) : '';
    const customAttributes = getVisibleCustomAttributeStatus();
    const templates = verifyEditTemplateSelections();
    const requiredAttributes = getVisibleRequiredAttributeStatus();
    const shipsFrom = getVisibleShipsFromStatus();
    const risks = [];
    if (!titleText || titleText.length > EDIT_PAGE_RULES.titleMaxChars) risks.push(`title invalid length=${titleText.length}`);
    const titleForbiddenTerms = findForbiddenTitleTerms(titleText, getCurrentEditComplianceSource(titleText));
    if (titleForbiddenTerms.length) risks.push(`title contains brand/trademark terms: ${titleForbiddenTerms.join(', ')}`);
    if (!templates.categorySelected) risks.push('product category is not selected');
    if (isDrawerStorageProductText(titleText) && isWrongDrawerStorageCategory(templates.categorySelectedText)) risks.push(`category path is wrong for drawer storage: ${templates.categorySelectedText}`);
    if (!templates.postage111) risks.push(`postage template is not 111: ${templates.postageSelectedText || 'empty'}`);
    if (!requiredAttributes.ok) risks.push(`required attributes incomplete: ${requiredAttributes.missing.join(', ')}`);
    if (!shipsFrom.ok) risks.push(`ships from is not United States: ${shipsFrom.selectedText || shipsFrom.reason || 'empty'}`);
    if (document.body && /\u8bf7\u9009\u62e9\u5fc5\u9009\u53d8\u79cd\u5c5e\u6027/.test(document.body.innerText || '')) risks.push('variation parameter blocked: required variation attribute missing');
    const pcDescriptionChars = getVisiblePcDescriptionChars();
    if (pcDescriptionChars < EDIT_PAGE_RULES.pcDescriptionMinChars) risks.push(`PC description too short: ${pcDescriptionChars}`);
    if (!customAttributes.ok) {
      const invalidSummary = customAttributes.invalid
        .slice(0, 5)
        .map((item) => `#${item.index + 1} length=${item.length}${item.issues.length ? ` issues=${item.issues.join(',')}` : ''}`)
        .join('; ');
      risks.push(`custom attributes invalid: ${invalidSummary}`);
    }
    return {
      pass: risks.length === 0,
      risks,
      titleLength: titleText.length,
      pcDescriptionChars,
      templates,
      requiredAttributes,
      shipsFrom,
      customAttributeCount: customAttributes.count,
      customAttributeInvalidCount: customAttributes.invalid.length,
    };
  }

  function collectVisibleEditPageErrors() {
    const patterns = /(\u672a\u9009\u62e9|\u8bf7\u9009\u62e9|\u4e0d\u80fd\u8d85\u8fc7|\u4e0d\u80fd\u4e3a\u7a7a|\u5fc5\u586b|\u9519\u8bef|\u5931\u8d25)/;
    return Array.from(document.querySelectorAll('div,span,p,label,td'))
      .filter((node) => !node.closest(`#${PANEL_ID}`) && visibleElement(node))
      .map((node) => elementText(node))
      .filter((text) => text && text.length < 220 && patterns.test(text))
      .filter((text, index, list) => list.indexOf(text) === index)
      .slice(0, 20);
  }

  function findEditPageSaveButton() {
    const buttons = Array.from(document.querySelectorAll('button,a,.ant-btn,input[type="button"]'))
      .filter((node) => !node.closest(`#${PANEL_ID}`) && visibleElement(node))
      .map((node) => ({ node, text: elementText(node) || String(node.value || '') }));
    return (
      buttons.find((item) => item.text === '\u4fdd\u5b58\u5e76\u79fb\u5165\u5f85\u53d1\u5e03') ||
      buttons.find((item) => item.text === '\u4fdd\u5b58') ||
      buttons.find((item) => item.text.includes('\u4fdd\u5b58') && !item.text.includes('\u53d1\u5e03'))
    );
  }

  async function runEditPagePreflightAndFix() {
    const category = await selectVisibleProductCategory();
    const requiredAttributes = await fillVisibleRequiredAttributeFields();
    const shipsFrom = selectVisibleShipsFromUnitedStates();
    const customAttributes = await clearVisibleCustomAttributes();
    const postage = await selectPostageTemplate111();
    const sanitization = applyVisiblePlatformTextSanitization();
    const preflight = getVisibleEditPreflightStatus();
    const result = { category, requiredAttributes, shipsFrom, customAttributes, postage, sanitization, preflight };
    if (!state.report) state.report = {};
    state.report.editPagePreflight = result;
    return result;
  }

  async function saveEditPageWithPreflight() {
    if (!isEditPage()) throw new Error('not edit page');
    const applyResult = await applyVisibleEditPageRules({ manual: true, preSave: true });
    let preflight = await runEditPagePreflightAndFix();
    if (!preflight.preflight.pass) {
      throw new Error(`edit preflight failed: ${preflight.preflight.risks.join('; ')}`);
    }

    const button = findEditPageSaveButton();
    if (!button) throw new Error('edit page save button not found');
    clickElement(button.node);
    await sleep(3500);

    let errors = collectVisibleEditPageErrors();
    let retry = null;
    if (errors.length && EDIT_PAGE_RULES.saveRetryLimit > 0) {
      retry = await runEditPagePreflightAndFix();
      if (retry.preflight.pass) {
        const retryButton = findEditPageSaveButton();
        if (retryButton) {
          clickElement(retryButton.node);
          await sleep(3500);
          errors = collectVisibleEditPageErrors();
        }
      }
    }

    const result = {
      at: nowIso(),
      applyResult,
      preflight,
      retry,
      errors,
      clicked: button.text,
      ok: errors.length === 0,
    };
    if (!state.report) state.report = {};
    state.report.editPageSaveWithPreflight = result;
    log(`edit preflight save ${result.ok ? 'ok' : 'has errors'}: ${errors.join(' | ')}`, result);
    updateUi();
    return result;
  }

  function getMarketingImageStatus() {
    const sections = Array.from(document.querySelectorAll('div,section,td,tr')).filter((node) => elementText(node).includes('\u8425\u9500\u56fe\u7247'));
    const section = sections
      .map((node) => ({ node, textLength: elementText(node).length, rect: node.getBoundingClientRect() }))
      .sort((a, b) => a.textLength - b.textLength || b.rect.width * b.rect.height - a.rect.width * a.rect.height)[0];
    const root = section ? section.node : document;
    const urls = Array.from(root.querySelectorAll('img'))
      .filter(visibleElement)
      .map((img) => img.currentSrc || img.src || img.getAttribute('data-src') || '')
      .filter((url) => /^https?:\/\//i.test(url))
      .filter((url) => !/loading|addImg|logo|avatar|icon|sprite|static\/img/i.test(url));
    const generated = urls.filter((url) => /wxalbum|dianxiaomi/i.test(url));
    return { ready: generated.length >= EDIT_PAGE_RULES.marketingImageCount, count: generated.length, urls: generated.slice(0, EDIT_PAGE_RULES.marketingImageCount) };
  }

  async function triggerMarketingImageGeneration() {
    const before = getMarketingImageStatus();
    if (before.ready) return { changed: true, action: 'already has marketing images', count: before.count };
    const buttons = Array.from(document.querySelectorAll('button,a,.ant-btn')).filter(visibleElement);
    const button = buttons.find((node) => elementText(node).includes('\u4e00\u952e\u751f\u6210'));
    if (!button) return { changed: false, reason: 'one-click marketing image button not found' };
    clickElement(button);
    await sleep(2500);
    const after = getMarketingImageStatus();
    return { changed: after.ready || after.count > before.count, action: 'clicked one-click generate', count: after.count };
  }

  async function applyVisibleEditPageRules(options = {}) {
    if (!isEditPage()) return { skipped: true, reason: 'not edit page' };
    if (!state.editData) {
      try {
        await loadEditJson();
      } catch (_) {
        // Visible edit rules can still run without edit.json.
      }
    }
    const title = applyVisibleTitleRule();
    const marketing = await triggerMarketingImageGeneration();
    const description = applyVisiblePcDescriptionRule(title.value || '');
    const textSanitization = applyVisiblePlatformTextSanitization();
    let variation = null;
    try {
      variation = fillVisibleVariationFields();
    } catch (error) {
      variation = { changed: false, reason: error.message };
    }
    const category = await selectVisibleProductCategory();
    const requiredAttributes = await fillVisibleRequiredAttributeFields();
    const shipsFrom = selectVisibleShipsFromUnitedStates();
    const customAttributes = await clearVisibleCustomAttributes();
    const postage = await selectPostageTemplate111();
    const preflight = getVisibleEditPreflightStatus();
    const result = {
      at: nowIso(),
      manual: Boolean(options.manual),
      preSave: Boolean(options.preSave),
      title,
      description,
      textSanitization,
      variation,
      category,
      requiredAttributes,
      shipsFrom,
      customAttributes,
      postage,
      marketing,
      preflight,
    };
    state.visibleEditRuleResult = result;
    if (!state.report) state.report = {};
    state.report.visibleEditRuleResult = result;
    log(`\u7f16\u8f91\u9875\u89c4\u5219\u5df2\u5e94\u7528\uff1a\u6807\u9898${title.changed ? '\u5df2\u6539' : '\u672a\u6539'}\uff0c\u63cf\u8ff0${description.changed ? '\u5df2\u6539' : '\u672a\u6539'}\uff0c\u7c7b\u76ee${category.ok ? '\u5df2\u9009' : '\u672a\u9009'}\uff0c\u5fc5\u586b\u5c5e\u6027${requiredAttributes.ok ? '\u5df2\u5904\u7406' : '\u672a\u5b8c\u6210'}\uff0c\u53d1\u8d27\u5730${shipsFrom.ok ? '\u5df2\u9009\u7f8e\u56fd' : '\u672a\u9009'}\uff0c\u81ea\u5b9a\u4e49\u5c5e\u6027${customAttributes.ok ? '\u5df2\u5904\u7406' : '\u672a\u5408\u89c4'}\uff0c\u8fd0\u8d39111${postage.changed ? '\u5df2\u9009' : '\u672a\u9009'}\uff0c\u9884\u68c0${preflight.pass ? '\u901a\u8fc7' : '\u672a\u901a\u8fc7'}`, result);
    updateUi();
    return result;
  }

  function scheduleVisibleEditRulesAutoApply() {
    if (!isEditPage()) {
      visibleEditRulesAutoAppliedUrl = '';
      return;
    }
    const pageKey = `${location.pathname}${location.search}${location.hash}`;
    if (visibleEditRulesAutoAppliedUrl === pageKey) return;
    visibleEditRulesAutoAppliedUrl = pageKey;
    [2500, 9000].forEach((delay) => {
      window.setTimeout(() => {
        applyVisibleEditPageRules({ manual: false }).catch((error) => log(`\u7f16\u8f91\u9875\u89c4\u5219\u81ea\u52a8\u5e94\u7528\u5931\u8d25\uff1a${error.message}`));
      }, delay);
    });
  }

  function startVisibleEditRulesWatcher() {
    if (visibleEditRulesWatcherStarted) return;
    visibleEditRulesWatcherStarted = true;
    window.setInterval(scheduleVisibleEditRulesAutoApply, 1500);
  }

  function getVisibleVariationTable() {
    const tables = Array.from(document.querySelectorAll('table'));
    return tables.find((table) => {
      const text = table.innerText || '';
      return text.includes('\u8d27\u503c') && text.includes('\u7269\u6d41\u8d39') && text.includes('SKU\u7f16\u7801') && text.includes('\u91cd\u91cf');
    });
  }

  function getHeaderMap(table) {
    const headers = Array.from(table.querySelectorAll('thead th, tr:first-child th, tr:first-child td'));
    const map = {};
    headers.forEach((cell, index) => {
      const text = (cell.innerText || '').replace(/\s+/g, '');
      if (text.includes('\u8d27\u503c')) map.goodsValue = index;
      if (text.includes('\u7269\u6d41\u8d39')) map.logisticValue = index;
      if (text.includes('\u5546\u5bb6\u4ed3\u5e93\u5b58') || text.includes('\u5e93\u5b58')) map.stock = index;
      if (text.includes('SKU\u7f16\u7801')) map.skuCode = index;
      if (text.includes('\u91cd\u91cf')) map.weight = index;
      if (text.includes('\u5c3a\u5bf8')) map.size = index;
      if (text.includes('\u53d1\u8d27\u5730') || /ships?from/i.test(text)) map.shipFrom = index;
    });
    return map;
  }

  function getVariationRows(table) {
    const bodyRows = Array.from(table.querySelectorAll('tbody tr')).filter((row) => row.querySelector('input'));
    if (bodyRows.length) return bodyRows;
    return Array.from(table.querySelectorAll('tr')).slice(1).filter((row) => row.querySelector('input'));
  }

  function getCellInput(row, index, offset = 0) {
    const cells = Array.from(row.children);
    const cell = cells[index];
    if (!cell) return null;
    return Array.from(cell.querySelectorAll('input')).filter((input) => input.type !== 'hidden')[offset] || null;
  }

  function fillVisibleShipFromCell(row, index) {
    if (index == null) return false;
    const cell = Array.from(row.children)[index];
    if (!cell) return false;
    const selectedText = getSelectedTextInContainer(cell);
    if (/united states|美国/i.test(selectedText)) return false;
    const input = Array.from(cell.querySelectorAll('input')).find((node) => node.type !== 'hidden' && visibleElement(node));
    if (input) return setInputValue(input, 'United States');
    const opener = Array.from(cell.querySelectorAll('.ant-select-selector,.ant-select,input[role="combobox"],input[type="search"],input[type="text"],button'))
      .filter(visibleElement)[0];
    if (!opener) return false;
    clickElement(opener);
    const option = findVisibleSelectOptionExact('United States') || findVisibleSelectOptionExact('\u7f8e\u56fd');
    return option ? forceSelectOption(option) : false;
  }

  function getVisibleFillDefaults() {
    const product = getProductFromEdit(state.editData) || {};
    const asin = extractAsin(`${product.sourceUrl || ''} ${product.sourceId || ''} ${product.platformProductId || ''} ${product.subject || ''}`);
    const amazonItem = getAmazonBatchItem(product);
    const sourcePrice = inferSourcePrice(product, amazonItem);
    const supplyPrice = firstNonEmpty(getDefaultSupplyPrice(), calculateSupplyPriceCny(sourcePrice));
    const inferredAmazonWeightKg = inferAmazonWeightKg(product, amazonItem);
    const inferredAmazonDimensionsCm = inferAmazonDimensionsCm(product, amazonItem);
    return {
      skuCode: asin || state.productId,
      supplyPrice,
      logisticValue: '0',
      stock: getDefaultStock(),
      weight: firstNonEmpty(inferredAmazonWeightKg, getDefaultWeightKg()),
      length: firstNonEmpty(inferredAmazonDimensionsCm && inferredAmazonDimensionsCm.length, inchToCm(getDefaultLengthIn()), getDefaultLength()),
      width: firstNonEmpty(inferredAmazonDimensionsCm && inferredAmazonDimensionsCm.width, inchToCm(getDefaultWidthIn()), getDefaultWidth()),
      height: firstNonEmpty(inferredAmazonDimensionsCm && inferredAmazonDimensionsCm.height, inchToCm(getDefaultHeightIn()), getDefaultHeight()),
    };
  }

  function selectVisibleColorClear() {
    const labels = Array.from(document.querySelectorAll('label'))
      .filter((node) => !node.closest(`#${PANEL_ID}`) && visibleElement(node));
    const label = labels.find((node) => /\u900f\u660e|clear/i.test(elementText(node)) && node.querySelector('input[type="checkbox"]'));
    const input = label && label.querySelector('input[type="checkbox"]');
    if (!input) return { changed: false, ok: true, skipped: true, reason: 'clear color checkbox not visible' };
    const changed = setCheckboxChecked(input, true);
    return { changed, ok: Boolean(input.checked), selectedText: checkboxNearbyText(input) };
  }

  function fillVisibleVariationFields() {
    const table = getVisibleVariationTable();
    if (!table) {
      throw new Error('\u5f53\u524d\u9875\u9762\u6ca1\u6709\u627e\u5230\u53ef\u586b\u5199\u7684\u53d8\u79cd\u4fe1\u606f\u8868\u683c\uff0c\u8bf7\u5148\u8fdb\u5165\u4ea7\u54c1\u7f16\u8f91\u9875\u5e76\u6eda\u52a8\u5230\u53d8\u79cd\u4fe1\u606f');
    }
    const map = getHeaderMap(table);
    const rows = getVariationRows(table);
    if (!rows.length) throw new Error('\u53d8\u79cd\u4fe1\u606f\u8868\u683c\u6ca1\u6709\u53ef\u586b\u5199\u884c');
    const defaults = getVisibleFillDefaults();
    const shipsFromParam = selectVisibleShipsFromUnitedStates();
    const colorParam = selectVisibleColorClear();

    let count = 0;
    rows.forEach((row, rowIndex) => {
      if (map.goodsValue != null && defaults.supplyPrice) count += setInputValue(getCellInput(row, map.goodsValue), defaults.supplyPrice) ? 1 : 0;
      if (map.logisticValue != null) count += setInputValue(getCellInput(row, map.logisticValue), defaults.logisticValue) ? 1 : 0;
      if (map.stock != null) count += setInputValue(getCellInput(row, map.stock), defaults.stock) ? 1 : 0;
      if (map.skuCode != null) {
        const skuValue = rows.length > 1 ? `${defaults.skuCode}-${rowIndex + 1}` : defaults.skuCode;
        count += setInputValue(getCellInput(row, map.skuCode), skuValue) ? 1 : 0;
      }
      if (map.weight != null) count += setInputValue(getCellInput(row, map.weight), defaults.weight) ? 1 : 0;
      if (map.shipFrom != null) count += fillVisibleShipFromCell(row, map.shipFrom) ? 1 : 0;
      if (map.size != null) {
        count += setInputValue(getCellInput(row, map.size, 0), defaults.length) ? 1 : 0;
        count += setInputValue(getCellInput(row, map.size, 1), defaults.width) ? 1 : 0;
        count += setInputValue(getCellInput(row, map.size, 2), defaults.height) ? 1 : 0;
      }
    });
    log(`\u5df2\u8865\u5f53\u524d\u7f16\u8f91\u9875\u53d8\u79cd\u4fe1\u606f\uff1a${rows.length} \u884c\uff0c\u5199\u5165 ${count} \u4e2a\u5b57\u6bb5`);
    const blockedReasons = [];
    if (shipsFromParam.ok === false) blockedReasons.push(`shipsFrom: ${shipsFromParam.reason || shipsFromParam.selectedText || 'not United States'}`);
    if (colorParam.ok === false) blockedReasons.push(`color: ${colorParam.reason || colorParam.selectedText || 'not clear'}`);
    return {
      rows: rows.length,
      fields: count,
      status: blockedReasons.length ? 'blocked' : 'allowed',
      allowed: blockedReasons.length === 0,
      blocked: blockedReasons.length > 0,
      blockReason: blockedReasons.join('; '),
      shipsFromParam,
      colorParam,
    };
  }

  function downloadBlob(blob, fileName) {
    const a = document.createElement('a');
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function downloadJson(value, fileName) {
    downloadBlob(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json;charset=utf-8' }), fileName);
  }

  function compactDateForFile(date) {
    const pad = (value) => String(value).padStart(2, '0');
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  }

  function getRunId() {
    if (state.report && state.report.runId) return state.report.runId;
    const runId = `${compactDateForFile(new Date())}-${state.productId || (state.payload && state.payload.id) || 'unknown'}`;
    if (state.report) state.report.runId = runId;
    return runId;
  }

  function getPrimaryAsinFromPayload(payload) {
    if (!payload) return '';
    const rows = parseMaybeJson(payload.variationListStr, []);
    const firstSku = Array.isArray(rows) && rows[0] ? rows[0] : {};
    return firstNonEmpty(firstSku.skuCode, extractAsin(`${payload.sourceUrl || ''} ${payload.subject || ''}`));
  }

  function isSaveResponseSuccess(response) {
    return response && (response.code === 0 || String(response.code) === '0');
  }

  function buildFinalReport() {
    const payload = state.payload || {};
    const dryRunPass = Boolean(state.report && state.report.pass);
    const op1Response = state.report && state.report.completionSaveResult && state.report.completionSaveResult.response;
    const op2Response = state.report && state.report.submitResult && state.report.submitResult.response;
    const persisted = Boolean(state.report && state.report.persistenceCheck && state.report.persistenceCheck.persisted);
    const op2Success = isSaveResponseSuccess(op2Response);
    const failureReason = !dryRunPass
      ? 'dry-run \u672a\u901a\u8fc7'
      : op1Response && !isSaveResponseSuccess(op1Response)
      ? 'op=1 save.json \u8fd4\u56de\u5931\u8d25'
      : state.report && state.report.persistenceCheck && !persisted
      ? 'op=1 \u540e edit.json \u843d\u5e93\u6821\u9a8c\u672a\u901a\u8fc7'
      : op2Response && !op2Success
      ? 'op=2 save.json \u8fd4\u56de\u5931\u8d25'
      : '';
    return {
      runId: getRunId(),
      category:
        state.report &&
        state.report.categoryState &&
        state.report.categoryState.resolver &&
        state.report.categoryState.resolver.status === 'resolved' &&
        state.report.categoryState.resolver.ruleId
          ? state.report.categoryState.resolver.ruleId
          : state.report && state.report.categoryState && state.report.categoryState.resolver
          ? `category-resolver-${state.report.categoryState.resolver.status || 'unknown'}`
          : 'category-resolver',
      productId: String(firstNonEmpty(payload.id, state.productId)),
      asin: getPrimaryAsinFromPayload(payload),
      stage: 'single-product',
      pluginVersion: VERSION,
      taskConfig: {
        stock: getDefaultStock(),
        exchangeRate: getTaskExchangeRate(),
        priceMultiplier: getTaskPriceMultiplier(),
        defaultWeightKg: getDefaultWeightKg(),
      },
      valueSources: state.report && state.report.diagnostics && state.report.diagnostics.derived
        ? state.report.diagnostics.derived.valueSources
        : null,
      dryRun: {
        pass: dryRunPass,
        riskCount: state.report && state.report.risks ? state.report.risks.length : null,
        warningCount: state.report && state.report.warnings ? state.report.warnings.length : null,
      },
      op1: {
        called: Boolean(op1Response),
        success: isSaveResponseSuccess(op1Response),
        persisted,
      },
      op2: {
        called: Boolean(op2Response),
        success: op2Success,
        responseCode: op2Response ? op2Response.code : null,
      },
      result: op2Success ? 'success' : failureReason ? 'failed' : 'pending',
      failureReason,
    };
  }

  function buildRunBundleFiles() {
    const payloadText = state.payload ? JSON.stringify(state.payload) : '';
    const prettyPayloadText = state.payload ? JSON.stringify(state.payload, null, 2) : '';
    const dryRunReport = state.report ? { ...state.report } : {};
    delete dryRunReport.completionSaveResult;
    delete dryRunReport.submitResult;
    delete dryRunReport.persistenceCheck;
    const files = [
      { fileName: 'final-report.json', text: JSON.stringify(buildFinalReport(), null, 2) },
      { fileName: 'dry-run-report.json', text: JSON.stringify(dryRunReport, null, 2) },
      { fileName: 'choiceSave.txt', text: payloadText },
      { fileName: 'choiceSave.pretty.json', text: prettyPayloadText },
    ];
    if (state.inputEditData) files.push({ fileName: 'input-edit.json', text: JSON.stringify(state.inputEditData, null, 2) });
    if (state.report && state.report.completionSaveResult) {
      files.push({ fileName: 'op1-save-response.json', text: JSON.stringify(state.report.completionSaveResult.response, null, 2) });
    }
    if (state.afterOp1EditData) files.push({ fileName: 'after-op1-edit.json', text: JSON.stringify(state.afterOp1EditData, null, 2) });
    if (state.savePayloadLearning) files.push({ fileName: 'save-payload-learning.json', text: JSON.stringify(state.savePayloadLearning, null, 2) });
    if (state.report && state.report.persistenceCheck) {
      files.push({ fileName: 'op1-persistence-report.json', text: JSON.stringify(state.report.persistenceCheck, null, 2) });
    }
    if (state.report && state.report.submitResult) {
      files.push({ fileName: 'op2-save-response.json', text: JSON.stringify(state.report.submitResult.response, null, 2) });
    }
    return files;
  }

  function downloadRunBundle() {
    if (!state.report) throw new Error('\u8fd8\u6ca1\u6709\u6267\u884c\u62a5\u544a\uff0c\u8bf7\u5148\u6784\u9020 dry-run');
    const runId = getRunId();
    const files = buildRunBundleFiles().map((file) => ({
      ...file,
      fileName: `${runId}/${file.fileName}`,
    }));
    downloadBlob(makeStoredZipFiles(files), `${runId}.zip`);
    log(`\u5df2\u5bfc\u51fa run \u62a5\u544a\u5305\uff1a${runId}.zip`);
  }

  async function submitOne() {
    throw new Error('本阶段禁止 op=2；请先完成 op=1 落库验证并等待人工授权');
  }

  function isVisibleElement(el) {
    if (!el || !el.getBoundingClientRect) return false;
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
  }

  function getElementText(el) {
    return String((el && (el.innerText || el.textContent || el.value)) || '').replace(/\s+/g, ' ').trim();
  }

  function findPublishTestRow() {
    const tokens = [CURRENT_PUBLISH_TEST.asin, CURRENT_PUBLISH_TEST.productId, CURRENT_PUBLISH_TEST.titleToken].filter(Boolean);
    const directRows = Array.from(document.querySelectorAll('tr, .el-table__row, [class*="table-row"], [class*="list-row"]'));
    const row = directRows.find((el) => {
      const text = getElementText(el);
      return tokens.some((token) => text.includes(token)) && text.includes('发布');
    });
    if (row) return row;

    const all = Array.from(document.querySelectorAll('a, span, div, td'));
    const marker = all.find((el) => {
      const text = getElementText(el);
      return tokens.some((token) => text.includes(token));
    });
    if (!marker) return null;
    return marker.closest('tr, .el-table__row, [class*="table-row"], [class*="list-row"]') || marker.parentElement;
  }

  function findPublishActionInRow(row) {
    if (!row) return null;
    const candidates = Array.from(row.querySelectorAll('a, button, [role="button"], span, div')).filter(isVisibleElement);
    return candidates.find((el) => getElementText(el) === '发布')
      || candidates.find((el) => /^发布$/.test(getElementText(el)))
      || candidates.find((el) => getElementText(el).includes('发布') && !getElementText(el).includes('发布失败'));
  }

  function findActiveDialog() {
    const candidates = Array.from(document.querySelectorAll(
      '.layui-layer, .layui-layer-dialog, .modal, .el-message-box, .ant-modal, .ui-dialog, [role="dialog"], .bootbox'
    )).filter(isVisibleElement);
    return candidates[candidates.length - 1] || null;
  }

  function clickDialogConfirmIfPublishRelated() {
    const dialog = findActiveDialog();
    if (!dialog) return { clicked: false, reason: 'no-dialog' };
    const text = getElementText(dialog);
    if (!/发布|提交|确认|产品/.test(text)) return { clicked: false, reason: 'dialog-not-publish-related', text: text.slice(0, 300) };
    const buttons = Array.from(dialog.querySelectorAll('a, button, [role="button"], span')).filter(isVisibleElement);
    const confirm = buttons.find((el) => /^(确定|确认|发布|提交)$/.test(getElementText(el)))
      || buttons.find((el) => /确定|确认/.test(getElementText(el)));
    if (!confirm) return { clicked: false, reason: 'confirm-not-found', text: text.slice(0, 300) };
    confirm.click();
    return { clicked: true, text: text.slice(0, 300), button: getElementText(confirm) };
  }

  function collectPublishSignals() {
    const apiRecords = state.apiRecords
      .filter((record) => /publish|online|offline|smtlocalProduct|save\.json/i.test(record.url || ''))
      .slice(-20);
    const bodyText = document.body ? getElementText(document.body) : '';
    const row = findPublishTestRow();
    const successText = (bodyText.match(/[^。！？\n]{0,30}(成功|提交成功|发布中|已提交)[^。！？\n]{0,50}/) || [''])[0];
    const errorText = (bodyText.match(/[^。！？\n]{0,30}(失败|错误|异常|不能为空|请选择|超时)[^。！？\n]{0,80}/) || [''])[0];
    return {
      checkedAt: nowIso(),
      rowStillInWaitPublish: Boolean(row),
      successText,
      errorText,
      apiRecords,
      currentUrl: location.href,
    };
  }

  async function publishCurrentTestProduct() {
    if (!/\/web\/smtlocalProduct\/offline/i.test(location.pathname)) {
      throw new Error('请在店小秘待发布产品列表页执行发布验证');
    }
    const allow = $(`#${PANEL_ID} [data-field="allowSubmit"]`);
    const code = $(`#${PANEL_ID} [data-field="submitCode"]`);
    if (!allow || !allow.checked || !code || code.value.trim() !== 'SUBMIT-ONE') {
      throw new Error('发布前必须勾选只提交 1 个测试产品，并输入 SUBMIT-ONE');
    }

    const row = findPublishTestRow();
    if (!row) throw new Error(`未找到当前测试商品行：${CURRENT_PUBLISH_TEST.asin}`);
    const action = findPublishActionInRow(row);
    if (!action) throw new Error('已找到测试商品行，但未找到该行的“发布”按钮');

    state.submitting = true;
    state.publishResult = {
      status: '已点击发布按钮',
      target: CURRENT_PUBLISH_TEST,
      clickedAt: nowIso(),
      rowText: getElementText(row).slice(0, 1000),
      actionText: getElementText(action),
    };
    updateUi();
    log(`准备发布当前测试商品：${CURRENT_PUBLISH_TEST.asin}`);
    action.click();

    window.setTimeout(() => {
      const dialogResult = clickDialogConfirmIfPublishRelated();
      state.publishResult.dialogResult = dialogResult;
      if (dialogResult.clicked) log(`已确认发布弹窗：${dialogResult.button}`);
      updateUi();
    }, 800);

    window.setTimeout(() => {
      const signals = collectPublishSignals();
      state.publishResult = {
        ...state.publishResult,
        ...signals,
        status: signals.errorText
          ? '发布后出现错误提示'
          : signals.rowStillInWaitPublish
            ? '已提交发布，待人工核对状态'
            : '测试商品已离开待发布列表',
      };
      state.submitting = false;
      updateUi();
      log(`发布验证状态：${state.publishResult.status}`, state.publishResult);
    }, 6000);
  }

  function createPanel() {
    if (document.getElementById(PANEL_ID)) return;
    if (!document.body || !document.documentElement) return;
    document.documentElement.setAttribute('data-dxm-automation-version', VERSION);
    const style = document.createElement('style');
    style.textContent = `
      #${PANEL_ID} {
        position: fixed;
        right: 10px;
        bottom: 74px;
        z-index: 2147483647;
        width: 260px;
        min-width: 170px;
        max-width: 520px;
        min-height: 36px;
        max-height: 56vh;
        resize: both;
        overflow: auto;
        background: #fff;
        border: 1px solid #475569;
        border-radius: 7px;
        box-shadow: 0 10px 26px rgba(15, 23, 42, .18);
        color: #111827;
        font: 11px/1.35 Arial, "Microsoft YaHei", sans-serif;
      }
      #${PANEL_ID} * { box-sizing: border-box; }
      #${PANEL_ID} .dxm-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 6px 8px;
        border-bottom: 1px solid #e5e7eb;
        cursor: move;
        user-select: none;
      }
      #${PANEL_ID} .dxm-body {
        padding: 7px;
        overflow: auto;
      }
      #${PANEL_ID} .dxm-row {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 6px;
      }
      #${PANEL_ID} input[type="text"] {
        width: 100%;
        min-height: 24px;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        padding: 3px 5px;
      }
      #${PANEL_ID} button {
        min-height: 24px;
        border: 1px solid #cbd5e1;
        border-radius: 5px;
        background: #f8fafc;
        color: #111827;
        cursor: pointer;
        font: inherit;
      }
      #${PANEL_ID} button:hover { background: #eef2ff; }
      #${PANEL_ID} button:disabled {
        cursor: not-allowed;
        opacity: .45;
      }
      #${PANEL_ID} .dxm-actions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 5px;
        margin-top: 7px;
      }
      #${PANEL_ID} .dxm-mini-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 6px;
        margin-top: 6px;
      }
      #${PANEL_ID} .dxm-danger {
        color: #991b1b;
        border-color: #fecaca;
        background: #fff1f2;
      }
      #${PANEL_ID} .dxm-log {
        height: 48px;
        min-height: 40px;
        max-height: 160px;
        resize: vertical;
        overflow: auto;
        margin-top: 8px;
        padding: 6px;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        background: #f8fafc;
      }
      #${PANEL_ID} label {
        display: flex;
        gap: 6px;
        align-items: center;
        margin-top: 8px;
      }
      #${PANEL_ID}.dxm-collapsed {
        width: 172px;
        resize: none;
        overflow: hidden;
      }
      #${PANEL_ID}.dxm-collapsed .dxm-body {
        display: none;
      }
      #${PANEL_ID} .dxm-header-actions {
        display: flex;
        gap: 6px;
        align-items: center;
      }
      #${PANEL_ID} .dxm-icon-btn {
        width: 24px;
        min-height: 22px;
        padding: 0;
      }
    `;
    document.documentElement.appendChild(style);

    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    const collapsedValue = localStorage.getItem(COLLAPSED_KEY);
    const defaultCollapsed = /\/web\/productCrawl\/dataAcquisition/i.test(location.pathname);
    if (collapsedValue === '1' || (collapsedValue == null && defaultCollapsed)) {
      panel.classList.add('dxm-collapsed');
    }
    panel.innerHTML = `
      <div class="dxm-header">
        <strong>${APP_NAME} V${VERSION}</strong>
        <div class="dxm-header-actions">
          <span>\u7edf\u4e00\u5de5\u4f5c\u6d41</span>
          <button type="button" class="dxm-icon-btn" data-action="collapse" title="\u6536\u8d77/\u5c55\u5f00">-</button>
        </div>
      </div>
      <div class="dxm-body">
        <div class="dxm-row"><span>\u4ea7\u54c1ID</span><strong data-field="productId">\u672a\u8bfb\u53d6</strong></div>
        <div class="dxm-row"><span>dry-run</span><strong data-field="dryRun">\u672a\u6267\u884c</strong></div>
        <div class="dxm-row"><span>op=1\u843d\u5e93</span><strong data-field="op1Persistence">\u672a\u9a8c\u8bc1</strong></div>
        <div class="dxm-row"><span>\u53d1\u5e03</span><strong data-field="publishStatus">\u672a\u6267\u884c</strong></div>
        <div class="dxm-row"><span>\u98ce\u9669\u6570</span><strong data-field="riskCount">0</strong></div>
        <input type="text" data-field="manualProductId" placeholder="\u53ef\u9009\uff1a\u624b\u52a8\u586b\u5199\u4ea7\u54c1 ID">
        <input type="text" data-field="amazonAsin" placeholder="\u53ef\u9009\uff1aAmazon ASIN/URL\uff1b\u4e0d\u586b\u5219\u53d6\u91c7\u96c6\u6279\u6b21\u7b2c1\u4e2a\u53ef\u7528\u5546\u54c1" value="${getAmazonSourceAsin()}">
        <input type="text" data-field="defaultShopId" placeholder="\u9ed8\u8ba4\u5e97\u94fa shopId" value="${getDefaultShopId()}">
        <input type="text" data-field="defaultPostageId" placeholder="\u9ed8\u8ba4\u7269\u6d41\u6a21\u677f postageId" value="${getDefaultPostageId()}">
        <input type="text" data-field="taskExchangeRate" placeholder="\u4efb\u52a1\u6c47\u7387\uff0c\u4f8b\u5982 7" value="${getTaskExchangeRate()}">
        <input type="text" data-field="taskPriceMultiplier" placeholder="\u4efb\u52a1\u500d\u7387\uff0c\u4f8b\u5982 5-20 \u586b 1.55" value="${getTaskPriceMultiplier()}">
        <input type="text" data-field="defaultSourcePrice" placeholder="\u4e9a\u9a6c\u900a\u539f\u4ef7 USD\uff1b\u4f9b\u8d27\u4ef7\u6309\u516c\u5f0f\u81ea\u52a8\u7b97" value="${getDefaultSourcePrice()}">
        <input type="text" data-field="defaultSupplyPrice" placeholder="\u53ef\u9009\uff1a\u624b\u52a8\u8986\u76d6\u4f9b\u8d27\u4ef7 CNY" value="${getDefaultSupplyPrice()}">
        <input type="text" data-field="defaultWeight" placeholder="\u9ed8\u8ba4\u91cd\u91cf kg" value="${getDefaultWeightKg()}">
        <div class="dxm-mini-grid">
          <input type="text" data-field="defaultLengthIn" placeholder="\u957f inch" value="${getDefaultLengthIn()}">
          <input type="text" data-field="defaultWidthIn" placeholder="\u5bbd inch" value="${getDefaultWidthIn()}">
          <input type="text" data-field="defaultHeightIn" placeholder="\u9ad8 inch" value="${getDefaultHeightIn()}">
          <input type="text" data-field="defaultStock" placeholder="\u4efb\u52a1\u5e93\u5b58" value="${getDefaultStock()}">
        </div>
        <div class="dxm-mini-grid">
          <input type="text" data-field="defaultLength" placeholder="\u957f cm" value="${getDefaultLength()}">
          <input type="text" data-field="defaultWidth" placeholder="\u5bbd cm" value="${getDefaultWidth()}">
          <input type="text" data-field="defaultHeight" placeholder="\u9ad8 cm" value="${getDefaultHeight()}">
        </div>
        <div class="dxm-actions">
          <button type="button" data-action="loadFirst">\u8bfb\u53d6\u5f53\u524d\u7b2c1\u6761</button>
          <button type="button" data-action="loadEdit">\u8bfb\u53d6 edit.json</button>
          <button type="button" data-action="dryRun">\u6784\u9020 dry-run</button>
          <button type="button" data-action="downloadZip" disabled>\u4e0b\u8f7d zip</button>
          <button type="button" data-action="downloadReport" disabled>\u4e0b\u8f7d\u62a5\u544a</button>
          <button type="button" data-action="downloadRunBundle" disabled>\u4e0b\u8f7drun\u62a5\u544a\u5305</button>
          <button type="button" data-action="learnSavePayload">\u5b66\u4e60\u771f\u5b9e\u4fdd\u5b58payload</button>
          <button type="button" data-action="saveCompletion" disabled>save.json op=1\u843d\u5e93</button>
          <button type="button" data-action="applyVisibleEditRules">\u5e94\u7528\u7f16\u8f91\u9875\u89c4\u5219</button>
          <button type="button" data-action="preflightSaveEdit">\u9884\u68c0\u5e76\u4fdd\u5b58</button>
          <button type="button" data-action="fillVisibleVariation">\u8bca\u65ad\u8865\u5f53\u524d\u9875\u53d8\u79cd</button>
        </div>
        <label><input type="checkbox" data-field="allowSubmit"> \u6211\u786e\u8ba4\u53ea\u63d0\u4ea4 1 \u4e2a\u6d4b\u8bd5\u4ea7\u54c1</label>
        <input type="text" data-field="submitCode" placeholder="\u771f\u5b9e\u63d0\u4ea4\u524d\u8f93\u5165 SUBMIT-ONE">
        <div class="dxm-actions">
          <button type="button" class="dxm-danger" data-action="submit" disabled>\u771f\u5b9e\u63d0\u4ea4 1 \u4e2a</button>
          <button type="button" class="dxm-danger" data-action="publishCurrentTest">\u53d1\u5e03\u5f53\u524d\u6d4b\u8bd5\u5546\u54c1</button>
        </div>
        <div class="dxm-log" data-field="log"></div>
      </div>
    `;
    document.documentElement.appendChild(panel);
    restorePosition(panel);
    makeDraggable(panel);

    panel.addEventListener('input', updateUi);
    panel.addEventListener('change', () => {
      const amazonAsin = panel.querySelector('[data-field="amazonAsin"]');
      const shopId = panel.querySelector('[data-field="defaultShopId"]');
      const postage = panel.querySelector('[data-field="defaultPostageId"]');
      const weight = panel.querySelector('[data-field="defaultWeight"]');
      const sourcePrice = panel.querySelector('[data-field="defaultSourcePrice"]');
      const supplyPrice = panel.querySelector('[data-field="defaultSupplyPrice"]');
      const stock = panel.querySelector('[data-field="defaultStock"]');
      const taskExchangeRate = panel.querySelector('[data-field="taskExchangeRate"]');
      const taskPriceMultiplier = panel.querySelector('[data-field="taskPriceMultiplier"]');
      const lengthIn = panel.querySelector('[data-field="defaultLengthIn"]');
      const widthIn = panel.querySelector('[data-field="defaultWidthIn"]');
      const heightIn = panel.querySelector('[data-field="defaultHeightIn"]');
      const length = panel.querySelector('[data-field="defaultLength"]');
      const width = panel.querySelector('[data-field="defaultWidth"]');
      const height = panel.querySelector('[data-field="defaultHeight"]');
      if (amazonAsin) localStorage.setItem(AMAZON_SOURCE_ASIN_KEY, amazonAsin.value.trim());
      if (shopId) localStorage.setItem(DEFAULT_SHOP_ID_KEY, shopId.value.trim());
      if (postage) localStorage.setItem(DEFAULT_POSTAGE_ID_KEY, postage.value.trim());
      if (weight) localStorage.setItem(DEFAULT_WEIGHT_KEY, weight.value.trim());
      if (sourcePrice) localStorage.setItem(DEFAULT_SOURCE_PRICE_KEY, sourcePrice.value.trim());
      if (supplyPrice) localStorage.setItem(DEFAULT_SUPPLY_PRICE_KEY, supplyPrice.value.trim());
      if (stock) localStorage.setItem(DEFAULT_STOCK_KEY, stock.value.trim());
      if (taskExchangeRate) localStorage.setItem(TASK_EXCHANGE_RATE_KEY, taskExchangeRate.value.trim());
      if (taskPriceMultiplier) localStorage.setItem(TASK_PRICE_MULTIPLIER_KEY, taskPriceMultiplier.value.trim());
      if (lengthIn) localStorage.setItem(DEFAULT_LENGTH_IN_KEY, lengthIn.value.trim());
      if (widthIn) localStorage.setItem(DEFAULT_WIDTH_IN_KEY, widthIn.value.trim());
      if (heightIn) localStorage.setItem(DEFAULT_HEIGHT_IN_KEY, heightIn.value.trim());
      if (length) localStorage.setItem(DEFAULT_LENGTH_KEY, length.value.trim());
      if (width) localStorage.setItem(DEFAULT_WIDTH_KEY, width.value.trim());
      if (height) localStorage.setItem(DEFAULT_HEIGHT_KEY, height.value.trim());
      updateUi();
    });
    panel.addEventListener('click', async (event) => {
      const action = event.target && event.target.getAttribute('data-action');
      if (!action) return;
      try {
        if (action === 'loadFirst') await loadFirstDraftProduct();
        if (action === 'loadEdit') await loadEditJson();
        if (action === 'dryRun') await runDryRun();
        if (action === 'downloadZip' && state.zipBlob) downloadBlob(state.zipBlob, `choiceSave-${state.productId}.zip`);
        if (action === 'downloadReport' && state.report) downloadJson(state.report, `single-submit-report-${state.productId}.json`);
        if (action === 'downloadRunBundle') downloadRunBundle();
        if (action === 'learnSavePayload') await learnLatestCapturedSavePayload();
        if (action === 'saveCompletion') await saveCompletionOnly();
        if (action === 'applyVisibleEditRules') await applyVisibleEditPageRules({ manual: true });
        if (action === 'preflightSaveEdit') await saveEditPageWithPreflight();
        if (action === 'fillVisibleVariation') fillVisibleVariationFields();
        if (action === 'submit') await submitOne();
        if (action === 'publishCurrentTest') await publishCurrentTestProduct();
        if (action === 'collapse') {
          panel.classList.toggle('dxm-collapsed');
          localStorage.setItem(COLLAPSED_KEY, panel.classList.contains('dxm-collapsed') ? '1' : '0');
        }
      } catch (error) {
        log(`\u9519\u8bef\uff1a${error.message}`);
        console.error(`[${APP_NAME}]`, error);
      }
    });

    updateUi();
    log('\u6d4b\u8bd5\u5668\u5df2\u52a0\u8f7d\u3002\u9ed8\u8ba4\u4e0d\u4f1a\u771f\u5b9e\u63d0\u4ea4\u3002');
    scheduleVisibleEditRulesAutoApply();
  }

  function restorePosition(panel) {
    try {
      const saved = JSON.parse(localStorage.getItem(POS_KEY) || 'null');
      if (!saved) return;
      const maxLeft = Math.max(0, window.innerWidth - Math.max(panel.offsetWidth, 170));
      const maxTop = Math.max(0, window.innerHeight - Math.max(panel.offsetHeight, 36));
      const left = Math.min(Math.max(0, Number(saved.left) || 0), maxLeft);
      const top = Math.min(Math.max(0, Number(saved.top) || 0), maxTop);
      panel.style.left = `${left}px`;
      panel.style.top = `${top}px`;
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
      if (left !== saved.left || top !== saved.top) {
        localStorage.setItem(POS_KEY, JSON.stringify({ left: Math.round(left), top: Math.round(top) }));
      }
    } catch (_) {
      // Ignore bad saved position.
    }
  }

  function makeDraggable(panel) {
    const header = panel.querySelector('.dxm-header');
    if (!header) return;
    let dragging = false;
    let offsetX = 0;
    let offsetY = 0;

    header.addEventListener('mousedown', (event) => {
      if (event.target && event.target.closest('button')) return;
      dragging = true;
      const rect = panel.getBoundingClientRect();
      offsetX = event.clientX - rect.left;
      offsetY = event.clientY - rect.top;
      panel.style.left = `${rect.left}px`;
      panel.style.top = `${rect.top}px`;
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
      event.preventDefault();
    });

    document.addEventListener('mousemove', (event) => {
      if (!dragging) return;
      const maxLeft = window.innerWidth - panel.offsetWidth;
      const maxTop = window.innerHeight - panel.offsetHeight;
      const left = Math.min(Math.max(0, event.clientX - offsetX), Math.max(0, maxLeft));
      const top = Math.min(Math.max(0, event.clientY - offsetY), Math.max(0, maxTop));
      panel.style.left = `${left}px`;
      panel.style.top = `${top}px`;
    });

    document.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      localStorage.setItem(
        POS_KEY,
        JSON.stringify({
          left: Math.round(panel.getBoundingClientRect().left),
          top: Math.round(panel.getBoundingClientRect().top),
        })
      );
    });
  }

  function startPanel() {
    startVisibleEditRulesWatcher();
    try {
      createPanel();
    } catch (error) {
      console.error(`[${APP_NAME}] createPanel failed`, error);
    }
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      if (!document.getElementById(PANEL_ID)) {
        try {
          createPanel();
        } catch (error) {
          console.error(`[${APP_NAME}] createPanel retry failed`, error);
        }
      }
      if (document.getElementById(PANEL_ID) || attempts >= 30) window.clearInterval(timer);
    }, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startPanel, { once: true });
  } else {
    startPanel();
  }
})();

