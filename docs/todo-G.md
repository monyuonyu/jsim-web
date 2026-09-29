# まとまり G（BasicObjects・resourceObjects）の後回し・自信の無い所

## 後回し
- ExternalProgramServer: 立ち上げたままの外部プログラムと同期で 1 行ずつやり取りする仕組みが Node.js に無い。
  `BasicObjects/BasicObjectsIO.ts` の既定の startServerProcess は「使えない」誤りを出す（Worker＋Atomics.wait で作れる）。

## 自信の無い所・Java とずれうる所
- AbstractResourceProvider.notifyResourceUsers: 並べ替えの比べる関数が getPriority()（式の評価）を呼ぶ。
  比べる回数・順番が Java の TimSort と違うと、式の副作用（乱数など）がずれうる。V8 も TimSort だが未確認。ResourcePool.seize の並べ替えも同じ。
- ExternalProgram: Java は TimeOut を過ぎてもプログラムを止めず、読み取りで終わるまで待つ。既定の実装も止めない（同じ振る舞い）。
- ExpressionStatistics.recordValue: `(int) Math.round(x)` は、int に収まらないとき Java は下位 32 ビットを取るが、TS は端に張り付く。
- FileToHashMap.setValue(Map): Java で HashMap を渡したときの順番は HashMap の順番（TS では渡した Map の順番）。
- (int) の型変換は各ファイルの中の toInt（NaN→0、範囲の外は端）。共通の部品（java/lang.ts）に jint のようなものがあれば置き換えたい。

## ほかの担当に関係する前提
- FileInput の値（Java の URI）は `uriToPath`（BasicObjectsIO.ts）で道筋にする。文字列・URL・getPath() を持つもの を受ける。
- Logger: `new FileEntity(simModel, ファイルの道筋の文字列)`。古い .log ファイルの削除は BasicObjectsIO（差し替え可）。
- InputCallback は `{ callback(ent, inp) }` の形のオブジェクトとして渡している。
- InterfaceEntityListInput には、interface の Class の代わりに Symbol.hasInstance を持つ値を渡す（ResourceProvider、ファイルの中の SubjectEntityClass）。
- getClonesOfIterator(proto, iface) には判定の関数（isResourceUser・isSeizable・isDowntimeUser）を渡す。
- ExpressionLogger: IntegerListInput が addInput に渡せない（input 担当の setDefaultValue の型。Input<unknown> と合わない）。
- InputValue（TextBasics）・ToggleButton（GameEntity）・ExternalProgramServer（JSON）は、親や部品のファイルがまだ無いので型の確認が済んでいない。
