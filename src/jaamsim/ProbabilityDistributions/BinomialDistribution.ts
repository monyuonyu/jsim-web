/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2022-2024 JaamSim Software Inc.
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

import { Double } from "../java/lang.ts";
import { ClassRegistry } from "../java/ClassRegistry.ts";
import { SampleInput } from "../Samples/SampleInput.ts";
import { Entity } from "../basicsim/Entity.ts";
import { MRG1999a } from "../rng/MRG1999a.ts";
import { DimensionlessUnit } from "../units/DimensionlessUnit.ts";
import { Distribution } from "./Distribution.ts";

/** Java の (int) x（double → int。NaN は 0、範囲の外は端に丸める） */
function jint(x: number): number {
	if (Number.isNaN(x))
		return 0;
	if (x >= 2147483647)
		return 2147483647;
	if (x <= -2147483648)
		return -2147483648;
	return Math.trunc(x);
}

/**
 * Binomial Distribution.
 * Adapted from A.M. Law, "Simulation Modelling and Analysis, 5th Edition", page 469.
 */
export class BinomialDistribution extends Distribution {

	private readonly numberOfTrials: SampleInput;

	private readonly probability: SampleInput;

	private readonly rng: MRG1999a = new MRG1999a();

	constructor() {
		super();
		this.unitType.setDefaultValue(DimensionlessUnit);
		this.setUnitType(this.getUnitType());
		this.unitType.setHidden(true);

		this.minValueInput.setDefaultValue(0.0);

		this.numberOfTrials = new SampleInput("NumberOfTrials", Entity.KEY_INPUTS, 1.0);
		this.setKeywordDoc(this.numberOfTrials, "Number of independent trials to perform.",
		         ["5.0", "InputValue1", "'2 * [InputValue1].Value'"]);
		this.numberOfTrials.setUnitType(DimensionlessUnit);
		this.numberOfTrials.setValidRange(1.0, Double.POSITIVE_INFINITY);
		this.addInput(this.numberOfTrials);

		this.probability = new SampleInput("Probability", Entity.KEY_INPUTS, 1.0);
		this.setKeywordDoc(this.probability, "Probability of success for each trial.",
		         ["0.5", "InputValue1", "'2 * [InputValue1].Value'"]);
		this.probability.setUnitType(DimensionlessUnit);
		this.probability.setValidRange(0.0, 1.0);
		this.addInput(this.probability);
	}

	override earlyInit(): void {
		super.earlyInit();
		this.rng.setSeedStream(this.getStreamNumber(), this.getSubstreamNumber());
	}

	protected override getSample(simTime: number): number {
		const n = jint(this.numberOfTrials.getNextSample(this, simTime));
		const p = this.probability.getNextSample(this, simTime);
		return BinomialDistribution.getSample(n, p, this.rng);
	}

	protected override getMean(simTime: number): number {
		const n = jint(this.numberOfTrials.getNextSample(this, simTime));
		const p = this.probability.getNextSample(this, simTime);
		return BinomialDistribution.getMean(n, p);
	}

	protected override getStandardDev(simTime: number): number {
		const n = jint(this.numberOfTrials.getNextSample(this, simTime));
		const p = this.probability.getNextSample(this, simTime);
		return BinomialDistribution.getStandardDev(n, p);
	}

	protected override getMin(simTime: number): number {
		return 0.0;
	}

	protected override getMax(simTime: number): number {
		const n = jint(this.numberOfTrials.getNextSample(this, simTime));
		return n;
	}

	/** n は Java の int。Java では int を返す */
	static getSample(n: number, p: number, rng: MRG1999a): number {
		let ret = 0;
		for (let i = 0; i < n; i++) {
			if (rng.nextUniform() <= p) {
				ret++;
			}
		}
		return ret;
	}

	/** n は Java の int */
	static getMean(n: number, p: number): number {
		return n * p;
	}

	/** n は Java の int */
	static getStandardDev(n: number, p: number): number {
		return Math.sqrt(n * p * (1.0 - p));
	}

}

ClassRegistry.register("com.jaamsim.ProbabilityDistributions.BinomialDistribution", BinomialDistribution);
