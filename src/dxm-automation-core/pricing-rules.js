'use strict';

function toNumber(value) {
  if (value == null || value === '') return null;
  const numbers = extractNumbers(value);
  return numbers.length ? Math.max(...numbers) : null;
}

function extractNumbers(value) {
  const matches = String(value).replace(/,/g, '').match(/\d+(?:\.\d+)?/g);
  if (!matches) return [];
  return matches.map(Number).filter(Number.isFinite);
}

function selectPriceUsd(value, rangePolicy) {
  const numbers = extractNumbers(value);
  if (!numbers.length) return null;
  if (numbers.length === 1) return numbers[0];
  if (!rangePolicy || rangePolicy === 'highest_displayed_value') return Math.max(...numbers);
  if (rangePolicy === 'lowest_displayed_value') return Math.min(...numbers);
  return null;
}

function resolveMultiplier(priceUsd, multiplierConfig) {
  if (multiplierConfig && typeof multiplierConfig === 'object') {
    const tiers = Array.isArray(multiplierConfig.tiers) ? multiplierConfig.tiers : [];
    const matchedTier = tiers.find((tier) => {
      const minUsd = tier.minUsd == null ? -Infinity : toNumber(tier.minUsd);
      const maxUsd = tier.maxUsd == null ? Infinity : toNumber(tier.maxUsd);
      if (minUsd == null || maxUsd == null) return false;
      return priceUsd >= minUsd && priceUsd <= maxUsd;
    });
    return toNumber(matchedTier ? matchedTier.multiplier : multiplierConfig.multiplier);
  }
  return toNumber(multiplierConfig);
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
  const separator = '[x\\u00d7\\u8133]';
  const withLabel = new RegExp(`(?:Product|Item|Package)?\\s*Dimensions[^0-9]{0,30}([0-9.]+)\\s*${separator}\\s*([0-9.]+)\\s*${separator}\\s*([0-9.]+)\\s*(?:inches|inch|in\\b|")`, 'i');
  const withoutLabel = new RegExp(`\\b([0-9.]+)\\s*${separator}\\s*([0-9.]+)\\s*${separator}\\s*([0-9.]+)\\s*(?:inches|inch|in\\b|")`, 'i');
  const match = source.match(withLabel) || source.match(withoutLabel);
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

function calculateSupplyPriceCny(sourcePriceUsd, exchangeRate, multiplier, options = {}) {
  const price = selectPriceUsd(sourcePriceUsd, options.rangePolicy);
  const rate = toNumber(exchangeRate);
  const factor = resolveMultiplier(price, multiplier);
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
  selectPriceUsd,
  round2,
  positiveNumber,
  parseDimensionInches,
  dimensionsInToCm,
  parseWeightKg,
  calculateSupplyPriceCny,
  priceEqualsExpected,
};
