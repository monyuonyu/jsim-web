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
import { EventManager } from "../events/EventManager.ts";
import type { EventTraceListener } from "../events/EventTraceListener.ts";
import { tr } from "../i18n/I18n.ts";
import { InputAgent } from "../input/InputAgent.ts";
import type { PrintStream } from "../input/InputAgent.ts";
import { jformat } from "../java/lang.ts";
import { ErrorException } from "./ErrorException.ts";
import { EventRecorder } from "./EventRecorder.ts";
import { EventTracer } from "./EventTracer.ts";
import { FileEntity, FileSystem, JFile } from "./FileEntity.ts";
import { JaamSimModel } from "./JaamSimModel.ts";
import { Log } from "./Log.ts";
import { Scenario } from "./Scenario.ts";
import type { SimRun } from "./SimRun.ts";

/**
 * Controls the execution of one or more runs of a given simulation model.
 * @author Harry King
 *
 * 移植の注意（スレッドを使わない）:
 * - Java は反復（run）ごとに別のスレッドで事象を実行し、NumberOfThreads が 2 以上なら JaamSimModel を写して並行に流す。
 *   ここは 1 つのスレッドで、1 つの JaamSimModel を使って順に流す（getNumberOfThreads は 1 を返す）。
 *   反復は互いに独立（乱数は反復の番号で決まる）なので、各反復の結果は Java と同じ。
 *   TODO(移植): 並行に流した Java では、報告書（.rep）に書く順が終わった順になり、ずれることがある。
 * - Java では、反復の終わり（事象の中）で次の反復を始めても、別のスレッドが動くのですぐに戻る。
 *   ここで同じことをすると事象の実行が入れ子になるので、次の反復を始めるのは、
 *   今の実行が止まって start()・resume() に戻ってから（pendingRuns を順に始める）にした。
 * - GUIFrame を呼ぶ所は、simModel の GUIListener（あれば）に置き換えた。
 */
export class RunManager {

	private readonly simModel: JaamSimModel;
	private outStream: PrintStream | null = null;  // location where the custom outputs will be written
	private outStreamFile: FileEntity | null = null;  // outStream がファイルのとき、その実体
	private reportFile: FileEntity | null = null;  // main output report

	private readonly simModelList: JaamSimModel[];
	private readonly scenarioList: Scenario[];

	/** 次に始める反復（事象の実行が止まってから始める） */
	private readonly pendingRuns: JaamSimModel[] = [];
	private draining = false;

	constructor(sm: JaamSimModel) {
		this.simModel = sm;
		this.simModelList = [];
		this.scenarioList = [];
	}

	getJaamSimModel(): JaamSimModel {
		return this.simModel;
	}

	getSimModelList(): JaamSimModel[] {
		return [...this.simModelList];
	}

	start(): void {
		const simulation = this.simModel.getSimulation()!;

		// Open the main report
		if (simulation.getPrintReport())
			this.reportFile = this.getReportFile();

		// Start a new simulation run on each thread
		this.simModelList.length = 0;
		this.scenarioList.length = 0;
		for (let i = 0; i < this.getNumberOfThreads(); i++) {
			//System.out.format("Thread %s:%n", i);

			// Create a JaamSimModel for each thread
			let sm = this.simModel;
			if (i > 0) {
				try {
					const nextName = jformat("%s(%s)", this.simModel.getName(), this.simModelList.length + 1);
					sm = new JaamSimModel(this.simModel, nextName);
					//System.out.format("JaamSimModel %s created%n", sm);
				}
				catch (e) {
					this.pause();
					this.invokeErrorDialog(tr("Runtime Error"),
							tr("The following runtime error has occurred while starting the model "
							+ "on multiple threads:"),
							ErrorException.messageOf(e) ?? "null",
							tr("More information about the error can be found in the Log Viewer."));
					Log.logException(e);
					return;
				}
			}

			let trc: EventTraceListener | null = null;
			// Set up any tracing to be performed
			if (this.getNumberOfThreads() === 1) {
				try {
					if (simulation.traceEvents()) {
						const evtName = JFile.getParent(this.simModel.getConfigFile()!) + FileSystem.separator + this.simModel.getRunName() + ".evt";
						trc = new EventRecorder(evtName);
					}
					else if (simulation.verifyEvents()) {
						const evtName = JFile.getParent(this.simModel.getConfigFile()!) + FileSystem.separator + this.simModel.getRunName() + ".evt";
						trc = new EventTracer(evtName);
					}
					else if (simulation.isEventViewerVisible() && this.simModel.getGUIListener() != null) {
						trc = this.simModel.getGUIListener()!.getEventViewer?.() ?? null;
					}
				}
				catch (e) {
					this.pause();
					this.invokeErrorDialog(tr("Tracing Error"),
							tr("The following runtime error has occurred while starting the model event tracing"),
							ErrorException.messageOf(e) ?? "null",
							tr("More information about the error can be found in the Log Viewer."));
					Log.logException(e);
					return;
				}
			}

			//System.out.format("hasRunsToStart=%s%n", hasRunsToStart());
			if (!this.hasRunsToStart())
				return;
			this.simModelList.push(sm);
			//System.out.format("simModelList=%s%n", simModelList);

			// Start the next simulation run for the present scenario
			this.startNextRun(sm, trc);
		}
		this.drainPendingRuns();
	}

	pause(): void {
		for (const sm of this.simModelList) {
			sm.pause();
		}
	}

	resume(): void {
		for (const sm of this.simModelList) {
			sm.resume();
		}
		this.drainPendingRuns();
	}

	reset(): void {
		const i = this.simModelList.indexOf(this.simModel);
		if (i >= 0)
			this.simModelList.splice(i, 1);
		this.close();
		this.simModelList.length = 0;
		this.scenarioList.length = 0;
		this.pendingRuns.length = 0;

		this.simModel.setScenarioNumber(this.getStartingScenarioNumber());
		this.simModel.setReplicationNumber(1);
		this.simModel.reset();
	}

	close(): void {
		if (this.outStream != null) {
			this.closeOutStream();
		}
		if (this.reportFile != null) {
			this.reportFile.close();
			this.reportFile = null;
		}
		for (const sm of this.simModelList) {
			sm.close();
		}
	}

	hasRunsToStart(): boolean {
		return this.scenarioList.length < this.getNumberOfScenarios()
				|| this.scenarioList[this.scenarioList.length - 1].hasRunsToStart();
	}

	runEnded(run: SimRun): void {
		const simulation = this.simModel.getSimulation()!;
		this.simModel.getGUIListener()?.updateUI?.();

		// Print the output report
		if (this.reportFile != null)
			InputAgent.printReport(run.getJaamSimModel(), EventManager.simSeconds(), this.reportFile);

		// Is the scenario finished?
		const scene = run.getScenario();
		if (scene.isFinished()) {

			// Print the results
			const numOuts = simulation.getRunOutputListSize();
			if (numOuts > 0) {
				this.outStream = this.getOutStream();
				if (this.outStream != null) {
					const replications = scene.getRunsCompleted().length;
					const labels = simulation.getPrintRunLabels();
					const reps = simulation.getPrintReplications();
					const bool = simulation.getPrintConfidenceIntervals();

					// Print the column headers
					if (scene.getScenarioNumber() === this.getStartingScenarioNumber())
						InputAgent.printRunOutputHeaders(this.simModel, labels, reps, bool, this.outStream);

					// Print the output lines for the scenario
					InputAgent.printScenarioOutputs(scene, labels, reps, bool, this.outStream);

					// Print a blank line after the scenario if the replications are shown
					if (reps && replications > 1 &&
							scene.getScenarioNumber() < this.getEndingScenarioNumber()) {
						this.outStream.println("");
					}
				}
			}

			// Exit if this is the last scenario
			if (scene.getScenarioNumber() === this.getEndingScenarioNumber()) {
				if (this.outStream != null) {
					this.closeOutStream();
				}
				if (this.reportFile != null) {
					this.reportFile.close();
					this.reportFile = null;
				}
				// Close warning/error trace file
				Log.logLine("Made it to do end at");
				this.simModel.closeLogFile();

				// Always terminate the run when in batch mode
				if (this.simModel.isBatchRun() || simulation.getExitAtStop()) {
					this.simModel.getGUIListener()?.shutdown?.(0);
				}

				// Are there any runs with errors
				const errorRuns = this.getErrorRuns();
				if (this.simModel.getGUIListener() != null && errorRuns.length > 0) {
					let sb = "";
					for (const r of errorRuns) {
						sb += jformat(tr("replication %s of scenario %s%n"),
								r.getReplicationNumber(), r.getScenario().getScenarioNumber());
					}
					this.invokeErrorDialog(tr("Runtime Error"),
							tr("Runtime errors occured in the following simulation runs:"),
							sb,
							tr("More information can be found in the Log Viewer."));
				}
				return;
			}
		}

		// Start the next run
		// Java はここで次の反復を始める。事象の実行の中なので、止まってから始める（pendingRuns）
		const sm = run.getJaamSimModel();
		this.pendingRuns.push(sm);
	}

	/** 止まった後に、待っている反復を順に始める */
	private drainPendingRuns(): void {
		if (this.draining)
			return;
		this.draining = true;
		try {
			while (this.pendingRuns.length > 0) {
				const sm = this.pendingRuns.shift()!;
				this.startNextRun(sm, null);
			}
		}
		finally {
			this.draining = false;
		}
	}

	private startNextRun(sm: JaamSimModel, trc: EventTraceListener | null): void {
		const simulation = this.simModel.getSimulation()!;

		// Set the present scenario
		let presentScenario: Scenario | null = null;
		if (this.scenarioList.length > 0)
			presentScenario = this.scenarioList[this.scenarioList.length - 1];

		// Start a new scenario if required
		if (presentScenario == null || !presentScenario.hasRunsToStart()) {
			if (this.scenarioList.length >= this.getNumberOfScenarios())
				return;
			const numOuts = simulation.getRunOutputListSize();
			const scenarioNumber = this.scenarioList.length + this.getStartingScenarioNumber();
			const numberOfReplications = this.getNumberOfReplications();
			presentScenario = new Scenario(numOuts, scenarioNumber, numberOfReplications, this);
			this.scenarioList.push(presentScenario);
			//System.out.format("Scenario %s started%n", presentScenario.getScenarioNumber());
		}

		// Start the next simulation run for the present scenario
		if (presentScenario.hasRunsToStart()) {
			presentScenario.startNextRun(sm, trc);
		}
	}

	getOutStream(): PrintStream {
		if (this.outStream == null) {

			// Select either standard out or a file for the outputs
			this.outStream = SYSTEM_OUT;
			if (!this.simModel.isScriptMode()) {
				const fileName = this.simModel.getReportFileName(".dat");
				if (fileName == null)
					throw new ErrorException("Cannot create the run output file");
				// Java: new PrintStream(fileName)（既にあれば中身を消す）
				const f = new FileEntity(this.simModel, fileName);
				this.outStreamFile = f;
				this.outStream = {
					println(s: string): void { f.write(s); f.newLine(); },
					format(fmt: string, ...args: unknown[]): void { f.format(fmt, ...args); },
				};
			}
		}
		return this.outStream;
	}

	private closeOutStream(): void {
		if (this.outStreamFile != null) {
			this.outStreamFile.close();
			this.outStreamFile = null;
		}
		this.outStream = null;
	}

	getReportFile(): FileEntity {
		if (this.reportFile == null) {
			const fileName = this.simModel.getReportFileName(".rep");
			if (fileName == null)
				throw new ErrorException("Cannot create the report file");
			const f = fileName;
			if (JFile.exists(f) && !JFile.delete(f))
				throw new ErrorException("Cannot delete the existing report file %s", f);
			this.reportFile = new FileEntity(this.simModel, f);
		}
		return this.reportFile;
	}

	getProgress(): number {
		let ret = 0.0;
		for (const scene of this.scenarioList) {
			ret += scene.getProgress();
		}
		return ret / this.getNumberOfScenarios();
	}

	isRunning(): boolean {
		for (const sm of this.simModelList) {
			if (sm.isRunning()) {
				return true;
			}
		}
		return false;
	}

	getStartingScenarioNumber(): number {
		return this.simModel.getSimulation()!.getStartingScenarioNumber();
	}

	getEndingScenarioNumber(): number {
		return this.simModel.getSimulation()!.getEndingScenarioNumber();
	}

	getNumberOfScenarios(): number {
		return this.simModel.getSimulation()!.getNumberOfScenarios();
	}

	getNumberOfReplications(): number {
		return this.simModel.getSimulation()!.getNumberOfReplications();
	}

	getNumberOfRuns(): number {
		return this.simModel.getSimulation()!.getNumberOfRuns();
	}

	/** Java は simulation.getNumberOfThreads()。スレッドを使わないので、いつも 1 */
	getNumberOfThreads(): number {
		return 1;
	}

	getErrorRuns(): SimRun[] {
		const ret: SimRun[] = [];
		for (const scene of this.scenarioList) {
			ret.push(...scene.getErrorRuns());
		}
		return ret;
	}

	/** GUIFrame.invokeErrorDialog の代わり */
	private invokeErrorDialog(title: string, pre: string, message: string, post: string): void {
		const gui = this.simModel.getGUIListener();
		if (gui == null)
			return;
		if (gui.invokeErrorDialog !== undefined)
			gui.invokeErrorDialog(title, pre, message, post);
		else
			gui.invokeErrorDialogBox(title, pre + "\n\n" + message + "\n\n" + post);
	}

}

/** Java の System.out（PrintStream） */
const SYSTEM_OUT: PrintStream = {
	println(s: string): void {
		stdoutWrite(s + "\n");
	},
	format(fmt: string, ...args: unknown[]): void {
		stdoutWrite(jformat(fmt, ...args));
	},
};

function stdoutWrite(s: string): void {
	const proc = (globalThis as { process?: { stdout?: { write?: (s: string) => void } } }).process;
	if (proc?.stdout?.write !== undefined) {
		proc.stdout.write(s);
		return;
	}
	console.log(s.endsWith("\n") ? s.slice(0, -1) : s);
}
