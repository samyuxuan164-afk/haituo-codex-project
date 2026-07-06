#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const TEXT_EXTENSIONS = new Set([
  '.md',
  '.txt',
  '.json',
  '.js',
  '.mjs',
  '.cjs',
  '.py',
  '.html',
  '.css',
  '.csv',
  '.ts',
  '.tsx',
  '.jsx',
  '.sh',
  '.command',
]);
const SKIP_DIRS = new Set(['.git', 'node_modules', '.DS_Store']);

function nowIso() {
  return new Date().toISOString();
}

function compactText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function usage() {
  return {
    tool: 'cleanup-task-screenshots',
    commands: {
      plan: 'Dry-run screenshot cleanup plan. Default command.',
      cleanup: 'Same as plan unless --write is supplied. Deletes only unreferenced screenshots with --write.',
    },
    defaultScope: [
      'root-level image files',
      'runs/**/*.png|jpg|jpeg|webp',
    ],
    options: {
      '--root <path>': 'Additional scan root. Can be used more than once.',
      '--older-than-days <n>': 'Only mark screenshots older than n days as cleanup candidates.',
      '--out <path>': 'Write JSON report to a file.',
      '--write': 'Delete cleanup candidates. Omit for dry-run.',
      '--max-list <n>': 'Limit displayed candidate/reference arrays in stdout.',
    },
    rules: [
      'Referenced screenshots are kept.',
      'Unreferenced screenshots are considered temporary task evidence.',
      'No files are deleted without --write.',
      'This tool does not touch source code, stores, browser pages, Dianxiaomi, AliExpress, or Amazon.',
    ],
  };
}

function parseArgs(argv) {
  const args = {
    command: argv[2] || 'plan',
    roots: [],
    olderThanDays: null,
    outPath: '',
    write: false,
    maxList: 80,
  };
  for (let i = 3; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === '--root' && next) {
      args.roots.push(path.resolve(next));
      i += 1;
    } else if (arg === '--older-than-days' && next) {
      args.olderThanDays = Number(next);
      i += 1;
    } else if (arg === '--out' && next) {
      args.outPath = path.resolve(next);
      i += 1;
    } else if (arg === '--write') {
      args.write = true;
    } else if (arg === '--max-list' && next) {
      args.maxList = Number(next);
      i += 1;
    }
  }
  return args;
}

function isInside(parent, child) {
  const relative = path.relative(parent, child);
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function shouldSkipDir(dirPath) {
  const base = path.basename(dirPath);
  return SKIP_DIRS.has(base);
}

function walkFiles(startPath) {
  if (!fs.existsSync(startPath)) return [];
  const stat = fs.statSync(startPath);
  if (stat.isFile()) return [startPath];
  const files = [];
  const entries = fs.readdirSync(startPath, { withFileTypes: true });
  entries.forEach((entry) => {
    const fullPath = path.join(startPath, entry.name);
    if (entry.isDirectory()) {
      if (!shouldSkipDir(fullPath)) files.push(...walkFiles(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  });
  return files;
}

function defaultImageRoots() {
  const roots = [];
  const runs = path.join(ROOT, 'runs');
  if (fs.existsSync(runs)) roots.push(runs);
  fs.readdirSync(ROOT, { withFileTypes: true }).forEach((entry) => {
    if (!entry.isFile()) return;
    const ext = path.extname(entry.name).toLowerCase();
    if (IMAGE_EXTENSIONS.has(ext)) roots.push(path.join(ROOT, entry.name));
  });
  return roots;
}

function collectImageFiles(args) {
  const roots = args.roots.length ? args.roots : defaultImageRoots();
  const seen = new Set();
  const files = [];
  roots.forEach((root) => {
    walkFiles(root).forEach((filePath) => {
      const abs = path.resolve(filePath);
      const ext = path.extname(abs).toLowerCase();
      if (!IMAGE_EXTENSIONS.has(ext)) return;
      if (seen.has(abs)) return;
      seen.add(abs);
      files.push(abs);
    });
  });
  return files.sort();
}

function collectTextFiles() {
  return walkFiles(ROOT)
    .filter((filePath) => TEXT_EXTENSIONS.has(path.extname(filePath).toLowerCase()))
    .sort();
}

function readTextIndex(textFiles) {
  return textFiles.map((filePath) => {
    let text = '';
    try {
      text = fs.readFileSync(filePath, 'utf8');
    } catch (error) {
      text = '';
    }
    return {
      filePath,
      text,
    };
  });
}

function relPath(filePath) {
  return path.relative(ROOT, filePath).split(path.sep).join('/');
}

function referenceMatches(imagePath, textIndex) {
  const relative = relPath(imagePath);
  const base = path.basename(imagePath);
  const relativeNoDot = relative.replace(/^\.\//, '');
  const matches = [];
  textIndex.forEach((entry) => {
    if (!entry.text) return;
    if (entry.filePath === imagePath) return;
    if (entry.text.includes(relative) || entry.text.includes(relativeNoDot) || entry.text.includes(base)) {
      matches.push(relPath(entry.filePath));
    }
  });
  return matches;
}

function ageDays(filePath) {
  const stat = fs.statSync(filePath);
  const ageMs = Date.now() - stat.mtimeMs;
  return ageMs / (24 * 60 * 60 * 1000);
}

function shouldConsiderByAge(filePath, olderThanDays) {
  if (olderThanDays == null || Number.isNaN(olderThanDays)) return true;
  return ageDays(filePath) >= olderThanDays;
}

function buildPlan(args) {
  const images = collectImageFiles(args);
  const textIndex = readTextIndex(collectTextFiles());
  const rows = images.map((imagePath) => {
    const references = referenceMatches(imagePath, textIndex);
    const staleByAge = shouldConsiderByAge(imagePath, args.olderThanDays);
    const cleanupCandidate = references.length === 0 && staleByAge;
    return {
      path: relPath(imagePath),
      absolutePath: imagePath,
      referenced: references.length > 0,
      references,
      ageDays: Math.round(ageDays(imagePath) * 100) / 100,
      cleanupCandidate,
    };
  });
  return {
    ok: true,
    schemaVersion: 'dxm-task-screenshot-cleanup-v1',
    generatedAt: nowIso(),
    dryRun: !args.write,
    roots: (args.roots.length ? args.roots : defaultImageRoots()).map((item) => relPath(path.resolve(item))),
    olderThanDays: args.olderThanDays,
    summary: {
      totalImages: rows.length,
      referenced: rows.filter((row) => row.referenced).length,
      cleanupCandidates: rows.filter((row) => row.cleanupCandidate).length,
      skippedByAge: rows.filter((row) => !row.referenced && !row.cleanupCandidate).length,
    },
    cleanupCandidates: rows.filter((row) => row.cleanupCandidate),
    referencedImages: rows.filter((row) => row.referenced),
  };
}

function deleteCandidates(plan) {
  const deleted = [];
  const failed = [];
  plan.cleanupCandidates.forEach((row) => {
    try {
      fs.unlinkSync(row.absolutePath);
      deleted.push(row.path);
    } catch (error) {
      failed.push({
        path: row.path,
        error: String(error && error.message ? error.message : error),
      });
    }
  });
  return { deleted, failed };
}

function trimForStdout(report, maxList) {
  const limit = Number.isFinite(maxList) && maxList >= 0 ? maxList : 80;
  return {
    ...report,
    cleanupCandidates: report.cleanupCandidates.slice(0, limit).map(({ absolutePath, ...row }) => row),
    referencedImages: report.referencedImages.slice(0, limit).map(({ absolutePath, ...row }) => row),
    truncated: {
      cleanupCandidates: Math.max(0, report.cleanupCandidates.length - limit),
      referencedImages: Math.max(0, report.referencedImages.length - limit),
    },
  };
}

function output(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function main() {
  const args = parseArgs(process.argv);
  if (args.command === 'help') {
    output(usage());
    return;
  }
  if (!['plan', 'cleanup'].includes(args.command)) {
    output(usage());
    process.exitCode = 1;
    return;
  }
  const plan = buildPlan(args);
  let result = {
    ...plan,
    deletion: {
      attempted: false,
      deleted: [],
      failed: [],
    },
  };
  if (args.command === 'cleanup' && args.write) {
    const deletion = deleteCandidates(plan);
    result = {
      ...result,
      dryRun: false,
      deletion: {
        attempted: true,
        ...deletion,
      },
    };
    result.ok = deletion.failed.length === 0;
  }
  if (args.outPath) {
    fs.mkdirSync(path.dirname(args.outPath), { recursive: true });
    fs.writeFileSync(args.outPath, `${JSON.stringify(result, null, 2)}\n`);
  }
  output(trimForStdout(result, args.maxList));
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    output({ ok: false, error: String(error && error.message ? error.message : error) });
    process.exitCode = 1;
  }
}

module.exports = {
  buildPlan,
  defaultImageRoots,
};
