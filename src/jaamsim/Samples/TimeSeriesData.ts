/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2013 Ausenco Engineering Canada Inc.
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

import type { DoubleVector } from "../datatypes/DoubleVector.ts";
import type { EventManager } from "../events/EventManager.ts";
import { Double, jformat, jstr } from "../internal.ts";

export class TimeSeriesData {
	readonly evt: EventManager;
	readonly ticksList: number[];   // time in clock ticks corresponding to each value (long[])
	readonly valueList: number[];
	private maxValue: number = 0;  // The maximum value that occurs in valueList
	private minValue: number = 0;  // The minimum value that occurs in valueList

	constructor(times: DoubleVector, values: DoubleVector, evt: EventManager) {
		this.evt = evt;
		this.ticksList = new Array<number>(times.size()).fill(0);
		for (let i = 0; i < times.size(); i++) {
			// Java の Math.round(double) は long（.5 は正の方向）。JS の Math.round と同じ
			this.ticksList[i] = Math.round(times.get(i));
		}

		this.valueList = new Array<number>(values.size()).fill(0);
		this.maxValue = Double.NEGATIVE_INFINITY;
		this.minValue = Double.POSITIVE_INFINITY;
		for (let i = 0; i < values.size(); i++) {
			this.valueList[i] = values.get(i);
			this.maxValue = Math.max(this.maxValue, this.valueList[i]);
			this.minValue = Math.min(this.minValue, this.valueList[i]);
		}
	}

	getMaxValue(): number {
		return this.maxValue;
	}

	getMinValue(): number {
		return this.minValue;
	}

	/**
	 * Tests whether the time series values are monotonically increasing or decreasing.
	 * @param dir - direction (positive = increasing, negative = decreasing)
	 * @return true if monotonic
	 */
	isMonotonic(dir: number): boolean {
		for (let i = 1; i < this.valueList.length; i++) {
			const comp = Double.compare(this.valueList[i], this.valueList[i - 1]);
			if (dir * comp < 0)
				return false;
		}
		return true;
	}

	toString(): string {
		let sb = "{";
		for (let i = 0; i < this.ticksList.length; i++) {
			if (i > 0) {
				sb += ",";
			}
			const str = jformat(" {%s[s], %s}", jstr(this.evt.ticksToSeconds(this.ticksList[i])), jstr(this.valueList[i]));
			sb += str;
		}
		sb += " }";
		return sb;
	}

}
