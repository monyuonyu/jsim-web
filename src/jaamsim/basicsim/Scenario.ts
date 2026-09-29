/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2021-2025 JaamSim Software Inc.
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
import { SampleStatistics } from "../internal.ts";
import type { EventTraceListener } from "../events/EventTraceListener.ts";
import { jRemove } from "../internal.ts";
import { ErrorException } from "../internal.ts";
import type { JaamSimModel } from "./JaamSimModel.ts";
import type { RunManager } from "./RunManager.ts";
import { SimRun } from "../internal.ts";

/**
 * A set of simulation runs that are replications of a given model.
 * @author Harry King
 *
 */
export class Scenario {

	private readonly scenarioNumber: number;
	private readonly replications: number;  // number of replications to be performed
	private readonly runmanager: RunManager;  // notifies the RunManager that the run has ended

	private readonly runsToStart: SimRun[];
	private readonly runsInProgress: SimRun[];
	private readonly runsCompleted: SimRun[];

	private readonly runStatistics: SampleStatistics[];

	constructor(numOuts: number, scene: number, numReps: number, r: RunManager) {
		this.scenarioNumber = scene;
		this.replications = numReps;
		this.runmanager = r;

		this.runsToStart = [];
		this.runsInProgress = [];
		this.runsCompleted = [];
		for (let i = 1; i <= this.replications; i++) {
			this.runsToStart.push(new SimRun(i, this));
		}

		this.runStatistics = [];
		for (let i = 0; i < numOuts; i++) {
			this.runStatistics.push(new SampleStatistics());
		}
	}

	getScenarioNumber(): number {
		return this.scenarioNumber;
	}

	getNumberOfReplications(): number {
		return this.replications;
	}

	getRunsCompleted(): SimRun[] {
		return this.runsCompleted;
	}

	private recordRun(run: SimRun): void {
		if (run.isError())
			return;

		if (run.getRunOutputValues().length !== this.runStatistics.length)
			throw new ErrorException("List sizes do not match");

		for (let i = 0; i < run.getRunOutputValues().length; i++) {
			const val = run.getRunOutputValues()[i];
			if (Number.isNaN(val))
				continue;
			this.runStatistics[i].addValue(val);
		}
	}

	getParameters(): string[] {
		if (this.runsCompleted.length === 0)
			return [];

		// Start with the parameters for the first run
		const ret: string[] = [...this.runsCompleted[0].getRunParameterStrings()];

		// Ensure that each run has the same parameter values
		for (const run of this.runsCompleted) {
			for (let i = 0; i < run.getRunParameterStrings().length; i++) {
				if (ret[i] !== run.getRunParameterStrings()[i]) {
					ret[i] = "*";
				}
			}
		}
		return ret;
	}

	getRunStatistics(): SampleStatistics[] {
		return this.runStatistics;
	}

	hasRunsToStart(): boolean {
		return this.runsToStart.length > 0;
	}

	startNextRun(simModel: JaamSimModel, trc: EventTraceListener | null): void {
		if (this.runsToStart.length === 0)
			return;
		const run = this.runsToStart.shift()!;
		this.runsInProgress.push(run);
		run.start(simModel, trc);
		//System.out.format("Replication %s of Scenario %s started%n",
		//		run.getReplicationNumber(), run.getScenarioNumber());
	}

	isFinished(): boolean {
		return this.runsToStart.length === 0 && this.runsInProgress.length === 0;
	}

	runEnded(run: SimRun): void {
		this.recordRun(run);
		jRemove(this.runsInProgress, run);
		this.runsCompleted.push(run);
		this.runmanager.runEnded(run);
	}

	getProgress(): number {
		let ret = this.runsCompleted.length;
		for (const run of this.runsInProgress) {
			ret += run.getProgress();
		}
		return ret / this.replications;
	}

	getErrorRuns(): SimRun[] {
		const ret: SimRun[] = [];
		for (const run of this.runsCompleted) {
			if (run.isError()) {
				ret.push(run);
			}
		}
		return ret;
	}

}
