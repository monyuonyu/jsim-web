/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2016 JaamSim Software Inc.
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
// - `Linkable.register(クラス)` で「implements Linkable」の印を付ける（子クラスにも効く）
// - `x instanceof Linkable` は、その印で判定する（Symbol.hasInstance）
// - InterfaceEntityInput などに Java の `Linkable.class` を渡す所は、この const を渡す

import type { JClass } from "../java/lang.ts";
import type { DisplayEntity } from "../Graphics/DisplayEntity.ts";

const MARK = Symbol("Linkable");

export interface Linkable {

	/**
	 * Receives the specified entity from an upstream component.
	 * @param ent - the entity to be received
	 */
	addEntity(ent: DisplayEntity): void;
}

export const Linkable = {
	/** Java の「implements Linkable」の代わり */
	register(cls: JClass): void {
		(cls.prototype as Record<symbol, unknown>)[MARK] = true;
	},

	[Symbol.hasInstance](o: unknown): o is Linkable {
		return o !== null && typeof o === "object" && (o as Record<symbol, unknown>)[MARK] === true;
	},
};

/** x instanceof Linkable の代わり（関数の形。ほかの担当の書き方に合わせたもの。中身は `x instanceof Linkable` と同じ） */
export function isLinkable(o: unknown): o is Linkable {
	return o instanceof Linkable;
}
