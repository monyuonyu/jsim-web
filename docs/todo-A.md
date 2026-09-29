# まとまり A（units・math・datatypes）の後回し・自信の無い所

## TODO(移植)
- `math/MathUtils.ts` collisionDistLines: RenderUtils.rayClosePoint（render）を使うので移していない。常に -1（当たり無し）を返す。画面での線の選び取りにだけ使う。元の Java は関数の中にコメントで残した。
- `math/ConvexHull.ts` collisionDistance: RenderUtils.mergeTransAndScale・getInverseWithScale（render）を使うので移していない。常に -1。collisionDistanceByMatrix は移した。
- `datatypes/DoubleVector.ts` toString(str): java.text.DecimalFormat は空のパターン（toString() が使う形）だけを写した。ほかのパターンも空と同じに書く（Java の中で空以外を渡す所は無い）。桁区切りは英語・日本語の地域設定の「,」「.」の前提。

## 読み込みの輪（ESM）で Java と作りを変えた所
- `units/Unit.ts`: 掛け算・割り算の単位の規則（Java の static ブロック）は、最初に使ったときに作る。子のクラス（RateUnit など）は import せず、ClassRegistry から Java の名前で引く（使う時点で units の全部が読み込まれている前提）。
- `math/Vec2d.ts`・`Vec3d.ts`・`Vec4d.ts`: MathUtils.near・Input.SEPARATOR を import せず、同じ計算・同じ値をファイルの中に写した（MathUtils → Vec4d → Vec3d → Vec2d の輪で「extends」の時点で親がまだ無い誤りになるため）。
- `math/Transform.ts`: `Transform.ident` は static の値ではなく、最初に使ったときに作るゲッター（呼び方は同じ）。ConvexHull の ONES も同じ。
- `math/Color4d.ts` は ColourInput を import する（toString のため）。ColourInput より先に Color4d だけを読み込むと、ColourInput の static の色（new Color4d）で誤りになりうる。

## 小さな違い
- `Unit.getMultUnitType`・`getDivUnitType` に null を渡すと、規則を引く所で NullPointerException（Java と同じ）。getSIUnit(null) は "SI"。
- `Gamma`: Math.log・exp・pow・sin は JS のもの。試験では logGamma(3.3) だけ最後の 1 ビットが Java と違う（PORTING.md の 2 で許す範囲）。
- 例外 ArrayIndexOutOfBoundsException は lang.ts の IndexOutOfBoundsException（親）で投げる。RuntimeException（Gamma）・RenderException（ConvexHull）はファイルの中の Error の子にした。
