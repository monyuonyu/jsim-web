#!/bin/bash
# JaamSim の例題を全部、Java 版と TS 版で流して全出力を比べる（1 つ 300 秒まで）
# 結果: test/examples-run/<例題>.{java,ts}.dump と、一覧 test/examples-run/summary.txt
set -u
SRC=$HOME/jaamsim-src/src/main/resources/resources/examples
OUT=$HOME/jsim-web/test/examples-run
J=$HOME/opt/jdk-25.0.4.1+1/bin/java
CP=$HOME/jaamsim-src/build/jars/JaamSim2026-05.jar:$HOME/jsim-web/ref
rm -rf "$OUT"; mkdir -p "$OUT"; cp -r "$SRC" "$OUT/models"
: > "$OUT/summary.txt"
find "$OUT/models" -name "*.cfg" | sort | while read -r cfg; do
	name=$(realpath --relative-to="$OUT/models" "$cfg" | tr '/ ' '__')
	dir=$(dirname "$cfg")
	(cd "$dir" && timeout 600 "$J" -XX:+UnlockDiagnosticVMOptions -XX:-UseLibmIntrinsic -Djava.awt.headless=true -cp "$CP" RefDump "$cfg" > "$OUT/$name.java.dump" 2>&1)
	(cd "$dir" && timeout 600 node --import tsx "$HOME/jsim-web/tools/dump-model.ts" "$cfg" > "$OUT/$name.ts.dump" 2>&1)
	nj=$(wc -l < "$OUT/$name.java.dump"); nt=$(wc -l < "$OUT/$name.ts.dump")
	nd=$("$HOME/jsim-web/tools/cmp-dump.sh" "$OUT/$name.java.dump" "$OUT/$name.ts.dump" | grep -c '^<')
	if [ "$nj" -le 2 ] || [ "$nt" -le 2 ]; then st="動かない"; elif [ "$nd" -eq 0 ]; then st="一致"; else st="違う"; fi
	printf "%s\t%s\tJava %s 行\tTS %s 行\t違う %s 行\n" "$st" "$name" "$nj" "$nt" "$nd" >> "$OUT/summary.txt"
done
echo "終わり"; cut -f1 "$OUT/summary.txt" | sort | uniq -c
