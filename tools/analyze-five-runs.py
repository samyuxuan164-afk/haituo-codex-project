import argparse
import importlib.util
import json
import shutil
from collections import Counter
from pathlib import Path
from typing import Any


def load_run_analyzer():
    module_path = Path(__file__).with_name("analyze-run-bundle.py")
    spec = importlib.util.spec_from_file_location("analyze_run_bundle", module_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load analyzer module: {module_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def discover_sources(args: argparse.Namespace) -> list[Path]:
    sources = [Path(item) for item in args.sources]
    if args.runs_dir:
        runs_dir = Path(args.runs_dir)
        if runs_dir.exists():
            sources.extend(sorted(path for path in runs_dir.iterdir() if path.suffix.lower() == ".zip"))
            sources.extend(sorted(path for path in runs_dir.iterdir() if path.is_dir() and not path.name.startswith("_")))
    seen = set()
    unique = []
    for source in sources:
        resolved = source.resolve()
        if resolved not in seen:
            seen.add(resolved)
            unique.append(source)
    return unique


def safe_extract_dir(base: Path, source: Path, index: int) -> Path:
    name = source.stem if source.suffix.lower() == ".zip" else source.name
    return base / f"{index:02d}-{name}"


def analyze_sources(sources: list[Path], extract_root: Path | None) -> list[dict[str, Any]]:
    analyzer = load_run_analyzer()
    results = []
    if extract_root:
        if extract_root.exists():
            shutil.rmtree(extract_root)
        extract_root.mkdir(parents=True, exist_ok=True)

    for index, source in enumerate(sources, start=1):
        item: dict[str, Any] = {"source": str(source), "index": index}
        try:
            target = safe_extract_dir(extract_root, source, index) if extract_root and source.suffix.lower() == ".zip" else None
            run_root, extracted = analyzer.unpack_if_needed(source, target)
            report = analyzer.analyze(run_root)
            item.update(report)
            if extracted:
                item["extractedRoot"] = str(extracted)
        except Exception as error:  # noqa: BLE001 - CLI report should capture any bad run bundle.
            item["issues"] = [{"kind": "analysis_error", "message": str(error)}]
            item["readyForFiveItemValidation"] = False
            item["nextAction"] = "fix_run_bundle_before_batch_validation"
        results.append(item)
    return results


def summarize(results: list[dict[str, Any]], required_count: int) -> dict[str, Any]:
    issue_counter = Counter()
    success_items = []
    duplicate_asins = []
    duplicate_sku_codes = []
    seen_asins = set()
    seen_sku_codes = set()

    for item in results:
        for issue in item.get("issues", []):
            issue_counter[issue.get("kind", "unknown")] += 1
        if item.get("readyForFiveItemValidation") and not item.get("issues"):
            success_items.append(item)
        asin = item.get("asin")
        if asin:
            if asin in seen_asins:
                duplicate_asins.append(asin)
            seen_asins.add(asin)
        first_sku = ((item.get("choiceSave") or {}).get("firstSku") or {}).get("skuCode")
        if first_sku:
            if first_sku in seen_sku_codes:
                duplicate_sku_codes.append(first_sku)
            seen_sku_codes.add(first_sku)
            if asin and first_sku != asin and not str(first_sku).startswith(f"{asin}-"):
                issue_counter["asin_sku_mismatch"] += 1

    enough = len(results) >= required_count
    all_success = len(success_items) >= required_count and len(results) >= required_count
    no_duplicates = not duplicate_asins and not duplicate_sku_codes
    ready_for_next_batch = enough and all_success and no_duplicates and not issue_counter
    return {
        "requiredCount": required_count,
        "inputCount": len(results),
        "successCount": len(success_items),
        "failureCount": len(results) - len(success_items),
        "issueCounts": dict(sorted(issue_counter.items())),
        "duplicateAsins": duplicate_asins,
        "duplicateSkuCodes": duplicate_sku_codes,
        "readyForTenItemValidation": ready_for_next_batch,
        "nextAction": "start_10_item_validation" if ready_for_next_batch else "fix_failed_runs_or_collect_more_5_item_runs",
    }


def compact_item(item: dict[str, Any]) -> dict[str, Any]:
    choice = item.get("choiceSave") or {}
    first_sku = choice.get("firstSku") or {}
    return {
        "index": item.get("index"),
        "source": item.get("source"),
        "runId": item.get("runId"),
        "productId": item.get("productId"),
        "asin": item.get("asin"),
        "stage": item.get("stage"),
        "skuCount": choice.get("skuCount"),
        "categoryId": choice.get("categoryId"),
        "postageId": choice.get("postageId"),
        "skuCode": first_sku.get("skuCode"),
        "goodsValue": first_sku.get("goodsValue"),
        "logisticValue": first_sku.get("logisticValue"),
        "stock": first_sku.get("stock"),
        "weight": first_sku.get("weight"),
        "length": first_sku.get("length"),
        "width": first_sku.get("width"),
        "height": first_sku.get("height"),
        "readyForFiveItemValidation": item.get("readyForFiveItemValidation"),
        "issues": item.get("issues", []),
        "nextAction": item.get("nextAction"),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Analyze 5 Dianxiaomi run bundles and decide whether to move to 10-item validation.")
    parser.add_argument("sources", nargs="*", help="Run zip bundles or extracted run directories.")
    parser.add_argument("--runs-dir", help="Directory containing run zip bundles/directories.")
    parser.add_argument("--extract-to", help="Optional extraction root for zip bundles.")
    parser.add_argument("--required-count", type=int, default=5)
    parser.add_argument("--out", required=True, help="Output batch report JSON path.")
    args = parser.parse_args()

    sources = discover_sources(args)
    if not sources:
        raise SystemExit("No run bundles found. Provide sources or --runs-dir.")

    results = analyze_sources(sources, Path(args.extract_to) if args.extract_to else None)
    report = {
        "batchType": "bumpers-5-item-validation",
        "summary": summarize(results, args.required_count),
        "items": [compact_item(item) for item in results],
    }

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["summary"]["readyForTenItemValidation"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
