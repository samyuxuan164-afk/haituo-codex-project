#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_THRESHOLDS_PATH = path.join(ROOT, 'config', 'aliexpress-evidence-thresholds.json');
const DEFAULT_THRESHOLDS = {
  schemaVersion: 'aliexpress-evidence-thresholds-v1',
  highConfidenceTopShare: 0.8,
  directPassTopShare: 0.5,
  semanticConsensusTitleRatio: 0.6,
  detailEvidencePages: 2,
  maxDetailEvidencePages: 5,
};

function normalizeRate(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(1, number));
}

function normalizeCount(value, fallback, min, max) {
  const number = Math.floor(Number(value));
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function readThresholds(thresholdsPath = DEFAULT_THRESHOLDS_PATH) {
  let raw = {};
  try {
    raw = JSON.parse(fs.readFileSync(thresholdsPath, 'utf8'));
  } catch (_) {
    raw = {};
  }
  return {
    schemaVersion: raw.schemaVersion || DEFAULT_THRESHOLDS.schemaVersion,
    highConfidenceTopShare: normalizeRate(raw.highConfidenceTopShare, DEFAULT_THRESHOLDS.highConfidenceTopShare),
    directPassTopShare: normalizeRate(raw.directPassTopShare, DEFAULT_THRESHOLDS.directPassTopShare),
    semanticConsensusTitleRatio: normalizeRate(raw.semanticConsensusTitleRatio, DEFAULT_THRESHOLDS.semanticConsensusTitleRatio),
    detailEvidencePages: normalizeCount(raw.detailEvidencePages, DEFAULT_THRESHOLDS.detailEvidencePages, 2, 5),
    maxDetailEvidencePages: normalizeCount(raw.maxDetailEvidencePages, DEFAULT_THRESHOLDS.maxDetailEvidencePages, 2, 5),
  };
}

function conditionalChecksPass(conditionalChecks) {
  return Boolean(
    conditionalChecks
    && conditionalChecks.usageAndFormConsistent
    && conditionalChecks.noObviousConflict
    && conditionalChecks.nonRiskCategory
  );
}

function classifyEvidenceConfidence(topShare, hasDxmCategory, conditionalChecks, thresholds = DEFAULT_THRESHOLDS) {
  const directPassTopShare = normalizeRate(thresholds.directPassTopShare, DEFAULT_THRESHOLDS.directPassTopShare);
  const highConfidenceTopShare = normalizeRate(thresholds.highConfidenceTopShare, DEFAULT_THRESHOLDS.highConfidenceTopShare);
  if (topShare >= highConfidenceTopShare && hasDxmCategory) {
    return {
      status: 'aliexpress_verified',
      confidenceTier: 'high_confidence',
      verificationMode: 'high_confidence',
    };
  }
  if (topShare >= directPassTopShare && conditionalChecksPass(conditionalChecks)) {
    if (hasDxmCategory) {
      return {
        status: 'conditional_verified',
        confidenceTier: 'medium_confidence',
        verificationMode: 'conditional_verified',
      };
    }
    return {
      status: 'dxm_category_validation_required',
      confidenceTier: 'medium_confidence',
      verificationMode: 'dxm_category_validation_required',
    };
  }
  if (
    topShare > 0
    && topShare < directPassTopShare
    && conditionalChecks
    && conditionalChecks.semanticConsensus
    && conditionalChecks.semanticConsensus.ok
    && conditionalChecksPass(conditionalChecks)
  ) {
    return {
      status: 'dxm_category_validation_required',
      confidenceTier: 'detail_or_dxm_validation_required',
      verificationMode: 'low_share_semantic_consensus',
    };
  }
  return {
    status: '',
    confidenceTier: topShare > 0 && topShare < directPassTopShare ? 'below_threshold' : 'unverified',
    verificationMode: 'not_verified',
  };
}

function shouldCaptureDetailEvidence(scored, args, thresholds = DEFAULT_THRESHOLDS) {
  if (!args || !args.detailPages || args.detailPages <= 0) return false;
  if (!scored || scored.topCategoryId) return false;
  if (!scored.topShare || scored.topShare >= thresholds.directPassTopShare) return false;
  return true;
}

module.exports = {
  DEFAULT_THRESHOLDS_PATH,
  DEFAULT_THRESHOLDS,
  readThresholds,
  classifyEvidenceConfidence,
  shouldCaptureDetailEvidence,
};
