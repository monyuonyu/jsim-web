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
import { ClassRegistry } from "../internal.ts";
import { tr } from "../internal.ts";
import { KeywordCommand } from "../internal.ts";
import { DisplayEntity } from "../internal.ts";
import { SampleConstant } from "../internal.ts";
import { SampleListInput } from "../internal.ts";
import type { SampleProvider } from "../Samples/SampleProvider.ts";
import { Entity } from "../internal.ts";
import type { Input } from "../input/Input.ts";
import type { InputCallback } from "../input/InputCallback.ts";
import { InputErrorException } from "../internal.ts";
import { KeywordIndex } from "../internal.ts";
import { defineOutput } from "../internal.ts";
import { UnitTypeInput } from "../internal.ts";
import { ValueListInput } from "../internal.ts";
import { DimensionlessUnit } from "../internal.ts";
import type { Unit } from "../units/Unit.ts";
import { UserSpecifiedUnit } from "../internal.ts";
import { DoubleCalculation } from "../internal.ts";

/**
 * The WeightedSum object returns a weighted sum of its input values.
 * @author Harry King
 *
 */
export class WeightedSum extends DisplayEntity implements SampleProvider {

	protected readonly unitType: UnitTypeInput;

	private readonly inputValueList: SampleListInput;

	private readonly coefficientList: ValueListInput;

	static readonly unitTypeInputCallback: InputCallback = {
		callback(ent: Entity, inp: Input<unknown>): void {
			(ent as WeightedSum).updateUnitTypeCallback();
		},
	};

	constructor() {
		super();

		// Java の初期化ブロック
		this.unitType = new UnitTypeInput("UnitType", Entity.KEY_INPUTS, UserSpecifiedUnit);
		this.setKeywordDoc(this.unitType, "The unit type for the inputs to the weighted sum and for the value "
		                     + "returned.",
		         ["DistanceUnit"]);
		this.unitType.setRequired(true);
		this.unitType.setCallback(WeightedSum.unitTypeInputCallback);
		this.addInput(this.unitType);

		const def: SampleProvider[] = [];
		def.push(new SampleConstant(0.0));
		this.inputValueList = new SampleListInput("InputValueList", Entity.KEY_INPUTS, def);
		this.setKeywordDoc(this.inputValueList, "The list of inputs to the weighted sum. All inputs must have the "
		                     + "same unit type.\n"
		                     + "The inputs can be any entity that returns a number, such as an "
		                     + "expression, a CalculationObject, a ProbabilityDistribution, or a "
		                     + "TimeSeries.",
		         ["{ 1 m } { TimeSeries1 } {'2[m] * [Queue1].QueueLength'}"]);
		this.inputValueList.setUnitType(UserSpecifiedUnit);
		this.addInput(this.inputValueList);

		this.coefficientList = new ValueListInput("CoefficientList", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.coefficientList, "The list of dimensionless coefficients to be applied to the input "
		                     + "values. If left blank, the input values are simply added without "
		                     + "applying any coefficients.",
		         ["2.0  1.5"]);
		this.coefficientList.setUnitType(DimensionlessUnit);
		this.addInput(this.coefficientList);
	}

	updateUnitTypeCallback(): void {
		this.inputValueList.setUnitType(this.unitType.getUnitType());
		this.updateUserOutputMap();
	}

	getUnitType(): JClass<Unit> | null {
		return this.unitType.getUnitType();
	}

	override getUserUnitType(): JClass<Unit> {
		return this.unitType.getUnitType() as JClass<Unit>;
	}

	override validate(): void {
		super.validate();

		// Confirm that the number of entries in the CoeffientList matches the EntityList
		if (this.coefficientList.getValue() !== null
				&& this.coefficientList.getListSize() !== this.inputValueList.getListSize()) {
			throw new InputErrorException(tr("If set, the number of entries for CoefficientList "
					+ "must match the entries for InputValueList"));
		}
	}

	/** getNextSample(double simTime)（出力 Value）と getNextSample(Entity thisEnt, double simTime) */
	getNextSample(simTime: number): number;
	getNextSample(thisEnt: Entity | null, simTime: number): number;
	getNextSample(a: Entity | null | number, b?: number): number {
		if (b === undefined)
			return this.getNextSample(this, a as number);
		const simTime = b;
		let val = 0.0;

		// Calculate the unweighted sum of the inputs
		if (this.coefficientList.getValue() === null) {
			for (let i = 0; i < this.inputValueList.getListSize(); i++) {
				val += this.inputValueList.getNextSample(i, this, simTime);
			}
		}

		// Calculate the weighted sum of the inputs
		else {
			for (let i = 0; i < this.inputValueList.getListSize(); i++) {
				val += this.coefficientList.getValue()!.get(i)
						* this.inputValueList.getNextSample(i, this, simTime);
			}
		}

		return val;
	}

	getMeanValue(simTime: number): number {
		return 0;
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

defineOutput(WeightedSum, {
	name: "Value",
	description: "The calculated value for the weighted sum.",
	unitType: UserSpecifiedUnit,
	returnType: "double",
	get: (e, simTime) => e.getNextSample(simTime),
});

ClassRegistry.register("com.jaamsim.CalculationObjects.WeightedSum", WeightedSum);
