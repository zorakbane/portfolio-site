#!/usr/bin/env bash
# Build with SITE_BASE and commit dist/ on top of origin/gh-pages (no orphan, no force).
# Each deploy is tagged preview-YYYYMMDD-HHMM in America/New_York so releases are kept.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
BASE="${BASE:-/portfolio-site/}"
echo "Building with BASE=$BASE"
BASE="$BASE" node build.mjs --hide-todos
rm -f dist/CNAME
touch dist/.nojekyll

TMP=$(mktemp -d)
cleanup() {
  git -C "$ROOT" worktree remove --force "$TMP" 2>/dev/null || true
  rm -rf "$TMP"
}
trap cleanup EXIT

# worktree add requires the path to not already exist
rmdir "$TMP"
git fetch origin gh-pages
git worktree add --detach "$TMP" origin/gh-pages
cd "$TMP"

# Replace published files, keep .git
find . -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -a "$ROOT/dist/." .
rm -f CNAME
touch .nojekyll

git add -A
if git diff --cached --quiet; then
  echo "No preview content changes; skipping commit."
else
  git -c user.name="Derick Janssen" -c user.email="zorakbane@yahoo.com" \
    commit -m "Deploy preview $(TZ=America/New_York date '+%Y-%m-%d %H:%M %Z')"
fi

TAG="preview-$(TZ=America/New_York date +%Y%m%d-%H%M)"
if git rev-parse -q --verify "refs/tags/$TAG" >/dev/null; then
  TAG="${TAG}-$(git rev-parse --short HEAD)"
fi
git -c user.name="Derick Janssen" -c user.email="zorakbane@yahoo.com" \
  tag -a "$TAG" -m "Preview deploy $TAG"
# Fast-forward only: never force-push, never rewrite gh-pages history.
git push origin HEAD:gh-pages
git push origin "$TAG"
echo "Pushed gh-pages (tag $TAG). Preview: https://zorakbane.github.io/portfolio-site/"
