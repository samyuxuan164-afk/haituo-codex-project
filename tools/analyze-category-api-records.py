import argparse
import json
import re
from pathlib import Path
from typing import Any


ID_KEYS = {"id", "categoryId", "cateId", "cid", "fullCid", "leafCategoryId", "aliexpressCategoryId"}
NAME_KEYS = {"name", "categoryName", "cateName", "label", "title", "nameCn", "nameEn", "cnName", "enName"}
ATTR_NAME_KEYS = {"attr_name", "attrName", "attributeName", "name", "label"}
ATTR_ID_KEYS = {"attr_name_id", "attrNameId", "attributeId", "attrId", "id"}


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def parse_maybe_json(value: Any) -> Any:
    if not isinstance(value, str):
        return value
    text = value.strip()
    if not text:
        return value
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        if "&" in text and "=" in text:
            return dict(item.split("=", 1) for item in text.split("&") if "=" in item)
        return value


def walk(value: Any, path: str = ""):
    yield path, value
    if isinstance(value, dict):
        for key, child in value.items():
            child_path = f"{path}.{key}" if path else str(key)
            yield from walk(child, child_path)
    elif isinstance(value, list):
        for index, child in enumerate(value):
            yield from walk(child, f"{path}[{index}]")


def record_url(record: dict[str, Any]) -> str:
    return str(record.get("url") or record.get("request", {}).get("url") or "")


def record_method(record: dict[str, Any]) -> str:
    return str(record.get("method") or record.get("request", {}).get("method") or "GET").upper()


def record_type(record: dict[str, Any]) -> str:
    explicit = record.get("type") or record.get("request", {}).get("type")
    if explicit:
        return str(explicit)
    url = record_url(record).lower()
    text = json.dumps(record, ensure_ascii=False).lower()[:20000]
    if "attributelist" in url or "categoryattrmatch" in url or "attribute" in url and "category" in url:
        return "category_attribute"
    if "smtlocalcategory" in url or "category" in url or re.search(r"\bcate\b", url):
        return "category_search_or_tree"
    if "category" in text or "cate" in text:
        return "category_related"
    return "other"


def record_request(record: dict[str, Any]) -> Any:
    request = record.get("request") or {}
    body = request.get("body")
    if isinstance(body, dict) and body.get("fields"):
        return {"fields": body.get("fields"), "kind": body.get("kind")}
    for key in ("requestBodyFields", "requestBodyText"):
        if key in record:
            return record[key]
    return body or record.get("requestBodyText") or ""


def record_response(record: dict[str, Any]) -> Any:
    response = record.get("response") or {}
    text = response.get("text") or record.get("responseText") or ""
    parsed = record.get("responseParse")
    if isinstance(parsed, dict) and parsed.get("type") == "json":
        return parsed.get("value")
    return parse_maybe_json(text)


def compact(value: Any, limit: int = 500) -> str:
    text = json.dumps(value, ensure_ascii=False, separators=(",", ":")) if not isinstance(value, str) else value
    return text[:limit] + (f"...[truncated {len(text) - limit}]" if len(text) > limit else "")


def extract_category_candidates(response: Any) -> list[dict[str, Any]]:
    candidates: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    for path, value in walk(response):
        if not isinstance(value, dict):
            continue
        id_values = [str(value.get(key)) for key in ID_KEYS if value.get(key) not in (None, "")]
        name_values = [str(value.get(key)) for key in NAME_KEYS if value.get(key) not in (None, "")]
        if not id_values or not name_values:
            continue
        category_id = next((item for item in id_values if item.isdigit()), id_values[0])
        name = name_values[0]
        key = (category_id, name)
        if key in seen:
            continue
        seen.add(key)
        candidates.append(
            {
                "path": path,
                "categoryId": category_id,
                "name": name,
                "rawIds": id_values,
                "isNumericPublishId": category_id.isdigit(),
                "rawPreview": compact(value, 800),
            }
        )
    return candidates[:80]


def looks_required(value: dict[str, Any]) -> bool:
    for key in ("required", "isRequired", "must", "requiredFlag"):
        if value.get(key) is True or str(value.get(key)).lower() in {"true", "1", "yes", "required"}:
            return True
    text = " ".join(str(value.get(key, "")) for key in ("required", "isRequired", "must", "requiredFlag", "inputType"))
    return text.lower() in {"true", "1", "yes", "required"} or "required" in text.lower()


def extract_attribute_schema(response: Any) -> list[dict[str, Any]]:
    attrs: list[dict[str, Any]] = []
    seen: set[str] = set()
    for path, value in walk(response):
        if not isinstance(value, dict):
            continue
        attr_id = next((str(value.get(key)) for key in ATTR_ID_KEYS if value.get(key) not in (None, "")), "")
        attr_name = next((str(value.get(key)) for key in ATTR_NAME_KEYS if value.get(key) not in (None, "")), "")
        if not attr_id or not attr_name:
            continue
        key = f"{attr_id}|{attr_name}"
        if key in seen:
            continue
        seen.add(key)
        values = []
        for _, child in walk(value):
            if isinstance(child, dict):
                value_id = child.get("attr_value_id") or child.get("valueId") or child.get("id")
                value_name = child.get("attr_value") or child.get("valueName") or child.get("name") or child.get("label")
                if value_id not in (None, "") and value_name not in (None, ""):
                    values.append({"id": str(value_id), "name": str(value_name)})
        attrs.append(
            {
                "path": path,
                "attrId": attr_id,
                "attrName": attr_name,
                "required": looks_required(value),
                "valueCount": len(values),
                "valuesPreview": values[:20],
                "rawPreview": compact(value, 1000),
            }
        )
    return attrs[:120]


def summarize_records(doc: Any) -> dict[str, Any]:
    records = doc.get("records", []) if isinstance(doc, dict) else doc
    if not isinstance(records, list):
        raise ValueError("Input JSON must contain records array or be a records array")

    category_records = []
    for record in records:
        if not isinstance(record, dict):
            continue
        kind = record_type(record)
        if not kind.startswith("category"):
            continue
        response = record_response(record)
        candidates = extract_category_candidates(response)
        attrs = extract_attribute_schema(response)
        category_records.append(
            {
                "createdAt": record.get("createdAt"),
                "type": kind,
                "url": record_url(record),
                "method": record_method(record),
                "lastAction": record.get("lastAction") or {},
                "requestShape": compact(record_request(record), 1200),
                "candidateCount": len(candidates),
                "attributeCount": len(attrs),
                "categoryCandidates": candidates,
                "attributeSchema": attrs,
            }
        )

    search_records = [item for item in category_records if item["categoryCandidates"]]
    attr_records = [item for item in category_records if item["attributeSchema"]]
    return {
        "recordCount": len(records),
        "categoryRecordCount": len(category_records),
        "categorySearchRecordCount": len(search_records),
        "categoryAttributeRecordCount": len(attr_records),
        "candidateCategories": [candidate for item in search_records for candidate in item["categoryCandidates"]][:120],
        "attributeSchema": [attr for item in attr_records for attr in item["attributeSchema"]][:200],
        "records": category_records,
        "nextAction": (
            "wire_dynamic_category_search"
            if search_records and attr_records
            else "capture_category_search_and_attribute_requests"
        ),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Analyze V2/V3 exported records to discover category search and attribute APIs.")
    parser.add_argument("source", help="V2/V3 exported JSON")
    parser.add_argument("--out", help="Optional JSON report path")
    args = parser.parse_args()

    report = summarize_records(load_json(Path(args.source)))
    if args.out:
        out = Path(args.out)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["categoryRecordCount"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
