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
    .replace(/(\d+(?:\.\d+)?)\s*(?:"|\u2033|\u201d|\u201c|\uff02|''|\u2032\u2032)/g, '$1 inch')
    .replace(/(\d+(?:\.\d+)?)\s*in\.(?=\s|$|<|[),.;:!?])/gi, '$1 inch')
    .replace(/[\u201c\u201d\u201e\u201f\uff02"]/g, '')
    .replace(/[\u2032\u2033\u2018\u2019\u201a\u201b]/g, '')
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
  if (/[\u201c\u201d\u201e\u201f\uff02"\u2032\u2033\u2018\u2019\u201a\u201b]/.test(source)) {
    issues.push('contains_quote_or_dimension_symbol');
  }
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

function stripTrademarkSymbols(text) {
  return String(text || '').replace(/[\u2122\u00ae\u00a9]/g, '');
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
  return Array.from(new Set(candidates.map((value) => normalizeSpaces(stripTrademarkSymbols(value))).filter((value) => value && value.length <= 40)));
}

function stripForbiddenCommerceTerms(text, item) {
  let output = stripTrademarkSymbols(text).replace(/[\u2122\u00ae\u00a9]/g, ' ');
  const terms = [...FORBIDDEN_COMMERCE_TERMS, ...collectBrandCandidates(item)].sort((a, b) => String(b).length - String(a).length);
  for (const term of terms) {
    if (!term) continue;
    output = output.replace(new RegExp(`\\b${escapeRegExp(term)}\\b`, 'gi'), ' ');
  }
  return normalizeSpaces(output.replace(/\b(?:brand|trademark|store)\s*(?:name)?\s*[:\uff1a][^,\n.;]+/gi, ' '));
}

function findForbiddenTitleTerms(text, item = null) {
  const source = String(text || '').toLowerCase();
  const terms = [...FORBIDDEN_COMMERCE_TERMS, ...collectBrandCandidates(item)];
  return Array.from(new Set(terms
    .map((term) => normalizeSpaces(stripTrademarkSymbols(term)))
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
