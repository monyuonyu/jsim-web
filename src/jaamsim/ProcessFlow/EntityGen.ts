/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2019 JaamSim Software Inc.
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
// `EntityGen.register(クラス)` で印を付け、`x instanceof EntityGen` で判定する。

import type { JClass } from "../java/lang.ts";
import type { DisplayEntity } from "../Graphics/DisplayEntity.ts";

const MARK = Symbol("EntityGen");

export interface EntityGen {
	setPrototypeEntity(proto: DisplayEntity): void;
}

export const EntityGen = {
	/** Java の「implements EntityGen」の代わり */
	register(cls: JClass): void {
		(cls.prototype as Record<symbol, unknown>)[MARK] = true;
	},

	[Symbol.hasInstance](o: unknown): o is EntityGen {
		return o !== null && typeof o === "object" && (o as Record<symbol, unknown>)[MARK] === true;
	},
};

/** x instanceof EntityGen の代わり（関数の形。ほかの担当の書き方に合わせたもの。中身は `x instanceof EntityGen` と同じ） */
export function isEntityGen(o: unknown): o is EntityGen {
	return o instanceof EntityGen;
}
