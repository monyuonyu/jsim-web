# まとまり C（入力の仕組み）の TODO

## 全体にかかわること（まとめ役へ）
- **読み込みの順の循環**: Input.ts は Entity・Group・ObjectType などを値として import している。Entity.ts は StringInput などを import し、StringInput は Input を継承する。
  このため、どこから読み込んでも、どこかの `class X extends Y` が TDZ の誤りになりうる。プロジェクト全体で読み込みの順を決める必要がある。
  C の中では、Input.ts が子のクラス（BooleanInput・ColourInput）を import しないようにした（色の名前は `Input.colourNameResolver`。ColourInput.ts の最後で入れる）。
  InputAgent → FileInput も `import type` にした。
- 戻り値の型（Java の Class<?>）は OutputRegistry の OutputReturnType の文字列で表す（ValueHandle.ts の JType）。
- Java の interface を Class として渡す所は JInterface（isInstance を持つ物）、enum の Class は JEnumClass（Input.ts）。
- java.net.URI の代わりの URI・URISyntaxException は ParseContext.ts にある。共通の場所へ移すかは、まとめ役が決める。
- NaturalOrderComparator（com.jaamsim.ui）は Input.ts に写した。

## ファイルごと
- InputAgent: resRoot の既定は `/home/shota/jaamsim-src/src/main/resources/resources/`。setResRoot・setFileReader で差し替える。
  FileEntity.ts の FileSystem.backend とは別の読み込みの仕組みなので、一本化するか決める。
- InputAgent.printReport・getOutputString: TS では Integer と Double を見分けられないので、数は Double として書く（ArrayList<Integer> などで Java と違う）。
  int[] は、戻り値の型が "int[]" のとき、または値が Int32Array のときだけ int として書く。
- InputAgent.readBufferedStream: Java と同じく、最初の行を書式の中に入れて logError に渡している。
- OutputHandle: 出力の並びは、Java の HashMap の順番（javaHashMapOrder）をまねる。同じ箱の中の順は JVM の getMethods の順しだいなので、登録の順で代えた。
- OutputHandle.getValue: クラスと型の名前の文字列を比べられない所は通す。
- StringKeyInput: Java は HashMap。順に回す所は順番が違う。
- Input.parseRFC8601DateTime: hh:mm:ss.ssssss の形で、"." 以外の文字のときの Java の例外を写していない。
- Parser.splitSubstrings: 空の文字列のとき、Java は例外になる。TS では例外にしない。
- KeywordIndex.coordFormat: NaN・無限の文字（Java の DecimalFormat の "�"・"∞"）は、およそで写した。
- DirInput: Node なら fs で、そうでなければ FileSystem.backend で調べる。backend にフォルダかどうかを調べる関数が無い。
- ImageInput: 画像として読めるかを調べていない（描画: 省略）。
- FormatInput: Java の Formatter の誤りの決まりは、主な形だけを写した。
- ClassInput: Java に無い上書き（toString・getDefaultString）がある。
- TimeSeriesDataInput: Java の (long) への型変換を Math.trunc で代えた。
- UnitTypeListInput: 空の配列のときは、多重定義のどちらか見分けられない。
- UnitTypeInput・KeyEventInput: Java は null を返す。基底の型に合わせるため型だけ変えた。
- ActionListInput: render/Action.ts を作るときは、そちらへ移す。
