#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_CONFIG_PATH = path.join(ROOT, 'config', 'aliexpress-entry.json');

function readConfig(configPath = DEFAULT_CONFIG_PATH) {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  if (config.schemaVersion !== 'aliexpress-entry-v1') {
    throw new Error(`Unsupported AliExpress entry schemaVersion: ${config.schemaVersion || 'missing'}`);
  }
  if (config.entryMode !== 'configured_url') {
    throw new Error(`Unsupported AliExpress entryMode: ${config.entryMode || 'missing'}`);
  }
  const url = new URL(config.primaryUrl);
  if (!/^https:$/.test(url.protocol) || !/(^|\.)aliexpress\.com$/i.test(url.hostname)) {
    throw new Error(`Invalid AliExpress primaryUrl: ${config.primaryUrl}`);
  }
  if (!config.requiresExistingLoginState) {
    throw new Error('AliExpress entry must require existing Chrome login state.');
  }
  return config;
}

function checkConfig(configPath = DEFAULT_CONFIG_PATH) {
  const config = readConfig(configPath);
  return {
    ok: true,
    status: 'configured',
    entryMode: config.entryMode,
    primaryUrl: config.primaryUrl,
    browser: config.browser,
    requiresExistingLoginState: config.requiresExistingLoginState,
    manualFallback: config.manualFallback,
    allowedActions: config.allowedActions,
    forbiddenActions: config.forbiddenActions,
    failureStatuses: config.failureStatuses,
  };
}

function main() {
  const configPath = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_CONFIG_PATH;
  try {
    process.stdout.write(`${JSON.stringify(checkConfig(configPath), null, 2)}\n`);
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ ok: false, error: String(error && error.message ? error.message : error) }, null, 2)}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = {
  DEFAULT_CONFIG_PATH,
  checkConfig,
  readConfig,
};
