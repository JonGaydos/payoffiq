#!/bin/bash
# Run this script ONCE after any fresh git init to wire up GitHub correctly.
# Usage: bash setup-git.sh YOUR_GITHUB_TOKEN

TOKEN=$1
if [ -z "$TOKEN" ]; then
  echo "Usage: bash setup-git.sh YOUR_GITHUB_TOKEN"
  exit 1
fi

set -e  # Exit immediately on any error

echo "==> Setting remote..."
git remote remove origin 2>/dev/null || true
git remote add origin "https://JonGaydos:${TOKEN}@github.com/JonGaydos/MortgageIQ.git"

echo "==> Ensuring workflow file exists with master branch trigger..."
mkdir -p .github/workflows
cat > .github/workflows/docker-publish.yml << 'EOF'
name: Build and Publish Docker Image

on:
  push:
    branches:
      - master
  workflow_dispatch:

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Log in to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata (tags and labels)
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=raw,value=latest,enable={{is_default_branch}}
            type=sha,prefix=sha-

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
EOF

echo "==> Staging and pushing..."
git add .
git branch -M master
git diff --cached --quiet && echo "(nothing new to stage)" || git commit -m "Setup: add workflow and configure remote"
git push origin master --force

echo ""
echo "✅ Done! Check https://github.com/JonGaydos/MortgageIQ/actions for the build."
