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
import { defineOutput } from "../internal.ts";
import { ValueListInput } from "../internal.ts";
import { MRG1999a } from "../internal.ts";
import { DimensionlessUnit } from "../internal.ts";
import type { Unit } from "../units/Unit.ts";
import { UserSpecifiedUnit } from "../internal.ts";
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
 * DiscreteDistribution is a user-defined probability distribution that selects from a given list of specific values
 * based on a specified probability for each value.  No interpolation is performed between values.
 * @author Harry King
 *
 */
export class DiscreteDistribution extends Distribution {

	private readonly valueListInput: ValueListInput;

	private readonly probabilityListInput: ValueListInput;

	private readonly rng: MRG1999a = new MRG1999a();
	private sampleCount: number[];  // number of times each index has been selected（Java の int[]）
	private cumProbList: number[];

	constructor() {
		super();
		this.valueListInput = new ValueListInput( "ValueList", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.valueListInput, "The discrete values that can be returned by the distribution. "
		                     + "The values can be any positive or negative and can be listed in any "
		                     + "order. "
		                     + "No interpolation is performed between the values.",
		         ["6.2 10.1", "3.5 4.5 6.5 km"]);
		this.valueListInput.setUnitType(UserSpecifiedUnit);
		this.valueListInput.setRequired(true);
		this.addInput( this.valueListInput);

		this.probabilityListInput = new ValueListInput( "ProbabilityList", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.probabilityListInput, "The probabilities corresponding to the values in the 'ValueList' "
		                     + "input. "
		                     + "Must sum to 1.0.",
		         ["0.3  0.7"]);
		this.probabilityListInput.setUnitType(DimensionlessUnit);
		this.probabilityListInput.setValidSum(1.0, 0.001);
		this.probabilityListInput.setValidRange(0.0, 1.0);
		this.probabilityListInput.setRequired(true);
		this.addInput( this.probabilityListInput);

		// Java のコンストラクタの本体
		this.sampleCount = [];
		this.cumProbList = [];
	}

	override validate(): void {
		super.validate();

		// The number of entries in the ValueList and ProbabilityList inputs must match
		if( this.probabilityListInput.getValue()!.size() !== this.valueListInput.getValue()!.size() ) {
			throw new InputErrorException( tr("The number of entries for ProbabilityList and ValueList must be equal") );
		}
	}

	override earlyInit(): void {
		super.earlyInit();
		this.rng.setSeedStream(this.getStreamNumber(), this.getSubstreamNumber());
		const n: number = this.probabilityListInput.getValue()!.size();
		this.sampleCount = new Array<number>(n).fill(0);

		// Store the values and cumulative probabilities for binary searching
		this.cumProbList = new Array<number>(n).fill(0.0);
		let total = 0.0;
		for (let i=0; i<n; i++) {
			total += this.probabilityListInput.getValue()!.get(i);
			this.cumProbList[i] = total;
		}
		this.cumProbList[n-1] = 1.0;
	}

	protected override setUnitType(specified: JClass<Unit>): void {
		super.setUnitType(specified);
		this.valueListInput.setUnitType(specified);
		this.updateUserOutputMap();
	}

	protected override getSample(simTime: number): number {
		const index = DiscreteDistribution.getSample(this.cumProbList, this.rng);
		if (index < 0 || index >= this.valueListInput.getListSize())
			throw new Error(tr("Bad index returned from binary search."));
		this.sampleCount[index]++;
		return this.valueListInput.getValue()!.get(index);
	}

	protected override getMin(simTime: number): number {
		if (this.probabilityListInput.getValue() == null || this.valueListInput.getValue() == null)
			return Double.NaN;
		return this.valueListInput.getValue()!.getMin();
	}

	protected override getMax(simTime: number): number {
		if (this.probabilityListInput.getValue() == null || this.valueListInput.getValue() == null)
			return Double.NaN;
		return this.valueListInput.getValue()!.getMax();
	}

	protected override getMean(simTime: number): number {
		if (this.probabilityListInput.isDefault() || this.valueListInput.isDefault())
			return Double.NaN;
		const values: number[] = this.valueListInput.getValue()!.toArray();
		return DiscreteDistribution.getMean(values, this.cumProbList);
	}

	protected override getStandardDev(simTime: number): number {
		if (this.probabilityListInput.isDefault() || this.valueListInput.isDefault())
			return Double.NaN;
		const values: number[] = this.valueListInput.getValue()!.toArray();
		return DiscreteDistribution.getStandardDev(values, this.cumProbList);
	}

	/**
	 * Java の 2 つの static を 1 つにしたもの（引数の数で見分ける）。
	 * - getSample(double[] cumProbs, MRG1999a rng): int … 選んだ位置を返す
	 * - getSample(double[] values, double[] cumProbs, MRG1999a rng): double … 選んだ値を返す
	 */
	static getSample(cumProbs: number[], rng: MRG1999a): number;
	static getSample(values: number[], cumProbs: number[], rng: MRG1999a): number;
	static getSample(a: number[], b: number[] | MRG1999a, c?: MRG1999a): number {
		if (c === undefined) {
			const cumProbs = a;
			const rng = b as MRG1999a;
			const rand = rng.nextUniform();
			let index = -1;

			// Binary search the cumulative probabilities
			const k = binarySearch(cumProbs, rand);
			if (k >= 0)
				index = k;
			else
				index = -k - 1;
			return index;
		}

		const values = a;
		const cumProbs = b as number[];
		const rng = c;
		const index = DiscreteDistribution.getSample(cumProbs, rng);
		if (index < 0 || index >= values.length)
			throw new Error(tr("Bad index returned from binary search."));
		return values[index];
	}

	static getMean(values: number[], cumProbs: number[]): number {
		let ret = 0.0;
		for (let i = 0; i < cumProbs.length; i++) {
			let prob = cumProbs[i];
			if (i > 0)
				prob -= cumProbs[i - 1];
			ret += prob * values[i];
		}
		return ret;
	}

	static getStandardDev(values: number[], cumProbs: number[]): number {
		let sum = 0.0;
		for (let i = 0; i < cumProbs.length; i++) {
			let prob = cumProbs[i];
			if (i > 0)
				prob -= cumProbs[i - 1];
			sum += prob * values[i] * values[i];
		}
		const mean = DiscreteDistribution.getMean(values, cumProbs);
		return  Math.sqrt( sum - (mean * mean) );
	}

	getSampleCount(simTime: number): number[] {
		return this.sampleCount;
	}

}

ClassRegistry.register("com.jaamsim.ProbabilityDistributions.DiscreteDistribution", DiscreteDistribution);

defineOutput(DiscreteDistribution, {
	name: "SampleCount",
	description: "The number of samples selected for each value.",
	returnType: "int[]",
	get: (e, simTime) => e.getSampleCount(simTime),
});
