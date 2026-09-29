/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2015 Ausenco Engineering Canada Inc.
 * Copyright (C) 2026 JaamSim Software Inc.
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

import type { JClass } from "../java/lang.ts";
import { tr } from "../internal.ts";
import type { Entity } from "../basicsim/Entity.ts";
import type { DoubleVector } from "../datatypes/DoubleVector.ts";
import { Input } from "../internal.ts";
import { InputErrorException } from "../internal.ts";
import type { KeywordIndex } from "../input/KeywordIndex.ts";
import type { OutputReturnType } from "../input/OutputRegistry.ts";
import { DimensionlessUnit } from "../internal.ts";
import type { Unit } from "../units/Unit.ts";

export class CumulativeProbInput extends Input<DoubleVector> {
	constructor(key: string, cat: string, def: DoubleVector | null) {
		super(key, cat, def);
	}

	override parse(thisEnt: Entity, kw: KeywordIndex): void {
		const temp: DoubleVector = Input.parseDoubles(thisEnt.getJaamSimModel(), kw, 0.0, 1.0, DimensionlessUnit);
		if (temp.get(0) !== 0.0)
			throw new InputErrorException(tr("The first value of a cumulative probability list must be 0.0, got %f"), temp.get(0));

		if (temp.get(temp.size() - 1) !== 1.0)
			throw new InputErrorException(tr("The last value of a cumulative probability list must be 1.0, got %f"), temp.get(temp.size() - 1));

		for (let i = 1; i < temp.size(); i++) {
			if (temp.get(i - 1) > temp.get(i))
				throw new InputErrorException(tr("The values of a cumulative probability list must be strictly increasing"));
		}

		this.value = temp;
	}

	// Java は DoubleVector.class を返す。Input の取り決め（OutputReturnType の文字列）に合わせた
	override getReturnType(): OutputReturnType | null {
		return "DoubleVector";
	}

	override getUnitType(): JClass<Unit> {
		return DimensionlessUnit;
	}

}
