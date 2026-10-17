import os
import subprocess
import sys
from pathlib import Path

def get_dir_size(path):
    total = 0
    for root, dirs, files in os.walk(path):
        for f in files:
            fp = os.path.join(root, f)
            try:
                if not os.path.islink(fp):
                    total += os.path.getsize(fp)
            except OSError:
                pass
    return total

def format_size(bytes_val):
    for unit in ['B', 'KiB', 'MiB', 'GiB']:
        if abs(bytes_val) < 1024.0:
            return f"{bytes_val:3.2f} {unit}"
        bytes_val /= 1024.0
    return f"{bytes_val:.2f} TiB"

def main():
    root = Path('.').resolve()
    print(f"Analyzing repository at {root}")

    # 1. Directory sizes
    git_dir = root / '.git'
    git_size = get_dir_size(git_dir) if git_dir.exists() else 0
    total_working_tree_size = 0
    for item in root.iterdir():
        if item.name in ['.git', 'node_modules', '.next']:
            continue
        if item.is_file():
            total_working_tree_size += item.stat().st_size
        elif item.is_dir():
            total_working_tree_size += get_dir_size(item)

    print(f"Git dir (.git) size: {format_size(git_size)} ({git_size} bytes)")
    print(f"Working tree (excl .git, node_modules, .next): {format_size(total_working_tree_size)} ({total_working_tree_size} bytes)")

    # 2. Tracked files from git
    res = subprocess.run(['git', 'ls-files', '-s'], capture_output=True, text=True, check=True)
    tracked_files = []
    total_tracked_size = 0
    dir_sizes = {}

    for line in res.stdout.strip().splitlines():
        if not line:
            continue
        parts = line.split(maxsplit=3)
        if len(parts) < 4:
            continue
        mode, blob_hash, stage, filepath = parts
        file_p = root / filepath
        if file_p.exists() and file_p.is_file():
            size = file_p.stat().st_size
        else:
            size = 0
        tracked_files.append((filepath, size, blob_hash))
        total_tracked_size += size

        # Track directory aggregation
        d = str(Path(filepath).parent)
        dir_sizes[d] = dir_sizes.get(d, 0) + size

    print(f"Total tracked files count: {len(tracked_files)}")
    print(f"Total tracked files size (working tree): {format_size(total_tracked_size)} ({total_tracked_size} bytes)")

    # Sort largest tracked files
    tracked_files.sort(key=lambda x: x[1], reverse=True)
    print("\n--- TOP 30 LARGEST TRACKED FILES ---")
    for f, s, h in tracked_files[:30]:
        print(f"{format_size(s):>12}  {f}")

    # Aggregate top directory sizes
    print("\n--- TOP DIRECTORIES OF TRACKED FILES ---")
    sorted_dirs = sorted(dir_sizes.items(), key=lambda x: x[1], reverse=True)
    for d, s in sorted_dirs[:20]:
        print(f"{format_size(s):>12}  {d}")

    # 3. Large objects in Git history
    print("\n--- TOP 20 LARGEST OBJECTS IN GIT HISTORY ---")
    hist_cmd = "git rev-list --objects --all"
    p = subprocess.run(hist_cmd, shell=True, capture_output=True, text=True)
    objects = []
    for line in p.stdout.strip().splitlines():
        if not line:
            continue
        parts = line.split(maxsplit=1)
        oid = parts[0]
        path_name = parts[1] if len(parts) > 1 else ""
        objects.append((oid, path_name))

    # Batch check sizes using git cat-file --batch-check
    batch_input = "\n".join(oid for oid, _ in objects)
    p2 = subprocess.run(['git', 'cat-file', '--batch-check=%(objectname) %(objecttype) %(objectsize)'],
                        input=batch_input, capture_output=True, text=True)
    
    parsed_objects = []
    oid_to_path = {oid: path_name for oid, path_name in objects}
    for line in p2.stdout.strip().splitlines():
        parts = line.split()
        if len(parts) == 3 and parts[1] == 'blob':
            oid, otype, osize = parts[0], parts[1], int(parts[2])
            parsed_objects.append((oid_to_path.get(oid, ''), osize, oid))

    parsed_objects.sort(key=lambda x: x[1], reverse=True)
    for path_name, osize, oid in parsed_objects[:20]:
        print(f"{format_size(osize):>12}  {oid[:8]}  {path_name}")

if __name__ == '__main__':
    main()
