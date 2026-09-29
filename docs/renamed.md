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
- Seizable（interface）: x instanceof Seizable → isSeizable(x)（const の Seizable も Symbol.hasInstance・isInstance を持つ）（担当: G）
- ResourceUser（interface）: x instanceof ResourceUser → isResourceUser(x)（同上）（担当: G）
- ResourceProvider（interface）: x instanceof ResourceProvider → isResourceProvider(x)。static の getUserList(pool) は const の ResourceProvider.getUserList（担当: G）
- `Input.getValueTokens()`（引数なし）→ `getValueTokenList()`。引数つきの `getValueTokens(toks)` はそのまま（担当: C）
- `Input.isDef()`（関数）→ `getIsDef()`（フィールドの `isDef` と名前がぶつかるため。フィールドはそのまま）（担当: C）
- `Input.getValue()` と `getValue(Entity, double, Class)` は 1 つの `getValue` で引数の数で見分ける（名前は変えていない）。`reset()`・`reset(Entity)` も `reset(ent?)` の 1 つ（担当: C）
- `InputAgent.printReport(Entity, FileEntity, double)`・`printReport(JaamSimModel, double, FileEntity)` は名前はそのまま（最初の引数で見分ける）。中の実体は private の `printReportForEntity`・`printReportForModel`（担当: C）
- `InputAgent.uiEntitySortOrder`・`subModelSortOrder`・`Input.uiSortOrder` は `Array.sort` に渡せる関数（`compare(a, b)` も持つ）（担当: C）
Entity.getChildren(double)（出力 Children） → getChildrenOutput(simTime)（担当: D）
Entity.getPrototype(double)（出力 Prototype） → getPrototypeOutput(simTime)（担当: D）
Entity.getCloneList(double)（出力 CloneList） → getCloneListOutput(simTime)（担当: D）
Entity.trace（入力のフィールド BooleanInput） → trace_（関数 trace(indent, fmt, ...) とぶつかるため）（担当: D）
Entity.setTraceFlag() と setTraceFlag(boolean) → 1 つの setTraceFlag(bool?)（引数なしは true）（担当: D）
EntityIterator.next() → nextEnt()（TS の Iterator の next() とぶつかるため。for-of でも回せる）（担当: D）
JaamSimModel.getClonesOfIterator(Class, Class iface) → getClonesOfIterator(klass, isFoo)（2 番目は interface の判定の関数）（担当: D）
JaamSimModel.isConfiguring（AtomicBoolean のフィールド） → isConfiguring_（関数 isConfiguring() は元の名前）（担当: D）
JaamSimModel の File（configFile・reportDir など） → 道の文字列（FileEntity.ts の JFile・FileSystem を使う）（担当: D）
Simulation.enableTracing（入力のフィールド） → enableTracingInput（Entity.enableTracing(boolean) とぶつかるため）（担当: D）
OutputMethod.arguments（入力のフィールド） → arguments_（担当: D）
EntityProvInput.isValid(T)（private） → isValidEntity（Input.isValid() とぶつかるため）（担当: D）
SubjectEntity（interface）: x instanceof SubjectEntity → isSubjectEntity(x)（担当: D）
ObserverEntity（interface）: x instanceof ObserverEntity → isObserverEntity(x)。static の ERR_WATCHLIST・registerWithSubjects・isObserverOf・validate は const ObserverEntity に置いた（担当: D）
GUIListener: Java に無い「?」付きの関数（invokeErrorDialog・updateUI・shutdown・getEventViewer・pauseRunManager）を足した。GUIFrame の static を呼んでいた所の代わり（担当: D）
Entity.error(fmt, ...args): 中で tr(fmt) してから jformat する。戻り値の型は never（担当: D）
