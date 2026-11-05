#!/usr/bin/env bash
# =============================================================================
# 11Sport - Script Khởi Chạy Nhanh Môi Trường Phát Triển (macOS / Linux)
# Khởi động đồng thời: server (4000), web POS & Kho (3000), cms Quản trị (3001)
# =============================================================================

set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

echo "=== [11Sport DevOps] Kiểm tra môi trường Node.js ==="
node -v
npm -v

# 1. Cài đặt Git Pre-Commit Hook (Graphify) nếu chưa có
PRE_COMMIT_HOOK="$ROOT_DIR/.git/hooks/pre-commit"
PRE_COMMIT_SOURCE="$ROOT_DIR/scripts/pre-commit-graphify.sh"
if [ -f "$PRE_COMMIT_SOURCE" ]; then
  if [ ! -f "$PRE_COMMIT_HOOK" ] || ! grep -q "graphify-pre-commit-hook" "$PRE_COMMIT_HOOK" 2>/dev/null; then
    mkdir -p "$(dirname "$PRE_COMMIT_HOOK")"
    cp "$PRE_COMMIT_SOURCE" "$PRE_COMMIT_HOOK"
    chmod +x "$PRE_COMMIT_HOOK"
    echo "-> Đã cài đặt Git pre-commit hook Graphify (.git/hooks/pre-commit)."
  fi
fi

# 2. Đảm bảo file môi trường (.env / .env.local) tồn tại
if [ ! -f "$ROOT_DIR/server/.env" ] && [ -f "$ROOT_DIR/server/.env.example" ]; then
  cp "$ROOT_DIR/server/.env.example" "$ROOT_DIR/server/.env"
  echo "-> Đã tạo server/.env từ server/.env.example"
fi

if [ ! -f "$ROOT_DIR/web/.env.local" ]; then
  cat > "$ROOT_DIR/web/.env.local" <<EOF
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
NEXT_PUBLIC_WEB_URL=http://localhost:3000
NEXT_PUBLIC_CMS_URL=http://localhost:3001
NEXT_PUBLIC_APP_NAME=11Sport POS & Kho
EOF
  echo "-> Đã tạo web/.env.local trỏ về http://localhost:4000/api/v1"
fi

if [ ! -f "$ROOT_DIR/cms/.env.local" ]; then
  cat > "$ROOT_DIR/cms/.env.local" <<EOF
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
NEXT_PUBLIC_WEB_URL=http://localhost:3000
NEXT_PUBLIC_CMS_URL=http://localhost:3001
NEXT_PUBLIC_APP_NAME=11Sport CMS
EOF
  echo "-> Đã tạo cms/.env.local trỏ về http://localhost:4000/api/v1"
fi

# 3. Kiểm tra & cài đặt node_modules nếu chưa có
for dir in server web cms; do
  if [ ! -d "$ROOT_DIR/$dir/node_modules" ]; then
    echo "-> Đang cài đặt thư viện cho $dir..."
    (cd "$ROOT_DIR/$dir" && npm install)
  fi
done

# 4. Kiểm tra MongoDB (Port 27017)
echo "=== [11Sport DevOps] Kiểm tra MongoDB (Port 27017) ==="
if lsof -iTCP:27017 -sTCP:LISTEN -t >/dev/null 2>&1; then
  echo "-> MongoDB đang chạy tại port 27017."
elif command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  echo "-> Đang khởi động container MongoDB qua Docker..."
  docker compose up -d mongodb || echo "-> Không thể bật Docker MongoDB, server sẽ tự động dùng bộ nhớ fallback."
else
  echo "-> Không tìm thấy MongoDB local/Docker, server sẽ tự động dùng bộ nhớ tạm (in-memory fallback)."
fi

# Dọn dẹp các tiến trình con khi bấm Ctrl+C
cleanup() {
  echo ""
  echo "=== Đang dừng toàn bộ dịch vụ 11Sport... ==="
  kill $(jobs -p) 2>/dev/null || true
  exit 0
}
trap cleanup SIGINT SIGTERM

# 5. Khởi chạy đồng thời 3 dịch vụ
echo "-> Khởi động 11Sport Server API (Port 4000)..."
(cd "$ROOT_DIR/server" && npm run dev) &

echo "-> Khởi động 11Sport Web POS & Kho (Port 3000)..."
(cd "$ROOT_DIR/web" && npm run dev) &

echo "-> Khởi động 11Sport CMS Quản trị (Port 3001)..."
(cd "$ROOT_DIR/cms" && npm run dev) &

echo ""
echo "=== Đã khởi động toàn bộ hệ thống 11Sport (Nhấn Ctrl+C để dừng tất cả) ==="
echo "- Server API : http://localhost:4000/api/v1"
echo "- Web POS/Kho: http://localhost:3000"
echo "- CMS Admin  : http://localhost:3001"
echo ""

wait

