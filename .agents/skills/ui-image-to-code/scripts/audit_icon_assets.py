#!/usr/bin/env python3
"""Audit production sources and write the mandatory independent SVG icon inventory."""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path


SVG_PATTERN = re.compile(r"<svg\b(?P<attrs>[^>]*)>", re.IGNORECASE)
ICON_CALL_PATTERN = re.compile(r"\biconSvg\(\s*([\"'])(?P<name>[^\"']+)\1\s*,\s*([\"'])(?P<id>[^\"']+)\3", re.IGNORECASE)
UI_ID_PATTERN = re.compile(r"\bdata-ui-id\s*=\s*([\"'])(?P<value>[^\"']+)\1", re.IGNORECASE)
FAMILY_PATTERN = re.compile(r"\bdata-icon-family\s*=\s*([\"'])(?P<value>[^\"']+)\1", re.IGNORECASE)
SUSPICIOUS_UNICODE = set("⌂⠿▣◷▱◫⌘♧▧◯▤♢◇◈◔♥▶🎁♙")
EMOJI_PATTERN = re.compile("[\U0001F300-\U0001FAFF]")


def now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("target", type=Path)
    parser.add_argument("--source", action="append", default=[])
    parser.add_argument("--family", default="project-svg")
    args = parser.parse_args()
    target = args.target.resolve()
    relative_sources = args.source or ["index.html", "app.js"]
    errors: list[str] = []
    items: list[dict[str, str]] = []
    seen: set[str] = set()
    for relative in relative_sources:
        source = (target / relative).resolve()
        try:
            source.relative_to(target)
            text = source.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError, ValueError) as error:
            errors.append(f"cannot read source {relative}: {error}")
            continue
        suspects = (set(text) & SUSPICIOUS_UNICODE) | set(EMOJI_PATTERN.findall(text))
        if suspects:
            errors.append(f"Unicode/Emoji product icons are forbidden in {relative}: {' '.join(sorted(suspects))}")
        for match in SVG_PATTERN.finditer(text):
            attrs = match.group("attrs")
            identity = UI_ID_PATTERN.search(attrs)
            if not identity:
                errors.append(f"SVG in {relative} has no data-ui-id")
                continue
            icon_id = identity.group("value").strip()
            if "${" in icon_id:
                continue
            if icon_id in seen:
                errors.append(f"duplicate SVG data-ui-id: {icon_id}")
                continue
            seen.add(icon_id)
            family_match = FAMILY_PATTERN.search(attrs)
            items.append({
                "id": icon_id,
                "sourceFile": relative,
                "assetType": "svg",
                "family": family_match.group("value").strip() if family_match else args.family,
                "status": "verified",
            })
        for match in ICON_CALL_PATTERN.finditer(text):
            icon_id = match.group("id").strip()
            if icon_id in seen:
                continue
            seen.add(icon_id)
            items.append({
                "id": icon_id,
                "sourceFile": relative,
                "assetType": "svg",
                "family": args.family,
                "status": "verified",
            })
    if not items:
        errors.append("no independent svg[data-ui-id] product icons were found")
    families = {item["family"] for item in items}
    if len(families) > 1:
        errors.append("mixed icon families found: " + ", ".join(sorted(families)))
    document = {
        "schemaVersion": 1,
        "status": "passed" if not errors else "failed",
        "checkedAt": now(),
        "items": items,
        "errors": errors,
    }
    output = target / ".ui-job" / "icon-inventory.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("Icon asset audit: " + ("PASS" if not errors else "FAIL"))
    for error in errors:
        print(f"- {error}", file=sys.stderr)
    return 0 if not errors else 1


if __name__ == "__main__":
    raise SystemExit(main())
