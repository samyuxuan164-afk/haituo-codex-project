import argparse
import json
from pathlib import Path
from typing import Any


RISK_FIELDS = {
    "id",
    "shopId",
    "categoryId",
    "productPropertyListJson",
    "mainImageListJson",
    "imgUrl",
    "marketImage1",
    "marketImage2",
    "variationListStr",
    "detailMobile",
    "detailWeb",
    "postageId",
    "aeopQualificationStructListJson",
    "msrEuId",
    "msrTrId",
}

JSON_STRING_FIELDS = {
    "productPropertyListJson",
    "mainImageListJson",
    "optionValues",
    "variationListStr",
    "detailMobile",
    "aeopQualificationStructListJson",
}


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def try_parse(value: Any):
    if not isinstance(value, str):
        return value
    text = value.strip()
    if not text:
        return value
    if text[0] not in "[{":
        return value
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return value


def compare_values(expected: Any, actual: Any, path: str, diffs: list[dict]):
    if type(expected) is not type(actual):
        diffs.append(
            {
                "path": path,
                "kind": "type_changed",
                "expectedType": type(expected).__name__,
                "actualType": type(actual).__name__,
                "expected": preview(expected),
                "actual": preview(actual),
            }
        )
        return

    if isinstance(expected, dict):
        keys = sorted(set(expected) | set(actual))
        for key in keys:
            child = f"{path}.{key}" if path else key
            if key not in expected:
                diffs.append({"path": child, "kind": "added", "actual": preview(actual[key])})
            elif key not in actual:
                diffs.append({"path": child, "kind": "missing", "expected": preview(expected[key])})
            else:
                compare_values(expected[key], actual[key], child, diffs)
        return

    if isinstance(expected, list):
        if len(expected) != len(actual):
            diffs.append({"path": path, "kind": "list_length", "expected": len(expected), "actual": len(actual)})
        for index, (left, right) in enumerate(zip(expected, actual)):
            compare_values(left, right, f"{path}[{index}]", diffs)
        return

    if expected != actual:
        diffs.append({"path": path, "kind": "value_changed", "expected": preview(expected), "actual": preview(actual)})


def preview(value: Any, limit: int = 500):
    text = json.dumps(value, ensure_ascii=False) if isinstance(value, (dict, list)) else str(value)
    return text if len(text) <= limit else f"{text[:limit]}...[truncated {len(text)-limit}]"


def normalize(payload: dict) -> dict:
    result = {}
    for key, value in payload.items():
        result[key] = try_parse(value) if key in JSON_STRING_FIELDS else value
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description="Diff constructed save payload against real choiceSave payload.")
    parser.add_argument("--real", required=True)
    parser.add_argument("--candidate", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    real = load_json(Path(args.real))
    candidate = load_json(Path(args.candidate))
    diffs: list[dict] = []
    compare_values(normalize(real), normalize(candidate), "", diffs)

    top_real = set(real)
    top_candidate = set(candidate)
    report = {
        "real": args.real,
        "candidate": args.candidate,
        "fieldCounts": {
            "real": len(top_real),
            "candidate": len(top_candidate),
        },
        "missingTopFields": sorted(top_real - top_candidate),
        "extraTopFields": sorted(top_candidate - top_real),
        "riskFieldDiffs": [diff for diff in diffs if diff["path"].split(".")[0].split("[")[0] in RISK_FIELDS],
        "diffCount": len(diffs),
        "diffs": diffs,
        "pass": len(diffs) == 0,
    }
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    Path(args.out).write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
