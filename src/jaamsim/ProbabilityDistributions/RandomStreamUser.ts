/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2018-2023 JaamSim Software Inc.
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
// - const の RandomStreamUser.register(クラス) で「implements RandomStreamUser」の印を付ける
// - `x instanceof RandomStreamUser` は、その印で判定する（Symbol.hasInstance）
// - Java の static 関数 setUniqueRandomSeed は const の関数

import type { JClass } from "../java/lang.ts";
import { Entity } from "../internal.ts";
import { InputAgent } from "../internal.ts";

const MARK = Symbol("RandomStreamUser");

export interface RandomStreamUser {

	/**
	 * Returns the random seed used by this object.
	 * @return random seed
	 */
	getStreamNumber(): number;

	/**
	 * Returns the keyword used to enter the random seed.
	 * @return random seed keyword
	 */
	getStreamNumberKeyword(): string;
}

export const RandomStreamUser = {

	/** Java の「implements RandomStreamUser」の代わり。クラスに印を付ける（子クラスにも効く） */
	register(cls: JClass): void {
		(cls.prototype as Record<symbol, unknown>)[MARK] = true;
	},

	[Symbol.hasInstance](o: unknown): o is RandomStreamUser {
		return o !== null && typeof o === "object" && (o as Record<symbol, unknown>)[MARK] === true;
	},

	setUniqueRandomSeed(rsu: RandomStreamUser): void {
		const ent = rsu as unknown as Entity;
		const simModel = ent.getJaamSimModel();

		// Do nothing if a valid seed has been set previously
		let seed = rsu.getStreamNumber();
		if (seed >= 0 && simModel.getRandomStreamUsers(seed).length <= 1)
			return;

		// Set the smallest seed value that has not been used already
		seed = simModel.getSmallestAvailableStreamNumber();
		const key = rsu.getStreamNumberKeyword();
		InputAgent.applyIntegers(ent, key, seed);

		// Always mark the entity and keyword as 'edited' so that the seed value is saved to the
		// configuration file (required for SubModel.update)
		ent.getInput(key)!.setEdited(true);
		ent.setEdited();
	},
};

/** x instanceof RandomStreamUser の代わり（関数の形。ほかの担当の書き方に合わせたもの。中身は `x instanceof RandomStreamUser` と同じ） */
export function isRandomStreamUser(o: unknown): o is RandomStreamUser {
	return o instanceof RandomStreamUser;
}
