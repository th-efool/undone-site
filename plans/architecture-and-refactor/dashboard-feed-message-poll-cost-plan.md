# Dashboard feed and message polling cost plan

## Scope

- Stop speculative `/api/feed` requests from the dashboard shell. Feed data should load when the user opens Play and its feed is needed.
- Stop the active-channel 2.5-second message polling timer while `document.visibilityState` is hidden; immediately refresh and restart polling when visible.
- Leave studyroom lease renewal and its 90-second lease contract unchanged.

## Implementation

1. Remove the dashboard shell's automatic `prefetchDefaultFeed` call. Keep the separate cached Explore warmup unchanged.
2. In `useMessage`, own the polling timer explicitly. Start it only while visible; clear it while hidden; perform a refresh on visibility return/focus. Guard overlapping poll requests and retain cleanup on channel changes/unmount.
3. Update the relevant operational memory entry with the new request behavior and verification status.

## Acceptance

- Visiting the dashboard does not POST to `/api/feed` solely for speculative prefetch.
- An active message channel polls every 2.5 seconds while visible, performs no poll requests while hidden, and refreshes when visible again.
- Changing channel/unmounting clears timers/listeners; room lease renewal code is untouched.
- Do not run tests unless requested; inspect the final diff and report verification limits.
