#!/usr/bin/env bash
# Build the production site (BASE=/, CNAME included) and push dist/ to
# zorakbane/portfolio-site-public. History is appended; never force-push.
# This script does not enable GitHub Pages, set a custom domain, or change DNS.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PUBLIC_REMOTE="${PUBLIC_REMOTE:-https://github.com/zorakbane/portfolio-site-public.git}"
PUBLIC_BRANCH="${PUBLIC_BRANCH:-main}"

echo "Building production site with BASE=/ PUBLISH_CNAME=1"
BASE=/ PUBLISH_CNAME=1 node build.mjs --hide-todos
touch dist/.nojekyll

cat > "$ROOT/dist/README.md" << 'README'
# derickjanssen.com (built site)

This repository contains **only the compiled website**: HTML, CSS, JavaScript, images, and the downloadable resume.

It is the production build output of a separate private source repository. Files here are generated and overwritten on each deploy — please don't send content or design changes to this repo.
README

TMP=$(mktemp -d)
cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT

echo "Fetching $PUBLIC_REMOTE ($PUBLIC_BRANCH)"
if git ls-remote --heads "$PUBLIC_REMOTE" "$PUBLIC_BRANCH" | grep -q .; then
  git clone --branch "$PUBLIC_BRANCH" --single-branch "$PUBLIC_REMOTE" "$TMP"
else
  git clone "$PUBLIC_REMOTE" "$TMP"
  git -C "$TMP" checkout -B "$PUBLIC_BRANCH"
fi

cd "$TMP"
find . -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -a "$ROOT/dist/." .

git add -A
if git diff --cached --quiet; then
  echo "No public content changes; skipping commit."
else
  git -c user.name="Derick Janssen" -c user.email="zorakbane@yahoo.com" \
    commit -m "Deploy production $(TZ=America/New_York date '+%Y-%m-%d %H:%M %Z')"
fi

if ! git rev-parse --verify --quiet HEAD >/dev/null; then
  echo "Nothing to publish (empty tree)." >&2
  exit 1
fi

TAG="release-$(TZ=America/New_York date +%Y%m%d-%H%M)"
if git rev-parse -q --verify "refs/tags/$TAG" >/dev/null \
  || git ls-remote --tags origin "refs/tags/${TAG}" | grep -q .; then
  TAG="${TAG}-$(git rev-parse --short HEAD)"
fi
git -c user.name="Derick Janssen" -c user.email="zorakbane@yahoo.com" \
  tag -a "$TAG" -m "Production deploy $TAG"

# Fast-forward only: never force-push, never rewrite public history.
git push origin "HEAD:${PUBLIC_BRANCH}"
git push origin "$TAG"
echo "Pushed ${PUBLIC_BRANCH} (tag $TAG) to $PUBLIC_REMOTE"
echo "Did not enable GitHub Pages, set a custom domain, or change DNS."
