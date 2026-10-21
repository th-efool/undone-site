# Study room reference redesign

## Intent and visual contract
- Keep the existing dashboard navigation and room state contracts.
- Match the supplied reference: full-bleed illustrated environment, upper-left circular timer, upper-right controls, persistent people/chat column, bottom audio and scenery dock.
- Palette: charcoal glass `#121218`, white `#f5f5f8`, muted text `#a9a9b7`, timer blue `#4775ff`, host gold `#f5c451`, leave coral `#ff796b`.
- Use the existing sans-serif family for controls and monospace for the timer. Thin borders, 16px panel corners, restrained blur. Leave the center of the artwork open.
- Desktop: header / timer + open scene + social column / audio + backgrounds. Mobile: header / timer / compact dock / social panels in normal scroll flow.

## Implementation
1. Convert all seven user-supplied PNGs in `ai-context/Studyroom Backgrounds` to new optimized public WebP assets. Replace catalog and discovery references; no old room imagery.
2. Add six explicit solid-color options to the same background model and distinguish scenes from colors in the picker. Preserve host-only shared environment mutation.
3. Restyle the timer and header; compose persistent people and chat preview cards and a functional ambience/scenery dock. Preserve tasks, privacy, leave guard, timer phases, music embeds, and audio controls.
4. Keep chat explicitly local to this preview until real-time messaging is connected. Do not invent delivered messages or live presence.
5. Run existing study room tests, focused lint and TypeScript checks; inspect the local app at desktop and mobile widths. Add focused coverage for solid themes and local chat behavior.
6. Update the study-room operational index.

## Status & Verification
- Converted all 7 backgrounds from `ai-context/Studyroom Backgrounds` into optimized WebP assets in `public/images/studyrooms/scenes/`.
- Replaced all legacy room images with the new scene assets.
- Added 6 solid color themes (`Charcoal`, `Midnight`, `Sage`, `Plum`, `Clay`, `Slate`) with dedicated toggle in `SceneDock` and `BackgroundTab`.
- Recomposed `RoomScreen` into the reference layout:
  - Header with room switcher dropdown and controls (`Tasks & Goal`, `Customize room`, `Leave`).
  - Floating upper-left `FocusBar` with glowing circular timer ring, digital clock, streak flame, primary blue Start button, and control icons.
  - Open center area showcasing high-res artwork.
  - Floating right `RoomSocial` with People roster (host crown, mute indicators, invite button) and Chat feed (dialogue, reaction badges, composer).
  - Floating bottom `SceneDock` with ambient audio player, volume slider, horizontal thumbnail scene picker, and solid color theme switcher.
- Verified in browser with Playwright visual testing at 1440x900 resolution across both illustrated scenes and solid themes.
- 27 test files and all 182 unit tests passing in Vitest.
