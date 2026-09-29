# まとまり E（ProcessFlow）の移植の決めごと（担当者どうしで共通）

## 必ず読むもの
- /home/shota/jsim-web/docs/PORTING.md（全部。特に 2〜7 と 10）
- 手本（もう移したもの。書き方をこれに合わせる）:
  /home/shota/jsim-web/src/jaamsim/ProcessFlow/ の LinkedComponent.ts, AbstractStateUserEntity.ts, StateUserEntity.ts, Device.ts,
  LinkedDevice.ts, LinkedService.ts, Queue.ts, EntStorage.ts, MappedTreeSet.ts, ProcessorData.ts,
  Linkable.ts, EntityGen.ts, QueueUser.ts, EntContainer.ts
- ほかの担当の物はかなり移し終わっている（src/jaamsim/ の basicsim, Graphics, states, input, Samples, units, math,
  resourceObjects, BasicObjects, Statistics, StringProviders, EntityProviders, BooleanProviders ...）。
  import する関数・コンストラクタの名前と引数は、**実物の .ts を開いて**合わせる（Java の多重定義を別の名前にしている所がある。
  /home/shota/jsim-web/docs/renamed.md も見る）。まだ無い物は Java と同じ名前・同じパスで import してよい。

## 目的
Java 版と**まったく同じ結果**。事象の予約の順番（scheduleTicks の優先度・FIFO/LIFO）、乱数を引く順番、状態の切り替えの順番、
計算の順番を、1 行ずつ Java と見比べて同じにする。関数を省略・要約しない。

## 書き方
- 著作権の見出し: `/tmp/jsim_hdr.sh <Java ファイル>` の出力をそのまま先頭に置く（元の注記＋「TypeScript への移植 (C) 2026 shota」）。
- 初期化ブロック `{ ... }` はコンストラクタの `super()` の直後に同じ順で。キーワードの説明は入力を作った直後に
  `this.setKeywordDoc(input, "説明（英語のまま、tr で包まない）", ["例", ...])`（例が無ければ `[]`）。
- 親の static 定数は `Entity.KEY_INPUTS` `Entity.OPTIONS` `Entity.FORMAT` `Entity.GRAPHICS` `Entity.PRI_NORMAL` `Entity.PRI_HIGH`
  `Entity.PRI_LOW` `Entity.EVT_FIFO` `Entity.EVT_LIFO`、`StateEntity.STATE_IDLE` など、`AbstractStateUserEntity.STATE_BLOCKED` などと、定義したクラス名から書く。
- `override` を必ず付ける（noImplicitOverride）。Java の private/package-private の関数を、入れ子のクラスや別のクラスから呼ぶなら public にする。
- 入れ子のクラス `Foo.Bar` → 同じファイルの `class Foo_Bar`（内側の非 static クラスは外側の物をコンストラクタで受け取る）。
  無名の EntityTarget は `new (class extends EntityTarget<Foo> { override process(): void { this.ent.xxx(); } })(this, "xxx")`。
- Java の `Conditional` は TS では interface（`evaluate(): boolean`）。`class X implements Conditional`。
- `(int) x`（double→int）は Java と同じ切り捨て・端の丸め: Queue.ts の `jint` 関数をファイルに写して使う。int どうしの `/` は `Math.trunc(a / b)`。
- 文字列: double を文字列にする所は必ず `jstr(x)`（`"" + x`、`%s` に double を渡す所、trace の引数も）。String.format → `jformat`。
- 誤りの文（PORTING 10）: `this.error(tr("…%s…"), 引数...)`、`throw new InputErrorException(tr("…%s…"), 引数...)`（InputErrorException は中で jformat する。
  jformat で包まない）。位置つきは `new InputErrorException(pos, src, tr(msg))`。`new ErrorException(...)` も同様に tr。
  trace（`this.trace(0, "…", …)`・`traceLine`）の文は記録なので tr で包まない。
- @Output → ファイルの最後で `defineOutput(クラス, { name, description, unitType, reportable, sequence, returnType, get })`。
  returnType は Java の戻り値の型: "double" "long" "int" "boolean" "String" "Entity"（DisplayEntity なども）"ArrayList" "LinkedHashMap" "double[]" "int[]" "Vec3d" "Color4d" など。
  unitType が Java で省略なら書かない。
- 抽象でないクラスはファイルの最後で `ClassRegistry.register("com.jaamsim.ProcessFlow.Xxx", Xxx);`（`../java/ClassRegistry.ts`）。

## インターフェース（instanceof と Class の代わり）
- このまとまりの Linkable・EntityGen・QueueUser・EntContainer・RandomStreamUser は「同じ名前の interface ＋ const」。
  `implements Linkable` のクラスは、ファイルの最後で `Linkable.register(Xxx);`（子クラスにも効く。親で登録済みなら不要）。
  `x instanceof Linkable` はそのまま書ける（Symbol.hasInstance）。Java の `Linkable.class` を渡す所（InterfaceEntityInput など）は `Linkable` を渡す。
  `isLinkable(x)` などの関数もある。
- ほかの担当のインターフェースは、その .ts の書き方に従う:
  SubjectEntity → `isSubjectEntity(o)`（Class の代わりは LinkedService.ts の SubjectEntityClass のように自分のファイルに作る）、
  ObserverEntity → const `ObserverEntity.validate(...)` `ObserverEntity.registerWithSubjects(...)` と `isObserverEntity(o)`、
  ResourceUser → `ResourceUser.register(Cls)` と `instanceof ResourceUser`、LineEntity・FillEntity → `LineEntity.isInstance(o)` など、
  StateUser → `isStateUser(o)`、StateEntityListener → `isStateEntityListener(o)`、DowntimeUser → `isDowntimeUser(o)`。
  実物の .ts を見て確かめる。`getJaamSimModel().getClonesOfIterator(Entity, iface)` の iface は判定の関数（例 `(o) => o instanceof QueueUser`）。

## もう決めた多重定義（呼ぶ側はこれに合わせる）
- `setPresentState()`（引数なし、状態を計算）と StateEntity の `setPresentState(String)` は 1 つ: `override setPresentState(state?: string)`。
  子で上書きするときは、最初に `if (state !== undefined) { super.setPresentState(state); return; }` を書き、その後に Java の setPresentState() の中身。
- `isBusy()` `isIdle()` `isSetup()` `isSetdown()` `isMaintenance()` `isBreakdown()` `isStopped()` は引数なし（出力の (double) 版は同じ関数にまとめた）。
- Device: final の `updateProgress()` → `updateProgressToNow()`。abstract の `updateProgress(dt)` は元の名前。
- LinkedComponent: `getNumberInProgress(simTime?)`。LinkedService: `getMatchValue(simTime?)`、
  `moveToProcessPosition(ent)`（1 引数は LinkedService の、2 引数は DisplayEntity の）。
- Queue: `removeFirst(m = null, serv?, simTime?, ent?)`、`getFirst(m = null, serv?, simTime?, ent?)`、`getCount(m = null)`、`isEmpty(m = null)`、
  `getEntityList(m = null)`、`getPosition(DisplayEntity)` → `getPositionOf(ent)`、`getEntityTypes()` は Java の Set の代わりに string[]（Java の HashMap と同じ順番）。
- EntStorage: `size(type = null)` `isEmpty(type = null)` `first(type = null)` `iterator(type = null)`（JIterator: hasNext/next。無い type は null）
  `getEntries(type = null)` `getTypes(): string[]` `getEntityList(type = null)`。StorageEntry は `EntStorage_StorageEntry`（`EntStorage.StorageEntry` でも可）、
  比べるのは `compareTo`。フィールド entity/type/priority/seqNum/timeAdded。
- MappedTreeSet・JIterator・JavaHashOrder（Java の HashMap<String,…> を回す順番を再現）は MappedTreeSet.ts にある。
  **HashMap/HashSet を回して、その順番が結果に効く所**は、キーが文字列なら JavaHashOrder を使う。それ以外は `// TODO(順番): …`。
  LinkedHashMap は Map（入れた順）でよい。TreeMap/TreeSet は java/collections.ts。
- 自分で多重定義を分けて名前を変えたら /home/shota/jsim-web/docs/renamed.md の末尾に 1 行追記
  （形式: `- \`クラス.元の名前(引数の型)\` → \`新しい名前\`（理由）（担当: E）`）。ファイル全体を書き直さない。

## 描画（PORTING 7）
- render・GUI の呼び出しは消して `// 描画: 省略（three.js の画面を作るときに）`。ただし入力（Keyword）と、状態（位置・大きさ・向き・色の値、
  表示するかどうか）の計算は残す（例: Queue.updateGraphics は並んだ物の位置の計算なので残した）。

## やってはいけないこと
- 自分の担当のファイル以外は作らない・変えない（docs/renamed.md と docs/todo-E.md への追記は除く）。手本のファイル（上に挙げた物）を
  直す必要があると思ったら、直さずに報告に書く。
- git のコミットはしない。

## 後回し・自信のない所
`// TODO(移植): 理由` と書き、/home/shota/jsim-web/docs/todo-E.md の末尾に `- ファイル名: 内容` を 1 行ずつ追記。

## 確かめ
`cd /home/shota/jsim-web && npx tsc --noEmit --pretty false 2>&1 | grep -E "ProcessFlow/(ファイル名|…)"` で、自分のファイルの誤りを直す。
まだ無いほかの担当のファイル（Cannot find module）と、それから連なる誤りは気にしない。
ほかの担当のファイルの誤り（例: EntityProvInput の isValid が private で Input<unknown> に渡せない）は直さずに報告へ。

## 報告（日本語、短く）
移したファイル、名前を変えた関数、TODO の数と主な中身（特に結果の一致に効きそうなもの）、手本のファイルやほかの担当への要望。
