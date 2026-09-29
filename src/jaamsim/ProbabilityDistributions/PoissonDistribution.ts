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

/**
 * Exponential Distribution.
 * Adapted from A.M. Law, "Simulation Modelling and Analysis, 5th Edition", page 470.
 */
export class PoissonDistribution extends Distribution {

	private readonly meanInput: SampleInput;

	private readonly rng: MRG1999a = new MRG1999a();

	constructor() {
		super();
		this.unitType.setDefaultValue(DimensionlessUnit);
		this.setUnitType(this.getUnitType());
		this.unitType.setHidden(true);

		this.minValueInput.setDefaultValue(0.0);

		this.meanInput = new SampleInput("Mean", Entity.KEY_INPUTS, 1.0);
		this.setKeywordDoc(this.meanInput, "The mean of the Poisson distribution.",
		         ["5.0", "InputValue1", "'2 * [InputValue1].Value'"]);
		this.meanInput.setUnitType(DimensionlessUnit);
		this.meanInput.setValidRange(0.0, Double.POSITIVE_INFINITY);
		this.addInput(this.meanInput);
	}

	override earlyInit(): void {
		super.earlyInit();
		this.rng.setSeedStream(this.getStreamNumber(), this.getSubstreamNumber());
	}

	protected override getSample(simTime: number): number {
		const mean = this.meanInput.getNextSample(this, simTime);
		return PoissonDistribution.getSample(mean, this.rng);
	}

	protected override getMean(simTime: number): number {
		const mean = this.meanInput.getNextSample(this, simTime);
		return PoissonDistribution.getMeanVal(mean);
	}

	protected override getStandardDev(simTime: number): number {
		const mean = this.meanInput.getNextSample(this, simTime);
		return PoissonDistribution.getStandardDevVal(mean);
	}

	protected override getMin(simTime: number): number {
		return 0.0;
	}

	protected override getMax(simTime: number): number {
		return Double.POSITIVE_INFINITY;
	}

	/** Java では int を返す */
	static getSample(mean: number, rng: MRG1999a): number {
		const a = Math.exp(-mean);
		let b = 1;
		let i = 0;
		while (true) {
			b *= rng.nextUniform();
			if (b < a)
				return i;
			i++;
		}
	}

	static getMeanVal(mean: number): number {
		return mean;
	}

	static getStandardDevVal(mean: number): number {
		return Math.sqrt(mean);
	}

}

ClassRegistry.register("com.jaamsim.ProbabilityDistributions.PoissonDistribution", PoissonDistribution);
