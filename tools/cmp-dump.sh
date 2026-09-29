#!/bin/bash
# Java と TS の全出力を比べる。シミュレーションの結果に関係しない行（今の時刻・字体・3D のファイルの場所・日付の月の名前）は除く
# 使い方: tools/cmp-dump.sh java.dump ts.dump
ign='\.(PresentTimeAndDate|PresentDate|PresentTime|ColladaFile|FontName|ImageFile|RealTime\w*|ElapsedRealTime\w*|RunTime\w*)\t'
diff <(grep -vP "$ign" "$1") <(grep -vP "$ign" "$2")
