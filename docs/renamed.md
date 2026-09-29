# 名前を変えた関数（多重定義を分けたもの）

形式: `クラス.元の名前(引数の型) → 新しい名前`（担当: どのまとまりか）

EntityProvider（interface）: x instanceof EntityProvider → isEntityProvider(x)（担当: D）
EntityListProvider（interface）: x instanceof EntityListProvider → isEntityListProvider(x)（担当: D）
BooleanProvider（interface）: x instanceof BooleanProvider → isBooleanProvider(x)（担当: D）
ColourProvider（interface）: x instanceof ColourProvider → isColourProvider(x)（担当: D）
DowntimeUser（interface）: x instanceof DowntimeUser → isDowntimeUser(x)（担当: D）
StateEntityListener（interface）: x instanceof StateEntityListener → isStateEntityListener(x)（担当: D）
StateUser（interface）: x instanceof StateUser → isStateUser(x)（担当: D）
- `Device.updateProgress()`（引数なし・final） → `updateProgressToNow`（abstract の `updateProgress(double dt)` は元の名前）（担当: E）
SampleConstant.SampleConstant(int) → static SampleConstant.ofInt(val)（担当: D）
SampleInput.SampleInput(String, String, int) → static SampleInput.ofInt(key, cat, def)（担当: D）
SampleListInput.SampleListInput(String, String, int) → static SampleListInput.ofInt(key, cat, def)（担当: D）
TimeSeries.getSimTime(long)（private） → getSimTimeForTicks（Entity.getSimTime(double) とぶつかるため）（担当: D）
SampleProvider（interface）: x instanceof SampleProvider → isSampleProvider(x)（担当: D）
TimeSeriesProvider（interface）: x instanceof TimeSeriesProvider → isTimeSeriesProvider(x)（担当: D）
StringProvider（interface）: x instanceof StringProvider → isStringProvider(x)（担当: D）
- `Queue.getPosition(DisplayEntity)` → `getPositionOf`（DisplayEntity.getPosition() とぶつかるため）（担当: E）
- `Color4d.Color4d(int, int, int)`・`Color4d.Color4d(int, int, int, int)` → `Color4d.fromInts(r, g, b[, a])`（255 で割る方。Java で整数だけを渡している所はこちら。double の方はコンストラクタのまま）（担当: A）
- `DoubleVector.DoubleVector(double...)` → `DoubleVector.ofValues(...vals)`（`new DoubleVector(5)` や `new DoubleVector(0, Infinity)` は容量の指定になるので注意。number[] を 1 つ渡すのはコンストラクタでも可）（担当: A）
