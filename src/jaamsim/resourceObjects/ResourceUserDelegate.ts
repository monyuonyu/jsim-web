/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2024 JaamSim Software Inc.
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

import type { DisplayEntity } from "../Graphics/DisplayEntity.ts";
import type { ResourceProvider } from "./ResourceProvider.ts";

export class ResourceUserDelegate {

	private readonly resourceList: ResourceProvider[];

	constructor(resList: ResourceProvider[]) {
		this.resourceList = resList;
	}

	getResourceList(): ResourceProvider[] {
		return this.resourceList;
	}

	getListSize(): number {
		return this.resourceList.length;
	}

	isEmpty(): boolean {
		return this.resourceList.length === 0;
	}

	requiresResource(res: ResourceProvider): boolean {
		return this.resourceList.includes(res);
	}

	canSeizeResources(simTime: number, nums: number[], ent: DisplayEntity): boolean {
		for (let i = 0; i < this.resourceList.length; i++) {
			if (!this.resourceList[i].canSeize(simTime, nums[i], ent)) {
				return false;
			}
		}
		return true;
	}

	seizeResources(nums: number[], ent: DisplayEntity): void {
		for (let i = 0; i < this.resourceList.length; i++) {
			if (nums[i] === 0)
				continue;
			this.resourceList[i].seize(nums[i], ent);
		}
	}

	releaseResources(nums: number[], ent: DisplayEntity): void {
		for (let i = 0; i < this.resourceList.length; i++) {
			if (nums[i] === 0)
				continue;
			this.resourceList[i].release(nums[i], ent);
		}
	}

	hasStrictResource(): boolean {
		for (const res of this.resourceList) {
			if (res.isStrictOrder()) {
				return true;
			}
		}
		return false;
	}

}
