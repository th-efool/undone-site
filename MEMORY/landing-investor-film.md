# Landing investor film storage

- `.gitattributes`: exact `public/videos/undone-investor-film.mp4` and `public/videos/hls/*.ts` overrides disable filter/diff/merge/text; these assets belong to normal Git, not LFS. Other LFS rules remain.
- `public/videos/undone-investor-film.mp4`: 90,503,148 bytes; H.264/AAC, 62.416667 seconds. `public/videos/hls/explainer.m3u8` references 21 matching segments.
- `src/client/screens/landing/VideoExplainer/`: existing player still uses original URLs. Source files and playback logic are unchanged by the storage migration.
- Playback policy: section 2 waits for a user play action and starts audible. Do not restore muted scroll autoplay: browsers block audible autoplay and the old fallback silently muted playback.
- Migration verification: all 22 staged blob sizes and SHA-256 hashes match their original LFS declarations. Commit/deploy is required to publish the actual bytes; old history retains LFS pointers.
- `plans/architecture-and-refactor/landing-investor-film-IdiotHandOffGuide.md`: S0 storage conversion applied locally; S1–S5 build guard, versioned output and release verification remain proposed, not implemented.
