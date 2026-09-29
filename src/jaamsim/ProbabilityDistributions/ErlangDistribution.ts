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
 * Erlang Distribution.
 * Adapted from A.M. Law, "Simulation Modelling and Analysis, 4th Edition", page 449.
 */
export class ErlangDistribution extends Distribution {

	private readonly meanInput: SampleInput;

	private readonly shapeInput: SampleInput;

	private readonly rng: MRG1999a = new MRG1999a();

	constructor() {
		super();
		this.minValueInput.setDefaultValue(0.0);

		this.meanInput = new SampleInput("Mean", Entity.KEY_INPUTS, 1.0);
		this.setKeywordDoc(this.meanInput, "The scale parameter for the Erlang distribution.",
		         ["5.0", "InputValue1", "'2 * [InputValue1].Value'"]);
		this.meanInput.setUnitType(UserSpecifiedUnit);
		this.meanInput.setValidRange(0.0, Double.POSITIVE_INFINITY);
		this.addInput(this.meanInput);

		this.shapeInput = new SampleInput("Shape", Entity.KEY_INPUTS, 1);
		this.setKeywordDoc(this.shapeInput, "The shape parameter for the Erlang distribution.  An integer value >= 1.  " +
				"Shape = 1 gives the Exponential distribution.  " +
				"For Shape > 10 it is better to use the Gamma distribution.",
		         ["2"]);
		this.shapeInput.setValidRange( 1, Double.POSITIVE_INFINITY);
		this.shapeInput.setIntegerValue(true);
		this.addInput(this.shapeInput);
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
		const shape = jint(this.shapeInput.getNextSample(this, simTime));
		return ErlangDistribution.getSample(mean, shape, this.rng);
	}

	protected override getMean(simTime: number): number {
		const mean = this.meanInput.getNextSample(this, simTime);
		const shape = jint(this.shapeInput.getNextSample(this, simTime));
		return ErlangDistribution.getMean(mean, shape);
	}

	protected override getStandardDev(simTime: number): number {
		const mean = this.meanInput.getNextSample(this, simTime);
		const shape = jint(this.shapeInput.getNextSample(this, simTime));
		return ErlangDistribution.getStandardDev(mean, shape);
	}

	protected override getMin(simTime: number): number {
		return 0.0;
	}

	protected override getMax(simTime: number): number {
		return Double.POSITIVE_INFINITY;
	}

	/** shape は Java の int */
	static getSample(mean: number, shape: number, rng: MRG1999a): number {

		// Calculate the product of k random values
		let u = 1.0;
		for (let i = 0; i < shape; i++) {
			u *= rng.nextUniform();
		}

		// Inverse transform method
		return (- mean/shape * Math.log(u));
	}

	/** shape は Java の int */
	static getMean(mean: number, shape: number): number {
		return mean;
	}

	/** shape は Java の int */
	static getStandardDev(mean: number, shape: number): number {
		return mean / Math.sqrt(shape);
	}

}

ClassRegistry.register("com.jaamsim.ProbabilityDistributions.ErlangDistribution", ErlangDistribution);
