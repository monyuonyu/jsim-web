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
import { NormalDistribution } from "../internal.ts";

/**
 * LogNormal Distribution.
 * Adapted from A.M. Law, "Simulation Modelling and Analysis, 4th Edition", page 454.
 * Polar Method, Marsaglia and Bray (1964) is used to calculate the normal distribution
 */
export class LogNormalDistribution extends Distribution {

	private readonly normalMeanInput: SampleInput;

	private readonly normalStandardDeviationInput: SampleInput;

	private readonly rng1: MRG1999a = new MRG1999a();
	private readonly rng2: MRG1999a = new MRG1999a();

	constructor() {
		super();
		this.minValueInput.setDefaultValue(0.0);

		this.locationInput.setHidden(false);
		this.scaleInput.setHidden(false);

		this.normalMeanInput = new SampleInput("NormalMean", Entity.KEY_INPUTS, 0.0);
		this.setKeywordDoc(this.normalMeanInput, "The mean of the dimensionless normal distribution (not the mean of the lognormal).",
		         ["5.0", "InputValue1", "'2 * [InputValue1].Value'"]);
		this.normalMeanInput.setUnitType(DimensionlessUnit);
		this.addInput(this.normalMeanInput);

		this.normalStandardDeviationInput = new SampleInput("NormalStandardDeviation", Entity.KEY_INPUTS, 1.0);
		this.setKeywordDoc(this.normalStandardDeviationInput, "The standard deviation of the dimensionless normal distribution (not the standard deviation of the lognormal).",
		         ["2.0", "InputValue1", "'2 * [InputValue1].Value'"]);
		this.normalStandardDeviationInput.setUnitType(DimensionlessUnit);
		this.normalStandardDeviationInput.setValidRange(0.0, Double.POSITIVE_INFINITY);
		this.addInput(this.normalStandardDeviationInput);
	}

	override earlyInit(): void {
		super.earlyInit();

		this.rng1.setSeedStream(this.getStreamNumber()    , this.getSubstreamNumber());
		this.rng2.setSeedStream(this.getStreamNumber() + 1, this.getSubstreamNumber());
	}

	protected override getSample(simTime: number): number {
		const location = this.getLocationInput(simTime);
		const scale = this.getScaleInput(simTime);
		const mean = this.normalMeanInput.getNextSample(this, simTime);
		const sd = this.normalStandardDeviationInput.getNextSample(this, simTime);
		return location + scale * LogNormalDistribution.getSample(mean, sd, this.rng1, this.rng2);
	}

	protected override getMean(simTime: number): number {
		const location = this.getLocationInput(simTime);
		const scale = this.getScaleInput(simTime);
		const mean = this.normalMeanInput.getNextSample(this, simTime);
		const sd = this.normalStandardDeviationInput.getNextSample(this, simTime);
		return location + scale * LogNormalDistribution.getMean(mean, sd);
	}

	protected override getStandardDev(simTime: number): number {
		const scale = this.getScaleInput(simTime);
		const mean = this.normalMeanInput.getNextSample(this, simTime);
		const sd = this.normalStandardDeviationInput.getNextSample(this, simTime);
		return scale * LogNormalDistribution.getStandardDev(mean, sd);
	}

	protected override getMin(simTime: number): number {
		const location = this.getLocationInput(simTime);
		return location;
	}

	protected override getMax(simTime: number): number {
		return Double.POSITIVE_INFINITY;
	}

	static getSample(normalMean: number, normalSD: number, rng1: MRG1999a, rng2: MRG1999a): number {
		const sample = NormalDistribution.getSample(normalMean, normalSD, rng1, rng2);
		return Math.exp(sample);
	}

	static getMean(normalMean: number, normalSD: number): number {
		return Math.exp(normalMean + normalSD*normalSD/2.0);
	}

	static getStandardDev(normalMean: number, normalSD: number): number {
		return LogNormalDistribution.getMean(normalMean, normalSD) * Math.sqrt( Math.exp(normalSD*normalSD) - 1.0 );
	}

}

ClassRegistry.register("com.jaamsim.ProbabilityDistributions.LogNormalDistribution", LogNormalDistribution);
