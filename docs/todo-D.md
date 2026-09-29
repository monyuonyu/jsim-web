# まとまり D（シミュレーションの中核）の TODO

対象: basicsim / states / Statistics / Samples / StringProviders / EntityProviders / BooleanProviders / ColourProviders
コードの中の `// TODO(移植)` と対応する。

## ほかの担当に頼むこと（大きいもの）
- **events**: `EventTraceListener`（interface）と `EventManager.setTraceListener` が無い。今は JaamSimModel.start で、あれば呼ぶ形にしてある。
  無いあいだは Simulation の TraceEvents・VerifyEvents（事象の記録と照合）が効かない。（basicsim/JaamSimModel.ts, EventRecorder.ts, EventTracer.ts, EventTraceRecord.ts）
- **全体**: 循環する import の実行時の順番は未解決。Entity.ts → JaamSimModel.ts → DisplayEntity.ts（Entity を継承）のように、
  継承する側が先に評価されると `class X extends Entity` で ReferenceError になる。入口で読み込む順を決めるか、束ねる道具で確かめる必要がある。
- **StateEntity 系（別の担当）**: Seize・EntityProcessor の引数なしの `stateChanged()` が、StateEntity の `stateChanged(prev, next)` と同じ名前になる。どちらかの名前を変える。
- **OutputRegistry**: OutputReturnType に `"String[]"` が無い（StringProvListInput）。
- **ExpParser / ExpEvaluator**: 入れ子のクラスを `ExpParser_Expression`・`ExpEvaluator_EntityParseContext` と仮定している（*ProvExpression）。

## basicsim
- JaamSimModel.ts: スレッドを使わない。`resume()` は止まるまで事象を実行してから戻る。
- RunManager.ts: 反復は 1 つの JaamSimModel で順に流す（getNumberOfThreads は 1）。反復の終わりで次の反復を始めるのは、
  事象の実行が止まって start()・resume() に戻ってから（pendingRuns）。GUI が JaamSimModel.resume() を直接呼ぶと次の反復が始まらないので、
  画面からは RunManager.resume() を呼ぶこと。並行に流した Java とは、報告書（.rep）に書く順がずれることがある。
- JaamSimModel.ts: `createInstance(klass)` は Java では誤りを捨てて null を返す。ここは Log に記録だけ残す（Log の中身が Java と違う）。
- JaamSimModel.ts: 実行の終わりの時刻 `startTicks + initTicks + durationTicks` は、Java では 2^63 を超えると回り込むが、ここは回り込まない（2^53 を超えると精度が落ちる）。
- JaamSimModel.ts: `getPreferenceFolder` は Java の Preferences の代わりに localStorage（あれば）。無ければ "."。
- JaamSimModel.ts・FileEntity.ts: Java の File は道の文字列。読み書きは FileSystem.backend（既定はメモリの中）。Node・ブラウザで差し替える。
- FileEntity.ts・EventRecorder.ts: 改行は "\n"（Java の newLine は OS の改行。Windows では "\r\n"）。
- SimCalendar.ts: グレゴリオ暦は JavaScript の Date（UTC）で数える。1582-10-15 より前（Java はユリウス暦）と紀元前は Java と違う。
- Simulation.ts: PresentTimeAndDate などの「今の時刻」の出力は、Java の SimpleDateFormat の代わりに手で組んだ（英語の月名）。
- EntityTracer.ts: Java の `EventManager.waitSeconds`（スレッドで待つ）を、同じ時刻・優先度・LIFO の予約にした。事象の説明が変わるので、事象の記録・照合の結果は Java と違う。
- EventTraceRecord.ts: `getWaitDescription` は Java では呼び出しのスタックをたどる。待つ書き方が無いので呼ばれない前提で "unknown:unknown"。
- EventTracer.ts: 照合で食い違ったとき、Java は GUIFrame の窓を出し RunManager を止める。ここは Log と標準出力に書いて EventManager を止めるだけ。
- OutputMethod.ts: Java のリフレクションの代わりに、名前と引数の数で関数を探す。double を返す関数が整数の値を返すと、Java は "5.0"、ここは "5"。
- ObjectType.ts: `getIconImage` は画像を扱わない（ImageInput の値をそのまま返す）。

## states / Statistics
- StateEntity.ts: Java は trace 用の File を作り、既にあれば消し、消せなければ error にする。ここは FileEntity に道を渡すだけ（FileEntity が上書きする）。
- StateEntity.ts: getState / isWorkingState / getWorkingTime / getTicksInState / getCurrentCycleTicks は、引数なしの形と出力用（simTime）の形を 1 つの関数にまとめた。
  子のクラスで上書きするときは両方の形を扱う必要がある。
- SampleFrequency.ts・TimeBasedFrequency.ts: Java の配列の範囲外の例外は、ファイルの中の補助関数で IndexOutOfBoundsException にした。

## Samples / StringProviders
- TimeSeries.ts: Java は long の掛け算で桁があふれると回り込む（numberOfCycles が Long.MAX_VALUE のときなど）。TS では回り込まない。
- SampleProvider.getNextSample の thisEnt は Entity 型（null を許さない形）にしたが、Java と同じく実際には null が渡ることがある。
- Java の (int) キャストの代わりの toInt と、利用者の書式に double を渡すための箱（boxDouble）が、いくつかのファイルに重ねて置いてある（Simulation.ts にも toInt）。
  共通部品（java/lang.ts）にまとめるとよい。
- Input.uiSortOrder は、Input.ts の現物に合わせて compare を持つオブジェクトとして使っている。

## EntityProviders / BooleanProviders / ColourProviders
- *ProvInput.ts: `Input.getValue` は、引数なしなら value、3 つなら式の値を返す 1 つの関数と仮定。`Input.getReturnType()` は OutputReturnType の文字列と仮定。
- ClassRegistry.simpleName(entClass) は、登録の無い抽象クラスだと登録のある親の名前を返す。getValidInputDesc と EXP_ERR_CLASS の文のクラス名が Java と変わることがある。
