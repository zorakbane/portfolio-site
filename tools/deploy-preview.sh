#!/usr/bin/env bash
# Build with SITE_BASE and force-push dist/ to origin/gh-pages for github.io preview.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
BASE="${BASE:-/portfolio-site/}"
echo "Building with BASE=$BASE"
BASE="$BASE" node build.mjs --hide-todos
rm -f dist/CNAME
touch dist/.nojekyll

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
# Flatten: copy dist contents only (no nested dist/)
cp -a dist/. "$TMP/"
cd "$TMP"
git init -q
git checkout -q -b gh-pages
git add -A
git -c user.name="Derick Janssen" -c user.email="zorakbane@yahoo.com" commit -qm "Deploy preview $(date -u +%Y-%m-%dT%H:%MZ)"
git push -qf "https://github.com/zorakbane/portfolio-site.git" gh-pages:gh-pages
echo "Pushed gh-pages. Preview: https://zorakbane.github.io/portfolio-site/"
