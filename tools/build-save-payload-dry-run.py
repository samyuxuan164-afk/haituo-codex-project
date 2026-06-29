import argparse
import json
import zipfile
from pathlib import Path


PAYLOAD_FIELDS = [
    "shopId",
    "categoryId",
    "subject",
    "sourceUrl",
    "fullCid",
    "productPropertyListJson",
    "mainImageListJson",
    "imgUrl",
    "marketImage2",
    "marketImage1",
    "videoListJson",
    "optionValues",
    "productUnit",
    "packageType",
    "lotNum",
    "supportCountrySupplyPrice",
    "variationListStr",
    "sizeChartId",
    "detailMobile",
    "detailWeb",
    "sizeChartIdListJson",
    "deliveryTime",
    "postageId",
    "aeopQualificationStructListJson",
    "manufactureId",
    "msrEuId",
    "msrTrId",
    "op",
    "id",
    "currencyCode",
    "dxmState",
    "productId",
]

RISK_FIELDS = {
    "id": "草稿产品 ID，必须对应当前有效草稿产品，不能跨产品复用。",
    "mainImageListJson": "图片已上传到 wxalbum 后的 URL 列表，跨产品复用会错图。",
    "imgUrl": "图片管道分隔 URL，必须与 mainImageListJson 一致。",
    "marketImage1": "营销/市场图，可能由页面生成。",
    "marketImage2": "营销/市场图，可能由页面生成。",
    "variationListStr": "SKU、价格、库存、重量、尺寸核心字段，错误会影响商品发布。",
    "postageId": "物流模板 ID，需确认店铺有效。",
    "aeopQualificationStructListJson": "合规字段，错误可能导致发布失败或违规。",
    "detailMobile": "移动端详情 JSON，包含图片和描述。",
    "detailWeb": "PC 详情 HTML，包含图片和描述。",
}


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def normalize_payload(payload: dict) -> dict:
    normalized = {}
    for field in PAYLOAD_FIELDS:
        normalized[field] = payload.get(field)
    extra = sorted(set(payload) - set(PAYLOAD_FIELDS))
    if extra:
        normalized["_extraFields"] = {field: payload[field] for field in extra}
    return normalized


def build_from_payload(sample: dict, overrides: dict | None = None) -> dict:
    payload = normalize_payload(sample)
    if overrides:
        for key, value in overrides.items():
            payload[key] = value
    return payload


def build_from_edit_json(edit_json: dict, template_payload: dict) -> dict:
    """Conservative first pass: map only fields that are directly visible.

    This intentionally keeps template fields for risky derived values until we
    have more samples. It is for dry-run diffing, not live submission.
    """
    data = edit_json.get("data") if isinstance(edit_json, dict) else None
    product = (data or {}).get("product") if isinstance(data, dict) else None
    if not isinstance(product, dict):
        raise ValueError("edit_json must contain data.product")

    payload = normalize_payload(template_payload)
    direct_map = {
        "id": "id",
        "shopId": "shopId",
        "categoryId": "categoryId",
        "subject": "subject",
        "sourceUrl": "sourceUrl",
        "fullCid": "fullCid",
        "currencyCode": "currencyCode",
        "dxmState": "dxmState",
        "productId": "productId",
        "productUnit": "productUnit",
        "packageType": "packageType",
        "lotNum": "lotNum",
        "deliveryTime": "deliveryTime",
        "postageId": "postageId",
    }
    for target, source in direct_map.items():
        if source in product:
            payload[target] = product.get(source)
    return payload


def write_choice_zip(payload: dict, output_dir: Path) -> dict:
    output_dir.mkdir(parents=True, exist_ok=True)
    choice_text = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    choice_path = output_dir / "choiceSave.txt"
    pretty_path = output_dir / "choiceSave.pretty.json"
    zip_path = output_dir / "choiceSave.zip"
    manifest_path = output_dir / "formdata-manifest.json"

    choice_path.write_text(choice_text, encoding="utf-8")
    pretty_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.write(choice_path, arcname="choiceSave.txt")

    manifest = {
        "dryRun": True,
        "submit": False,
        "endpoint": "/api/smtlocalProduct/save.json",
        "method": "POST",
        "formData": [
            {
                "name": "file",
                "fileName": "blob",
                "type": "application/zip",
                "path": str(zip_path),
                "size": zip_path.stat().st_size,
            },
            {"name": "op", "value": "2"},
        ],
        "riskFields": RISK_FIELDS,
    }
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    return {
        "choiceSave": str(choice_path),
        "pretty": str(pretty_path),
        "zip": str(zip_path),
        "manifest": str(manifest_path),
        "zipSize": zip_path.stat().st_size,
        "payloadSize": len(choice_text.encode("utf-8")),
        "fields": list(payload.keys()),
    }


def parse_overrides(values: list[str]) -> dict:
    overrides = {}
    for item in values:
        if "=" not in item:
            raise ValueError(f"Invalid override: {item}")
        key, value = item.split("=", 1)
        try:
            overrides[key] = json.loads(value)
        except json.JSONDecodeError:
            overrides[key] = value
    return overrides


def main() -> int:
    parser = argparse.ArgumentParser(description="Build dry-run save.json payload zip without submitting.")
    parser.add_argument("--sample-payload", required=True, help="Path to known choiceSave payload JSON.")
    parser.add_argument("--edit-json", help="Optional edit.json response to map direct fields from.")
    parser.add_argument("--out", required=True, help="Output directory.")
    parser.add_argument("--set", action="append", default=[], help="Override field as key=json_or_text.")
    args = parser.parse_args()

    sample = load_json(Path(args.sample_payload))
    overrides = parse_overrides(args.set)
    if args.edit_json:
        payload = build_from_edit_json(load_json(Path(args.edit_json)), sample)
        if overrides:
            payload.update(overrides)
    else:
        payload = build_from_payload(sample, overrides)

    result = write_choice_zip(payload, Path(args.out))
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
