#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="${0:A:h}"
TARGET="${SCRIPT_DIR}/../src/dianxiaomi-automation-v1-merged-new.user.js"

if [[ ! -f "$TARGET" ]]; then
  echo "找不到主插件脚本：$TARGET"
  read -r "?按回车关闭..."
  exit 1
fi

/usr/bin/pbcopy < "$TARGET"

VERSION_LINE="$(grep -m 1 '@name' "$TARGET" | sed 's#// @name[[:space:]]*##')"
echo "已复制到剪贴板：${VERSION_LINE:-DXM Automation V1}"
echo "现在可以去 Tampermonkey 编辑器粘贴覆盖。"
read -r "?按回车关闭..."
