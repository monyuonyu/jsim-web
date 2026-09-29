/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2014 Ausenco Engineering Canada Inc.
 * Copyright (C) 2019-2024 JaamSim Software Inc.
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

// 入れ子のクラス DoOpenCloseTarget は、このファイルの TimeSeriesThreshold_DoOpenCloseTarget にした。
// フィールドの doOpenClose（ProcessTarget）は、関数の doOpenClose() と名前がぶつかるので doOpenCloseTarget にした（docs/renamed.md）。
// Java の long の足し算で Long.MAX_VALUE（「変わらない・開かない」の印）が桁あふれする所は、longAdd で Java と同じ値にした。

import { TimeSeries } from "../internal.ts";
import { SampleInput } from "../internal.ts";
import { Entity } from "../internal.ts";
import { EntityTarget } from "../internal.ts";
import { EventManager } from "../internal.ts";
import type { ProcessTarget } from "../events/ProcessTarget.ts";
import { tr } from "../internal.ts";
import type { Input } from "../input/Input.ts";
import type { InputCallback } from "../input/InputCallback.ts";
import { InputErrorException } from "../internal.ts";
import { defineOutput } from "../internal.ts";
import { TimeSeriesInput } from "../internal.ts";
import { UnitTypeInput } from "../internal.ts";
import { ClassRegistry } from "../internal.ts";
import { Double, Long, jstr } from "../internal.ts";
import { type JClass } from "../java/lang.ts";
import { TimeUnit } from "../internal.ts";
import type { Unit } from "../units/Unit.ts";
import { UserSpecifiedUnit } from "../internal.ts";
import { Threshold } from "../internal.ts";

const TWO_63 = 2n ** 63n;
const TWO_64 = 2n ** 64n;

/**
 * Java の long の a + b（桁あふれも Java と同じ）。
 * TS では Long.MAX_VALUE が 2^53-1 なので、それを Java の 2^63-1 と見なして足し、2^64 で折り返す。
 */
// TODO(移植): 桁あふれの再現は Long.MAX_VALUE が片方にあるときだけ（ほかの long の足し算は 2^53 未満の前提）
function longAdd(a: number, b: number): number {
	if (a !== Long.MAX_VALUE && b !== Long.MAX_VALUE)
		return a + b;
	const big = (x: number): bigint => x === Long.MAX_VALUE ? TWO_63 - 1n : BigInt(x);
	let r = big(a) + big(b);
	if (r >= TWO_63)
		r -= TWO_64;
	if (r < -TWO_63)
		r += TWO_64;
	if (r === TWO_63 - 1n)
		return Long.MAX_VALUE;
	return Number(r);
}

/** Java の Class.toString()（"class com.jaamsim.units.DistanceUnit"） */
function classStr(c: JClass | null): string {
	if (c === null)
		return "null";
	return "class " + ClassRegistry.javaName(c);
}

export class TimeSeriesThreshold extends Threshold {

	private readonly timeSeries: TimeSeriesInput;

	private readonly maxOpenLimit: TimeSeriesInput;

	private readonly minOpenLimit: TimeSeriesInput;

	private readonly lookAhead: SampleInput;

	private readonly offset: SampleInput;

	private readonly unitType: UnitTypeInput;

	private readonly doOpenCloseTarget: ProcessTarget;

	constructor() {
		super();

		this.unitType = new UnitTypeInput("UnitType", Entity.KEY_INPUTS, UserSpecifiedUnit);
		this.setKeywordDoc(this.unitType, "The unit type for the threshold (e.g. DistanceUnit, TimeUnit, MassUnit).",
				["DistanceUnit"]);
		this.unitType.setRequired(true);
		this.unitType.setCallback(TimeSeriesThreshold.inputCallback);
		this.addInput(this.unitType);

		this.timeSeries = new TimeSeriesInput("TimeSeries", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.timeSeries, "The TimeSeries object whose values are to be tested.",
				["TimeSeries1"]);
		this.timeSeries.setUnitType(UserSpecifiedUnit);
		this.timeSeries.setRequired(true);
		this.addInput(this.timeSeries);

		this.maxOpenLimit = new TimeSeriesInput("MaxOpenLimit", Entity.KEY_INPUTS, Double.POSITIVE_INFINITY);
		this.setKeywordDoc(this.maxOpenLimit, "The largest TimeSeries value for which the threshold is open. "
				+ "The threshold is open for TimeSeries values x that satisfy "
				+ "MinOpenLimit <= x <= MaxOpenLimit. "
				+ "Note that the inputs for 'LookAhead' and 'Offset' can be used to "
				+ "modify this behaviour.",
				["2.0 m", "TimeSeries2"]);
		this.maxOpenLimit.setUnitType(UserSpecifiedUnit);
		this.addInput( this.maxOpenLimit );

		this.minOpenLimit = new TimeSeriesInput("MinOpenLimit", Entity.KEY_INPUTS, Double.NEGATIVE_INFINITY);
		this.setKeywordDoc(this.minOpenLimit, "The smallest TimeSeries value for which the threshold is open. "
				+ "The threshold is open for TimeSeries values x that satisfy "
				+ "MinOpenLimit <= x <= MaxOpenLimit. "
				+ "Note that the inputs for 'LookAhead' and 'Offset' can be used to "
				+ "modify this behaviour.",
				["2.0 m", "TimeSeries3"]);
		this.minOpenLimit.setUnitType(UserSpecifiedUnit);
		this.addInput( this.minOpenLimit );

		this.lookAhead = new SampleInput("LookAhead", Entity.KEY_INPUTS, 0.0);
		this.setKeywordDoc(this.lookAhead, "The length of time over which the TimeSeries values must be "
				+ ">= MinOpenLimit and <= MaxOpenLimit.\n"
				+ "The threshold is open if the TimeSeries values x(t) satisfy "
				+ "MinOpenLimit <= x(t) <= MaxOpenLimit for simulation times t from "
				+ "(SimTime + Offset) to (SimTime + Offset + LookAhead).",
				["5.0 h"]);
		this.lookAhead.setUnitType(TimeUnit);
		this.addInput( this.lookAhead );

		this.offset = new SampleInput("Offset", Entity.KEY_INPUTS, 0.0);
		this.setKeywordDoc(this.offset, "The amount of time that the threshold adds on to every time series "
				+ "lookup.\n"
				+ "The threshold is open if the TimeSeries values x(t) satisfy "
				+ "MinOpenLimit <= x(t) <= MaxOpenLimit for simulation times t from "
				+ "(SimTime + Offset) to (SimTime + Offset + LookAhead).",
				["5.0 h"]);
		this.offset.setUnitType(TimeUnit);
		this.addInput( this.offset );

		// Java のフィールドの初期値（初期化ブロックの後に書かれている）
		this.doOpenCloseTarget = new TimeSeriesThreshold_DoOpenCloseTarget(this, "doOpenClose");
	}

	static readonly inputCallback: InputCallback = {
		callback(ent: Entity, _inp: Input<unknown>): void {
			(ent as TimeSeriesThreshold).updateInputValue();
		},
	};

	updateInputValue(): void {
		this.timeSeries.setUnitType(this.getUnitType());
		this.maxOpenLimit.setUnitType(this.getUnitType());
		this.minOpenLimit.setUnitType(this.getUnitType());
		this.updateUserOutputMap();
	}


	/** @throws InputErrorException */
	override validate(): void {
		super.validate();

		if( (this.maxOpenLimit.getValue()!.getMinValue() === Double.POSITIVE_INFINITY) &&
				(this.minOpenLimit.getValue()!.getMaxValue() === Double.NEGATIVE_INFINITY) ) {
			throw new InputErrorException( tr("Missing Limit") );
		}

		if (this.minOpenLimit.getValue()!.getMaxValue() > this.maxOpenLimit.getValue()!.getMaxValue())
			throw new InputErrorException(tr("MaxOpenLimit must be larger than MinOpenLimit"));

		if( this.timeSeries.getValue()!.getUnitType() !== this.getUnitType() )
			throw new InputErrorException(tr("Time Series unitType (%s) does not match the Threshold Unit type (%s)"),
					classStr(this.timeSeries.getValue()!.getUnitType()), classStr(this.getUnitType()));

		if (this.timeSeries.getValue()!.getMinValue() > this.maxOpenLimit.getValue()!.getMaxValue())
			this.getJaamSimModel().logWarning(
					"Threshold %s is closed forever.  MaxOpenLimit = %f Min TimeSeries Value = %f",
					String(this), this.maxOpenLimit.getValue()!.getMaxValue(), this.timeSeries.getValue()!.getMinValue());

		if (this.timeSeries.getValue()!.getMaxValue() < this.minOpenLimit.getValue()!.getMinValue())
			this.getJaamSimModel().logWarning(
					"Threshold %s is closed forever.  MinOpenLimit = %f Max TimeSeries Value = %f",
					String(this), this.minOpenLimit.getValue()!.getMinValue(), this.timeSeries.getValue()!.getMaxValue());
	}

	override startUp(): void {
		super.startUp();
		this.doOpenClose();
	}

	override getUserUnitType(): JClass<Unit> {
		return this.unitType.getUnitType() as JClass<Unit>;
	}

	getUnitType(): JClass<Unit> {
		return this.unitType.getUnitType() as JClass<Unit>;
	}

	/**
	 * The process loop that opens and closes the threshold.
	 */
	doOpenClose(): void {
		let wait: number;
		if (this.isOpenAtTicks(EventManager.simTicks())) {
			this.setOpen(true);
			wait = this.calcOpenTicksFromTicks(EventManager.simTicks());
		}
		else {
			this.setOpen(false);
			wait = this.calcClosedTicksFromTicks(EventManager.simTicks());
		}

		if (wait === Long.MAX_VALUE)
			return;

		EventManager.scheduleTicks(wait, Entity.PRI_HIGHER, Entity.EVT_LIFO, this.doOpenCloseTarget, null);
	}

	/**
	 * Return TRUE if the threshold is open at the given time
	 * @param simTime - simulation time in seconds
	 * @return TRUE if open, FALSE if closed
	 */
	isOpenAtTime(simTime: number): boolean {
		const evt = this.getJaamSimModel().getEventManager();
		return this.isOpenAtTicks(evt.secondsToNearestTick(simTime));
	}

	/**
	 * Returns TRUE if the threshold is open at the given time.
	 * <p>
	 * Note: if lookahead > 0, the condition for open is that opentime >= lookahead.
	 * However, if the lookahead == 0, the condition for open is that opentime > lookahead.
	 * @param ticks - simulation time in clock ticks
	 * @return TRUE if open, FALSE if closed
	 */
	private isOpenAtTicks(ticks: number): boolean {

		// Add offset from input
		const simTime = EventManager.simSeconds();
		const evt = this.getJaamSimModel().getEventManager();
		ticks += evt.secondsToNearestTick(this.offset.getNextSample(this, simTime));
		ticks = Math.max(ticks, 0);

		let changeTime = ticks;

		// if the current point is closed, we are done
		if (!this.isPointOpenAtTicks(changeTime))
			return false;

		// If there is no lookahead, then the threshold is open
		const lookAheadInTicks = evt.secondsToNearestTick(this.lookAhead.getNextSample(this, simTime));
		if (lookAheadInTicks === 0)
			return true;

		while( true ) {

			// If the next point is closed, determine if open long enough too satisfy lookahead
			changeTime = this.getNextChangeAfterTicks(changeTime);
			if (!this.isPointOpenAtTicks(changeTime))
				return (changeTime - ticks >= lookAheadInTicks);

			// The next point is open, determine whether the lookahead is already satisfied
			if (changeTime - ticks >= lookAheadInTicks)
				return true;
		}
	}

	/**
	 * Return the time during which the threshold is closed starting from the given time.
	 * @param ticks - simulation time in clock ticks
	 * @return the time in clock ticks that the threshold is closed
	 */
	private calcClosedTicksFromTicks(ticks: number): number {

		// If the series is always outside the limits, the threshold is closed forever
		if (this.isAlwaysClosed())
			return Long.MAX_VALUE;

		// If the series is always within the limits, the threshold is open forever
		if (this.isAlwaysOpen())
			return 0;

		// If the threshold is not closed at the given time, return 0.0
		// This check must occur before adding the offset because isClosedAtTicks also adds the offset
		if (this.isOpenAtTicks(ticks))
			return 0;

		const evt = this.getJaamSimModel().getEventManager();
		// Add offset from input
		const simTime = EventManager.simSeconds();
		ticks += evt.secondsToNearestTick(this.offset.getNextSample(this, simTime));
		ticks = Math.max(ticks, 0);

		// Threshold is currently closed. Find the next open point
		let openTime = -1;
		let changeTime = ticks;
		const maxTicksValueFromTimeSeries = this.getMaxTicksValueFromTimeSeries();
		const lookAheadInTicks = evt.secondsToNearestTick(this.lookAhead.getNextSample(this, simTime));
		while( true ) {
			changeTime = this.getNextChangeAfterTicks(changeTime);

			if (changeTime === Long.MAX_VALUE) {
				if( openTime === -1 )
					return Long.MAX_VALUE;
				else
					return openTime - ticks;
			}

			// if have already searched the longest cycle, the threshold will never open
			if (changeTime > ticks + maxTicksValueFromTimeSeries + lookAheadInTicks)
				return Long.MAX_VALUE;

			// Closed index
			if (!this.isPointOpenAtTicks(changeTime)) {

				// If an open point has not been found yet, keep looking
				if (openTime === -1)
					continue;

				// Has enough time been gathered to satisfy the lookahead?
				if (changeTime - openTime >= lookAheadInTicks)
					return openTime - ticks;

				// not enough time, need to start again
				else
					openTime = -1;
			}

			// Open index
			else {

				// Keep track of the first open index.
				if (openTime === -1)
					openTime = changeTime;
			}
		}
	}

	private isAlwaysOpen(): boolean {
		const tsMin = this.timeSeries.getValue()!.getMinValue();
		const tsMax = this.timeSeries.getValue()!.getMaxValue();

		const maxMinOpen = this.minOpenLimit.getValue()!.getMaxValue();
		const minMaxOpen = this.maxOpenLimit.getValue()!.getMinValue();

		return (tsMin >= maxMinOpen && tsMax <= minMaxOpen);
	}

	private isAlwaysClosed(): boolean {
		const tsMin = this.timeSeries.getValue()!.getMinValue();
		const tsMax = this.timeSeries.getValue()!.getMaxValue();

		const minMinOpen = this.minOpenLimit.getValue()!.getMinValue();
		const maxMaxOpen = this.maxOpenLimit.getValue()!.getMaxValue();

		return (tsMax < minMinOpen || tsMin > maxMaxOpen);
	}

	/**
	 * Return the time during which the threshold is open starting from the given time.
	 * @param ticks - simulation time in clock ticks
	 * @return the time in clock ticks that the threshold is open
	 */
	private calcOpenTicksFromTicks(ticks: number): number {

		// If the series is always outside the limits, the threshold is closed forever
		if (this.isAlwaysClosed())
			return 0;

		// If the series is always within the limits, the threshold is open forever
		if (this.isAlwaysOpen())
			return Long.MAX_VALUE;

		// If the threshold is closed at the given time, return 0.0
		// This check must occur before adding the offset because isClosedAtTIme also adds the offset
		if (!this.isOpenAtTicks(ticks))
			return 0;

		// Add offset from input
		const simTime = EventManager.simSeconds();
		const evt = this.getJaamSimModel().getEventManager();
		ticks += evt.secondsToNearestTick(this.offset.getNextSample(this, simTime));
		ticks = Math.max(ticks, 0);

		// Find the next change point after startTime
		let changeTime = ticks;
		const maxTicksValueFromTimeSeries = this.getMaxTicksValueFromTimeSeries();
		const lookAheadInTicks = evt.secondsToNearestTick(this.lookAhead.getNextSample(this, simTime));
		while( true ) {
			changeTime = this.getNextChangeAfterTicks(changeTime);

			if( changeTime === Long.MAX_VALUE )
				return Long.MAX_VALUE;

			// if have already searched the longest cycle, the threshold will never close
			if( changeTime > ticks + maxTicksValueFromTimeSeries )
				return Long.MAX_VALUE;

			// Closed index
			if (!this.isPointOpenAtTicks(changeTime)) {
				if (lookAheadInTicks === 0)
					return changeTime - ticks;
				else
					return changeTime - lookAheadInTicks - ticks + 1;
			}
		}
	}

	/**
	 * Return the time in seconds during which the threshold is open
	 * from the given start time to the given end time
	 * @param startTime - simulation start time in seconds
	 * @param endTime - simulation end time in seconds
	 * @return the time in seconds that the threshold is open
	 */
	calcOpenTimeFromTimeToTime(startTime: number, endTime: number): number {

		// If the series is always outside the limits, the threshold is closed forever
		if (this.isAlwaysClosed())
			return 0;

		// If the series is always within the limits, the threshold is open forever
		if (this.isAlwaysOpen())
			return endTime - startTime;

		const evt = this.getJaamSimModel().getEventManager();
		let ticks = evt.secondsToNearestTick(startTime);
		const endTicks = evt.secondsToNearestTick(endTime);
		let openTicks = 0;

		let done = false;
		while (! done) {
			if (this.isOpenAtTicks(ticks)) {
				const tempTicks = this.calcOpenTicksFromTicks(ticks);
				if (longAdd(ticks, tempTicks) >= endTicks) {
					openTicks = longAdd(openTicks, Math.min( tempTicks, endTicks - ticks));
					done = true;
				}
				else {
					openTicks = longAdd(openTicks, tempTicks);
					ticks = longAdd(ticks, tempTicks);
				}
			}
			else {
				const tempTicks = this.calcClosedTicksFromTicks(ticks);
				if (longAdd(ticks, tempTicks) >= endTicks) {
					done = true;
				}
				else {
					ticks = longAdd(ticks, tempTicks);
				}
			}
		}
		return evt.ticksToSeconds(openTicks);
	}

	/**
	 * Returns the last time that one of the parameters TimeSeries, MaxOpenLimit, or MinOpenLimit
	 * changed, before the given time.
	 * @param simTime - simulation time in seconds
	 * @return the last simulation time in seconds that a change occurred
	 */
	getLastChangeBeforeTime(simTime: number): number {
		const evt = this.getJaamSimModel().getEventManager();
		return evt.ticksToSeconds(this.getLastChangeBeforeTicks(evt.secondsToNearestTick(simTime)));
	}

	/**
	 * Returns the last time that one of the parameters TimeSeries, MaxOpenLimit, or MinOpenLimit
	 * changed, before the given time.
	 * @param ticks - simulation time in clock ticks.
	 * @return the last time in clock ticks that a change occurred
	 */
	private getLastChangeBeforeTicks(ticks: number): number {
		let lastChange = this.timeSeries.getValue()!.getLastChangeBeforeTicks(ticks);
		lastChange = Math.min(lastChange, this.maxOpenLimit.getValue()!.getLastChangeBeforeTicks(ticks));
		lastChange = Math.min(lastChange, this.minOpenLimit.getValue()!.getLastChangeBeforeTicks(ticks));
		return lastChange;
	}

	/**
	 * Returns the next time that one of the parameters TimeSeries, MaxOpenLimit, or MinOpenLimit
	 * will change, after the given time.
	 * @param simTime - simulation time in seconds
	 * @return the next simulation time in seconds that a change will occur
	 */
	getNextChangeAfterTime(simTime: number): number {
		const evt = this.getJaamSimModel().getEventManager();
		return evt.ticksToSeconds(this.getNextChangeAfterTicks(evt.secondsToNearestTick(simTime)));
	}

	/**
	 * Returns the next time that one of the parameters TimeSeries, MaxOpenLimit, or MinOpenLimit
	 * will change, after the given time.
	 * @param ticks - simulation time in clock ticks.
	 * @return the next time in clock ticks that a change will occur
	 */
	private getNextChangeAfterTicks(ticks: number): number {
		let firstChange = this.timeSeries.getValue()!.getNextChangeAfterTicks(ticks);
		firstChange = Math.min(firstChange, this.maxOpenLimit.getValue()!.getNextChangeAfterTicks(ticks));
		firstChange = Math.min(firstChange, this.minOpenLimit.getValue()!.getNextChangeAfterTicks(ticks));
		return firstChange;
	}

	/**
	 * Returns the largest time in TimeSeries, MaxOpenLimit, and MinOpenLimit time series.
	 * This value is used to determine whether the series has cycled around once while finding the next open/close time.
	 * @return the last time in clock ticks that a change will occur
	 */
	private getMaxTicksValueFromTimeSeries(): number {
		let maxCycle = this.timeSeries.getValue()!.getMaxTicksValue();
		maxCycle = Math.max(maxCycle, this.maxOpenLimit.getValue()!.getMaxTicksValue());
		maxCycle = Math.max(maxCycle, this.minOpenLimit.getValue()!.getMaxTicksValue());
		return maxCycle;
	}

	/**
	 * Return TRUE if, at the given time, the TimeSeries input value falls outside of the values for MaxOpenLimit and
	 * MinOpenLimit. Does not include the effect of the offset value.
	 * @param ticks - simulation time in clock ticks.
	 * @return TRUE if open, FALSE if closed
	 */
	private isPointOpenAtTicks(ticks: number): boolean {

		const value = this.timeSeries.getValue()!.getValueForTicks(ticks);
		const minOpenLimitVal = this.minOpenLimit.getValue()!.getValueForTicks(ticks);
		const maxOpenLimitVal = this.maxOpenLimit.getValue()!.getValueForTicks(ticks);

		// Error check that threshold limits remain consistent
		if (minOpenLimitVal > maxOpenLimitVal) {
			const evt = this.getJaamSimModel().getEventManager();
			this.error("MaxOpenLimit must be larger than MinOpenLimit. MaxOpenLimit: %s, MinOpenLimit: %s, time: %s",
					jstr(maxOpenLimitVal), jstr(minOpenLimitVal), jstr(evt.ticksToSeconds(ticks)));
		}
		return (value >= minOpenLimitVal) && (value <= maxOpenLimitVal);
	}

	getTimeSeriesValue(simTime: number): number {
		if (this.timeSeries.getValue() == null)
			return Double.NaN;
		return (this.timeSeries.getValue() as unknown as TimeSeries).getPresentValue(simTime + this.offset.getNextSample(this, simTime));
	}

	getNextOpenTime(simTime: number): number {
		if (this.timeSeries.getValue() == null)
			return Double.NaN;
		const evt = this.getJaamSimModel().getEventManager();
		const simTicks = evt.secondsToNearestTick(simTime);
		const ticks = longAdd(simTicks, this.calcClosedTicksFromTicks(simTicks));
		return evt.ticksToSeconds(ticks);
	}

	getNextCloseTime(simTime: number): number {
		if (this.timeSeries.getValue() == null)
			return Double.NaN;
		const evt = this.getJaamSimModel().getEventManager();
		const simTicks = evt.secondsToNearestTick(simTime);
		const ticks = longAdd(simTicks, this.calcOpenTicksFromTicks(simTicks));
		return evt.ticksToSeconds(ticks);
	}

	getNextOpenDuration(simTime: number): number {
		if (this.timeSeries.getValue() == null)
			return Double.NaN;
		const evt = this.getJaamSimModel().getEventManager();
		const simTicks = evt.secondsToNearestTick(simTime);
		const ticks = this.calcOpenTicksFromTicks(longAdd(simTicks, this.calcClosedTicksFromTicks(simTicks)));
		return evt.ticksToSeconds(ticks);
	}

	getNextCloseDuration(simTime: number): number {
		if (this.timeSeries.getValue() == null)
			return Double.NaN;
		const evt = this.getJaamSimModel().getEventManager();
		const simTicks = evt.secondsToNearestTick(simTime);
		const ticks = this.calcClosedTicksFromTicks(longAdd(simTicks, this.calcOpenTicksFromTicks(simTicks)));
		return evt.ticksToSeconds(ticks);
	}

}

class TimeSeriesThreshold_DoOpenCloseTarget extends EntityTarget<TimeSeriesThreshold> {
	constructor(ent: TimeSeriesThreshold, method: string) {
		super(ent, method);
	}

	override process(): void {
		this.ent.doOpenClose();
	}
}

defineOutput(TimeSeriesThreshold, {
	name: "TimeSeriesValue",
	description: "The value of the TimeSeries object at the present time plus the offset.",
	unitType: UserSpecifiedUnit, sequence: 5,
	returnType: "double",
	get: (e, simTime) => e.getTimeSeriesValue(simTime),
});

defineOutput(TimeSeriesThreshold, {
	name: "NextOpenTime",
	description: "The next time at which the threshold will be open.",
	unitType: TimeUnit, sequence: 6,
	returnType: "double",
	get: (e, simTime) => e.getNextOpenTime(simTime),
});

defineOutput(TimeSeriesThreshold, {
	name: "NextCloseTime",
	description: "The next time at which the threshold will be closed.",
	unitType: TimeUnit, sequence: 7,
	returnType: "double",
	get: (e, simTime) => e.getNextCloseTime(simTime),
});

defineOutput(TimeSeriesThreshold, {
	name: "NextOpenDuration",
	description: "The duration for which the threshold will be open at the next open time.",
	unitType: TimeUnit, sequence: 8,
	returnType: "double",
	get: (e, simTime) => e.getNextOpenDuration(simTime),
});

defineOutput(TimeSeriesThreshold, {
	name: "NextCloseDuration",
	description: "The duration for which the threshold will be closed at the next close time.",
	unitType: TimeUnit, sequence: 9,
	returnType: "double",
	get: (e, simTime) => e.getNextCloseDuration(simTime),
});

ClassRegistry.register("com.jaamsim.Thresholds.TimeSeriesThreshold", TimeSeriesThreshold);
