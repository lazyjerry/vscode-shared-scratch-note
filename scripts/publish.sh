#!/usr/bin/env bash
# 發布 Shared Scratch Note 到 VS Code Marketplace。
#
# 與 build 分離：build（npm run check / package:vsix）只產生並驗證本機 artifact，
# 不因為環境中存在 VSCE_PAT 就隱含上傳。上傳只發生在本腳本，且必須顯式執行。
#
# 用法：
#   ./scripts/publish.sh              # 發布目前 package.json 的版本
#   ./scripts/publish.sh patch        # 先 bump patch 版本再發布
#   ./scripts/publish.sh minor|major
#   DRY_RUN=1 ./scripts/publish.sh    # 只打包與驗證，不上傳
#
# 認證：先 `npx vsce login <publisher>`，或設定 VSCE_PAT 環境變數。
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

bump="${1:-}"
dry_run="${DRY_RUN:-0}"

case "$bump" in
  "" | patch | minor | major) ;;
  *)
    echo "publish: 版本參數只接受 patch / minor / major，收到 '$bump'" >&2
    exit 1
    ;;
esac

# 版本一旦發布無法覆蓋，工作區必須乾淨才能對應到可追溯的 commit。
if [ -n "$(git status --porcelain)" ]; then
  echo "publish: 工作區有未提交的變更，請先提交或暫存" >&2
  git status --short >&2
  exit 1
fi

echo "==> 檢查與建置"
npm run check

echo "==> 打包 vsix"
npx vsce package --no-dependencies

version="$(node -p "require('./package.json').version")"
vsix="shared-scratch-note-${version}.vsix"
[ -f "$vsix" ] || { echo "publish: 找不到 $vsix" >&2; exit 1; }

echo "==> 安裝 vsix 到本機 VS Code 驗證"
if command -v code >/dev/null 2>&1; then
  code --install-extension "$vsix" --force
  echo "    已安裝 $vsix，請在 VS Code 執行 Shared Scratch Note: Open 確認後再繼續。"
else
  echo "    找不到 code CLI，請手動安裝 $vsix 驗證（VS Code 內執行 Shell Command: Install 'code' command in PATH）。"
fi

if [ "$dry_run" = "1" ]; then
  echo "==> DRY_RUN=1，止於此，未上傳"
  exit 0
fi

read -r -p "確認上傳 $vsix 到 Marketplace？版本發布後無法覆蓋。輸入 yes 繼續：" answer
[ "$answer" = "yes" ] || { echo "publish: 已取消"; exit 1; }

echo "==> 發布"
if [ -n "$bump" ]; then
  # vsce 會自行 bump 版本、建立 commit 與 tag，再上傳。
  npx vsce publish "$bump" --no-dependencies
else
  npx vsce publish --no-dependencies
fi

echo "==> 完成。Marketplace 驗證約需 5-10 分鐘才會上架。"
echo "    https://marketplace.visualstudio.com/manage/publishers/workjerry"
