#!/usr/bin/env python3
"""Generate diagnostic UI screenshot similarity metrics and an optional heatmap."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter, ImageOps, ImageStat


def normalized_mae(left: Image.Image, right: Image.Image) -> float:
    diff = ImageChops.difference(left, right)
    means = ImageStat.Stat(diff).mean
    return sum(means) / (len(means) * 255.0)


def similarity(mae: float) -> float:
    return round(max(0.0, min(100.0, (1.0 - mae) * 100.0)), 3)


def score(reference: Image.Image, candidate: Image.Image) -> dict[str, float]:
    ref_rgb = reference.convert("RGB")
    out_rgb = candidate.convert("RGB")

    color_mae = normalized_mae(ref_rgb, out_rgb)
    blurred_mae = normalized_mae(
        ref_rgb.filter(ImageFilter.GaussianBlur(1.25)),
        out_rgb.filter(ImageFilter.GaussianBlur(1.25)),
    )
    edge_mae = normalized_mae(
        ImageOps.grayscale(ref_rgb).filter(ImageFilter.FIND_EDGES),
        ImageOps.grayscale(out_rgb).filter(ImageFilter.FIND_EDGES),
    )

    color_score = similarity(color_mae)
    structure_score = similarity(blurred_mae)
    edge_score = similarity(edge_mae)
    diagnostic = round(color_score * 0.35 + structure_score * 0.4 + edge_score * 0.25, 3)

    return {
        "diagnostic_similarity": diagnostic,
        "color_similarity": color_score,
        "structure_similarity": structure_score,
        "edge_similarity": edge_score,
        "normalized_color_mae": round(color_mae, 6),
    }


def heatmap(reference: Image.Image, candidate: Image.Image) -> Image.Image:
    ref_rgb = reference.convert("RGB")
    out_rgb = candidate.convert("RGB")
    difference = ImageChops.difference(ref_rgb, out_rgb)
    mask = ImageOps.autocontrast(ImageOps.grayscale(difference)).filter(ImageFilter.GaussianBlur(0.7))
    red = Image.new("RGB", ref_rgb.size, "#ff2d55")
    darkened = Image.blend(out_rgb, Image.new("RGB", out_rgb.size, "#111827"), 0.45)
    return Image.composite(red, darkened, mask)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("reference", type=Path)
    parser.add_argument("candidate", type=Path)
    parser.add_argument("--heatmap", type=Path)
    parser.add_argument("--json", dest="json_path", type=Path)
    args = parser.parse_args()

    reference = Image.open(args.reference)
    candidate = Image.open(args.candidate)
    if reference.size != candidate.size:
        parser.error(f"image dimensions differ: {reference.size} != {candidate.size}")

    result = {
        "reference": str(args.reference),
        "candidate": str(args.candidate),
        "dimensions": {"width": reference.width, "height": reference.height},
        **score(reference, candidate),
        "note": "Diagnostic only; complete the weighted fidelity gate before claiming 95%.",
    }

    if args.heatmap:
        args.heatmap.parent.mkdir(parents=True, exist_ok=True)
        heatmap(reference, candidate).save(args.heatmap)
        result["heatmap"] = str(args.heatmap)

    encoded = json.dumps(result, ensure_ascii=False, indent=2)
    print(encoded)
    if args.json_path:
        args.json_path.parent.mkdir(parents=True, exist_ok=True)
        args.json_path.write_text(encoded + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
