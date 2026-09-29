/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2018-2019 JaamSim Software Inc.
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

// Java の interface は TS の interface にした。
// `x instanceof StateUser` は isStateUser(x) で判定する（関数 setPresentState と isWorkingState があるか）。

export interface StateUser {

	/**
	 * Sets the state of this entity to the specified state.
	 * @param state - new state for the entity
	 */
	setPresentState(state: string): void;

	/**
	 * Returns whether the entity is in a working state.
	 * @return true is the entity is working
	 */
	isWorkingState(): boolean;

}

/** `o instanceof StateUser` の代わり */
export function isStateUser(o: unknown): o is StateUser {
	if (o === null || typeof o !== "object")
		return false;
	const r = o as Record<string, unknown>;
	return typeof r.setPresentState === "function"
		&& typeof r.isWorkingState === "function";
}
