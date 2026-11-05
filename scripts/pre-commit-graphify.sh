#!/usr/bin/env sh
# graphify-pre-commit-hook
# =============================================================================
# 11Sport - Git Pre-Commit Hook: Tự động cập nhật đồ thị Graphify trước khi commit
# Luồng: Quét AST code thay đổi -> Cập nhật graphify-out/ -> git add -> Commit
# =============================================================================

export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
if [ -n "$USERPROFILE" ]; then
    export PATH="$USERPROFILE/.local/bin:$PATH"
fi

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$REPO_ROOT" || exit 0

echo "=== [11Sport Graphify] Dang cap nhat do thi tri thuc truoc khi commit... ==="

if command -v graphify >/dev/null 2>&1; then
    graphify update . --force
elif command -v uv >/dev/null 2>&1; then
    uv tool run --from graphifyy graphify update . --force
else
    echo "-> [Graphify] Canh bao: Chua tim thay CLI 'graphify'. Bo qua buoc cap nhat do thi."
    exit 0
fi

if [ -d "graphify-out" ]; then
    git add graphify-out/
    echo "-> [Graphify] Da cap nhat va git add graphify-out/ vao commit hien tai."
fi

exit 0
