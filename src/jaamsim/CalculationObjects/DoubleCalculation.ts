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

// getNextSample(double)（出力 Value、final）と getNextSample(Entity, double) は、引数の数で見分ける 1 つの関数にした
// （子で上書きするときも、両方の形を受ける）。

import type { JClass } from "../java/lang.ts";
import { KeywordCommand } from "../Commands/KeywordCommand.ts";
import type { DisplayEntity } from "../Graphics/DisplayEntity.ts";
import { SampleInput } from "../Samples/SampleInput.ts";
import type { SampleProvider } from "../Samples/SampleProvider.ts";
import { ClassRegistry } from "../java/ClassRegistry.ts";
import { Entity } from "../basicsim/Entity.ts";
import type { Input } from "../input/Input.ts";
import type { InputCallback } from "../input/InputCallback.ts";
import { KeywordIndex } from "../input/KeywordIndex.ts";
import { defineOutput } from "../input/OutputRegistry.ts";
import { UnitTypeInput } from "../input/UnitTypeInput.ts";
import type { Unit } from "../units/Unit.ts";
import { UserSpecifiedUnit } from "../units/UserSpecifiedUnit.ts";
import { CalculationEntity } from "./CalculationEntity.ts";

/**
 * DoubleCalculation is the super-class for all calculations that return a double.
 * @author Harry King
 *
 */
export abstract class DoubleCalculation extends CalculationEntity
implements SampleProvider {

	readonly unitType: UnitTypeInput;

	readonly inputValue: SampleInput;

	private lastUpdateTime = 0;  // The time at which the last update was performed
	private lastInputValue = 0;  // Input to this object evaluated at the last update time
	private lastValue = 0;       // Output from this object evaluated at the last update time

	static readonly unitTypeInputCallback: InputCallback = {
		callback(ent: Entity, inp: Input<unknown>): void {
			(ent as DoubleCalculation).updateUnitType();
		},
	};

	constructor() {
		super();

		// Java の初期化ブロック
		this.unitType = new UnitTypeInput("UnitType", Entity.KEY_INPUTS, UserSpecifiedUnit);
		this.setKeywordDoc(this.unitType, "The unit type for the input value(s) to the calculation.",
		         ["DistanceUnit"]);
		this.unitType.setRequired(true);
		this.unitType.setCallback(DoubleCalculation.unitTypeInputCallback);
		this.addInput(this.unitType);

		this.inputValue = new SampleInput("InputValue", Entity.KEY_INPUTS, 0.0);
		this.setKeywordDoc(this.inputValue, "The input value for the present calculation.",
		         ["1.5", "TimeSeries1", "'3 + 2*[Queue1].QueueLength'"]);
		this.inputValue.setUnitType(UserSpecifiedUnit);
		this.addInput(this.inputValue);
	}

	updateUnitType(): void {
		this.setUnitType(this.unitType.getUnitType() as JClass<Unit>);
		this.updateUserOutputMap();
	}

	protected setUnitType(ut: JClass<Unit>): void {
		this.inputValue.setUnitType(ut);
	}

	getUnitType(): JClass<Unit> | null {
		return this.unitType.getUnitType();
	}

	override getUserUnitType(): JClass<Unit> {
		return this.unitType.getUnitType() as JClass<Unit>;
	}

	override earlyInit(): void {
		super.earlyInit();
		this.lastUpdateTime = 0.0;
		this.lastValue = this.getInitialValue();
	}

	override lateInit(): void {
		super.lateInit();
		this.lastInputValue = this.getInputValue(0.0);
	}

	getInitialValue(): number {
		return 0.0;
	}

	/**
	 * Returns the value for the input to this calculation object at the
	 * specified simulation time.
	 * @param simTime - specified simulation time.
	 * @return input value to this calculation object.
	 */
	getInputValue(simTime: number): number {
		return this.inputValue.getNextSample(this, simTime);
	}

	/*
	 * Return the stored value for this calculation.
	 */
	getLastValue(): number {
		return this.lastValue;
	}

	/**
	 * Returns the output value at the specified simulation time.
	 * <p>
	 * This method returns an output value that varies smoothly between the
	 * values stored at each update.
	 * @param simTime - specified simulation time.
	 * @param inputVal - input value at the specified simulation time.
	 * @param lastTime - simulation time when the most recent update was performed.
	 * @param lastInputVal - input value when the most recent update was performed.
	 * @param lastVal - output value when the moset recent update was performed.
	 * @return output value at the specified simulation time.
	 */
	protected abstract calculateValue(simTime: number, inputVal: number, lastTime: number, lastInputVal: number, lastVal: number): number;

	override update(simTime: number): void {

		// Calculate the new input value to the calculation
		const inputVal = this.getInputValue(simTime);

		// Calculate the new output value
		const newValue = this.calculateValue(simTime, inputVal, this.lastUpdateTime, this.lastInputValue, this.lastValue);

		// Store the new input and output values
		this.lastUpdateTime = simTime;
		this.lastInputValue = inputVal;
		this.lastValue = newValue;
	}

	/** getNextSample(double simTime)（出力 Value）と getNextSample(Entity thisEnt, double simTime) */
	getNextSample(simTime: number): number;
	getNextSample(thisEnt: Entity | null, simTime: number): number;
	getNextSample(a: Entity | null | number, b?: number): number {
		if (b === undefined)
			return this.getNextSample(this, a as number);
		const simTime = b;

		// Calculate the new input value to the calculation
		const inputVal = this.getInputValue(simTime);

		// Return the new output value
		return this.calculateValue(simTime, inputVal, this.lastUpdateTime, this.lastInputValue, this.lastValue);
	}

	getMeanValue(simTime: number): number {
		return this.lastValue;
	}

	override canLink(dir: boolean): boolean {
		// UnitType input must be set or hidden
		return dir && (!this.unitType.isDefault() || this.unitType.getHidden());
	}

	override linkTo(nextEnt: DisplayEntity, dir: boolean): void {
		if (!dir || !(nextEnt instanceof DoubleCalculation))
			return;

		const kwList: KeywordIndex[] = [];
		const nextCalc = nextEnt;

		// Set the Controller for the next object
		if (!nextCalc.controller.getHidden()
				&& !this.controller.getHidden() && !this.controller.isDefault()) {
			const key = this.controller.getKeyword();
			kwList.push( KeywordIndex.formatArgs(key, this.controller.getValue()!.getName()) );
		}

		// Set the UnitType input for the next object
		if (!nextCalc.unitType.getHidden()
				&& !this.unitType.getHidden() && !this.unitType.isDefault()) {
			const key = this.unitType.getKeyword();
			kwList.push( KeywordIndex.formatArgs(key, ClassRegistry.simpleName(this.getUnitType()!)) );
		}

		// Set the InputValue input for the next object
		if (!nextCalc.inputValue.getHidden()) {
			const key = nextCalc.inputValue.getKeyword();
			kwList.push( KeywordIndex.formatArgs(key, this.getName()) );
		}

		if (kwList.length === 0)
			return;

		this.getJaamSimModel().storeAndExecute(new KeywordCommand(nextCalc, ...kwList));
	}

}

defineOutput(DoubleCalculation, {
	name: "Value",
	description: "The result of the calculation at the present time.",
	unitType: UserSpecifiedUnit,
	returnType: "double",
	get: (e, simTime) => e.getNextSample(simTime),
});
