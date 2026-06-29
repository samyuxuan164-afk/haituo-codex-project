# V1 Handoff Document

## Project Introduction

This project builds a Tampermonkey-based automation system for Dianxiaomi product listing workflows. The system follows the original Dianxiaomi path:

```text
Amazon product
-> Dianxiaomi collection box
-> claim
-> edit page auto-fill
-> save
-> wait-to-publish
```

It does not execute final publish during the current validation stage.

## Current Target

Resume 3 x 10 stability validation on Mac:

```text
3 different categories
10 real products each
30 total
```

Verify only:

```text
Amazon -> collection box -> claim -> edit page auto-fill -> save -> wait-to-publish
```

Do not final publish.

## Development Progress

Current V1 code is prepared. Live validation is paused due to Environment Control Exception on Windows browser control.

## Versions

```text
DXM Automation V1 - NEW: v1.1.41
DXM Amazon Crawlbox V1: v0.1.21
save Payload V3: v0.6.1
Interface Detector V2: v0.3.0
```

## Critical Rules

1. Do not final publish unless explicitly authorized.
2. Edit page must save and reach wait-to-publish only.
3. Title must remove brands, trademarks, and brand model terms.
4. Same product with different colors is allowed.
5. Exact duplicate ASIN/link/color/size/package is filtered.
6. Category must be judged by Dianxiaomi platform category, actual use, product shape, title semantics, and images.
7. `Pen Holders` is only a category mapping rule for desk stationery storage / pencil cup / pen holder products, not a global Organizer rule.
8. Custom attributes default to empty/skip.
9. Freight template `111` must be truly selected.
10. Browser control exceptions are environment issues, not product failures.

## Startup

1. Open project root.
2. Verify scripts with Node/Python.
3. Install Tampermonkey scripts.
4. Login to Dianxiaomi and Amazon.
5. Run smoke validation.
6. Resume 3 x 10 validation.

## Recovery

If browser control fails:

1. Do not repeatedly run deep DOM/screenshot/reload/goto operations.
2. Classify as Environment Control Exception.
3. Record in `runs/stability-30-20260624-065520/` or new run folder.
4. Do not count as business/product failure.

## Next Stage

Mac first-run validation:

1. Confirm v1.1.41 actual load.
2. Confirm category mapping works.
3. Confirm brand filtering works.
4. Confirm same-product different-color allowance.
5. Confirm exact duplicate filtering.
6. Confirm save to wait-to-publish.
7. Produce 3 x 10 run report.

