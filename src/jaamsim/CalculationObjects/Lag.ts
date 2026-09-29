/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2013 Ausenco Engineering Canada Inc.
 * Copyright (C) 2016-2023 JaamSim Software Inc.
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
import { Double } from "../java/lang.ts";
import { SampleInput } from "../Samples/SampleInput.ts";
import { Entity } from "../basicsim/Entity.ts";
import { defineOutput } from "../input/OutputRegistry.ts";
import { TimeUnit } from "../units/TimeUnit.ts";
import { UserSpecifiedUnit } from "../units/UserSpecifiedUnit.ts";
import { DoubleCalculation } from "./DoubleCalculation.ts";

/**
 * The Lag block is a standard control system component whose output is equal to integral(input - output) / LagTime.
 * This operation has the effect of delaying and smoothing the input signal over the time scale given by LagTime.
 * @author Harry King
 *
 */
export class Lag extends DoubleCalculation {

	private readonly lagTime: SampleInput;

	constructor() {
		super();

		// Java の初期化ブロック
		this.lagTime = new SampleInput("LagTime", Entity.KEY_INPUTS, 1.0);
		this.setKeywordDoc(this.lagTime, "The time constant for this operation: "
		                     + "output = integral(input - output) / LagTime.",
		         ["15 s"]);
		this.lagTime.setValidRange(1.0e-10, Double.POSITIVE_INFINITY);
		this.lagTime.setUnitType(TimeUnit);
		this.addInput(this.lagTime);
	}

	override calculateValue(simTime: number, inputVal: number, lastTime: number, lastInputVal: number, lastVal: number): number {
		const dt = simTime - lastTime;
		const error = inputVal - lastVal;
		return lastVal + dt*error/this.lagTime.getNextSample(this, simTime);
	}

	getError(simTime: number): number {
		return this.getInputValue(simTime) - this.getLastValue();
	}

}

defineOutput(Lag, {
	name: "Error",
	description: "The value for InputValue - Value.",
	unitType: UserSpecifiedUnit,
	returnType: "double",
	get: (e, simTime) => e.getError(simTime),
});

ClassRegistry.register("com.jaamsim.CalculationObjects.Lag", Lag);
