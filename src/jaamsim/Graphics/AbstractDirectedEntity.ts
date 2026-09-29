/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2023 JaamSim Software Inc.
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
 * TypeScript への移植 (C) 2026 shota
 */
import type { Entity } from "../basicsim/Entity.ts";

export class AbstractDirectedEntity<T extends Entity> {

	readonly entity: T;
	readonly direction: boolean;

	static readonly REVERSE = "(R)";

	/** Java の (ent) と (ent, dir) の 2 つのコンストラクタ（dir を省くと true） */
	constructor(ent: T, dir: boolean = true) {
		this.entity = ent;
		this.direction = dir;
	}

	getEntity(): T {
		return this.entity;
	}

	getDirection(): boolean {
		return this.direction;
	}

	toString(): string {
		let ret = this.entity.getName();
		if (!this.direction)
			ret = ret + AbstractDirectedEntity.REVERSE;
		return ret;
	}

	equals(obj: unknown): boolean {
		if (obj === null || obj === undefined) return false;
		if (obj === this) return true;
		if (!(obj instanceof AbstractDirectedEntity)) return false;
		const de = obj as AbstractDirectedEntity<Entity>;
		return de.entity === this.entity && de.direction === this.direction;
	}

}
