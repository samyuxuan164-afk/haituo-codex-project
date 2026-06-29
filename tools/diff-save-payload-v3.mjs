import fs from 'node:fs';

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

function parseMaybeJson(value, fallback) {
  if (value == null || value === '') return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function pickPayloadFromV3(json) {
  const records = Array.isArray(json.records) ? json.records : [];
  const candidates = records
    .map((record) => record?.request?.body?.choiceSaveJson)
    .filter(Boolean);
  return candidates[candidates.length - 1] || null;
}

function pickPayloadFromReport(json) {
  return json.payload || json.choiceSaveJson || json.request?.body?.choiceSaveJson || null;
}

function summarize(payload) {
  const variations = parseMaybeJson(payload?.variationListStr, []);
  return {
    top: {
      id: payload?.id,
      op: payload?.op,
      categoryId: payload?.categoryId,
      postageId: payload?.postageId,
      optionValues: payload?.optionValues,
      optionValueIds: payload?.optionValueIds,
      shipFrom: payload?.shipFrom,
      supportCountrySupplyPrice: payload?.supportCountrySupplyPrice,
    },
    variationCount: Array.isArray(variations) ? variations.length : 0,
    firstVariationKeys: Array.isArray(variations) && variations[0] ? Object.keys(variations[0]).sort() : [],
    firstVariation: Array.isArray(variations) && variations[0] ? variations[0] : null,
  };
}

function diffKeys(a, b) {
  return {
    onlyInA: a.filter((key) => !b.includes(key)),
    onlyInB: b.filter((key) => !a.includes(key)),
  };
}

const [manualPath, autoPath] = process.argv.slice(2);
if (!manualPath || !autoPath) {
  console.error('Usage: node diff-save-payload-v3.mjs <manual-v3-json> <auto-report-or-payload-json>');
  process.exit(2);
}

const manualPayload = pickPayloadFromV3(readJson(manualPath));
const autoJson = readJson(autoPath);
const autoPayload = pickPayloadFromReport(autoJson);

if (!manualPayload) throw new Error('manual V3 JSON 中未找到 choiceSaveJson');
if (!autoPayload) throw new Error('auto JSON 中未找到 payload/choiceSaveJson');

const manual = summarize(manualPayload);
const auto = summarize(autoPayload);
const result = {
  manualPath,
  autoPath,
  comparedAt: new Date().toISOString(),
  topLevelDiff: Object.fromEntries(
    Object.keys({ ...manual.top, ...auto.top }).map((key) => [
      key,
      {
        manual: manual.top[key],
        auto: auto.top[key],
        same: JSON.stringify(manual.top[key]) === JSON.stringify(auto.top[key]),
      },
    ])
  ),
  variationCount: {
    manual: manual.variationCount,
    auto: auto.variationCount,
    same: manual.variationCount === auto.variationCount,
  },
  firstVariationKeyDiff: diffKeys(manual.firstVariationKeys, auto.firstVariationKeys),
  firstVariationFieldDiff: Object.fromEntries(
    Array.from(new Set([...manual.firstVariationKeys, ...auto.firstVariationKeys])).map((key) => [
      key,
      {
        manual: manual.firstVariation?.[key],
        auto: auto.firstVariation?.[key],
        same: JSON.stringify(manual.firstVariation?.[key]) === JSON.stringify(auto.firstVariation?.[key]),
      },
    ])
  ),
};

console.log(JSON.stringify(result, null, 2));
