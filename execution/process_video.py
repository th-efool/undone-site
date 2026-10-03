"""
Video & Media Processing Pipeline: Undone Investor Film
Deterministic processing of 1080p60 motion graphics master into:
1. High-quality visually lossless MP4 (CRF 18, 60fps, faststart)
2. HLS playlist and chunked segments (.m3u8 + .ts) with keyframe alignment (GOP 120)
"""

import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path


def run_command(cmd, desc="Running command"):
    print(f"\n--- {desc} ---")
    print(f"Command: {' '.join(cmd)}")
    start_t = time.time()
    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    elapsed = time.time() - start_t
    print(f"Elapsed: {elapsed:.2f}s")
    if result.returncode != 0:
        print(f"ERROR ({result.returncode}):\n{result.stderr}")
        raise RuntimeError(f"Command failed with code {result.returncode}: {' '.join(cmd)}")
    return result.stdout, result.stderr, elapsed


def probe_file(file_path):
    cmd = [
        "ffprobe",
        "-v", "error",
        "-show_entries", "stream=index,codec_name,codec_type,width,height,r_frame_rate,bit_rate,nb_frames",
        "-show_entries", "format=duration,size,bit_rate",
        "-of", "json",
        str(file_path)
    ]
    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffprobe failed for {file_path}: {result.stderr}")
    return json.loads(result.stdout)


def format_bytes(num_bytes):
    for unit in ['B', 'KB', 'MB', 'GB']:
        if abs(num_bytes) < 1024.0:
            return f"{num_bytes:3.2f} {unit}"
        num_bytes /= 1024.0
    return f"{num_bytes:.2f} TB"


def main():
    root_dir = Path(__file__).resolve().parent.parent
    source_video = root_dir / "plans" / "Undone Investor Film.mp4"
    public_videos = root_dir / "public" / "videos"
    output_mp4 = public_videos / "undone-investor-film.mp4"
    hls_dir = public_videos / "hls"
    output_m3u8 = hls_dir / "explainer.m3u8"
    segment_pattern = hls_dir / "segment_%03d.ts"

    start_wall_time = time.strftime("%Y-%m-%d %H:%M:%S")
    print("=" * 60)
    print("UNDONE INVESTOR FILM - VIDEO ENCODING PIPELINE")
    print(f"Started at: {start_wall_time}")
    print("=" * 60)

    if not source_video.exists():
        print(f"FATAL: Source video not found at {source_video}")
        sys.exit(1)

    source_size = source_video.stat().st_size
    print(f"Source Video: {source_video}")
    print(f"Source Size: {format_bytes(source_size)} ({source_size:,} bytes)")

    # Probe source
    source_probe = probe_file(source_video)
    video_stream = next(s for s in source_probe["streams"] if s["codec_type"] == "video")
    audio_stream = next(s for s in source_probe["streams"] if s["codec_type"] == "audio")
    duration = float(source_probe["format"].get("duration", 0))

    print(f"Source Resolution: {video_stream.get('width')}x{video_stream.get('height')}")
    print(f"Source Framerate: {video_stream.get('r_frame_rate')} fps")
    print(f"Source Duration: {duration:.2f}s")
    print(f"Source Codec: Video={video_stream.get('codec_name')}, Audio={audio_stream.get('codec_name')}")

    # Ensure output directories exist
    public_videos.mkdir(parents=True, exist_ok=True)
    hls_dir.mkdir(parents=True, exist_ok=True)

    # ---------------------------------------------------------
    # STEP 1: Compress MP4 with Visually Lossless CRF 18 & GOP 120
    # ---------------------------------------------------------
    # Settings:
    # - CRF 18: visually lossless quality for high-contrast geometric motion graphics
    # - Preset slow: high compression efficiency without artifacting
    # - Framerate: 60 fps (-r 60)
    # - GOP: 120 frames (2s keyframes at 60fps) aligned for HLS chunk slicing
    # - Movflags: +faststart for immediate browser streaming
    # - Audio: AAC 128k
    mp4_cmd = [
        "ffmpeg",
        "-y",
        "-i", str(source_video),
        "-c:v", "libx264",
        "-crf", "18",
        "-preset", "slow",
        "-pix_fmt", "yuv420p",
        "-r", "60",
        "-g", "120",
        "-keyint_min", "120",
        "-sc_threshold", "0",
        "-movflags", "+faststart",
        "-c:a", "aac",
        "-b:a", "128k",
        str(output_mp4)
    ]

    _, _, mp4_time = run_command(mp4_cmd, "Encoding Visually Lossless MP4 (CRF 18, 60fps, GOP 120)")

    if not output_mp4.exists():
        print("FATAL: Output MP4 was not created.")
        sys.exit(1)

    mp4_size = output_mp4.stat().st_size
    mp4_ratio = (source_size - mp4_size) / source_size * 100
    mp4_factor = source_size / mp4_size if mp4_size > 0 else 0

    print(f"Output MP4 Size: {format_bytes(mp4_size)} ({mp4_size:,} bytes)")
    print(f"MP4 Space Savings: {mp4_ratio:.2f}% (Reduced by {mp4_factor:.2f}x)")
    print(f"MP4 Encoding Time: {mp4_time:.2f}s")

    # ---------------------------------------------------------
    # STEP 2: Generate HLS Playlist & Segments
    # ---------------------------------------------------------
    # Settings:
    # - Segment duration: 3-4s (-hls_time 3)
    # - Using copy from pre-aligned GOP 120 MP4 to prevent generational loss
    # - Playlist type: VOD (-hls_playlist_type vod)
    # - Independent segments: (-hls_flags independent_segments)
    hls_cmd = [
        "ffmpeg",
        "-y",
        "-i", str(output_mp4),
        "-c", "copy",
        "-hls_time", "3",
        "-hls_playlist_type", "vod",
        "-hls_flags", "independent_segments",
        "-hls_segment_filename", str(segment_pattern),
        str(output_m3u8)
    ]

    _, _, hls_time = run_command(hls_cmd, "Generating HLS VOD Playlist & Segments")

    if not output_m3u8.exists():
        print("FATAL: Output HLS playlist was not created.")
        sys.exit(1)

    segments = sorted(list(hls_dir.glob("segment_*.ts")))
    total_hls_size = sum(s.stat().st_size for s in segments) + output_m3u8.stat().st_size

    print(f"HLS Segments Count: {len(segments)}")
    print(f"HLS Playlist Size: {format_bytes(output_m3u8.stat().st_size)}")
    print(f"Total HLS Bundle Size: {format_bytes(total_hls_size)} ({total_hls_size:,} bytes)")
    print(f"HLS Packaging Time: {hls_time:.2f}s")

    # ---------------------------------------------------------
    # STEP 3: Verification with ffprobe
    # ---------------------------------------------------------
    print("\n" + "=" * 60)
    print("VERIFICATION & INTEGRITY CHECKS")
    print("=" * 60)

    mp4_probe = probe_file(output_mp4)
    mp4_v = next(s for s in mp4_probe["streams"] if s["codec_type"] == "video")
    mp4_a = next(s for s in mp4_probe["streams"] if s["codec_type"] == "audio")
    mp4_duration = float(mp4_probe["format"].get("duration", 0))

    print("\n[MP4 Output Verification]")
    print(f"- File: {output_mp4.relative_to(root_dir)}")
    print(f"- Codec: {mp4_v.get('codec_name')} (profile: {mp4_v.get('profile', 'N/A')})")
    print(f"- Resolution: {mp4_v.get('width')}x{mp4_v.get('height')}")
    print(f"- Framerate: {mp4_v.get('r_frame_rate')} fps")
    print(f"- Duration: {mp4_duration:.2f}s")
    print(f"- Bitrate: {int(mp4_probe['format'].get('bit_rate', 0)) // 1000} kbps")
    print(f"- Audio Codec: {mp4_a.get('codec_name')}")

    assert mp4_v.get("width") == 1920, "MP4 width mismatch"
    assert mp4_v.get("height") == 1080, "MP4 height mismatch"
    assert mp4_v.get("codec_name") == "h264", "MP4 codec mismatch"
    assert mp4_v.get("r_frame_rate") == "60/1", "MP4 framerate mismatch"

    print("\n[HLS Playlist & Segments Verification]")
    print(f"- Playlist: {output_m3u8.relative_to(root_dir)}")
    with open(output_m3u8, "r", encoding="utf-8") as f:
        playlist_content = f.read()

    print(f"- Playlist Length: {len(playlist_content.splitlines())} lines")
    assert "#EXT-X-PLAYLIST-TYPE:VOD" in playlist_content, "VOD tag missing from playlist"
    assert "#EXT-X-INDEPENDENT-SEGMENTS" in playlist_content, "Independent segments tag missing"
    assert "#EXT-X-ENDLIST" in playlist_content, "Endlist tag missing"

    first_segment = segments[0]
    seg_probe = probe_file(first_segment)
    seg_v = next(s for s in seg_probe["streams"] if s["codec_type"] == "video")
    print(f"- First Segment: {first_segment.name}")
    print(f"  Codec: {seg_v.get('codec_name')}, Res: {seg_v.get('width')}x{seg_v.get('height')}, FPS: {seg_v.get('r_frame_rate')}")

    assert seg_v.get("width") == 1920, "Segment width mismatch"
    assert seg_v.get("height") == 1080, "Segment height mismatch"
    assert seg_v.get("codec_name") == "h264", "Segment codec mismatch"
    assert seg_v.get("r_frame_rate") == "60/1", "Segment framerate mismatch"

    # Save verification report JSON for records
    report = {
        "timestamp": start_wall_time,
        "source": {
            "path": str(source_video.relative_to(root_dir)),
            "size_bytes": source_size,
            "size_formatted": format_bytes(source_size),
            "resolution": f"{video_stream.get('width')}x{video_stream.get('height')}",
            "framerate": video_stream.get("r_frame_rate"),
            "duration_seconds": duration,
        },
        "mp4": {
            "path": str(output_mp4.relative_to(root_dir)),
            "size_bytes": mp4_size,
            "size_formatted": format_bytes(mp4_size),
            "compression_ratio_percent": round(mp4_ratio, 2),
            "reduction_factor": round(mp4_factor, 2),
            "encoding_time_seconds": round(mp4_time, 2),
            "resolution": f"{mp4_v.get('width')}x{mp4_v.get('height')}",
            "framerate": mp4_v.get("r_frame_rate"),
            "duration_seconds": round(mp4_duration, 2),
            "bitrate_kbps": int(mp4_probe["format"].get("bit_rate", 0)) // 1000,
        },
        "hls": {
            "playlist_path": str(output_m3u8.relative_to(root_dir)),
            "segment_count": len(segments),
            "total_bundle_size_bytes": total_hls_size,
            "total_bundle_size_formatted": format_bytes(total_hls_size),
            "packaging_time_seconds": round(hls_time, 2),
            "first_segment_probe": {
                "name": first_segment.name,
                "codec": seg_v.get("codec_name"),
                "resolution": f"{seg_v.get('width')}x{seg_v.get('height')}",
                "framerate": seg_v.get("r_frame_rate"),
            }
        },
        "verification_status": "PASSED"
    }

    report_path = root_dir / ".tmp" / "video_processing_report.json"
    report_path.parent.mkdir(parents=True, exist_ok=True)
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print(f"\nReport written to: {report_path.relative_to(root_dir)}")
    print("\n>>> ALL CHECKS PASSED SUCCESSFULLY! <<<")


if __name__ == "__main__":
    main()
