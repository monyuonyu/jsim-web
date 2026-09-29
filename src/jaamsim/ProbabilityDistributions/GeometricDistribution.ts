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
import { MathUtils } from "../internal.ts";
import { MRG1999a } from "../internal.ts";
import { DimensionlessUnit } from "../internal.ts";
import { Distribution } from "../internal.ts";

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
 * Geometric Distribution.
 * Adapted from A.M. Law, "Simulation Modelling and Analysis, 5th Edition", page 469.
 */
export class GeometricDistribution extends Distribution {

	private readonly probability: SampleInput;

	private readonly rng: MRG1999a = new MRG1999a();

	constructor() {
		super();
		this.unitType.setDefaultValue(DimensionlessUnit);
		this.setUnitType(this.getUnitType());
		this.unitType.setHidden(true);

		this.minValueInput.setDefaultValue(0.0);

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
		const p = this.probability.getNextSample(this, simTime);
		return GeometricDistribution.getSample(p, this.rng);
	}

	protected override getMean(simTime: number): number {
		const p = this.probability.getNextSample(this, simTime);
		return GeometricDistribution.getMeanVal(p);
	}

	protected override getStandardDev(simTime: number): number {
		const p = this.probability.getNextSample(this, simTime);
		return GeometricDistribution.getStandardDevVal(p);
	}

	protected override getMin(simTime: number): number {
		return 0.0;
	}

	protected override getMax(simTime: number): number {
		return Double.POSITIVE_INFINITY;
	}

	/** Java では int を返す */
	static getSample(p: number, rng: MRG1999a): number {
		if (MathUtils.near(p, 1.0))
			return 0;
		const rand = rng.nextUniform();
		return jint(Math.log(rand) / Math.log(1 - p));
	}

	static getMeanVal(p: number): number {
		return (1.0 - p) / p;
	}

	static getStandardDevVal(p: number): number {
		return Math.sqrt(1.0 - p) / p;
	}

}

ClassRegistry.register("com.jaamsim.ProbabilityDistributions.GeometricDistribution", GeometricDistribution);
