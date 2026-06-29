import argparse
import json
import shutil
import zipfile
from pathlib import Path
from typing import Any


REQUIRED_FOR_DRY_RUN = {
    "final-report.json",
    "dry-run-report.json",
    "choiceSave.txt",
    "choiceSave.pretty.json",
    "input-edit.json",
}

REQUIRED_FOR_OP1 = REQUIRED_FOR_DRY_RUN | {
    "op1-save-response.json",
    "after-op1-edit.json",
    "op1-persistence-report.json",
}

REQUIRED_FOR_OP2 = REQUIRED_FOR_OP1 | {
    "op2-save-response.json",
}


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def find_run_root(path: Path) -> Path:
    if (path / "final-report.json").exists():
        return path
    children = [item for item in path.iterdir() if item.is_dir()]
    for child in children:
        if (child / "final-report.json").exists():
            return child
    raise FileNotFoundError(f"No final-report.json found under {path}")


def unpack_if_needed(source: Path, output_dir: Path | None) -> tuple[Path, Path | None]:
    if source.is_dir():
        return find_run_root(source), None
    if source.suffix.lower() != ".zip":
        raise ValueError("source must be a run directory or .zip bundle")
    target = output_dir or source.with_suffix("")
    if target.exists():
        shutil.rmtree(target)
    target.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(source) as archive:
        archive.extractall(target)
    return find_run_root(target), target


def file_set(run_root: Path) -> set[str]:
    return {path.name for path in run_root.iterdir() if path.is_file()}


def save_success(value: Any) -> bool:
    return isinstance(value, dict) and (value.get("code") == 0 or str(value.get("code")) == "0")


def summarize_choice_save(path: Path) -> dict:
    payload = load_json(path)
    variations = payload.get("variationListStr")
    try:
        variation_rows = json.loads(variations) if isinstance(variations, str) else variations
    except json.JSONDecodeError:
        variation_rows = []
    if not isinstance(variation_rows, list):
        variation_rows = []
    first_sku = variation_rows[0] if variation_rows and isinstance(variation_rows[0], dict) else {}
    return {
        "fieldCount": len(payload),
        "categoryId": payload.get("categoryId"),
        "postageId": payload.get("postageId"),
        "skuCount": len(variation_rows),
        "firstSku": {
            "skuCode": first_sku.get("skuCode"),
            "goodsValue": first_sku.get("gloGoodsValue") or first_sku.get("supplyPrice"),
            "logisticValue": first_sku.get("gloLogisticValue"),
            "stock": first_sku.get("sellableQuantity"),
            "weight": first_sku.get("packageWeight"),
            "length": first_sku.get("packageLength"),
            "width": first_sku.get("packageWidth"),
            "height": first_sku.get("packageHeight"),
        },
    }


def analyze(run_root: Path) -> dict:
    files = file_set(run_root)
    final_report = load_json(run_root / "final-report.json")
    stage = "dry-run"
    required = REQUIRED_FOR_DRY_RUN
    if "op1-save-response.json" in files or "op1-persistence-report.json" in files:
        stage = "op1"
        required = REQUIRED_FOR_OP1
    if "op2-save-response.json" in files:
        stage = "op2"
        required = REQUIRED_FOR_OP2

    missing = sorted(required - files)
    issues: list[dict] = []
    if missing:
        issues.append({"kind": "missing_files", "files": missing})

    dry_run = load_json(run_root / "dry-run-report.json") if "dry-run-report.json" in files else {}
    if not dry_run.get("pass"):
        issues.append({"kind": "dry_run_failed", "risks": dry_run.get("risks", [])})

    category_state = dry_run.get("categoryState") if isinstance(dry_run, dict) else {}
    resolver = category_state.get("resolver") if isinstance(category_state, dict) else {}
    if isinstance(resolver, dict) and resolver.get("status") == "unresolved":
        issues.append({"kind": "category_unresolved", "resolver": resolver})

    op1_response = load_json(run_root / "op1-save-response.json") if "op1-save-response.json" in files else None
    if op1_response is not None and not save_success(op1_response):
        issues.append({"kind": "op1_save_failed", "response": op1_response})

    persistence = load_json(run_root / "op1-persistence-report.json") if "op1-persistence-report.json" in files else None
    if persistence is not None and not persistence.get("persisted"):
        issues.append({"kind": "op1_not_persisted", "report": persistence})

    op2_response = load_json(run_root / "op2-save-response.json") if "op2-save-response.json" in files else None
    if op2_response is not None and not save_success(op2_response):
        issues.append({"kind": "op2_save_failed", "response": op2_response})

    final_result = final_report.get("result")
    if op2_response is not None and final_result != "success":
        issues.append({"kind": "final_report_not_success", "result": final_result, "failureReason": final_report.get("failureReason")})

    choice_summary = summarize_choice_save(run_root / "choiceSave.pretty.json") if "choiceSave.pretty.json" in files else {}
    category_id = str(choice_summary.get("categoryId") or "")
    if category_id and not category_id.isdigit():
        issues.append({"kind": "invalid_publish_category_id", "categoryId": category_id})

    ready_for_op2 = stage in {"op1", "op2"} and not any(issue["kind"] in {"missing_files", "dry_run_failed", "op1_save_failed", "op1_not_persisted"} for issue in issues)
    ready_for_five_item = stage == "op2" and not issues and final_result == "success"
    return {
        "runRoot": str(run_root),
        "runId": final_report.get("runId"),
        "productId": final_report.get("productId"),
        "asin": final_report.get("asin"),
        "stage": stage,
        "choiceSave": choice_summary,
        "files": sorted(files),
        "issues": issues,
        "readyForOp2": ready_for_op2,
        "readyForFiveItemValidation": ready_for_five_item,
        "nextAction": (
            "start_5_item_bumpers_validation"
            if ready_for_five_item
            else "run_op2_publish"
            if ready_for_op2 and stage == "op1"
            else "fix_schema_or_payload_before_continuing"
        ),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Analyze a downloaded Dianxiaomi run bundle and decide next stage.")
    parser.add_argument("source", help="Run zip bundle or extracted run directory.")
    parser.add_argument("--extract-to", help="Optional directory for zip extraction.")
    parser.add_argument("--out", help="Optional JSON report path.")
    args = parser.parse_args()

    run_root, extracted_root = unpack_if_needed(Path(args.source), Path(args.extract_to) if args.extract_to else None)
    report = analyze(run_root)
    if extracted_root:
        report["extractedRoot"] = str(extracted_root)

    if args.out:
        out = Path(args.out)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if not report["issues"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
