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

import { Double } from "../internal.ts";
import { ClassRegistry } from "../internal.ts";
import { SampleInput } from "../internal.ts";
import { Entity } from "../internal.ts";
import { Gamma } from "../internal.ts";
import { MRG1999a } from "../internal.ts";
import { DimensionlessUnit } from "../internal.ts";
import { Distribution } from "../internal.ts";

/**
 * Weibull Distribution.
 * Adapted from A.M. Law, "Simulation Modelling and Analysis, 4th Edition", page 452.
 */
export class WeibullDistribution extends Distribution {

	private readonly shapeInput: SampleInput;

	private readonly rng: MRG1999a = new MRG1999a();

	constructor() {
		super();
		this.minValueInput.setDefaultValue(0.0);

		this.locationInput.setHidden(false);
		this.scaleInput.setHidden(false);

		this.shapeInput = new SampleInput("Shape", Entity.KEY_INPUTS, 1.0);
		this.setKeywordDoc(this.shapeInput, "The shape parameter for the Weibull distribution.  A decimal value > 0.0.",
		         ["1.0", "InputValue1", "'2 * [InputValue1].Value'"]);
		this.shapeInput.setValidRange(1.0e-10, Double.POSITIVE_INFINITY);
		this.shapeInput.setUnitType(DimensionlessUnit);
		this.addInput(this.shapeInput);
	}

	override earlyInit(): void {
		super.earlyInit();
		this.rng.setSeedStream(this.getStreamNumber(), this.getSubstreamNumber());
	}

	protected override getSample(simTime: number): number {
		const location = this.getLocationInput(simTime);
		const scale = this.getScaleInput(simTime);
		const shape = this.shapeInput.getNextSample(this, simTime);
		return location + WeibullDistribution.getSample(scale, shape, this.rng);
	}

	protected override getMean(simTime: number): number {
		const location = this.getLocationInput(simTime);
		const scale = this.getScaleInput(simTime);
		const shape = this.shapeInput.getNextSample(this, simTime);
		return location + WeibullDistribution.getMean(scale, shape);
	}

	protected override getStandardDev(simTime: number): number {
		const scale = this.getScaleInput(simTime);
		const shape = this.shapeInput.getNextSample(this, simTime);
		return WeibullDistribution.getStandardDev(scale, shape);
	}

	protected override getMin(simTime: number): number {
		const location = this.getLocationInput(simTime);
		return location;
	}

	protected override getMax(simTime: number): number {
		return Double.POSITIVE_INFINITY;
	}

	static getSample(scale: number, shape: number, rng: MRG1999a): number {
		return scale * Math.pow( - Math.log(rng.nextUniform()), 1.0/shape );
	}

	static getMean(scale: number, shape: number): number {
		return scale/shape * Gamma.gamma(1.0/shape);
	}

	static getStandardDev(scale: number, shape: number): number {
		return scale/shape * Math.sqrt( 2.0*shape*Gamma.gamma(2.0/shape) - Math.pow(Gamma.gamma(1.0/shape), 2.0) );
	}

}

ClassRegistry.register("com.jaamsim.ProbabilityDistributions.WeibullDistribution", WeibullDistribution);
