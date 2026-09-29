/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2013 Ausenco Engineering Canada Inc.
 * Copyright (C) 2022 JaamSim Software Inc.
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

// 多重定義の扱い: 出力の getNextSample(double simTime) と、SampleProvider の getNextSample(Entity, double) は、
// 最初の引数が数かどうかで見分ける（1 つの関数）。

import { Double } from "../internal.ts";
import type { JClass } from "../java/lang.ts";
import { ClassRegistry } from "../internal.ts";
import { tr } from "../internal.ts";
import { DisplayEntity } from "../internal.ts";
import type { SampleProvider } from "../Samples/SampleProvider.ts";
import { Entity } from "../internal.ts";
import { DoubleVector } from "../internal.ts";
import { EventManager } from "../internal.ts";
import { InputErrorException } from "../internal.ts";
import { defineOutput } from "../internal.ts";
import { ValueListInput } from "../internal.ts";
import { DimensionlessUnit } from "../internal.ts";
import type { Unit } from "../units/Unit.ts";
import { UserSpecifiedUnit } from "../internal.ts";

/**
 * EntitlementSelector selects an index to return based on the difference
 * between the expected and actual numbers of samples for each index. The
 * object with the largest difference (expected - actual) is selected.
 * @author Harry King
 *
 */
export class EntitlementSelector extends DisplayEntity implements SampleProvider {

	private readonly proportionList: ValueListInput;

	private lastSample = 0;  // the index that was selected most recently
	private totalCount = 0;  // the total number of samples that have been selected
	private sampleCount: number[];  // number of times each index has been selected
	private sampleDifference: number[];  // (actual number of samples) - (expected number)

	constructor() {
		super();

		// Java の初期化ブロック
		this.proportionList = new ValueListInput("ProportionList", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.proportionList, "A list of N numbers equal to the relative proportion for each of the "
		                     + "N indices. Must sum to 1.0.",
		         ["0.3  0.7"]);
		this.proportionList.setUnitType(DimensionlessUnit);
		this.proportionList.setRequired(true);
		this.addInput(this.proportionList);

		// Java のコンストラクタ
		this.sampleCount = [];
		this.sampleDifference = [];
	}

	override validate(): void {
		super.validate();

		// The entries in the ProportionList must sum to 1.0
		if (Math.abs(this.proportionList.getValue()!.sum() - 1.0) > 1.0e-10) {
			throw new InputErrorException(tr("The entries in the ProportionList must sum to 1.0"));
		}
	}

	override earlyInit(): void {
		super.earlyInit();

		this.lastSample = -1;
		this.totalCount = 0;
		this.sampleCount = new Array<number>(this.proportionList.getValue()!.size()).fill(0);
		this.sampleDifference = new Array<number>(this.proportionList.getValue()!.size()).fill(0);
	}

	/**
	 * Returns the next sample.
	 * Java の出力 getNextSample(double simTime) と、SampleProvider の getNextSample(Entity thisEnt, double simTime)。
	 */
	getNextSample(thisEnt: Entity | number, simTime?: number): number {
		if (typeof thisEnt === "number")
			return this.getNextSample(this, thisEnt);

		// If we are not in a model context, do not perturb the distribution by sampling,
		// instead simply return the last sampled value
		if (!EventManager.hasCurrent()) {
			return this.lastSample;
		}

		// Make the next selection
		const probList = this.proportionList.getValue()!;
		let index = 0;
		let maxDiff = Double.NEGATIVE_INFINITY;
		this.totalCount++;
		for (let i=0; i<probList.size(); i++) {
			const diff = this.totalCount * probList.get(i) - this.sampleCount[i];
			if (diff > maxDiff) {
				maxDiff = diff;
				index = i;
			}
		}
		this.lastSample = index + 1;

		// Collect statistics on the sampled values
		this.sampleCount[index]++;
		for(let i=0; i<this.sampleCount.length; i++) {
			this.sampleDifference[i] = this.sampleCount[i] - this.totalCount*this.proportionList.getValue()!.get(i);
		}

		return this.lastSample;
	}

	getUnitType(): JClass<Unit> {
		return DimensionlessUnit;
	}

	getMeanValue(simTime: number): number {
		return 0;
	}

	getNumberOfSamples(simTime: number): number {
		return this.totalCount;
	}

	getSampleCount(simTime: number): DoubleVector {
		const ret = new DoubleVector(this.sampleCount.length);
		for (let i=0; i<this.sampleCount.length; i++) {
			ret.add(this.sampleCount[i]);
		}
		return ret;
	}

	getSampleDifference(simTime: number): DoubleVector {
		const ret = new DoubleVector(this.sampleDifference.length);
		for (let i=0; i<this.sampleDifference.length; i++) {
			ret.add(this.sampleDifference[i]);
		}
		return ret;
	}

}

ClassRegistry.register("com.jaamsim.BasicObjects.EntitlementSelector", EntitlementSelector);

defineOutput(EntitlementSelector, {
	name: "Value",
	description: "The last sampled index (from 1 to N).",
	unitType: UserSpecifiedUnit, reportable: false, sequence: 0,
	returnType: "double",
	get: (e, simTime) => e.getNextSample(simTime),
});

defineOutput(EntitlementSelector, {
	name: "NumberOfSamples",
	description: "The number of times the distribution has been sampled.",
	unitType: DimensionlessUnit, reportable: false, sequence: 1,
	returnType: "int",
	get: (e, simTime) => e.getNumberOfSamples(simTime),
});

defineOutput(EntitlementSelector, {
	name: "SampleCount",
	description: "The number samples for each entity.",
	unitType: DimensionlessUnit, reportable: false, sequence: 2,
	returnType: "DoubleVector",
	get: (e, simTime) => e.getSampleCount(simTime),
});

defineOutput(EntitlementSelector, {
	name: "SampleDifference",
	description: "The difference between the actual number samples for each entity and the "
	           + "expected number.",
	unitType: DimensionlessUnit, reportable: false, sequence: 3,
	returnType: "DoubleVector",
	get: (e, simTime) => e.getSampleDifference(simTime),
});
