# Mac Environment Checklist

## Project

- [ ] Project copied to `~/Projects/dianxiaomi-automation-v1`.
- [ ] `src/`, `skills/`, `docs/`, `tools/`, `runs/`, and `analysis/` exist.
- [ ] Freeze docs exist in `docs/freeze-v1-20260625/`.
- [ ] Git initialized after copy.
- [ ] First commit created.

## Runtime

- [ ] Chrome installed.
- [ ] Tampermonkey installed.
- [ ] Node.js installed.
- [ ] Python 3 installed.
- [ ] Git installed.
- [ ] `rg` installed or available.

## Tampermonkey

- [ ] `DXM Automation V1 - NEW v1.1.41` installed and enabled.
- [ ] `DXM Amazon Crawlbox V1 v0.1.21` installed and enabled.
- [ ] `save Payload V3 v0.6.1` installed and enabled when capturing evidence.
- [ ] `DXM Amazon NEW` not used unless explicitly testing the experimental plugin.

## Accounts

- [ ] Dianxiaomi logged in.
- [ ] Amazon logged in or accessible.
- [ ] No CAPTCHA blocking.
- [ ] No browser permission prompt blocking automation.

## File Encoding

- [ ] Open `skills/category-resolver/learned_rules.json` in UTF-8 editor.
- [ ] Confirm `笔筒` displays correctly.
- [ ] Confirm `AGENT.md`, `AGENTS.md`, and freeze docs display correctly.
- [ ] Treat old mojibake display in Windows terminal as historical display issue, not automatic file corruption.

## First Validation

- [ ] Confirm main plugin panel version v1.1.41 on Dianxiaomi.
- [ ] Confirm Amazon Crawlbox panel version v0.1.21 on Amazon.
- [ ] Run one product smoke path to wait-to-publish.
- [ ] Verify no final publish is triggered.
- [ ] Then run 3 x 10 validation.

