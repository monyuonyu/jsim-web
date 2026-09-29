/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2013 Ausenco Engineering Canada Inc.
 * Copyright (C) 2016-2024 JaamSim Software Inc.
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

import { Double } from "../internal.ts";
import { type JClass } from "../java/lang.ts";
import { ClassRegistry } from "../internal.ts";
import { tr } from "../internal.ts";
import { Entity } from "../internal.ts";
import { InputErrorException } from "../internal.ts";
import { ValueListInput } from "../internal.ts";
import { MRG1999a } from "../internal.ts";
import type { Unit } from "../units/Unit.ts";
import { UserSpecifiedUnit } from "../internal.ts";
import { CumulativeProbInput } from "../internal.ts";
import { Distribution } from "../internal.ts";

/**
 * Java の Arrays.binarySearch(double[], double) と同じ結果（同じ値が複数あるときの位置も同じ）。
 * 見つからなければ -(挿入位置 + 1)。
 */
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
			const cmp = Double.compare(midVal, key);  // -0.0 と 0.0、NaN の扱いも Java と同じ
			if (cmp === 0)
				return mid;
			else if (cmp < 0)
				low = mid + 1;
			else
				high = mid - 1;
		}
	}
	return -(low + 1);
}

/**
 * ContinuousDistribution is a user-defined probability distribution that selects an output value based on an ordered list
 * of values and cumulative probabilities.  The inputs specify a continuous cumulative probability distribution by
 * linearly interpolating between the given values and cumulative probabilities.
 * @author Harry King
 *
 */
export class ContinuousDistribution extends Distribution {

	private readonly valueListInput: ValueListInput;

	private readonly cumulativeProbabilityListInput: CumulativeProbInput;

	private readonly rng: MRG1999a = new MRG1999a();

	constructor() {
		super();
		this.valueListInput = new ValueListInput("ValueList", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.valueListInput, "The list of values for the user-defined cumulative probability distribution.",
		         ["2.0  4.3  8.9"]);
		this.valueListInput.setUnitType(UserSpecifiedUnit);
		this.valueListInput.setRequired(true);
		this.valueListInput.setMonotonic( 1 );
		this.addInput( this.valueListInput);

		this.cumulativeProbabilityListInput = new CumulativeProbInput("CumulativeProbabilityList", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.cumulativeProbabilityListInput, "The list of cumulative probabilities corresponding to the values in the ValueList.  " +
				"The cumulative probabilities must be given in increasing order.  The first value must be exactly 0.0.  " +
				"The last value must be exactly 1.0.",
		         ["0.0  0.6  1.0"]);
		this.cumulativeProbabilityListInput.setRequired(true);
		this.addInput(this.cumulativeProbabilityListInput);
	}

	override validate(): void {
		super.validate();

		// The number of entries in the ValueList and CumulativeProbabilityList inputs must match
		if( this.cumulativeProbabilityListInput.getValue()!.size() !== this.valueListInput.getValue()!.size() ) {
			throw new InputErrorException( tr("The number of entries for CumulativeProbabilityList and ValueList must be equal") );
		}
	}

	override earlyInit(): void {
		super.earlyInit();
		this.rng.setSeedStream(this.getStreamNumber(), this.getSubstreamNumber());
	}

	protected override setUnitType(specified: JClass<Unit>): void {
		super.setUnitType(specified);
		this.valueListInput.setUnitType(specified);
		this.updateUserOutputMap();
	}

	protected override getSample(simTime: number): number {
		const values: number[] = this.valueListInput.getValue()!.toArray();
		const cumProbs: number[] = this.cumulativeProbabilityListInput.getValue()!.toArray();
		return ContinuousDistribution.getSample(values, cumProbs, this.rng);
	}

	protected override getMin(simTime: number): number {
		if (this.cumulativeProbabilityListInput.isDefault() || this.valueListInput.isDefault())
			return Double.NaN;
		return this.valueListInput.getValue()!.get(0);
	}

	protected override getMax(simTime: number): number {
		if (this.cumulativeProbabilityListInput.isDefault() || this.valueListInput.isDefault())
			return Double.NaN;
		return this.valueListInput.getValue()!.lastElement();
	}

	protected override getMean(simTime: number): number {
		if (this.cumulativeProbabilityListInput.isDefault() || this.valueListInput.isDefault())
			return Double.NaN;
		const values: number[] = this.valueListInput.getValue()!.toArray();
		const cumProbs: number[] = this.cumulativeProbabilityListInput.getValue()!.toArray();
		return ContinuousDistribution.getMean(values, cumProbs);
	}

	protected override getStandardDev(simTime: number): number {
		if (this.cumulativeProbabilityListInput.isDefault() || this.valueListInput.isDefault())
			return Double.NaN;
		const values: number[] = this.valueListInput.getValue()!.toArray();
		const cumProbs: number[] = this.cumulativeProbabilityListInput.getValue()!.toArray();
		return ContinuousDistribution.getStandardDev(values, cumProbs);
	}

	static getSample(values: number[], cumProbs: number[], rng: MRG1999a): number {
		const rand = rng.nextUniform();
		const k = binarySearch(cumProbs, rand);
		if (k > 0)
			return values[k];
		const i = -k - 1;  // index of first cumProb > rand
		if (i === values.length)
			return values[values.length - 1];
		if (i === 0)
			return values[0];
		const ret = values[i - 1] + (rand - cumProbs[i - 1])*(values[i] - values[i - 1])/(cumProbs[i] - cumProbs[i - 1]);
		return ret;
	}

	static getMean(values: number[], cumProbs: number[]): number {
		let sum = 0.0;
		for (let i = 1; i < cumProbs.length; i++) {
			sum += (cumProbs[i] - cumProbs[i - 1]) * (values[i] + values[i - 1]);
		}
		return 0.5 * sum;
	}

	static getStandardDev(values: number[], cumProbs: number[]): number {
		let sum = 0.0;
		for (let i = 1; i < cumProbs.length; i++) {
			const val = values[i];
			const lastVal = values[i - 1];
			sum += (cumProbs[i] - cumProbs[i - 1]) * (val*val + val*lastVal + lastVal*lastVal);
		}

		const mean = ContinuousDistribution.getMean(values, cumProbs);
		return  Math.sqrt( sum/3.0 - (mean * mean) );
	}

}

ClassRegistry.register("com.jaamsim.ProbabilityDistributions.ContinuousDistribution", ContinuousDistribution);
