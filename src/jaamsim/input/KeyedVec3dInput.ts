/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2013 Ausenco Engineering Canada Inc.
 * Copyright (C) 2021-2026 JaamSim Software Inc.
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
 *
 * TypeScript への移植 (C) 2026 shota
 */
// 注（多重定義）: getValue() と getValue(thisEnt, simTime, klass) は、引数の数で見分ける（Input.ts と同じ）。
import { Double } from "../internal.ts";
import type { JClass } from "../java/lang.ts";
import { tr } from "../internal.ts";
import type { Entity } from "../basicsim/Entity.ts";
import type { JaamSimModel } from "../basicsim/JaamSimModel.ts";
import { Vec3d } from "../internal.ts";
import { DimensionlessUnit } from "../internal.ts";
import { TimeUnit } from "../internal.ts";
import type { Unit } from "../units/Unit.ts";
import { Input, javaToString } from "../internal.ts";
import { InputErrorException } from "../internal.ts";
import { KeyedVec3dCurve } from "../internal.ts";
import { KeywordIndex } from "../internal.ts";
import type { OutputReturnType } from "./OutputRegistry.ts";

export class KeyedVec3dInput extends Input<KeyedVec3dCurve> {
	private unitType: JClass<Unit> = DimensionlessUnit;
	private sphericalInterpolation = false;

	constructor(key: string, cat: string) {
		super(key, cat, null);
	}

	setUnitType(units: JClass<Unit>): void {
		this.unitType = units;
	}

	setSphericalInterpolation(bool: boolean): void {
		this.sphericalInterpolation = bool;
	}

	/** @throws InputErrorException */
	override parse(thisEnt: Entity, kw: KeywordIndex): void {
		const temp = new KeyedVec3dCurve();
		const strings: string[] = [];
		for (let i = 0; i < kw.numArgs(); i++) {
			strings.push(kw.getArg(i));
		}
		const keys = Input.splitForNestedBraces(strings);
		for (const key of keys) {
			this.parseKey(thisEnt.getJaamSimModel(), key, temp);
		}
		this.value = temp;
	}

	/** @throws InputErrorException */
	private parseKey(simModel: JaamSimModel, key: string[], temp: KeyedVec3dCurve): void {
		if (key.length <= 2 || key[0] !== "{" || key[key.length-1] !== "}") {
			throw new InputErrorException(tr("Malformed key entry: %s"), javaToString(key));
		}

		const keyEntries = Input.splitForNestedBraces(key.slice(1, key.length-1));
		if (keyEntries.length !== 2) {
			throw new InputErrorException(tr("Expected two values in keyed input for key entry: %s"), javaToString(key));
		}
		const timeInput = keyEntries[0];
		const valInput = keyEntries[1];

		// Validate
		if (timeInput.length !== 4 || timeInput[0] !== "{" || timeInput[timeInput.length-1] !== "}") {
			throw new InputErrorException(tr("Time entry not formated correctly: %s"), javaToString(timeInput));
		}
		if (valInput.length !== 6 || valInput[0] !== "{" || valInput[valInput.length-1] !== "}") {
			throw new InputErrorException(tr("Value entry not formated correctly: %s"), javaToString(valInput));
		}

		const timeKw = new KeywordIndex("", timeInput, 1, 3, null);
		const time = Input.parseDoubles(simModel, timeKw, 0.0, Double.POSITIVE_INFINITY, TimeUnit);

		const valKw = new KeywordIndex("", valInput, 1, 5, null);
		const vals = Input.parseDoubles(simModel, valKw, Double.NEGATIVE_INFINITY, Double.POSITIVE_INFINITY, this.unitType);

		const val = new Vec3d(vals.get(0), vals.get(1), vals.get(2));
		temp.addKey(time.get(0), val);
	}

	getValueForTime(time: number): Vec3d | null {
		const arg = this.sphericalInterpolation ? 1 : 0;
		// Java は getValue() が null なら NullPointerException
		return (this.getValue() as KeyedVec3dCurve).getValAtTime(time, arg);
	}

	hasKeys(): boolean {
		const val = this.getValue();
		return val !== null && val.hasKeys();
	}

	override getValue(): KeyedVec3dCurve | null;
	override getValue<V>(thisEnt: Entity, simTime: number, klass: JClass<V> | OutputReturnType | null): V | null;
	override getValue(thisEnt?: Entity, simTime?: number, klass?: unknown): unknown {
		if (thisEnt === undefined)
			return super.getValue();
		if (this.getValue() === null)
			return null;
		return this.getValueForTime(simTime as number);
	}

	override getReturnType(): OutputReturnType | null {
		return "Vec3d";
	}

	override getUnitType(): JClass<Unit> | null {
		return this.unitType;
	}

}
