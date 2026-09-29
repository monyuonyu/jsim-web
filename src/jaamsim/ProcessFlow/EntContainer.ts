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

// Java の interface は、TS の interface と同じ名前の const の組にした（Linkable.ts と同じ作り）。
// `EntContainer.register(クラス)` で印を付け、`x instanceof EntContainer` で判定する。
// StateUser（ほかの担当）の印は、実装するクラスの側で付ける。

import type { JClass } from "../java/lang.ts";
import type { DisplayEntity } from "../Graphics/DisplayEntity.ts";
import type { StateUser } from "../states/StateUser.ts";

const MARK = Symbol("EntContainer");

/**
 * Provides a common interface for objects that store entities.
 * @author Harry King
 *
 */
export interface EntContainer extends StateUser {

	/**
	 * Updates the container's parameters prior to adding the specified entity.
	 */
	registerEntity(ent: DisplayEntity): void;

	/**
	 * Adds the specified entity to the container.
	 */
	addEntity(ent: DisplayEntity): void;

	/**
	 * Removes the first entity of the specified type in the container.
	 * If the type is null, then the first entity is removed regardless of type.
	 * string.
	 * @param type - entity type
	 * @return entity that was removed
	 */
	removeEntity(type: string | null): DisplayEntity | null;

	/**
	 * Returns the number of entities of the specified type in the container.
	 * If the type is null, then all entities are counted.
	 * @param type - entity type
	 * @return number of entities of the specified type
	 */
	getCount(type: string | null): number;

	/**
	 * Returns whether the container has any entities of the specified type.
	 * If the type is null, then all entities are considered.
	 * @param type - entity type
	 * @return true if there is at least one entity of the specified type
	 */
	isEmpty(type: string | null): boolean;
}

export const EntContainer = {
	/** Java の「implements EntContainer」の代わり */
	register(cls: JClass): void {
		(cls.prototype as Record<symbol, unknown>)[MARK] = true;
	},

	[Symbol.hasInstance](o: unknown): o is EntContainer {
		return o !== null && typeof o === "object" && (o as Record<symbol, unknown>)[MARK] === true;
	},
};

/** x instanceof EntContainer の代わり（関数の形。ほかの担当の書き方に合わせたもの。中身は `x instanceof EntContainer` と同じ） */
export function isEntContainer(o: unknown): o is EntContainer {
	return o instanceof EntContainer;
}
