import os
import re
from pathlib import Path

def find_references():
    keywords = [
        'undone-investor-film',
        'explainer.m3u8',
        'videos/hls',
        'videos/auth',
        'hero.webm',
        'notes-board',
        'interaction-builder'
    ]
    results = {k: [] for k in keywords}

    search_dirs = ['src', 'scripts', 'packages', 'public', 'directives', 'docs']
    ignore_dirs = {'node_modules', '.git', '.next', 'dist'}

    for s_dir in search_dirs:
        p = Path(s_dir)
        if not p.exists():
            continue
        for root, dirs, files in os.walk(p):
            dirs[:] = [d for d in dirs if d not in ignore_dirs]
            for f in files:
                filepath = os.path.join(root, f)
                try:
                    with open(filepath, 'r', encoding='utf-8', errors='ignore') as fl:
                        content = fl.read()
                        for k in keywords:
                            if k in content:
                                results[k].append(filepath)
                except Exception:
                    pass

    for k, files in results.items():
        print(f"\n=== KEYWORD: '{k}' ({len(files)} files) ===")
        for f in files[:20]:
            print(f"  {f}")
        if len(files) > 20:
            print(f"  ... and {len(files) - 20} more")

if __name__ == '__main__':
    find_references()
