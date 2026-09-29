/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2013 Ausenco Engineering Canada Inc.
 * Copyright (C) 2018-2024 JaamSim Software Inc.
 * TypeScript への移植 (C) 2026 shota
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
 */

// 入れ子のクラス WaitForNextValueTarget は、このファイルの中だけの TimeSeries_WaitForNextValueTarget にした。
// 多重定義:
// - getNextSample(double) と getNextSample(Entity, double) は、引数の数で見分ける。
// - private の getTicks(double) と getTicks(TSPoint) は、引数の型で見分ける。
// - private の getSimTime(long) は、Entity の出力 getSimTime(double) とぶつかるので getSimTimeForTicks にした（docs/renamed.md）。
// Java の Arrays.binarySearch(long[]) と Arrays.binarySearch(double[]) は、同じ手順の binarySearchLong・binarySearchDouble で写した。

import { BooleanProvInput } from "../BooleanProviders/BooleanProvInput.ts";
import { DisplayEntity } from "../Graphics/DisplayEntity.ts";
import { Entity } from "../basicsim/Entity.ts";
import { EntityTarget } from "../basicsim/EntityTarget.ts";
import type { ObserverEntity } from "../basicsim/ObserverEntity.ts";
import type { SubjectEntity } from "../basicsim/SubjectEntity.ts";
import { SubjectEntityDelegate } from "../basicsim/SubjectEntityDelegate.ts";
import { EventManager } from "../events/EventManager.ts";
import type { ProcessTarget } from "../events/ProcessTarget.ts";
import type { Input } from "../input/Input.ts";
import type { InputCallback } from "../input/InputCallback.ts";
import { InputErrorException } from "../input/InputErrorException.ts";
import { TimeSeriesDataInput } from "../input/TimeSeriesDataInput.ts";
import { UnitTypeInput } from "../input/UnitTypeInput.ts";
import { defineOutput } from "../input/OutputRegistry.ts";
import { TimeUnit } from "../units/TimeUnit.ts";
import type { Unit } from "../units/Unit.ts";
import { UserSpecifiedUnit } from "../units/UserSpecifiedUnit.ts";
import { tr } from "../i18n/I18n.ts";
import { ClassRegistry } from "../java/ClassRegistry.ts";
import { Double, JMath, Long } from "../java/lang.ts";
import type { JClass } from "../java/lang.ts";
import { SampleInput } from "./SampleInput.ts";
import { TSPoint } from "./TSPoint.ts";
import type { TimeSeriesProvider } from "./TimeSeriesProvider.ts";

/** Java の Arrays.binarySearch(long[] a, long key)（同じ手順。同じ値が並ぶときも同じ位置を返す） */
function binarySearchLong(a: number[], key: number): number {
	let low = 0;
	let high = a.length - 1;

	while (low <= high) {
		const mid = (low + high) >>> 1;
		const midVal = a[mid];

		if (midVal < key)
			low = mid + 1;
		else if (midVal > key)
			high = mid - 1;
		else
			return mid; // key found
	}
	return -(low + 1);  // key not found.
}

/** Java の Arrays.binarySearch(double[] a, double key)（-0.0 と 0.0、NaN の扱いも同じ） */
function binarySearchDouble(a: number[], key: number): number {
	let low = 0;
	let high = a.length - 1;

	while (low <= high) {
		const mid = (low + high) >>> 1;
		const midVal = a[mid];

		if (midVal < key)
			low = mid + 1;  // Neither val is NaN, thisVal is smaller
		else if (midVal > key)
			high = mid - 1; // Neither val is NaN, thisVal is larger
		else {
			// doubleToLongBits の比較（Double.compare と同じ）
			const c = Double.compare(midVal, key);
			if (c === 0)
				return mid;             // Key found
			else if (c < 0)
				low = mid + 1;
			else
				high = mid - 1;
		}
	}
	return -(low + 1);  // key not found.
}

export class TimeSeries extends DisplayEntity implements TimeSeriesProvider, SubjectEntity {

	private readonly offsetToFirst: BooleanProvInput;
	private readonly offsetTime: SampleInput;
	private readonly unitType: UnitTypeInput;
	private readonly value: TimeSeriesDataInput;
	private readonly cycleTime: SampleInput;

	private readonly subject: SubjectEntityDelegate = new SubjectEntityDelegate(this);

	private readonly waitForNextValueTarget: ProcessTarget;

	static readonly inputCallback: InputCallback = {
		callback(ent: Entity, inp: Input<unknown>): void {
			(ent as unknown as TimeSeries).updateInputValue();
		},
	};

	constructor() {
		super();

		// Java の初期化ブロック
		this.offsetToFirst = new BooleanProvInput("OffsetToFirst", Entity.KEY_INPUTS, true);
		this.setKeywordDoc(this.offsetToFirst,
				"If TRUE, the simulation times corresponding to the time stamps "
				+ "entered to the 'Value' keyword are calculated relative to the "
				+ "first time stamp. This offset sets the simulation time for the first "
				+ "time stamp to zero seconds.", []);
		this.addInput(this.offsetToFirst);

		this.offsetTime = new SampleInput("OffsetTime", Entity.KEY_INPUTS, 0.0);
		this.setKeywordDoc(this.offsetTime,
				"Increment applied to the event times entered to the 'Value' input. "
				+ "For example, if the OffsetTime is set to 1.0 h and an event time is "
				+ "set to 24 h in the Value input, then this event will occur at "
				+ "25 hours instead of 24 hours.\n\n"
				+ "If an expression is entered, it must return a value that remains "
				+ "constant for the entire simulation run.\n\n"
				+ "The offset time is applied to the TimeSeries values at run time. "
				+ "Unlike the 'OffsetToFirst' input and the 'StartTime' input for "
				+ "Simulation, the 'OffsetTime' input can be changed without reloading the "
				+ "'Value' input",
				["3.0 h", "[InputData].Offset"]);
		this.offsetTime.setUnitType(TimeUnit);
		this.addInput(this.offsetTime);

		this.unitType = new UnitTypeInput("UnitType", Entity.KEY_INPUTS, UserSpecifiedUnit);
		this.setKeywordDoc(this.unitType,
				"The unit type for the time series. The UnitType input must be "
				+ "specified before the Value input.",
				["DistanceUnit", "MassUnit", "DimensionlessUnit"]);
		this.unitType.setRequired(true);
		this.unitType.setCallback(TimeSeries.inputCallback);
		this.addInput(this.unitType);

		this.value = new TimeSeriesDataInput("Value", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.value,
				"A list of time series records with format { time value }, where: "
				+ "'time' is the time stamp for the record and 'value' is the time "
				+ "series value. Records are entered in order of increasing simulation "
				+ "time. The appropriate units should be included with both the time "
				+ "and value inputs.",
				["{ 0 h 1 } { 3 h 0 }",
				 "{ 0 h 0.5 m } { 3 h 1.5 m }",
				 "{ '2010-01-01 00:00:00' 0.5 m } { '2010-01-01 03:00:00' 1.5 m }"]);
		this.value.setTickLength(this.getSimulation().getTickLength());
		this.value.setUnitType(UserSpecifiedUnit);
		this.value.setRequired(true);
		this.addInput(this.value);

		this.cycleTime = new SampleInput("CycleTime", Entity.KEY_INPUTS, Double.POSITIVE_INFINITY);
		this.setKeywordDoc(this.cycleTime,
				"The time at which the time series will repeat from the start.",
				["8760.0 h"]);
		this.cycleTime.setUnitType(TimeUnit);
		this.addInput(this.cycleTime);

		// Java ではフィールドの初期値（初期化ブロックの後）
		this.waitForNextValueTarget = new TimeSeries_WaitForNextValueTarget(this);
	}

	override earlyInit(): void {
		super.earlyInit();
		this.subject.clear();
	}

	override validate(): void {
		super.validate();

		if (this.value.getTickLength() !== this.getSimulation().getTickLength())
			throw new InputErrorException(tr("A new value was entered for the Simulation keyword TickLength " +
					"after the TimeSeries data had been loaded.%n" +
					"The configuration file must be saved and reloaded before the simulation can be executed."));

		const ticksList = this.value.getValue()!.ticksList;
		if (this.getCycleTicks() < ticksList[ticksList.length - 1] - ticksList[0])
			throw new InputErrorException(tr("CycleTime must be larger than the difference between "
					+ "the first and last times in the series."));
	}

	updateInputValue(): void {
		this.value.setUnitType(this.unitType.getUnitType()!);
		this.updateUserOutputMap();
	}

	override startUp(): void {
		super.startUp();
		this.waitForNextValue();
	}

	registerObserver(obs: ObserverEntity): void {
		this.subject.registerObserver(obs);
	}

	notifyObservers(): void {
		this.subject.notifyObservers();
	}

	override getObserverList(): ObserverEntity[] {
		return this.subject.getObserverList();
	}

	isOffsetToFirst(): boolean {
		return this.offsetToFirst.getNextBoolean(this, 0.0);
	}

	isCycleTimeInfinite(): boolean {
		return (this.cycleTime.getNextSample(this, 0.0) === Double.POSITIVE_INFINITY);
	}

	getCycleTicks(): number {
		return this.getTicks(this.cycleTime.getNextSample(this, 0.0));
	}

	getOffsetTicks(): number {
		return this.getTicks(this.offsetTime.getNextSample(this, 0.0));
	}

	/**
	 * Schedules an event when the TimeSeries' value changes.
	 */
	waitForNextValue(): void {
		const ticks = EventManager.simTicks();
		const durTicks = this.getNextChangeAfterTicks(ticks) - ticks;
		if (this.isTraceFlag())
			this.trace(0, "waitForNextValue - dur=%.6f", EventManager.current().ticksToSeconds(durTicks));
		if (durTicks === 0)
			return;
		EventManager.scheduleTicks(durTicks, Entity.PRI_HIGHEST, Entity.EVT_LIFO, this.waitForNextValueTarget, null);

		// Notify any observers
		this.notifyObservers();
	}

	override getUserUnitType(): JClass<Unit> {
		return this.unitType.getUnitType()!;
	}

	/**
	 * getTicks(double simTime): 秒 → いちばん近い tick。
	 * getTicks(TSPoint pt):
	 * Returns the simulation time in clock ticks for the specified position in
	 * the time series.
	 * @param pt - position in the time series.
	 * @return simulation time in clock ticks.
	 */
	private getTicks(arg: number | TSPoint): number {
		if (typeof arg === "number") {
			const simTime = arg;
			const evt = this.getJaamSimModel().getEventManager();
			return evt.secondsToNearestTick(simTime);
		}

		const pt = arg;
		if (pt.index === -1)
			return Long.MAX_VALUE;
		if (this.isCycleTimeInfinite())
			return this.value.getValue()!.ticksList[pt.index] + this.getOffsetTicks();
		// TODO(移植): Java は long の掛け算で桁があふれると回り込む（numberOfCycles が Long.MAX_VALUE のときなど）。TS では回り込まない
		return this.value.getValue()!.ticksList[pt.index] + this.getOffsetTicks() + pt.numberOfCycles * this.getCycleTicks();
	}

	/** Java の private getSimTime(long ticks) */
	private getSimTimeForTicks(ticks: number): number {
		if (ticks === Long.MAX_VALUE)
			return Double.POSITIVE_INFINITY;
		const evt = this.getJaamSimModel().getEventManager();
		return evt.ticksToSeconds(ticks);
	}

	/**
	 * Returns the value for time series at the given simulation time.
	 * @param ticks - simulation time in clock ticks.
	 */
	getValueForTicks(ticks: number): number {
		return this.getValue(this.getTSPointForTicks(ticks));
	}

	/**
	 * Return the last time that the value updated, before the given
	 * simulation time.
	 * @param ticks - simulation time in clock ticks.
	 * @return simulation time in clock ticks at which the time series value changed.
	 */
	getLastChangeBeforeTicks(ticks: number): number {
		return this.getTicks(this.getTSPointBefore(this.getTSPointForTicks(ticks)));
	}

	/**
	 * Return the first time that the value will be updated, after the given
	 * simulation time.
	 * @param ticks - simulation time in clock ticks.
	 * @return simulation time in clock ticks at which the time series value will change.
	 */
	getNextChangeAfterTicks(ticks: number): number {
		return this.getTicks(this.getTSPointAfter(this.getTSPointForTicks(ticks)));
	}

	getNextTimeAfter(simTime: number): number {
		return this.getSimTimeForTicks(this.getNextChangeAfterTicks(this.getTicks(simTime)));
	}

	getMaxTicksValue(): number {
		if (!this.isCycleTimeInfinite())
			return this.getCycleTicks();

		const ticksList = this.value.getValue()!.ticksList;
		return ticksList[ticksList.length - 1];
	}

	getUnitType(): JClass<Unit> {
		return this.unitType.getUnitType()!;
	}

	getMaxValue(): number {
		return this.value.getValue()!.getMaxValue();
	}

	getMinValue(): number {
		return this.value.getValue()!.getMinValue();
	}

	getMeanValue(simTime: number): number {
		return this.getNextSample(simTime);
	}

	isMonotonic(dir: number): boolean {
		return this.value.getValue()!.isMonotonic(dir);
	}

	/**
	 * Returns the position in the time series that corresponds to the specified
	 * time in simulation clock ticks.
	 * <p>
	 * The position returned is the largest one whose ticks value is less than
	 * or equal to the specified ticks.
	 * @param ticks - simulation time in clock ticks.
	 * @return position in the TimeSeries.
	 */
	private getTSPointForTicks(ticks: number): TSPoint {
		const ticksList = this.value.getValue()!.ticksList;

		if (ticks === Long.MAX_VALUE) {
			if (this.isCycleTimeInfinite())
				return new TSPoint(ticksList.length - 1, 0);
			return new TSPoint(ticksList.length - 1, Long.MAX_VALUE);
		}

		// Calculate the offset internal clock ticks
		ticks -= this.getOffsetTicks();

		// Find the time within the present cycle
		let ticksInCycle = Math.max(ticks, 0);
		let numberOfCycles = 0;
		if (!this.isCycleTimeInfinite()) {
			const cycleTicks = this.getCycleTicks();
			numberOfCycles = JMath.floorDiv(ticks - ticksList[0], cycleTicks);
			ticksInCycle = ticks - numberOfCycles * cycleTicks;
		}

		// If the time in the cycle is greater than the last time, return the last value
		if (ticksInCycle >= ticksList[ticksList.length - 1]) {
			return new TSPoint(ticksList.length - 1, numberOfCycles);
		}

		// Find the index by binary search
		const k = binarySearchLong(ticksList, ticksInCycle);

		// If the returned index is greater or equal to zero,
		// then an exact match was found
		if (k >= 0)
			return new TSPoint(k, numberOfCycles);

		if (k === -1)
			this.error("No value found at time: %f", this.getSimTimeForTicks(ticks + this.getOffsetTicks()));

		// If the returned index is negative, then (insertion index) = -k-1
		// Return the index before the insertion index
		return new TSPoint(-k - 2, numberOfCycles);
	}

	/**
	 * Returns the position in the time series that corresponds to the specified value.
	 * <p>
	 * The TimeSeries values must increase monotonically. The position returned
	 * is the largest one whose value is less than or equal to the specified value.
	 * @param val - specified value.
	 * @return position in the TimeSeries.
	 */
	private getTSPointForValue(val: number): TSPoint {

		const valueList = this.value.getValue()!.valueList;
		if (val > this.getMaxValue() && this.isCycleTimeInfinite())
			return new TSPoint(valueList.length - 1, 0);

		// Find the value within the present cycle
		// （double の % は Java と JS で同じ: 割られる数の符号をとる余り）
		const valInCycle = val % this.getMaxValue();
		const numberOfCycles = Math.round((val - valInCycle) / this.getMaxValue());

		// If the value in the cycle is greater than or equal to the last value, return the last index
		if (valInCycle >= valueList[valueList.length - 1])
			return new TSPoint(valueList.length - 1, numberOfCycles);

		// Find the index by binary search
		const k = binarySearchDouble(valueList, valInCycle);

		// If the returned index is greater or equal to zero,
		// then an exact match was found
		if (k >= 0)
			return new TSPoint(k, numberOfCycles);

		if (k === -1)
			this.error("No entry found for value: %f", val);

		// If the returned index is negative, then (insertion index) = -k-1
		// Return the index before the insertion index
		return new TSPoint(-k - 2, numberOfCycles);
	}

	/**
	 * Returns the time series value for the specified position in the time
	 * series.
	 * @param pt - position in the time series.
	 * @return value for the time series.
	 */
	private getValue(pt: TSPoint): number {
		const valueList = this.value.getValue()!.valueList;
		if (pt.index === -1)
			return valueList[valueList.length - 1];
		return valueList[pt.index];
	}

	/**
	 * Returns the total value for the time series at the specified position.
	 * <p>
	 * If a cycle time has been specified, then the total time increases
	 * with each pass through the time series.
	 * @param pt - position in the time series.
	 * @return total value for the time series.
	 */
	private getCumulativeValue(pt: TSPoint): number {
		if (this.isCycleTimeInfinite())
			return this.getValue(pt);
		return this.getValue(pt) + pt.numberOfCycles * this.getMaxValue();
	}

	/**
	 * Returns the position in the time series that precedes the specified
	 * position.
	 * <p>
	 * An index of -1 is returned if the specified position is a the start
	 * of the time series data and a cycle time is not specified.
	 * @param pt - specified position in the time series.
	 * @return previous position in the time series.
	 */
	private getTSPointBefore(pt: TSPoint): TSPoint {
		if (pt.index === -1)
			return new TSPoint(pt.index, pt.numberOfCycles);

		if (pt.index === 0) {
			if (this.isCycleTimeInfinite())
				return new TSPoint(-1, pt.numberOfCycles);

			return new TSPoint(this.value.getValue()!.ticksList.length - 1, pt.numberOfCycles - 1);
		}

		return new TSPoint(pt.index - 1, pt.numberOfCycles);
	}

	/**
	 * Returns the position in the time series that follows the specified
	 * position.
	 * <p>
	 * An index of -1 is returned if the specified position is a the end
	 * of the time series data and a cycle time is not specified.
	 * @param pt - specified position in the time series.
	 * @return next position in the time series.
	 */
	private getTSPointAfter(pt: TSPoint): TSPoint {
		if (pt.index === -1)
			return new TSPoint(pt.index, pt.numberOfCycles);

		if (pt.index === this.value.getValue()!.ticksList.length - 1) {
			if (this.isCycleTimeInfinite())
				return new TSPoint(-1, pt.numberOfCycles);

			return new TSPoint(0, pt.numberOfCycles + 1);
		}

		return new TSPoint(pt.index + 1, pt.numberOfCycles);
	}

	getInterpolatedTicksForValue(val: number): number {

		const low = this.getTSPointForValue(val);
		let high = this.getTSPointAfter(low);
		if (high.index === -1)
			return Long.MAX_VALUE;

		const ticksLow = this.getTicks(low);
		let ticksHigh = this.getTicks(high);
		const valueLow = this.getCumulativeValue(low);
		let valueHigh = this.getCumulativeValue(high);

		// The value at the end of the cycle is equal to the value at the start of the next cycle
		if (valueHigh === valueLow) {
			high = this.getTSPointAfter(high);
			ticksHigh = this.getTicks(high);
			valueHigh = this.getCumulativeValue(high);
		}

		// (double)*(long)/(double) は double の計算。Math.round(double) は long
		return ticksLow + Math.round((val - valueLow) * (ticksHigh - ticksLow) / (valueHigh - valueLow));
	}

	getInterpolatedCumulativeValueForTicks(ticks: number): number {

		const low = this.getTSPointForTicks(ticks);
		let high = this.getTSPointAfter(low);
		if (high.index === -1) {
			const valueList = this.value.getValue()!.valueList;
			return valueList[valueList.length - 1];
		}

		const ticksLow = this.getTicks(low);
		let ticksHigh = this.getTicks(high);
		const valueLow = this.getCumulativeValue(low);
		let valueHigh = this.getCumulativeValue(high);

		// The value at the end of the cycle is equal to the value at the start of the next cycle
		if (valueHigh === valueLow) {
			high = this.getTSPointAfter(high);
			ticksHigh = this.getTicks(high);
			valueHigh = this.getCumulativeValue(high);
		}

		// (long)*(double)/(long) は double の計算（整数の割り算ではない）
		return valueLow + (ticks - ticksLow) * (valueHigh - valueLow) / (ticksHigh - ticksLow);
	}

	getNextSample(simTime: number): number;
	getNextSample(thisEnt: Entity | null, simTime: number): number;
	getNextSample(a: Entity | null | number, b?: number): number {
		// getNextSample(double simTime) → getNextSample(this, simTime)
		const simTime = (b === undefined) ? a as number : b;
		return this.getValue(this.getTSPointForTicks(this.getTicks(simTime)));
	}

	// ******************************************************************************************************
	// OUTPUTS
	// ******************************************************************************************************

	getPresentValue(simTime: number): number {
		if (this.value.getValue() === null)
			return Double.NaN;
		return this.getNextSample(simTime);
	}

	getNextEventTime(simTime: number): number {
		if (this.value.getValue() === null)
			return 0.0;
		return this.getNextTimeAfter(simTime);
	}

	getNextValue(simTime: number): number {
		if (this.value.getValue() === null)
			return Double.NaN;
		const evt = this.getJaamSimModel().getEventManager();
		const simTicks = evt.secondsToNearestTick(simTime);
		const nextTicks = this.getNextChangeAfterTicks(simTicks);
		return this.getValueForTicks(nextTicks);
	}

}

/**
 * WaitForNextValueTarget
 */
class TimeSeries_WaitForNextValueTarget extends EntityTarget<TimeSeries> {
	constructor(ent: TimeSeries) {
		super(ent, "endStep");
	}

	override process(): void {
		this.ent.waitForNextValue();
	}
}

defineOutput(TimeSeries, {
	name: "PresentValue",
	description: "Value for the time series at the present time.",
	unitType: UserSpecifiedUnit,
	sequence: 1,
	returnType: "double",
	get: (e, simTime) => e.getPresentValue(simTime),
});

defineOutput(TimeSeries, {
	name: "NextTime",
	description: "Time at which the time series value is updated next.",
	unitType: TimeUnit,
	sequence: 2,
	returnType: "double",
	get: (e, simTime) => e.getNextEventTime(simTime),
});

defineOutput(TimeSeries, {
	name: "NextValue",
	description: "Value for the time series when it is updated next.",
	unitType: UserSpecifiedUnit,
	sequence: 3,
	returnType: "double",
	get: (e, simTime) => e.getNextValue(simTime),
});

ClassRegistry.register("com.jaamsim.Samples.TimeSeries", TimeSeries);
