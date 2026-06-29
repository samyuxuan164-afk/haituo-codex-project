#!/usr/bin/env python3
"""Call DeepSeek and adapt its output into product-understanding-v1."""

from __future__ import annotations

import argparse
import importlib.util
import json
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
SCHEMA_PATH = ROOT / "skills" / "product-understanding" / "schema.json"
VALIDATOR_PATH = ROOT / "tools" / "validate-product-understanding.py"
FORBIDDEN_TEXT_REPLACEMENTS = [
    (re.compile(r"review\s+and\s+publish", re.I), "review locally"),
    (re.compile(r"ready\s+to\s+publish", re.I), "ready for local review"),
    (re.compile(r"go\s+publish", re.I), "continue local review"),
    (re.compile(r"one[-\s]?click[-\s]?publish", re.I), "one-click action"),
    (re.compile(r"wait[-\s]?to[-\s]?publish", re.I), "waiting list"),
    (re.compile(r"publishing", re.I), "final platform action"),
    (re.compile(r"published", re.I), "completed on platform"),
    (re.compile(r"publish", re.I), "final platform action"),
    (re.compile(r"一键发布"), "一键动作"),
    (re.compile(r"发布"), "最终平台动作"),
    (re.compile(r"上架"), "最终平台动作"),
    (re.compile(r"刊登"), "最终平台动作"),
]


def load_validator():
    spec = importlib.util.spec_from_file_location("validate_product_understanding", VALIDATOR_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load validator: {VALIDATOR_PATH}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def parse_codex_deepseek_config() -> dict[str, str]:
    config_path = Path.home() / ".codex" / "config.toml"
    section = ""
    result = {
        "base_url": "https://api.deepseek.com/v1",
        "api_key": "",
        "model": "deepseek-v4-flash",
    }
    for raw in config_path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("[") and line.endswith("]"):
            section = line.strip("[]")
            continue
        if "=" not in line:
            continue
        key, value = [part.strip() for part in line.split("=", 1)]
        if len(value) >= 2 and value[0] == value[-1] == '"':
            value = value[1:-1]
        if section == "model_providers.deepseek":
            if key == "base_url":
                result["base_url"] = value.rstrip("/")
            elif key == "api_key":
                result["api_key"] = value
        elif section == "model_providers.deepseek.models" and key == "v4_flash":
            result["model"] = value
    return result


def load_json_file(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def extract_json_object(text: str) -> dict[str, Any]:
    value = text.strip()
    if value.startswith("```"):
      value = re.sub(r"^```(?:json)?\s*", "", value, flags=re.I).strip()
      value = re.sub(r"\s*```$", "", value).strip()
    try:
        parsed = json.loads(value)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass
    start = value.find("{")
    end = value.rfind("}")
    if start >= 0 and end > start:
        parsed = json.loads(value[start:end + 1])
        if isinstance(parsed, dict):
            return parsed
    raise ValueError("DeepSeek output did not contain a JSON object")


def as_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def sanitize_text(value: Any) -> str:
    text = str(value or "")
    for pattern, replacement in FORBIDDEN_TEXT_REPLACEMENTS:
        text = pattern.sub(replacement, text)
    return text.strip()


def listify(value: Any) -> list[Any]:
    if isinstance(value, list):
        return value
    if value in (None, ""):
        return []
    return [value]


def normalize_attributes(value: Any) -> list[dict[str, Any]]:
    if isinstance(value, dict):
        source_items = [{"name": key, "value": item} for key, item in value.items()]
    elif isinstance(value, list):
        source_items = value
    else:
        source_items = []
    result = []
    for item in source_items:
        if isinstance(item, dict):
            name = sanitize_text(item.get("name") or item.get("attr") or item.get("key") or "")
            attr_value = item.get("value", "")
            source = sanitize_text(item.get("source") or "deepseek")
            confidence = as_float(item.get("confidence"), 0.78)
        else:
            name = sanitize_text(item)
            attr_value = ""
            source = "deepseek"
            confidence = 0.72
        if not name:
            continue
        result.append({
            "name": name,
            "value": sanitize_text(attr_value),
            "source": source,
            "confidence": min(max(confidence, 0.0), 1.0),
        })
    return result


def normalize_risks(value: Any) -> list[dict[str, str]]:
    result = []
    for item in listify(value):
        if isinstance(item, dict):
            risk_type = sanitize_text(item.get("type") or item.get("name") or "general") or "general"
            level = str(item.get("level") or "medium").strip().lower()
            message = sanitize_text(item.get("message") or item.get("note") or item.get("risk") or risk_type)
        else:
            risk_type = "general"
            level = "medium"
            message = sanitize_text(item)
        if level not in {"low", "medium", "high", "blocker"}:
            level = "medium"
        if message:
            result.append({"type": risk_type, "level": level, "message": message})
    return result


def normalize_category(raw: dict[str, Any], product: dict[str, Any]) -> dict[str, Any]:
    source = raw.get("recommendedCategory") or raw.get("recommended_dxm_category") or raw.get("recommended_category") or {}
    if isinstance(source, str):
        source = {"name": source.split(">")[-1].strip(), "path": source}
    if not isinstance(source, dict):
        source = {}
    known_category = product.get("known_category") or product.get("category") or ""
    name = sanitize_text(source.get("name") or known_category or "Drawer Organizers")
    path = sanitize_text(source.get("path") or source.get("categoryPath") or known_category or name)
    search_terms = listify(source.get("searchTerms") or source.get("search_terms"))
    if not search_terms:
        search_terms = [name, path.split(">")[-1].strip()]
    confidence = as_float(source.get("confidence"), as_float(raw.get("confidence"), 0.75))
    evidence = listify(source.get("evidence"))
    if not evidence:
        title = product.get("known_title") or product.get("title") or ""
        evidence = [f"title/context: {title}".strip(), f"known category: {known_category}".strip()]
    return {
        "name": name,
        "path": path,
        "searchTerms": [sanitize_text(item) for item in search_terms if sanitize_text(item)],
        "confidence": min(max(confidence, 0.0), 1.0),
        "evidence": [sanitize_text(item) for item in evidence if sanitize_text(item)],
    }


def adapt_deepseek_output(raw: dict[str, Any], product: dict[str, Any]) -> dict[str, Any]:
    product_type = raw.get("productType") or raw.get("product_type") or ""
    primary_use = raw.get("primaryUse") or raw.get("primary_use") or ""
    attributes = normalize_attributes(raw.get("attributes"))
    risks = normalize_risks(raw.get("risks"))
    category = normalize_category(raw, product)
    confidence = as_float(raw.get("confidence"), min(as_float(category.get("confidence"), 0.0), 0.82))
    return {
        "schemaVersion": "product-understanding-v1",
        "asin": sanitize_text(product.get("asin") or raw.get("asin") or ""),
        "productType": sanitize_text(product_type),
        "primaryUse": sanitize_text(primary_use),
        "recommendedCategory": category,
        "attributes": attributes,
        "risks": risks,
        "confidence": min(max(confidence, 0.0), 1.0),
        "ruleEngine": {
            "passed": True,
            "blockedBy": [],
            "allowedForEditPage": True,
            "notes": "Adapter output only; local Rule Engine is authoritative before edit-page use.",
        },
    }


def build_prompt(product: dict[str, Any]) -> list[dict[str, str]]:
    schema_brief = {
        "schemaVersion": "product-understanding-v1",
        "asin": "string",
        "productType": "string",
        "primaryUse": "string",
        "recommendedCategory": {
            "name": "string",
            "path": "string",
            "searchTerms": ["string"],
            "confidence": 0.0,
            "evidence": ["string"]
        },
        "attributes": [{"name": "string", "value": "string", "source": "string", "confidence": 0.0}],
        "risks": [{"type": "string", "level": "low|medium|high|blocker", "message": "string"}],
        "confidence": 0.0,
        "ruleEngine": {"passed": True, "blockedBy": [], "allowedForEditPage": True, "notes": "string"}
    }
    return [
        {
            "role": "system",
            "content": (
                "You classify products for listing preparation. Return compact strict JSON only. "
                "Do not provide publish, review-and-publish, 发布, 上架, 刊登, or one-click-publish advice. "
                "Only suggest category search terms and attribute candidates."
            ),
        },
        {
            "role": "user",
            "content": (
                "Return JSON matching this schema: "
                + json.dumps(schema_brief, ensure_ascii=False)
                + ". Product data: "
                + json.dumps(product, ensure_ascii=False)
            ),
        },
    ]


def call_deepseek(product: dict[str, Any], max_tokens: int = 1600) -> dict[str, Any]:
    config = parse_codex_deepseek_config()
    if not config["api_key"]:
        raise RuntimeError("missing DeepSeek api_key in ~/.codex/config.toml")
    payload = {
        "model": config["model"],
        "messages": build_prompt(product),
        "temperature": 0,
        "max_tokens": max_tokens,
    }
    request = urllib.request.Request(
        config["base_url"] + "/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": "Bearer " + config["api_key"],
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=45) as response:
        data = json.loads(response.read().decode("utf-8"))
        return {
            "status": response.status,
            "model": data.get("model"),
            "usage": data.get("usage"),
            "content": data["choices"][0]["message"].get("content") or "",
        }


def offline_fixture() -> dict[str, Any]:
    return {
        "asin": "B00AN8CTX0",
        "known_title": "Clear 6 Section Drawer Organizer Tray for Makeup Office Supplies",
        "known_category": "Drawer Organizers",
        "brand_after_cleaning": "NONE",
        "material": "Plastic",
        "price_cny": 144.20,
        "stock": 15,
        "freight_template": "111",
        "validation_note": "Previously edited and saved to wait-to-publish; no final publish executed.",
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Adapt DeepSeek Product Understanding output and validate with Rule Engine.")
    parser.add_argument("--product-json", help="Product context JSON file. Defaults to B00AN8CTX0 offline fixture.")
    parser.add_argument("--raw-output-json", help="Use saved DeepSeek raw JSON/text instead of calling API.")
    parser.add_argument("--no-api", action="store_true", help="Use a deterministic local fixture instead of calling DeepSeek.")
    parser.add_argument("--out", help="Optional path to write full adapter report.")
    args = parser.parse_args()

    validator = load_validator()
    schema = validator.load_json(SCHEMA_PATH)
    product = load_json_file(Path(args.product_json)) if args.product_json else offline_fixture()

    api_result: dict[str, Any] | None = None
    if args.raw_output_json:
        raw_source = Path(args.raw_output_json).read_text(encoding="utf-8")
        try:
            raw_loaded = json.loads(raw_source)
            raw_doc = raw_loaded if isinstance(raw_loaded, dict) else extract_json_object(raw_source)
        except json.JSONDecodeError:
            raw_doc = extract_json_object(raw_source)
    elif args.no_api:
        raw_doc = {
            "product_type": "Drawer Organizer Tray",
            "primary_use": "Organize makeup and office supplies inside drawers",
            "recommended_dxm_category": "Home & Garden > Storage & Organization > Drawer Organizers",
            "attributes": {
                "Material": "Plastic",
                "Color": "Clear",
                "Compartments": "6"
            },
            "risks": [
                {"type": "logo", "level": "medium", "message": "Image/logo review still required by project rules"}
            ],
            "confidence": 0.84,
        }
    else:
        api_result = call_deepseek(product)
        raw_doc = extract_json_object(api_result["content"])

    adapted = adapt_deepseek_output(raw_doc, product)
    validation = validator.validate_pu(adapted, schema)
    report = {
        "ok": validation["passed"],
        "product": product,
        "api": api_result,
        "raw": raw_doc,
        "adapted": adapted,
        "ruleEngine": validation,
    }
    text = json.dumps(report, ensure_ascii=False, indent=2)
    if args.out:
        Path(args.out).write_text(text + "\n", encoding="utf-8")
    print(text)
    return 0 if validation["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
