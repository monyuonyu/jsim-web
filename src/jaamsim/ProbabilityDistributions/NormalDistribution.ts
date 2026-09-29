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
 * Normal Distribution.
 * Adapted from A.M. Law, "Simulation Modelling and Analysis, 4th Edition", page 453.
 * Polar Method, Marsaglia and Bray (1964)
 */
export class NormalDistribution extends Distribution {

	private readonly meanInput: SampleInput;

	private readonly standardDeviationInput: SampleInput;

	private readonly rng1: MRG1999a = new MRG1999a();
	private readonly rng2: MRG1999a = new MRG1999a();

	constructor() {
		super();
		this.meanInput = new SampleInput("Mean", Entity.KEY_INPUTS, 0.0);
		this.setKeywordDoc(this.meanInput, "The mean of the normal distribution (ignoring the MinValue and "
		                     + "MaxValue keywords).",
		         ["5.0", "InputValue1", "'2 * [InputValue1].Value'"]);
		this.meanInput.setUnitType(UserSpecifiedUnit);
		this.addInput(this.meanInput);

		this.standardDeviationInput = new SampleInput("StandardDeviation", Entity.KEY_INPUTS, 1.0);
		this.setKeywordDoc(this.standardDeviationInput, "The standard deviation of the normal distribution (ignoring the "
		                     + "MinValue and MaxValue keywords).",
		         ["2.0", "InputValue1", "'2 * [InputValue1].Value'"]);
		this.standardDeviationInput.setUnitType(UserSpecifiedUnit);
		this.standardDeviationInput.setValidRange(0.0, Double.POSITIVE_INFINITY);
		this.addInput(this.standardDeviationInput);
	}

	override earlyInit(): void {
		super.earlyInit();

		this.rng1.setSeedStream(this.getStreamNumber()    , this.getSubstreamNumber());
		this.rng2.setSeedStream(this.getStreamNumber() + 1, this.getSubstreamNumber());
	}

	protected override setUnitType(specified: JClass<Unit>): void {
		super.setUnitType(specified);
		this.meanInput.setUnitType(specified);
		this.standardDeviationInput.setUnitType(specified);
		this.updateUserOutputMap();
	}

	protected override getSample(simTime: number): number {
		const mean = this.meanInput.getNextSample(this, simTime);
		const sdev = this.standardDeviationInput.getNextSample(this, simTime);
		return NormalDistribution.getSample(mean, sdev, this.rng1, this.rng2);
	}

	protected override getMean(simTime: number): number {
		const mean = this.meanInput.getNextSample(this, simTime);
		const sdev = this.standardDeviationInput.getNextSample(this, simTime);
		return NormalDistribution.getMean(mean, sdev);
	}

	protected override getStandardDev(simTime: number): number {
		const mean = this.meanInput.getNextSample(this, simTime);
		const sdev = this.standardDeviationInput.getNextSample(this, simTime);
		return NormalDistribution.getStandardDev(mean, sdev);
	}

	protected override getMin(simTime: number): number {
		return Double.NEGATIVE_INFINITY;
	}

	protected override getMax(simTime: number): number {
		return Double.POSITIVE_INFINITY;
	}

	static getSample(mean: number, sdev: number, rng1: MRG1999a, rng2: MRG1999a): number {

		// Loop until we have a random x-y coordinate in the unit circle
		let w: number, v1: number, v2: number, sample: number;
		do {
			v1 = 2.0 * rng1.nextUniform() - 1.0;
			v2 = 2.0 * rng2.nextUniform() - 1.0;
			w = ( v1 * v1 ) + ( v2 * v2 );
		} while( w > 1.0 || w === 0.0 );

		// Calculate the normalised random sample
		// (normally distributed with mode = 0 and standard deviation = 1)
		sample = v1 * Math.sqrt( -2.0 * Math.log( w ) / w );

		// Adjust for the desired mode and standard deviation
		return mean + sample*sdev;
	}

	static getMean(mean: number, sdev: number): number {
		return mean;
	}

	static getStandardDev(mean: number, sdev: number): number {
		return sdev;
	}
}

ClassRegistry.register("com.jaamsim.ProbabilityDistributions.NormalDistribution", NormalDistribution);
