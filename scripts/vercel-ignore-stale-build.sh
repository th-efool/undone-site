#!/usr/bin/env bash
# Vercel Ignored Build Step for rapid-push coalescing.
#
# Configure this command in Vercel > Project Settings > Build and Deployment
# > Ignored Build Step:
#   bash scripts/vercel-ignore-stale-build.sh
#
# Vercel's Git checkout is shallow, so query the remote branch head directly.
# Vercel's convention: exit 0 = skip build; exit 1 = build.

set -uo pipefail

WAIT_SECONDS="${VERCEL_BUILD_DEBOUNCE_SECONDS:-180}"
BRANCH="${VERCEL_GIT_COMMIT_REF:-}"
COMMIT="${VERCEL_GIT_COMMIT_SHA:-}"

if [[ -z "$BRANCH" || -z "$COMMIT" ]]; then
  echo "Missing Vercel Git metadata; proceeding with build for safety."
  exit 1
fi

if ! [[ "$WAIT_SECONDS" =~ ^[0-9]+$ ]]; then
  echo "Invalid VERCEL_BUILD_DEBOUNCE_SECONDS='$WAIT_SECONDS'; proceeding with build."
  exit 1
fi

echo "Debouncing deployment for ${WAIT_SECONDS}s (branch=$BRANCH commit=$COMMIT)."
sleep "$WAIT_SECONDS"

REMOTE_HEAD="$(git ls-remote --heads origin "refs/heads/$BRANCH" 2>/dev/null | awk 'NR == 1 {print $1}')"

if [[ -z "$REMOTE_HEAD" ]]; then
  echo "Could not resolve remote branch head; proceeding with build for safety."
  exit 1
fi

if [[ "$REMOTE_HEAD" != "$COMMIT" ]]; then
  echo "Skipping stale commit $COMMIT; latest branch head is $REMOTE_HEAD."
  exit 0
fi

echo "Commit $COMMIT is still the latest branch head; proceeding with build."
exit 1
