/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2021-2022 JaamSim Software Inc.
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
import type { EventTraceListener } from "../events/EventTraceListener.ts";
import { ErrorException } from "./ErrorException.ts";
import type { JaamSimModel } from "./JaamSimModel.ts";
import type { RunListener } from "./RunListener.ts";
import type { Scenario } from "./Scenario.ts";

/**
 * An individual run for a simulation model.
 * @author Harry King
 *
 */
export class SimRun implements RunListener {
	private readonly scen: Scenario;
	private readonly replicationNumber: number;
	private simModel: JaamSimModel | null = null;        // simulation model to be executed
	private runOutputValues: number[] | null = null;
	private runOutputStrings: string[] | null = null;
	private runParameterStrings: string[] | null = null;
	private errorMessage: string | null = null;

	/**
	 * Constructs a SimRun object for the given scenario and replications numbers.
	 * @param scene - scenario number for the run
	 * @param rep - replication number for the run
	 * @param l - listens for the end of the run
	 */
	constructor(rep: number, s: Scenario) {
		this.replicationNumber = rep;
		this.scen = s;
	}

	getJaamSimModel(): JaamSimModel {
		return this.simModel!;
	}

	getScenario(): Scenario {
		return this.scen;
	}

	getReplicationNumber(): number {
		return this.replicationNumber;
	}

	isError(): boolean {
		return this.errorMessage != null;
	}

	getErrorMessage(): string | null {
		return this.errorMessage;
	}

	/**
	 * Starts the simulation model run on a new thread. The model must be configured
	 * already and may have been used for a previous run.
	 * （スレッドは使わない。simModel.start は、止まるまで事象を実行してから戻る）
	 *
	 * @param sm - pre-configured simulation model
	 */
	start(sm: JaamSimModel, trc: EventTraceListener | null): void {
		this.simModel = sm;
		// Reset the scenario and replication numbers
		this.simModel.setScenarioNumber(this.scen.getScenarioNumber());
		this.simModel.setReplicationNumber(this.getReplicationNumber());

		// Start the run
		this.simModel.start(this, trc);
	}

	runEnded(): void {
		const simModel = this.simModel!;
		const simTime = simModel.getSimTime();
		this.runOutputValues = simModel.getSimulation()!.getRunOutputValues(simTime);
		this.runOutputStrings = simModel.getSimulation()!.getRunOutputStrings(simTime);
		this.runParameterStrings = simModel.getSimulation()!.getRunParameterStrings(simTime);
		this.scen.runEnded(this);
	}

	handleRuntimeError(sm: JaamSimModel, t: unknown): void {
		const simTime = sm.getSimTime();
		sm.logMessage("Runtime error in replication %s of scenario %s at time %f s:",
				sm.getReplicationNumber(), sm.getScenarioNumber(), simTime);
		sm.logMessage("%s", localizedMessageOf(t));

		// Stack trace for the root cause
		let rootCause: unknown = t;
		while (causeOf(rootCause) != null && causeOf(rootCause) !== rootCause) {
			rootCause = causeOf(rootCause);
		}
		sm.logMessage("Stack trace:");
		sm.logStackTrace(rootCause);
		sm.logMessage("");

		if (!sm.isMultipleRuns()) {
			const gui = sm.getGUIListener();
			if (gui != null)
				gui.gui_handleError(sm, t);
			return;
		}

		this.runParameterStrings = sm.getSimulation()!.getRunParameterStrings(simTime);
		this.errorMessage = ErrorException.messageOf(t);
		if (this.errorMessage == null)
			this.errorMessage = "";
		this.scen.runEnded(this);
	}

	getRunOutputValues(): number[] {
		return this.runOutputValues!;
	}

	getRunOutputStrings(): string[] {
		return this.runOutputStrings!;
	}

	getRunParameterStrings(): string[] {
		return this.runParameterStrings!;
	}

	getProgress(): number {
		const simulation = this.simModel!.getSimulation();
		if (simulation == null)
			return 0.0;
		const simTime = this.simModel!.getSimTime();
		return simulation.getProgress(simTime);
	}

}

/** Throwable.getLocalizedMessage() の代わり */
function localizedMessageOf(t: unknown): string | null {
	const glm = (t as { getLocalizedMessage?: () => string | null } | null)?.getLocalizedMessage;
	if (typeof glm === "function")
		return glm.call(t);
	return ErrorException.messageOf(t);
}

/** Throwable.getCause() の代わり */
function causeOf(t: unknown): unknown {
	if (t == null || typeof t !== "object")
		return null;
	const gc = (t as { getCause?: () => unknown }).getCause;
	if (typeof gc === "function")
		return gc.call(t) ?? null;
	return (t as { cause?: unknown }).cause ?? null;
}
