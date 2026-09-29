/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2014 Ausenco Engineering Canada Inc.
 * Copyright (C) 2018-2026 JaamSim Software Inc.
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

// Java の LinkedHashMap<String, SampleStatistics> は Map（入れた順）にした。出力の LinkedHashMap<String, Double> も Map。
// Arrays.binarySearch(double[], double) は、このファイルの binarySearch にした（Java と同じ比べ方: -0.0 < 0.0、NaN が最大）。

import { ClassRegistry } from "../java/ClassRegistry.ts";
import { Double } from "../java/lang.ts";
import type { JClass } from "../java/lang.ts";
import { BooleanProvInput } from "../BooleanProviders/BooleanProvInput.ts";
import type { DisplayEntity } from "../Graphics/DisplayEntity.ts";
import { SampleInput } from "../Samples/SampleInput.ts";
import { SampleListInput } from "../Samples/SampleListInput.ts";
import { SampleFrequency } from "../Statistics/SampleFrequency.ts";
import { SampleStatistics } from "../Statistics/SampleStatistics.ts";
import { TimeBasedStatistics } from "../Statistics/TimeBasedStatistics.ts";
import { Entity } from "../basicsim/Entity.ts";
import { EventManager } from "../events/EventManager.ts";
import type { Input } from "../input/Input.ts";
import type { InputCallback } from "../input/InputCallback.ts";
import { defineOutput } from "../input/OutputRegistry.ts";
import { UnitTypeInput } from "../input/UnitTypeInput.ts";
import { StateEntity } from "../states/StateEntity.ts";
import { DimensionlessUnit } from "../units/DimensionlessUnit.ts";
import { TimeUnit } from "../units/TimeUnit.ts";
import type { Unit } from "../units/Unit.ts";
import { UserSpecifiedUnit } from "../units/UserSpecifiedUnit.ts";
import { LinkedComponent } from "./LinkedComponent.ts";

/** Java の (int) x（double → int。NaN は 0、範囲の外は端の値） */
function jint(x: number): number {
	if (Number.isNaN(x))
		return 0;
	if (x >= 2147483647)
		return 2147483647;
	if (x <= -2147483648)
		return -2147483648;
	return Math.trunc(x);
}

/** Java の Double.compare（-0.0 < 0.0、NaN は最大で NaN どうしは等しい） */
function doubleCompare(a: number, b: number): number {
	if (a < b)
		return -1;
	if (a > b)
		return 1;
	const aNaN = Number.isNaN(a);
	const bNaN = Number.isNaN(b);
	if (aNaN && bNaN)
		return 0;
	if (aNaN)
		return 1;
	if (bNaN)
		return -1;
	if (Object.is(a, b))
		return 0;
	return Object.is(a, -0) ? -1 : 1;
}

/** Java の Arrays.binarySearch(double[], double) */
function binarySearch(a: number[], key: number): number {
	let low = 0;
	let high = a.length - 1;
	while (low <= high) {
		const mid = (low + high) >>> 1;
		const cmp = doubleCompare(a[mid], key);
		if (cmp < 0)
			low = mid + 1;
		else if (cmp > 0)
			high = mid - 1;
		else
			return mid; // key found
	}
	return -(low + 1);  // key not found.
}

/**
 * Collects basic statistical information on the entities that are received.
 * @author Harry King
 *
 */
export class Statistics extends LinkedComponent {

	private readonly unitType: UnitTypeInput;

	private readonly sampleValue: SampleInput;

	private readonly histogramBinWidth: SampleInput;

	private readonly targetPercentiles: SampleListInput;

	private readonly recordEntityStateTimes: BooleanProvInput;

	private readonly resetEntityStateTimes: BooleanProvInput;

	private readonly sampStats = new SampleStatistics();
	private readonly timeStats = new TimeBasedStatistics();
	private readonly freq = new SampleFrequency(0, 10);
	private readonly stateStats = new Map<string, SampleStatistics>();

	constructor() {
		super();
		this.stateAssignment.setHidden(true);

		this.unitType = new UnitTypeInput("UnitType", Entity.KEY_INPUTS, UserSpecifiedUnit);
		this.setKeywordDoc(this.unitType, "The unit type for the variable whose statistics will be collected.",
		         ["DistanceUnit"]);
		this.unitType.setRequired(true);
		this.unitType.setCallback(Statistics.inputCallback);
		this.addInput(this.unitType);

		this.sampleValue = new SampleInput("SampleValue", Entity.KEY_INPUTS, Double.NaN);
		this.setKeywordDoc(this.sampleValue, "The variable for which statistics will be collected.",
		         ["'this.obj.attrib1'"]);
		this.sampleValue.setUnitType(UserSpecifiedUnit);
		this.addInput(this.sampleValue);

		this.histogramBinWidth = new SampleInput("HistogramBinWidth", Entity.KEY_INPUTS, Double.NaN);
		this.setKeywordDoc(this.histogramBinWidth, "Width of the histogram bins into which the recorded values are "
		                     + "placed. Histogram data will not be generated if the input is left "
		                     + "blank.",
		         ["1 h"]);
		this.histogramBinWidth.setUnitType(UserSpecifiedUnit);
		this.addInput(this.histogramBinWidth);

		this.targetPercentiles = new SampleListInput("TargetPercentiles", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.targetPercentiles, "List of percentiles for which the corresponding recording values will "
		                     + "be returned by the 'PercentileValues' output. "
		                     + "This input requires the 'HistogramBinWidth' input to be specified, "
		                     + "and the accuracy of the values for the specified percentiles will "
		                     + "depend on the size of the bin width.",
		         ["90 95 99"]);
		this.targetPercentiles.setUnitType(DimensionlessUnit);
		this.targetPercentiles.setDimensionless(true);
		this.addInput(this.targetPercentiles);

		this.recordEntityStateTimes = new BooleanProvInput("RecordEntityStateTimes", Entity.KEY_INPUTS, false);
		this.setKeywordDoc(this.recordEntityStateTimes, "If TRUE, the state times for received entities are recorded for "
		                     + "statistics generation. "
		                     + "The statistics for each state are returned by the outputs: "
		                     + "'EntityTimeMinimum', 'EntityTimeMaximum', 'EntityTimeAverage', and "
		                     + "'EntityTimeStandardDeviation'.", []);
		this.addInput(this.recordEntityStateTimes);

		this.resetEntityStateTimes = new BooleanProvInput("ResetEntityStateTimes", Entity.KEY_INPUTS, false);
		this.setKeywordDoc(this.resetEntityStateTimes, "If TRUE, the state times for received entities are set to zero on "
		                     + "departure.", []);
		this.addInput(this.resetEntityStateTimes);
	}

	static override readonly inputCallback: InputCallback = {
		callback(ent: Entity, inp: Input<unknown>): void {
			(ent as Statistics).updateUnitTypeInputValue();
		},
	} as InputCallback;

	updateUnitTypeInputValue(): void {
		const ut = this.unitType.getUnitType()!;
		this.sampleValue.setUnitType(ut);
		this.histogramBinWidth.setUnitType(ut);
		this.updateUserOutputMap();
	}

	override earlyInit(): void {
		super.earlyInit();
		this.sampStats.clear();
		this.timeStats.clear();
		this.freq.clear();
		this.stateStats.clear();
	}

	private getBinWidth(): number {
		return this.histogramBinWidth.getNextSample(this, 0.0);
	}

	isRecordEntityStateTimes(simTime: number): boolean {
		return this.recordEntityStateTimes.getNextBoolean(this, simTime);
	}

	isResetEntityStateTimes(simTime: number): boolean {
		return this.resetEntityStateTimes.getNextBoolean(this, simTime);
	}

	override addEntity(ent: DisplayEntity): void {
		super.addEntity(ent);
		const simTime = EventManager.simSeconds();

		// Update the statistics
		if (!this.sampleValue.isDefault()) {
			const val = this.sampleValue.getNextSample(this, simTime);
			this.sampStats.addValue(val);
			this.timeStats.addValue(simTime, val);
			if (!this.histogramBinWidth.isDefault()) {
				// Java の (int) Math.round(double)（long を int にする）
				// TODO(移植): long の範囲の外・int の範囲の外の値では Java と違う（Java は下位 32 ビットを取る）
				this.freq.addValue(jint(Math.round(val/this.getBinWidth())));
			}
		}

		// Update the statistics for each of the entity's states
		const evt = EventManager.current();
		if (ent instanceof StateEntity) {
			const se = ent as StateEntity;
			if (this.isRecordEntityStateTimes(simTime)) {
				for (const rec of se.getStateRecs()) {
					let durStats = this.stateStats.get(rec.getName());
					if (durStats === undefined) {
						durStats = new SampleStatistics();
						this.stateStats.set(rec.getName(), durStats);
					}
					let ticks = se.getTicksInState(rec);
					if (this.isResetEntityStateTimes(simTime)) {
						ticks = se.getCurrentCycleTicks(rec);
					}
					const dur = evt.ticksToSeconds(ticks);
					durStats.addValue(dur);
				}
			}

			// Reset the entity's statistics
			if (this.isResetEntityStateTimes(simTime)) {
				se.collectCycleStats();
			}
		}

		// Pass the entity to the next component
		this.sendToNextComponent(ent);
	}

	override clearStatistics(): void {
		super.clearStatistics();
		this.sampStats.clear();
		this.timeStats.clear();
		this.freq.clear();
		this.stateStats.clear();
	}

	override getUserUnitType(): JClass<Unit> {
		return this.unitType.getUnitType()!;
	}

	// ******************************************************************************************************
	// OUTPUT METHODS
	// ******************************************************************************************************

	getSampleMinimum(simTime: number): number {
		return this.sampStats.getMin();
	}

	getSampleMaximum(simTime: number): number {
		return this.sampStats.getMax();
	}

	getSampleAverage(simTime: number): number {
		return this.sampStats.getMean();
	}

	getSampleStandardDeviation(simTime: number): number {
		return this.sampStats.getStandardDeviation();
	}

	getTimeAverage(simTime: number): number {
		return this.timeStats.getMean(simTime);
	}

	getTimeStandardDeviation(simTime: number): number {
		return this.timeStats.getStandardDeviation(simTime);
	}

	getHistogramBinCentres(simTime: number): number[] {
		if (this.histogramBinWidth.isDefault()) {
			return [];
		}
		const binVals = this.freq.getBinValues();
		const ret = new Array<number>(binVals.length).fill(0);
		for (let i = 0; i < binVals.length; i++) {
			ret[i] = this.getBinWidth() * binVals[i];
		}
		return ret;
	}

	getHistogramBinUpperLimits(simTime: number): number[] {
		if (this.histogramBinWidth.isDefault()) {
			return [];
		}
		const binVals = this.freq.getBinValues();
		const ret = new Array<number>(binVals.length).fill(0);
		for (let i = 0; i < binVals.length; i++) {
			ret[i] = this.getBinWidth() * (binVals[i] + 0.5);
		}
		return ret;
	}

	getHistogramBinFractions(simTime: number): number[] {
		if (this.histogramBinWidth.isDefault()) {
			return [];
		}
		return this.freq.getBinFractions();
	}

	getHistogramCumulativeBinFractions(simTime: number): number[] {
		if (this.histogramBinWidth.isDefault()) {
			return [];
		}
		return this.freq.getBinCumulativeFractions();
	}

	getPercentileValues(simTime: number): number[] {
		const ret = new Array<number>(this.targetPercentiles.getListSize()).fill(0);
		if (this.histogramBinWidth.isDefault()) {
			return ret;
		}
		const cumFractions = this.getHistogramCumulativeBinFractions(simTime);
		const values = this.getHistogramBinUpperLimits(simTime);
		for (let i = 0; i < this.targetPercentiles.getListSize(); i++) {
			let targetFraction = this.targetPercentiles.getNextSample(i, this, simTime) / 100.0;
			targetFraction = Math.min(targetFraction, 1.0);
			targetFraction = Math.max(targetFraction, 0.0);
			const k = binarySearch(cumFractions, targetFraction);
			if (k >= 0) {
				ret[i] = values[k];
				continue;
			}
			let index = -k - 1;
			index = Math.min(index, cumFractions.length - 1);
			if (index < 0) {
				ret[i] = Double.NaN;
				continue;
			}
			if (index === 0) {
				ret[i] = values[0] * targetFraction / cumFractions[0];
				continue;
			}
			if (index >= values.length) {
				ret[i] = values[values.length - 1];
				continue;
			}
			const ratio = (targetFraction - cumFractions[index - 1])
					/ (cumFractions[index] - cumFractions[index - 1]);
			ret[i] = values[index - 1] + ratio * (values[index] - values[index - 1]);
		}
		return ret;
	}

	getEntityTimeMinimum(simTime: number): Map<string, number> {
		const num = this.getNumberProcessed(simTime);
		const ret = new Map<string, number>();
		for (const [key, value] of this.stateStats) {
			let min = value.getMin();
			if (value.getCount() < num) {
				min = 0.0;
			}
			ret.set(key, min);
		}
		return ret;
	}

	getEntityTimeMaximum(simTime: number): Map<string, number> {
		const ret = new Map<string, number>();
		for (const [key, value] of this.stateStats) {
			const max = value.getMax();
			ret.set(key, max);
		}
		return ret;
	}

	getEntityTimeAverage(simTime: number): Map<string, number> {
		const num = this.getNumberProcessed(simTime);
		const ret = new Map<string, number>();
		for (const [key, value] of this.stateStats) {
			const mean = value.getSum() / num;
			ret.set(key, mean);
		}
		return ret;
	}

	getEntityTimeStandardDeviation(simTime: number): Map<string, number> {
		const num = this.getNumberProcessed(simTime);
		const ret = new Map<string, number>();
		for (const [key, value] of this.stateStats) {
			const mean = value.getSum() / num;
			const meanSquared = value.getSumSquared() / num;
			const sd = Math.sqrt(meanSquared - mean*mean);
			ret.set(key, sd);
		}
		return ret;
	}

}

defineOutput(Statistics, {
	name: "SampleMinimum",
	description: "The smallest value that was recorded.",
	unitType: UserSpecifiedUnit,
	reportable: true,
	sequence: 0,
	returnType: "double",
	get: (e, simTime) => e.getSampleMinimum(simTime),
});

defineOutput(Statistics, {
	name: "SampleMaximum",
	description: "The largest value that was recorded.",
	unitType: UserSpecifiedUnit,
	reportable: true,
	sequence: 1,
	returnType: "double",
	get: (e, simTime) => e.getSampleMaximum(simTime),
});

defineOutput(Statistics, {
	name: "SampleAverage",
	description: "The average of the values that were recorded.",
	unitType: UserSpecifiedUnit,
	reportable: true,
	sequence: 2,
	returnType: "double",
	get: (e, simTime) => e.getSampleAverage(simTime),
});

defineOutput(Statistics, {
	name: "SampleStandardDeviation",
	description: "The standard deviation of the values that were recorded.",
	unitType: UserSpecifiedUnit,
	reportable: true,
	sequence: 3,
	returnType: "double",
	get: (e, simTime) => e.getSampleStandardDeviation(simTime),
});

defineOutput(Statistics, {
	name: "TimeAverage",
	description: "The average of the values recorded, weighted by the duration of each value.",
	unitType: UserSpecifiedUnit,
	reportable: true,
	sequence: 5,
	returnType: "double",
	get: (e, simTime) => e.getTimeAverage(simTime),
});

defineOutput(Statistics, {
	name: "TimeStandardDeviation",
	description: "The standard deviation of the values recorded, weighted by the duration of each value.",
	unitType: UserSpecifiedUnit,
	reportable: true,
	sequence: 6,
	returnType: "double",
	get: (e, simTime) => e.getTimeStandardDeviation(simTime),
});

defineOutput(Statistics, {
	name: "HistogramBinCentres",
	description: "The central value for each histogram bin.",
	unitType: UserSpecifiedUnit,
	reportable: true,
	sequence: 7,
	returnType: "double[]",
	get: (e, simTime) => e.getHistogramBinCentres(simTime),
});

defineOutput(Statistics, {
	name: "HistogramBinUpperLimits",
	description: "The largest value that can be assigned to each histogram bin.",
	unitType: UserSpecifiedUnit,
	reportable: true,
	sequence: 8,
	returnType: "double[]",
	get: (e, simTime) => e.getHistogramBinUpperLimits(simTime),
});

defineOutput(Statistics, {
	name: "HistogramBinFractions",
	description: "The fractional number of values within each histogram bin.",
	unitType: DimensionlessUnit,
	reportable: true,
	sequence: 9,
	returnType: "double[]",
	get: (e, simTime) => e.getHistogramBinFractions(simTime),
});

defineOutput(Statistics, {
	name: "HistogramBinCumulativeFractions",
	description: "The fractional number of values within each histogram bin or smaller.",
	unitType: DimensionlessUnit,
	reportable: true,
	sequence: 10,
	returnType: "double[]",
	get: (e, simTime) => e.getHistogramCumulativeBinFractions(simTime),
});

defineOutput(Statistics, {
	name: "PercentileValues",
	description: "The recorded values corresponding to percentiles specified by the "
	             + "'TargetPercentiles' input.",
	unitType: UserSpecifiedUnit,
	reportable: true,
	sequence: 12,
	returnType: "double[]",
	get: (e, simTime) => e.getPercentileValues(simTime),
});

defineOutput(Statistics, {
	name: "EntityTimeMinimum",
	description: "The minimum time the received entities have spent in each state.",
	unitType: TimeUnit,
	reportable: true,
	sequence: 13,
	returnType: "LinkedHashMap",
	get: (e, simTime) => e.getEntityTimeMinimum(simTime),
});

defineOutput(Statistics, {
	name: "EntityTimeMaximum",
	description: "The maximum time the received entities have spent in each state.",
	unitType: TimeUnit,
	reportable: true,
	sequence: 14,
	returnType: "LinkedHashMap",
	get: (e, simTime) => e.getEntityTimeMaximum(simTime),
});

defineOutput(Statistics, {
	name: "EntityTimeAverage",
	description: "The average time the received entities have spent in each state.",
	unitType: TimeUnit,
	reportable: true,
	sequence: 15,
	returnType: "LinkedHashMap",
	get: (e, simTime) => e.getEntityTimeAverage(simTime),
});

defineOutput(Statistics, {
	name: "EntityTimeStandardDeviation",
	description: "The standard deviation of the time the received entities have spent in "
	             + "each state.",
	unitType: TimeUnit,
	reportable: true,
	sequence: 16,
	returnType: "LinkedHashMap",
	get: (e, simTime) => e.getEntityTimeStandardDeviation(simTime),
});

ClassRegistry.register("com.jaamsim.ProcessFlow.Statistics", Statistics);
