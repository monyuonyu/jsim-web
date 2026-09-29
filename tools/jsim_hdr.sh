#!/bin/bash
# 使い方: /tmp/jsim_hdr.sh <Java ファイルのパス>  → TS 用の著作権の見出しを出す
f="$1"
end=$(grep -n '^ \*/' "$f" | head -1 | cut -d: -f1)
last=$(sed -n "1,${end}p" "$f" | grep -n 'Copyright' | tail -1 | cut -d: -f1)
sed -n "1,${last}p" "$f"
echo " * TypeScript への移植 (C) 2026 shota"
sed -n "$((last+1)),${end}p" "$f"
