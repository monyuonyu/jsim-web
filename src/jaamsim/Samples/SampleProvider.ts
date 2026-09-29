/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2013 Ausenco Engineering Canada Inc.
 * Copyright (C) 2022-2023 JaamSim Software Inc.
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

// Java の interface SampleProvider は、TS の interface と同じ名前の const の組にした。
// - `x instanceof SampleProvider` は isSampleProvider(x)（getNextSample・getMeanValue・getUnitType の関数があるか）
// - Java の static 関数 addQuotesIfNeeded は const SampleProvider.addQuotesIfNeeded

import type { Entity } from "../basicsim/Entity.ts";
import { Input } from "../input/Input.ts";
import { Parser } from "../input/Parser.ts";
import type { Unit } from "../units/Unit.ts";
import type { JClass } from "../java/lang.ts";

export interface SampleProvider {
	getUnitType(): JClass<Unit> | null;
	/** thisEnt は Java と同じく null のこともある（SampleListInput.getConstantValues など）。実装する側の型に合わせて Entity と書いた */
	getNextSample(thisEnt: Entity, simTime: number): number;
	getMeanValue(simTime: number): number;
}

/** Java の `o instanceof SampleProvider` */
export function isSampleProvider(o: unknown): o is SampleProvider {
	if (o === null || typeof o !== "object")
		return false;
	const r = o as Record<string, unknown>;
	return typeof r.getNextSample === "function"
		&& typeof r.getMeanValue === "function"
		&& typeof r.getUnitType === "function";
}

export const SampleProvider = {

	addQuotesIfNeeded(str: string): string {

		// No changes required if the input is a number and unit
		const tokens: string[] = [];
		Parser.tokenize(tokens, str, true);
		if (tokens.length === 2 && Input.isDouble(tokens[0]))
			return str;

		return Parser.addQuotesIfNeeded(str);
	},
};
