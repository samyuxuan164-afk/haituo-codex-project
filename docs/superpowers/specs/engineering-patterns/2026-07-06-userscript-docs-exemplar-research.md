---
status: draft
task: haituo-codex-project docs-first audit
date: 2026-07-06
---

# Userscript Automation Documentation Exemplar Research

## Scope

This research supports the README, architecture diagram, test map, and audit documentation for `haituo-codex-project`.
The target repository is not a generic web app. It is a browser userscript automation system with strict business safety gates, local evidence stores, and many historical run artifacts. The useful reference pattern is therefore not "pretty README first", but "truth-source README plus verifiable architecture plus explicit safety/test boundaries".

## References Reviewed

### 1. lisonge/vite-plugin-monkey

Source: <https://github.com/lisonge/vite-plugin-monkey>

What it does:

- Provides a Vite plugin for userscript development.
- Treats userscript metadata, build output, and install/update behavior as first-class project concerns.
- Keeps developer-facing documentation close to build/config concepts instead of only describing manual installation.

How this context differs:

- `haituo-codex-project` has no package manifest and no bundler. The active scripts are checked in directly as Tampermonkey `.user.js` files.
- The local project also has business-action risk: collection, claim, edit, save, publish, and one-click publish are not equivalent to ordinary browser automation actions.
- Documentation must name the active script versions from `src/*` headers, because README and `docs/install.md` have drifted behind source.

Adapt vs skip:

- Adapt: README should expose active script matrix, install/enable order, and exact source paths.
- Adapt: test documentation should name the actual command surface, even when it is only `node --check` plus hand-written tests.
- Skip: bundler setup and package scripts until the project adopts a manifest.

### 2. violentmonkey/generator-userscript

Source: <https://github.com/violentmonkey/generator-userscript>

What it does:

- Provides a scaffold for userscript projects so source, metadata, build commands, and distribution are repeatable.
- Encourages a predictable project skeleton instead of a loose pile of browser scripts.

How this context differs:

- This repository is already mature and messy, with historical scripts, operational docs, evidence folders, and local tools.
- A scaffold rewrite would be too invasive for the current request.
- The immediate need is to document current reality, then add test and version guardrails.

Adapt vs skip:

- Adapt: define a stable "project map" in README: `src/`, `tools/`, `config/`, `docs/`, `skills/`, `runs/`, `analysis/`.
- Adapt: recommend future manifest adoption as a follow-up, not as a docs-first prerequisite.
- Skip: regenerating folder layout or renaming scripts during this audit.

### 3. microsoft/playwright

Source: <https://github.com/microsoft/playwright>

What it does:

- Provides browser automation with a documented test runner, isolation model, fixtures, traces, and repeatable commands.
- Makes the test entrypoint explicit and separates test artifacts from source.

How this context differs:

- `haituo-codex-project` cannot safely run live browser actions as a generic test suite, because live Dianxiaomi actions can mutate business state.
- The available local baseline is mostly static: `node --check`, one Node assertion test, JSON/schema validation tools, and read-only/dry-run helpers.
- Live browser validation must stay gated by `TASK.md`, `AGENTS.md`, and explicit user confirmation.

Adapt vs skip:

- Adapt: document a layered test strategy: static syntax, pure policy tests, fixture/schema checks, dry-run/read-only checks, then live validation only with explicit authorization.
- Adapt: keep generated screenshots and run evidence separate from source and cite cleanup rules.
- Skip: adding Playwright as a dependency in this docs-first pass.

## Patterns To Apply Now

1. Use source headers as the active version matrix.
2. Put the safety boundary before usage commands.
3. Split architecture into context, container, and component layers.
4. Name actual verification commands and mark absent coverage honestly.
5. Add an audit report that distinguishes "documentation fixed" from "test coverage solved".

## Quality Review

- Concrete source paths are used for all project-specific claims.
- No new runtime dependency is proposed as part of the docs-first pass.
- The current business boundary remains intact: no collection, claim, edit, save, publish, or one-click publish action is introduced.
