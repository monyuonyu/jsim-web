/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2018-2021 JaamSim Software Inc.
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

import { ClassRegistry } from "../internal.ts";
import { jformat } from "../internal.ts";
import { type JClass } from "../java/lang.ts";
import type { Unit } from "../units/Unit.ts";

export class PassThroughData {

	private readonly name: string;
	private readonly unitType: JClass<Unit>;

	constructor(nm: string, ut: JClass<Unit>) {
		this.name = nm;
		this.unitType = ut;
	}

	getName(): string {
		return this.name;
	}

	getUnitType(): JClass<Unit> {
		return this.unitType;
	}

	equals(obj: unknown): boolean {
		if (obj == null)
			return false;

		if (!(obj instanceof PassThroughData))
			return false;

		const data = obj;
		return this.name === data.name && this.unitType === data.unitType;
	}

	toString(): string {
		return jformat("(%s, %s)", this.name, ClassRegistry.simpleName(this.unitType));
	}

}
