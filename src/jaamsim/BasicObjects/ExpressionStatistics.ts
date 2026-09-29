/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2023-2026 JaamSim Software Inc.
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

// 名前の無い EntityTarget（doValueTraceTarget）と、入れ子のクラス ValueChangedConditional は、
// ファイルの中のクラスにした。Java の Arrays.binarySearch(double[], double) は、ファイルの中の関数 binarySearch。

import { Double, Integer } from "../java/lang.ts";
import type { JClass } from "../java/lang.ts";
import { ClassRegistry } from "../java/ClassRegistry.ts";
import { BooleanProvInput } from "../BooleanProviders/BooleanProvInput.ts";
import { DisplayEntity } from "../Graphics/DisplayEntity.ts";
import { SampleInput } from "../Samples/SampleInput.ts";
import { SampleListInput } from "../Samples/SampleListInput.ts";
import { TimeBasedFrequency } from "../Statistics/TimeBasedFrequency.ts";
import { TimeBasedStatistics } from "../Statistics/TimeBasedStatistics.ts";
import { Entity } from "../basicsim/Entity.ts";
import { EntityTarget } from "../basicsim/EntityTarget.ts";
import { ObserverEntity } from "../basicsim/ObserverEntity.ts";
import { isSubjectEntity, type SubjectEntity } from "../basicsim/SubjectEntity.ts";
import type { Conditional } from "../events/Conditional.ts";
import { EventManager } from "../events/EventManager.ts";
import type { Input } from "../input/Input.ts";
import type { InputCallback } from "../input/InputCallback.ts";
import { InterfaceEntityListInput } from "../input/InterfaceEntityListInput.ts";
import { defineOutput } from "../input/OutputRegistry.ts";
import { UnitTypeInput } from "../input/UnitTypeInput.ts";
import { MathUtils } from "../math/MathUtils.ts";
import { DimensionlessUnit } from "../units/DimensionlessUnit.ts";
import type { Unit } from "../units/Unit.ts";
import { UserSpecifiedUnit } from "../units/UserSpecifiedUnit.ts";

/** InterfaceEntityListInput に渡す、interface SubjectEntity の Class の代わり（ProcessFlow/LinkedService.ts と同じ作り） */
const SubjectEntityClass = {
	[Symbol.hasInstance](o: unknown): o is SubjectEntity {
		return isSubjectEntity(o);
	},
};

/** Java の (int) の型変換（0 の方向へ切り捨て、NaN は 0、範囲の外は端に張り付く） */
function toInt(x: number): number {
	if (Number.isNaN(x)) return 0;
	if (x >= Integer.MAX_VALUE) return Integer.MAX_VALUE;
	if (x <= Integer.MIN_VALUE) return Integer.MIN_VALUE;
	return Math.trunc(x);
}

/** Java の Arrays.binarySearch(double[] a, double key)（見つからなければ -(入れる位置) - 1） */
function binarySearch(a: number[], key: number): number {
	let low = 0;
	let high = a.length - 1;
	while (low <= high) {
		const mid = (low + high) >>> 1;
		const midVal = a[mid];
		if (midVal < key)
			low = mid + 1;
		else if (midVal > key)
			high = mid - 1;
		else {
			// -0.0 と 0.0、NaN の扱いは Double.doubleToLongBits の比較と同じ（Double.compare）
			const c = Double.compare(midVal, key);
			if (c === 0)
				return mid;
			else if (c < 0)
				low = mid + 1;
			else
				high = mid - 1;
		}
	}
	return -(low + 1);
}

export class ExpressionStatistics extends DisplayEntity implements ObserverEntity {

	private readonly unitType: UnitTypeInput;

	private readonly dataSource: SampleInput;

	private readonly histogramBinWidth: SampleInput;

	private readonly targetPercentiles: SampleListInput;

	protected readonly watchList: InterfaceEntityListInput<SubjectEntity>;

	private readonly verifyWatchList: BooleanProvInput;

	private lastValue = 0;
	private readonly timeStats: TimeBasedStatistics;
	private readonly freq: TimeBasedFrequency;

	private readonly valueChangedConditional: Conditional;
	private readonly doValueTraceTarget: EntityTarget<ExpressionStatistics>;

	static readonly inputCallback: InputCallback = {
		callback(ent: Entity, inp: Input<unknown>): void {
			(ent as ExpressionStatistics).updateUnitTypeInputValue();
		},
	};

	constructor() {
		super();

		// Java のフィールドの初期値（初期化ブロックの前に書かれている）
		this.timeStats = new TimeBasedStatistics();
		this.freq = new TimeBasedFrequency(0, 10);

		// Java の初期化ブロック
		this.unitType = new UnitTypeInput("UnitType", Entity.KEY_INPUTS, UserSpecifiedUnit);
		this.setKeywordDoc(this.unitType, "Unit type for the variable whose statistics will be collected.",
		         ["DistanceUnit"]);
		this.unitType.setRequired(true);
		this.unitType.setCallback(ExpressionStatistics.inputCallback);
		this.addInput(this.unitType);

		this.dataSource = new SampleInput("DataSource", Entity.KEY_INPUTS, Double.NaN);
		this.setKeywordDoc(this.dataSource, "Variable for which statistics will be collected.",
		         ["'this.obj.attrib1'"]);
		this.dataSource.setUnitType(UserSpecifiedUnit);
		this.dataSource.setRequired(true);
		this.addInput(this.dataSource);

		this.histogramBinWidth = new SampleInput("HistogramBinWidth", Entity.KEY_INPUTS, Double.NaN);
		this.setKeywordDoc(this.histogramBinWidth, "Width of the histogram bins into which the recorded values are "
		                     + "placed. "
		                     + "Histogram data will not be generated if the input is left blank.",
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

		this.watchList = new InterfaceEntityListInput<SubjectEntity>(SubjectEntityClass, "WatchList", Entity.KEY_INPUTS, []);
		this.setKeywordDoc(this.watchList, "Optional list of objects to monitor.\n\n"
		                     + "If the 'WatchList' input is provided, then the 'DataSource' input is "
		                     + "evaluated ONLY when triggered by an object in its 'WatchList'. "
		                     + "This is much more efficient than the default behaviour which "
		                     + "evaluates the 'DataSource' input at every event time.\n\n"
		                     + "Care must be taken to ensure that the 'WatchList' input includes "
		                     + "every object that can trigger a change in the value of 'DataSource' "
		                     + "input. "
		                     + "Normally, the 'WatchList' should include every object that is "
		                     + "referenced directly or indirectly by the 'DataSource' input. "
		                     + "The 'VerfiyWatchList' input can be used to ensure that the "
		                     + "'WatchList' includes all the necessary objects.",
		         ["Object1  Object2"]);
		this.watchList.setIncludeSelf(false);
		this.watchList.setUnique(true);
		this.addInput(this.watchList);

		this.verifyWatchList = new BooleanProvInput("VerifyWatchList", Entity.KEY_INPUTS, false);
		this.setKeywordDoc(this.verifyWatchList, "Allows the user to verify that the 'WatchList' input includes all the "
		                     + "objects that can trigger a change in the value of the 'DataSource' "
		                     + "input. "
		                     + "When set to TRUE, the both the normal logic and the 'WatchList' logic "
		                     + "is used to test the value of the 'DataSource' input. "
		                     + "An error message is generated if 'DataSource' input changes "
		                     + "its value without being triggered by a 'WatchList' object.", []);
		this.addInput(this.verifyWatchList);

		// Java のフィールドの初期値（初期化ブロックの後に書かれている）
		this.valueChangedConditional = new ValueChangedConditional(this);
		this.doValueTraceTarget = new DoValueTraceTarget(this);
	}

	updateUnitTypeInputValue(): void {
		const ut: JClass<Unit> = this.unitType.getUnitType();
		this.dataSource.setUnitType(ut);
		this.histogramBinWidth.setUnitType(ut);
		this.updateUserOutputMap();
	}

	override earlyInit(): void {
		super.earlyInit();
		this.timeStats.clear();
		this.freq.clear();
	}

	override startUp(): void {
		super.startUp();
		this.lastValue = Double.NaN;

		// If there is no WatchList, the open/close expressions are tested after every event
		if (!this.isWatchList() || this.isVerifyWatchList(0.0)) {
			this.doValueTrace();
		}
	}

	override clearStatistics(): void {
		super.clearStatistics();
		this.timeStats.clear();
		this.freq.clear();
	}

	private getBinWidth(): number {
		return this.histogramBinWidth.getNextSample(this, 0.0);
	}

	isVerifyWatchList(simTime: number): boolean {
		return this.verifyWatchList.getNextBoolean(this, simTime);
	}

	isWatchList(): boolean {
		return this.getWatchList().length !== 0;
	}

	getWatchList(): SubjectEntity[] {
		return this.watchList.getValue();
	}

	observerUpdate(subj: SubjectEntity): void {
		if (this.isValueChanged()) {
			this.recordValue();
		}
	}

	recordValue(): void {
		const simTime = EventManager.simSeconds();

		const val = this.getValue(simTime);
		this.timeStats.addValue(simTime, val);
		if (!this.histogramBinWidth.isDefault()) {
			// Java の (int) Math.round(double)（long にしてから int にする）
			// TODO(移植): int に収まらない値のとき、Java は下位 32 ビットを取るが、ここでは端に張り付く
			this.freq.addValue(simTime, toInt(Math.round(val/this.getBinWidth())));
		}
	}

	isValueChanged(): boolean {
		const simTime = EventManager.simSeconds();
		const value = this.getValue(simTime);
		if (MathUtils.near(value, this.lastValue))
			return false;
		this.lastValue = value;
		return true;
	}

	doValueTrace(): void {

		// Record the new value
		this.recordValue();

		// Wait for the next value change
		EventManager.scheduleUntil(this.doValueTraceTarget, this.valueChangedConditional, null);
	}

	getValue(simTime: number): number {
		return this.dataSource.getNextSample(this, simTime);
	}

	getMinimum(simTime: number): number {
		return this.timeStats.getMin();
	}

	getMaximum(simTime: number): number {
		return this.timeStats.getMax();
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
		const binVals: number[] = this.freq.getBinValues();
		const ret: number[] = new Array<number>(binVals.length).fill(0);
		for (let i = 0; i < binVals.length; i++) {
			ret[i] = this.getBinWidth() * binVals[i];
		}
		return ret;
	}

	getHistogramBinUpperLimits(simTime: number): number[] {
		if (this.histogramBinWidth.isDefault()) {
			return [];
		}
		const binVals: number[] = this.freq.getBinValues();
		const ret: number[] = new Array<number>(binVals.length).fill(0);
		for (let i = 0; i < binVals.length; i++) {
			ret[i] = this.getBinWidth() * (binVals[i] + 0.5);
		}
		return ret;
	}

	getHistogramBinFractions(simTime: number): number[] {
		if (this.histogramBinWidth.isDefault()) {
			return [];
		}
		return this.freq.getBinFractions(simTime);
	}

	getHistogramCumulativeBinFractions(simTime: number): number[] {
		if (this.histogramBinWidth.isDefault()) {
			return [];
		}
		return this.freq.getBinCumulativeFractions(simTime);
	}

	getPercentileValues(simTime: number): number[] {
		const ret: number[] = new Array<number>(this.targetPercentiles.getListSize()).fill(0);
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

}

/** Java の入れ子のクラス ValueChangedConditional */
class ValueChangedConditional implements Conditional {
	private readonly ent: ExpressionStatistics;

	constructor(ent: ExpressionStatistics) {
		this.ent = ent;
	}

	evaluate(): boolean {
		return this.ent.isValueChanged();
	}
}

/** Java の名前の無い EntityTarget（doValueTraceTarget） */
class DoValueTraceTarget extends EntityTarget<ExpressionStatistics> {
	constructor(ent: ExpressionStatistics) {
		super(ent, "doValueTrace");
	}

	override process(): void {
		this.ent.doValueTrace();
	}
}

ClassRegistry.register("com.jaamsim.BasicObjects.ExpressionStatistics", ExpressionStatistics);

defineOutput(ExpressionStatistics, {
	name: "Value",
	description: "Present value for the 'DataSource' input.",
	unitType: UserSpecifiedUnit, reportable: true, sequence: 1,
	returnType: "double",
	get: (e, simTime) => e.getValue(simTime),
});

defineOutput(ExpressionStatistics, {
	name: "Minimum",
	description: "Smallest value that was recorded.",
	unitType: UserSpecifiedUnit, reportable: true, sequence: 2,
	returnType: "double",
	get: (e, simTime) => e.getMinimum(simTime),
});

defineOutput(ExpressionStatistics, {
	name: "Maximum",
	description: "Largest value that was recorded.",
	unitType: UserSpecifiedUnit, reportable: true, sequence: 3,
	returnType: "double",
	get: (e, simTime) => e.getMaximum(simTime),
});

defineOutput(ExpressionStatistics, {
	name: "TimeAverage",
	description: "Average of the values recorded, weighted by the duration of each value.",
	unitType: UserSpecifiedUnit, reportable: true, sequence: 4,
	returnType: "double",
	get: (e, simTime) => e.getTimeAverage(simTime),
});

defineOutput(ExpressionStatistics, {
	name: "TimeStandardDeviation",
	description: "Standard deviation of the values recorded, weighted by the duration of each value.",
	unitType: UserSpecifiedUnit, reportable: true, sequence: 5,
	returnType: "double",
	get: (e, simTime) => e.getTimeStandardDeviation(simTime),
});

defineOutput(ExpressionStatistics, {
	name: "HistogramBinCentres",
	description: "Central value for each histogram bin.",
	unitType: UserSpecifiedUnit, reportable: true, sequence: 6,
	returnType: "double[]",
	get: (e, simTime) => e.getHistogramBinCentres(simTime),
});

defineOutput(ExpressionStatistics, {
	name: "HistogramBinUpperLimits",
	description: "The largest value that can be assigned to each histogram bin.",
	unitType: UserSpecifiedUnit, reportable: true, sequence: 7,
	returnType: "double[]",
	get: (e, simTime) => e.getHistogramBinUpperLimits(simTime),
});

defineOutput(ExpressionStatistics, {
	name: "HistogramBinFractions",
	description: "Fraction of total time that the recorded value was within each histogram bin.",
	unitType: DimensionlessUnit, reportable: true, sequence: 8,
	returnType: "double[]",
	get: (e, simTime) => e.getHistogramBinFractions(simTime),
});

defineOutput(ExpressionStatistics, {
	name: "HistogramBinCumulativeFractions",
	description: "The fractional number of values within each histogram bin or smaller.",
	unitType: DimensionlessUnit, reportable: true, sequence: 9,
	returnType: "double[]",
	get: (e, simTime) => e.getHistogramCumulativeBinFractions(simTime),
});

defineOutput(ExpressionStatistics, {
	name: "PercentileValues",
	description: "The recorded values corresponding to percentiles specified by the "
	           + "'TargetPercentiles' input.",
	unitType: UserSpecifiedUnit, reportable: true, sequence: 11,
	returnType: "double[]",
	get: (e, simTime) => e.getPercentileValues(simTime),
});
