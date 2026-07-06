---
status: draft
date: 2026-07-06
topic: userscript pure module split
---

# Userscript Pure Module Split Exemplar Research

## Research Scope

The project needs to split a large Tampermonkey userscript into testable pure modules while preserving a safe single-file install path. The research focused on mature userscript build patterns, browser IIFE bundle patterns, and this repository's existing low-tooling Node module tests.

No subagents were spawned because this Codex environment only permits subagents when the user explicitly asks for delegation or parallel agent work.

## Reference 1: vite-plugin-monkey

Source:

- GitHub README/search result: https://github.com/lisonge/vite-plugin-monkey
- Discussion with server implementation notes: https://github.com/lisonge/vite-plugin-monkey/discussions/72

### Q1: What exactly does it do?

`vite-plugin-monkey` is a Vite userscript build system. It builds `.user.js` files for Tampermonkey, Violentmonkey, Greasemonkey, and ScriptCat. Its documented feature set includes userscript header injection, automatic `@require` handling for external CDN dependencies, GM API imports with type hints, automatic `@grant` collection, TypeScript support, and single-file support for top-level await or dynamic import when needed.

The README describes a build flow where regular code and Vite plugins produce ESM first, then the plugin emits either SystemJS or IIFE output depending on dynamic import needs. The discussion shows the development-mode adapter: a tiny userscript mounts the userscript window and injects an entry module into the host page, while Vite handles module serving and HMR.

### Q2: How does our context differ?

This repository is not a Vite project. It has no package manifest, no dependency install step, no typed source tree, and no unified test command. The current operational risk is not developer convenience; it is preserving the live Dianxiaomi automation surface and avoiding unintended business actions.

The main userscript also contains high-risk DOM automation for Ant dropdowns, save preflight, native save, and publishing controls. Moving directly to Vite would create a new install/build path before we have parity tests.

### Q3: What should we adapt vs skip?

Adapt:

- Keep the principle that authored source can be modular while the deployed userscript remains a single installable artifact.
- Separate browser adapter code from pure policy logic.
- Treat metadata/header preservation as a first-class build constraint.

Skip for now:

- Adding Vite, TypeScript, HMR, CDN externals, or GM API import abstractions.
- Changing Tampermonkey installation flow during the first split.

## Reference 2: Rollup IIFE Output

Source:

- Rollup configuration docs: https://rollupjs.org/configuration-options/#output-format

### Q1: What exactly does it do?

Rollup supports an `iife` output format for browser script bundles. Its docs state that IIFE output is suitable for script-tag inclusion and that external imports in IIFE/UMD bundles require explicit global variable mappings. Rollup also requires `output.name` when an IIFE/UMD bundle exports values, because the name becomes the global variable that exposes bundle exports to other scripts.

### Q2: How does our context differ?

Tampermonkey userscripts already run as a single script with a metadata block. We do not need library-style browser exports for the initial split. We also do not want external globals because the current main script has `@grant none` and avoids new dependency loading.

### Q3: What should we adapt vs skip?

Adapt:

- If/when a build step is added, target a single IIFE-style output.
- Preserve explicit boundaries between internal modules and global page exposure.

Skip for now:

- External dependency globals.
- Multi-entry bundles or chunk splitting.
- Exporting module internals onto a global namespace except for existing debug/helper hooks.

## Reference 3: esbuild IIFE Output

Source:

- esbuild API docs: https://esbuild.github.io/api/#format-iife

### Q1: What exactly does it do?

esbuild supports `iife`, `cjs`, and `esm` output formats. Its IIFE mode is meant for browser execution and wraps code to avoid accidental global-scope collisions. When entry exports need browser exposure, esbuild can place exports under a configured global name, including compound namespacing.

### Q2: How does our context differ?

esbuild would be a smaller toolchain addition than Vite, but it is still a new build dependency and introduces a generated artifact workflow. The current repository uses direct source files and manual Tampermonkey copy/install practices. A build step is useful later, but the first phase can move deterministic helpers into CommonJS modules and test them without changing runtime packaging.

### Q3: What should we adapt vs skip?

Adapt:

- IIFE bundling is the right eventual packaging model if modules need to be merged automatically.
- Namespacing is useful if pure helpers are ever exposed for diagnostics.

Skip for now:

- Immediate esbuild adoption.
- Any generated userscript replacement before parity tests exist.

## Reference 4: Existing Repository CommonJS Policy Modules

Source:

- `tools/aliexpress-evidence-policy.js`
- `tools/aliexpress-evidence-policy.test.js`

### Q1: What exactly does it do?

`tools/aliexpress-evidence-policy.js` defines deterministic thresholds and functions, then exports them with `module.exports`. It keeps file IO limited to `readThresholds`; the core functions `normalizeRate`, `normalizeCount`, `conditionalChecksPass`, `classifyEvidenceConfidence`, and `shouldCaptureDetailEvidence` can be tested with plain Node.

`tools/aliexpress-evidence-policy.test.js` uses Node's built-in `assert` and exits with a simple pass message. This matches the repository's current test style and avoids a package manager dependency.

### Q2: How does our context differ?

The main userscript currently contains many functions that call `window`, `document`, `localStorage`, and shared `state`. Pure extraction must avoid moving browser effects into Node modules. Some helpers that look pure are not pure yet, for example `sanitizeHtmlTextContent` and `getDetailWebImageUrls` use `document.createElement`.

### Q3: What should we adapt vs skip?

Adapt:

- Use CommonJS exports for the first pure modules.
- Use Node `assert` tests and keep the test command explicit.
- Keep IO/browser adapters outside pure modules.

Skip:

- Importing browser-only helpers into tests through DOM mocks.
- Introducing jsdom before there is a clear need.

## Local Code Evidence

Good first extraction candidates:

- text cleanup and title helpers around `sanitizePlatformText`, `findPlatformTextIssues`, and `buildCompliantProductTitle` in `src/dianxiaomi-automation-v1-merged-new.user.js`.
- numeric helpers around `parseDimensionInches`, `parseWeightKg`, `round2`, `calculateSupplyPriceCny`, and `priceEqualsExpected`.
- PC detail generation around `escapeHtml`, `textToStructuredDetailBodyHtml`, `selectPcDetailImages`, and `buildPcDetailWeb`.

Not first extraction candidates:

- dropdown and DOM interaction helpers such as `selectAntLikeValue`, category modal selection, required attribute selection, save preflight, and panel creation.
- functions that read `state`, `window`, `document`, `localStorage`, or current page URL.

## Patterns To Carry Into Implementation

1. Start with modules that have no browser effects.
2. Pass configuration as function arguments instead of reading panel/localStorage defaults inside pure modules.
3. Keep the userscript metadata and install artifact stable during the first split.
4. Add tests before wiring modules back into the userscript.
5. Update project docs in the same task to prevent documentation drift.

## Quality Review

- Concrete references are tied to build behavior, current local module style, and local function boundaries.
- The recommended first step avoids adding a package manager, bundler, or browser DOM mock.
- The research does not recommend copying a tool wholesale; it extracts the compatible pattern of modular source plus single-file runtime artifact.
- Claims about local code are limited to functions already inspected in the main userscript and existing CommonJS tool module.
