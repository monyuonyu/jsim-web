/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2017-2018 JaamSim Software Inc.
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
// - `x instanceof ResourceUser` は、判定の関数 isResourceUser(x) で行う（interface の関数がすべてあるか。ほかの担当の書き方に合わせた）。
//   const の ResourceUser も Symbol.hasInstance と isInstance を持つので、`x instanceof ResourceUser` と書いてもよく、
//   InterfaceEntityListInput・getDisplayModel などに interface の Class の代わりに渡せる。

import type { ResourceProvider } from "./ResourceProvider.ts";

export interface ResourceUser {

	/**
	 * Returns whether the specified Resource can be seized by this object.
	 * @param res - Resource to be seized.
	 * @return true if the specified Resource can be seized.
	 */
	requiresResource(res: ResourceProvider): boolean;

	/**
	 * Returns whether there is an eligible entity that is waiting to seize one or more Resources.
	 * @return true if an entity is waiting
	 */
	hasWaitingEntity(): boolean;

	/**
	 * Returns the priority of the first eligible entity that is waiting to seize Resources.
	 * @return priority
	 */
	getPriority(): number;

	/**
	 * Returns the time that the first eligible entity has been waiting to seize Resources.
	 * @return wait time
	 */
	getWaitTime(): number;

	/**
	 * Returns whether sufficient Resources are available to start processing the next entity.
	 * @return true if the next entity can start
	 */
	isReadyToStart(): boolean;

	/**
	 * Seizes the Resources for the next entity and begins its processing.
	 */
	startNextEntity(): void;

	/**
	 * Returns whether the seize object uses a Resource that required strict-order.
	 * @return true if a strict-order Resource is required
	 */
	hasStrictResource(): boolean;
}

export const ResourceUser = {

	[Symbol.hasInstance](o: unknown): o is ResourceUser {
		return isResourceUser(o);
	},

	/** o instanceof ResourceUser */
	isInstance(o: unknown): o is ResourceUser {
		return isResourceUser(o);
	},
};

/** o instanceof ResourceUser の代わり（interface の関数がすべてあるか） */
export function isResourceUser(o: unknown): o is ResourceUser {
	if (o === null || typeof o !== "object")
		return false;
	const r = o as Record<string, unknown>;
	for (const f of ["requiresResource", "hasWaitingEntity", "getPriority", "getWaitTime", "isReadyToStart", "startNextEntity", "hasStrictResource"])
		if (typeof r[f] !== "function")
			return false;
	return true;
}
