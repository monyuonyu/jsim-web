/*
 * JaamSim Discrete Event Simulation
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

import type { JClass } from "../java/lang.ts";
import { ClassRegistry } from "../java/ClassRegistry.ts";
import { SampleInput } from "../Samples/SampleInput.ts";
import { Entity } from "../basicsim/Entity.ts";
import type { Unit } from "../units/Unit.ts";
import { UserSpecifiedUnit } from "../units/UserSpecifiedUnit.ts";
import { DoubleCalculation } from "./DoubleCalculation.ts";

export class UnitDelay extends DoubleCalculation {

	private readonly initialValue: SampleInput;

	constructor() {
		super();

		// Java の初期化ブロック
		this.initialValue = new SampleInput("InitialValue", Entity.KEY_INPUTS, 0.0);
		this.setKeywordDoc(this.initialValue, "The initial value for the UnitDelay function.",
		         ["5.5"]);
		this.initialValue.setUnitType(UserSpecifiedUnit);
		this.addInput(this.initialValue);
	}

	protected override setUnitType(ut: JClass<Unit>): void {
		super.setUnitType(ut);
		this.initialValue.setUnitType(ut);
	}

	override getInitialValue(): number {
		return this.initialValue.getNextSample(this, 0.0);
	}

	protected override calculateValue(simTime: number, inputVal: number, lastTime: number, lastInputVal: number, lastVal: number): number {
		return inputVal;
	}

	/** Java の getNextSample(Entity, double) の上書き。親の getNextSample(double)（出力 Value）もここに来る（Java と同じ） */
	override getNextSample(simTime: number): number;
	override getNextSample(thisEnt: Entity | null, simTime: number): number;
	override getNextSample(_a: Entity | null | number, _b?: number): number {
		return this.getLastValue();
	}

}

ClassRegistry.register("com.jaamsim.CalculationObjects.UnitDelay", UnitDelay);
