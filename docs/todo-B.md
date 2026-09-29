# まとまり B（式の言語）の後回し・自信の無い所

対象: `src/jaamsim/input/` の ExpCollections ExpError ExpEvaluator ExpOperators ExpParser ExpResType ExpResult
ExpTokenizer ExpValResult ExpressionHandle ExpressionInput ExpressionListInput（12 ファイル）

## ほかの担当・全体に関係すること

- **循環 import**: `ExpEvaluator.ts` は `ExpParser` のクラスを extends する。`ExpParser.ts` を最初に読み込むと
  ExpParser → ExpCollections → ExpEvaluator の順になり、extends で TDZ の誤りになる。ExpEvaluator（か Entity）を先に読み込むこと。
  ExpParser の演算子・関数の表（Java の static 初期化）は、初めて引くときに作るようにして循環を避けた。
- **全体の循環**: 今の作りでは `units/Unit.ts` → `basicsim/Entity.ts` → … → `DimensionlessUnit`（extends Unit）の循環で、
  どこから読み込んでも `Cannot access 'Unit' before initialization` になる（2026-09-30 時点）。B の試験は、
  Entity・Input などを小さな代わりに差し替えた写し（/tmp）で流して通した。全体の読み込み順を決める必要がある。
- **lang.ts の jformat**: `%+e` の `+` を無視する（Java は `+1.2e-04`）。format 関数の結果が変わる。直すのは共通部品の担当。
- 単位の掛け算・割り算の表（Unit.getMultUnitType）は、すべての単位のクラスが読み込まれている前提。

## TODO(移植)

- ExpParser.fixError: Java の NullPointerException などは JS では TypeError になり、メッセージの文が違う（誤りのときだけ）。
- ExpOperators の split: 正規表現は JS の RegExp で読む。Java と書き方が違う正規表現は結果が違う。正規表現の誤りのメッセージも違う。
- ExpOperators の format: `%<`・`%t`・`%h`・`%a` と、Java がフラグの組み合わせを咎める所は写していない。
  そのほか（%s %d %f %e %g %x %c %b %n %%、%1$s、足りない引数・型の違いの誤りのメッセージ）は Java と同じにした。
- ExpCollections.ArrayCollection: Java の List<Boolean> と boolean[] を JS では見分けられないので、真偽値は 1/0 にする。
- ExpCollections.MapCollection: Java は数の鍵を Double で引く（Integer の鍵の地図は引けない）。JS の Map は数ならどちらでも引ける。

## TODO(順番)

- 地図の式（`{"a" = 1}`）と、その写しは、Java の HashMap と同じ順番で回る `StringHashMap`（ExpCollections.ts）にした。
  ただし表が 64 以上で 1 つの箱に 8 個を超える（木にする）場合は写していない。
- 出力が返す地図（MapCollection）は JS の Map の順番（足した順）。Java の HashMap を返す出力は順番が違う。
  Java と同じ順番にしたい出力は `StringHashMap` を返すとよい。
- ExpEvaluator.EntityParseContext.getUpdatedSource: Java は HashMap<Entity, String> の順（実体の hash）で名前を置き換える。

## Java と同じにするために写したもの

- sort 関数: 比べ方が一貫しない（0 を返さない）ので、java.util.TimSort をそのまま写した（ExpOperators.ts の javaListSort）。
  「Comparison method violates its general contract!」も同じ条件で出る。
- round 関数（Java の Math.round: -0.4 は 0.0、NaN は 0、long の範囲に収める）、(int) の変換、String.trim、String.split。

## 試験

`test/B-expressions.test.ts`（字句の分け方と、149 個の式を Java 版と比べる）。正解は `test/B-exp.ref.txt`。
正解の作り方: JaamSim2026-05.jar に対して、`com.jaamsim.input` の中に、試験と同じ ParseContext（単位 m km s min h deg、
TRUE・FALSE の定数）を持つ小さなクラスを書き、各行を `ExpParser.parseExpression` → `evaluate` → `getOutputString(null)`
（誤りは「ERR 位置 メッセージ」）で出す。単位のクラスは Class.forName で先に初期化しておく（Java は遅れて初期化するため）。
