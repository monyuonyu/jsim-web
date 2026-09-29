/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2010-2011 Ausenco Engineering Canada Inc.
 * Copyright (C) 2021-2022 JaamSim Software Inc.
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
import type { BooleanVector } from "../datatypes/BooleanVector.ts";
import { Input } from "../internal.ts";
import type { KeywordIndex } from "./KeywordIndex.ts";
import { ListInput } from "../internal.ts";

export class BooleanListInput extends ListInput<BooleanVector> {

	constructor(key: string, cat: string, def: BooleanVector | null) {
		super(key, cat, def);
	}

	/** @throws InputErrorException */
	override parse(thisEnt: Entity, kw: KeywordIndex): void {
		Input.assertCountRange(kw, this.minCount, this.maxCount);
		this.value = Input.parseBooleanVector(kw);
	}

	override getListSize(): number {
		const val = this.getValue();
		if (val === null)
			return 0;
		else
			return val.size();
	}

	override getDefaultString(simModel: JaamSimModel | null): string {
		if (this.defValue === null || this.defValue.size() === 0)
			return "";

		let tmp = "";
		for (let i = 0; i < this.defValue.size(); i++) {
			if (i > 0) tmp += Input.SEPARATOR;

			if (this.defValue.get(i))
				tmp += "TRUE";
			else
				tmp += "FALSE";
		}
		return tmp;
	}
}
