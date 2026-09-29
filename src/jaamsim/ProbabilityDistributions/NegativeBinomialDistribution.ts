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

import { Double } from "../internal.ts";
import { ClassRegistry } from "../internal.ts";
import { SampleInput } from "../internal.ts";
import { Entity } from "../internal.ts";
import { MRG1999a } from "../internal.ts";
import { DimensionlessUnit } from "../internal.ts";
import { Distribution } from "../internal.ts";
import { GeometricDistribution } from "../internal.ts";

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
 * Negative Binomial Distribution.
 * Adapted from A.M. Law, "Simulation Modelling and Analysis, 5th Edition", page 469.
 */
export class NegativeBinomialDistribution extends Distribution {

	private readonly successfulTrials: SampleInput;

	private readonly probability: SampleInput;

	private readonly rng: MRG1999a = new MRG1999a();

	constructor() {
		super();
		this.unitType.setDefaultValue(DimensionlessUnit);
		this.setUnitType(this.getUnitType());
		this.unitType.setHidden(true);

		this.minValueInput.setDefaultValue(0.0);

		this.successfulTrials = new SampleInput("SuccessfulTrials", Entity.KEY_INPUTS, 1.0);
		this.setKeywordDoc(this.successfulTrials, "Required number of successful trials.",
		         ["5.0", "InputValue1", "'2 * [InputValue1].Value'"]);
		this.successfulTrials.setUnitType(DimensionlessUnit);
		this.successfulTrials.setValidRange(1.0, Double.POSITIVE_INFINITY);
		this.addInput(this.successfulTrials);

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
		const s = jint(this.successfulTrials.getNextSample(this, simTime));
		const p = this.probability.getNextSample(this, simTime);
		return NegativeBinomialDistribution.getSample(s, p, this.rng);
	}

	protected override getMean(simTime: number): number {
		const s = jint(this.successfulTrials.getNextSample(this, simTime));
		const p = this.probability.getNextSample(this, simTime);
		return NegativeBinomialDistribution.getMean(s, p);
	}

	protected override getStandardDev(simTime: number): number {
		const s = jint(this.successfulTrials.getNextSample(this, simTime));
		const p = this.probability.getNextSample(this, simTime);
		return NegativeBinomialDistribution.getStandardDev(s, p);
	}

	protected override getMin(simTime: number): number {
		return 0.0;
	}

	protected override getMax(simTime: number): number {
		return Double.POSITIVE_INFINITY;
	}

	/** s は Java の int。Java では int を返す */
	static getSample(s: number, p: number, rng: MRG1999a): number {
		let ret = 0;
		for (let i = 0; i < s; i++) {
			ret += GeometricDistribution.getSample(p, rng);
		}
		return ret;
	}

	/** s は Java の int */
	static getMean(s: number, p: number): number {
		return s * GeometricDistribution.getMeanVal(p);
	}

	/** s は Java の int */
	static getStandardDev(s: number, p: number): number {
		return Math.sqrt(s) * GeometricDistribution.getStandardDevVal(p);
	}

}

ClassRegistry.register("com.jaamsim.ProbabilityDistributions.NegativeBinomialDistribution", NegativeBinomialDistribution);
