/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2009-2013 Ausenco Engineering Canada Inc.
 * Copyright (C) 2023-2026 JaamSim Software Inc.
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
import { Entity } from "../basicsim/Entity.ts";
import { DoubleVector } from "../datatypes/DoubleVector.ts";
import { EnumInput } from "../input/EnumInput.ts";
import { ExpError } from "../input/ExpError.ts";
import { ExpResType } from "../input/ExpResType.ts";
import { ExpResult } from "../input/ExpResult.ts";
import { ExpressionListInput } from "../input/ExpressionListInput.ts";
import type { Input } from "../input/Input.ts";
import type { InputCallback } from "../input/InputCallback.ts";
import { UnitTypeInput } from "../input/UnitTypeInput.ts";
import { ClassRegistry } from "../java/ClassRegistry.ts";
import type { JClass } from "../java/lang.ts";
import { DimensionlessUnit } from "../units/DimensionlessUnit.ts";
import type { Unit } from "../units/Unit.ts";
import { UserSpecifiedUnit } from "../units/UserSpecifiedUnit.ts";
import { AbstractGraph, AbstractGraph_SeriesInfo } from "./AbstractGraph.ts";
import { LateClasses } from "./LateClasses.ts";

/*
 * 移植の注意: 入れ子の enum XYGraph.ValidGraphTypes は、このファイルの enum XYGraph_ValidGraphTypes にした
 * （XYGraph.ValidGraphTypes からも引ける）。値は名前と同じ文字列。
 */

export enum XYGraph_ValidGraphTypes {
	LINE_GRAPH = "LINE_GRAPH",
	BAR_GRAPH = "BAR_GRAPH",
}

export class XYGraph extends AbstractGraph {

	static readonly ValidGraphTypes = XYGraph_ValidGraphTypes;

	private readonly xUnitType: UnitTypeInput;

	protected readonly yDataSource: ExpressionListInput;

	protected readonly xDataSource: ExpressionListInput;

	protected readonly ySecondaryDataSource: ExpressionListInput;

	protected readonly xSecondaryDataSource: ExpressionListInput;

	protected readonly graphType: EnumInput<XYGraph_ValidGraphTypes>;

	protected readonly secondaryGraphType: EnumInput<XYGraph_ValidGraphTypes>;

	constructor() {
		super();

		// ---- Java の初期化ブロック ----
		this.xAxisStart.setDefaultValue(0.0);
		this.xAxisEnd.setDefaultValue(10.0);
		this.xAxisInterval.setDefaultValue(1.0);
		this.xAxisLabelFormat.setDefaultValue("%.0f");
		this.xLines.setDefaultValue(DoubleVector.ofValues(5.0));

		this.xUnitType = new UnitTypeInput("XAxisUnitType", Entity.KEY_INPUTS, DimensionlessUnit);
		this.setKeywordDoc(this.xUnitType, "Unit type for the x-axis. "
		                     + "MUST be entered before most other inputs for this axis.",
				["DistanceUnit"]);
		this.xUnitType.setCallback(XYGraph.xAxisUnitTypeCallback);
		this.addInput(this.xUnitType);

		this.yDataSource = new ExpressionListInput("YDataSource", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.yDataSource, "One or more sources of data to be graphed on the primary y-axis.\n"
		                     + "Each source is graphed as a separate line or bar and is specified by an "
		                     + "array of numbers with or without units.",
				["{ [Statistics1].HistogramBinFractions } { [Statistics2].HistogramBinFractions }"]);
		this.yDataSource.setResultType(ExpResType.COLLECTION);
		this.yDataSource.setUnitType(UserSpecifiedUnit);
		this.addInput(this.yDataSource);

		this.xDataSource = new ExpressionListInput("XDataSource", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.xDataSource, "One or more sources of data for the x-axis values corresponding to the "
		                     + "primary y-axis data sources.\n"
		                     + "Each source is specified by an array of numbers with or without units.",
				["{ [Statistics1].HistogramBinCentres } { [Statistics2].HistogramBinCentres }"]);
		this.xDataSource.setResultType(ExpResType.COLLECTION);
		this.xDataSource.setUnitType(UserSpecifiedUnit);
		this.addInput(this.xDataSource);

		this.ySecondaryDataSource = new ExpressionListInput("YSecondaryDataSource", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.ySecondaryDataSource, "One or more sources of data to be graphed on the secondary y-axis.\n"
		                     + "Each source is graphed as a separate line or bar and is specified by an "
		                     + "array of numbers with or without units.",
				["{ [Statistics1].HistogramBinCumulativeFractions } { [Statistics2].HistogramBinCumulativeFractions }"]);
		this.ySecondaryDataSource.setResultType(ExpResType.COLLECTION);
		this.ySecondaryDataSource.setUnitType(UserSpecifiedUnit);
		this.addInput(this.ySecondaryDataSource);

		this.xSecondaryDataSource = new ExpressionListInput("XSecondaryDataSource", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.xSecondaryDataSource, "One or more sources of data for the x-axis values corresponding to the "
		                     + "secondary y-axis data sources.\n"
		                     + "Each source is specified by an array of numbers with or without units.",
				["{ [Statistics1].HistogramBinUpperLimits } { [Statistics2].HistogramBinUpperLimits }"]);
		this.xSecondaryDataSource.setResultType(ExpResType.COLLECTION);
		this.xSecondaryDataSource.setUnitType(UserSpecifiedUnit);
		this.addInput(this.xSecondaryDataSource);

		this.graphType = new EnumInput<XYGraph_ValidGraphTypes>(XYGraph_ValidGraphTypes, "GraphType", Entity.FORMAT,
				XYGraph_ValidGraphTypes.LINE_GRAPH);
		this.setKeywordDoc(this.graphType, "Type of graph for each of the primary series:\n"
		                     + "LINE_GRAPH - each series displayed as a line\n"
		                     + "BAR_GRAPH  - each series displayed as a sequence of bars", []);
		this.addInput(this.graphType);

		this.secondaryGraphType = new EnumInput<XYGraph_ValidGraphTypes>(XYGraph_ValidGraphTypes, "SecondaryGraphType",
				Entity.FORMAT, XYGraph_ValidGraphTypes.LINE_GRAPH);
		this.setKeywordDoc(this.secondaryGraphType, "Type of graph for each of the secondary series:\n"
		                     + "LINE_GRAPH - each series displayed as a line\n"
		                     + "BAR_GRAPH  - each series displayed as a sequence of bars", []);
		this.addInput(this.secondaryGraphType);
	}

	static readonly xAxisUnitTypeCallback: InputCallback = {
		callback(ent: Entity, inp: Input<unknown>): void {
			const ut = (inp as unknown as UnitTypeInput).getUnitType()!;
			(ent as XYGraph).setXAxisUnit(ut);
		},
	} as InputCallback;

	override setInputsForDragAndDrop(): void {}

	protected override setYAxisUnit(unitType: JClass<Unit>): void {
		this.yDataSource.setUnitType(unitType);
		super.setYAxisUnit(unitType);
	}

	protected override setSecondaryYAxisUnit(unitType: JClass<Unit>): void {
		this.ySecondaryDataSource.setUnitType(unitType);
		super.setSecondaryYAxisUnit(unitType);
	}

	protected override setXAxisUnit(unitType: JClass<Unit>): void {
		this.xDataSource.setUnitType(unitType);
		super.setXAxisUnit(unitType);
	}

	override showSecondaryYAxis(): boolean {
		return !this.ySecondaryDataSource.isDefault();
	}

	override updateGraphics(simTime: number): void {
		super.updateGraphics(simTime);

		this.getPrimarySeries().length = 0;
		this.getSecondarySeries().length = 0;

		if (!this.yDataSource.isDefault() && !this.xDataSource.isDefault()) {
			const numSeries = Math.min(this.yDataSource.getListSize(), this.xDataSource.getListSize());
			for (let series = 0; series < numSeries; series++) {
				const yCol = this.yDataSource.getNextResult(series, this, simTime).colVal!;
				const xCol = this.xDataSource.getNextResult(series, this, simTime).colVal!;

				const info = new AbstractGraph_SeriesInfo();
				this.getPrimarySeries().push(info);
				const numPoints = Math.min(xCol.getSize(), yCol.getSize());
				info.yValues = new Array<number>(numPoints).fill(0.0);
				info.xValues = new Array<number>(numPoints).fill(0.0);

				info.numPoints = numPoints;
				info.indexOfLastEntry = numPoints - 1;
				info.lineColour = this.getLineColor(series);
				info.lineWidth = this.getLineWidth(series);
				info.isBar = (this.graphType.getValue()! === XYGraph_ValidGraphTypes.BAR_GRAPH);
				for (let i = 0; i < info.numPoints; i++ ) {
					const ind = ExpResult.makeNumResult(i + 1, DimensionlessUnit);
					try {
						info.yValues[i] = yCol.index(ind).value;
						info.xValues[i] = xCol.index(ind).value;
					}
					catch (e) {
						if (!(e instanceof ExpError)) throw e;
					}
				}
			}
		}

		if (!this.ySecondaryDataSource.isDefault() && !this.xSecondaryDataSource.isDefault()) {
			const numSeries = Math.min(this.ySecondaryDataSource.getListSize(), this.xSecondaryDataSource.getListSize());
			for (let series = 0; series < numSeries; series++) {
				const ySecCol = this.ySecondaryDataSource.getNextResult(series, this, simTime).colVal!;
				const xSecCol = this.xSecondaryDataSource.getNextResult(series, this, simTime).colVal!;

				const info = new AbstractGraph_SeriesInfo();
				this.getSecondarySeries().push(info);
				const numPointsSec = Math.min(xSecCol.getSize(), ySecCol.getSize());
				info.yValues = new Array<number>(numPointsSec).fill(0.0);
				info.xValues = new Array<number>(numPointsSec).fill(0.0);

				info.numPoints = numPointsSec;
				info.indexOfLastEntry = numPointsSec - 1;
				info.lineColour = this.getSecondaryLineColor(series);
				info.lineWidth = this.getSecondaryLineWidth(series);
				info.isBar = (this.secondaryGraphType.getValue()! === XYGraph_ValidGraphTypes.BAR_GRAPH);
				for (let i = 0; i < info.numPoints; i++ ) {
					const ind = ExpResult.makeNumResult(i + 1, DimensionlessUnit);
					try {
						info.yValues[i] = ySecCol.index(ind).value;
						info.xValues[i] = xSecCol.index(ind).value;
					}
					catch (e) {
						if (!(e instanceof ExpError)) throw e;
					}
				}
			}
		}
	}

}

ClassRegistry.register("com.jaamsim.Graphics.XYGraph", XYGraph);
LateClasses.bind("com.jaamsim.Graphics.XYGraph", XYGraph);
