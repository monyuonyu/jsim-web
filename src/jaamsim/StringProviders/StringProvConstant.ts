/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2018-2022 JaamSim Software Inc.
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

// getNextString の多重定義は、引数の数と 3 つ目の引数の型で見分ける（StringProvider.ts を参照）。

import type { Entity } from "../basicsim/Entity.ts";
import { Double, jformat } from "../java/lang.ts";
import type { StringProvider } from "./StringProvider.ts";

export class StringProvConstant implements StringProvider {

	private readonly val: string;

	constructor(str: string) {
		this.val = str;
	}

	getNextString(thisEnt: Entity | null, simTime: number): string;
	getNextString(thisEnt: Entity | null, simTime: number, siFactor: number): string;
	getNextString(thisEnt: Entity | null, simTime: number, siFactor: number, integerValue: boolean): string;
	getNextString(thisEnt: Entity | null, simTime: number, fmt: string, siFactor: number): string;
	getNextString(thisEnt: Entity | null, simTime: number, a?: number | string, b?: number | boolean): string {
		// getNextString(Entity, double, String fmt, double siFactor)
		if (typeof a === "string") {
			const fmt = a;
			return jformat(fmt, this.val);
		}
		return this.val;
	}

	getNextValue(thisEnt: Entity | null, simTime: number): number {
		return Double.NaN;
	}

	toString(): string {
		return this.val;
	}

}
