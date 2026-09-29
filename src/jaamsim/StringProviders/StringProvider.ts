/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2015 Ausenco Engineering Canada Inc.
 * Copyright (C) 2017-2022 JaamSim Software Inc.
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

// Java の interface StringProvider は TS の interface にした。
// getNextString の 4 つの多重定義は、引数の数と 3 つ目の引数の型（number か string か）で見分ける。
// `x instanceof StringProvider` は isStringProvider(x)
// （getNextString・getNextValue の関数があり、Input ではない（getKeyword が無い）もの。
//   StringProvInput も getNextString・getNextValue を持つが StringProvider ではないため）。

import type { Entity } from "../basicsim/Entity.ts";

export interface StringProvider {

	getNextString(thisEnt: Entity | null, simTime: number): string;
	getNextString(thisEnt: Entity | null, simTime: number, siFactor: number): string;
	getNextString(thisEnt: Entity | null, simTime: number, siFactor: number, bool: boolean): string;

	getNextString(thisEnt: Entity | null, simTime: number, fmt: string, siFactor: number): string;

	getNextValue(thisEnt: Entity | null, simTime: number): number;
}

/** Java の `o instanceof StringProvider` */
export function isStringProvider(o: unknown): o is StringProvider {
	if (o === null || typeof o !== "object")
		return false;
	const r = o as Record<string, unknown>;
	return typeof r.getNextString === "function"
		&& typeof r.getNextValue === "function"
		&& typeof r.getKeyword !== "function";
}
