#!/usr/bin/env python3
"""Validate the position-evidence gate used before screenshot-to-UI generation."""

from __future__ import annotations

import argparse
import json
import math
import re
import sys
from pathlib import Path


ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.:-]{0,159}$")
NODE_TYPES = {"page", "frame", "section", "menu", "text", "icon", "image", "control", "divider", "unknown"}
CONFIDENCE_LEVELS = {"observed", "strong-inference", "assumption"}


def fail(message: str) -> None:
    raise ValueError(message)


def finite_number(value: object) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def validate(document: object, allow_draft: bool = False) -> tuple[int, int]:
    if not isinstance(document, dict):
        fail("Evidence map must be a JSON object")
    if document.get("schemaVersion") != 1:
        fail("schemaVersion must be 1")
    status = document.get("status")
    if status not in {"draft", "ready"}:
        fail("status must be draft or ready")
    if status != "ready" and not allow_draft:
        fail("evidence map is still draft; finish mapping and set status to ready")

    reference = document.get("reference")
    if not isinstance(reference, dict):
        fail("reference must be an object")
    reference_path = reference.get("path")
    if not isinstance(reference_path, str) or not reference_path or reference_path.startswith(("/", "\\")) or ".." in Path(reference_path).parts:
        fail("reference.path must be a constrained project-relative path")
    width, height = reference.get("width"), reference.get("height")
    if not isinstance(width, int) or isinstance(width, bool) or width < 1:
        fail("reference.width must be a positive integer")
    if not isinstance(height, int) or isinstance(height, bool) or height < 1:
        fail("reference.height must be a positive integer")
    if width * height > 100_000_000:
        fail("reference dimensions exceed the 100 million pixel limit")

    nodes = document.get("nodes")
    if not isinstance(nodes, list) or not nodes:
        fail("nodes must be a non-empty array")

    ids: set[str] = set()
    parents: dict[str, str | None] = {}
    root_count = 0
    non_page_count = 0
    for index, node in enumerate(nodes):
        prefix = f"nodes[{index}]"
        if not isinstance(node, dict):
            fail(f"{prefix} must be an object")
        node_id = node.get("id")
        if not isinstance(node_id, str) or not ID_PATTERN.fullmatch(node_id):
            fail(f"{prefix}.id is invalid")
        if node_id in ids:
            fail(f"duplicate node id: {node_id}")
        ids.add(node_id)

        node_type = node.get("type")
        if node_type not in NODE_TYPES:
            fail(f"{node_id}.type is invalid")
        parent_id = node.get("parentId")
        if parent_id is not None and (not isinstance(parent_id, str) or not ID_PATTERN.fullmatch(parent_id)):
            fail(f"{node_id}.parentId is invalid")
        parents[node_id] = parent_id
        if node_type == "page" and parent_id is None:
            root_count += 1
        if node_type != "page":
            non_page_count += 1

        bounds = node.get("bounds")
        if not isinstance(bounds, dict):
            fail(f"{node_id}.bounds must be an object")
        for key in ("x", "y", "width", "height"):
            if not finite_number(bounds.get(key)):
                fail(f"{node_id}.bounds.{key} must be finite")
        x, y = float(bounds["x"]), float(bounds["y"])
        node_width, node_height = float(bounds["width"]), float(bounds["height"])
        if node_width < 1 or node_height < 1:
            fail(f"{node_id} must have positive bounds")
        if x < 0 or y < 0 or x + node_width > width + 0.5 or y + node_height > height + 0.5:
            fail(f"{node_id} bounds exceed the reference")

        confidence = node.get("confidence")
        if not isinstance(confidence, dict):
            fail(f"{node_id}.confidence must be an object")
        if confidence.get("level") not in CONFIDENCE_LEVELS:
            fail(f"{node_id}.confidence.level is invalid")
        score = confidence.get("score")
        if not finite_number(score) or not 0 <= float(score) <= 1:
            fail(f"{node_id}.confidence.score must be between 0 and 1")
        sources = confidence.get("sources")
        if not isinstance(sources, list) or not sources or not all(isinstance(item, str) and item.strip() for item in sources):
            fail(f"{node_id}.confidence.sources must contain evidence labels")

    if root_count < 1:
        fail("at least one root page node is required")
    if status == "ready" and non_page_count < 1:
        fail("a ready evidence map must include at least one non-page node")
    for node_id, parent_id in parents.items():
        if parent_id is not None and parent_id not in ids:
            fail(f"{node_id} refers to missing parent {parent_id}")

    for node_id in ids:
        seen: set[str] = set()
        cursor: str | None = node_id
        while cursor is not None:
            if cursor in seen:
                fail(f"parent cycle detected at {node_id}")
            seen.add(cursor)
            cursor = parents.get(cursor)

    unresolved = document.get("unresolved", [])
    if not isinstance(unresolved, list):
        fail("unresolved must be an array")
    if status == "ready" and any(isinstance(item, dict) and item.get("severity") == "blocking" for item in unresolved):
        fail("ready evidence maps cannot contain blocking unresolved items")
    return len(nodes), len(unresolved)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("map", type=Path, help="Path to the evidence-map JSON file")
    parser.add_argument("--allow-draft", action="store_true", help="Validate structure without opening the generation gate")
    args = parser.parse_args()
    try:
        payload = json.loads(args.map.read_text(encoding="utf-8"))
        node_count, unresolved_count = validate(payload, allow_draft=args.allow_draft)
    except (OSError, json.JSONDecodeError, ValueError) as error:
        print(f"Evidence map: FAIL - {error}", file=sys.stderr)
        return 1
    print(f"Evidence map: PASS ({node_count} nodes, {unresolved_count} unresolved)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
