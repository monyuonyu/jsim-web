/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2009-2012 Ausenco Engineering Canada Inc.
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
import { SampleInput } from "../Samples/SampleInput.ts";
import { SampleListInput } from "../Samples/SampleListInput.ts";
import { Entity } from "../basicsim/Entity.ts";
import { DoubleVector } from "../datatypes/DoubleVector.ts";
import { EventManager, ProcessTarget } from "../events/EventManager.ts";
import { Input } from "../input/Input.ts";
import { ClassRegistry } from "../java/ClassRegistry.ts";
import { Double, type JClass } from "../java/lang.ts";
import type { Vec3d } from "../math/Vec3d.ts";
import { DimensionlessUnit } from "../units/DimensionlessUnit.ts";
import { TimeUnit } from "../units/TimeUnit.ts";
import type { Unit } from "../units/Unit.ts";
import { AbstractGraph, type AbstractGraph_SeriesInfo } from "./AbstractGraph.ts";
import { LateClasses, jint } from "./LateClasses.ts";

/*
 * 移植の注意:
 * - 入れ子の private static class ProcessGraphTarget は、このファイルの Graph_ProcessGraphTarget にした。
 * - フィールド processGraph（ProcessTarget）は、関数 processGraph と名前がぶつかるので processGraphTarget にした。
 * - 多重定義 processGraph() / processGraph(SeriesInfo) は引数の有無で見分ける。
 * - setupSeriesData は Java のまま（numPoints を増やしてから書くので、配列の 0 番は書かれない）。
 *   Java では配列の外に書くと ArrayIndexOutOfBoundsException になるので、同じく誤りにした。
 */

class Graph_ProcessGraphTarget extends ProcessTarget {
	readonly graph: Graph;

	constructor(graph: Graph) {
		super();
		this.graph = graph;
	}

	getDescription(): string {
		return this.graph.getName() + ".processGraph";
	}

	process(): void {
		this.graph.processGraph();
	}
}

/** Java の配列の書き込み（範囲の外なら ArrayIndexOutOfBoundsException と同じく誤り） */
function setChecked(arr: number[], i: number, val: number): void {
	if (i < 0 || i >= arr.length)
		throw new RangeError(`Index ${i} out of bounds for length ${arr.length}`);
	arr[i] = val;
}

export class Graph extends AbstractGraph  {

	protected readonly numberOfPoints: SampleInput;

	protected readonly dataSource: SampleListInput;

	protected readonly secondaryDataSource: SampleListInput;

	private readonly processGraphTarget: ProcessTarget = new Graph_ProcessGraphTarget(this);

	constructor() {
		super();

		// ---- Java の初期化ブロック ----
		this.xAxisTitle.setDefaultValue("Time (h)");
		const unit = Input.parseEntity(this.getJaamSimModel(), "h", TimeUnit);
		this.xAxisUnit.setDefaultValue(unit);
		this.xAxisStart.setDefaultValue(-24 * 3600.0);
		this.xAxisInterval.setDefaultValue(6 * 3600.0);
		this.xLines.setDefaultValue(DoubleVector.ofValues(-6*3600.0, -12*3600.0, -18*3600.0));

		this.xAxisStart.setValidRange(Double.NEGATIVE_INFINITY, 1.0e-6);
		this.xAxisEnd.setValidRange(0.0, Double.POSITIVE_INFINITY);

		this.numberOfPoints = SampleInput.ofInt("NumberOfPoints", Entity.KEY_INPUTS, 100);
		this.setKeywordDoc(this.numberOfPoints, "The number of data points for each line on the graph.",
				["200"]);
		this.numberOfPoints.setValidRange(0, Double.POSITIVE_INFINITY);
		this.numberOfPoints.setIntegerValue(true);
		this.addInput(this.numberOfPoints);

		this.dataSource = new SampleListInput("DataSource", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.dataSource, "One or more sources of data to be graphed against the primary y-axis. "
		                     + "Each source is graphed as a separate line. "
		                     + "BEFORE entering this input, specify the unit type for the primary "
		                     + "y-axis using the 'UnitType' keyword.",
				["{ [Entity1].Output1 } { [Entity2].Output2 }"]);
		this.dataSource.setUnitType(DimensionlessUnit);
		this.dataSource.setRequired(true);
		this.addInput(this.dataSource);

		this.secondaryDataSource = new SampleListInput("SecondaryDataSource", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.secondaryDataSource, "One or more sources of data to be graphed against the secondary y-axis. "
		                     + "Each source is graphed as a separate line. "
		                     + "BEFORE entering this input, specify the unit type for the secondary "
		                     + "y-axis using the 'SecondaryUnitType' keyword.",
				["{ [Entity1].Output1 } { [Entity2].Output2 }"]);
		this.secondaryDataSource.setUnitType(DimensionlessUnit);
		this.addInput(this.secondaryDataSource);
	}

	override postDefine(): void {
		super.postDefine();
		this.setXAxisUnit(TimeUnit);
	}

	protected override setYAxisUnit(unitType: JClass<Unit>): void {
		this.dataSource.setUnitType(unitType);
		super.setYAxisUnit(unitType);
	}

	protected override setSecondaryYAxisUnit(unitType: JClass<Unit>): void {
		this.secondaryDataSource.setUnitType(unitType);
		super.setSecondaryYAxisUnit(unitType);
	}

	override setInputsForDragAndDrop(): void {}

	override earlyInit(): void {
		super.earlyInit();

		// Populate the primary series data structures
		const num = this.getNumberOfPoints();
		this.populatePrimarySeriesInfo(this.dataSource.getListSize(), num, this.dataSource.getValue()!);
		this.populateSecondarySeriesInfo(this.secondaryDataSource.getListSize(), num, this.secondaryDataSource.getValue()!);
	}

	override getSize(): Vec3d {
		const ret = super.getSize();
		ret.z = Math.max(ret.z, 0.001);
		return ret;
	}

	override startUp(): void {
		super.startUp();
		this.extraStartGraph();

		for (let i = 0; i < this.primarySeriesSize(); ++ i) {
			this.setPrimarySeriesColour(i, this.getLineColor(i));
			this.setPrimarySeriesWidth(i, this.getLineWidth(i));
		}

		for (let i = 0; i < this.secondarySeriesSize(); ++i) {
			this.setSecondarySeriesColour(i, this.getSecondaryLineColor(i));
			this.setSecondarySeriesWidth(i, this.getSecondaryLineWidth(i));
		}

		const xLength = this.xAxisEnd.getValue()! - this.xAxisStart.getValue()!;
		const xInterval = xLength/(this.getNumberOfPoints() - 1);

		for (const info of this.getPrimarySeries()) {
			this.setupSeriesData(info, xLength, xInterval);
		}

		for (const info of this.getSecondarySeries()) {
			this.setupSeriesData(info, xLength, xInterval);
		}

		this.processGraph();
	}

	/**
	 * Hook for sub-classes to do some processing at startup
	 */
	protected extraStartGraph(): void {}

	/**
	 * Initialize the data for the specified series
	 */
	private setupSeriesData(info: AbstractGraph_SeriesInfo, xLength: number, xInterval: number): void {

		info.numPoints = 0;
		info.indexOfLastEntry = -1;

		for( let i = 0; i * xInterval < this.xAxisEnd.getValue()!; i++ ) {
			const t = i * xInterval;
			info.numPoints++;
			setChecked(info.xValues, info.numPoints, t);
			setChecked(info.yValues, info.numPoints, this.getCurrentValue(t, info));
		}
	}

	/**
	 * A hook method for descendant graph types to grab some processing time
	 */
	protected extraProcessing(): void {}

	/**
	 * Java の processGraph()（Calculate values for the data series on the graph）と
	 * processGraph(SeriesInfo info)（Calculate values for the data series on the graph
	 * @param info - the information for the series to be rendered）。
	 */
	processGraph(info?: AbstractGraph_SeriesInfo): void {
		if (info !== undefined) {
			this.processGraphForSeries(info);
			return;
		}

		// Give processing time to sub-classes
		this.extraProcessing();

		// stop the processing loop
		const primarySeries = this.getPrimarySeries();
		const secondarySeries = this.getSecondarySeries();
		if (primarySeries.length === 0 && secondarySeries.length === 0)
			return;

		// Calculate values for the primary y-axis
		for (const inf of primarySeries) {
			this.processGraph(inf);
		}

		// Calculate values for the secondary y-axis
		for (const inf of secondarySeries) {
			this.processGraph(inf);
		}

		const xLength = this.xAxisEnd.getValue()! - this.xAxisStart.getValue()!;
		const xInterval = xLength / (this.getNumberOfPoints() - 1);
		EventManager.scheduleSeconds(xInterval, Entity.PRI_MED_LOW, Entity.EVT_LIFO, this.processGraphTarget, null);
	}

	/** processGraph(SeriesInfo info) の中身 */
	private processGraphForSeries(info: AbstractGraph_SeriesInfo): void {

		// Entity has been removed
		if (info.samp === null) {
			return;
		}

		const t = EventManager.simSeconds() + this.xAxisEnd.getValue()!;
		const presentValue = this.getCurrentValue(t, info);

		info.indexOfLastEntry++;
		if (info.indexOfLastEntry === info.yValues.length) {
			info.indexOfLastEntry = 0;
		}

		setChecked(info.xValues, info.indexOfLastEntry, t);
		setChecked(info.yValues, info.indexOfLastEntry, presentValue);

		if (info.numPoints < info.yValues.length) {
			info.numPoints++;
		}
	}

	/**
	 * Return the current value for the series
	 * @return double
	 */
	protected getCurrentValue(simTime: number, info: AbstractGraph_SeriesInfo): number {
		return info.samp!.getNextSample(this, simTime);
	}

	getNumberOfPoints(): number {
		return jint(this.numberOfPoints.getNextSample(this, 0.0));
	}

	override showSecondaryYAxis(): boolean {
		return !this.secondaryDataSource.isDefault();
	}

	override isTimeTrace(): boolean {
		return true;
	}

}

ClassRegistry.register("com.jaamsim.Graphics.Graph", Graph);
LateClasses.bind("com.jaamsim.Graphics.Graph", Graph);
