/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2012 Ausenco Engineering Canada Inc.
 * Copyright (C) 2020-2026 JaamSim Software Inc.
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
import { jformat, jstr, Double } from "../internal.ts";
import type { JClass } from "../java/lang.ts";
import { ClassRegistry } from "../internal.ts";
import { tr } from "../internal.ts";
import type { Entity } from "../basicsim/Entity.ts";
import type { JaamSimModel } from "../basicsim/JaamSimModel.ts";
import { Vec3d } from "../internal.ts";
import { DimensionlessUnit } from "../internal.ts";
import { Unit } from "../internal.ts";
import { Input } from "../internal.ts";
import type { KeywordIndex } from "./KeywordIndex.ts";
import type { OutputReturnType } from "./OutputRegistry.ts";

export class Vec3dInput extends Input<Vec3d> {
	private unitType: JClass<Unit> = DimensionlessUnit;
	private minValue = Double.NEGATIVE_INFINITY;
	private maxValue = Double.POSITIVE_INFINITY;

	constructor(key: string, cat: string, def: Vec3d | null) {
		super(key, cat, def);
	}

	setUnitType(units: JClass<Unit>): void {
		this.unitType = units;
	}

	/** @throws InputErrorException */
	override parse(thisEnt: Entity, kw: KeywordIndex): void {
		const temp = Input.parseDoubles(thisEnt.getJaamSimModel(), kw, this.minValue, this.maxValue, this.unitType);
		Input.assertCountRange(temp, 1, 3);

		// pad the vector to have 3 elements
		while (temp.size() < 3) {
			temp.add(0.0);
		}

		this.value = new Vec3d(temp.get(0), temp.get(1), temp.get(2));
	}

	override getValidInputDesc(): string {
		if (this.unitType === DimensionlessUnit) {
			return tr(Input.VALID_VEC3D_DIMLESS);
		}
		return jformat(tr(Input.VALID_VEC3D), ClassRegistry.simpleName(this.unitType));
	}

	setValidRange(min: number, max: number): void {
		this.minValue = min;
		this.maxValue = max;
	}

	override getDefaultString(simModel: JaamSimModel | null): string {
		if (this.defValue === null)
			return "";

		const sm = simModel as JaamSimModel;  // Java は null なら NullPointerException
		const factor = sm.getDisplayedUnitFactor(this.unitType);

		let tmp = "";
		tmp += jstr(this.defValue.x/factor);
		tmp += Input.SEPARATOR;
		tmp += jstr(this.defValue.y/factor);
		tmp += Input.SEPARATOR;
		tmp += jstr(this.defValue.z/factor);
		if (this.unitType !== Unit) {
			tmp += Input.SEPARATOR;
			tmp += sm.getDisplayedUnit(this.unitType);
		}

		return tmp;
	}

	override getReturnType(): OutputReturnType | null {
		return "Vec3d";
	}

	override getUnitType(): JClass<Unit> | null {
		return this.unitType;
	}

}
