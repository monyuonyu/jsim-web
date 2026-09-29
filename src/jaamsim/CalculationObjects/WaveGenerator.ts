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
import { Double } from "../internal.ts";
import { ClassRegistry } from "../internal.ts";
import { KeywordCommand } from "../internal.ts";
import { DisplayEntity } from "../internal.ts";
import { SampleInput } from "../internal.ts";
import type { SampleProvider } from "../Samples/SampleProvider.ts";
import { Entity } from "../internal.ts";
import type { Input } from "../input/Input.ts";
import type { InputCallback } from "../input/InputCallback.ts";
import { KeywordIndex } from "../internal.ts";
import { defineOutput } from "../internal.ts";
import { UnitTypeInput } from "../internal.ts";
import { AngleUnit } from "../internal.ts";
import { TimeUnit } from "../internal.ts";
import type { Unit } from "../units/Unit.ts";
import { UserSpecifiedUnit } from "../internal.ts";
import { DoubleCalculation } from "../internal.ts";

/**
 * Super-class for wave generators that produce either sine or square waves.
 * @author Harry King
 *
 */
export abstract class WaveGenerator extends DisplayEntity implements SampleProvider {

	readonly unitType: UnitTypeInput;

	private readonly amplitude: SampleInput;

	private readonly period: SampleInput;

	private readonly phaseAngle: SampleInput;

	private readonly offset: SampleInput;

	static readonly unitTypeInputCallback: InputCallback = {
		callback(ent: Entity, inp: Input<unknown>): void {
			(ent as WaveGenerator).updateUnitType();
		},
	};

	constructor() {
		super();

		// Java の初期化ブロック
		this.unitType = new UnitTypeInput("UnitType", Entity.KEY_INPUTS, UserSpecifiedUnit);
		this.setKeywordDoc(this.unitType, "The unit type for the value returned by the wave.",
		         ["DistanceUnit"]);
		this.unitType.setRequired(true);
		this.unitType.setCallback(WaveGenerator.unitTypeInputCallback);
		this.addInput(this.unitType);

		this.amplitude = new SampleInput("Amplitude", Entity.KEY_INPUTS, 1.0);
		this.setKeywordDoc(this.amplitude, "Amplitude of the generated wave.",
		         ["2.0"]);
		this.amplitude.setValidRange(0.0, Double.POSITIVE_INFINITY);
		this.amplitude.setUnitType(UserSpecifiedUnit);
		this.addInput(this.amplitude);

		this.period = new SampleInput("Period", Entity.KEY_INPUTS, 1.0);
		this.setKeywordDoc(this.period, "Period of the generated wave.",
		         ["2 s"]);
		this.period.setUnitType(TimeUnit);
		this.period.setValidRange(0.0, Double.POSITIVE_INFINITY);
		this.addInput(this.period);

		this.phaseAngle = new SampleInput("PhaseAngle", Entity.KEY_INPUTS, 0.0);
		this.setKeywordDoc(this.phaseAngle, "Initial phase angle of the generated wave.",
		         ["45 deg"]);
		this.phaseAngle.setUnitType(AngleUnit);
		this.addInput(this.phaseAngle);

		this.offset = new SampleInput("Offset", Entity.KEY_INPUTS, 0.0);
		this.setKeywordDoc(this.offset, "Offset added to the output of the generated wave.",
		         ["2.0"]);
		this.offset.setUnitType(UserSpecifiedUnit);
		this.addInput(this.offset);
	}

	updateUnitType(): void {
		this.amplitude.setUnitType(this.unitType.getUnitType() as JClass<Unit>);
		this.offset.setUnitType(this.unitType.getUnitType() as JClass<Unit>);
		this.updateUserOutputMap();
	}

	getUnitType(): JClass<Unit> | null {
		return this.unitType.getUnitType();
	}

	override getUserUnitType(): JClass<Unit> {
		return this.unitType.getUnitType() as JClass<Unit>;
	}

	/*
	 * Calculate the current dimensionless signal for the wave.
	 */
	protected abstract getSignal(angle: number): number;

	/** getNextSample(double simTime)（出力 Value）と getNextSample(Entity thisEnt, double simTime) */
	getNextSample(simTime: number): number;
	getNextSample(thisEnt: Entity | null, simTime: number): number;
	getNextSample(a: Entity | null | number, b?: number): number {
		if (b === undefined)
			return this.getNextSample(this, a as number);
		const simTime = b;

		// Calculate the present phase angle
		const angle = 2.0*Math.PI * simTime/this.period.getNextSample(this, simTime)
				+ this.phaseAngle.getNextSample(this, simTime);

		// Set the output value for the wave
		return this.amplitude.getNextSample(this, simTime) * this.getSignal(angle)
				+ this.offset.getNextSample(this, simTime);
	}

	getMeanValue(simTime: number): number {
		return this.offset.getNextSample(this, simTime);
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

defineOutput(WaveGenerator, {
	name: "Value",
	description: "The present value for the wave.",
	unitType: UserSpecifiedUnit,
	returnType: "double",
	get: (e, simTime) => e.getNextSample(simTime),
});
