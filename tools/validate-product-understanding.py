#!/usr/bin/env python3
"""Validate DeepSeek Product Understanding JSON before edit-page use."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
SCHEMA_PATH = ROOT / "skills" / "product-understanding" / "schema.json"


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def as_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def collect_text(value: Any) -> str:
    if isinstance(value, dict):
        return " ".join(collect_text(item) for item in value.values())
    if isinstance(value, list):
        return " ".join(collect_text(item) for item in value)
    return str(value or "")


def validate_pu(doc: Any, schema: dict[str, Any]) -> dict[str, Any]:
    errors: list[str] = []
    warnings: list[str] = []
    normalized: dict[str, Any] = {}

    if not isinstance(doc, dict):
        return {
            "passed": False,
            "errors": ["output_not_json_object"],
            "warnings": [],
            "allowedForEditPage": False,
            "normalized": {},
        }

    for key in schema["requiredTopLevelKeys"]:
        if key not in doc:
            errors.append(f"missing_top_level_key:{key}")

    if doc.get("schemaVersion") != schema["schemaVersion"]:
        errors.append(f"schema_version_mismatch:{doc.get('schemaVersion')}")

    text = collect_text(doc).lower()
    for term in schema["forbiddenOutputTerms"]:
        if term.lower() in text:
            errors.append(f"forbidden_publish_advice:{term}")

    category = doc.get("recommendedCategory")
    if not isinstance(category, dict):
        errors.append("recommendedCategory_not_object")
        category = {}
    else:
        for key in schema["recommendedCategory"]["requiredKeys"]:
            if key not in category:
                errors.append(f"missing_recommendedCategory_key:{key}")
        if as_float(category.get("confidence")) < as_float(schema["recommendedCategory"]["minConfidenceForEditUse"]):
            errors.append("category_confidence_below_threshold")
        if not isinstance(category.get("searchTerms"), list) or not category.get("searchTerms"):
            errors.append("category_searchTerms_empty")
        if not isinstance(category.get("evidence"), list) or not category.get("evidence"):
            errors.append("category_evidence_empty")

    attributes = doc.get("attributes")
    if not isinstance(attributes, list):
        errors.append("attributes_not_array")
        attributes = []
    for index, attr in enumerate(attributes):
        if not isinstance(attr, dict):
            errors.append(f"attribute_not_object:{index}")
            continue
        for key in schema["attributeItem"]["requiredKeys"]:
            if key not in attr:
                errors.append(f"missing_attribute_key:{index}:{key}")
        if as_float(attr.get("confidence")) < 0.7:
            warnings.append(f"attribute_low_confidence:{index}:{attr.get('name', '')}")

    risks = doc.get("risks")
    if not isinstance(risks, list):
        errors.append("risks_not_array")
        risks = []
    for index, risk in enumerate(risks):
        if not isinstance(risk, dict):
            errors.append(f"risk_not_object:{index}")
            continue
        for key in schema["riskItem"]["requiredKeys"]:
            if key not in risk:
                errors.append(f"missing_risk_key:{index}:{key}")
        level = str(risk.get("level", "")).lower()
        if level not in schema["riskItem"]["allowedLevels"]:
            errors.append(f"risk_level_invalid:{index}:{level}")
        if level == "blocker":
            errors.append(f"blocker_risk_present:{index}:{risk.get('type', '')}")

    rule_engine = doc.get("ruleEngine")
    if not isinstance(rule_engine, dict):
        errors.append("ruleEngine_not_object")
        rule_engine = {}
    else:
        for key in schema["ruleEngine"]["requiredKeys"]:
            if key not in rule_engine:
                errors.append(f"missing_ruleEngine_key:{key}")
        if rule_engine.get("allowedForEditPage") is not True:
            errors.append("ruleEngine_not_allowed_for_edit_page")

    allowed = not errors
    normalized = {
        "asin": doc.get("asin", ""),
        "productType": doc.get("productType", ""),
        "primaryUse": doc.get("primaryUse", ""),
        "recommendedCategory": category,
        "attributes": attributes,
        "risks": risks,
        "confidence": as_float(doc.get("confidence")),
        "allowedForEditPage": allowed,
    }
    return {
        "passed": allowed,
        "errors": sorted(set(errors)),
        "warnings": warnings,
        "allowedForEditPage": allowed,
        "normalized": normalized if allowed else {},
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate Product Understanding JSON.")
    parser.add_argument("input", help="Path to Product Understanding JSON output.")
    parser.add_argument("--schema", default=str(SCHEMA_PATH), help="Path to schema JSON.")
    args = parser.parse_args()

    schema = load_json(Path(args.schema))
    doc = load_json(Path(args.input))
    result = validate_pu(doc, schema)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
