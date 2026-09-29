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
import { MRG1999a } from "../internal.ts";
import { DimensionlessUnit } from "../internal.ts";
import { Distribution } from "../internal.ts";

/**
 * Log-Logistic Distribution.
 * Adapted from A.M. Law, "Simulation Modelling and Analysis, 4th Edition", page 456.
 */
export class LogLogisticDistribution extends Distribution {

	private readonly shapeInput: SampleInput;

	private readonly rng: MRG1999a = new MRG1999a();

	constructor() {
		super();
		this.minValueInput.setDefaultValue(0.0);

		this.locationInput.setHidden(false);
		this.scaleInput.setHidden(false);

		this.shapeInput = new SampleInput("Shape", Entity.KEY_INPUTS, 1.0);
		this.setKeywordDoc(this.shapeInput, "The shape parameter for the Log-Logistic distribution. "
		                     + "A decimal value > 0.0.\n\n"
		                     + "Note that the mean value of the distribution is infinite for shape <= 1.0. "
		                     + "The standard deviation is infinite for shape <= 2.0.",
		         ["1.0", "InputValue1", "'2 * [InputValue1].Value'"]);
		this.shapeInput.setValidRange(0.0, Double.POSITIVE_INFINITY);
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
		return location + LogLogisticDistribution.getSample(scale, shape, this.rng);
	}

	protected override getMean(simTime: number): number {
		const location = this.getLocationInput(simTime);
		const scale = this.getScaleInput(simTime);
		const shape = this.shapeInput.getNextSample(this, simTime);
		return location + LogLogisticDistribution.getMean(scale, shape);
	}

	protected override getStandardDev(simTime: number): number {
		const scale = this.getScaleInput(simTime);
		const shape = this.shapeInput.getNextSample(this, simTime);
		return LogLogisticDistribution.getStandardDev(scale, shape);
	}

	protected override getMin(simTime: number): number {
		const location = this.getLocationInput(simTime);
		return location;
	}

	protected override getMax(simTime: number): number {
		return Double.POSITIVE_INFINITY;
	}

	static getSample(scale: number, shape: number, rng: MRG1999a): number {
		const u = rng.nextUniform();
		return scale * Math.pow( u / (1 - u), 1.0 / shape );
	}

	static getMean(scale: number, shape: number): number {
		if (shape <= 1.0)
			return Double.POSITIVE_INFINITY;
		const theta = Math.PI / shape;
		return scale * theta / Math.sin( theta );
	}

	static getStandardDev(scale: number, shape: number): number {
		if (shape <= 2.0)
			return Double.POSITIVE_INFINITY;
		const theta = Math.PI / shape;
		return scale * Math.sqrt( theta * ( 2.0/Math.sin(2.0*theta) - theta/Math.pow( Math.sin(theta), 2.0) ) );
	}

}

ClassRegistry.register("com.jaamsim.ProbabilityDistributions.LogLogisticDistribution", LogLogisticDistribution);
