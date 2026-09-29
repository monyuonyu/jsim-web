/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2013 Ausenco Engineering Canada Inc.
 * Copyright (C) 2016-2019 JaamSim Software Inc.
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
import { DimensionlessUnit } from "../units/DimensionlessUnit.ts";
import { TimeUnit } from "../units/TimeUnit.ts";
import { Unit } from "../units/Unit.ts";
import { DoubleCalculation } from "./DoubleCalculation.ts";

/**
 * The differentiator returns the derivative of the input signal with respect to time.
 * @author Harry King
 *
 */
export class Differentiator extends DoubleCalculation {

	protected outUnitType: JClass<Unit> | null = null;  // Unit type for the output from this calculation

	constructor() {
		super();
	}

	protected override setUnitType(ut: JClass<Unit>): void {
		super.setUnitType(ut);

		this.outUnitType = Unit.getDivUnitType(ut, TimeUnit);
		if (this.outUnitType === null)
			this.outUnitType = DimensionlessUnit;
	}

	override getUnitType(): JClass<Unit> | null {
		return this.outUnitType;
	}

	override getUserUnitType(): JClass<Unit> {
		return this.outUnitType as JClass<Unit>;
	}

	protected override calculateValue(simTime: number, inputVal: number, lastTime: number, lastInputVal: number, lastVal: number): number {

		// Calculate the elapsed time
		const dt = simTime - lastTime;
		if (dt <= 0.0)
			return lastVal;

		// Calculate the derivative
		return (inputVal - lastInputVal)/dt;
	}
}

ClassRegistry.register("com.jaamsim.CalculationObjects.Differentiator", Differentiator);
