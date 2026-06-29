# CHANGELOG

## 2026-06-27 - Mac Plugin Recovery

### Fixed

- Restored Tampermonkey panel rendering on Mac after full Chrome quit/reopen.
- Added execution markers to distinguish matched scripts from executed scripts.
- Moved the Crawlbox panel default Dianxiaomi position away from the save Payload panel.
- Added root `dianxiaomi.com` match rules to Crawlbox.

### Changed

- Current Mac recovery versions: `DXM Automation V1 - NEW v1.1.42`, `DXM Amazon Crawlbox V1 v0.1.22`, `save Payload V3 v0.6.2`.

### Notes

- If Tampermonkey shows scripts as enabled but no panels render after permission/script changes, fully quit and reopen Chrome. Refresh alone can be insufficient.

## 2026-06-25 - V1 Freeze

### Added

- V1 freeze report and Mac migration documentation.
- Browser Session Incident Report for Environment Control Exception.
- Handoff document for Mac continuation.
- V2 design proposal.
- Permanent rule: browser control exceptions are not business, plugin, project, or product failures.

### Changed

- Current source of truth moved to `docs/freeze-v1-20260625/`.
- Main active version documented as `DXM Automation V1 - NEW v1.1.41`.
- Active collection version documented as `DXM Amazon Crawlbox V1 v0.1.21`.

### Paused

- 3 categories x 10 products live stability validation.
- Final publish remains disabled.

## 2026-06-25 - Main Plugin v1.1.41

### Added

- `CATEGORY_MAPPING_RULES` table.
- Pen Holders mapping limited to desk stationery / pen holder / pencil cup products.
- Guard against generic Organizer being mapped globally to Pen Holders.

## 2026-06-25 - Collection Rules

### Added

- Same product different colors are allowed as separate SKUs.
- Exact duplicate filtering requires same ASIN/link/color/size/package.
- Default target 100 and category limit 15 are configurable, not hard-coded business constants.

## 2026-06-24 - Main Plugin v1.1.37+

### Added

- Edit-page save preflight.
- Visible category selection.
- Conservative required attribute fill.
- Custom attribute cleanup/skip.
- Freight template 111 real selection and verification.
- One retry after fixable save validation errors.
