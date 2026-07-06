# New Thread Handoff - DXM Automation V1

Date: 2026-06-29

## Project

Path:

`/Users/sam/Documents/电商上架项目/自动上架/dianxiaomi-automation-v1`

Current phase:

Validation / edit-page visible-field completion verification.

## Required Reading For New Thread

Read these first, do not restart the project:

- `AGENTS.md`
- `AGENT.md`
- `docs/current-status.md`
- `DEVELOPMENT_LOG.md`
- `VERSION_HISTORY.md`
- `docs/project-execution-rules.md`
- `docs/amazon-crawlbox-rules.md`
- `skills/project-freeze-handoff/SKILL.md`
- `docs/new-thread-handoff.md`

## Current State

- Main plugin source is prepared as `DXM Automation V1 - NEW v1.1.52`.
- File: `src/dianxiaomi-automation-v1-merged-new.user.js`.
- Syntax check passed with Node.
- User-side Tampermonkey overwrite is still pending unless the user says it has been covered.
- Codex sandbox cannot currently write to macOS clipboard via `pbcopy`, even though the user's Terminal `pbcopy/pbpaste` works.
- A local helper was created:
  - `tools/copy-main-userscript-to-clipboard.command`
  - Double-clicking it should copy the current main userscript to clipboard using the user's own Mac session.

## Confirmed Issue Before v1.1.52

Live v1.1.51 was confirmed on the edit page for sample:

- Product ID: `167487782006885971`
- ASIN: `B0BPS66NC3`
- Product: silicone soap dish

v1.1.51 partially worked:

- Category could visibly回填.

But target was not achieved:

- Re-running edit-page rules could overwrite correct soap-dish category to `Home Office Storage`.
- One custom attribute value still exceeded 70 chars.
- Freight template `111` still did not visibly select.
- No publish action was executed.

## v1.1.52 Prepared Fixes

- Exact modal category plans now take precedence over drawer/storage fallback.
- Bathroom soap-dish titles are excluded from drawer-storage fast path.
- Existing marketing images are recognized, avoiding unnecessary one-key generation clicks.
- Custom attributes are normalized before deletion fallback.
- Freight template selection reports explicit `ok` status; failed selection remains a preflight blocker.

## Next Target

After the user confirms Tampermonkey has been overwritten with v1.1.52:

1. Refresh the Dianxiaomi edit page.
2. Confirm right panel shows `DXM Automation V1 V1.1.52`.
3. Verify the same sample or current valid five-category sample edit page:
   - Product category remains correct and does not get overwritten to wrong storage category.
   - Custom attributes are <=70 chars or cleared.
   - Freight template `111` is visibly selected.
   - PC description remains image-first and includes current product images.
   - Preflight blocks if any required field is still missing.
4. Do not publish.
5. Do not click one-click publish.
6. Only save to wait-to-publish if preflight passes and the current validation step explicitly reaches save.

## Hard Prohibitions

- Do not publish.
- Do not click one-click publish.
- Do not treat page control errors as product business failures.
- Do not keep repeatedly modifying the same issue without verifying target completion.
- Follow the three-step rule:
  1. Confirm issue.
  2. Optimize issue.
  3. Verify whether the original work target is achieved.

