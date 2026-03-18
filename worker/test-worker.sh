#!/bin/bash

# Cloudflare Worker テストスクリプト

WORKER_URL="https://your-worker.workers.dev"
API_KEY="your-api-key-here"

echo "=== Chat Completions API テスト ==="

# テスト 1: ストリーミングリクエスト
echo -e "\n1. ストリーミングチャットリクエストをテスト中..."
curl -X POST "${WORKER_URL}/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${API_KEY}" \
  -d @test-simple-chat.json \
  -v

echo -e "\n\n=== テスト完了 ==="
