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

import { Double, type JClass } from "../java/lang.ts";
import { ClassRegistry } from "../java/ClassRegistry.ts";
import { SampleInput } from "../Samples/SampleInput.ts";
import { Entity } from "../basicsim/Entity.ts";
import { MRG1999a } from "../rng/MRG1999a.ts";
import type { Unit } from "../units/Unit.ts";
import { UserSpecifiedUnit } from "../units/UserSpecifiedUnit.ts";
import { Distribution } from "./Distribution.ts";

/**
 * Exponential Distribution.
 * Adapted from A.M. Law, "Simulation Modelling and Analysis, 4th Edition", page 448.
 */
export class ExponentialDistribution extends Distribution {

	private readonly meanInput: SampleInput;

	private readonly rng: MRG1999a = new MRG1999a();

	constructor() {
		super();
		this.minValueInput.setDefaultValue(0.0);

		this.meanInput = new SampleInput("Mean", Entity.KEY_INPUTS, 1.0);
		this.setKeywordDoc(this.meanInput, "The mean of the exponential distribution.",
		         ["5.0", "InputValue1", "'2 * [InputValue1].Value'"]);
		this.meanInput.setUnitType(UserSpecifiedUnit);
		this.meanInput.setValidRange(0.0, Double.POSITIVE_INFINITY);
		this.addInput(this.meanInput);
	}

	override earlyInit(): void {
		super.earlyInit();
		this.rng.setSeedStream(this.getStreamNumber(), this.getSubstreamNumber());
	}

	protected override setUnitType(specified: JClass<Unit>): void {
		super.setUnitType(specified);
		this.meanInput.setUnitType(specified);
		this.updateUserOutputMap();
	}

	protected override getSample(simTime: number): number {
		const mean = this.meanInput.getNextSample(this, simTime);
		return ExponentialDistribution.getSample(mean, this.rng);
	}

	protected override getMean(simTime: number): number {
		const mean = this.meanInput.getNextSample(this, simTime);
		return ExponentialDistribution.getMeanVal(mean);
	}

	protected override getStandardDev(simTime: number): number {
		const mean = this.meanInput.getNextSample(this, simTime);
		return ExponentialDistribution.getStandardDevVal(mean);
	}

	protected override getMin(simTime: number): number {
		return 0.0;
	}

	protected override getMax(simTime: number): number {
		return Double.POSITIVE_INFINITY;
	}

	static getSample(mean: number, rng: MRG1999a): number {
		return (-mean * Math.log(rng.nextUniform()));
	}

	static getMeanVal(mean: number): number {
		return mean;
	}

	static getStandardDevVal(mean: number): number {
		return mean;
	}
}

ClassRegistry.register("com.jaamsim.ProbabilityDistributions.ExponentialDistribution", ExponentialDistribution);
