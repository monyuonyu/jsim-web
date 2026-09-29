/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2015 Ausenco Engineering Canada Inc.
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
// `x instanceof DowntimeUser` は isDowntimeUser(x) で判定する（関数 canStartDowntime・prepareForDowntime・
// startDowntime・endDowntime があるか）。
// 注意: 判定関数 isDowntimeUser(o) は、interface の関数 isDowntimeUser(down) とは別物（モジュールの関数）。

import type { DowntimeEntity } from "../BasicObjects/DowntimeEntity.ts";

export interface DowntimeUser {
	getName(): string;

	/**
	 * Returns true if the specified maintenance activity applies to this user.
	 * @param down - planned or unplanned maintenance activity
	 */
	isDowntimeUser(down: DowntimeEntity): boolean;

	/**
	 * Returns true if the specified maintenance activity can be started.
	 * @param down - planned or unplanned maintenance activity
	 */
	canStartDowntime(down: DowntimeEntity): boolean;

	/**
	 * Notifies the entity that the specified maintenance activity is about to begin and that
	 * any work in progress should be halted.
	 * @param down - planned or unplanned maintenance activity
	 */
	prepareForDowntime(down: DowntimeEntity): void;

	/**
	 * Notifies the entity that the specified maintenance activity has started.
	 * @param down - planned or unplanned maintenance activity
	 */
	startDowntime(down: DowntimeEntity): void;

	/**
	 * Notifies the entity that the specified maintenance activity has ended.
	 * @param down - planned or unplanned maintenance activity
	 */
	endDowntime(down: DowntimeEntity): void;
}

/** `o instanceof DowntimeUser` の代わり */
export function isDowntimeUser(o: unknown): o is DowntimeUser {
	if (o === null || typeof o !== "object")
		return false;
	const r = o as Record<string, unknown>;
	return typeof r.isDowntimeUser === "function"
		&& typeof r.canStartDowntime === "function"
		&& typeof r.prepareForDowntime === "function"
		&& typeof r.startDowntime === "function"
		&& typeof r.endDowntime === "function";
}
