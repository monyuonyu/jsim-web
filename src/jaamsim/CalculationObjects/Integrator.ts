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

import type { JClass } from "../java/lang.ts";
import { ClassRegistry } from "../java/ClassRegistry.ts";
import { SampleInput } from "../Samples/SampleInput.ts";
import { Entity } from "../basicsim/Entity.ts";
import { DimensionlessUnit } from "../units/DimensionlessUnit.ts";
import { TimeUnit } from "../units/TimeUnit.ts";
import { Unit } from "../units/Unit.ts";
import { UserSpecifiedUnit } from "../units/UserSpecifiedUnit.ts";
import { DoubleCalculation } from "./DoubleCalculation.ts";

/**
 * The Integrator returns the integral of the input values.
 * @author Harry King
 *
 */
export class Integrator extends DoubleCalculation {

	private readonly initialValue: SampleInput;

	protected outUnitType: JClass<Unit> | null = null;  // Unit type for the output from this calculation

	constructor() {
		super();

		// Java の初期化ブロック
		this.initialValue = new SampleInput("InitialValue", Entity.KEY_INPUTS, 0.0);
		this.setKeywordDoc(this.initialValue, "The initial value for the integral at time = 0.",
		         ["5.5 m/s", "[InputValue1].Value"]);
		this.initialValue.setUnitType(UserSpecifiedUnit);
		this.addInput(this.initialValue);
	}

	protected override setUnitType(ut: JClass<Unit>): void {
		super.setUnitType(ut);

		this.outUnitType = Unit.getMultUnitType(ut, TimeUnit);
		if (this.outUnitType === null)
			this.outUnitType = DimensionlessUnit;
		this.initialValue.setUnitType(this.outUnitType);
	}

	override getUnitType(): JClass<Unit> | null {
		return this.outUnitType;
	}

	override getUserUnitType(): JClass<Unit> {
		return this.outUnitType as JClass<Unit>;
	}

	override getInitialValue(): number {
		return this.initialValue.getNextSample(this, 0.0);
	}

	protected override calculateValue(simTime: number, inputVal: number, lastTime: number, lastInputVal: number, lastVal: number): number {

		// Calculate the elapsed time
		const dt = simTime - lastTime;
		if (dt <= 0.0)
			return lastVal;

		// Calculate the integral
		return lastVal + 0.5*(lastInputVal + inputVal)*dt;
	}

}

ClassRegistry.register("com.jaamsim.CalculationObjects.Integrator", Integrator);
