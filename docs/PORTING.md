# JaamSim → TypeScript 移植の約束ごと

元: `~/jaamsim-src`（JaamSim v2026-05、Java。`src/main/java/com/jaamsim/`）
先: `~/jsim-web/src/jaamsim/`（TypeScript）

目的は **Java 版と同じ結果を出すこと**（同じモデルを流して、数が小数の最後の桁まで一致する）。
見た目の書き直しや改良は、移植が終わって一致を確かめた後にする。移植の段階では、書き換えたくなっても元の作りに合わせる。

## 1. 置き場と名前

- **1 つの Java ファイル → 1 つの TS ファイル**。パッケージの並びをそのまま写す。
  `com/jaamsim/ProcessFlow/Server.java` → `src/jaamsim/ProcessFlow/Server.ts`
- **クラス名・関数名・フィールド名は Java と同じ**にする（後で本家と見比べられるように）。
- 入れ子のクラス（`Foo.Bar`）は、同じファイルの中で `export class Foo_Bar` にするか、`Foo` の static にする。どちらにしたかは、ファイルの先頭のコメントに書く。
- import は拡張子つきの相対パス（`import { Server } from "../ProcessFlow/Server.ts";`）。型だけのものは `import type`。
- ファイルの先頭の著作権とライセンスの注記は、元のまま残し、1 行 `TypeScript への移植 (C) 2026 shota` を足す（Apache-2.0 の決まり）。

## 2. 数

- `int`・`long`・`double`・`float` → `number`。
  - **整数の割り算**（両方が int/long の `/`）は `Math.trunc(a / b)`。見落とすと結果がずれるので、1 つずつ型を確かめる。
  - `long` の値は 2^53 未満に収まる前提（時刻の tick など）。`Long.MAX_VALUE` は `Long.MAX_VALUE`（`java/lang.ts` の定数、実体は 2^53-1）。
  - `Integer.MAX_VALUE` などは `java/lang.ts` の定数を使う。
  - ビット演算を long にしている所（ハッシュなど）は、意味を確かめて個別に書く（JS のビット演算は 32 ビット）。
- `char` → 長さ 1 の `string`。文字コードの計算をしている所は `charCodeAt` と `String.fromCharCode`。
- `Math.round(double)` は JS の `Math.round` と同じ（.5 は正の方向）。`Math.floorDiv`・`Math.floorMod`・`Math.signum`・`Math.toRadians` などは `java/lang.ts` の `JMath`。
- `Math.log`・`exp`・`pow`・`sin` などは JS の同名の関数（最後の 1 桁が違うことがあるが、許す）。

## 3. 文字列（結果の一致に効くので、いちばん注意）

- **double を文字列にする所は、必ず `jstr(x)`**（Java の `Double.toString` と同じ形: `1.0`、`1.0E7`、`1.234E-5`）。
  `"" + x`、`String.valueOf(x)`、`sb.append(x)`、`x + " h"` のように、Java が暗黙に文字列にしている所も全部。
  int・long は普通の `String(x)` でよい（Java と同じ形になる）。
- `String.format(...)` → `jformat(...)`（`%s %d %f %.3f %e %g %x %n %%`、幅・`-`・`0`・`,` に対応。Java と同じ丸め）。
  **double を `%s` に渡している所は `jstr(x)` にしてから渡す**（TS では int と double を見分けられないので、`1.0` が `1` になってしまう）。
- `str.equals(b)` → `===`。`equalsIgnoreCase` → `jEqualsIgnoreCase`。`compareTo` → `jCompare`。
- `StringBuilder` → 文字列の足し算か配列の join（どちらでも）。
- `Character.isDigit` などは `java/lang.ts` の `JChar`。

## 4. 集まり

- `ArrayList`・`List` → 配列 `T[]`。`list.get(i)` → `list[i]`、`size()` → `length`、
  `remove(int)` → `splice`、`remove(Object)` → `jRemove(list, o)`、`contains` → `includes`、`indexOf` はそのまま。
- `HashMap`・`LinkedHashMap` → `Map`。**HashMap を順に回して、その順番が結果に効く所**（事象の予約の順など）は、
  Java の HashMap の順番と違ってしまう。見つけたら `// TODO(順番): HashMap の順番に依存` と書いて、分かる範囲で理由を書く。
- `HashSet` → `Set`。`TreeMap`・`TreeSet` → `java/collections.ts` の `TreeMap`・`TreeSet`（並び順つき）。
- キーが double や文字列でないオブジェクト（`Vec3d` など、`equals` を上書きしているもの）の Map は、同じ値で同じ要素にならないので注意。
  必要なら文字列のキーにする。

## 5. クラスの作り

- Java の初期化ブロック（`{ ... }`）は、コンストラクタの `super()` の直後に同じ順で書く。
  フィールドの初期値も Java と同じ順番で決まるようにする（親のコンストラクタから子の関数が呼ばれる所に注意）。
- **多重定義（同じ名前で引数が違う関数・コンストラクタ）**:
  - 引数の数や型で見分けられるなら、1 つの関数の中で見分ける。
  - 見分けられないときは、使う回数の多い方に元の名前を残し、もう一方に意味の分かる名前を付ける（例: `setValueList` と `setValueListFromStrings`）。
  - **名前を変えたものは、必ず `docs/renamed.md` に 1 行書く**（ほかの人がその関数を呼ぶので）。形式: `クラス.元の名前(引数の型) → 新しい名前`
- `interface` は TS の `interface`。`default` の関数を持つものは抽象クラスか、関数を足す補助関数にする。
- `abstract` はそのまま。`final`・`synchronized`・`volatile` は消す。
- 例外は `Error` を継承したクラス（`InputErrorException` など）。`catch (Foo e)` は
  `catch (e) { if (!(e instanceof Foo)) throw e; ... }`。
- `Object.equals` を上書きしているクラスは `equals(o)` を残し、使う側も `a.equals(b)` を呼ぶ。

## 6. 注釈とリフレクション（Java にあって TS に無いもの）

- **`@Keyword(description, exampleList)`**: 入力を作った直後に
  `this.setKeywordDoc(input, "説明", ["例1", "例2"])`（`Entity` の関数）。説明の文は英語のまま（日本語化は後で別に行う）。
- **`@Output(name, description, unitType, reportable, sequence)` のついた関数**: 関数はそのまま残し、
  ファイルの最後で登録する:
  ```ts
  defineOutput(LinkedComponent, {
    name: "NumberAdded",
    description: "The number of entities received from upstream after the initialization period.",
    unitType: DimensionlessUnit, reportable: true, sequence: 1,
    returnType: "long",               // Java の戻り値の型（double long int boolean String Entity など）
    get: (e, simTime) => e.getNumberAdded(simTime),
  });
  ```
  `defineOutput` は `src/jaamsim/input/OutputRegistry.ts`。親クラスの出力は、実行時に親をたどって集める。
- **`Class.forName`・クラス名からの生成**（ObjectType の JavaClass、単位の名前など）: `ClassRegistry`。
  Entity・Unit を継承した**抽象でない**クラスは、ファイルの最後で
  `ClassRegistry.register("com.jaamsim.ProcessFlow.Server", Server);` と登録する（Java の完全な名前で）。
- `obj.getClass().getSimpleName()` → `ClassRegistry.simpleName(obj)`、`getName()` → `ClassRegistry.javaName(obj)`。
  （`constructor.name` は、後でまとめて縮めると変わるので使わない）
- `Foo.class`（クラスそのものを渡す所）→ コンストラクタをそのまま渡す（`Server`）。型は `JClass<Server>`（`java/lang.ts`）。
- `instanceof` はそのまま。`Class.isAssignableFrom(c)` → `jIsAssignableFrom(parent, c)`。

## 7. 画面と描画（この段階では移さない）

- Swing・AWT・JOGL・`com.jaamsim.ui`・`com.jaamsim.render`・`RenderManager`・`GUIFrame` を使う所は移さない。
  代わりに `// 描画: 省略（three.js の画面を作るときに）` と書いて、その呼び出しを消す。
  戻り値が要るなら、無難な値（`null`、空の配列）を返す。
- ただし、**描画の部品でも、入力（Keyword）と状態（位置・大きさ・向き・色の値）は移す**。
  モデルのファイルにはそれらの入力が書かれていて、読めないとエラーになるため。
- `DisplayEntity.updateGraphics` などの見た目の更新は、状態の計算だけ残す。

## 8. 進め方

- 自分の担当のファイルを全部移す。途中で他の担当のクラスが要るときは、Java と同じ名前で import する（まだ無くてもよい）。
- 自分の担当の中で、`npx tsc --noEmit` の誤りのうち、**自分のファイルの文法や型の誤り**は直す。
  まだ移していない他の担当のファイルが無いことによる誤りは、そのままでよい。
- 移すのを後回しにした所・自信のない所は `// TODO(移植): 理由` と書き、`docs/todo-<担当>.md` にまとめる。
- 1 ファイルずつ、Java の行と見比べながら移す。**省略や要約はしない**（関数を丸ごと飛ばさない）。

## 9. 共通の部品（先に用意してあるもの）

- `src/jaamsim/java/lang.ts`: `jstr` `jformat` `jfixed` `Double` `Integer` `Long` `JMath` `JChar` `jEqualsIgnoreCase` `jCompare`
  `jRemove` `jEquals` `JClass` `jIsAssignableFrom` と、例外（`NumberFormatException` `IllegalArgumentException` など）
- `src/jaamsim/java/collections.ts`: `TreeMap` `TreeSet`
- `src/jaamsim/java/ClassRegistry.ts`: クラスの名前の表
- `src/jaamsim/input/OutputRegistry.ts`: `defineOutput` `getOutputDefs` `getOutputDef`
- `src/jaamsim/rng/MRG1999a.ts`: 乱数（Java 版と 1 ビットも違わないことを確かめ済み）
- `src/jaamsim/events/`: 事象の管理。`EventManager`・`ProcessTarget`・`EventHandle`・`Conditional`
  （static の `EventManager.scheduleTicks` `scheduleSeconds` `scheduleUntil` `startProcess` `killEvent` `interruptEvent`
  `simTicks` `simSeconds` `current` `hasCurrent` `canSchedule` は Java と同じ名前で使える）

試験は `npm test`、型の確認は `npx tsc --noEmit`。

## 10. 多言語対応（日本語化）— 2026-09-29 追加

画面は日本語が既定で、辞書を足せばほかの言語にもなる。英語の元の文を辞書のキーにする（`src/jaamsim/i18n/I18n.ts`）。

- **利用者に見せる文**（例外・誤りのメッセージ、警告、画面に出る文）は、英語の元の文のまま `tr("...")` で包む。
  書式なら `jformat(tr("... %s ..."), x)`（書式ごと包み、埋めるのは後）。定数にした文（`INP_ERR_...` など）は、使う所で `tr(定数)` にする。
- 包まない物: キーワードの説明（`setKeywordDoc`）と出力の説明（`defineOutput` の description）— 表示するときに辞書で引く。
  名前（キーワード名・出力名・部品の種類の名前）— ファイルと互換を保つため英語のまま。表示のときに `trName` で引く。
  モデルのファイルに書き出す文字列・計算に使う文字列・記録（ログ）だけの文 — 訳さない。
- 迷ったら「利用者が画面やダイアログで読むか」で決める。読むなら包む。
