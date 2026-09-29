/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2011 Ausenco Engineering Canada Inc.
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
import { jformat, jstr, Double, Integer } from "../internal.ts";
import type { JClass } from "../java/lang.ts";
import { ClassRegistry } from "../internal.ts";
import { tr } from "../internal.ts";
import type { Entity } from "../basicsim/Entity.ts";
import type { JaamSimModel } from "../basicsim/JaamSimModel.ts";
import { Vec3d } from "../internal.ts";
import { DimensionlessUnit } from "../internal.ts";
import type { Unit } from "../units/Unit.ts";
import { ArrayListInput } from "../internal.ts";
import { Input } from "../internal.ts";
import { InputErrorException } from "../internal.ts";
import type { KeywordIndex } from "./KeywordIndex.ts";
import type { OutputReturnType } from "./OutputRegistry.ts";

export class Vec3dListInput extends ArrayListInput<Vec3d> {
	private unitType: JClass<Unit> = DimensionlessUnit;

	constructor(key: string, cat: string, def: Vec3d[] | null) {
		super(key, cat, def);
	}

	setUnitType(units: JClass<Unit>): void {
		this.unitType = units;
	}

	/** @throws InputErrorException */
	override parse(thisEnt: Entity, kw: KeywordIndex): void {

		// Check if number of outer lists violate minCount or maxCount
		const subArgs = kw.getSubArgs();
		if (subArgs.length < this.minCount || subArgs.length > this.maxCount) {
			if (this.maxCount === Integer.MAX_VALUE)
				throw new InputErrorException(tr(Input.INP_ERR_RANGECOUNTMIN), this.minCount, kw.argString());
			throw new InputErrorException(tr(Input.INP_ERR_RANGECOUNT), this.minCount, this.maxCount, kw.argString());
		}

		const tempValue: Vec3d[] = [];
		for (const subArg of subArgs) {
			const temp = Input.parseDoubles(thisEnt.getJaamSimModel(), subArg, Double.NEGATIVE_INFINITY, Double.POSITIVE_INFINITY, this.unitType);
			// pad the vector to have 3 elements
			while (temp.size() < 3) {
				temp.add(0.0);
			}

			tempValue.push(new Vec3d(temp.get(0), temp.get(1), temp.get(2)));
		}

		this.value = tempValue;
	}

	override getValidInputDesc(): string {
		return jformat(tr(Input.VALID_VEC3D_LIST), ClassRegistry.simpleName(this.unitType));
	}

	override getDefaultString(simModel: JaamSimModel | null): string {
		if (this.defValue === null || this.defValue.length === 0)
			return "";

		const sm = simModel as JaamSimModel;  // Java は null なら NullPointerException
		const factor = sm.getDisplayedUnitFactor(this.unitType);
		const unitStr = sm.getDisplayedUnit(this.unitType);

		let tmp = "";
		for (const each of this.defValue) {

			// blank space between elements
			if (tmp.length > 0)
				tmp += Input.BRACE_SEPARATOR;

			if (each === null) {
				tmp += "";
				continue;
			}

			tmp += "{";
			tmp += Input.BRACE_SEPARATOR;
			tmp += jstr(each.x/factor);
			tmp += Input.SEPARATOR;
			tmp += jstr(each.y/factor);
			tmp += Input.SEPARATOR;
			tmp += jstr(each.z/factor);
			if (unitStr.length !== 0) {
				tmp += Input.SEPARATOR;
				tmp += unitStr;
			}
			tmp += Input.BRACE_SEPARATOR;
			tmp += "}";
		}
		return tmp;
	}

	override getReturnType(): OutputReturnType | null {
		return "ArrayList";
	}

	override getUnitType(): JClass<Unit> | null {
		return this.unitType;
	}

}
