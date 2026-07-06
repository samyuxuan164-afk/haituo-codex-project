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
