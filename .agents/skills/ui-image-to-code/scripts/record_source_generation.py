#!/usr/bin/env python3
"""Record which compiled UI evidence generated the current production source."""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path


DEFAULT_SOURCES = ["index.html", "styles.css", "app.js"]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("target", type=Path)
    parser.add_argument("--source", action="append", default=[], help="Production source path relative to target")
    parser.add_argument("--spec", action="append", default=[], help="Compiled UI spec path relative to target")
    parser.add_argument("--interaction-spec", action="append", default=[], help="Compiled interaction spec path relative to target")
    parser.add_argument("--generator", default="codex", help="Generator identity")
    parser.add_argument("--force", action="store_true")
    return parser.parse_args()


def now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def resolve_inside(target: Path, relative: str) -> Path:
    path = (target / relative).resolve()
    path.relative_to(target)
    return path


def file_entry(target: Path, relative: str) -> dict[str, str | int]:
    path = resolve_inside(target, relative)
    raw = path.read_bytes()
    return {
        "path": str(path.relative_to(target)).replace("\\", "/"),
        "sha256": hashlib.sha256(raw).hexdigest(),
        "bytes": len(raw),
    }


def main() -> int:
    args = parse_args()
    target = args.target.resolve()
    marker = target / ".ui-job" / "source-generation.json"
    if marker.exists() and not args.force:
        print(f"Record source generation: FAIL - marker exists: {marker}; use --force to replace it", file=sys.stderr)
        return 1
    try:
        source_entries = [file_entry(target, item) for item in (args.source or DEFAULT_SOURCES)]
        spec_entries = [file_entry(target, item) for item in args.spec]
        interaction_entries = [file_entry(target, item) for item in args.interaction_spec]
        if not spec_entries:
            raise ValueError("at least one --spec is required")
    except (OSError, ValueError) as error:
        print(f"Record source generation: FAIL - {error}", file=sys.stderr)
        return 1

    marker.parent.mkdir(parents=True, exist_ok=True)
    document = {
        "schemaVersion": 1,
        "status": "generated",
        "generatedAt": now(),
        "generator": args.generator,
        "sourceFiles": source_entries,
        "compiledUiSpecs": spec_entries,
        "compiledInteractionSpecs": interaction_entries,
        "browserVerified": False,
        "studioAppliedRevision": 0,
    }
    marker.write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("Record source generation: PASS")
    print(f"Marker: {marker}")
    print(f"Sources: {len(source_entries)}; UI specs: {len(spec_entries)}; interaction specs: {len(interaction_entries)}")
    print("Next: run browser journey QA, install/verify Studio when required, then run the delivery gate.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
