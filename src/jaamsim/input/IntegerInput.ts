/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2010-2011 Ausenco Engineering Canada Inc.
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
import type { Entity } from "../basicsim/Entity.ts";
import type { JaamSimModel } from "../basicsim/JaamSimModel.ts";
import { tr } from "../i18n/I18n.ts";
import { Integer } from "../java/lang.ts";
import type { JClass } from "../java/lang.ts";
import { DimensionlessUnit } from "../units/DimensionlessUnit.ts";
import type { Unit } from "../units/Unit.ts";
import { Input } from "./Input.ts";
import type { KeywordIndex } from "./KeywordIndex.ts";
import type { OutputReturnType } from "./OutputRegistry.ts";

export class IntegerInput extends Input<number> {
	private minValue = Integer.MIN_VALUE;
	private maxValue = Integer.MAX_VALUE;

	constructor(key: string, cat: string, def: number | null) {
		super(key, cat, def);
	}

	/** @throws InputErrorException */
	override parse(thisEnt: Entity, kw: KeywordIndex): void {
		Input.assertCount(kw, 1);
		this.value = Input.parseInteger(kw.getArg(0), this.minValue, this.maxValue);
	}

	override getValidInputDesc(): string {
		return tr(Input.VALID_INTEGER);
	}

	setValidRange(min: number, max: number): void {
		this.minValue = min;
		this.maxValue = max;
	}

	override getDefaultString(simModel: JaamSimModel | null): string {
		if (this.defValue === null)
			return "";

		if (this.defValue === Integer.MAX_VALUE)
			return Input.POSITIVE_INFINITY;

		if (this.defValue === Integer.MIN_VALUE)
			return Input.NEGATIVE_INFINITY;

		const tmp = String(this.defValue);

		return tmp;
	}

	override getReturnType(): OutputReturnType | null {
		return "int";
	}

	override getUnitType(): JClass<Unit> | null {
		return DimensionlessUnit;
	}

	override isIntegerValue(): boolean {
		return true;
	}
}
