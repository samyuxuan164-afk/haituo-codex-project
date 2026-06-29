import argparse
import json
import re
from pathlib import Path
from typing import Any


PLUGIN_RULES_RE = re.compile(
    r"(  // CATEGORY_RESOLVER_RULES is generated from skills/category-resolver/learned_rules\.json\.\n"
    r"  const CATEGORY_RESOLVER_RULES = )\[[\s\S]*?\n  \];",
    re.MULTILINE,
)


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def clean_rule(rule: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": rule.get("id") or f"category-{rule.get('categoryId', '')}",
        "status": rule.get("status", "candidate"),
        "categoryId": str(rule.get("categoryId") or ""),
        "categoryPath": rule.get("categoryPath", ""),
        "match": rule.get("match") or {},
        "defaults": rule.get("defaults") or {},
        "evidence": rule.get("evidence") or [],
    }


def to_js_literal(value: Any, indent: int = 2) -> str:
    text = json.dumps(value, ensure_ascii=False, indent=indent)
    return text.replace("</script", "<\\/script")


def main() -> int:
    parser = argparse.ArgumentParser(description="Sync category learned rules into the Tampermonkey plugin.")
    parser.add_argument("--rules", default="skills/category-resolver/learned_rules.json")
    parser.add_argument("--plugin", default="src/dianxiaomi-automation-v1-merged.user.js")
    args = parser.parse_args()

    root = Path.cwd()
    rules_path = (root / args.rules).resolve()
    plugin_path = (root / args.plugin).resolve()

    rules_doc = load_json(rules_path)
    rules = [clean_rule(rule) for rule in rules_doc.get("rules", []) if rule.get("categoryId")]
    if not rules:
      raise SystemExit(f"No category rules found in {rules_path}")

    plugin = plugin_path.read_text(encoding="utf-8")
    replacement = r"\1" + to_js_literal(rules, indent=4).replace("\n", "\n  ") + ";"
    updated, count = PLUGIN_RULES_RE.subn(replacement, plugin)
    if count != 1:
        raise SystemExit("Could not find CATEGORY_RESOLVER_RULES block in plugin")
    plugin_path.write_text(updated, encoding="utf-8", newline="")
    print(f"Synced {len(rules)} category rule(s) into {plugin_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
