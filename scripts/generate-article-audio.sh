#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: npm run audio:generate -- <pageId>"
  exit 1
fi

PAGE_ID="$1"
APP_URL="${APP_URL:-http://localhost:3000}"

curl --fail --show-error --silent \
  -X POST "$APP_URL/api/article-audio" \
  -H 'Content-Type: application/json' \
  -d "{\"pageId\":\"$PAGE_ID\"}"
echo
