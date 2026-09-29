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

import { StudentsTDistribution } from "../internal.ts";

export class SampleStatistics {

	private count = 0;       // Java の long
	private avg = 0.0;
	private q = 0.0;
	private sum = 0.0;
	private sumSquared = 0.0;
	private minVal = Number.NaN;
	private maxVal = Number.NaN;

	constructor() {}

	clear(): void {
		this.count = 0;
		this.avg = 0.0;
		this.q = 0.0;

		this.sum = 0.0;
		this.sumSquared = 0.0;
		this.minVal = Number.NaN;
		this.maxVal = Number.NaN;
	}

	addValue(val: number): void {
		this.count++;

		// Welford's Online Algorithm
		const lastAvg = this.avg;
		this.avg += (val - this.avg)/this.count;
		this.q += (val - lastAvg)*(val - this.avg);

		this.sum += val;
		this.sumSquared += val*val;

		if (Number.isNaN(this.minVal) || val < this.minVal) {
			this.minVal = val;
		}
		if (Number.isNaN(this.maxVal) || val > this.maxVal) {
			this.maxVal = val;
		}
	}

	getCount(): number {
		return this.count;
	}

	getMin(): number {
		return this.minVal;
	}

	getMax(): number {
		return this.maxVal;
	}

	getSum(): number {
		return this.sum;
	}

	getSumSquared(): number {
		return this.sumSquared;
	}

	getMean(): number {
		if (this.count === 0)
			return Number.NaN;
		return this.avg;
	}

	getMeanSquared(): number {
		return this.sumSquared/this.count;  // double / long（Java でも double の割り算）
	}

	getVariance(): number {
		if (this.count <= 1)
			return Number.NaN;
		return this.q/(this.count - 1);
	}

	getStandardDeviation(): number {
		return Math.sqrt(this.getVariance());
	}

	getConfidenceInterval95(): number {
		if (this.count <= 1)
			return Number.NaN;
		const n = this.count - 1;  // Java: (int) count - 1
		const factor = StudentsTDistribution.getConfidenceIntervalFactor95(n);
		return Math.sqrt(this.getVariance()/this.count) * factor;
	}

}
