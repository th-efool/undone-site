#!/usr/bin/env python3
"""Verify that a generated project exposes the reusable Studio contract."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path


REQUIRED_FILES = (
    "studio.html",
    "studio.css",
    "studio.js",
    "ui-analysis.js",
    "ui-analysis-core.mjs",
    "ui-semantic-core.mjs",
    "local-ocr.mjs",
    "ui-fidelity.js",
    "ui-fidelity-core.mjs",
    "ui-document-v4.mjs",
    "ui-sync-core.mjs",
    "studio-bridge.mjs",
    "ui-sync.mjs",
    "scripts/generic-layer-tree-contract.mjs",
)
WINDOWS_REQUIRED_FILES = ("scripts/windows-native-ocr.ps1",)
REQUIRED_PRODUCTION_FILES = ("index.html", "styles.css", "app.js")
REQUIRED_IDS = (
    "canvas-viewport",
    "canvas-stage",
    "preview-transform",
    "preview-frame",
    "toggle-hand",
    "canvas-fit-select",
    "canvas-contract-badge",
    "viewport-select",
    "edge-toggle-layers",
    "edge-toggle-inspector",
    "ruler-horizontal",
    "ruler-vertical",
    "layers",
    "selection-scope-select",
    "layer-filter-select",
    "expand-layer-tree",
    "collapse-layer-tree",
    "layers-resize-handle",
    "inspector",
    "undo",
    "redo",
    "export-html",
    "open-icon-tool",
    "icon-tool-dialog",
    "icon-json-input",
    "icon-example",
    "icon-choice",
    "icon-preview",
    "icon-import-status",
    "icon-step-target",
    "icon-step-source",
    "icon-step-apply",
    "apply-icon-json",
    "restore-original-icon",
    "text-system",
    "prop-font-family",
    "font-library-dialog",
    "box-system",
    "prop-border-width",
    "sync-menu",
    "sync-status-label",
    "sync-handoff",
    "sync-pull",
    "sync-diff",
    "sync-dialog",
    "analysis-file",
    "analysis-intake-check",
    "analysis-run",
    "analysis-workspace",
    "analysis-canvas",
    "analysis-candidate-list",
    "analysis-save",
    "analysis-calibrate-dom",
    "analysis-infer-layout",
    "analysis-ocr-json",
    "analysis-import-ocr",
    "fidelity-workspace",
    "fidelity-reference-file",
    "fidelity-result-file",
    "fidelity-run",
    "fidelity-pixel-score",
    "fidelity-heatmap-canvas",
    "fidelity-mismatch-list",
    "fidelity-gate-summary",
    "fidelity-gate-score",
)
REQUIRED_BEHAVIORS = (
    "CANVAS_CORE_VERSION",
    "applyCanvasFitMode",
    "zoomAtPoint",
    "beginCanvasPan",
    "clearSelection",
    "collectSnapTargets",
    "descendantIds",
    "ui-studio-handle",
    "TREE_STATE_KEY",
    "PANEL_STATE_KEY",
    "ICONS_KEY",
    "sanitizeSvgMarkup",
    "extractIconifyReferences",
    "parseIconImport",
    "fetchIconifyReference",
    "applyIconReplacement",
    "injectIconReplacementsIntoHTML",
    "nodeMatchesFilter",
    "scopedElement",
    "applySelectionScope",
    "applyStoredLayersWidth",
    "syncLayerHover",
    "FONT_FAMILIES",
    "SYNC_API",
    "saveProject",
    "pullCodexLatest",
    "handoffToCodex",
    "initializeProjectSync",
    "recognize",
    "ui-studio-featurechange",
    "normalizeOcrPayload",
    "runBridgeTextRecognition",
    "calibrateFromProductionDom",
    "inferSemanticStructure",
    "compareImageData",
    "computeFidelityGate",
    "hasKnownPageContract",
    "appendGenericSubtree",
    "currentPageContext",
    "PAGE_LAYER_COUNTS_KEY",
    "scanProjectPageLayerCounts",
    "knownPageLayerCount",
    "pageLayerScanningKeys",
    "layerActionIcon",
    "layer-row-actions",
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("target", type=Path)
    parser.add_argument("--json", action="store_true", dest="as_json")
    return parser.parse_args()


def verify(target: Path) -> dict:
    target = target.resolve()
    runtime_files = REQUIRED_FILES + (WINDOWS_REQUIRED_FILES if sys.platform == "win32" else ())
    missing_files = [name for name in runtime_files if not (target / name).is_file()]
    missing_production_files = [name for name in REQUIRED_PRODUCTION_FILES if not (target / name).is_file()]
    html = (target / "studio.html").read_text(encoding="utf-8") if not missing_files or (target / "studio.html").is_file() else ""
    js = (target / "studio.js").read_text(encoding="utf-8") if (target / "studio.js").is_file() else ""
    analysis_js = (target / "ui-analysis.js").read_text(encoding="utf-8") if (target / "ui-analysis.js").is_file() else ""
    semantic_js = (target / "ui-semantic-core.mjs").read_text(encoding="utf-8") if (target / "ui-semantic-core.mjs").is_file() else ""
    fidelity_js = (target / "ui-fidelity.js").read_text(encoding="utf-8") if (target / "ui-fidelity.js").is_file() else ""
    fidelity_core = (target / "ui-fidelity-core.mjs").read_text(encoding="utf-8") if (target / "ui-fidelity-core.mjs").is_file() else ""
    behavior_source = js + "\n" + analysis_js + "\n" + semantic_js + "\n" + fidelity_js + "\n" + fidelity_core
    missing_ids = [element_id for element_id in REQUIRED_IDS if not re.search(rf'id=["\']{re.escape(element_id)}["\']', html)]
    missing_behaviors = [name for name in REQUIRED_BEHAVIORS if name not in behavior_source]

    atomic_layers = 0
    for relative in REQUIRED_PRODUCTION_FILES:
        production_file = target / relative
        if not production_file.is_file() or production_file.suffix.lower() == ".css":
            continue
        atomic_layers += len(re.findall(r"\bdata-ui-id\s*=", production_file.read_text(encoding="utf-8")))

    return {
        "ok": not missing_files and not missing_production_files and not missing_ids and not missing_behaviors and atomic_layers > 0,
        "target": str(target),
        "missingFiles": missing_files,
        "missingProductionFiles": missing_production_files,
        "missingElementIds": missing_ids,
        "missingBehaviors": missing_behaviors,
        "productionAtomicLayerCount": atomic_layers,
    }


def main() -> int:
    args = parse_args()
    report = verify(args.target)
    if args.as_json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        print("Studio contract: " + ("PASS" if report["ok"] else "FAIL"))
        print(f"Production atomic layers: {report['productionAtomicLayerCount']}")
        for key in ("missingFiles", "missingProductionFiles", "missingElementIds", "missingBehaviors"):
            if report[key]:
                print(f"{key}: {', '.join(report[key])}")
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
