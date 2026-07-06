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
  const source = String(detailWeb || '');
  const pattern = /<img\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1/gi;
  let match = pattern.exec(source);
  while (match) {
    if (match[2]) urls.push(match[2]);
    match = pattern.exec(source);
  }
  return urls;
}

function countLeadingImageBlocks(detailWeb) {
  const source = String(detailWeb || '').trim();
  const blocks = source.match(/<p>\s*<img\b[^>]*>\s*<\/p>|<img\b[^>]*>/gi) || [];
  let count = 0;
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
