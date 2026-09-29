# まとまり E の TODO

- AbstractLinkedResourceUser.ts: Java は getServiceDuration・getServicePerformed・getFractionCompleted を @Output なしで上書きして出力 ServiceDuration などを「消す」。TS の出力の表（OutputRegistry）には消す仕組みが無く、Seize では 0 を返す出力として残る（EntityProcessor は同じ名前で定義し直すので問題なし）。OutputRegistry に「出力を消す」印（例 hideOutput(cls, name)）が要る
- EntityGenerator.ts: 同じく出力 MatchValue を消す上書き。TS では null を返す出力として残る
- EntityProcessor.ts: getStepDuration で全部済み＋ReleaseThreshold 閉のとき Long.MAX_VALUE tick（TS は 2^53-1、Java は 2^63-1）。どちらも実質「無限に待つ」だが、秒にした値と endTicks の大きさが Java と違う
- EntityLauncher.ts: GameObjects/GameEntity.ts がまだ無い（Java と同じパスで import した）
- AbstractCombine.ts: getMatchValue(double) を @Output なしで上書きして出力 MatchValue を「消す」所。TS では null を返す出力として残る（AbstractLinkedResourceUser と同じく OutputRegistry に消す仕組みが要る）
- EntityConveyor.ts: Java では @Output の無い上書き（getMatchValue(double)・getServiceDuration・getServicePerformed）で出力 MatchValue・ServiceDuration・ServicePerformed が消えるが、OutputRegistry に出力を消す仕組みが無いので残っている（値は null/0 を返す）。出力の一覧・報告書に余分な行が出る（FractionCompleted は子で定義し直したので正しい）
- Statistics.ts: (int) Math.round(val/binWidth) を jint(Math.round(...)) にした。int の範囲の外では Java（long の下位 32 ビット）と違う
