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

import type { JClass } from "../java/lang.ts";
import { ClassRegistry } from "../java/ClassRegistry.ts";
import { tr } from "../i18n/I18n.ts";
import { SampleInput } from "../Samples/SampleInput.ts";
import { Entity } from "../basicsim/Entity.ts";
import { InputErrorException } from "../input/InputErrorException.ts";
import { MRG1999a } from "../rng/MRG1999a.ts";
import type { Unit } from "../units/Unit.ts";
import { UserSpecifiedUnit } from "../units/UserSpecifiedUnit.ts";
import { Distribution } from "./Distribution.ts";

/**
 * Triangular Distribution.
 * Adapted from A.M. Law, "Simulation Modelling and Analysis, 4th Edition", page 457.
 */
export class TriangularDistribution extends Distribution {

	private readonly modeInput: SampleInput;

	private readonly rng: MRG1999a = new MRG1999a();

	constructor() {
		super();
		this.minValueInput.setDefaultValue(0.0);
		this.maxValueInput.setDefaultValue(2.0);

		this.modeInput = new SampleInput("Mode", Entity.KEY_INPUTS, 1.0);
		this.setKeywordDoc(this.modeInput, "The mode of the triangular distribution, i.e. the value with the highest probability.",
		         ["5.0", "InputValue1", "'2 * [InputValue1].Value'"]);
		this.modeInput.setUnitType(UserSpecifiedUnit);
		this.addInput(this.modeInput);
	}

	override validate(): void {
		super.validate();

		// The mode must be between the minimum and maximum values
		if (this.getMinValueInput(0.0) > this.modeInput.getNextSample(this, 0.0)) {
			throw new InputErrorException(tr("The input for Mode must be >= than that for MinValue."));
		}
		if (this.getMaxValueInput(0.0) < this.modeInput.getNextSample(this, 0.0)) {
			throw new InputErrorException(tr("The input for Mode must be <= than that for MaxValue."));
		}
	}

	override earlyInit(): void {
		super.earlyInit();
		this.rng.setSeedStream(this.getStreamNumber(), this.getSubstreamNumber());
	}

	protected override setUnitType(specified: JClass<Unit>): void {
		super.setUnitType(specified);
		this.modeInput.setUnitType(specified);
		this.updateUserOutputMap();
	}

	protected override getSample(simTime: number): number {
		const minVal = this.getMinValueInput(simTime);
		const maxVal = this.getMaxValueInput(simTime);
		const mode = this.modeInput.getNextSample(this, simTime);
		return TriangularDistribution.getSample(minVal, mode, maxVal, this.rng);
	}

	protected override getMean(simTime: number): number {
		const minVal = this.getMinValueInput(simTime);
		const maxVal = this.getMaxValueInput(simTime);
		const mode = this.modeInput.getNextSample(this, simTime);
		return TriangularDistribution.getMean(minVal, mode, maxVal);
	}

	protected override getStandardDev(simTime: number): number {
		const a = this.getMinValueInput(simTime);
		const b = this.getMaxValueInput(simTime);
		const m = this.modeInput.getNextSample(this, simTime);
		return  TriangularDistribution.getStandardDev(a, m, b);
	}

	protected override getMin(simTime: number): number {
		return this.getMinValueInput(simTime);
	}

	protected override getMax(simTime: number): number {
		return this.getMaxValueInput(simTime);
	}

	static getSample(minVal: number, mode: number, maxVal: number, rng: MRG1999a): number {

		// Select the random value
		const rand = rng.nextUniform();

		// Calculate the normalised mode
		const m = (mode - minVal)/(maxVal - minVal);

		// Use the inverse transform method to calculate the normalised random sample
		// (triangular distribution with min = 0, max = 1, and mode = m)
		let sample: number;
		if (rand <= m) {
			sample = Math.sqrt( m * rand );
		}
		else {
			sample = 1.0 - Math.sqrt( ( 1.0 - m )*( 1.0 - rand ) );
		}

		// Adjust for the desired min and max values
		return  minVal + sample*(maxVal - minVal);
	}

	static getMean(minVal: number, mode: number, maxVal: number): number {
		return (minVal + mode + maxVal)/3.0;
	}

	static getStandardDev(minVal: number, mode: number, maxVal: number): number {
		return  Math.sqrt( ( minVal*minVal + maxVal*maxVal + mode*mode - minVal*maxVal - minVal*mode - maxVal*mode ) / 18.0 );
	}

}

ClassRegistry.register("com.jaamsim.ProbabilityDistributions.TriangularDistribution", TriangularDistribution);
