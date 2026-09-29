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

// getNextSample(double)（出力 Value、final）と getNextSample(Entity, double) は、引数の数で見分ける 1 つの関数にした。

import type { JClass } from "../java/lang.ts";
import { ClassRegistry } from "../java/ClassRegistry.ts";
import { DisplayEntity } from "../Graphics/DisplayEntity.ts";
import { SampleInput } from "../Samples/SampleInput.ts";
import type { SampleProvider } from "../Samples/SampleProvider.ts";
import { Entity } from "../basicsim/Entity.ts";
import { defineOutput } from "../input/OutputRegistry.ts";
import { ValueListInput } from "../input/ValueListInput.ts";
import { DimensionlessUnit } from "../units/DimensionlessUnit.ts";
import type { Unit } from "../units/Unit.ts";

/**
 * The Polynomial entity returns a user-defined polynomial function of its input value.
 * @author Harry King
 *
 */
export class Polynomial extends DisplayEntity implements SampleProvider {

	protected readonly inputValue: SampleInput;

	private readonly coefficientList: ValueListInput;

	constructor() {
		super();

		// Java の初期化ブロック
		this.inputValue = new SampleInput("InputValue", Entity.KEY_INPUTS, 0.0);
		this.setKeywordDoc(this.inputValue, "The input value to the polynomial.",
		         ["2.5", "1.5*[Calculation1].Value", "Calculation1"]);
		this.inputValue.setUnitType(DimensionlessUnit);
		this.addInput(this.inputValue);

		this.coefficientList = new ValueListInput("CoefficientList", Entity.KEY_INPUTS, 0.0);
		this.setKeywordDoc(this.coefficientList, "The list of dimensionless coefficients for the polynomial function.\n"
		                     + "The number of coefficients provided determines the number of terms "
		                     + "in the polynomial. For example, inputs c0, c1, c2 specifies the "
		                     + "second order polynomial P(x) = c0 + c1*x + c2*x^2.",
		         ["2.0  1.5"]);
		this.coefficientList.setUnitType(DimensionlessUnit);
		this.addInput( this.coefficientList);
	}

	/** getNextSample(double simTime)（出力 Value）と getNextSample(Entity thisEnt, double simTime) */
	getNextSample(simTime: number): number;
	getNextSample(thisEnt: Entity | null, simTime: number): number;
	getNextSample(a: Entity | null | number, b?: number): number {
		if (b === undefined)
			return this.getNextSample(this, a as number);
		const simTime = b;

		const x = this.inputValue.getNextSample(this, simTime);
		let pow = 1.0;
		let val = 0.0;
		for(let i=0; i<this.coefficientList.getValue()!.size(); i++ ) {
			val += this.coefficientList.getValue()!.get(i) * pow;
			pow *= x;
		}
		return val;
	}

	getUnitType(): JClass<Unit> | null {
		return DimensionlessUnit;
	}

	getMeanValue(simTime: number): number {
		return 0;
	}

}

defineOutput(Polynomial, {
	name: "Value",
	description: "The calculated value for the polynomial.",
	unitType: DimensionlessUnit,
	returnType: "double",
	get: (e, simTime) => e.getNextSample(simTime),
});

ClassRegistry.register("com.jaamsim.CalculationObjects.Polynomial", Polynomial);
