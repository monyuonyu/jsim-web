/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2013 Ausenco Engineering Canada Inc.
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
import type { Entity } from "../basicsim/Entity.ts";
import type { JaamSimModel } from "../basicsim/JaamSimModel.ts";
import { tr } from "../i18n/I18n.ts";
import { ClassRegistry } from "../java/ClassRegistry.ts";
import { Double, jformat, jstr } from "../java/lang.ts";
import type { JClass } from "../java/lang.ts";
import { DimensionlessUnit } from "../units/DimensionlessUnit.ts";
import { Unit } from "../units/Unit.ts";
import { UserSpecifiedUnit } from "../units/UserSpecifiedUnit.ts";
import { Input } from "./Input.ts";
import type { KeywordIndex } from "./KeywordIndex.ts";
import type { OutputReturnType } from "./OutputRegistry.ts";

export class ValueInput extends Input<number> {
	private unitType: JClass<Unit> = DimensionlessUnit;
	private minValue = Double.NEGATIVE_INFINITY;
	private maxValue = Double.POSITIVE_INFINITY;

	constructor(key: string, cat: string, def: number | null) {
		super(key, cat, def);
	}

	setUnitType(units: JClass<Unit>): void {

		if (units === this.unitType)
			return;

		if (!this.isDef)
			this.setValid(false);
		this.unitType = units;
	}

	/** @throws InputErrorException */
	override parse(thisEnt: Entity, kw: KeywordIndex): void {
		const temp = Input.parseDoubles(thisEnt.getJaamSimModel(), kw, this.minValue, this.maxValue, this.unitType);
		Input.assertCount(temp, 1);
		this.value = temp.get(0);
		this.setValid(true);
	}

	setValidRange(min: number, max: number): void {
		this.minValue = min;
		this.maxValue = max;
	}

	override getValidInputDesc(): string {
		if (this.unitType === UserSpecifiedUnit) {
			return tr(Input.VALID_VALUE_UNIT);
		}
		if (this.unitType === DimensionlessUnit) {
			return tr(Input.VALID_VALUE_DIMLESS);
		}
		return jformat(tr(Input.VALID_VALUE), ClassRegistry.simpleName(this.unitType));
	}

	override getDefaultString(simModel: JaamSimModel | null): string {
		if (this.defValue === null)
			return "";

		// Java では simModel が null なら NullPointerException
		const sm = simModel as JaamSimModel;
		let tmp = "";
		if (this.defValue === Double.POSITIVE_INFINITY) {
			tmp += Input.POSITIVE_INFINITY;
		}
		else if (this.defValue === Double.NEGATIVE_INFINITY) {
			tmp += Input.NEGATIVE_INFINITY;
		}
		else {
			tmp += jstr(this.defValue/sm.getDisplayedUnitFactor(this.unitType));
		}

		if (this.unitType !== Unit) {
			tmp += Input.SEPARATOR;
			tmp += sm.getDisplayedUnit(this.unitType);
		}

		return tmp;
	}

	override getReturnType(): OutputReturnType | null {
		return "double";
	}

	override getUnitType(): JClass<Unit> | null {
		return this.unitType;
	}
}
