"""
Deterministic image optimization script for landing page assets.
Compresses and scales images appropriately to maximize load speed and performance.
"""

import os
from PIL import Image

ASSET_SPECS = [
    # Mock Cohort Thumbnails
    {
        'path': 'public/mock/thumbnails/reader.webp',
        'max_width': 640,
        'format': 'WEBP',
        'quality': 82,
    },
    {
        'path': 'public/mock/thumbnails/reflections.jpeg',
        'max_width': 480,
        'format': 'JPEG',
        'quality': 82,
    },
    {
        'path': 'public/mock/thumbnails/100dcode.jpg',
        'max_width': 640,
        'format': 'JPEG',
        'quality': 82,
    },
    {
        'path': 'public/mock/thumbnails/system-design.jpeg',
        'max_width': 480,
        'format': 'JPEG',
        'quality': 82,
    },
    {
        'path': 'public/mock/thumbnails/ui-fundamentals.webp',
        'max_width': 480,
        'format': 'WEBP',
        'quality': 82,
    },
    # Hero Collage Images
    {
        'path': 'public/images/hero-collage/real-map.jpg',
        'max_width': 400,
        'format': 'JPEG',
        'quality': 82,
    },
    {
        'path': 'public/images/hero-collage/real-mountains.jpg',
        'max_width': 480,
        'format': 'JPEG',
        'quality': 82,
    },
    {
        'path': 'public/images/hero-collage/real-cathedral.jpg',
        'max_width': 480,
        'format': 'JPEG',
        'quality': 82,
    },
    {
        'path': 'public/images/hero-collage/real-window-person.jpg',
        'max_width': 480,
        'format': 'JPEG',
        'quality': 82,
    },
    {
        'path': 'public/images/hero-collage/real-mug-books.jpg',
        'max_width': 450,
        'format': 'JPEG',
        'quality': 82,
    },
    {
        'path': 'public/images/hero-collage/real-galaxy.jpg',
        'max_width': 500,
        'format': 'JPEG',
        'quality': 82,
    },
    {
        'path': 'public/images/hero-collage/real-moon.jpg',
        'max_width': 450,
        'format': 'JPEG',
        'quality': 82,
    },
    {
        'path': 'public/images/hero-collage/real-paper-texture.jpg',
        'max_width': 800,
        'format': 'JPEG',
        'quality': 82,
    },
    # Landing & Poster Images
    {
        'path': 'public/images/landing/screen.webp',
        'max_width': 1200,
        'format': 'WEBP',
        'quality': 82,
    },
    {
        'path': 'public/images/hero-poster.webp',
        'max_width': 1280,
        'format': 'WEBP',
        'quality': 82,
    },
]

def optimize_asset(spec):
    path = spec['path']
    if not os.path.exists(path):
        print(f"Skipping (not found): {path}")
        return

    orig_size = os.path.getsize(path) / 1024

    with Image.open(path) as img:
        orig_w, orig_h = img.size
        max_w = spec.get('max_width')

        # Resize if larger than max_width
        if max_w and orig_w > max_w:
            new_w = max_w
            new_h = int(orig_h * (new_w / orig_w))
            img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
        
        # Color mode handling
        fmt = spec['format']
        if fmt == 'JPEG':
            if img.mode in ('RGBA', 'LA', 'P'):
                img = img.convert('RGB')
            temp_path = path + '.tmp.jpg'
            img.save(temp_path, 'JPEG', quality=spec.get('quality', 82), optimize=True)
        elif fmt == 'WEBP':
            if img.mode == 'RGBA':
                # Check if alpha channel is actually used
                extrema = img.getextrema()
                if extrema[3] == (255, 255):
                    img = img.convert('RGB')
            temp_path = path + '.tmp.webp'
            img.save(temp_path, 'WEBP', quality=spec.get('quality', 82), method=6)
        else:
            return

    # Replace original if optimized file is smaller
    new_size = os.path.getsize(temp_path) / 1024
    if new_size < orig_size:
        os.replace(temp_path, path)
        pct = (1 - new_size / orig_size) * 100
        print(f"Optimized: {path}")
        print(f"  {orig_size:.1f} KB -> {new_size:.1f} KB (-{pct:.1f}%) | {orig_w}x{orig_h} -> {img.size[0]}x{img.size[1]}")
    else:
        os.remove(temp_path)
        print(f"Kept original (already optimal): {path} ({orig_size:.1f} KB)")

def main():
    print("=== Optimizing Landing Page Images ===")
    total_before = 0
    total_after = 0

    for spec in ASSET_SPECS:
        p = spec['path']
        if os.path.exists(p):
            total_before += os.path.getsize(p)
            optimize_asset(spec)
            total_after += os.path.getsize(p)

    before_mb = total_before / (1024 * 1024)
    after_mb = total_after / (1024 * 1024)
    savings = (1 - total_after / total_before) * 100 if total_before else 0

    print("\n=== Summary ===")
    print(f"Total Before: {before_mb:.2f} MB")
    print(f"Total After:  {after_mb:.2f} MB")
    print(f"Total Saved:  {before_mb - after_mb:.2f} MB (-{savings:.1f}%)")

if __name__ == '__main__':
    main()
