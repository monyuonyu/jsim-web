/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2018-2023 JaamSim Software Inc.
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

import type { Entity } from "../basicsim/Entity.ts";
import { tr } from "../internal.ts";
import { ArrayListInput } from "../internal.ts";
import { Input } from "../internal.ts";
import { InputErrorException } from "../internal.ts";
import type { KeywordIndex } from "../input/KeywordIndex.ts";
import type { JClass } from "../java/lang.ts";
import { DimensionlessUnit } from "../internal.ts";
import type { Unit } from "../units/Unit.ts";
import { PassThroughData } from "../internal.ts";

export class PassThroughListInput extends ArrayListInput<PassThroughData> {

	constructor(key: string, cat: string, def: PassThroughData[] | null) {
		super(key, cat, def);
	}

	/** @throws InputErrorException */
	override parse(thisEnt: Entity, kw: KeywordIndex): void {
		// Divide up the inputs by the inner braces
		const subArgs = kw.getSubArgs();
		const temp: PassThroughData[] = [];

		// Parse the inputs within each inner brace
		for (let i = 0; i < subArgs.length; i++) {
			const subArg = subArgs[i];
			Input.assertCount(subArg, 1, 2);
			try {
				// Fist entry is the name of the keyword/output
				const name = subArg.getArg(0);

				// Second entry if present is the unit type
				let unitType: JClass<Unit> = DimensionlessUnit;
				if (subArg.numArgs() === 2) {
					unitType = Input.parseUnitType(thisEnt.getJaamSimModel(), subArg.getArg(1));
				}
				temp.push(new PassThroughData(name, unitType));
			}
			catch (e) {
				if (!(e instanceof InputErrorException)) throw e;
				throw new InputErrorException(tr(Input.INP_ERR_ELEMENT), i+1, e.getMessage());
			}
		}
		this.value = temp;
	}

	override getValidInputDesc(): string {
		return tr(Input.VALID_PASSTHROUGH);
	}

	override useExpressionBuilder(): boolean {
		return true;
	}

}
