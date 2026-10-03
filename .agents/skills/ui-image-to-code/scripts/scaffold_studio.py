#!/usr/bin/env python3
"""Install the bundled professional UI Studio into a target frontend folder."""

from __future__ import annotations

import argparse
import json
import sys
import zipfile
from pathlib import Path, PurePosixPath


ASSET = Path(__file__).resolve().parent.parent / "assets" / "studio-template.zip"
STARTER = Path(__file__).resolve().parent.parent / "assets" / "starter-production"
STARTER_FILES = ("index.html", "styles.css", "app.js", "ui-studio-overrides.css", "ui-studio-structure.js")
# Production source and project manifests are owned by the target project, never by
# the Studio engine template. In particular, --force refreshes the editor engine;
# it must not turn an existing website back into the bundled starter example.
ARCHIVE_NEVER_INSTALL = {"index.html", "styles.css", "app.js", "package.json"}
SOURCE_CONNECTED_FILES = {"ui-studio-overrides.css", "ui-studio-structure.js"}


def normalized_archive_name(filename: str) -> str:
    """Return one canonical relative archive path, independent of a leading './'."""
    path = PurePosixPath(filename)
    if path.is_absolute() or ".." in path.parts:
        raise ValueError(f"unsafe template path: {filename}")
    parts = tuple(part for part in path.parts if part not in {"", "."})
    if not parts:
        raise ValueError(f"empty template path: {filename}")
    return PurePosixPath(*parts).as_posix()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("target", type=Path, help="Frontend directory that contains or will contain index.html")
    parser.add_argument("--force", action="store_true", help="Overwrite only files declared by the bundled template")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    target = args.target.resolve()
    if not ASSET.is_file():
        print(f"Missing bundled asset: {ASSET}", file=sys.stderr)
        return 2

    target.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(ASSET) as archive:
        members = [member for member in archive.infolist() if not member.is_dir()]
        unsafe = [member.filename for member in members if PurePosixPath(member.filename).is_absolute() or ".." in PurePosixPath(member.filename).parts]
        if unsafe:
            print(f"Unsafe template paths: {unsafe}", file=sys.stderr)
            return 2

        normalized_members = [(member, normalized_archive_name(member.filename)) for member in members]
        installable = [(member, name) for member, name in normalized_members if name not in ARCHIVE_NEVER_INSTALL]
        conflicts = [
            name
            for _member, name in installable
            if name not in SOURCE_CONNECTED_FILES
            and (target / Path(*PurePosixPath(name).parts)).exists()
        ]
        if conflicts and not args.force:
            print("Refusing to overwrite existing files. Re-run with --force after reviewing:", file=sys.stderr)
            for name in conflicts:
                print(f"  {name}", file=sys.stderr)
            return 3

        installed_members = []
        for member, name in installable:
            destination = target / Path(*PurePosixPath(name).parts)
            if name in SOURCE_CONNECTED_FILES and destination.exists():
                continue
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(archive.read(member))
            installed_members.append(name)

    starter_installed = []
    if not (target / "index.html").is_file():
        missing_starter = [name for name in STARTER_FILES if not (STARTER / name).is_file()]
        if missing_starter:
            print(f"Missing bundled starter files: {missing_starter}", file=sys.stderr)
            return 2
        for name in STARTER_FILES:
            destination = target / name
            if not destination.exists():
                destination.write_bytes((STARTER / name).read_bytes())
                starter_installed.append(name)

    package_file = target / "package.json"
    package = {"name": target.name.lower().replace(" ", "-"), "private": True, "scripts": {}}
    if package_file.is_file():
        try:
            package = json.loads(package_file.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            print(f"Studio files installed, but package.json was not updated: {error}", file=sys.stderr)
            return 4
    scripts = package.setdefault("scripts", {})
    studio_scripts = {
        "studio:start": "node studio-bridge.mjs",
        "sync:init": "node ui-sync.mjs init",
        "sync:status": "node ui-sync.mjs status",
        "sync:changes": "node ui-sync.mjs changes",
        "sync:context": "node ui-sync.mjs context",
        "sync:resolve-safe": "node ui-sync.mjs resolve-safe",
        "sync:refresh-generated": "node ui-sync.mjs refresh-generated",
        "sync:apply": "node ui-sync.mjs apply",
        "sync:source-updated": "node ui-sync.mjs source-updated",
        "studio:check": "node --check ui-studio-structure.js && node --check ui-command-core.js && node --check studio.js && node --check ui-analysis.js && node --check ui-analysis-core.mjs && node --check ui-semantic-core.mjs && node --check local-ocr.mjs && node --check ui-fidelity.js && node --check ui-fidelity-core.mjs && node --check ui-document-v4.mjs && node --check ui-sync-core.mjs && node --check studio-bridge.mjs && node --check ui-sync.mjs",
        "studio:check-canvas": "node scripts/canvas-core-contract.mjs",
        "studio:check-reliability": "node scripts/sync-reliability-smoke.mjs",
        "studio:check-geometry": "node scripts/geometry-safety-contract.mjs",
        "studio:check-sidebars": "node scripts/sidebar-human-contract.mjs",
        "studio:check-multi": "node scripts/multi-selection-contract.mjs",
        "studio:check-history": "node scripts/ui-command-core-smoke.mjs",
        "studio:check-menu": "node scripts/project-menu-contract.mjs",
        "studio:check-menu-project": "node scripts/project-menu-contract.mjs --require-project",
        "studio:check-foundation": "node scripts/studio-foundation-contract.mjs",
        "studio:check-document": "node scripts/ui-document-v4-smoke.mjs",
        "studio:check-analysis": "node scripts/ui-analysis-smoke.mjs",
        "studio:check-ocr": "node scripts/local-ocr-smoke.mjs",
        "studio:check-fidelity": "node scripts/ui-fidelity-smoke.mjs",
        "studio:check-controls": "node scripts/control-hit-target-contract.mjs",
        "studio:check-motion": "node scripts/interaction-motion-contract.mjs",
        "studio:check-preview": "node scripts/preview-parity-contract.mjs",
        "studio:check-delivery": "node scripts/delivery-workflow-contract.mjs",
        "studio:check-shortcuts": "node scripts/keyboard-shortcuts-contract.mjs",
        "studio:check-structure": "node scripts/structural-duplicate-contract.mjs",
        "studio:check-sync": "node scripts/ui-sync-smoke.mjs",
    }
    skipped = []
    for name, command in studio_scripts.items():
        if name in scripts and scripts[name] != command and not args.force:
            skipped.append(name)
            continue
        scripts[name] = command
    package_file.write_text(json.dumps(package, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"Installed {len(installed_members)} Studio files into {target}")
    if starter_installed:
        print("Installed dependency-free starter production page: " + ", ".join(starter_installed))
    elif (target / "index.html").is_file():
        print("Preserved the existing production page.")
    if skipped:
        print("Preserved existing package scripts: " + ", ".join(skipped))
    print("Run: npm run studio:start")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
