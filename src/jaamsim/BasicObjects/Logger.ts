/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2016-2024 JaamSim Software Inc.
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

// 名前の無い EntityTarget（recordLogEntryTarget）は、ファイルの中のクラス RecordLogEntryTarget にした。
// 古いログのファイルを消す所は BasicObjectsIO に任せる（差し替えられる）。
// FileEntity は、Java の java.io.File の代わりにファイルの道筋（文字列）を受け取る前提。

import { Double, jstr } from "../internal.ts";
import { tr } from "../internal.ts";
import { BooleanProvInput } from "../internal.ts";
import { DisplayEntity } from "../internal.ts";
import { SampleInput } from "../internal.ts";
import { StringProvListInput } from "../internal.ts";
import type { StringProvider } from "../StringProviders/StringProvider.ts";
import { Entity } from "../internal.ts";
import { EntityTarget } from "../internal.ts";
import { FileEntity } from "../internal.ts";
import { EventHandle } from "../internal.ts";
import { EventManager } from "../internal.ts";
import { InputAgent } from "../internal.ts";
import { defineOutput } from "../internal.ts";
import { UnitTypeListInput } from "../internal.ts";
import { DimensionlessUnit } from "../internal.ts";
import { TimeUnit } from "../internal.ts";
import { getBasicObjectsIO } from "../internal.ts";

export abstract class Logger extends DisplayEntity {

	private readonly unitTypeListInput: UnitTypeListInput;

	private readonly dataSource: StringProvListInput;

	private readonly separateFiles: BooleanProvInput;

	private readonly includeInitialization: BooleanProvInput;

	private readonly startTime: SampleInput;

	private readonly endTime: SampleInput;

	private file: FileEntity | null = null;
	private logTime = 0;
	private logEntity: DisplayEntity | null = null;

	private readonly recordLogEntryHandle: EventHandle;
	private readonly recordLogEntryTarget: EntityTarget<Logger>;

	constructor() {
		super();

		// Java の初期化ブロック
		this.active.setHidden(false);

		this.unitTypeListInput = new UnitTypeListInput("UnitTypeList", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.unitTypeListInput, "Not Used", []);
		this.unitTypeListInput.setHidden(true);
		this.addInput(this.unitTypeListInput);

		this.dataSource = new StringProvListInput("DataSource", Entity.KEY_INPUTS,
				[] as StringProvider[]);
		this.setKeywordDoc(this.dataSource, "One or more selected outputs to be logged. Each output is specified "
		                     + "by an expression.\n\n"
		                     + "It is best to include only dimensionless quantities and non-numeric "
		                     + "outputs in the DataSource input. "
		                     + "An output with dimensions can be made non-dimensional by dividing it "
		                     + "by 1 in the desired unit, e.g. '[Queue1].AverageQueueTime / 1[h]' is "
		                     + "the average queue time in hours. "
		                     + "A dimensional number will be displayed along with its unit. "
		                     + "The 'format' function can be used if a fixed number of decimal places "
		                     + "is required.",
		         ["{ [Queue1].QueueLengthAverage }"
		        + " { '[Queue1].AverageQueueTime / 1[h]' }"]);
		this.addInput(this.dataSource);

		this.separateFiles = new BooleanProvInput("SeparateFiles", Entity.KEY_INPUTS, false);
		this.setKeywordDoc(this.separateFiles, "If TRUE, an individual .log file will be created for each simulation "
		                     + "run and the suffix '-sNrM' will be added to each .log file name, "
		                     + "where N and M are the scenario and replication numbers for the run. "
		                     + "If FALSE, a single .log file will be created that contains the "
		                     + "outputs for all the simulation runs. "
		                     + "This input is ignored if multiple runs are to be executed and the "
		                     + "NumberOfThreads input is greater than one, in which case individual "
		                     + ".log files will be created.", []);
		this.addInput(this.separateFiles);

		this.includeInitialization = new BooleanProvInput("IncludeInitialization", Entity.KEY_INPUTS, true);
		this.setKeywordDoc(this.includeInitialization, "If TRUE, log entries are recorded during the initialization period.", []);
		this.addInput(this.includeInitialization);

		this.startTime = new SampleInput("StartTime", Entity.KEY_INPUTS, 0.0);
		this.setKeywordDoc(this.startTime, "The time at which the log starts recording entries.",
		         [ "24.0 h" ]);
		this.startTime.setUnitType(TimeUnit);
		this.startTime.setValidRange(0.0, Double.POSITIVE_INFINITY);
		this.addInput(this.startTime);

		this.endTime = new SampleInput("EndTime", Entity.KEY_INPUTS, Double.POSITIVE_INFINITY);
		this.setKeywordDoc(this.endTime, "The time at which the log stops recording entries.",
		         [ "8760.0 h" ]);
		this.endTime.setUnitType(TimeUnit);
		this.endTime.setValidRange(0.0, Double.POSITIVE_INFINITY);
		this.addInput(this.endTime);

		// Java のフィールドの初期値（初期化ブロックの後に書かれている）
		this.recordLogEntryHandle = new EventHandle();
		this.recordLogEntryTarget = new RecordLogEntryTarget(this);
	}

	override earlyInit(): void {
		super.earlyInit();

		this.unitTypeListInput.reset();  // Delete an unnecessary input

		this.logTime = 0.0;
		this.logEntity = null;

		// Close the file if it is already open
		const simModel = this.getJaamSimModel();
		if (this.file !== null && (simModel.isFirstRun() || this.isSeparateFiles(0.0))) {
			this.file.close();
			this.file = null;
		}

		if (!this.isActive())
			return;

		// Create the report file
		if (this.file === null) {
			let sb = "";
			sb += "-" + this.getName();
			if (this.isSeparateFiles(0.0)) {
				sb += "-s" + String(simModel.getScenarioNumber());
				sb += "r" + String(simModel.getReplicationNumber());
			}
			sb += ".log";
			const fileName = simModel.getReportFileName(sb);
			if (fileName === null)
				return;
			const io = getBasicObjectsIO();
			if (io.fileExists(fileName) && !io.deleteFile(fileName))
				this.error(tr("Cannot delete the existing log file %s"), fileName);
			this.file = new FileEntity(simModel, fileName);
		}
		const file = this.file;

		// Print the detailed run information to the file
		if (this.getJaamSimModel().isFirstRun() || this.isSeparateFiles(0.0))
			InputAgent.printReport(this.getSimulation(), file, 0.0);

		// Print run number header if multiple runs are to be performed
		if (this.getJaamSimModel().isMultipleRuns() && !this.isSeparateFiles(0.0)) {
			if (!this.getJaamSimModel().isFirstRun()) {
				file.format("%n");
			}
			file.format("%n%s%n", this.getJaamSimModel().getRunHeader());
		}

		// Print the title for each column
		// (a) Simulation time
		const unit = this.getJaamSimModel().getDisplayedUnit(TimeUnit);
		file.format("%nthis.SimTime/1[%s]", unit);

		// (b) Print at titles for any additional columns
		this.printColumnTitles(file);

		// (c) Print the mathematical expressions to be logged
		const toks: string[] = [];
		this.dataSource.getValueTokens(toks);
		for (const str of toks) {
			if (str === "{" || str === "}")
				continue;
			file.format("\t%s", str);
		}

		// Empty the output buffer
		file.flush();
	}

	private isSeparateFiles(simTime: number): boolean {
		const numThreads = this.getJaamSimModel().getSimulation()!.getNumberOfThreads();
		return this.separateFiles.getNextBoolean(this, simTime) || numThreads > 1;
	}

	private isIncludeInitialization(simTime: number): boolean {
		return this.includeInitialization.getNextBoolean(this, simTime);
	}

	scheduleLogEntry(): void {
		if (this.recordLogEntryHandle.isScheduled())
			return;
		EventManager.scheduleTicks(0, Entity.PRI_LOWEST, Entity.EVT_FIFO, this.recordLogEntryTarget, this.recordLogEntryHandle);
	}

	/**
	 * Writes an entry to the log file.
	 */
	recordLogEntry(simTime: number, ent: DisplayEntity | null): void {

		if (!this.isActive())
			return;

		// Skip the log entry if the log file has been closed at the end of the run duration
		if (this.file === null)
			return;
		const file = this.file;

		// Skip the log entry if the run is still initializing
		if (!this.isIncludeInitialization(simTime) && simTime < this.getSimulation().getInitializationTime())
			return;

		// Skip the log entry if it is outside the time range
		if (simTime < this.getStartTime(simTime) || simTime > this.getEndTime(simTime))
			return;

		// Record the time for the log entry
		this.logTime = simTime;
		this.logEntity = ent;

		// Write the time for the log entry
		const factor = this.getJaamSimModel().getDisplayedUnitFactor(TimeUnit);
		file.format("%n%s", jstr(simTime/factor));

		// Write any additional columns for the log entry
		this.recordEntry(file, simTime, ent);

		// Write the expression values
		for (let i=0; i<this.dataSource.getListSize(); i++) {
			let str: string;
			try {
				str = this.dataSource.getNextString(i, this, simTime);
			}
			catch (e) {
				str = (e as Error).message;
			}
			file.format("\t%s", str);
		}

		// If running in real time mode, empty the file buffer after each entity is logged
		if (!this.getJaamSimModel().isBatchRun() && this.getJaamSimModel().isRealTime())
			file.flush();
	}

	protected getStartTime(simTime: number): number {
		return this.startTime.getNextSample(this, simTime);
	}

	protected getEndTime(simTime: number): number {
		return this.endTime.getNextSample(this, simTime);
	}

	protected abstract printColumnTitles(file: FileEntity): void;

	protected abstract recordEntry(file: FileEntity, simTime: number, ent: DisplayEntity | null): void;

	override doEnd(): void {
		super.doEnd();

		// Write the last log entry if one is scheduled
		if (this.recordLogEntryHandle.isScheduled()) {
			EventManager.killEvent(this.recordLogEntryHandle);
			this.recordLogEntry(EventManager.simSeconds(), null);
		}

		// Flush the log file's print buffer
		if (this.file === null)
			return;
		this.file.flush();

		// Close the report file
		if (this.getJaamSimModel().isLastRun() || this.isSeparateFiles(EventManager.simSeconds())) {
			this.file.close();
			this.file = null;
		}
	}

	override close(): void {
		super.close();
		if (this.file === null)
			return;
		this.file.flush();
		this.file.close();
		this.file = null;
	}

	getLogTime(simTime: number): number {
		return this.logTime;
	}

	getLogEntity(simTime: number): DisplayEntity | null {
		return this.logEntity;
	}

}

/** Java の名前の無い EntityTarget（recordLogEntryTarget） */
class RecordLogEntryTarget extends EntityTarget<Logger> {
	constructor(ent: Logger) {
		super(ent, "recordLogEntry");
	}

	override process(): void {
		this.ent.recordLogEntry(EventManager.simSeconds(), null);
	}
}

defineOutput(Logger, {
	name: "LogTime",
	description: "The simulation time at which the last log entry was made.",
	unitType: TimeUnit, reportable: false, sequence: 100,
	returnType: "double",
	get: (e, simTime) => e.getLogTime(simTime),
});

defineOutput(Logger, {
	name: "LogEntity",
	description: "The entity that triggered the last log entry.",
	unitType: DimensionlessUnit, reportable: false, sequence: 100,
	returnType: "Entity",
	get: (e, simTime) => e.getLogEntity(simTime),
});
