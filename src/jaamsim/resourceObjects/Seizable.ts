/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2018 JaamSim Software Inc.
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

// Java の interface は、TS の interface と同じ名前の const の組にした。
// - `x instanceof Seizable` は、判定の関数 isSeizable(x) で行う（interface の関数がすべてあるか。ほかの担当の書き方に合わせた）。
//   const の Seizable も Symbol.hasInstance と isInstance を持つので、`x instanceof Seizable` と書いてもよく、
//   InterfaceEntityListInput・getDisplayModel などに interface の Class の代わりに渡せる。

import type { DisplayEntity } from "../Graphics/DisplayEntity.ts";
import type { ResourcePool } from "./ResourcePool.ts";

export interface Seizable {

	/**
	 * Returns the resource pool that contains this seizable resource unit.
	 * @return pool containing this resource unit
	 */
	getResourcePool(): ResourcePool | null;

	/**
	 * Tests whether this seizable resource unit can be assigned to the specified entity.
	 * @param ent - entity that would seize this unit
	 * @return true if this unit can be seized
	 */
	canSeize(ent: DisplayEntity): boolean;

	/**
	 * Assigns this unit to the specified entity.
	 * @param ent - entity that will seize this unit
	 */
	seize(ent: DisplayEntity): void;

	/**
	 * Unassigns this unit from its present assignee.
	 */
	release(): void;

	/**
	 * Returns the entity to which this unit is assigned.
	 * @return entity to which this unit is assigned
	 */
	getAssignment(): DisplayEntity | null;

	/**
	 * Returns the priority for this unit to be used by the ResourcePool when choosing the next
	 * unit to be seized.
	 * @param ent - entity that would seize this unit
	 * @return priority for this unit
	 */
	getPriority(ent: DisplayEntity): number;

	/**
	 * Returns the last time in clock ticks at which this unit was unassigned.
	 * @return last clock tick at which the unit was released
	 */
	getLastReleaseTicks(): number;

}

export const Seizable = {

	[Symbol.hasInstance](o: unknown): o is Seizable {
		return isSeizable(o);
	},

	/** o instanceof Seizable */
	isInstance(o: unknown): o is Seizable {
		return isSeizable(o);
	},
};

/** o instanceof Seizable の代わり（interface の関数がすべてあるか） */
export function isSeizable(o: unknown): o is Seizable {
	if (o === null || typeof o !== "object")
		return false;
	const r = o as Record<string, unknown>;
	for (const f of ["getResourcePool", "canSeize", "seize", "release", "getAssignment", "getPriority", "getLastReleaseTicks"])
		if (typeof r[f] !== "function")
			return false;
	return true;
}
