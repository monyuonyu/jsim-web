/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2015 Ausenco Engineering Canada Inc.
 * Copyright (C) 2015-2024 JaamSim Software Inc.
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

// 名前の無い EntityTarget（endActionTarget・doValueTraceTarget）と、入れ子のクラス ValueChangedConditional は、
// ファイルの中のクラスにした。

import { Double, SubjectEntityClass } from "../internal.ts";
import { ClassRegistry } from "../internal.ts";
import { tr } from "../internal.ts";
import { BooleanProvInput } from "../internal.ts";
import type { DisplayEntity } from "../Graphics/DisplayEntity.ts";
import { SampleInput } from "../internal.ts";
import { StringProvListInput } from "../internal.ts";
import type { StringProvider } from "../StringProviders/StringProvider.ts";
import { Entity } from "../internal.ts";
import { EntityTarget } from "../internal.ts";
import type { FileEntity } from "../basicsim/FileEntity.ts";
import { ObserverEntity } from "../internal.ts";
import { isSubjectEntity } from "../internal.ts";
import { type SubjectEntity } from "../basicsim/SubjectEntity.ts";
import type { Conditional } from "../events/Conditional.ts";
import { EventManager } from "../internal.ts";
import { BooleanInput } from "../internal.ts";
import { EntityListInput } from "../internal.ts";
import { ExpResType } from "../internal.ts";
import { ExpressionInput } from "../internal.ts";
import type { Input } from "../input/Input.ts";
import type { InputCallback } from "../input/InputCallback.ts";
import { IntegerListInput } from "../internal.ts";
import { InterfaceEntityListInput } from "../internal.ts";
import { defineOutput } from "../internal.ts";
import { UnitTypeListInput } from "../internal.ts";
import { StateEntity } from "../internal.ts";
import type { StateEntityListener } from "../states/StateEntityListener.ts";
import type { StateRecord } from "../states/StateRecord.ts";
import { DimensionlessUnit } from "../internal.ts";
import { TimeUnit } from "../internal.ts";
import { Logger } from "../internal.ts";

// SubjectEntityClass は basicsim/SubjectEntity.ts の共通の物を使う

export class ExpressionLogger extends Logger implements StateEntityListener, ObserverEntity {

	private readonly interval: SampleInput;

	private readonly stateTraceList: EntityListInput<StateEntity>;

	private readonly valueUnitTypeList: UnitTypeListInput;

	private readonly valueTraceList: StringProvListInput;

	private readonly valuePrecisionList: IntegerListInput;

	protected readonly watchList: InterfaceEntityListInput<SubjectEntity>;

	private readonly verifyWatchList: BooleanProvInput;

	private readonly watchListCondition: ExpressionInput;

	private readonly lastValueList: string[];
	private watchedEntity: Entity | null = null;  // last subject entity that triggered a log entry

	protected readonly endActionTarget: EntityTarget<ExpressionLogger>;
	private readonly valueChangedConditional: Conditional;
	private readonly doValueTraceTarget: EntityTarget<ExpressionLogger>;

	static readonly unitLastValueListCallback: InputCallback = {
		callback(ent: Entity, inp: Input<unknown>): void {
			(ent as ExpressionLogger).updateLastValueList();
		},
	};

	constructor() {
		super();

		// Java のフィールドの初期値（初期化ブロックの前に書かれている）
		this.lastValueList = [];

		// Java の初期化ブロック
		this.interval = new SampleInput("Interval", Entity.KEY_INPUTS, Double.NaN);
		this.setKeywordDoc(this.interval, "A fixed interval at which entries will be written to the log file. "
		                     + "This input is optional if state tracing or value tracing is "
		                     + "specified.",
		         [ "24.0 h" ]);
		this.interval.setUnitType(TimeUnit);
		this.interval.setValidRange(1.0e-10, Double.POSITIVE_INFINITY);
		this.addInput(this.interval);

		this.stateTraceList = new EntityListInput<StateEntity>(StateEntity, "StateTraceList", Entity.KEY_INPUTS,
				[] as StateEntity[]);
		this.setKeywordDoc(this.stateTraceList, "A list of entities whose states will be traced. "
		                     + "An entry in the log file is made every time one of the entities "
		                     + "changes state. "
		                     + "Each entity's state is included automatically in the log file.",
		         [ "Server1 ExpressionThreshold1" ]);
		this.addInput(this.stateTraceList);

		this.valueUnitTypeList = new UnitTypeListInput("ValueUnitTypeList", Entity.KEY_INPUTS,	null);
		this.setKeywordDoc(this.valueUnitTypeList, "Not Used", []);
		this.valueUnitTypeList.setHidden(true);
		this.addInput(this.valueUnitTypeList);

		this.valueTraceList = new StringProvListInput("ValueTraceList", Entity.KEY_INPUTS,
				[] as StringProvider[]);
		this.setKeywordDoc(this.valueTraceList, "One or more sources of data whose values will be traced. "
		                     + "An entry in the log file is made every time one of the data sources "
		                     + "changes value. "
		                     + "Each data source's value is included automatically in the log file.\n\n"
		                     + "It is best to include only dimensionless quantities and non-numeric "
		                     + "outputs in the ValueTraceList input. "
		                     + "An output with dimensions can be made non-dimensional by dividing it "
		                     + "by 1 in the desired unit, e.g. '[Queue1].AverageQueueTime / 1[h]' is "
		                     + "the average queue time in hours."
		                     + "A dimensional number will be displayed along with its unit. "
		                     + "The 'format' function can be used if a fixed number of decimal places "
		                     + "is required.",
		         ["{ [Queue1].QueueLengthAverage }"
		        + " { '[Queue1].AverageQueueTime / 1[h]' }"]);
		this.valueTraceList.setCallback(ExpressionLogger.unitLastValueListCallback);
		this.addInput(this.valueTraceList);

		this.valuePrecisionList = new IntegerListInput("ValuePrecisionList", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.valuePrecisionList, "Not Used", []);
		this.valuePrecisionList.setHidden(true);
		this.addInput(this.valuePrecisionList);

		this.watchList = new InterfaceEntityListInput<SubjectEntity>(SubjectEntityClass, "WatchList", Entity.KEY_INPUTS, []);
		this.setKeywordDoc(this.watchList, "An optional list of objects to monitor.\n\n"
		                     + "If the WatchList input is provided, the ExpressionLogger evaluates "
		                     + "its ValueTraceList expression inputs ONLY when triggered by an object "
		                     + "in its WatchList. "
		                     + "This is much more efficient than the default behaviour which "
		                     + "evaluates these expressions at every event time.\n\n"
		                     + "Care must be taken to ensure that the WatchList input includes every "
		                     + "object that can trigger a change in a ValueTraceList expression. "
		                     + "Normally, the WatchList should include every object that is referenced "
		                     + "directly or indirectly by these expressions. "
		                     + "The VerfiyWatchList input can be used to ensure that the WatchList "
		                     + "includes all the necessary objects.",
		         ["Object1  Object2"]);
		this.watchList.setIncludeSelf(false);
		this.watchList.setUnique(true);
		this.addInput(this.watchList);

		this.verifyWatchList = new BooleanProvInput("VerifyWatchList", Entity.KEY_INPUTS, false);
		this.setKeywordDoc(this.verifyWatchList, "Allows the user to verify that the input to the 'WatchList' keyword "
		                     + "includes all the objects that can trigger a change in a "
		                     + "ValueTraceList expression. "
		                     + "When set to TRUE, the ExpressionThreshold uses both the normal logic "
		                     + "and the WatchList logic to test the ValueTraceList expressions. "
		                     + "An error message is generated if a ValueTraceList expression changes "
		                     + "its value without being triggered by a WatchList object.", []);
		this.addInput(this.verifyWatchList);

		this.watchListCondition = new ExpressionInput("WatchListCondition", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.watchListCondition, "A logical condition that determines whether to record a log entry "
		                     + "that is triggered by a change to one of the objects in the "
		                     + "'WatchList'. "
		                     + "An entry in the 'ValueTraceList' is not required to trigger this type "
		                     + "of log entry. "
		                     + "The output 'WatchedEntity' can be used in the expression to represent "
		                     + "the 'WatchList' entity that changed.",
		         [ "'[Queue1].QueueLength > 3'" ]);
		this.watchListCondition.setUnitType(DimensionlessUnit);
		this.watchListCondition.setResultType(ExpResType.NUMBER);
		this.watchListCondition.setDefaultText(BooleanInput.FALSE);
		this.addInput(this.watchListCondition);

		// Java のフィールドの初期値（初期化ブロックの後に書かれている）
		this.endActionTarget = new EndActionTarget(this);
		this.valueChangedConditional = new ValueChangedConditional(this);
		this.doValueTraceTarget = new DoValueTraceTarget(this);
	}

	updateLastValueList(): void {
		this.lastValueList.length = 0;
		for (let i=0; i<this.valueTraceList.getListSize(); i++) {
			this.lastValueList.push("");
		}
	}

	override earlyInit(): void {
		super.earlyInit();
		this.valueUnitTypeList.reset();
		this.valuePrecisionList.reset();
	}

	override lateInit(): void {
		super.lateInit();
		ObserverEntity.registerWithSubjects(this, this.getWatchList());
	}

	override startUp(): void {
		super.startUp();

		if (!this.isActive())
			return;

		// Start tracing the expression values
		if (this.valueTraceList.getListSize() > 0) {
			for (let i=0; i<this.valueTraceList.getListSize(); i++) {
				const str = this.valueTraceList.getNextString(i, this, EventManager.simSeconds());
				this.lastValueList[i] = str;
			}

			// If there is no WatchList, the open/close expressions are tested after every event
			if (!this.isWatchList() || this.isVerifyWatchList(0.0))
				this.doValueTrace();
		}

		// Start log entries at fixed intervals
		if (!this.interval.isDefault())
			EventManager.scheduleSeconds(this.getStartTime(EventManager.simSeconds()), Entity.PRI_NORMAL, Entity.EVT_LIFO, this.endActionTarget, null);
	}

	getWatchList(): SubjectEntity[] {
		if (!this.isActive())
			return [];
		return this.watchList.getValue();
	}

	isVerifyWatchList(simTime: number): boolean {
		return this.verifyWatchList.getNextBoolean(this, simTime);
	}

	isWatchList(): boolean {
		return this.getWatchList().length !== 0;
	}

	observerUpdate(subj: SubjectEntity): void {
		const ent = subj as unknown as DisplayEntity;
		if (this.isValueChanged() || this.testWatchListCondition(ent)) {
			this.watchedEntity = ent;
			this.scheduleLogEntry();
		}
	}

	private testWatchListCondition(ent: Entity): boolean {
		if (this.watchListCondition.isDefault())
			return false;

		// Temporarily set the watched entity so that the expression can be evaluated
		const lastEnt = this.watchedEntity;
		this.watchedEntity = ent;

		// Evaluate the open condition (0 = false, non-zero = true)
		const ret = this.watchListCondition.getNextResult(this, EventManager.simSeconds()).value !== 0;

		// Reset the original watched entity
		this.watchedEntity = lastEnt;

		return ret;
	}

	protected override printColumnTitles(file: FileEntity): void {

		// Traced entities
		for (const ent of this.stateTraceList.getValue()!) {
			file.format("\t[%s].State", ent.getName());
		}

		// Traced values
		const valToks: string[] = [];
		this.valueTraceList.getValueTokens(valToks);
		for (const str of valToks) {
			if (str === "{" || str === "}")
				continue;
			file.format("\t%s", str);
		}
	}

	private startAction(): void {

		// Schedule the next time an entry in the log file will be written
		const dur = this.interval.getNextSample(this, EventManager.simSeconds());
		EventManager.scheduleSeconds(dur, Entity.PRI_NORMAL, Entity.EVT_LIFO, this.endActionTarget, null);
	}

	endAction(): void {

		// Stop the log if the end time has been reached
		const simTime = EventManager.simSeconds();
		if (simTime > this.getEndTime(simTime))
			return;

		// Record the entry in the log
		this.scheduleLogEntry();

		// Get ready for the next entry
		this.startAction();
	}

	protected override recordEntry(file: FileEntity, simTime: number, dEnt: DisplayEntity | null): void {

		// Write the state values
		for (const ent of this.stateTraceList.getValue()!) {
			file.format("\t%s", ent.getPresentState(simTime));
		}

		try {
			// Write the traced expression values
			for (let i=0; i<this.valueTraceList.getListSize(); i++) {
				const str = this.valueTraceList.getNextString(i, this, simTime);
				file.format("\t%s", str);

				// Update the saved values
				this.lastValueList[i] = str;
			}
		}
		catch (e) {
			this.error((e as Error).message);
		}
	}

	isWatching(ent: StateEntity): boolean {
		return this.stateTraceList.getValue()!.includes(ent);
	}

	updateForStateChange(ent: StateEntity, prev: StateRecord, next: StateRecord): void {
		this.scheduleLogEntry();
	}

	/**
	 * Returns true if any of the traced expressions have changed their values.
	 */
	isValueChanged(): boolean {
		let ret = false;
		const simTime = EventManager.simSeconds();
		try {
			for (let i=0; i<this.valueTraceList.getListSize(); i++) {
				const str = this.valueTraceList.getNextString(i, this, simTime);
				if (str !== this.lastValueList[i]) {
					this.lastValueList[i] = str;
					ret = true;
				}
			}
		}
		catch (e) {
			this.error((e as Error).message);
		}
		return ret;
	}

	/**
	 * Writes a record to the log file whenever one of the traced expressions changes its value.
	 */
	doValueTrace(): void {

		// Stop tracing if the end time has been reached
		const simTime = EventManager.simSeconds();
		if (simTime > this.getEndTime(simTime))
			return;

		// Record the entry in the log
		this.scheduleLogEntry();

		// Wait for the next value change
		EventManager.scheduleUntil(this.doValueTraceTarget, this.valueChangedConditional, null);
	}

	getWatchedEntity(simTime: number): Entity | null {
		return this.watchedEntity;
	}

}

/** Java の名前の無い EntityTarget（endActionTarget） */
class EndActionTarget extends EntityTarget<ExpressionLogger> {
	constructor(ent: ExpressionLogger) {
		super(ent, "endAction");
	}

	override process(): void {
		this.ent.endAction();
	}
}

/** Java の入れ子のクラス ValueChangedConditional */
class ValueChangedConditional implements Conditional {
	private readonly ent: ExpressionLogger;

	constructor(ent: ExpressionLogger) {
		this.ent = ent;
	}

	evaluate(): boolean {
		return this.ent.isValueChanged();
	}
}

/** Java の名前の無い EntityTarget（doValueTraceTarget） */
class DoValueTraceTarget extends EntityTarget<ExpressionLogger> {
	constructor(ent: ExpressionLogger) {
		super(ent, "doValueTrace");
	}

	override process(): void {
		const simTime = EventManager.simSeconds();
		if (this.ent.isVerifyWatchList(simTime))
			this.ent.error(tr(ObserverEntity.ERR_WATCHLIST));
		this.ent.doValueTrace();
	}
}

ClassRegistry.register("com.jaamsim.BasicObjects.ExpressionLogger", ExpressionLogger);

defineOutput(ExpressionLogger, {
	name: "WatchedEntity",
	description: "The entity in the WatchList input that triggered the most recent log entry.",
	unitType: DimensionlessUnit, reportable: false, sequence: 1,
	returnType: "Entity",
	get: (e, simTime) => e.getWatchedEntity(simTime),
});
