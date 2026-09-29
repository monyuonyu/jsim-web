/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2013 Ausenco Engineering Canada Inc.
 * Copyright (C) 2016-2022 JaamSim Software Inc.
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

import { ClassRegistry } from "../internal.ts";
import { MRG1999a } from "../internal.ts";
import { Distribution } from "../internal.ts";

/**
 * Uniform Distribution.
 * Adapted from A.M. Law, "Simulation Modelling and Analysis, 4th Edition", page 448.
 */
export class UniformDistribution extends Distribution {
	private readonly rng: MRG1999a = new MRG1999a();

	constructor() {
		super();
		this.minValueInput.setDefaultValue(0.0);
		this.maxValueInput.setDefaultValue(1.0);
	}

	override earlyInit(): void {
		super.earlyInit();
		this.rng.setSeedStream(this.getStreamNumber(), this.getSubstreamNumber());
	}

	protected override getSample(simTime: number): number {

		// Select the sample from a uniform distribution between the min and max values
		const minVal = this.getMinValueInput(simTime);
		const maxVal = this.getMaxValueInput(simTime);
		return UniformDistribution.getSample(minVal, maxVal, this.rng);
	}

	protected override getMean(simTime: number): number {
		const minVal = this.getMinValueInput(simTime);
		const maxVal = this.getMaxValueInput(simTime);
		return UniformDistribution.getMean(minVal, maxVal);
	}

	protected override getStandardDev(simTime: number): number {
		const minVal = this.getMinValueInput(simTime);
		const maxVal = this.getMaxValueInput(simTime);
		return UniformDistribution.getStandardDev(minVal, maxVal);
	}

	protected override getMin(simTime: number): number {
		return this.getMinValueInput(simTime);
	}

	protected override getMax(simTime: number): number {
		return this.getMaxValueInput(simTime);
	}

	static getSample(minVal: number, maxVal: number, rng: MRG1999a): number {
		return minVal + rng.nextUniform()*(maxVal - minVal);
	}

	static getMean(minVal: number, maxVal: number): number {
		return 0.5 *(minVal + maxVal);
	}

	static getStandardDev(minVal: number, maxVal: number): number {
		return 0.5*(maxVal - minVal) / Math.sqrt(3.0);
	}

}

ClassRegistry.register("com.jaamsim.ProbabilityDistributions.UniformDistribution", UniformDistribution);
