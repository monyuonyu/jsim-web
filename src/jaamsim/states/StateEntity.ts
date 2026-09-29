/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2014 Ausenco Engineering Canada Inc.
 * Copyright (C) 2018-2024 JaamSim Software Inc.
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

// 多重定義は、引数の数で 1 つの関数の中で見分けた（名前は変えていない）:
//   getState() / getState(String)、isWorkingState() / isWorkingState(double)、
//   getWorkingTime() / getWorkingTime(double)、getTicksInState(StateRecord) / getTicksInState(long, StateRecord)、
//   getCurrentCycleTicks(StateRecord) / getCurrentCycleTicks(long, StateRecord)
// 入れ子のクラス StateRecSort は、getStateRecs の中の比較の関数にした。
//
// states（Java の HashMap）を回している所（clearStatistics, collectCycleStats, getTimeInWorkingState,
// getTotalTimeInState, getTotalTime, getTotalTimeInCycle）は、各要素の独立の処理か long（整数）の足し算なので、
// 順番は結果に効かない。getStateRecs は名前で並べ替えている。

import { DisplayEntity } from "../Graphics/DisplayEntity.ts";
import { Entity } from "../basicsim/Entity.ts";
import { FileEntity } from "../basicsim/FileEntity.ts";
import { isSubjectEntity } from "../basicsim/SubjectEntity.ts";
import { EventManager } from "../events/EventManager.ts";
import { BooleanProvInput } from "../BooleanProviders/BooleanProvInput.ts";
import { ColourInput } from "../input/ColourInput.ts";
import { StringKeyInput } from "../input/StringKeyInput.ts";
import { StringListInput } from "../input/StringListInput.ts";
import type { Color4d } from "../math/Color4d.ts";
import { DimensionlessUnit } from "../units/DimensionlessUnit.ts";
import { TimeUnit } from "../units/TimeUnit.ts";
import { defineOutput } from "../input/OutputRegistry.ts";
import { jCompare } from "../java/lang.ts";
import { StateRecord } from "./StateRecord.ts";
import { isStateEntityListener } from "./StateEntityListener.ts";
import type { StateEntityListener } from "./StateEntityListener.ts";
import type { StateUser } from "./StateUser.ts";

export abstract class StateEntity extends DisplayEntity implements StateUser {

	protected readonly stateGraphics: StringKeyInput<DisplayEntity>;

	private readonly traceState: BooleanProvInput;

	protected readonly workingStateListInput: StringListInput;

	private presentState: StateRecord | null = null; // The present state of the entity
	private readonly states: Map<string, StateRecord>;
	private readonly stateListeners: StateEntityListener[];

	private lastStateCollectionTick = 0;
	private workingTicks = 0;
	private useCurrentCycle = false;

	protected stateReportFile: FileEntity | null = null;        // The file to store the state information

	protected static readonly STATE_IDLE = "Idle";
	protected static readonly STATE_WORKING = "Working";
	protected static readonly STATE_INACTIVE = "Inactive";

	protected static readonly COL_IDLE: Color4d = ColourInput.LIGHT_GREY;
	protected static readonly COL_WORKING: Color4d = ColourInput.GREEN;
	protected static readonly COL_INACTIVE: Color4d = ColourInput.WHITE;

	constructor() {
		super();

		// Java の初期化ブロック
		this.stateGraphics = new StringKeyInput<DisplayEntity>(DisplayEntity, "StateGraphics", Entity.FORMAT);
		this.setKeywordDoc(this.stateGraphics,
				"A list of state/DisplayEntity pairs. For each state, the graphics "
				+ "will be changed to those for the corresponding DisplayEntity.",
				["{ idle DisplayEntity1 } { working DisplayEntity2 }"]);
		this.stateGraphics.setHidden(true);
		this.addInput(this.stateGraphics);

		this.traceState = new BooleanProvInput("TraceState", Entity.KEY_INPUTS, false);
		this.setKeywordDoc(this.traceState,
				"If TRUE, a log file (.trc) will be printed with the time of every state change during the run.",
				[]);
		this.traceState.setHidden(true);
		this.addInput(this.traceState);

		this.workingStateListInput = new StringListInput("WorkingStateList", Entity.MAINTENANCE, []);
		this.setKeywordDoc(this.workingStateListInput,
				"A list of states for which the entity is considered working.",
				["'Transit - Seg1L' 'Transit - Seg1B'"]);
		this.addInput(this.workingStateListInput);

		// Java のコンストラクタの本体
		this.states = new Map<string, StateRecord>();
		this.stateListeners = [];
	}

	override earlyInit(): void {
		super.earlyInit();

		this.initStateData();

		if (this.isGenerated())
			return;

		// Create state trace file if required
		if (this.isTraceState()) {
			const simModel = this.getJaamSimModel();
			const fileName = simModel.getReportFileName("-" + this.getName() + ".trc");
			if (fileName == null)
				this.error("Cannot create the trace file");
			// TODO(移植): Java は File f を作り、f.exists() && !f.delete() なら
			//   error("Cannot delete the existing trace file %s", f) にする。ファイルの有無と削除は FileEntity に任せた
			this.stateReportFile = new FileEntity(simModel, fileName as string);
		}
	}

	override lateInit(): void {
		super.lateInit();

		this.stateListeners.length = 0;

		if (!this.isRegistered())
			return;

		// Java: getClonesOfIterator(Entity.class, StateEntityListener.class)（interface は判定の関数で渡す）
		for (const ent of this.getJaamSimModel().getClonesOfIterator(Entity, isStateEntityListener)) {
			const sel = ent as unknown as StateEntityListener;
			if (sel.isWatching(this))
				this.addStateListener(sel);
		}
	}

	override doEnd(): void {
		super.doEnd();
		if (this.stateReportFile == null)
			return;
		this.stateReportFile.flush();

		// Close the state trace file
		if (this.getJaamSimModel().isLastRun()) {
			this.stateReportFile.close();
			this.stateReportFile = null;
		}
	}

	override close(): void {
		super.close();
		if (this.stateReportFile == null)
			return;
		this.stateReportFile.flush();
		this.stateReportFile.close();
		this.stateReportFile = null;
	}

	isTraceState(): boolean {
		return this.traceState.getNextBoolean(this, 0.0);
	}

	private initStateData(): void {
		this.lastStateCollectionTick = 0;
		if (EventManager.hasCurrent())
			this.lastStateCollectionTick = EventManager.simTicks();
		this.workingTicks = 0;
		this.states.clear();
		this.useCurrentCycle = false;

		const init = this.createRecord(this.getInitialState());
		init.setStartTick(this.lastStateCollectionTick);
		this.presentState = init;
		this.states.set(init.getName(), init);
	}

	addStateListener(listener: StateEntityListener): void {
		this.stateListeners.push(listener);
	}

	getStateListeners(): StateEntityListener[] {
		return this.stateListeners;
	}

	/**
	 * Get the name of the initial state this Entity will be initialized with.
	 */
	getInitialState(): string {
		return this.isActive() ? StateEntity.STATE_IDLE : StateEntity.STATE_INACTIVE;
	}

	/**
	 * Tests the given state name to see if it is valid for this Entity.
	 * @param state
	 */
	isValidState(state: string): boolean {
		return StateEntity.STATE_IDLE === state || StateEntity.STATE_WORKING === state
				|| StateEntity.STATE_INACTIVE === state;
	}

	/**
	 * Tests the given state name to see if it is counted as working hours when in
	 * that state..
	 * @param state
	 */
	isValidWorkingState(state: string): boolean {

		if (this.workingStateListInput.getValue().length > 0)
			return this.workingStateListInput.getValue().includes(state);

		return StateEntity.STATE_WORKING === state;
	}

	setPresentState(state: string): void {
		if (this.presentState == null)
			this.initStateData();

		if (this.presentState!.getName() === state)
			return;

		let nextState = this.states.get(state) ?? null;
		if (nextState == null) {
			if (!this.isValidState(state))
				this.error("Specified state: %s is not valid", state);

			nextState = this.createRecord(state);
			this.states.set(nextState.getName(), nextState);
		}

		this.updateStateStats();
		nextState.setStartTick(this.lastStateCollectionTick);

		const prev = this.presentState!;
		this.presentState = nextState;
		this.stateChanged(prev, this.presentState);
	}

	/**
	 * A callback subclasses can override that is called on each state transition.
	 *
	 * The state has already been updated when this is called so presentState == next
	 * @param prev the state this Entity was in previously
	 * @param next the state this Entity is currently in
	 */
	stateChanged(prev: StateRecord, next: StateRecord): void {

		if (this.isTraceState()) {
			const curTick = EventManager.simTicks();
			const evt = EventManager.current();
			const duration = evt.ticksToSeconds(curTick - prev.getStartTick());
			const timeOfPrevStart = evt.ticksToSeconds(prev.getStartTick());
			this.stateReportFile!.format("%.5f  %s.setState( \"%s\" ) dt = %g\n",
			                       timeOfPrevStart, this.getName(),
			                       prev.getName(), duration);
			this.stateReportFile!.flush();
		}

		// Notify the state listeners
		for (const each of this.stateListeners) {
			each.updateForStateChange(this, prev, next);
		}

		// Notify the observers
		if (isSubjectEntity(this))
			this.notifyObservers();
	}

	/**
	 * Update the statistics kept for ticks in the presentState
	 */
	private updateStateStats(): void {
		const curTick = EventManager.simTicks();
		if (curTick === this.lastStateCollectionTick)
			return;

		const durTicks = curTick - this.lastStateCollectionTick;
		this.lastStateCollectionTick = curTick;

		this.presentState!.addTicks(durTicks);
		if (this.presentState!.isWorking())
			this.workingTicks += durTicks;
	}

	/**
	 * Runs after initialization period
	 */
	override clearStatistics(): void {
		super.clearStatistics();
		this.updateStateStats();
		for (const each of this.states.values()) {
			each.finishWarmUp();
		}
	}

	/**
	 * Runs when cycle is finished
	 */
	collectCycleStats(): void {
		this.updateStateStats();
		this.useCurrentCycle = true;
		for (const each of this.states.values()) {
			each.finishCycle();
		}
	}

	private createRecord(state: string): StateRecord {
		return new StateRecord(state, this.isValidWorkingState(state));
	}

	addState(str: string): void {
		if (this.states.get(str) != null)
			return;
		if (!this.isValidState(str))
			this.error("Specified state: %s is not valid", str);

		const stateRec = this.createRecord(str);
		this.states.set(stateRec.getName(), stateRec);
	}

	/** getState(String state): その名前の記録（無ければ null）。getState(): 今の状態の記録 */
	getState(state?: string): StateRecord | null {
		if (state !== undefined)
			return this.states.get(state) ?? null;
		return this.presentState;
	}

	getStateRecs(): StateRecord[] {
		const recs: StateRecord[] = [];
		for (const rec of this.states.values())
			recs.push(rec);
		// Java: Collections.sort(recs, new StateRecSort())（名前の compareTo。安定な並べ替え）
		recs.sort((sr1, sr2) => jCompare(sr1.getName(), sr2.getName()));
		return recs;
	}

	/**
	 * isWorkingState(): StateUser の関数（Java の isWorkingState()）。
	 * isWorkingState(simTime): 出力 "WorkingState"（Java の isWorkingState(double)）。
	 */
	isWorkingState(simTime?: number): boolean {
		if (simTime === undefined) {
			return this.presentState!.isWorking();
		}
		if (this.presentState == null) {
			return this.isValidWorkingState(this.getInitialState());
		}
		return this.presentState.isWorking();
	}

	/**
	 * A helper used to implement some of the state-based outputs, likely not
	 * useful for model code.
	 * @param simTicks
	 * @param state
	 */
	getTicksInState(simTicks: number, state: StateRecord | null): number;
	getTicksInState(state: StateRecord | null): number;
	getTicksInState(a: number | StateRecord | null, b?: StateRecord | null): number {
		if (b === undefined)
			return this.getTicksInState(EventManager.simTicks(), a as StateRecord | null);

		const simTicks = a as number;
		const state = b;
		if (state == null)
			return 0;

		let ticks = state.getTotalTicks();
		if (this.getState() === state)
			ticks += (simTicks - this.lastStateCollectionTick);
		return ticks;
	}

	getCurrentCycleTicks(simTicks: number, state: StateRecord | null): number;
	getCurrentCycleTicks(state: StateRecord | null): number;
	getCurrentCycleTicks(a: number | StateRecord | null, b?: StateRecord | null): number {
		if (b === undefined)
			return this.getCurrentCycleTicks(EventManager.simTicks(), a as StateRecord | null);

		const simTicks = a as number;
		const state = b;
		if (state == null)
			return 0;

		let ticks = state.getCurrentCycleTicks();
		if (this.getState() === state)
			ticks += (simTicks - this.lastStateCollectionTick);
		return ticks;
	}

	getCompletedCycleTicks(state: StateRecord | null): number {
		if (state == null)
			return 0;

		return state.getCompletedCycleTicks();
	}

	getInitTicks(state: StateRecord | null): number {
		if (state == null)
			return 0;

		return state.getInitTicks();
	}

	private getWorkingTicks(simTicks: number): number {
		let ticks = this.workingTicks;
		if (this.presentState!.isWorking())
			ticks += (simTicks - this.lastStateCollectionTick);

		return ticks;
	}

	/**
	 * getWorkingTime(): Returns the number of seconds that the entity has been in use.
	 * getWorkingTime(simTime): 出力 "WorkingTime"（Java の getWorkingTime(double)）。
	 */
	getWorkingTime(simTime?: number): number {
		if (simTime === undefined) {
			const ticks = this.getWorkingTicks(EventManager.simTicks());
			return EventManager.current().ticksToSeconds(ticks);
		}
		if (this.presentState == null) {
			return 0.0;
		}
		const evt = this.getJaamSimModel().getEventManager();
		const simTicks = evt.secondsToNearestTick(simTime);
		const ticks = this.getWorkingTicks(simTicks);
		return evt.ticksToSeconds(ticks);
	}

	/**
	 * Returns the elapsed time in seconds after the completion of the initialisation period
	 * that the entity has been in the specified state.
	 * @param simTime - present simulation time
	 * @param state - string representing the state
	 */
	getTimeInState(simTime: number, state: string): number {
		const evt = this.getJaamSimModel().getEventManager();
		const simTicks = evt.secondsToNearestTick(simTime);
		const rec = this.states.get(state) ?? null;
		if (rec == null)
			return 0.0;
		const ticks = this.getTicksInState(simTicks, rec);
		return evt.ticksToSeconds(ticks);
	}

	/**
	 * Returns the total elapsed time in seconds after the completion of the initialisation period
	 * during which the entity has been in a state that has been labelled as 'working'.
	 * @param simTime - present simulation time
	 * @return total time in a 'working' state
	 */
	getTimeInWorkingState(simTime: number): number {
		const evt = this.getJaamSimModel().getEventManager();
		const simTicks = evt.secondsToNearestTick(simTime);
		let ticks = 0;
		for (const rec of this.states.values()) {
			if (!rec.isWorking())
				continue;
			ticks += this.getTicksInState(simTicks, rec);
		}
		return evt.ticksToSeconds(ticks);
	}

	/**
	 * Returns the total elapsed time in seconds after the completion of the initialisation period
	 * the entity has been in any state that ends in the specified string.
	 * @param simTime - present simulation time
	 * @param state - string representing the specified type of state
	 * @return total time
	 */
	getTotalTimeInState(simTime: number, state: string): number {
		const evt = this.getJaamSimModel().getEventManager();
		const simTicks = evt.secondsToNearestTick(simTime);
		let ticks = 0;
		for (const [key, value] of this.states.entries()) {
			if (key.endsWith(state)) {
				ticks += this.getTicksInState(simTicks, value);
			}
		}
		return evt.ticksToSeconds(ticks);
	}

	/**
	 * Returns the total elapsed time in seconds after the completion of the initialisation period.
	 * Includes the time in any completed cycles.
	 * @param simTime - present simulation time
	 * @return total time in any state
	 */
	getTotalTime(simTime: number): number {
		const evt = this.getJaamSimModel().getEventManager();
		const simTicks = evt.secondsToNearestTick(simTime);
		let ticks = 0;
		for (const rec of this.states.values()) {
			ticks += this.getTicksInState(simTicks, rec);
		}
		return evt.ticksToSeconds(ticks);
	}

	override updateGraphics(simTime: number): void {
		super.updateGraphics(simTime);

		if (this.stateGraphics.getValue() == null || this.presentState == null)
			return;

		const ent = this.stateGraphics.getValueFor(this.presentState.getName());
		if (ent == null) {
			this.setDisplayModelList(this.displayModelListInput.getValue());
			this.setSize(this.sizeInput.getValue());
			this.setOrientation(this.orientationInput.getValue());
			this.setAlignment(this.alignmentInput.getValue());
			return;
		}

		this.setDisplayModelList(ent.getDisplayModelList());
		this.setSize(ent.getSize());
		this.setOrientation(ent.getOrientation());
		this.setAlignment(ent.getAlignment());
	}

	getPresentState(simTime: number): string {
		if (this.presentState == null) {
			return this.getInitialState();
		}
		return this.presentState.getName();
	}

	getStateTimes(simTime: number): Map<string, number> {
		const evt = this.getJaamSimModel().getEventManager();
		const simTicks = evt.secondsToNearestTick(simTime);
		const ret = new Map<string, number>();
		for (const stateRec of this.getStateRecs()) {
			let ticks = this.getTicksInState(simTicks, stateRec);
			if (this.useCurrentCycle)
				ticks = this.getCurrentCycleTicks(simTicks, stateRec);
			const t = evt.ticksToSeconds(ticks);
			ret.set(stateRec.getName(), t);
		}
		return ret;
	}

	getTotalTimeInCycle(simTime: number): number {
		const evt = this.getJaamSimModel().getEventManager();
		const simTicks = evt.secondsToNearestTick(simTime);
		let ticks = 0;
		for (const stateRec of this.states.values()) {
			if (this.useCurrentCycle) {
				ticks += this.getCurrentCycleTicks(simTicks, stateRec);
			}
			else {
				ticks += this.getTicksInState(simTicks, stateRec);
			}
		}
		return evt.ticksToSeconds(ticks);
	}

}

// ---- 出力（Java の @Output） ----

defineOutput(StateEntity, {
	name: "State",
	description: "The present state for the object.",
	unitType: DimensionlessUnit,
	sequence: 0,
	returnType: "String",
	get: (e, simTime) => e.getPresentState(simTime),
});

defineOutput(StateEntity, {
	name: "WorkingState",
	description: "Returns TRUE if the present state is one of the 'working' states.",
	unitType: DimensionlessUnit,
	sequence: 1,
	returnType: "boolean",
	get: (e, simTime) => e.isWorkingState(simTime),
});

defineOutput(StateEntity, {
	name: "WorkingTime",
	description: "The total time recorded for the working states, including the "
	           + "initialisation period. Breakdown events can be triggered by elapsed "
	           + "working time instead of calendar time.",
	unitType: TimeUnit,
	sequence: 2,
	returnType: "double",
	get: (e, simTime) => e.getWorkingTime(simTime),
});

defineOutput(StateEntity, {
	name: "StateTimes",
	description: "The total time recorded for each state after the completion of "
	           + "the initialisation period. Includes only the present cycle, if applicable.",
	unitType: TimeUnit,
	reportable: true,
	sequence: 3,
	returnType: "LinkedHashMap",
	get: (e, simTime) => e.getStateTimes(simTime),
});

defineOutput(StateEntity, {
	name: "TotalTime",
	description: "The total time the entity has spent in the model after the completion of "
	           + "the initialisation period. It is equal to the sum of the state times. "
	           + "Includes only the present cycle, if applicable.",
	unitType: TimeUnit,
	reportable: true,
	sequence: 4,
	returnType: "double",
	get: (e, simTime) => e.getTotalTimeInCycle(simTime),
});
