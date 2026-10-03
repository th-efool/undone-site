#!/usr/bin/env python3
"""Compile a ready position-evidence map into a deterministic UI generation spec."""

from __future__ import annotations

import argparse
import json
import statistics
import sys
from pathlib import Path

from validate_evidence_map import validate


LAYOUT_MODES = {"row", "column", "grid", "free"}
ATOMIC_TYPES = {"text", "icon", "image", "control", "divider"}


def rounded(value: float, digits: int = 6) -> float:
    result = round(float(value), digits)
    return 0.0 if result == -0.0 else result


def average(values: list[float]) -> float | None:
    return rounded(sum(values) / len(values), 2) if values else None


def bands(values: list[float], tolerance: float) -> list[list[float]]:
    groups: list[list[float]] = []
    for value in sorted(values):
        if not groups or value - statistics.mean(groups[-1]) > tolerance:
            groups.append([value])
        else:
            groups[-1].append(value)
    return groups


def edge_gaps(children: list[dict], axis: str) -> list[float]:
    size_key = "width" if axis == "x" else "height"
    ordered = sorted(children, key=lambda item: float(item["bounds"][axis]))
    gaps: list[float] = []
    for left, right in zip(ordered, ordered[1:]):
        left_end = float(left["bounds"][axis]) + float(left["bounds"][size_key])
        gap = float(right["bounds"][axis]) - left_end
        if gap >= 0:
            gaps.append(gap)
    return gaps


def infer_layout(parent: dict, children: list[dict]) -> dict:
    declared = parent.get("layout") if isinstance(parent.get("layout"), dict) else {}
    if len(children) < 2:
        mode = str(declared.get("mode") or "free")
        if mode not in LAYOUT_MODES:
            mode = "free"
        return {
            "mode": mode,
            "basis": "declared" if declared else "insufficient-children",
            "childOrder": [item["id"] for item in children],
        }

    centers_x = [float(item["bounds"]["x"]) + float(item["bounds"]["width"]) / 2 for item in children]
    centers_y = [float(item["bounds"]["y"]) + float(item["bounds"]["height"]) / 2 for item in children]
    widths = [float(item["bounds"]["width"]) for item in children]
    heights = [float(item["bounds"]["height"]) for item in children]
    x_tolerance = max(4.0, statistics.median(widths) * 0.35)
    y_tolerance = max(4.0, statistics.median(heights) * 0.35)
    x_bands = bands(centers_x, x_tolerance)
    y_bands = bands(centers_y, y_tolerance)

    if len(children) >= 4 and len(x_bands) >= 2 and len(y_bands) >= 2:
        mode = "grid"
        order = sorted(children, key=lambda item: (float(item["bounds"]["y"]), float(item["bounds"]["x"])))
        gap_x = average(edge_gaps(children, "x"))
        gap_y = average(edge_gaps(children, "y"))
    elif max(centers_y) - min(centers_y) <= y_tolerance:
        mode = "row"
        order = sorted(children, key=lambda item: float(item["bounds"]["x"]))
        gap_x = average(edge_gaps(children, "x"))
        gap_y = None
    elif max(centers_x) - min(centers_x) <= x_tolerance:
        mode = "column"
        order = sorted(children, key=lambda item: float(item["bounds"]["y"]))
        gap_x = None
        gap_y = average(edge_gaps(children, "y"))
    else:
        declared_mode = str(declared.get("mode") or "free")
        mode = declared_mode if declared_mode in LAYOUT_MODES else "free"
        order = sorted(children, key=lambda item: (float(item["bounds"]["y"]), float(item["bounds"]["x"])))
        gap_x = None
        gap_y = None

    result = {
        "mode": mode,
        "basis": "geometry-inference",
        "childOrder": [item["id"] for item in order],
        "bands": {"columns": len(x_bands), "rows": len(y_bands)},
    }
    if gap_x is not None:
        result["gapXpx"] = gap_x
    if gap_y is not None:
        result["gapYpx"] = gap_y
    if declared:
        result["declared"] = declared
    return result


def normalized_bounds(bounds: dict, width: float, height: float) -> dict:
    return {
        "x": rounded(float(bounds["x"]) / width),
        "y": rounded(float(bounds["y"]) / height),
        "width": rounded(float(bounds["width"]) / width),
        "height": rounded(float(bounds["height"]) / height),
    }


def responsive_hint(node: dict, parent: dict, explicit: list[str]) -> dict:
    bounds = node["bounds"]
    parent_bounds = parent["bounds"]
    left = float(bounds["x"]) - float(parent_bounds["x"])
    top = float(bounds["y"]) - float(parent_bounds["y"])
    right = float(parent_bounds["x"]) + float(parent_bounds["width"]) - float(bounds["x"]) - float(bounds["width"])
    bottom = float(parent_bounds["y"]) + float(parent_bounds["height"]) - float(bounds["y"]) - float(bounds["height"])
    tolerance_x = max(8.0, float(parent_bounds["width"]) * 0.02)
    tolerance_y = max(8.0, float(parent_bounds["height"]) * 0.02)
    center_x = left + float(bounds["width"]) / 2
    center_y = top + float(bounds["height"]) / 2
    near_left, near_right = left <= tolerance_x, right <= tolerance_x
    near_top, near_bottom = top <= tolerance_y, bottom <= tolerance_y

    if near_left and near_right:
        horizontal = "stretch"
    elif near_left:
        horizontal = "left"
    elif near_right:
        horizontal = "right"
    elif abs(center_x - float(parent_bounds["width"]) / 2) <= tolerance_x:
        horizontal = "center"
    else:
        horizontal = "scale"
    if near_top and near_bottom:
        vertical = "stretch"
    elif near_top:
        vertical = "top"
    elif near_bottom:
        vertical = "bottom"
    elif abs(center_y - float(parent_bounds["height"]) / 2) <= tolerance_y:
        vertical = "center"
    else:
        vertical = "scale"

    return {
        "horizontal": horizontal,
        "vertical": vertical,
        "edgeDistancesPx": {
            "left": rounded(left, 2),
            "top": rounded(top, 2),
            "right": rounded(right, 2),
            "bottom": rounded(bottom, 2),
        },
        "explicitAnchors": explicit,
        "basis": "explicit-plus-geometry" if explicit else "geometry-inference",
    }


def issue_list(nodes: list[dict], unresolved: list) -> list[dict]:
    issues: list[dict] = []
    for node in nodes:
        node_id = node["id"]
        content = node.get("content") if isinstance(node.get("content"), dict) else {}
        asset = node.get("asset") if isinstance(node.get("asset"), dict) else {}
        if node["type"] == "text" and not str(content.get("text") or "").strip():
            issues.append({"severity": "warning", "nodeId": node_id, "code": "missing-text", "message": "Confirm or supply the visible text before parity acceptance."})
        if node["type"] == "icon" and not any(asset.get(key) for key in ("name", "path", "svg", "libraryId")):
            issues.append({"severity": "warning", "nodeId": node_id, "code": "missing-icon-asset", "message": "Choose a real SVG or icon-library asset; do not ship a screenshot crop."})
        if node["type"] == "image" and not any(asset.get(key) for key in ("path", "src", "referenceCrop")):
            issues.append({"severity": "warning", "nodeId": node_id, "code": "missing-image-asset", "message": "Provide or generate the raster asset before parity acceptance."})
        if node["type"] == "unknown":
            issues.append({"severity": "warning", "nodeId": node_id, "code": "unknown-type", "message": "Resolve this node type before generating its production component."})
        confidence = node.get("confidence") if isinstance(node.get("confidence"), dict) else {}
        if confidence.get("level") == "assumption":
            issues.append({"severity": "info", "nodeId": node_id, "code": "assumption", "message": "Preserve this as an explicit assumption until browser verification."})
    for item in unresolved:
        if isinstance(item, dict):
            issues.append({
                "severity": str(item.get("severity") or "info"),
                "nodeId": item.get("nodeId"),
                "code": str(item.get("id") or "evidence-unresolved"),
                "message": str(item.get("message") or "Unresolved evidence item"),
            })
    return issues


def compile_spec(document: dict, source_path: Path) -> dict:
    validate(document)
    reference = document["reference"]
    width, height = float(reference["width"]), float(reference["height"])
    nodes = document["nodes"]
    by_id = {node["id"]: node for node in nodes}
    children: dict[str, list[dict]] = {node_id: [] for node_id in by_id}
    roots: list[str] = []
    for node in nodes:
        parent_id = node.get("parentId")
        if parent_id is None:
            roots.append(node["id"])
        else:
            children[parent_id].append(node)

    compiled_nodes: list[dict] = []
    for node in nodes:
        node_id = node["id"]
        bounds = node["bounds"]
        parent = by_id.get(node.get("parentId")) or node
        explicit_anchors = [str(value) for value in node.get("anchors", []) if isinstance(value, str)]
        entry = {
            "id": node_id,
            "dataUiId": node_id,
            "name": node.get("name") or node_id,
            "type": node["type"],
            "parentId": node.get("parentId"),
            "childIds": [child["id"] for child in children[node_id]],
            "boundsPx": bounds,
            "boundsNormalized": normalized_bounds(bounds, width, height),
            "responsive": responsive_hint(node, parent, explicit_anchors),
            "layoutHint": infer_layout(node, children[node_id]),
            "confidence": node["confidence"],
        }
        for key in ("content", "asset", "style", "interaction"):
            if key in node:
                entry[key] = node[key]
        compiled_nodes.append(entry)

    generation_order: list[str] = []

    def visit(node_id: str) -> None:
        generation_order.append(node_id)
        ordered = next(item for item in compiled_nodes if item["id"] == node_id)["layoutHint"]["childOrder"]
        for child_id in ordered:
            visit(child_id)

    for root_id in roots:
        visit(root_id)

    issues = issue_list(nodes, document.get("unresolved", []))
    return {
        "schemaVersion": 1,
        "kind": "ui-generation-spec",
        "status": "ready-for-source-generation",
        "sourceEvidence": source_path.as_posix(),
        "reference": reference,
        "rootIds": roots,
        "nodes": compiled_nodes,
        "generationOrder": generation_order,
        "tokens": document.get("tokens", {}),
        "quality": {
            "issueCount": len(issues),
            "warningCount": sum(1 for item in issues if item["severity"] == "warning"),
            "issues": issues,
        },
        "sourceContract": {
            "required": [
                "Generate real semantic DOM/components, not a screenshot or image-sliced page.",
                "Emit data-ui-id for every visible mapped node using dataUiId exactly.",
                "Match boundsPx at the observed viewport before visual polish.",
                "Use layoutHint as advisory Flex/Grid guidance; keep screenshot coordinates as evidence.",
                "Keep text, icons, controls, and their containers independently editable.",
                "Add responsive behavior from the responsive hints without inventing unseen product states.",
            ],
            "absolutePositioning": "Only for genuine overlays or anchored decoration; never trace the full screenshot absolutely.",
            "atomicNodeCount": sum(1 for node in nodes if node["type"] in ATOMIC_TYPES),
        },
    }


def default_output(map_path: Path, reference_id: str) -> Path:
    if map_path.parent.name == "ui-evidence" and map_path.parent.parent.name == "artifacts":
        return map_path.parent.parent / "ui-spec" / f"{reference_id}.json"
    return map_path.with_name(f"{map_path.stem}.ui-spec.json")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("map", type=Path, help="Ready position-evidence JSON")
    parser.add_argument("--output", type=Path, help="Output path; defaults to artifacts/ui-spec/<reference-id>.json")
    args = parser.parse_args()
    map_path = args.map.resolve()
    try:
        document = json.loads(map_path.read_text(encoding="utf-8"))
        reference = document.get("reference") if isinstance(document, dict) else {}
        reference_id = str(reference.get("id") or map_path.stem)
        output = args.output.resolve() if args.output else default_output(map_path, reference_id)
        source_path = Path(map_path.name)
        if map_path.parent.name == "ui-evidence" and map_path.parent.parent.name == "artifacts":
            source_path = Path("artifacts") / "ui-evidence" / map_path.name
        spec = compile_spec(document, source_path)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(spec, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    except (OSError, json.JSONDecodeError, ValueError, KeyError) as error:
        print(f"Compile UI spec: FAIL - {error}", file=sys.stderr)
        return 1
    print(f"Compile UI spec: PASS ({len(spec['nodes'])} nodes, {spec['quality']['issueCount']} issues)")
    print(f"UI generation spec: {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
