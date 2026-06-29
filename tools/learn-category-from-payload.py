import argparse
import json
import re
from pathlib import Path
from typing import Any


STOP_WORDS = {
    "for",
    "and",
    "with",
    "the",
    "this",
    "that",
    "from",
    "portable",
    "personal",
    "new",
}


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def parse_maybe_json(value: Any, fallback: Any = None) -> Any:
    if value in (None, ""):
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


def extract_choice_payload(source: Any) -> dict:
    if isinstance(source, dict) and "records" in source:
        records = source.get("records") or []
        for record in reversed(records):
            payload = (
                record.get("request", {})
                .get("body", {})
                .get("choiceSaveJson")
            )
            if isinstance(payload, dict) and payload.get("categoryId"):
                return payload
        raise ValueError("No choiceSaveJson with categoryId found in V3 records")
    if isinstance(source, dict) and source.get("categoryId"):
        return source
    raise ValueError("Input must be V3 export JSON or choiceSave JSON with categoryId")


def tokenize(text: str) -> list[str]:
    words = re.findall(r"[a-zA-Z][a-zA-Z0-9+-]{2,}", text.lower())
    result = []
    seen = set()
    for word in words:
        if word in STOP_WORDS:
            continue
        if word not in seen:
            seen.add(word)
            result.append(word)
    return result[:16]


def source_terms(edit_json: dict | None, payload: dict) -> dict:
    product = None
    if isinstance(edit_json, dict):
        data = edit_json.get("data")
        if isinstance(data, dict):
            product = data.get("product") or data.get("smtLocalProduct") or data.get("localProduct") or data
    product = product if isinstance(product, dict) else {}
    subject = payload.get("subject") or product.get("subject") or ""
    category_text = " ".join(
        str(value or "")
        for value in [
            payload.get("fullCid"),
            product.get("sourceCategoryId"),
            product.get("categoryName"),
            product.get("categoryNameZh"),
            product.get("platformCategoryId"),
        ]
    )
    return {
        "subject": subject,
        "titleTokens": tokenize(subject),
        "sourceCategoryText": category_text.strip(),
        "sourceCategoryTokens": tokenize(category_text),
        "sourceUrl": payload.get("sourceUrl") or product.get("sourceUrl") or "",
    }


def build_rule(payload: dict, edit_json: dict | None, evidence: str) -> dict:
    category_id = str(payload.get("categoryId") or "")
    if not category_id:
        raise ValueError("Payload has no categoryId")
    properties = parse_maybe_json(payload.get("productPropertyListJson"), [])
    terms = source_terms(edit_json, payload)
    title_tokens = terms["titleTokens"]
    source_tokens = terms["sourceCategoryTokens"]
    rule_id_terms = "-".join(title_tokens[:3]) if title_tokens else category_id
    return {
        "id": f"{rule_id_terms}-{category_id}",
        "status": "candidate",
        "categoryId": category_id,
        "categoryPath": "",
        "match": {
            "anyTitleTerms": title_tokens,
            "anySourceCategoryTerms": source_tokens,
            "sourceCategoryText": terms["sourceCategoryText"],
        },
        "defaults": {
            "productPropertyListJson": properties if isinstance(properties, list) else [],
        },
        "evidence": [evidence],
        "sourceSample": {
            "subject": terms["subject"],
            "sourceUrl": terms["sourceUrl"],
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Create a category resolver learned-rule candidate from a captured save payload.")
    parser.add_argument("--payload", required=True, help="V3 export JSON or choiceSave.pretty.json with selected category.")
    parser.add_argument("--edit-json", help="Optional edit.json sample for source category terms.")
    parser.add_argument("--out", required=True, help="Output learned rule candidate JSON.")
    args = parser.parse_args()

    payload_path = Path(args.payload)
    payload = extract_choice_payload(load_json(payload_path))
    edit_json = load_json(Path(args.edit_json)) if args.edit_json else None
    rule = build_rule(payload, edit_json, str(payload_path))

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(rule, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(rule, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
