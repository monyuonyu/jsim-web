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

import { Double, Integer } from "../internal.ts";
import { type JClass } from "../java/lang.ts";
import { ClassRegistry } from "../internal.ts";
import { SampleInput } from "../internal.ts";
import { Entity } from "../internal.ts";
import { MRG1999a } from "../internal.ts";
import { DimensionlessUnit } from "../internal.ts";
import type { Unit } from "../units/Unit.ts";
import { UserSpecifiedUnit } from "../internal.ts";
import { Distribution } from "../internal.ts";

/**
 * Gamma Distribution.
 * Adapted from A.M. Law, "Simulation Modelling and Analysis, 4th Edition", pages 449-452.
 * Ahrens and Dieter (1974) for shape parameter < 1
 * Cheng (1977) for shape parameter >= 1
 */
export class GammaDistribution extends Distribution {

	private readonly meanInput: SampleInput;

	private readonly shapeInput: SampleInput;

	private readonly rng1: MRG1999a = new MRG1999a();
	private readonly rng2: MRG1999a = new MRG1999a();

	constructor() {
		super();
		this.minValueInput.setDefaultValue(0.0);

		this.meanInput = new SampleInput("Mean", Entity.KEY_INPUTS, 1.0);
		this.setKeywordDoc(this.meanInput, "The mean of the Gamma distribution.",
		         ["5.0", "InputValue1", "'2 * [InputValue1].Value'"]);
		this.meanInput.setUnitType(UserSpecifiedUnit);
		this.meanInput.setValidRange(0.0, Double.POSITIVE_INFINITY);
		this.addInput(this.meanInput);

		this.shapeInput = new SampleInput("Shape", Entity.KEY_INPUTS, 1.0);
		this.setKeywordDoc(this.shapeInput, "The shape parameter for the Gamma distribution.  A decimal value > 0.0.",
		         ["2.0", "InputValue1", "'2 * [InputValue1].Value'"]);
		this.shapeInput.setUnitType(DimensionlessUnit);
		this.shapeInput.setValidRange( 1.0e-10, Integer.MAX_VALUE);
		this.addInput(this.shapeInput);
	}

	override earlyInit(): void {
		super.earlyInit();

		this.rng1.setSeedStream(this.getStreamNumber()    , this.getSubstreamNumber());
		this.rng2.setSeedStream(this.getStreamNumber() + 1, this.getSubstreamNumber());
	}

	protected override setUnitType(specified: JClass<Unit>): void {
		super.setUnitType(specified);
		this.meanInput.setUnitType(specified);
		this.updateUserOutputMap();
	}

	protected override getSample(simTime: number): number {
		const mean = this.meanInput.getNextSample(this, simTime);
		const shape = this.shapeInput.getNextSample(this, simTime);
		return GammaDistribution.getSample(mean, shape, this.rng1, this.rng2);
	}

	protected override getMean(simTime: number): number {
		const mean = this.meanInput.getNextSample(this, simTime);
		const shape = this.shapeInput.getNextSample(this, simTime);
		return GammaDistribution.getMean(mean, shape);
	}

	protected override getStandardDev(simTime: number): number {
		const mean = this.meanInput.getNextSample(this, simTime);
		const shape = this.shapeInput.getNextSample(this, simTime);
		return GammaDistribution.getStandardDev(mean, shape);
	}

	protected override getMin(simTime: number): number {
		return 0.0;
	}

	protected override getMax(simTime: number): number {
		return Double.POSITIVE_INFINITY;
	}

	static getSample(mean: number, shape: number, rng1: MRG1999a, rng2: MRG1999a): number {
		let u2: number, b: number, sample: number;

		// Case 1 - Shape parameter < 1
		if( shape < 1.0 ) {
			let threshold: number;
			b = 1.0 + ( shape / Math.E );
			do {
				const p = b * rng2.nextUniform();
				u2 = rng1.nextUniform();

				if( p <= 1.0 ) {
					sample = Math.pow( p, 1.0/shape );
					threshold = Math.exp( - sample );
				}

				else {
					sample = - Math.log( ( b - p ) / shape );
					threshold = Math.pow( sample, shape - 1.0 );
				}
			} while ( u2 > threshold );
		}

		// Case 2 - Shape parameter >= 1
		else {
			let u1: number, w: number, z: number;
			const a = 1.0 / Math.sqrt( ( 2.0 * shape ) - 1.0 );
			b = shape - Math.log( 4.0 );
			const q = shape + ( 1.0 / a );
			const d = 1.0 + Math.log( 4.5 );
			do {
				u1 = rng1.nextUniform();
				u2 = rng2.nextUniform();
				const v = a * Math.log( u1 / ( 1.0 - u1 ) );
				sample = shape * Math.exp( v );
				z = u1 * u1 * u2;
				w = b + q*v - sample;
			} while( ( w + d - 4.5*z < 0.0 ) && ( w < Math.log(z) ) );
		}

		// Scale the sample by the desired mean value
		return sample * mean / shape;
	}

	static getMean(mean: number, shape: number): number {
		return mean;
	}

	static getStandardDev(mean: number, shape: number): number {
		return mean / Math.sqrt(shape);
	}

}

ClassRegistry.register("com.jaamsim.ProbabilityDistributions.GammaDistribution", GammaDistribution);
