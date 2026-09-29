/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2013 Ausenco Engineering Canada Inc.
 * Copyright (C) 2022 JaamSim Software Inc.
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

// Java の interface TimeSeriesProvider は TS の interface にした。
// `x instanceof TimeSeriesProvider` は isTimeSeriesProvider(x)
// （SampleProvider の関数に加えて getMaxTicksValue・getInterpolatedTicksForValue があるか）。

import { isSampleProvider } from "../internal.ts";
import type { SampleProvider } from "./SampleProvider.ts";

export interface TimeSeriesProvider extends SampleProvider {
	getMaxValue(): number;
	getMinValue(): number;
	getNextTimeAfter(simTime: number): number;
	getValueForTicks(ticks: number): number;
	getNextChangeAfterTicks(ticks: number): number;
	getLastChangeBeforeTicks(ticks: number): number;
	getMaxTicksValue(): number;

	/**
	 * Returns the simulation time in ticks corresponding to the specified
	 * value that it interpolated from the time series entries.
	 * <p>
	 * The time series values must increase monotonically.
	 * @param val - specified value.
	 * @return interpolated simulation time in clock ticks.
	 */
	getInterpolatedTicksForValue(val: number): number;

	/**
	 * Returns the value corresponding to the specified simulation
	 * time in simulation clock ticks that it interpolated from the
	 * time series entries.
	 * @param ticks - simulation time in clock ticks.
	 * @return interpolated value.
	 */
	getInterpolatedCumulativeValueForTicks(ticks: number): number;
}

/** Java の `o instanceof TimeSeriesProvider` */
export function isTimeSeriesProvider(o: unknown): o is TimeSeriesProvider {
	if (!isSampleProvider(o))
		return false;
	const r = o as unknown as Record<string, unknown>;
	return typeof r.getMaxTicksValue === "function"
		&& typeof r.getInterpolatedTicksForValue === "function"
		&& typeof r.getInterpolatedCumulativeValueForTicks === "function";
}
