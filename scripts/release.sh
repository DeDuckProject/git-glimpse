#!/usr/bin/env bash
set -euo pipefail

if [ $# -ne 1 ]; then
  echo "Usage: $0 <version>"
  echo "Example: $0 1.0.0"
  exit 1
fi

VERSION="$1"

# Strip leading 'v' if provided
VERSION="${VERSION#v}"

# Validate semver format
if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Error: '$VERSION' is not a valid semantic version (expected X.Y.Z)"
  exit 1
fi

MAJOR="${VERSION%%.*}"
TAG="v${VERSION}"
MAJOR_TAG="v${MAJOR}"

# Ensure we're on a clean working tree
if [ -n "$(git status --porcelain)" ]; then
  echo "Error: working tree is not clean. Commit or stash changes first."
  exit 1
fi

# Create the immutable semver tag
if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "Error: tag '$TAG' already exists. Semver tags are immutable."
  exit 1
fi

git tag "$TAG"
echo "Created tag $TAG"

# Force-move the floating major tag
git tag -f "$MAJOR_TAG"
echo "Moved tag $MAJOR_TAG -> $(git rev-parse --short HEAD)"

# Push both tags
git push origin "$TAG"
git push origin "$MAJOR_TAG" --force

echo ""
echo "Release complete:"
echo "  $TAG  (immutable semver tag)"
echo "  $MAJOR_TAG   (floating major tag, force-updated)"
