import os
import subprocess
import json
from pathlib import Path

def inspect_video(path):
    cmd = [
        'ffprobe',
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        str(path)
    ]
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, check=True)
        data = json.loads(p.stdout)
        format_info = data.get('format', {})
        duration = float(format_info.get('duration', 0))
        bitrate = int(format_info.get('bit_rate', 0)) // 1000  # kbps
        size = int(format_info.get('size', 0))
        streams = []
        for s in data.get('streams', []):
            stype = s.get('codec_type')
            codec = s.get('codec_name')
            width = s.get('width')
            height = s.get('height')
            fps = s.get('r_frame_rate')
            streams.append(f"{stype}:{codec} {width}x{height if height else ''} {fps if width else ''}".strip())
        return {
            'file': str(path),
            'size': size,
            'duration': f"{duration:.2f}s",
            'bitrate': f"{bitrate} kbps",
            'streams': ', '.join(streams)
        }
    except Exception as e:
        return {'file': str(path), 'error': str(e)}

def main():
    video_dir = Path('public/videos')
    results = []
    for root, dirs, files in os.walk(video_dir):
        for f in files:
            if f.endswith(('.mp4', '.webm', '.m3u8', '.ts')):
                if f.endswith('.ts') and not f.startswith('segment_000'):
                    continue # Sample just one segment for HLS
                fp = Path(root) / f
                results.append(inspect_video(fp))

    for r in results:
        print(r)

if __name__ == '__main__':
    main()
