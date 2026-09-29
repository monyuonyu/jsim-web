/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2009-2013 Ausenco Engineering Canada Inc.
 * Copyright (C) 2017-2026 JaamSim Software Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * TypeScript への移植 (C) 2026 shota
 */
import { GraphModel } from "../DisplayModels/GraphModel.ts";
import type { SampleProvider } from "../Samples/SampleProvider.ts";
import { Entity } from "../basicsim/Entity.ts";
import { DoubleVector } from "../datatypes/DoubleVector.ts";
import { ColorListInput } from "../input/ColorListInput.ts";
import { ColourInput } from "../input/ColourInput.ts";
import { EntityInput } from "../input/EntityInput.ts";
import { FormatInput } from "../input/FormatInput.ts";
import type { Input } from "../input/Input.ts";
import type { InputCallback } from "../input/InputCallback.ts";
import { StringInput } from "../input/StringInput.ts";
import { UnitTypeInput } from "../input/UnitTypeInput.ts";
import { ValueInput } from "../input/ValueInput.ts";
import { ValueListInput } from "../input/ValueListInput.ts";
import { Double, Integer, type JClass } from "../java/lang.ts";
import type { Color4d } from "../math/Color4d.ts";
import { DimensionlessUnit } from "../units/DimensionlessUnit.ts";
import { Unit } from "../units/Unit.ts";
import { UserSpecifiedUnit } from "../units/UserSpecifiedUnit.ts";
import { DisplayEntity } from "./DisplayEntity.ts";
import { LateClasses, jint } from "./LateClasses.ts";

/*
 * 移植の注意:
 * - 入れ子の static class AbstractGraph.SeriesInfo は、このファイルの AbstractGraph_SeriesInfo にし、
 *   AbstractGraph.SeriesInfo（static）からも引けるようにした。double[] は number[]。
 * - 多重定義 getLineColor(int, ArrayList<Color4d>) / getLineColor(int)、getLineWidth(int, DoubleVector) /
 *   getLineWidth(int) は、引数の数で見分ける。
 */

/**
 * A struct containing all the information pertaining to a specific series
 */
export class AbstractGraph_SeriesInfo {
	yValues: number[] = [];
	xValues: number[] = [];
	numPoints = 0; // number of points to be graphed
	indexOfLastEntry = 0; // index in the arrays for the last graph point in the series
	samp: SampleProvider | null = null; // The source of the data for the series
	lineWidth = 0.0;
	lineColour: Color4d | null = null;
	isBar = false;
}

export abstract class AbstractGraph extends DisplayEntity {

	static readonly SeriesInfo = AbstractGraph_SeriesInfo;

	private readonly primarySeries: AbstractGraph_SeriesInfo[];
	private readonly secondarySeries: AbstractGraph_SeriesInfo[];

	// Key Inputs category

	private readonly title: StringInput;

	private readonly unitType: UnitTypeInput;

	private readonly secondaryUnitType: UnitTypeInput;

	// Format category

	protected readonly lineColorsList: ColorListInput;

	protected readonly lineWidths: ValueListInput;

	protected readonly secondaryLineColorsList: ColorListInput;

	protected readonly secondaryLineWidths: ValueListInput;

	// X-Axis category

	protected readonly xAxisTitle: StringInput;

	protected readonly xAxisUnit: EntityInput<Unit>;

	protected readonly xAxisStart: ValueInput;

	protected readonly xAxisEnd: ValueInput;

	protected readonly xAxisInterval: ValueInput;

	protected readonly xAxisLabelFormat: FormatInput;

	protected readonly xLines: ValueListInput;

	protected readonly xLinesColor: ColorListInput;

	// Y-Axis category

	private readonly yAxisTitle: StringInput;

	private readonly yAxisUnit: EntityInput<Unit>;

	private readonly yAxisStart: ValueInput;

	private readonly yAxisEnd: ValueInput;

	private readonly yAxisInterval: ValueInput;

	private readonly yAxisLabelFormat: FormatInput;

	private readonly yLines: ValueListInput;

	private readonly yLinesColor: ColorListInput;

	// Secondary Y-Axis category

	private readonly secondaryYAxisTitle: StringInput;

	private readonly secondaryYAxisUnit: EntityInput<Unit>;

	private readonly secondaryYAxisStart: ValueInput;

	private readonly secondaryYAxisEnd: ValueInput;

	private readonly secondaryYAxisInterval: ValueInput;

	private readonly secondaryYAxisLabelFormat: FormatInput;

	static readonly X_AXIS = "X-Axis";
	static readonly Y_AXIS = "Y-Axis";
	static readonly SEC_Y_AXIS = "Secondary Y-Axis";

	constructor() {
		super();

		const X_AXIS = AbstractGraph.X_AXIS;
		const Y_AXIS = AbstractGraph.Y_AXIS;
		const SEC_Y_AXIS = AbstractGraph.SEC_Y_AXIS;

		// ---- Java の初期化ブロック ----
		this.displayModelListInput.clearValidClasses();
		this.displayModelListInput.addValidClass(GraphModel);

		// Key Inputs category

		this.title = new StringInput("Title", Entity.KEY_INPUTS, "Graph Title");
		this.setKeywordDoc(this.title, "Text for the graph title.",
				["'Title of the Graph'"]);
		this.addInput(this.title);

		this.unitType = new UnitTypeInput("UnitType", Entity.KEY_INPUTS, DimensionlessUnit);
		this.setKeywordDoc(this.unitType, "The unit type for the primary y-axis. "
		                     + "MUST be entered before most other inputs for this axis.",
				["DistanceUnit"]);
		this.unitType.setCallback(AbstractGraph.unitTypeCallback);
		this.addInput(this.unitType);

		this.secondaryUnitType = new UnitTypeInput("SecondaryUnitType", Entity.KEY_INPUTS, DimensionlessUnit);
		this.setKeywordDoc(this.secondaryUnitType, "The unit type for the secondary y-axis. "
		                     + "MUST be entered before most other inputs for this axis.",
				["DistanceUnit"]);
		this.secondaryUnitType.setCallback(AbstractGraph.secondaryUnitTypeCallback);
		this.addInput(this.secondaryUnitType);

		// Format category

		const defLineColor: Color4d[] = [];
		defLineColor.push(ColourInput.getColorWithName("red")!);
		this.lineColorsList = new ColorListInput("LineColours", Entity.FORMAT, defLineColor);
		this.setKeywordDoc(this.lineColorsList, "A list of colours for the lines graphed against the primary y-axis. "
		                     + "If only one colour is provided, it is used for all the lines.",
				["{ red } { green }"]);
		this.lineColorsList.setValidCountRange(1, Integer.MAX_VALUE);
		this.lineColorsList.setCallback(AbstractGraph.lineColoursCallback);
		this.addInput(this.lineColorsList);
		this.addSynonym(this.lineColorsList, "LineColors");

		this.lineWidths = new ValueListInput("LineWidths", Entity.FORMAT, 1.0);
		this.setKeywordDoc(this.lineWidths, "A list of line widths (in pixels) for the line series to be displayed. "
		                     + "If only one line width is provided, it is used for all the lines.",
				["2 1"]);
		this.lineWidths.setUnitType(DimensionlessUnit);
		this.lineWidths.setValidCountRange(1, Integer.MAX_VALUE);
		this.lineWidths.setCallback(AbstractGraph.lineWidthsCallback);
		this.addInput(this.lineWidths);

		const defSecondaryLineColor: Color4d[] = [];
		defSecondaryLineColor.push(ColourInput.getColorWithName("black")!);
		this.secondaryLineColorsList = new ColorListInput("SecondaryLineColours", Entity.FORMAT, defSecondaryLineColor);
		this.setKeywordDoc(this.secondaryLineColorsList, "A list of colours for the lines graphed against the secondary y-axis. "
		                     + "If only one colour is provided, it is used for all the lines.",
				["{ red } { green }"]);
		this.secondaryLineColorsList.setValidCountRange(1, Integer.MAX_VALUE);
		this.secondaryLineColorsList.setCallback(AbstractGraph.secondaryLineColoursCallback);
		this.addInput(this.secondaryLineColorsList);
		this.addSynonym(this.secondaryLineColorsList, "SecondaryLineColors");

		this.secondaryLineWidths = new ValueListInput("SecondaryLineWidths", Entity.FORMAT, 1.0);
		this.setKeywordDoc(this.secondaryLineWidths, "A list of line widths (in pixels) for the seconardy line series to be displayed. "
		                     + "If only one line width is provided, it is used for all the lines.",
				["2 1"]);
		this.secondaryLineWidths.setUnitType(DimensionlessUnit);
		this.secondaryLineWidths.setValidCountRange(1, Integer.MAX_VALUE);
		this.secondaryLineWidths.setCallback(AbstractGraph.secondaryLineWidthsCallback);
		this.addInput(this.secondaryLineWidths);

		// X-Axis category

		this.xAxisTitle = new StringInput("XAxisTitle", X_AXIS, "X-Axis Title");
		this.setKeywordDoc(this.xAxisTitle, "Title of the x-axis.",
				["'Time (s)'"]);
		this.addInput(this.xAxisTitle);

		this.xAxisUnit = new EntityInput<Unit>(Unit, "XAxisUnit", X_AXIS, null);
		this.setKeywordDoc(this.xAxisUnit, "The unit to be used for the x-axis.",
				["h"]);
		this.addInput(this.xAxisUnit);

		this.xAxisStart = new ValueInput("XAxisStart", X_AXIS, -60.0);
		this.setKeywordDoc(this.xAxisStart, "The minimum value for the x-axis.",
				["-48 h"]);
		this.xAxisStart.setUnitType(UserSpecifiedUnit);
		this.addInput(this.xAxisStart);

		this.xAxisEnd = new ValueInput("XAxisEnd", X_AXIS, 0.0);
		this.setKeywordDoc(this.xAxisEnd, "The maximum value for the x-axis.",
				["8 h"]);
		this.xAxisEnd.setUnitType(UserSpecifiedUnit);
		this.addInput(this.xAxisEnd);

		this.xAxisInterval = new ValueInput("XAxisInterval", X_AXIS, 10.0);
		this.setKeywordDoc(this.xAxisInterval, "The interval between x-axis labels.",
				["8 h"]);
		this.xAxisInterval.setUnitType(UserSpecifiedUnit);
		this.xAxisInterval.setValidRange(1.0e-6, Double.POSITIVE_INFINITY);
		this.addInput(this.xAxisInterval);

		this.xAxisLabelFormat = new FormatInput("XAxisLabelFormat", X_AXIS, "%.0f");
		this.setKeywordDoc(this.xAxisLabelFormat, "The format to be used for the tick mark values on the x-axis.",
				["%.1f"]);
		this.addInput(this.xAxisLabelFormat);

		this.xLines = new ValueListInput("XLines", X_AXIS, DoubleVector.ofValues(-20, -40));
		this.setKeywordDoc(this.xLines, "A list of values between XAxisStart and XAxisEnd at which to insert "
		                     + "vertical gridlines.",
				["-48 -40 -32 -24 -16 -8 0 h"]);
		this.xLines.setUnitType(UserSpecifiedUnit);
		this.addInput(this.xLines);

		const defXlinesColor: Color4d[] = [];
		defXlinesColor.push(ColourInput.getColorWithName("gray50")!);
		this.xLinesColor = new ColorListInput("XLinesColor", X_AXIS, defXlinesColor);
		this.setKeywordDoc(this.xLinesColor, "The colours for the vertical gridlines defined by input to the "
		                     + "'XLines' keyword. "
		                     + "If only one colour is provided, it is used for all the lines.",
				["gray76"]);
		this.addInput(this.xLinesColor);
		this.addSynonym(this.xLinesColor, "XLinesColour");

		// Y-Axis category

		this.yAxisTitle = new StringInput("YAxisTitle", Y_AXIS, "Y-Axis Title");
		this.setKeywordDoc(this.yAxisTitle, "Title of the primary y-axis.",
				["'Water Height (m)'"]);
		this.addInput(this.yAxisTitle);

		this.yAxisUnit = new EntityInput<Unit>(Unit, "YAxisUnit", Y_AXIS, null);
		this.setKeywordDoc(this.yAxisUnit, "The unit to be used for the primary-axis.",
				["t/h"]);
		this.addInput(this.yAxisUnit);

		this.yAxisStart = new ValueInput("YAxisStart", Y_AXIS, 0.0);
		this.setKeywordDoc(this.yAxisStart, "The minimum value for the primary y-axis.",
				["0 t/h"]);
		this.yAxisStart.setUnitType(UserSpecifiedUnit);
		this.addInput(this.yAxisStart);

		this.yAxisEnd = new ValueInput("YAxisEnd", Y_AXIS, 5.0);
		this.setKeywordDoc(this.yAxisEnd, "The maximum value for the primary y-axis.",
				["5 t/h"]);
		this.yAxisEnd.setUnitType(UserSpecifiedUnit);
		this.addInput(this.yAxisEnd);

		this.yAxisInterval = new ValueInput("YAxisInterval", Y_AXIS, 1.0);
		this.setKeywordDoc(this.yAxisInterval, "The interval between primary y-axis labels.",
				["1 t/h"]);
		this.yAxisInterval.setUnitType(UserSpecifiedUnit);
		this.yAxisInterval.setValidRange(1.0e-10, Double.POSITIVE_INFINITY);
		this.addInput(this.yAxisInterval);

		this.yAxisLabelFormat = new FormatInput("YAxisLabelFormat", Y_AXIS, "%.1f");
		this.setKeywordDoc(this.yAxisLabelFormat, "The format to be used for the tick mark values on the primary y-axis.",
				["%.1f"]);
		this.addInput(this.yAxisLabelFormat);

		this.yLines = new ValueListInput("YLines", Y_AXIS, DoubleVector.ofValues(1, 2, 3, 4));
		this.setKeywordDoc(this.yLines, "A list of values between YAxisStart and YAxisEnd at which to insert "
		                     + "horizontal gridlines.",
				["0  0.5  1  1.5  2  2.5  3  t/h"]);
		this.yLines.setUnitType(UserSpecifiedUnit);
		this.addInput(this.yLines);

		const defYlinesColor: Color4d[] = [];
		defYlinesColor.push(ColourInput.getColorWithName("gray50")!);
		this.yLinesColor = new ColorListInput("YLinesColor", Y_AXIS, defYlinesColor);
		this.setKeywordDoc(this.yLinesColor, "The colours for the vertical gridlines defined by input to the "
		                     + "'YLines' keyword. "
		                     + "If only one colour is provided, it is used for all the lines.",
				["gray76"]);
		this.addInput(this.yLinesColor);
		this.addSynonym(this.yLinesColor, "YLinesColour");

		// Secondary Y-Axis category

		this.secondaryYAxisTitle = new StringInput("SecondaryYAxisTitle", SEC_Y_AXIS, "Secondary Y-Axis Title");
		this.setKeywordDoc(this.secondaryYAxisTitle, "Title of the secondary y-axis.",
				["'Water Height (m)'"]);
		this.addInput(this.secondaryYAxisTitle);

		this.secondaryYAxisUnit = new EntityInput<Unit>(Unit, "SecondaryYAxisUnit", SEC_Y_AXIS, null);
		this.setKeywordDoc(this.secondaryYAxisUnit, "The unit to be used for the secondary y-axis.",
				["m"]);
		this.addInput(this.secondaryYAxisUnit);

		this.secondaryYAxisStart = new ValueInput("SecondaryYAxisStart", SEC_Y_AXIS, 0.0);
		this.setKeywordDoc(this.secondaryYAxisStart, "The minimum value for the secondary y-axis.",
				["0 m"]);
		this.secondaryYAxisStart.setUnitType(UserSpecifiedUnit);
		this.addInput(this.secondaryYAxisStart);

		this.secondaryYAxisEnd = new ValueInput("SecondaryYAxisEnd", SEC_Y_AXIS, 5.0);
		this.setKeywordDoc(this.secondaryYAxisEnd, "The maximum value for the secondary y-axis.",
				["5 m"]);
		this.secondaryYAxisEnd.setUnitType(UserSpecifiedUnit);
		this.addInput(this.secondaryYAxisEnd);

		this.secondaryYAxisInterval = new ValueInput("SecondaryYAxisInterval", SEC_Y_AXIS, 1.0);
		this.setKeywordDoc(this.secondaryYAxisInterval, "The interval between secondary y-axis labels.",
				["1 m"]);
		this.secondaryYAxisInterval.setUnitType(UserSpecifiedUnit);
		this.secondaryYAxisInterval.setValidRange(1.0e-10, Double.POSITIVE_INFINITY);
		this.addInput(this.secondaryYAxisInterval);

		this.secondaryYAxisLabelFormat = new FormatInput("SecondaryYAxisLabelFormat", SEC_Y_AXIS, "%.1f");
		this.setKeywordDoc(this.secondaryYAxisLabelFormat, "The format to be used for the tick mark values on the secondary "
		                     + "y-axis.",
				["%.1f"]);
		this.addInput(this.secondaryYAxisLabelFormat);

		// ---- Java のコンストラクタの中身 ----
		this.primarySeries = [];
		this.secondarySeries = [];
	}

	override postDefine(): void {
		super.postDefine();
		this.setYAxisUnit(DimensionlessUnit);
		this.setSecondaryYAxisUnit(DimensionlessUnit);
		this.setXAxisUnit(DimensionlessUnit);
	}

	static readonly unitTypeCallback: InputCallback = {
		callback(ent: Entity, inp: Input<unknown>): void {
			const ut = (inp as unknown as UnitTypeInput).getUnitType()!;
			(ent as AbstractGraph).setYAxisUnit(ut);
		},
	} as InputCallback;

	static readonly secondaryUnitTypeCallback: InputCallback = {
		callback(ent: Entity, inp: Input<unknown>): void {
			const ut = (inp as unknown as UnitTypeInput).getUnitType()!;
			(ent as AbstractGraph).setSecondaryYAxisUnit(ut);
		},
	} as InputCallback;

	static readonly lineColoursCallback: InputCallback = {
		callback(ent: Entity, inp: Input<unknown>): void {
			const graph = ent as AbstractGraph;
			for (let i = 0; i < graph.primarySeriesSize(); ++ i) {
				graph.setPrimarySeriesColour(i, graph.getLineColor(i));
			}
		},
	} as InputCallback;

	static readonly lineWidthsCallback: InputCallback = {
		callback(ent: Entity, inp: Input<unknown>): void {
			const graph = ent as AbstractGraph;
			for (let i = 0; i < graph.primarySeriesSize(); ++ i) {
				graph.setPrimarySeriesWidth(i, graph.getLineWidth(i));
			}
		},
	} as InputCallback;

	static readonly secondaryLineColoursCallback: InputCallback = {
		callback(ent: Entity, inp: Input<unknown>): void {
			const graph = ent as AbstractGraph;
			for (let i = 0; i < graph.secondarySeriesSize(); ++ i) {
				graph.setSecondarySeriesColour(i, graph.getSecondaryLineColor(i));
			}
		},
	} as InputCallback;

	static readonly secondaryLineWidthsCallback: InputCallback = {
		callback(ent: Entity, inp: Input<unknown>): void {
			const graph = ent as AbstractGraph;
			for (let i = 0; i < graph.secondarySeriesSize(); ++ i) {
				graph.setSecondarySeriesWidth(i, graph.getSecondaryLineWidth(i));
			}
		},
	} as InputCallback;

	override earlyInit(): void {
		super.earlyInit();

		this.primarySeries.length = 0;
		this.secondarySeries.length = 0;
	}

	protected setXAxisUnit(unitType: JClass<Unit>): void {
		this.xAxisUnit.setSubClass(unitType);
		this.xAxisStart.setUnitType(unitType);
		this.xAxisEnd.setUnitType(unitType);
		this.xAxisInterval.setUnitType(unitType);
		this.xLines.setUnitType(unitType);
		this.updateUserOutputMap();
	}

	protected setYAxisUnit(unitType: JClass<Unit>): void {
		this.yAxisUnit.setSubClass(unitType);
		this.yAxisStart.setUnitType(unitType);
		this.yAxisEnd.setUnitType(unitType);
		this.yAxisInterval.setUnitType(unitType);
		this.yLines.setUnitType(unitType);
		this.updateUserOutputMap();
	}

	protected setSecondaryYAxisUnit(unitType: JClass<Unit>): void {
		this.secondaryYAxisUnit.setSubClass(unitType);
		this.secondaryYAxisStart.setUnitType(unitType);
		this.secondaryYAxisEnd.setUnitType(unitType);
		this.secondaryYAxisInterval.setUnitType(unitType);
		this.updateUserOutputMap();
	}

	/** Java の getLineColor(int index, ArrayList<Color4d> colorList) と getLineColor(int index) */
	protected getLineColor(index: number, colorList?: Color4d[]): Color4d {
		if (colorList === undefined)
			return this.getLineColor(index, this.lineColorsList.getValue()!);
		index = Math.min(index, colorList.length-1);
		return colorList[index];
	}

	/** Java の getLineWidth(int index, DoubleVector widthList) と getLineWidth(int index) */
	protected getLineWidth(index: number, widthList?: DoubleVector): number {
		if (widthList === undefined)
			return this.getLineWidth(index, this.lineWidths.getValue()!);
		index = Math.min(index, widthList.size()-1);
		return jint(widthList.get(index));
	}

	protected getSecondaryLineColor(index: number): Color4d {
		return this.getLineColor(index, this.secondaryLineColorsList.getValue()!);
	}

	protected getSecondaryLineWidth(index: number): number {
		return this.getLineWidth(index, this.secondaryLineWidths.getValue()!);
	}

	getTitle(): string {
		return this.title.getValue()!;
	}

	getXAxisTitle(): string {
		return this.xAxisTitle.getValue()!;
	}

	getXAxisUnit(): Unit | null {
		return this.xAxisUnit.getValue()!;
	}

	getXAxisStart(): number {
		return this.xAxisStart.getValue()!;
	}

	getXAxisEnd(): number {
		return this.xAxisEnd.getValue()!;
	}

	getXAxisInterval(): number {
		return this.xAxisInterval.getValue()!;
	}

	getXAxisLabelFormat(): string {
		return this.xAxisLabelFormat.getValue()!;
	}

	getYAxisTitle(): string {
		return this.yAxisTitle.getValue()!;
	}

	getYAxisUnit(): Unit | null {
		return this.yAxisUnit.getValue()!;
	}

	getYAxisStart(): number {
		return this.yAxisStart.getValue()!;
	}

	getYAxisEnd(): number {
		return this.yAxisEnd.getValue()!;
	}

	getYAxisInterval(): number {
		return this.yAxisInterval.getValue()!;
	}

	getYAxisLabelFormat(): string {
		return this.yAxisLabelFormat.getValue()!;
	}

	getSecondaryYAxisTitle(): string {
		return this.secondaryYAxisTitle.getValue()!;
	}

	getSecondaryYAxisUnit(): Unit | null {
		return this.secondaryYAxisUnit.getValue()!;
	}

	getSecondaryYAxisStart(): number {
		return this.secondaryYAxisStart.getValue()!;
	}

	getSecondaryYAxisEnd(): number {
		return this.secondaryYAxisEnd.getValue()!;
	}

	getSecondaryYAxisInterval(): number {
		return this.secondaryYAxisInterval.getValue()!;
	}

	getSecondaryYAxisLabelFormat(): string {
		return this.secondaryYAxisLabelFormat.getValue()!;
	}

	getXLines(): DoubleVector {
		return this.xLines.getValue()!;
	}

	getXLineColours(): Color4d[] {
		return this.xLinesColor.getValue()!;
	}

	getYLines(): DoubleVector {
		return this.yLines.getValue()!;
	}

	getYLineColours(): Color4d[] {
		return this.yLinesColor.getValue()!;
	}

	isTimeTrace(): boolean {
		return false;
	}

	showSecondaryYAxis(): boolean {
		return false;
	}

	getPrimarySeries(): AbstractGraph_SeriesInfo[] {
		return this.primarySeries;
	}

	getSecondarySeries(): AbstractGraph_SeriesInfo[] {
		return this.secondarySeries;
	}

	protected populatePrimarySeriesInfo(numSeries: number, numPoints: number, sampList: SampleProvider[] | null): void {
		this.populateSeriesInfo(this.primarySeries, numSeries, numPoints, sampList);
	}

	protected populateSecondarySeriesInfo(numSeries: number, numPoints: number, sampList: SampleProvider[] | null): void {
		this.populateSeriesInfo(this.secondarySeries, numSeries, numPoints, sampList);
	}

	protected populateSeriesInfo(infos: AbstractGraph_SeriesInfo[], numSeries: number, numPoints: number, sampList: SampleProvider[] | null): void {
		for (let i = 0; i < numSeries; ++i) {
			const info = new AbstractGraph_SeriesInfo();
			if (sampList !== null)
				info.samp = sampList[i];
			info.yValues = new Array<number>(numPoints).fill(0.0);
			info.xValues = new Array<number>(numPoints).fill(0.0);

			infos.push(info);
		}
	}

	protected primarySeriesSize(): number {
		return this.primarySeries.length;
	}

	protected secondarySeriesSize(): number {
		return this.secondarySeries.length;
	}

	protected setPrimarySeriesColour(i: number, col: Color4d): void {
		if (i >= this.primarySeries.length)
			return;
		this.primarySeries[i].lineColour = col;
	}

	protected setSecondarySeriesColour(i: number, col: Color4d): void {
		if (i >= this.secondarySeries.length)
			return;
		this.secondarySeries[i].lineColour = col;
	}

	protected setPrimarySeriesWidth(i: number, width: number): void {
		if (i >= this.primarySeries.length)
			return;
		this.primarySeries[i].lineWidth = width;
	}

	protected setSecondarySeriesWidth(i: number, width: number): void {
		if (i >= this.secondarySeries.length)
			return;
		this.secondarySeries[i].lineWidth = width;
	}

	override canLabel(): boolean {
		return false;
	}

}

LateClasses.bind("com.jaamsim.Graphics.AbstractGraph", AbstractGraph);
