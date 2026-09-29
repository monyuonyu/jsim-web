/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2017-2023 JaamSim Software Inc.
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
import type { Entity } from "../basicsim/Entity.ts";
import type { EntityProvider } from "./EntityProvider.ts";
import type { EntityListProvider } from "./EntityListProvider.ts";

export class EntityProvConstant<T extends Entity> implements EntityProvider<T>, EntityListProvider<T> {

	private readonly ent: T | null;

	constructor(ent: T | null) {
		this.ent = ent;
	}

	public getEntity(): Entity | null {
		return this.ent;
	}

	public getNextEntity(thisEnt: Entity, simTime: number): T | null {
		return this.ent;
	}

	public getNextEntityList(thisEnt: Entity, simTime: number, list: T[], unique: boolean): void {
		if (this.ent !== null && (!unique || !list.includes(this.ent))) {
			list.push(this.ent);
		}
	}

	public toString(): string {
		// Java では ent が null なら NullPointerException（ここでも TypeError になる）
		return (this.ent as T).getName();
	}

}
