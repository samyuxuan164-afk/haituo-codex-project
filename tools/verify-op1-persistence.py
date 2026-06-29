import argparse
import json
from pathlib import Path
from typing import Any


JSON_STRING_FIELDS = {
    "productPropertyListJson",
    "mainImageListJson",
    "optionValues",
    "optionValueIds",
    "variationListStr",
    "detailMobile",
    "aeopQualificationStructListJson",
    "skuPropertyListJson",
}

SKU_KEYS = {
    "skuCode": ["skuCode", "sku", "merchantSku", "sku_code"],
    "goodsValue": ["gloGoodsValue", "goodsValue", "skuGoodsValue", "skuValue", "supplyPrice", "countrySupplyPrice"],
    "logisticValue": ["gloLogisticValue", "logisticValue", "freight", "freightPrice", "skuFreight"],
    "stock": ["sellableQuantity", "inventory", "skuStock", "stock", "skuStockNum"],
    "weight": ["packageWeight", "weight", "skuWeight"],
    "length": ["packageLength", "length", "skuLength"],
    "width": ["packageWidth", "width", "skuWidth"],
    "height": ["packageHeight", "height", "skuHeight"],
}

US_SHIP_FROM_PROPERTY_ID = "200007763"
US_SHIP_FROM_VALUE_ID = "201336106"


def load_jsonish(path: Path) -> Any:
    text = path.read_text(encoding="utf-8")
    return json.loads(text)


def parse_maybe_json(value: Any, fallback: Any = None) -> Any:
    if value is None or value == "":
        return fallback
    if not isinstance(value, str):
        return value
    text = value.strip()
    if not text or text[0] not in "[{":
        return fallback if fallback is not None else value
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return fallback if fallback is not None else value


def first_non_empty(*values: Any) -> Any:
    for value in values:
        if value is not None and value != "":
            return value
    return ""


def is_blank(value: Any) -> bool:
    return value is None or value == ""


def get_product_from_edit(edit_json: dict) -> dict:
    data = edit_json.get("data") if isinstance(edit_json, dict) else None
    if isinstance(data, dict):
        for key in ("product", "smtLocalProduct", "localProduct"):
            if isinstance(data.get(key), dict):
                return data[key]
        return data
    return {}


def find_deep_by_keys(root: Any, keys: list[str], max_depth: int = 8) -> tuple[Any, str]:
    queue: list[tuple[Any, str, int]] = [(root, "", 0)]
    seen: set[int] = set()
    while queue:
        value, path, depth = queue.pop(0)
        if not isinstance(value, (dict, list)) or depth > max_depth:
            continue
        obj_id = id(value)
        if obj_id in seen:
            continue
        seen.add(obj_id)
        if isinstance(value, dict):
            for key, child in value.items():
                child_path = f"{path}.{key}" if path else key
                if key in keys and child not in (None, ""):
                    return child, child_path
                if isinstance(child, (dict, list)):
                    queue.append((child, child_path, depth + 1))
        else:
            for index, child in enumerate(value):
                child_path = f"{path}[{index}]"
                if isinstance(child, (dict, list)):
                    queue.append((child, child_path, depth + 1))
    return None, ""


def extract_variations_from_product(product: dict, edit_json: dict) -> tuple[list[Any], str]:
    for key in ("variationListStr", "variationList", "skuList", "variations", "skuInfoList"):
        if product.get(key) not in (None, ""):
            parsed = parse_maybe_json(product.get(key), [])
            return parsed if isinstance(parsed, list) else [], f"product.{key}"
    value, path = find_deep_by_keys(edit_json, ["variationListStr", "variationList", "skuList", "variations", "skuInfoList"])
    parsed = parse_maybe_json(value, [])
    return parsed if isinstance(parsed, list) else [], path or "NOT_FOUND"


def extract_option_values(product: dict, edit_json: dict) -> tuple[Any, str]:
    for key in ("optionValues", "optionValueMap"):
        if product.get(key) not in (None, ""):
            return parse_maybe_json(product.get(key), {}), f"product.{key}"
    value, path = find_deep_by_keys(edit_json, ["optionValues", "optionValueMap"])
    return parse_maybe_json(value, {}), path or "NOT_FOUND"


def extract_option_value_ids(product: dict, edit_json: dict) -> tuple[Any, str]:
    for key in ("optionValueIds", "optionValueIdMap"):
        if product.get(key) not in (None, ""):
            return parse_maybe_json(product.get(key), {}), f"product.{key}"
    value, path = find_deep_by_keys(edit_json, ["optionValueIds", "optionValueIdMap"])
    return parse_maybe_json(value, {}), path or "NOT_FOUND"


def has_us_ship_from_on_sku(sku: dict) -> bool:
    raw = sku.get("skuPropertyListJson")
    properties = parse_maybe_json(raw, [])
    if not isinstance(properties, list):
        return False
    for item in properties:
        if not isinstance(item, dict):
            continue
        if str(item.get("sku_property_id")) == US_SHIP_FROM_PROPERTY_ID and (
            "united states" in str(item.get("sku_property_value", "")).lower()
            or str(item.get("property_value_id")) == US_SHIP_FROM_VALUE_ID
        ):
            return True
    return False


def pick_sku_value(sku: dict, logical_key: str) -> Any:
    for key in SKU_KEYS[logical_key]:
        value = sku.get(key)
        if value is not None and value != "":
            return value
    return ""


def summarize_variations(rows: list[Any]) -> dict:
    summaries = []
    for row in rows:
        sku = row if isinstance(row, dict) else {}
        item = {logical: pick_sku_value(sku, logical) for logical in SKU_KEYS}
        item["hasUsShipsFrom"] = has_us_ship_from_on_sku(sku)
        item["complete"] = all(item[key] not in (None, "") for key in SKU_KEYS) and item["hasUsShipsFrom"]
        summaries.append(item)
    return {
        "rowCount": len(summaries),
        "completeRows": sum(1 for item in summaries if item["complete"]),
        "rows": summaries,
    }


def has_us_ship_from_option(option_values: Any, option_value_ids: Any) -> bool:
    text_values = json.dumps(option_values, ensure_ascii=False).lower()
    text_ids = json.dumps(option_value_ids, ensure_ascii=False)
    return "united states" in text_values or US_SHIP_FROM_VALUE_ID in text_ids


def compare_variation_rows(before: dict, after: dict) -> list[dict]:
    issues = []
    if before["rowCount"] != after["rowCount"]:
        issues.append({"field": "variationListStr", "kind": "row_count", "expected": before["rowCount"], "actual": after["rowCount"]})
    for index, expected in enumerate(before["rows"]):
        actual = after["rows"][index] if index < len(after["rows"]) else {}
        for field in ("skuCode", "goodsValue", "logisticValue", "stock", "weight", "length", "width", "height", "hasUsShipsFrom"):
            if not is_blank(expected.get(field)) and (is_blank(actual.get(field)) or actual.get(field) is False):
                issues.append({"field": f"variationListStr[{index}].{field}", "kind": "not_persisted", "expected": expected.get(field), "actual": actual.get(field)})
    return issues


def build_report(before_payload: dict, after_edit_json: dict, save_response: dict | None = None) -> dict:
    product = get_product_from_edit(after_edit_json)
    before_variations = parse_maybe_json(before_payload.get("variationListStr"), [])
    before_summary = summarize_variations(before_variations if isinstance(before_variations, list) else [])
    after_variations, after_variation_path = extract_variations_from_product(product, after_edit_json)
    after_summary = summarize_variations(after_variations)
    option_values, option_values_path = extract_option_values(product, after_edit_json)
    option_value_ids, option_value_ids_path = extract_option_value_ids(product, after_edit_json)

    issues = compare_variation_rows(before_summary, after_summary)
    if before_payload.get("categoryId") and str(first_non_empty(product.get("categoryId"), product.get("category_id"), product.get("cateId"))) != str(before_payload.get("categoryId")):
        issues.append({
            "field": "categoryId",
            "kind": "not_persisted_or_not_found",
            "expected": before_payload.get("categoryId"),
            "actual": first_non_empty(product.get("categoryId"), product.get("category_id"), product.get("cateId")),
        })
    if not has_us_ship_from_option(option_values, option_value_ids):
        issues.append({"field": "optionValues/optionValueIds", "kind": "missing_us_ship_from", "expected": "United States", "actual": {"optionValues": option_values, "optionValueIds": option_value_ids}})

    save_success = None
    if save_response is not None:
        save_success = save_response.get("code") == 0 or str(save_response.get("code")) == "0"

    persisted = before_summary["rowCount"] > 0 and after_summary["rowCount"] == before_summary["rowCount"] and after_summary["completeRows"] == before_summary["completeRows"] == before_summary["rowCount"] and not issues
    return {
        "productId": str(first_non_empty(before_payload.get("id"), product.get("id"), product.get("productId"))),
        "saveResponseSuccess": save_success,
        "dxmState": product.get("dxmState"),
        "dxmOfflineState": product.get("dxmOfflineState"),
        "sourcePaths": {
            "afterVariations": after_variation_path,
            "afterOptionValues": option_values_path,
            "afterOptionValueIds": option_value_ids_path,
        },
        "beforePayload": {
            "categoryId": before_payload.get("categoryId"),
            "postageId": before_payload.get("postageId"),
            "variationSummary": before_summary,
        },
        "afterEditJson": {
            "categoryId": first_non_empty(product.get("categoryId"), product.get("category_id"), product.get("cateId")),
            "postageId": first_non_empty(product.get("postageId"), product.get("freightTemplateId"), product.get("shippingTemplateId")),
            "variationSummary": after_summary,
            "hasUsShipFromOption": has_us_ship_from_option(option_values, option_value_ids),
        },
        "issues": issues,
        "persisted": persisted,
        "nextAction": "op=2_publish_allowed" if persisted else "diff_schema_and_fix_plugin_before_publish",
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Verify whether save.json op=1 persisted choiceSave variation fields into edit.json.")
    parser.add_argument("--before-choice-save", required=True, help="choiceSave payload JSON before op=1.")
    parser.add_argument("--after-edit-json", required=True, help="edit.json response fetched after op=1.")
    parser.add_argument("--save-response", help="Optional save.json op=1 response JSON.")
    parser.add_argument("--out", required=True, help="Output report path.")
    args = parser.parse_args()

    before_payload = load_jsonish(Path(args.before_choice_save))
    after_edit_json = load_jsonish(Path(args.after_edit_json))
    save_response = load_jsonish(Path(args.save_response)) if args.save_response else None
    report = build_report(before_payload, after_edit_json, save_response)

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["persisted"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
