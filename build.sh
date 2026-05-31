#!/usr/bin/env bash
# build.sh — Build Next.js and package for Firebase Cloud Functions
set -euo pipefail

echo "=== Step 1: Build Next.js ==="
npm run build

echo "=== Step 2: Package for Cloud Functions ==="

# Clean previous artifacts
rm -rf functions/.next functions/public

# Copy the .next build output
cp -r .next functions/.next

# Copy public assets (for static file serving)
if [ -d "public" ]; then
  mkdir -p functions/public
  cp -a public/. functions/public/ 2>/dev/null || true
fi

# Copy Next.js config files needed by next() at runtime
cp next.config.ts functions/
cp tsconfig.json functions/
cp package.json functions/

# Install function production deps (includes next)
cd functions
npm install --omit=dev
cd ..

echo "=== Build complete ==="
