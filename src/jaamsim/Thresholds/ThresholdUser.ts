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

// Java の interface ThresholdUser は TS の interface にした。
// `x instanceof ThresholdUser` の代わりは isThresholdUser(x)（関数の有無で見分ける。ほかの担当の isStateUser などと同じ作り）。

import type { Threshold } from "./Threshold.ts";

export interface ThresholdUser {

	/**
	 * Returns the Thresholds used by this object.
	 * @return the Threshold list.
	 */
	getThresholds(): Threshold[];

	/**
	 * Called whenever one of the Thresholds used by this object has changed
	 * its state from either open to closed or from closed to open.
	 */
	thresholdChanged(): void;
}

/** x instanceof ThresholdUser の代わり */
export function isThresholdUser(o: unknown): o is ThresholdUser {
	if (o === null || typeof o !== "object")
		return false;
	const t = o as Record<string, unknown>;
	return typeof t.getThresholds === "function" && typeof t.thresholdChanged === "function";
}
