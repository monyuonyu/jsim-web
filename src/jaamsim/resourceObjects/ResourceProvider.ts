/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2018-2024 JaamSim Software Inc.
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
// - `x instanceof ResourceProvider` は、判定の関数 isResourceProvider(x) で行う（interface の関数がすべてあるか。ほかの担当の書き方に合わせた）。
//   const の ResourceProvider も Symbol.hasInstance と isInstance を持つので、`x instanceof ResourceProvider` と書いてもよく、
//   InterfaceEntityListInput・getDisplayModel などに interface の Class の代わりに渡せる。
// - Java の static 関数 getUserList(pool) は const の関数

import type { DisplayEntity } from "../Graphics/DisplayEntity.ts";
import { Entity } from "../internal.ts";
import type { JaamSimModel } from "../basicsim/JaamSimModel.ts";
import { isResourceUser } from "../internal.ts";
import { type ResourceUser } from "./ResourceUser.ts";

export interface ResourceProvider {

	/**
	 * Tests whether the specified number of resource units are available to be assigned to the
	 * specified entity.
	 * @param simTime - present simulation time
	 * @param n - number of resource units to seize
	 * @param ent - entity that would seize the units
	 * @return true if the units can be seized
	 */
	canSeize(simTime: number, n: number, ent: DisplayEntity): boolean;

	/**
	 * Assigns the specified number of resource units to the specified entity.
	 * @param n - number of resource units to assign
	 * @param ent - entity seizing the units
	 */
	seize(n: number, ent: DisplayEntity): void;

	/**
	 * Unassigns the specified number of resource units from the specified entity.
	 * If the number of units assigned to the entity is less than the specified number to release,
	 * then as many units are released as possible.
	 * @param n - number of resource units to release
	 * @param ent - entity releasing the units
	 */
	release(n: number, ent: DisplayEntity): void;

	/**
	 * Returns a list of objects that can seize this resource for use by an entity.
	 * @return users that can seize this resource
	 */
	getUserList(): ResourceUser[];

	/**
	 * Returns whether the resource units are assigned to users strictly strictly on the basis of
	 * priority and waiting time. If true and this entity is unable to seize the resource because
	 * of other restrictions, then other entities with lower priority or shorter waiting time will
	 * NOT be allowed to seize the resource. If false, the entities will be tested in the same
	 * order of priority and waiting time, but the first entity that is able to seize the resource
	 * will be allowed to do so.
	 * @return true if resources are assigned in strict order
	 */
	isStrictOrder(): boolean;

	/**
	 * Returns the total number of resource units that can be assigned.
	 * @param simTime - present simulation time
	 * @return total number of resource units
	 */
	getCapacity(simTime: number): number;

	/**
	 * Returns the number of resource units that are assigned at the present time.
	 * @return resource units that are assigned
	 */
	getUnitsInUse(): number;

}

export const ResourceProvider = {
	javaName: "com.jaamsim.resourceObjects.ResourceProvider",

	[Symbol.hasInstance](o: unknown): o is ResourceProvider {
		return isResourceProvider(o);
	},

	/** o instanceof ResourceProvider */
	isInstance(o: unknown): o is ResourceProvider {
		return isResourceProvider(o);
	},

	/**
	 * Returns a list of the ResourceUsers (such as Seize) that want to seize the specified
	 * ResourceProvider (such as ResourcePool).
	 * @param pool - specified ResourceProvider
	 * @return list of ResourceUsers that want to seize this ResourceProvider
	 */
	getUserList(pool: ResourceProvider): ResourceUser[] {
		const ret: ResourceUser[] = [];
		const simModel: JaamSimModel = (pool as unknown as Entity).getJaamSimModel();
		for (const ent of simModel.getClonesOfIterator(Entity, isResourceUser)) {
			const ru = ent as unknown as ResourceUser;
			if (ru.requiresResource(pool))
				ret.push(ru);
		}
		return ret;
	},
};

/** o instanceof ResourceProvider の代わり（interface の関数がすべてあるか） */
export function isResourceProvider(o: unknown): o is ResourceProvider {
	if (o === null || typeof o !== "object")
		return false;
	const r = o as Record<string, unknown>;
	for (const f of ["canSeize", "seize", "release", "getUserList", "isStrictOrder", "getCapacity", "getUnitsInUse"])
		if (typeof r[f] !== "function")
			return false;
	return true;
}
