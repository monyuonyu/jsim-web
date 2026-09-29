/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2014 Ausenco Engineering Canada Inc.
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
// `x instanceof StateEntityListener` は isStateEntityListener(x) で判定する
// （関数 isWatching と updateForStateChange があるか）。

import type { StateEntity } from "./StateEntity.ts";
import type { StateRecord } from "./StateRecord.ts";

export interface StateEntityListener {

	/**
	 * Returns true if this object is monitoring the specified entity's state.
	 * @param ent - the specified entity
	 * @return true if the specified entity is being monitored
	 */
	isWatching(ent: StateEntity): boolean;

	/**
	 * Indicates that the specified entity has changed state.
	 * @param ent - the specified entity
	 * @param prev - old state for the specified entity
	 * @param next - new state for the specified entity
	 */
	updateForStateChange(ent: StateEntity, prev: StateRecord, next: StateRecord): void;
}

/** `o instanceof StateEntityListener` の代わり */
export function isStateEntityListener(o: unknown): o is StateEntityListener {
	if (o === null || typeof o !== "object")
		return false;
	const r = o as Record<string, unknown>;
	return typeof r.isWatching === "function"
		&& typeof r.updateForStateChange === "function";
}
