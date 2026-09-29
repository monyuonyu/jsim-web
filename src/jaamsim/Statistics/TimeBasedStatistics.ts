/*
 * JaamSim Discrete Event Simulation
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

export class TimeBasedStatistics {

	private startTime = 0.0;
	private lastTime = 0.0;
	private lastVal = Number.NaN;
	private minVal = Number.NaN;
	private maxVal = Number.NaN;
	private weightedSum = 0.0;
	private weightedSumSquared = 0.0;

	constructor() {}

	clear(): void {
		this.startTime = 0.0;
		this.lastTime = 0.0;
		this.lastVal = Number.NaN;
		this.minVal = Number.NaN;
		this.maxVal = Number.NaN;
		this.weightedSum = 0.0;
		this.weightedSumSquared = 0.0;
	}

	addValue(t: number, val: number): void {
		if (Number.isNaN(this.lastVal)) {
			this.startTime = t;
		}
		else {
			const dt = t - this.lastTime;
			this.weightedSum += dt * this.lastVal;
			this.weightedSumSquared += dt * this.lastVal * this.lastVal;
		}
		if (Number.isNaN(this.minVal) || val < this.minVal) {
			this.minVal = val;
		}
		if (Number.isNaN(this.maxVal) || val > this.maxVal) {
			this.maxVal = val;
		}
		this.lastTime = t;
		this.lastVal = val;
	}

	getMin(): number {
		return this.minVal;
	}

	getMax(): number {
		return this.maxVal;
	}

	getSum(t: number): number {
		const dt = t - this.lastTime;
		return this.weightedSum + dt*this.lastVal;
	}

	getSumSquared(t: number): number {
		const dt = t - this.lastTime;
		return this.weightedSumSquared + dt*this.lastVal*this.lastVal;
	}

	getMean(t: number): number {
		return this.getSum(t) / (t - this.startTime);
	}

	getMeanSquared(t: number): number {
		return this.getSumSquared(t) / (t - this.startTime);
	}

	getVariance(t: number): number {
		const mean = this.getMean(t);
		return this.getMeanSquared(t) - mean*mean;
	}

	getStandardDeviation(t: number): number {
		return Math.sqrt(this.getVariance(t));
	}

}
