# Video Processing SOP: Visually Lossless MP4 & HLS Chunking

## Goal
Process high-bitrate raw motion graphics master videos (`plans/Undone Investor Film.mp4`) into:
1. Web-optimized visually lossless MP4 with faststart.
2. Fragmented HLS (`.m3u8` + `.ts`) playlist with keyframe-aligned segments for instant streaming with zero dropped frames.

## Inputs
- Source video path: `plans/Undone Investor Film.mp4`
- Video specs: 1080p60 H.264 (~25.5 Mbps), AAC audio

## Tools & Requirements
- `ffmpeg` with `libx264` and `aac` encoders
- `ffprobe` for metadata verification
- Python 3.x (`py`)

## Parameters & Rationale
1. **CRF 18 (`-crf 18`)**:
   - Motion graphics rely on ultra-sharp lines, solid vectors, fine text, and subtle gradients. CRF 18 is widely recognized in professional video engineering as visually indistinguishable from source while discarding redundant high-frequency noise.
2. **Preset `slow` (`-preset slow`)**:
   - Maximizes compression efficiency and minimizes macroblocking artifacts around sharp vector edges.
3. **Framerate `-r 60`**:
   - Preserves 60fps kinetic motion smoothness. Frame dropping creates stuttering in typography and UI animations.
4. **Fast Start `-movflags +faststart`**:
   - Moves the `moov` atom (metadata) to the front of the file so web browsers start playing immediately before downloading the full file.
5. **GOP Alignment `-g 120 -keyint_min 120 -sc_threshold 0`**:
   - At 60fps, 120 frames = exact 2.0-second GOP. Disabling scene cuts (`-sc_threshold 0`) ensures strict periodic IDR keyframes.
   - For HLS segment slicing (`-hls_time 3` or 4), keyframes align perfectly with chunk boundaries, eliminating segment decode glitches.
6. **HLS Flags `-hls_playlist_type vod -hls_flags independent_segments`**:
   - Each TS chunk can be decoded independently without dependency on prior chunks.

## Output Structure
- `public/videos/undone-investor-film.mp4`
- `public/videos/hls/explainer.m3u8`
- `public/videos/hls/segment_*.ts`

## Verification Checks
1. File size and compression ratio calculation vs source.
2. `ffprobe` verification of video codec (`h264`), resolution (`1920x1080`), framerate (`60/1`), duration (`~62s`).
3. Verification that playlist `.m3u8` references generated segment files and all segments exist.
