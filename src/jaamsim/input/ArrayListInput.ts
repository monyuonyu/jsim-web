/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2022-2023 JaamSim Software Inc.
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
import type { JaamSimModel } from "../basicsim/JaamSimModel.ts";
import { javaToString } from "../internal.ts";
import { ListInput } from "../internal.ts";

export abstract class ArrayListInput<T> extends ListInput<T[]> {

	constructor(key: string, cat: string, def: T[] | null) {
		super(key, cat, def);
	}

	override getListSize(): number {
		const val = this.getValue();
		if (val === null)
			return 0;
		else
			return val.length;
	}

	override getDefaultString(simModel: JaamSimModel | null): string {
		if (this.defValue === null || this.defValue.length === 0)
			return "";

		return javaToString(this.defValue, this.isIntegerValue());
	}

}
