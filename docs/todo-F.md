# まとまり F（Graphics・DisplayModels）の後回し・自信の無い所・描画を省いた所

移した: `Graphics/` 33 ファイル、`DisplayModels/` 9 ファイル（Java の全ファイル）。
加えて、Java に無い補助のファイル `Graphics/LateClasses.ts` を 1 つ作った（下の 1）。

## 1. 全体に関わること（まとめ役へ）

- **読み込みの輪（循環 import）を避けるため、`LateClasses` を作った。**
  DisplayEntity は子のクラス（Region・OverlayEntity・EntityLabel）を、DisplayModel は DisplayEntity を、
  View は Region を参照する。ES のモジュールでは、輪の中で「評価の終わっていないクラスを extends する」と
  ReferenceError になる。そこで次の決まりにした。
  - `DisplayEntity.ts`・`View.ts`・`DisplayModels/*` は、親のクラス以外の表示の部品を **実行時には import しない**
    （`import type` だけ）。実行時は `LateClasses.get("com.jaamsim.Graphics.Region")`・`LateClasses.isInstance(o, 名前)` で引く。
  - 各クラスはファイルの最後で `LateClasses.bind(Java の名前, クラス)` する（抽象クラスも）。表に無い名前は `ClassRegistry` も探す
    （`CompoundEntity` はこちら。SubModels の担当が ClassRegistry に登録すれば動く）。
  - **全部のクラスのファイルをまとめて読み込む所（index）が要る。** 読み込まれていないと、DisplayEntity のコンストラクタの
    `LateClasses.get(...)`（DisplayModel・ColladaModel・ShapeModel・ImageModel・IconModel・View）が誤りになる。
  - ほかの担当も、親が子を参照する所は同じ問題がある（Vec3d の担当も同じ理由で工夫している）。
- 他の担当のクラスで、まだ無いもの: `Commands/KeywordCommand.ts`、`SubModels/CompoundEntity.ts`（tsc の誤りはこの 2 つだけ）。
- `Input.getValue()` の戻り値は `T | null` なので、Java で null にならない所は `!` を付けた（実行時の振る舞いは同じ）。
- JS では private のフィールドも同じプロパティになる。DisplayEntity の private（`position`・`size`・`points`・`orient`・`align`・
  `show`・`movable`・`showInput`・`visInfo`・`tagMap` など）と同じ名前のフィールドを子のクラスで作ると、実行時に上書きしてしまう
  （tsc は誤りとして出すので、ほかの担当も気づけるはず）。OverlayImage の `size` は `imageSize` に変えた。

## 2. TODO(移植)

| 所 | 内容 |
|---|---|
| Editable.ts `KeyEvent` | JOGL(newt) のキーの番号は jogl-all.jar から読んだ。three.js の画面では、ブラウザのキーからこの番号に直す所が要る |
| Editable.ts `KeyEvent.isPrintableKey` | newt の元のコードを記憶から写した（印字できない範囲 0x00-0x1F・0x61-0x78・0x8F-0x9F・0xE000-0xF8FF）。要確認 |
| EditableTextDelegate.ts | クリップボード（GUIFrame）は `EditableTextDelegate.clipboard` に置き換えた。ブラウザでは navigator.clipboard（非同期）につなぐ |
| TextModel.ts `validFontNames` | Java は機械の字体の一覧。決まった一覧（52 個、Java と同じく並べ替え）にした。一覧に無い字体名がモデルにあると入力の誤りになる。既定は Verdana |
| TextBasics.ts `getTextSize` | 文字の大きさを測る `TextBasics.fontMetrics` が無いときは (0,0,0)。`resizeForText` は Java の `RenderManager.isGood()==false` と同じく何もしない |
| OverlayClock.ts `SimpleDateFormat` | Java の SimpleDateFormat を自前で写した（GMT、月・曜日は英語に固定）。1582 年より前の日付・週番号（w W）は Java と違いうる |
| ColladaModel.ts `exportBinaryMesh` | ColParser・BlockWriter が無いので書き出せない（記録に失敗と書くだけ） |
| Graph.ts `setupSeriesData` | Java のまま（numPoints を増やしてから書くので 0 番が書かれない。配列の外は誤り）。Java の不具合もそのまま写した |
| PolylineInfo.ts `getCumulativeLengths` | 点が 0 個のとき Java と同じく誤り（RangeError）にした |
| DisplayEntity.ts `updateRangeVisibility` | Java のまま（visInfo = null の直後に上書きする。Java の不具合もそのまま） |

## 3. 描画を省いた所（three.js で作り直すときの手がかり）

共通:
- `DisplayModel.getBinding(ent)` は全部 `null` を返す（Java は DisplayModelBinding を作る）。`DisplayEntity.getDisplayBindings()` はそれを並べるだけ。
  three.js では、DisplayEntity の `getDisplayModelList()` を見て、モデルの種類ごとに物を作る。
- `VisibilityInfo` は中身だけの型（`DisplayModel.ts` の `{ views, minDist, maxDist }`）。views が null か空なら全部の View で見える。
  最小距離 0 は -∞ に置き換え済み。`DisplayEntity.getVisibilityInfo()`（null なら制限なし）と `DisplayModel.getVisibilityInfo()` の両方を見る。
- 位置と向き: `DisplayEntity.getGlobalTrans()`（Region・RelativeEntity 込み。大きさは含まない）と `getSize()` × `DisplayModel.getModelScale()`。
  点の列は `getScreenPoints(simTime)`（PolylineInfo の配列）・`getPoints()`・`getGlobalPositionTransform()`。
- 表示するか: `getShow(simTime)`。毎回の更新は `updateGraphics(simTime)`（BarGauge・Text・OverlayText・XYGraph が状態を作る）。
- タグ: `getTagSet()`（Map<名前, Tag>）。ShapeModel は TAG_CONTENTS（棒の高さ・色）・TAG_CONTENTS2・TAG_CAPACITY（棒の幅）・TAG_OUTLINES・TAG_BODY を使う。
- `RenderManager.redraw()` の呼び出しは消した（TextBasics・OverlayText のキー操作）。
- `FrameBox.setSelectedEntity(null, false)`（DisplayEntity.handleKeyReleased の Delete）を消した。
- 字体: `TessFontKey` は `{ fontName, style }`（style は Font.PLAIN=0・BOLD=1・ITALIC=2 の和）。文字の大きさを測る関数は `TextBasics.fontMetrics` に入れる
  （入れると resizeForText・クリックした文字の位置・自動の大きさが Java と同じに動く）。

モデルごと（Java の Binding の中身。移していない）:
- **ShapeModel.Binding**: 形（RECTANGLE・CIRCLE・ARROW2D・TRIANGLE・PENTAGON・HEXAGON・OCTAGON・PENTAGRAM・HEPTAGRAM・OCTAGRAM）は
  RenderUtils の点の列を大きさで伸ばして、線（Outlined）と塗り（Filled）を描く。色・線の太さは物が LineEntity/FillEntity ならその値、無ければモデルの値。
  TAG_OUTLINES・TAG_CONTENTS の色と見える・見えないで上書き。BARGAUGE2D は背景（TAG_BODY、既定 LIGHT_GREY）と枠（黒）、
  TAG_CONTENTS の sizes を高さ・TAG_CAPACITY を幅の比にした棒を左から並べ、TAG_CONTENTS2 を上に積む（z は 0.001×x/z だけ手前）。
  GRID は枠・塗りの上に RenderUtils.GRID_POINTS の格子線（5 本ごとに黒、ほかは LIGHT_GREY）。
- **PolylineModel.Binding**: 曲線の点（CurveType で作った点）を線で結ぶ（Closed なら最初の点へ戻る）。PolylineWidth > 0 なら幅のある帯
  （角の処理つきの多角形）。ShowArrowHead なら最後の区間の向きに三角の矢じり（arrowHeadVerts を ArrowHeadSize で伸ばす。Arrow は自分の大きさ）。
  選択時は点の列を MINT の線と、点（最初は青・最後は黄・ほかは緑）で出す。
- **ImageModel.Binding / OverlayBinding**: 画像を大きさの四角に貼る（Transparent・CompressedTexture）。Filled/Outlined なら少し奥に背景の四角。
  OverlayImage は画面の画素で（ScreenPosition・ImageSize・AlignRight・AlignBottom）。出力 PixelSize は今は常に {0,0}。
- **ColladaModel.Binding**: 3D のファイル（DAE・OBJ・GLTF・GLB・JSM・JSB・ZIP）を読み、外形の箱を大きさに合わせて置く。Actions は
  出力の値を時間にしてアニメーションを動かす。出力 Vertices など・Actions・Durations は今は 0 か空。
- **TextModel.Binding（Text・EntityLabel など）**: 文字列 getCachedText() を TextHeight で、getGlobalTransForSize(文字の大きさ) の位置に。
  DropShadow は DropShadowOffset×高さだけずらした影。Filled/Outlined なら背景の四角。編集中は選択の範囲（LIGHT_GREY）と差し込みの縦線。
- **TextModel.OverlayBinding（OverlayText・OverlayClock）**: 画面の画素（ScreenPosition・AlignRight・AlignBottom）で文字。高さは画素（TextHeightInPixels）。
- **TextModel.BillboardBinding（BillboardText）**: 空間の位置に、いつも正面を向く文字（高さは画素）。
- **GraphModel.Binding（Graph・XYGraph）**: 枠・背景（BackgroundColor・GraphColor・BorderColor）、題、軸・目盛り・目盛りの数（*LabelFormat を
  jformat で）、格子線（XLines・YLines）、折れ線か棒（SeriesInfo の xValues・yValues・numPoints・indexOfLastEntry は輪になった配列）。
  Graph は時間の軸（x は今の時刻からの差）。余白・文字の高さは GraphModel の入力（グラフの高さに対する比）。Java の GraphModel.java 226 行目以降を見る。
- View: 窓そのもの（位置・大きさ・題・ShowWindow・Lock2D・カメラの位置と向き・スクリプトの動き・背景の画像）は入力と計算
  （getGlobalPosition(simTime)・getGlobalDirection・getGlobalCenter・updateCenterAndPos・setLock2D）だけ移した。GUIListener があれば窓を開く。
