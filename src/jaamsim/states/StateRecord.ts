/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2014 Ausenco Engineering Canada Inc.
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

export class StateRecord {
	private readonly name: string;
	private readonly working: boolean;
	private initTicks = 0;
	private totalTicks = 0;
	private completedCycleTicks = 0;
	private currentCycleTicks = 0;
	private startTick = 0;  // clock ticks at which the entity was last set to this state

	// Java ではパッケージの中だけから呼べるコンストラクタ
	constructor(state: string, work: boolean) {
		this.name = state;
		this.working = work;
	}

	addTicks(ticks: number): void {
		this.totalTicks += ticks;
		this.currentCycleTicks += ticks;
	}

	finishWarmUp(): void {
		this.initTicks = this.totalTicks;
		this.totalTicks = 0;
		this.completedCycleTicks = 0;
	}

	finishCycle(): void {
		this.completedCycleTicks += this.currentCycleTicks;
		this.currentCycleTicks = 0;
	}

	getName(): string {
		return this.name;
	}

	isWorking(): boolean {
		return this.working;
	}

	setStartTick(tick: number): void {
		this.startTick = tick;
	}

	getStartTick(): number {
		return this.startTick;
	}

	getInitTicks(): number {
		return this.initTicks;
	}

	getTotalTicks(): number {
		return this.totalTicks;
	}

	getCurrentCycleTicks(): number {
		return this.currentCycleTicks;
	}

	getCompletedCycleTicks(): number {
		return this.completedCycleTicks;
	}

	toString(): string {
		return this.name;
	}
}
