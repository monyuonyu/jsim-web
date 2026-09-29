/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2022-2023 JaamSim Software Inc.
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

import { ClassRegistry } from "../java/ClassRegistry.ts";
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
 * Discrete Uniform Distribution.
 * Adapted from A.M. Law, "Simulation Modelling and Analysis, 5th Edition", page 469.
 */
export class DiscreteUniformDistribution extends Distribution {

	private readonly rng: MRG1999a = new MRG1999a();

	constructor() {
		super();
		this.minValueInput.setDefaultValue(1.0);
		this.maxValueInput.setDefaultValue(10.0);

		this.unitType.setDefaultValue(DimensionlessUnit);
		this.setUnitType(this.getUnitType());
		this.unitType.setHidden(true);
	}

	override earlyInit(): void {
		super.earlyInit();
		this.rng.setSeedStream(this.getStreamNumber(), this.getSubstreamNumber());
	}

	protected override getSample(simTime: number): number {
		const i = jint(this.getMinValueInput(simTime));
		const j = jint(this.getMaxValueInput(simTime));
		return DiscreteUniformDistribution.getSample(i, j, this.rng);
	}

	protected override getMean(simTime: number): number {
		const i = jint(this.getMinValueInput(simTime));
		const j = jint(this.getMaxValueInput(simTime));
		return DiscreteUniformDistribution.getMean(i, j);
	}

	protected override getStandardDev(simTime: number): number {
		const i = jint(this.getMinValueInput(simTime));
		const j = jint(this.getMaxValueInput(simTime));
		return DiscreteUniformDistribution.getStandardDev(i, j);
	}

	protected override getMin(simTime: number): number {
		const i = jint(this.getMinValueInput(simTime));
		return i;
	}

	protected override getMax(simTime: number): number {
		const j = jint(this.getMaxValueInput(simTime));
		return j;
	}

	/** i は Java の int、j は double。Java では int を返す */
	static getSample(i: number, j: number, rng: MRG1999a): number {
		return jint(i + rng.nextUniform() * (j - i + 1));
	}

	/** i は Java の int、j は double */
	static getMean(i: number, j: number): number {
		return 0.5 * (i + j);
	}

	/** i は Java の int、j は double */
	static getStandardDev(i: number, j: number): number {
		return Math.sqrt( (Math.pow(j - i + 1, 2) - 1) / 12.0 );
	}

}

ClassRegistry.register("com.jaamsim.ProbabilityDistributions.DiscreteUniformDistribution", DiscreteUniformDistribution);
