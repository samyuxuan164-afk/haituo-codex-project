// ==UserScript==
// @name         店小秘自动化系统 V1 - 单品提交测试器
// @namespace    https://codex.local/dianxiaomi-automation-v1
// @version      0.2.5
// @description  从采集箱读取 1 个测试产品，构造 choiceSave.zip，默认 dry-run；只有手动二次确认后才调用 save.json。
// @author       Codex
// @match        https://*.dianxiaomi.com/*
// @match        http://*.dianxiaomi.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const APP_NAME = '店小秘单品提交测试器';
  const VERSION = '0.2.5';
  const PANEL_ID = 'dxm-single-submit-tester-panel';
  const POS_KEY = 'dxm-single-submit-tester-position';
  const DEFAULT_POSTAGE_ID_KEY = 'dxm-single-submit-default-postage-id';
  const DEFAULT_WEIGHT_KEY = 'dxm-single-submit-default-weight';
  const DEFAULT_SUPPLY_PRICE_KEY = 'dxm-single-submit-default-supply-price';
  const DEFAULT_SOURCE_PRICE_KEY = 'dxm-single-submit-default-source-price';
  const DEFAULT_STOCK_KEY = 'dxm-single-submit-default-stock';
  const DEFAULT_LENGTH_IN_KEY = 'dxm-single-submit-default-length-in';
  const DEFAULT_WIDTH_IN_KEY = 'dxm-single-submit-default-width-in';
  const DEFAULT_HEIGHT_IN_KEY = 'dxm-single-submit-default-height-in';
  const DEFAULT_LENGTH_KEY = 'dxm-single-submit-default-length';
  const DEFAULT_WIDTH_KEY = 'dxm-single-submit-default-width';
  const DEFAULT_HEIGHT_KEY = 'dxm-single-submit-default-height';
  function getDefaultPostageId() {
    return getPanelInputValue('defaultPostageId', localStorage.getItem(DEFAULT_POSTAGE_ID_KEY) || '50169732817');
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
        attr_value: '天然未处理(None)',
      },
      {
        attr_name_id: '219',
        attr_name: 'Origin',
        attr_value_id: '9442295690',
        attr_value: '美国(Origin)(US(Origin))',
        attr_value_unit: null,
        attr_value_start: null,
        attr_value_end: null,
      },
    ],
  };

  function getDefaultPropertiesForProduct(payload, product) {
    if (DEFAULT_PROPERTY_LIST_BY_CATEGORY[payload.categoryId]) {
      return {
        publishCategoryId: payload.categoryId,
        properties: DEFAULT_PROPERTY_LIST_BY_CATEGORY[payload.categoryId],
      };
    }
    const categoryText = `${payload.categoryId || ''} ${payload.fullCid || ''} ${product.categoryName || ''} ${product.categoryNameZh || ''} ${payload.subject || ''}`;
    if (/5050263-|bumpers?|rubber\s*bumpers?|cabinet\s*bumpers?|table\s*top\s*bumpers?|bumper\s*pads?|柜门消音垫/i.test(categoryText)) {
      return {
        publishCategoryId: '200291142',
        properties: DEFAULT_PROPERTY_LIST_BY_CATEGORY['200291142'],
      };
    }
    return { publishCategoryId: '', properties: null };
  }

  const state = {
    productId: '',
    editData: null,
    payload: null,
    zipBlob: null,
    report: null,
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
    setText('productId', state.productId || '未读取');
    setText('dryRun', state.report ? (state.report.pass ? '通过' : '未通过') : '未执行');
    setText('riskCount', state.report ? state.report.risks.length : 0);
    const submitButton = $(`#${PANEL_ID} [data-action="submit"]`);
    const downloadButton = $(`#${PANEL_ID} [data-action="downloadZip"]`);
    const reportButton = $(`#${PANEL_ID} [data-action="downloadReport"]`);
    const allow = $(`#${PANEL_ID} [data-field="allowSubmit"]`);
    const code = $(`#${PANEL_ID} [data-field="submitCode"]`);
    const canSubmit =
      state.report &&
      state.report.pass &&
      state.zipBlob &&
      allow &&
      allow.checked &&
      code &&
      code.value.trim() === 'SUBMIT-ONE';
    if (submitButton) submitButton.disabled = !canSubmit || state.submitting;
    if (downloadButton) downloadButton.disabled = !state.zipBlob;
    if (reportButton) reportButton.disabled = !state.report;
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
    let multiplier = null;
    if (price >= 5 && price <= 20) multiplier = 1.55;
    if (price >= 21 && price <= 45) multiplier = 1.6;
    if (price >= 50 && price <= 250) multiplier = 1.1;
    if (multiplier == null) return '';
    return String(round2(price * 7 * multiplier));
  }

  function inferSourcePrice(product) {
    return firstNonEmpty(getDefaultSourcePrice(), product.minPrice, product.maxPrice, product.price, product.sourcePrice);
  }

  function getProductFromEdit(editData) {
    return (
      editData &&
      editData.data &&
      (editData.data.product || editData.data.smtLocalProduct || editData.data.localProduct || editData.data)
    );
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
      throw new Error('edit.json 未找到 product 对象');
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
    };

    const payload = {};
    for (const field of SAVE_FIELDS) {
      payload[field] = product[field] === undefined ? null : product[field];
    }

    payload.id = String(firstNonEmpty(product.id, product.productId, state.productId));
    payload.shopId = String(firstNonEmpty(product.shopId, product.shop_id));
    payload.categoryId = String(firstNonEmpty(found.categoryId.value, product.fullCid));
    payload.subject = String(firstNonEmpty(product.subject, product.title, product.productTitle));
    payload.sourceUrl = firstNonEmpty(product.sourceUrl, product.url, '');
    payload.fullCid = firstNonEmpty(product.fullCid, '');
    payload.productPropertyListJson = normalizeJsonString(found.properties.value, []);
    payload.mainImageListJson = normalizeJsonString(found.mainImages.value, []);
    payload.variationListStr = normalizeJsonString(found.variations.value, []);
    payload.optionValues = normalizeJsonString(found.optionValues.value, {});
    const optionValuesParsed = parseMaybeJson(payload.optionValues, {});
    if (!optionValuesParsed || typeof optionValuesParsed !== 'object' || Array.isArray(optionValuesParsed)) {
      payload.optionValues = JSON.stringify({ 发货地: ['United States'], Color: [], 'Number of Pcs': [], Size: [] });
    } else {
      optionValuesParsed['发货地'] = Array.isArray(optionValuesParsed['发货地']) && optionValuesParsed['发货地'].length
        ? optionValuesParsed['发货地']
        : ['United States'];
      if (!Array.isArray(optionValuesParsed.Color)) optionValuesParsed.Color = [];
      if (!Array.isArray(optionValuesParsed['Number of Pcs'])) optionValuesParsed['Number of Pcs'] = [];
      if (!Array.isArray(optionValuesParsed.Size)) optionValuesParsed.Size = [];
      payload.optionValues = JSON.stringify(optionValuesParsed);
    }
    payload.videoListJson = product.videoListJson == null ? null : normalizeJsonString(product.videoListJson, []);
    payload.sizeChartIdListJson = product.sizeChartIdListJson == null ? '' : normalizeJsonString(product.sizeChartIdListJson, []);
    payload.aeopQualificationStructListJson = normalizeJsonString(
      firstNonEmpty(product.aeopQualificationStructListJson, product.aeopQualificationStructList),
      []
    );
    payload.imgUrl = firstNonEmpty(
      product.imgUrl,
      Array.isArray(parseMaybeJson(payload.mainImageListJson, [])) ? parseMaybeJson(payload.mainImageListJson, []).join('|') : ''
    );
    payload.marketImage2 = firstNonEmpty(product.marketImage2, parseMaybeJson(payload.mainImageListJson, [])[0], '');
    payload.marketImage1 = firstNonEmpty(product.marketImage1, payload.marketImage2, '');
    payload.productUnit = firstNonEmpty(product.productUnit, product.unit, '100000015');
    payload.packageType = firstNonEmpty(product.packageType, 0);
    payload.lotNum = firstNonEmpty(product.lotNum, 0);
    payload.supportCountrySupplyPrice = firstNonEmpty(product.supportCountrySupplyPrice, 0);
    payload.sizeChartId = firstNonEmpty(product.sizeChartId, '');
    payload.detailMobile = normalizeJsonString(found.detailMobile.value, {});
    payload.detailWeb = String(firstNonEmpty(found.detailWeb.value, ''));
    const fallbackWebText = extractTextFromDetailMobile(payload.detailMobile);
    const detailWebDerived = !payload.detailWeb && fallbackWebText;
    if (detailWebDerived) {
      payload.detailWeb = textToDetailWeb(fallbackWebText);
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
    const variationsParsed = parseMaybeJson(payload.variationListStr, []);
    const defaultWeightKg = getDefaultWeightKg();
    const defaultPostageId = getDefaultPostageId();
    const defaultSupplyPrice = getDefaultSupplyPrice();
    const defaultStock = getDefaultStock();
    const inferredSourcePrice = inferSourcePrice(product);
    const calculatedSupplyPrice = calculateSupplyPriceCny(inferredSourcePrice);
    const effectiveSupplyPrice = firstNonEmpty(defaultSupplyPrice, calculatedSupplyPrice);
    const defaultLength = firstNonEmpty(inchToCm(getDefaultLengthIn()), getDefaultLength());
    const defaultWidth = firstNonEmpty(inchToCm(getDefaultWidthIn()), getDefaultWidth());
    const defaultHeight = firstNonEmpty(inchToCm(getDefaultHeightIn()), getDefaultHeight());
    const parsedProperties = parseMaybeJson(payload.productPropertyListJson, []);
    const categoryDefault = getDefaultPropertiesForProduct(payload, product);
    if (categoryDefault.publishCategoryId && payload.categoryId !== categoryDefault.publishCategoryId) {
      payload.categoryId = categoryDefault.publishCategoryId;
      defaultRulesApplied.push(`已按 Bumpers 类规则映射发布类目 ${payload.categoryId}`);
    }
    if ((!Array.isArray(parsedProperties) || !parsedProperties.length) && categoryDefault.properties) {
      payload.categoryId = categoryDefault.publishCategoryId || payload.categoryId;
      payload.productPropertyListJson = JSON.stringify(categoryDefault.properties);
      defaultRulesApplied.push(`类目属性为空，已按类目 ${payload.categoryId} 默认属性补齐`);
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
          skuPropertyListJson: JSON.stringify([
            {
              sku_property_id: '200007763',
              sku_property_name: 'Ships From',
              property_value_id: '201336106',
              sku_property_value: 'United States',
              property_value_definition_name: '',
              sku_image: '',
            },
          ]),
          imageList: null,
          destCountrySupplyPriceListJson: '',
        },
      ]);
      defaultRulesApplied.push(`variationListStr 为空，已用 ASIN + 供货价 ${effectiveSupplyPrice} 生成 1 条 SKU`);
    } else if (Array.isArray(variationsParsed) && variationsParsed.length) {
      let changed = false;
      for (const sku of variationsParsed) {
        if (!sku.skuCode && asin) {
          sku.skuCode = asin;
          changed = true;
          defaultRulesApplied.push('SKU 编码为空，已用 ASIN 补齐');
        }
        if (!sku.packageWeight) {
          sku.packageWeight = defaultWeightKg;
          changed = true;
          defaultRulesApplied.push(`SKU 重量为空，已按默认重量 ${defaultWeightKg} kg 补齐`);
        }
        if (!sku.supplyPrice && !sku.gloGoodsValue && effectiveSupplyPrice) {
          sku.supplyPrice = Number(effectiveSupplyPrice);
          sku.gloGoodsValue = Number(effectiveSupplyPrice);
          changed = true;
          defaultRulesApplied.push(`SKU 价格为空，已按供货价 ${effectiveSupplyPrice} 补齐`);
        }
        if (sku.gloLogisticValue === undefined || sku.gloLogisticValue === null || sku.gloLogisticValue === '') {
          sku.gloLogisticValue = 0;
          changed = true;
          defaultRulesApplied.push('SKU 物流费为空，已按美国本土包邮规则补 0');
        }
        if (!sku.sellableQuantity && defaultStock) {
          sku.sellableQuantity = Number(defaultStock);
          changed = true;
          defaultRulesApplied.push(`SKU 库存为空，已按默认库存 ${defaultStock} 补齐`);
        }
        if (!sku.packageLength) {
          sku.packageLength = defaultLength;
          changed = true;
          defaultRulesApplied.push(`SKU 长度为空，已按默认 ${defaultLength} cm 补齐`);
        }
        if (!sku.packageWidth) {
          sku.packageWidth = defaultWidth;
          changed = true;
          defaultRulesApplied.push(`SKU 宽度为空，已按默认 ${defaultWidth} cm 补齐`);
        }
        if (!sku.packageHeight) {
          sku.packageHeight = defaultHeight;
          changed = true;
          defaultRulesApplied.push(`SKU 高度为空，已按默认 ${defaultHeight} cm 补齐`);
        }
      }
      if (changed) payload.variationListStr = JSON.stringify(variationsParsed);
    }
    if (!payload.postageId && defaultPostageId) {
      payload.postageId = defaultPostageId;
      defaultRulesApplied.push(`物流模板为空，已按默认 postageId=${defaultPostageId} 补齐`);
    }
    Object.defineProperty(payload, '__diagnostics', {
      enumerable: false,
      value: {
        topLevelKeys: editData && editData.data ? Object.keys(editData.data) : Object.keys(editData || {}),
        productKeys: Object.keys(product).slice(0, 200),
        foundPaths: Object.fromEntries(Object.entries(found).map(([key, item]) => [key, item.path || 'NOT_FOUND'])),
        derived: {
          detailWebFromDetailMobile: Boolean(detailWebDerived),
          asin,
          sourcePriceUsd: inferredSourcePrice,
          calculatedSupplyPriceCny: calculatedSupplyPrice,
          effectiveSupplyPriceCny: effectiveSupplyPrice,
          defaultRulesApplied,
        },
      },
    });

    return payload;
  }

  function validatePayload(payload) {
    const risks = [];
    const warnings = [];

    for (const field of REQUIRED_FIELDS) {
      if (payload[field] === undefined || payload[field] === null || payload[field] === '') {
        risks.push(`缺少必填字段：${field}`);
      }
    }

    const properties = parseMaybeJson(payload.productPropertyListJson, null);
    const images = parseMaybeJson(payload.mainImageListJson, null);
    const variations = parseMaybeJson(payload.variationListStr, null);
    const mobile = parseMaybeJson(payload.detailMobile, null);

    if (!Array.isArray(properties) || properties.length === 0) {
      risks.push('productPropertyListJson 不是有效数组或为空');
    }
    if (!Array.isArray(images) || images.length === 0) {
      risks.push('mainImageListJson 不是有效数组或为空');
    }
    if (!Array.isArray(variations) || variations.length === 0) {
      risks.push('variationListStr 不是有效数组或为空');
    }
    if (!mobile || typeof mobile !== 'object') {
      risks.push('detailMobile 不是有效 JSON 对象');
    }
    if (payload.__diagnostics && payload.__diagnostics.derived && payload.__diagnostics.derived.detailWebFromDetailMobile) {
      warnings.push('detailWeb 为空，已在 dry-run 中从 detailMobile 自动生成 PC 描述');
    }
    if (payload.__diagnostics && payload.__diagnostics.derived && payload.__diagnostics.derived.defaultRulesApplied) {
      for (const item of payload.__diagnostics.derived.defaultRulesApplied) {
        warnings.push(item);
      }
    }

    if (Array.isArray(variations)) {
      const firstSku = variations[0] || {};
      if (!firstSku.skuCode) warnings.push('SKU 为空，可能影响追踪');
      if (!firstSku.supplyPrice && !firstSku.gloGoodsValue) risks.push('SKU 价格为空');
      if (!firstSku.packageWeight) risks.push('SKU 重量为空');
      if (!firstSku.packageLength || !firstSku.packageWidth || !firstSku.packageHeight) {
        risks.push('SKU 尺寸不完整');
      }
      if (!firstSku.sellableQuantity) warnings.push('库存为空或为 0');
    }

    const propertyText = JSON.stringify(properties || '').toLowerCase();
    if (!propertyText.includes('brand')) warnings.push('属性里未检测到 Brand Name 字段');
    if (propertyText.includes('nike') || propertyText.includes('adidas') || propertyText.includes('disney')) {
      risks.push('属性里疑似包含品牌词，需要人工确认');
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
      throw new Error(`接口返回不是 JSON：${text.slice(0, 200)}`);
    }
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

  async function loadFirstDraftProduct() {
    const bodies = [
      new URLSearchParams({
        pageNo: '1',
        pageSize: '1',
        total: '0',
        shopId: '-1',
        searchType: '0',
        searchValue: '',
        sortName: '1',
        sortValue: '2',
        dxmState: 'draft',
        productSearchType: '1',
        fullCid: '',
        productState: '',
      }),
      new URLSearchParams({
        pageNo: '1',
        pageSize: '1',
        dxmState: 'draft',
      }),
    ];

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
          log(`已读取采集箱第 1 条产品：${state.productId}`);
          updateUi();
          return state.productId;
        }
        lastError = new Error('pageList 返回为空');
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error('未能读取采集箱列表');
  }

  async function loadEditJson() {
    const manualId = $(`#${PANEL_ID} [data-field="manualProductId"]`);
    const productId = (manualId && manualId.value.trim()) || state.productId;
    if (!productId) throw new Error('还没有产品 ID，请先读取采集箱第 1 条，或手动填写产品 ID');
    state.productId = productId;
    const json = await apiFetchJson(`/api/smtlocalProduct/edit.json?id=${encodeURIComponent(productId)}`);
    state.editData = json;
    log(`已读取 edit.json：${productId}`);
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
    const encoder = new TextEncoder();
    const nameBytes = encoder.encode(fileName);
    const dataBytes = encoder.encode(text);
    const checksum = crc32(dataBytes);
    const stamp = dosDateTime(new Date());

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

    const centralOffset = localHeader.length + dataBytes.length;
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
    writeU32(centralView, 42, 0);
    centralHeader.set(nameBytes, 46);

    const end = new Uint8Array(22);
    const endView = new DataView(end.buffer);
    writeU32(endView, 0, 0x06054b50);
    writeU16(endView, 4, 0);
    writeU16(endView, 6, 0);
    writeU16(endView, 8, 1);
    writeU16(endView, 10, 1);
    writeU32(endView, 12, centralHeader.length);
    writeU32(endView, 16, centralOffset);
    writeU16(endView, 20, 0);

    return new Blob([concatBytes([localHeader, dataBytes, centralHeader, end])], {
      type: 'application/zip',
    });
  }

  async function runDryRun() {
    if (!state.editData) await loadEditJson();
    const payload = buildPayloadFromEdit(state.editData);
    const report = validatePayload(payload);
    const text = JSON.stringify(payload);
    const zipBlob = makeStoredZip('choiceSave.txt', text);

    state.payload = payload;
    state.zipBlob = zipBlob;
    state.report = {
      ...report,
      zip: {
        fileName: 'choiceSave.zip',
        entryName: 'choiceSave.txt',
        contentBytes: new TextEncoder().encode(text).length,
        zipBytes: zipBlob.size,
        formData: { file: 'Blob(application/zip)', op: '2' },
      },
    };

    log(report.pass ? 'dry-run 通过，可以下载 zip 检查' : 'dry-run 未通过，请先处理风险字段', state.report);
    updateUi();
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

  async function submitOne() {
    if (!state.report || !state.report.pass || !state.zipBlob) {
      throw new Error('dry-run 未通过，禁止真实提交');
    }
    const confirmed = window.confirm(
      `即将真实提交 1 个产品到 save.json。\n产品ID：${state.productId}\n标题：${state.payload.subject}\n\n确认只提交这 1 个测试产品？`
    );
    if (!confirmed) return;

    state.submitting = true;
    updateUi();
    try {
      const form = new FormData();
      form.append('file', state.zipBlob, 'blob');
      form.append('op', '2');
      const json = await apiFetchJson('/api/smtlocalProduct/save.json', {
        method: 'POST',
        body: form,
      });
      state.report.submitResult = {
        submittedAt: nowIso(),
        response: json,
      };
      log(`真实提交完成：${JSON.stringify(json).slice(0, 300)}`, json);
    } finally {
      state.submitting = false;
      updateUi();
    }
  }

  function createPanel() {
    if (document.getElementById(PANEL_ID)) return;
    const style = document.createElement('style');
    style.textContent = `
      #${PANEL_ID} {
        position: fixed;
        right: 18px;
        bottom: 18px;
        z-index: 2147483647;
        width: 360px;
        min-width: 260px;
        max-width: 720px;
        min-height: 46px;
        max-height: 85vh;
        resize: both;
        overflow: auto;
        background: #fff;
        border: 1px solid #475569;
        border-radius: 8px;
        box-shadow: 0 12px 30px rgba(15, 23, 42, .22);
        color: #111827;
        font: 12px/1.45 Arial, "Microsoft YaHei", sans-serif;
      }
      #${PANEL_ID} * { box-sizing: border-box; }
      #${PANEL_ID} .dxm-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 10px;
        border-bottom: 1px solid #e5e7eb;
        cursor: move;
        user-select: none;
      }
      #${PANEL_ID} .dxm-body {
        padding: 10px;
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
        min-height: 28px;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        padding: 4px 6px;
      }
      #${PANEL_ID} button {
        min-height: 28px;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
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
        gap: 6px;
        margin-top: 8px;
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
        height: 70px;
        min-height: 40px;
        max-height: 220px;
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
        width: 260px;
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
    panel.innerHTML = `
      <div class="dxm-header">
        <strong>${APP_NAME} V${VERSION}</strong>
        <div class="dxm-header-actions">
          <span>单品安全测试</span>
          <button type="button" class="dxm-icon-btn" data-action="collapse" title="收起/展开">-</button>
        </div>
      </div>
      <div class="dxm-body">
        <div class="dxm-row"><span>产品ID</span><strong data-field="productId">未读取</strong></div>
        <div class="dxm-row"><span>dry-run</span><strong data-field="dryRun">未执行</strong></div>
        <div class="dxm-row"><span>风险数</span><strong data-field="riskCount">0</strong></div>
        <input type="text" data-field="manualProductId" placeholder="可选：手动填写产品 ID">
        <input type="text" data-field="defaultPostageId" placeholder="默认物流模板 postageId" value="${getDefaultPostageId()}">
        <input type="text" data-field="defaultSourcePrice" placeholder="亚马逊原价 USD；供货价按公式自动算" value="${getDefaultSourcePrice()}">
        <input type="text" data-field="defaultSupplyPrice" placeholder="可选：手动覆盖供货价 CNY" value="${getDefaultSupplyPrice()}">
        <input type="text" data-field="defaultWeight" placeholder="默认重量 kg" value="${getDefaultWeightKg()}">
        <div class="dxm-mini-grid">
          <input type="text" data-field="defaultLengthIn" placeholder="长 inch" value="${getDefaultLengthIn()}">
          <input type="text" data-field="defaultWidthIn" placeholder="宽 inch" value="${getDefaultWidthIn()}">
          <input type="text" data-field="defaultHeightIn" placeholder="高 inch" value="${getDefaultHeightIn()}">
          <input type="text" data-field="defaultStock" placeholder="库存" value="${getDefaultStock()}">
        </div>
        <div class="dxm-mini-grid">
          <input type="text" data-field="defaultLength" placeholder="长 cm" value="${getDefaultLength()}">
          <input type="text" data-field="defaultWidth" placeholder="宽 cm" value="${getDefaultWidth()}">
          <input type="text" data-field="defaultHeight" placeholder="高 cm" value="${getDefaultHeight()}">
        </div>
        <div class="dxm-actions">
          <button type="button" data-action="loadFirst">读取第1条草稿</button>
          <button type="button" data-action="loadEdit">读取 edit.json</button>
          <button type="button" data-action="dryRun">构造 dry-run</button>
          <button type="button" data-action="downloadZip" disabled>下载 zip</button>
          <button type="button" data-action="downloadReport" disabled>下载报告</button>
        </div>
        <label><input type="checkbox" data-field="allowSubmit"> 我确认只提交 1 个测试产品</label>
        <input type="text" data-field="submitCode" placeholder="真实提交前输入 SUBMIT-ONE">
        <div class="dxm-actions">
          <button type="button" class="dxm-danger" data-action="submit" disabled>真实提交 1 个</button>
        </div>
        <div class="dxm-log" data-field="log"></div>
      </div>
    `;
    document.documentElement.appendChild(panel);
    restorePosition(panel);
    makeDraggable(panel);

    panel.addEventListener('input', updateUi);
    panel.addEventListener('change', () => {
      const postage = panel.querySelector('[data-field="defaultPostageId"]');
      const weight = panel.querySelector('[data-field="defaultWeight"]');
      const sourcePrice = panel.querySelector('[data-field="defaultSourcePrice"]');
      const supplyPrice = panel.querySelector('[data-field="defaultSupplyPrice"]');
      const stock = panel.querySelector('[data-field="defaultStock"]');
      const lengthIn = panel.querySelector('[data-field="defaultLengthIn"]');
      const widthIn = panel.querySelector('[data-field="defaultWidthIn"]');
      const heightIn = panel.querySelector('[data-field="defaultHeightIn"]');
      const length = panel.querySelector('[data-field="defaultLength"]');
      const width = panel.querySelector('[data-field="defaultWidth"]');
      const height = panel.querySelector('[data-field="defaultHeight"]');
      if (postage) localStorage.setItem(DEFAULT_POSTAGE_ID_KEY, postage.value.trim());
      if (weight) localStorage.setItem(DEFAULT_WEIGHT_KEY, weight.value.trim());
      if (sourcePrice) localStorage.setItem(DEFAULT_SOURCE_PRICE_KEY, sourcePrice.value.trim());
      if (supplyPrice) localStorage.setItem(DEFAULT_SUPPLY_PRICE_KEY, supplyPrice.value.trim());
      if (stock) localStorage.setItem(DEFAULT_STOCK_KEY, stock.value.trim());
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
        if (action === 'submit') await submitOne();
        if (action === 'collapse') panel.classList.toggle('dxm-collapsed');
      } catch (error) {
        log(`错误：${error.message}`);
        console.error(`[${APP_NAME}]`, error);
      }
    });

    updateUi();
    log('测试器已加载。默认不会真实提交。');
  }

  function restorePosition(panel) {
    try {
      const saved = JSON.parse(localStorage.getItem(POS_KEY) || 'null');
      if (!saved) return;
      panel.style.left = `${saved.left}px`;
      panel.style.top = `${saved.top}px`;
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
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

  if (document.body) createPanel();
  else window.addEventListener('DOMContentLoaded', createPanel, { once: true });
})();
