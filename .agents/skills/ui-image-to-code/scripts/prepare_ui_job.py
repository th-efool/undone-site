#!/usr/bin/env python3
"""Persist a UI screenshot and initialize its position-evidence job."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import struct
import sys
from datetime import datetime, timezone
from pathlib import Path


MAX_BYTES = 12 * 1024 * 1024
ID_PATTERN = re.compile(r"[^a-z0-9-]+")
SUPPORTED_SUFFIXES = {".png", ".jpg", ".jpeg", ".webp"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("reference", type=Path, help="PNG, JPG, or WebP screenshot")
    parser.add_argument("target", type=Path, help="Target frontend project")
    parser.add_argument("--id", dest="reference_id", help="Stable evidence ID; defaults to the filename")
    parser.add_argument("--viewport", help="Observed viewport in WIDTHxHEIGHT form")
    parser.add_argument("--force", action="store_true", help="Replace an existing job with the same ID")
    return parser.parse_args()


def normalized_id(value: str) -> str:
    result = ID_PATTERN.sub("-", value.lower()).strip("-")[:80]
    if not result:
        raise ValueError("reference ID must contain a letter or digit")
    return result


def parse_viewport(value: str | None, width: int, height: int) -> tuple[int, int, str]:
    if not value:
        return width, height, "inferred-from-reference"
    match = re.fullmatch(r"\s*(\d{1,5})\s*[xX×]\s*(\d{1,5})\s*", value)
    if not match:
        raise ValueError("--viewport must use WIDTHxHEIGHT, for example 1920x919")
    viewport_width, viewport_height = map(int, match.groups())
    if viewport_width < 1 or viewport_height < 1 or viewport_width * viewport_height > 100_000_000:
        raise ValueError("viewport dimensions are out of range")
    return viewport_width, viewport_height, "observed"


def png_dimensions(data: bytes) -> tuple[int, int]:
    if len(data) < 24 or data[:8] != b"\x89PNG\r\n\x1a\n" or data[12:16] != b"IHDR":
        raise ValueError("invalid PNG")
    return struct.unpack(">II", data[16:24])


def jpeg_dimensions(data: bytes) -> tuple[int, int]:
    if len(data) < 4 or data[:2] != b"\xff\xd8":
        raise ValueError("invalid JPEG")
    offset = 2
    start_of_frame = {0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF}
    while offset + 3 < len(data):
        while offset < len(data) and data[offset] != 0xFF:
            offset += 1
        while offset < len(data) and data[offset] == 0xFF:
            offset += 1
        if offset >= len(data):
            break
        marker = data[offset]
        offset += 1
        if marker in {0xD8, 0xD9} or 0xD0 <= marker <= 0xD7:
            continue
        if offset + 2 > len(data):
            break
        length = struct.unpack(">H", data[offset:offset + 2])[0]
        if length < 2 or offset + length > len(data):
            break
        if marker in start_of_frame:
            if length < 7:
                break
            height, width = struct.unpack(">HH", data[offset + 3:offset + 7])
            return width, height
        offset += length
    raise ValueError("JPEG dimensions were not found")


def webp_dimensions(data: bytes) -> tuple[int, int]:
    if len(data) < 30 or data[:4] != b"RIFF" or data[8:12] != b"WEBP":
        raise ValueError("invalid WebP")
    chunk = data[12:16]
    payload = data[20:]
    if chunk == b"VP8X" and len(payload) >= 10:
        width = 1 + int.from_bytes(payload[4:7], "little")
        height = 1 + int.from_bytes(payload[7:10], "little")
        return width, height
    if chunk == b"VP8L" and len(payload) >= 5 and payload[0] == 0x2F:
        bits = int.from_bytes(payload[1:5], "little")
        return (bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1
    if chunk == b"VP8 ":
        marker = payload.find(b"\x9d\x01\x2a")
        if marker >= 0 and marker + 7 <= len(payload):
            width, height = struct.unpack("<HH", payload[marker + 3:marker + 7])
            return width & 0x3FFF, height & 0x3FFF
    raise ValueError("WebP dimensions were not found")


def image_dimensions(path: Path) -> tuple[int, int]:
    data = path.read_bytes()
    suffix = path.suffix.lower()
    if suffix == ".png":
        dimensions = png_dimensions(data)
    elif suffix in {".jpg", ".jpeg"}:
        dimensions = jpeg_dimensions(data)
    elif suffix == ".webp":
        dimensions = webp_dimensions(data)
    else:
        raise ValueError("only PNG, JPG, and WebP screenshots are supported")
    width, height = dimensions
    if width < 1 or height < 1 or width * height > 100_000_000:
        raise ValueError("image dimensions are out of range")
    return width, height


def main() -> int:
    args = parse_args()
    reference = args.reference.resolve()
    target = args.target.resolve()
    try:
        if not reference.is_file():
            raise ValueError(f"reference does not exist: {reference}")
        if reference.suffix.lower() not in SUPPORTED_SUFFIXES:
            raise ValueError("only PNG, JPG, and WebP screenshots are supported")
        size = reference.stat().st_size
        if size < 1 or size > MAX_BYTES:
            raise ValueError("reference must be between 1 byte and 12MB")
        contract_path = target / ".ui-job" / "job-contract.json"
        if not contract_path.is_file():
            raise ValueError(
                "missing mandatory .ui-job/job-contract.json; run prepare_ui_contract.py before creating evidence"
            )
        contract = json.loads(contract_path.read_text(encoding="utf-8"))
        if not isinstance(contract, dict) or contract.get("schemaVersion") != 1 or contract.get("status") != "ready":
            raise ValueError("UI job contract must be a ready schemaVersion 1 document")
        width, height = image_dimensions(reference)
        viewport_width, viewport_height, viewport_status = parse_viewport(args.viewport, width, height)
        reference_id = normalized_id(args.reference_id or reference.stem)
    except (OSError, ValueError) as error:
        print(f"Prepare UI job: FAIL - {error}", file=sys.stderr)
        return 1

    evidence_dir = target / "artifacts" / "ui-evidence"
    references_dir = evidence_dir / "references"
    map_path = evidence_dir / f"{reference_id}.json"
    suffix = ".jpg" if reference.suffix.lower() == ".jpeg" else reference.suffix.lower()
    stored_reference = references_dir / f"{reference_id}{suffix}"
    if not args.force and (map_path.exists() or stored_reference.exists()):
        print(f"Prepare UI job: FAIL - job already exists: {reference_id}; use --force to replace it", file=sys.stderr)
        return 1

    references_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(reference, stored_reference)
    relative_reference = stored_reference.relative_to(target).as_posix()
    created_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    document = {
        "schemaVersion": 1,
        "status": "draft",
        "contract": {
            "path": contract_path.relative_to(target).as_posix(),
            "sha256": hashlib.sha256(contract_path.read_bytes()).hexdigest(),
        },
        "reference": {
            "id": reference_id,
            "name": reference.name,
            "path": relative_reference,
            "width": width,
            "height": height,
            "viewport": {
                "width": viewport_width,
                "height": viewport_height,
                "status": viewport_status,
            },
        },
        "nodes": [
            {
                "id": "page.root",
                "name": "Page root",
                "type": "page",
                "parentId": None,
                "bounds": {"x": 0, "y": 0, "width": width, "height": height},
                "layout": {"mode": "flow", "role": "page-shell"},
                "anchors": ["viewport.left", "viewport.top", "viewport.right", "viewport.bottom"],
                "confidence": {"level": "observed", "score": 1, "sources": ["image-dimensions"]},
            }
        ],
        "tokens": {"colors": {}, "spacing": {}, "radii": {}, "typography": {}},
        "unresolved": [
            {
                "id": "map-major-regions",
                "severity": "blocking",
                "message": "Map the major regions and atomic visible elements before setting status to ready.",
            }
        ],
        "workflow": {"stage": "position-evidence", "createdAt": created_at, "updatedAt": created_at},
    }
    map_path.write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print("Prepare UI job: PASS")
    print(f"Reference: {width}x{height} -> {relative_reference}")
    print(f"Evidence draft: {map_path}")
    print("Next: map regions and atomic elements, remove blocking unresolved items, set status to ready, then run validate_evidence_map.py.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
