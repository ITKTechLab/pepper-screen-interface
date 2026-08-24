#!/usr/bin/env bash
set -euo pipefail

# Restore workspace to the tagged release 24-august-FUNGERENDE-VERSION
TAG="24-august-FUNGERENDE-VERSION"

echo "Restoring repo to tag $TAG"

# Fetch tags and branches
git fetch --all --tags

# Create or reset local branch release/$TAG to the tag
BRANCH="release/$TAG"
if git show-ref --verify --quiet refs/heads/"$BRANCH"; then
    echo "Branch $BRANCH exists locally — resetting to tag"
    git checkout "$BRANCH"
    git reset --hard "refs/tags/$TAG"
else
    echo "Creating branch $BRANCH from tag"
    git checkout -b "$BRANCH" "refs/tags/$TAG"
fi

# Suggest pushing the branch
echo "Local branch '$BRANCH' now points at tag '$TAG'."
echo "To push to origin run: git push -u origin $BRANCH"

echo "Restore complete (local)." 
