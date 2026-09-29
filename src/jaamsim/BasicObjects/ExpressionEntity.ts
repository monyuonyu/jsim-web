/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2014 Ausenco Engineering Canada Inc.
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

import { Double } from "../internal.ts";
import type { JClass } from "../java/lang.ts";
import { ClassRegistry } from "../internal.ts";
import { DisplayEntity } from "../internal.ts";
import { SampleInput } from "../internal.ts";
import type { SampleProvider } from "../Samples/SampleProvider.ts";
import { Entity } from "../internal.ts";
import type { Input } from "../input/Input.ts";
import type { InputCallback } from "../input/InputCallback.ts";
import { defineOutput } from "../internal.ts";
import { UnitTypeInput } from "../internal.ts";
import type { Unit } from "../units/Unit.ts";
import { UserSpecifiedUnit } from "../internal.ts";

export class ExpressionEntity extends DisplayEntity implements SampleProvider {

	protected readonly unitType: UnitTypeInput;

	private readonly sampleValue: SampleInput;

	static readonly unitTypeInputCallback: InputCallback = {
		callback(ent: Entity, inp: Input<unknown>): void {
			(ent as ExpressionEntity).updateSampleUnitType();
		},
	};

	constructor() {
		super();

		// Java の初期化ブロック
		this.unitType = new UnitTypeInput("UnitType", Entity.KEY_INPUTS, UserSpecifiedUnit);
		this.setKeywordDoc(this.unitType, "The unit type for the returned expression values.",
		         ["DistanceUnit"]);
		this.unitType.setRequired(true);
		this.unitType.setCallback(ExpressionEntity.unitTypeInputCallback);
		this.addInput(this.unitType);

		this.sampleValue = new SampleInput("Expression", Entity.KEY_INPUTS, Double.NaN);
		this.setKeywordDoc(this.sampleValue, "The expression to be evaluated.",
		         ["'[Queue1].QueueLength + [Queue2].QueueLength'"]);
		this.sampleValue.setUnitType(UserSpecifiedUnit);
		this.sampleValue.setRequired(true);
		this.addInput(this.sampleValue);
	}

	updateSampleUnitType(): void {
		this.sampleValue.setUnitType(this.getUnitType());
		this.updateUserOutputMap();
	}

	override getUserUnitType(): JClass<Unit> {
		return this.unitType.getUnitType();
	}

	getUnitType(): JClass<Unit> {
		return this.unitType.getUnitType();
	}

	getMeanValue(simTime: number): number {
		return 0;
	}

	/**
	 * Java の出力 getNextSample(double simTime) と、SampleProvider の getNextSample(Entity thisEnt, double simTime)。
	 */
	getNextSample(thisEnt: Entity | number, simTime?: number): number {
		if (typeof thisEnt === "number")
			return this.getNextSample(this, thisEnt);

		return this.sampleValue.getNextSample(this, simTime!);
	}

}

ClassRegistry.register("com.jaamsim.BasicObjects.ExpressionEntity", ExpressionEntity);

defineOutput(ExpressionEntity, {
	name: "Value",
	description: "The present value for the expression.",
	unitType: UserSpecifiedUnit, reportable: true, sequence: 100,
	returnType: "double",
	get: (e, simTime) => e.getNextSample(simTime),
});
