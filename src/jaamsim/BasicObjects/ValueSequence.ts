/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2015 Ausenco Engineering Canada Inc.
 * Copyright (C) 2022-2024 JaamSim Software Inc.
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

// 多重定義の扱い: 出力の getNextSample(double simTime) と、SampleProvider の getNextSample(Entity, double) は、
// 最初の引数が数かどうかで見分ける（1 つの関数）。

import { Double } from "../java/lang.ts";
import type { JClass } from "../java/lang.ts";
import { ClassRegistry } from "../java/ClassRegistry.ts";
import { DisplayEntity } from "../Graphics/DisplayEntity.ts";
import type { SampleProvider } from "../Samples/SampleProvider.ts";
import { Entity } from "../basicsim/Entity.ts";
import { EventManager } from "../events/EventManager.ts";
import type { Input } from "../input/Input.ts";
import type { InputCallback } from "../input/InputCallback.ts";
import { defineOutput } from "../input/OutputRegistry.ts";
import { UnitTypeInput } from "../input/UnitTypeInput.ts";
import { ValueListInput } from "../input/ValueListInput.ts";
import { DimensionlessUnit } from "../units/DimensionlessUnit.ts";
import type { Unit } from "../units/Unit.ts";
import { UserSpecifiedUnit } from "../units/UserSpecifiedUnit.ts";

export class ValueSequence extends DisplayEntity implements SampleProvider {

	protected readonly unitType: UnitTypeInput;

	private readonly valueList: ValueListInput;

	private index = -1;

	static readonly unitTypeCallback: InputCallback = {
		callback(ent: Entity, inp: Input<unknown>): void {
			(ent as ValueSequence).updateUnitType();
		},
	};

	constructor() {
		super();

		// Java の初期化ブロック
		this.unitType = new UnitTypeInput("UnitType", Entity.KEY_INPUTS, UserSpecifiedUnit);
		this.setKeywordDoc(this.unitType, "The unit type for the generated values.",
		         ["DistanceUnit"]);
		this.unitType.setRequired(true);
		this.unitType.setCallback(ValueSequence.unitTypeCallback);
		this.addInput(this.unitType);

		this.valueList = new ValueListInput("ValueList", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.valueList, "The sequence of numbers to be generated. Note that the appropriate "
		                     + "unit for the numbers must be entered in the last position.",
		         ["10.2  12.4  7.2  m"]);
		this.valueList.setUnitType(UserSpecifiedUnit);
		this.valueList.setRequired(true);
		this.addInput(this.valueList);
	}

	override earlyInit(): void {
		super.earlyInit();
		this.index = -1;
	}

	updateUnitType(): void {
		this.valueList.setUnitType(this.getUnitType());
		this.updateUserOutputMap();
	}

	override getUserUnitType(): JClass<Unit> {
		return this.unitType.getUnitType();
	}

	getUnitType(): JClass<Unit> {
		return this.unitType.getUnitType();
	}

	getMeanValue(simTime: number): number {
		return this.valueList.getValue()!.sum()/this.valueList.getListSize();
	}

	getIndexOfSample(simTime: number): number {
		return this.index+1;
	}

	/**
	 * Java の出力 getNextSample(double simTime) と、SampleProvider の getNextSample(Entity thisEnt, double simTime)。
	 */
	getNextSample(thisEnt: Entity | number, simTime?: number): number {
		if (typeof thisEnt === "number")
			return this.getNextSample(this, thisEnt);

		if (this.valueList.getValue() === null)
			return Double.NaN;

		// If called from a model thread, increment the index to be selected
		if (EventManager.hasCurrent())
			this.index = (this.index + 1) % this.valueList.getListSize();

		// Trap an index that is out of range. Note that index can exceed the size of the list
		// if the ValueList keyword is edited in the middle of a run
		if (this.index < 0 || this.index >= this.valueList.getListSize())
			return Double.NaN;

		return this.valueList.getValue()!.get(this.index);
	}

}

ClassRegistry.register("com.jaamsim.BasicObjects.ValueSequence", ValueSequence);

defineOutput(ValueSequence, {
	name: "Index",
	description: "The position of the last value returned in the list.",
	unitType: DimensionlessUnit, reportable: false, sequence: 0,
	returnType: "int",
	get: (e, simTime) => e.getIndexOfSample(simTime),
});

defineOutput(ValueSequence, {
	name: "Value",
	description: "The last value returned from the sequence. When used in an "
	           + "expression, this output returns a new value every time the expression "
	           + "is evaluated.",
	unitType: UserSpecifiedUnit, reportable: false, sequence: 1,
	returnType: "double",
	get: (e, simTime) => e.getNextSample(simTime),
});
