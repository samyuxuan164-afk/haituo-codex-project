import base64
import io
import json
import sys
import zipfile
from pathlib import Path


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: python analyze-v2-save-json.py <dxm-interface-v2-records.json> [output_dir]")
        return 2

    source = Path(sys.argv[1])
    output_dir = Path(sys.argv[2]) if len(sys.argv) >= 3 else source.with_suffix("")
    output_dir.mkdir(parents=True, exist_ok=True)

    data = json.loads(source.read_text(encoding="utf-8"))
    save_records = [
        record
        for record in data.get("records", [])
        if "/api/smtlocalProduct/save.json" in record.get("url", "")
    ]

    summary = {
        "source": str(source),
        "saveRecordCount": len(save_records),
        "items": [],
    }

    for index, record in enumerate(save_records, start=1):
        fields = record.get("requestBodyFields") or []
        file_field = next((field for field in fields if field.get("name") == "file"), None)
        op_field = next((field for field in fields if field.get("name") == "op"), None)
        item = {
            "index": index,
            "createdAt": record.get("createdAt"),
            "page": record.get("page"),
            "op": op_field.get("value") if op_field else None,
            "file": None,
            "payloadKeys": [],
        }
        if not file_field:
            item["error"] = "No file field found"
            summary["items"].append(item)
            continue

        preview = file_field.get("base64Preview") or {}
        b64 = preview.get("base64")
        item["file"] = {
            "fileName": file_field.get("fileName"),
            "type": file_field.get("type"),
            "size": file_field.get("size"),
            "capturedBytes": preview.get("capturedBytes"),
            "truncated": preview.get("truncated"),
        }
        if not b64:
            item["error"] = "No base64Preview found"
            summary["items"].append(item)
            continue

        raw = base64.b64decode(b64)
        item_dir = output_dir / f"save-{index}"
        item_dir.mkdir(parents=True, exist_ok=True)
        (item_dir / "save-file.zip").write_bytes(raw)

        with zipfile.ZipFile(io.BytesIO(raw)) as archive:
            item["zipNames"] = archive.namelist()
            for name in archive.namelist():
                content = archive.read(name)
                target = item_dir / name
                target.write_bytes(content)
                try:
                    text = content.decode("utf-8")
                except UnicodeDecodeError:
                    text = content.decode("utf-8", "replace")
                if name.endswith(".txt"):
                    (item_dir / f"{Path(name).stem}.pretty.json").write_text(
                        json.dumps(json.loads(text), ensure_ascii=False, indent=2),
                        encoding="utf-8",
                    )
                    item["payloadKeys"] = list(json.loads(text).keys())

        summary["items"].append(item)

    (output_dir / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
