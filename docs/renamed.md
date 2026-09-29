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
- `Seize.stateChanged()`・`EntityProcessor.stateChanged()`（引数なし） → `resourceStateChanged`（StateEntity.stateChanged(StateRecord, StateRecord) とぶつかり、1 つにすると状態の切り替えのたびに呼ばれてしまうため。事象の説明は元の "stateChanged" のまま）（担当: E）
- `EntityProcessor.getUnitsInUse()` と出力の `getUnitsInUse(double)` → `getUnitsInUse(simTime?)`（同じ中身なので 1 つにした）（担当: E）
- `ExpError` の 3 つのコンストラクタは 1 つ: `new ExpError(src, pos, msg)`・`(src, pos, msg, cause: Error)`・`(src, pos, fmt, ...args)`（後ろの引数で見分ける。名前は変えていない）（担当: B）
- `ExpValResult.makeErrorRes(ArrayList)`・`makeErrorRes(ExpError)`、`ExpParser.appendEntityReferences(Assignment|Expression|ExpNode, list)`、`ExpParser.assertResultType(exp, type)`・`(exp, types...)` は、それぞれ 1 つの関数で引数を見分ける（名前は変えていない）（担当: B）
- `ExpParser.ParseContext` などの入れ子のクラスは `ExpParser_ParseContext` として書き出し、`ExpParser.ParseContext` とも書ける（namespace）。`ExpEvaluator.EntityParseContext`・`EntityEvalContext`、`ExpResult.Collection`・`Iterator`、`ExpTokenizer.Token`、`ExpValResult.State` も同じ（担当: B）
- `OverlayEntity.handleMouseClicked(short, int, int, int, int, boolean, boolean, boolean)`（画面の画素で受ける方） → `handleOverlayMouseClicked`（DisplayEntity.handleMouseClicked(short, Vec3d, …) とぶつかるため。OverlayText の上書きも同じ）（担当: F）
- `OverlayEntity.handleDrag(int, int, int, int, int, int)` → `handleOverlayDrag`（DisplayEntity.handleDrag(Vec3d, Vec3d) とぶつかるため。OverlayText の上書きも同じ）（担当: F）
- DisplayEntity の多重定義は名前を変えずに 1 つの関数で見分ける: `getShow(simTime = 0)`・`getShowInput(simTime = 0)`・`getRelativeEntity(simTime?)`（引数の無い呼び出しは子の上書き用）・`getGlobalPosition()/(Vec3d)/(Vec3d[])`・`getLocalPosition(Vec3d)/(Vec3d[])`・`getSourcePoint(dir = true)`・`getSinkPoint(dir = true)`・`setRelativeOrientation(Vec3d|Quaternion)`・`getNextList(boolean|number)`・`getPreviousList(boolean|number)`（数なら出力の方）・`getObserverList(simTime?)`（担当: F）
- `DisplayEntity.getDisplayModel(Class<T>)` は、クラスか interface の値（`FillEntity`・`LineEntity`・`PolylineEntity`・`TextEntity` など isInstance を持つもの）を受ける（担当: F）
- interface（Graphics）: x instanceof FillEntity / LineEntity / PolylineEntity / TextEntity / Editable / EditableText → `FillEntity.isInstance(x)` など（同じ名前の const。関数の有無で見分ける）。Editable の定数は `Editable.ACCEPT_EDITS` など（担当: F）
- 入れ子の型: `PolylineInfo.CurveType` → `PolylineInfo_CurveType`、`ShapeModel.ValidShapes` → `ShapeModel_ValidShapes`、`XYGraph.ValidGraphTypes` → `XYGraph_ValidGraphTypes`（文字列の enum。`PolylineInfo.CurveType` などの static からも引ける）、`AbstractGraph.SeriesInfo` → `AbstractGraph_SeriesInfo`（担当: F）
- `AbstractGraph.getLineColor(int, ArrayList)`/`(int)`、`getLineWidth(int, DoubleVector)`/`(int)`、`Graph.processGraph()`/`(SeriesInfo)`、`View.getGlobalCenter()`/`(double)`、`View.getPointOfInterest()`/`(double)`、`DisplayModel.getUserList()`/`(double)` は引数の数で見分ける（名前は変えていない）（担当: F）
- フィールドの名前を変えたもの（関数と名前がぶつかるため）: `View.showWindow`（入力）→ `showWindowInput`、`Graph.processGraph`（ProcessTarget）→ `processGraphTarget`、`OverlayImage.size`（入力、DisplayEntity の private の size とぶつかる）→ `imageSize`（担当: F）
- Controllable（interface）: x instanceof Controllable はそのまま書ける（同じ名前の const、Symbol.hasInstance）。関数の形は isControllable(x)。`Controllable.register(Cls)` で印を付ける（CalculationEntity で登録済み）（担当: I）
- `DoubleCalculation`・`WaveGenerator`・`Polynomial`・`WeightedSum` の `getNextSample(double)`（出力 Value）と `getNextSample(Entity, double)` は、引数の数で見分ける 1 つの関数（名前は変えていない）（担当: I）
- 引数なしの関数と、同じ値を返す出力の関数を 1 つにした（名前は変えていない）: `Controller.getCount(simTime?)`、`FluidComponent.getFlowArea/getVelocity/getInletPressure/getOutletPressure/getFluidVolume(simTime?)`、`FluidTank.getFluidLevel(simTime?)`、`FluidFlowCalculation.getFlowRate(simTime?)`（担当: I）
- `DoubleCalculation.unitType`・`inputValue`（Java は protected）は、同じパッケージの WaveGenerator・WeightedSum から読むので public readonly にした（担当: I）
- ThresholdUser（interface）: x instanceof ThresholdUser → isThresholdUser(x)（getThresholds・thresholdChanged の関数があるか）（担当: H）
- `TimeSeriesThreshold.doOpenClose`（ProcessTarget のフィールド）→ `doOpenCloseTarget`（関数 doOpenClose() とぶつかるため）（担当: H）
- `ExpressionThreshold.getOpenConditionValue(double)`・`(double, boolean)` は 1 つの `getOpenConditionValue(simTime, val?)`。名前の無いクラスから呼ぶため `superIsOpen()`（Java の ExpressionThreshold.super.isOpen()）と `processSetOpen()`（setOpenTarget の中身）を足した（担当: H）
- `KeywordCommand` の 3 つのコンストラクタ `(ent, kws...)`・`(ent, ind, kws...)`・`(ent, ind, kws0[], kws1[])` は 1 つで引数の形から見分ける（名前は変えていない。`new KeywordCommand(ent, kwArray)` も可）。`DefineCommand(sim, cls, name)`・`(sim, cls, proto, name)` も同じ（担当: H）
- `JSONParser.parse(ArrayList<Token>)`・`parse(String)`（static）は 1 つの static `parse(toks | json)`。インスタンスの `parse()` はそのまま（担当: H）
- `JSONTokenizer.Token` → `JSONTokenizer_Token`（`JSONTokenizer.Token` でも引ける）。`JSONError` の 2 つのコンストラクタは 1 つ（後ろの引数があれば jformat）（担当: H）
- `JSONValue.mapVal`（Java の HashMap）は `JavaHashOrder<JSONValue>`（ProcessFlow/MappedTreeSet.ts。set・get・entries。Java の HashMap と同じ順番で書き出すため）（担当: H）
