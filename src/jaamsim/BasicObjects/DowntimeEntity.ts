/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2014 Ausenco Engineering Canada Inc.
 * Copyright (C) 2016-2026 JaamSim Software Inc.
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

// 入れ子のクラス EndDowntimeTarget・ScheduleDowntimeTarget・PrepareForDowntimeTarget は、ファイルの中のクラスにした。
// 多重定義の扱い:
// - setPresentState()（この部品の状態を決める）と、親の setPresentState(String) は、引数があるかどうかで見分ける
// - getEndTime() と出力の getEndTime(double simTime) は同じ値なので 1 つの関数（simTime は省略できる）

import { Double, Integer, jRemove, jstr } from "../internal.ts";
import { ClassRegistry } from "../internal.ts";
import { BooleanProvInput } from "../internal.ts";
import { SampleInput } from "../internal.ts";
import { SampleListInput } from "../internal.ts";
import type { SampleProvider } from "../Samples/SampleProvider.ts";
import { Entity } from "../internal.ts";
import { EntityTarget } from "../internal.ts";
import { EventHandle } from "../internal.ts";
import { EventManager } from "../internal.ts";
import { ProcessTarget } from "../internal.ts";
import { EntityInput } from "../internal.ts";
import { InterfaceEntityListInput } from "../internal.ts";
import { defineOutput } from "../internal.ts";
import { AbstractResourceProvider } from "../internal.ts";
import { ResourceProvider } from "../internal.ts";
import type { ResourceUser } from "../resourceObjects/ResourceUser.ts";
import { ResourceUserDelegate } from "../internal.ts";
import { isDowntimeUser } from "../internal.ts";
import { type DowntimeUser } from "../states/DowntimeUser.ts";
import { StateEntity } from "../internal.ts";
import type { StateEntityListener } from "../states/StateEntityListener.ts";
import type { StateRecord } from "../states/StateRecord.ts";
import { DimensionlessUnit } from "../internal.ts";
import { TimeUnit } from "../internal.ts";

/** Java の (int) の型変換（0 の方向へ切り捨て、NaN は 0、範囲の外は端に張り付く） */
function toInt(x: number): number {
	if (Number.isNaN(x)) return 0;
	if (x >= Integer.MAX_VALUE) return Integer.MAX_VALUE;
	if (x <= Integer.MIN_VALUE) return Integer.MIN_VALUE;
	return Math.trunc(x);
}

const STATE_DOWNTIME = "Downtime";
const STATE_WAITING_FOR_RESOURCES = "WaitingForResources";

export class DowntimeEntity extends StateEntity implements StateEntityListener, ResourceUser {

	private readonly firstDowntime: SampleInput;

	private readonly iatWorkingEntity: EntityInput<StateEntity>;

	private readonly durationWorkingEntity: EntityInput<StateEntity>;

	private readonly downtimeIATDistribution: SampleInput;

	private readonly downtimeDurationDistribution: SampleInput;

	protected readonly concurrent: BooleanProvInput;

	protected readonly maxDowntimesPending: SampleInput;

	protected readonly completionTimeLimit: SampleInput;

	protected readonly resourceList: InterfaceEntityListInput<ResourceProvider>;

	private readonly numberOfUnitsList: SampleListInput;

	private readonly downtimeUserList: DowntimeUser[];  // entities that use this downtime entity
	private down = false;             // true for the duration of a downtime event
	private downtimePendings = 0;    // number of queued downtime events
	private downtimePendingStartTime = 0; // the simulation time in seconds at which the downtime pending started

	private secondsForNextFailure = 0;    // The number of working seconds required before the next downtime event
	private secondsForNextRepair = 0;    // The number of working seconds required before the downtime event ends

	private numberStarted = 0;       // Number of downtime events that have been started
	private numberCompleted = 0;     // Number of downtime events that have been completed
	private startTime = 0;        // The start time of the latest downtime event
	private endTime = 0;          // the end time of the latest downtime event
	private downDuration = 0;     // repair time for the latest downtime event

	private numLateEvents = 0;    // Number of events that did not finish within the completion time limit
	private targetCompletionTime = 0; // the time that the latest downtime event should be completed

	private totalLateTime = 0;  // Total time after completion time limit that the downtime took to complete

	private resUserDelegate: ResourceUserDelegate | null = null;
	private seizedUnits: number[] = [];

	private readonly endDowntimeTarget: ProcessTarget;
	private readonly endDowntimeHandle: EventHandle;
	private readonly scheduleDowntimeTarget: ProcessTarget;
	private readonly scheduleDowntimeHandle: EventHandle;

	constructor() {
		super();

		// Java の初期化ブロック
		this.workingStateListInput.setHidden(true);

		this.firstDowntime = new SampleInput("FirstDowntime", Entity.KEY_INPUTS, Double.NaN);
		this.setKeywordDoc(this.firstDowntime, "The calendar or working time for the first planned or unplanned "
		                     + "maintenance event. If an input is not provided, the first maintenance "
		                     + "event is determined by the input for the Interval keyword.",
		         ["720 h", "UniformDistribution1" ]);
		this.firstDowntime.setUnitType(TimeUnit);
		this.addInput(this.firstDowntime);

		this.iatWorkingEntity = new EntityInput<StateEntity>(StateEntity, "IntervalWorkingEntity", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.iatWorkingEntity, "The object whose working time determines the occurrence of the "
		                     + "planned or unplanned maintenance events. Calendar time is used if "
		                     + "the input is left blank.", []);
		this.addInput(this.iatWorkingEntity);
		this.addSynonym(this.iatWorkingEntity, "IATWorkingEntity");

		this.durationWorkingEntity = new EntityInput<StateEntity>(StateEntity, "DurationWorkingEntity", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.durationWorkingEntity, "The object whose working time determines the completion of the "
		                     + "planned or unplanned maintenance activity. Calendar time is used if "
		                     + "the input is left blank.", []);
		this.addInput(this.durationWorkingEntity);

		this.downtimeIATDistribution = new SampleInput("Interval", Entity.KEY_INPUTS, Double.NaN);
		this.setKeywordDoc(this.downtimeIATDistribution, "The calendar or working time between the start of the last planned or "
		                     + "unplanned maintenance activity and the start of the next maintenance "
		                     + "activity.",
		         ["168 h", "IntervalValueSequence", "IntervalDistribution" ]);
		this.downtimeIATDistribution.setUnitType(TimeUnit);
		this.downtimeIATDistribution.setRequired(true);
		this.downtimeIATDistribution.setValidRange(0.0, Double.POSITIVE_INFINITY);
		this.addInput(this.downtimeIATDistribution);
		this.addSynonym(this.downtimeIATDistribution, "IAT");
		this.addSynonym(this.downtimeIATDistribution, "TimeBetweenFailures");

		this.downtimeDurationDistribution = new SampleInput("Duration", Entity.KEY_INPUTS, Double.NaN);
		this.setKeywordDoc(this.downtimeDurationDistribution, "The calendar or working time required to complete the planned or "
		                     + "unplanned maintenance activity.",
		         ["8 h ", "DurationValueSequence", "DurationDistribution" ]);
		this.downtimeDurationDistribution.setUnitType(TimeUnit);
		this.downtimeDurationDistribution.setRequired(true);
		this.downtimeDurationDistribution.setValidRange(0.0, Double.POSITIVE_INFINITY);
		this.addInput(this.downtimeDurationDistribution);
		this.addSynonym(this.downtimeDurationDistribution, "TimeToRepair");

		this.concurrent = new BooleanProvInput("Concurrent", Entity.KEY_INPUTS, false);
		this.setKeywordDoc(this.concurrent, "If TRUE, the downtime event can occur in parallel with another "
		                     + "downtime event.", []);
		this.addInput(this.concurrent);

		this.maxDowntimesPending = new SampleInput("MaxDowntimesPending", "Key Inputs", Double.POSITIVE_INFINITY);
		this.setKeywordDoc(this.maxDowntimesPending, "The maximum number of downtime activities that are allowed to become "
		                     + "backlogged. "
		                     + "Once this limit is reached, any further downtime activities "
		                     + "are discarded.",
		         ["1"]);
		this.maxDowntimesPending.setValidRange(1, Double.POSITIVE_INFINITY);
		this.maxDowntimesPending.setIntegerValue(true);
		this.addInput(this.maxDowntimesPending);

		this.completionTimeLimit = new SampleInput("CompletionTimeLimit", Entity.KEY_INPUTS, Double.POSITIVE_INFINITY);
		this.setKeywordDoc(this.completionTimeLimit, "The total time from the scheduled start time that the downtime event "
		                     + "should be completed within. "
		                     + "For example, if the scheduled start time is 100 h and the completion "
		                     + "time limit is 48 h, the event will be recorded as late in the "
		                     + "'LateEvents' output if it is not completed by 148h.",
		         ["48 h"]);
		this.completionTimeLimit.setUnitType(TimeUnit);
		this.addInput(this.completionTimeLimit);

		const resDef: ResourceProvider[] = [];
		this.resourceList = new InterfaceEntityListInput<ResourceProvider>(ResourceProvider, "ResourceList", Entity.KEY_INPUTS, resDef);
		this.setKeywordDoc(this.resourceList, "Resources required to perform the maintenance process. "
		                     + "If any of the resources are not available at the start of downtime, "
		                     + "the maintenance duration will be delayed until the resources can be "
		                     + "seized. "
		                     + "All the resource units must be available to be seized before any one "
		                     + "unit is seized.",
		         ["Resource1 Resource2"]);
		this.addInput(this.resourceList);

		this.numberOfUnitsList = new SampleListInput("NumberOfUnits", Entity.KEY_INPUTS, 1);
		this.setKeywordDoc(this.numberOfUnitsList, "The number of units to seize from the Resources specified by the "
		                     + "'ResourceList' keyword. "
		                     + "The last value in the list is used if the number of resources is "
		                     + "greater than the number of values. "
		                     + "Only an integer number of resource units can be seized. "
		                     + "A decimal value will be truncated to an integer.",
		         ["2 1", "{ 2 } { 1 }", "{ DiscreteDistribution1 } { 'this.obj.attrib1 + 1' }"]);
		this.numberOfUnitsList.setValidRange(0, Double.POSITIVE_INFINITY);
		this.numberOfUnitsList.setDimensionless(true);
		this.numberOfUnitsList.setUnitType(DimensionlessUnit);
		this.numberOfUnitsList.setIntegerValue(true);
		this.addInput(this.numberOfUnitsList);

		// Java のフィールドの初期値（初期化ブロックの後に書かれているもの）
		this.endDowntimeTarget = new EndDowntimeTarget(this);
		this.endDowntimeHandle = new EventHandle();
		this.scheduleDowntimeTarget = new ScheduleDowntimeTarget(this);
		this.scheduleDowntimeHandle = new EventHandle();

		// Java のコンストラクタ
		this.downtimeUserList = [];
	}

	override earlyInit(): void {
		super.earlyInit();

		this.down = false;
		this.downtimeUserList.length = 0;
		this.downtimePendings = 0;
		this.downtimePendingStartTime = 0.0;
		this.numberStarted = 0;
		this.numberCompleted = 0;
		this.startTime = 0;
		this.endTime = 0;
		this.numLateEvents = 0;
		this.totalLateTime = 0;

		this.resUserDelegate = new ResourceUserDelegate(this.resourceList.getValue());
		this.seizedUnits = [];

		if (!this.isActive())
			return;

		for (const each of this.getJaamSimModel().getClonesOfIterator(StateEntity, isDowntimeUser)) {

			if (!each.isActive())
				continue;

			const du = each as unknown as DowntimeUser;
			if (du.isDowntimeUser(this))
				this.registerDowntimeUser(du);
		}
	}

	override lateInit(): void {
		super.lateInit();

		// Determine the time for the first downtime event
		if (this.firstDowntime.isDefault())
			this.secondsForNextFailure = this.getNextDowntimeIAT();
		else
			this.secondsForNextFailure = this.firstDowntime.getNextSample(this, EventManager.simSeconds());
	}

	registerDowntimeUser(du: DowntimeUser): void {
		if (!this.isActive() || this.downtimeUserList.includes(du))
			return;
		this.downtimeUserList.push(du);
	}

	unregisterDowntimeUser(du: DowntimeUser): void {
		jRemove(this.downtimeUserList, du);
	}

	override startUp(): void {
		super.startUp();
		this.checkProcessNetwork();
	}

	override clearStatistics(): void {
		super.clearStatistics();
		this.numberStarted = 0;
		this.numberCompleted = 0;
		this.numLateEvents = 0;
		this.totalLateTime = 0;
	}

	/**
	 * Get the name of the initial state this Entity will be initialized with.
	 */
	override getInitialState(): string {
		return StateEntity.STATE_WORKING;
	}

	/**
	 * Tests the given state name to see if it is valid for this Entity.
	 * @param state
	 */
	override isValidState(state: string): boolean {
		return StateEntity.STATE_WORKING === state || STATE_DOWNTIME === state
				|| STATE_WAITING_FOR_RESOURCES === state;
	}

	/**
	 * Tests the given state name to see if it is counted as working hours when in
	 * that state..
	 * @param state
	 */
	override isValidWorkingState(state: string): boolean {
		return StateEntity.STATE_WORKING === state;
	}

	/**
	 * Monitors the accumulation of time towards the start of the next maintenance activity or
	 * the completion of the present maintenance activity. This method is called whenever an
	 * entity affected by this type of maintenance changes state.
	 */
	checkProcessNetwork(): void {
		if (this.isTraceFlag()) this.trace(0, "checkProcessNetwork");

		// Schedule the next downtime event
		const iatWorkingEnt = this.iatWorkingEntity.getValue();
		if (!this.scheduleDowntimeHandle.isScheduled()) {
			if (iatWorkingEnt === null || iatWorkingEnt.isWorkingState()) {
				let workingSecs = EventManager.simSeconds();
				if (iatWorkingEnt !== null)
					workingSecs = iatWorkingEnt.getWorkingTime();
				const waitSecs = Math.max(this.secondsForNextFailure - workingSecs, 0.0);
				EventManager.scheduleSeconds(waitSecs, Entity.PRI_NORMAL, Entity.EVT_LIFO, this.scheduleDowntimeTarget, this.scheduleDowntimeHandle);
				if (this.isTraceFlag()) this.traceLine(1, "downtime event scheduled - waitSecs=%s", jstr(waitSecs));
			}
		}
		// the next event is already scheduled.  If the working entity has stopped working, need to cancel the event
		else {
			if (iatWorkingEnt !== null && !iatWorkingEnt.isWorkingState()) {
				EventManager.killEvent(this.scheduleDowntimeHandle);
				if (this.isTraceFlag()) this.traceLine(1, "downtime event canceled");
			}
		}

		// Seize resources
		if (this.isWaitingForResources()) {
			const simTime = EventManager.simSeconds();
			const nums = this.numberOfUnitsList.getNextIntegers(this, simTime, this.resUserDelegate!.getListSize());
			if (!this.resUserDelegate!.canSeizeResources(simTime, nums, this))
				return;
			this.resUserDelegate!.seizeResources(nums, this);
			this.seizedUnits = nums;
			this.setPresentState();
			if (this.isTraceFlag()) this.traceLine(1, "resources seized");

			// Determine the time when the downtime event will be over
			const durWorkingEnt = this.durationWorkingEntity.getValue();
			this.secondsForNextRepair = simTime + this.downDuration;
			if (durWorkingEnt !== null)
				this.secondsForNextRepair = durWorkingEnt.getWorkingTime() + this.downDuration;
		}

		// 1) Determine when to end the current downtime event
		if (this.down) {
			const durWorkingEnt = this.durationWorkingEntity.getValue();
			if (durWorkingEnt === null || durWorkingEnt.isWorkingState()) {
				if (this.endDowntimeHandle.isScheduled())
					return;
				let workingSecs = EventManager.simSeconds();
				if (durWorkingEnt !== null)
					workingSecs = durWorkingEnt.getWorkingTime();
				const waitSecs = this.secondsForNextRepair - workingSecs;
				EventManager.scheduleSeconds(waitSecs, Entity.PRI_NORMAL, Entity.EVT_LIFO, this.endDowntimeTarget, this.endDowntimeHandle);
				this.endTime = EventManager.simSeconds() + waitSecs;
				if (this.isTraceFlag()) this.traceLine(1, "downtime end event scheduled - waitSecs=%s", jstr(waitSecs));
				return;
			}

			// The Entity is not working, remove scheduled end of the downtime event
			if (durWorkingEnt !== null && !durWorkingEnt.isWorkingState()) {
				EventManager.killEvent(this.endDowntimeHandle);
				if (this.isTraceFlag()) this.traceLine(1, "downtime end event canceled");
			}
		}

		// 2) Start the next downtime event if required/possible
		else {
			if (this.downtimePendings > 0 && this.canStartDowntime()) {
				this.startDowntime();
			}
		}
	}

	scheduleDowntime(): void {
		const simTime = EventManager.simSeconds();
		if (this.downtimePendings === this.getMaxDowntimesPending(simTime))
			return;

		this.downtimePendings++;
		if( this.downtimePendings === 1 )
			this.downtimePendingStartTime = simTime;

		this.targetCompletionTime = simTime + this.completionTimeLimit.getNextSample(this, simTime);

		// Determine the time the next downtime event is due
		// Calendar time based
		const iatWorkingEnt = this.iatWorkingEntity.getValue();
		if (iatWorkingEnt === null) {
			this.secondsForNextFailure += this.getNextDowntimeIAT();
		}
		// Working time based
		else {
			this.secondsForNextFailure = iatWorkingEnt.getWorkingTime() + this.getNextDowntimeIAT();
		}
		if (this.isTraceFlag()) this.trace(0, "scheduleDowntime - secondsForNextFailure=%s", jstr(this.secondsForNextFailure));

		// prepare all entities for the downtime event
		for (const each of this.downtimeUserList) {
			EventManager.startProcess(new PrepareForDowntimeTarget(this, each));
		}

		this.checkProcessNetwork();
	}

	canStartDowntime(): boolean {
		for (const each of this.downtimeUserList) {
			if (!each.canStartDowntime(this)) {
				return false;
			}
		}
		return true;
	}

	/**
	 * When enough working hours have been accumulated by WorkingEntity, trigger all entities in downtimeUserList to perform downtime
	 */
	private startDowntime(): void {
		if (this.isTraceFlag()) this.trace(0, "startDowntime");
		this.setDown(true);

		this.startTime = EventManager.simSeconds();
		this.downtimePendings--;
		this.numberStarted++;

		// Determine the time when the downtime event will be over
		this.downDuration = this.getDowntimeDuration();
		const durWorkingEnt = this.durationWorkingEntity.getValue();
		this.secondsForNextRepair = EventManager.simSeconds() + this.downDuration;
		if (durWorkingEnt !== null)
			this.secondsForNextRepair = durWorkingEnt.getWorkingTime() + this.downDuration;

		this.endTime = this.startTime + this.downDuration;

		// Loop through all objects that this object is watching and trigger them to stop working.
		for (const each of this.downtimeUserList) {
			each.startDowntime(this);
		}

		this.checkProcessNetwork();
	}

	private setDown(b: boolean): void {
		if (this.isTraceFlag()) this.trace(1, "setDown(%s)", b);
		this.down = b;
		this.setPresentState();
	}

	endDowntime(): void {
		if (this.isTraceFlag()) this.trace(0, "endDowntime");
		this.setDown(false);

		this.numberCompleted++;

		// Release resources
		this.resUserDelegate!.releaseResources(this.seizedUnits, this);
		this.seizedUnits = [];

		// Loop through all objects that this object is watching and try to restart them.
		for (const each of this.downtimeUserList) {
			each.endDowntime(this);
		}

		// Notify any resource users that are waiting for these Resources
		AbstractResourceProvider.notifyResourceUsers(this.resUserDelegate!.getResourceList());

		// If this event was late, increment counter
		if(EventManager.simSeconds() > this.targetCompletionTime ) {
			this.numLateEvents++;
			this.totalLateTime += (EventManager.simSeconds() - this.targetCompletionTime);
		}

		this.checkProcessNetwork();
	}

	/**
	 * Return the time in seconds of the next downtime IAT
	 */
	private getNextDowntimeIAT(): number {
		return this.downtimeIATDistribution.getNextSample(this, EventManager.simSeconds());
	}

	/**
	 * Return the expected time in seconds of the first downtime
	 */
	getExpectedFirstDowntime(): number {
		return this.firstDowntime.getValue().getMeanValue( EventManager.simSeconds() );
	}

	/**
	 * Return the expected time in seconds of the downtime IAT
	 */
	getExpectedDowntimeIAT(): number {
		return this.downtimeIATDistribution.getValue().getMeanValue( EventManager.simSeconds() );
	}

	/**
	 * Return the expected time in seconds of the downtime duration
	 */
	getExpectedDowntimeDuration(): number {
		return this.downtimeDurationDistribution.getValue().getMeanValue( EventManager.simSeconds() );
	}

	/**
	 * Return the time in seconds of the next downtime duration
	 */
	private getDowntimeDuration(): number {
		return this.downtimeDurationDistribution.getNextSample(this, EventManager.simSeconds());
	}

	getDowntimeDurationDistribution(): SampleProvider {
		return this.downtimeDurationDistribution.getValue();
	}

	isDown(): boolean {
		return this.down;
	}

	/**
	 * Returns whether the downtime event is ready to begin.
	 * @return true if downtime can begin
	 */
	isDowntimePending(): boolean {
		return this.downtimePendings > 0;
	}

	isWatching(ent: StateEntity): boolean {
		if (!this.isActive())
			return false;

		if (this.iatWorkingEntity.getValue() === ent)
			return true;

		if (this.durationWorkingEntity.getValue() === ent)
			return true;

		if (isDowntimeUser(ent)) {
			const du = ent as unknown as DowntimeUser;
			return this.downtimeUserList.includes(du);
		}

		return false;
	}

	updateForStateChange(ent: StateEntity, prev: StateRecord, next: StateRecord): void {
		this.checkProcessNetwork();
	}

	/** Java の getEndTime() と、出力の getEndTime(double simTime)（どちらも同じ値） */
	getEndTime(simTime?: number): number {
		return this.endTime;
	}

	getDowntimePendingStartTime(): number {
		return this.downtimePendingStartTime;
	}

	getDowntimeUserList(): DowntimeUser[] {
		return this.downtimeUserList;
	}

	isConcurrent(simTime: number): boolean {
		return this.concurrent.getNextBoolean(this, simTime);
	}

	getMaxDowntimesPending(simTime: number): number {
		return toInt(this.maxDowntimesPending.getNextSample(this, simTime));
	}

	isWaitingForResources(): boolean {
		return this.down && !this.resUserDelegate!.isEmpty() && this.seizedUnits.length === 0;
	}

	requiresResource(res: ResourceProvider): boolean {
		return this.resUserDelegate!.requiresResource(res);
	}

	hasWaitingEntity(): boolean {
		return this.isWaitingForResources();
	}

	getPriority(): number {
		return 0;
	}

	getWaitTime(): number {
		let ret = 0.0;
		if (this.isWaitingForResources())
			ret = EventManager.simSeconds() - this.startTime;
		return ret;
	}

	isReadyToStart(): boolean {
		const simTime = EventManager.simSeconds();
		const nums = this.numberOfUnitsList.getNextIntegers(this, simTime, this.resUserDelegate!.getListSize());
		return this.resUserDelegate!.canSeizeResources(simTime, nums, this);
	}

	startNextEntity(): void {
		this.checkProcessNetwork();
	}

	hasStrictResource(): boolean {
		return this.resUserDelegate!.hasStrictResource();
	}

	/**
	 * Java の setPresentState()（この部品の状態を決める）と、親の setPresentState(String)。
	 * 引数を渡したときは親の関数を呼ぶ。
	 */
	override setPresentState(state?: string): void {
		if (state !== undefined) {
			super.setPresentState(state);
			return;
		}

		if (this.isWaitingForResources()) {
			this.setPresentState(STATE_WAITING_FOR_RESOURCES);
			return;
		}
		if (this.down)
			this.setPresentState(STATE_DOWNTIME);
		else
			this.setPresentState(StateEntity.STATE_WORKING);
	}

	// ******************************************************************************************************
	// OUTPUTS
	// ******************************************************************************************************

	getUserList(simTime: number): DowntimeUser[] {
		return this.downtimeUserList;
	}

	getNumberPending(simTime: number): number {
		return this.downtimePendings;
	}

	getNumberStarted(simTime: number): number {
		return this.numberStarted;
	}

	getNumberCompleted(simTime: number): number {
		return this.numberCompleted;
	}

	getStartTime(simTime: number): number {
		return this.startTime;
	}

	getNextStartTime(simTime: number): number {
		const ent = this.iatWorkingEntity.getValue();

		// 1) Calendar time
		if (ent === null) {
			return this.secondsForNextFailure;
		}

		// 2) Working time
		if (this.isDown())
			return this.endTime + (this.secondsForNextFailure - ent.getWorkingTime(simTime));
		return simTime + (this.secondsForNextFailure - ent.getWorkingTime(simTime));
	}

	getCalculatedDowntimeRatio(simTime: number): number {
		if (this.downtimeDurationDistribution.isDefault()
				|| this.downtimeIATDistribution.isDefault())
			return Double.NaN;
		const dur = this.downtimeDurationDistribution.getValue().getMeanValue(simTime);
		const iat = this.downtimeIATDistribution.getValue().getMeanValue(simTime);
		return dur/iat;
	}

	getAvailability(simTime: number): number {
		let total = simTime;
		if (simTime > this.getSimulation().getInitializationTime())
			total -= this.getSimulation().getInitializationTime();
		return this.getTimeInState(simTime, StateEntity.STATE_WORKING) / total;
	}

	getLateEvents(simTime: number): number {
		return this.numLateEvents;
	}

	getTotalLateTime(simTime: number): number {
		return this.totalLateTime;
	}
}

/**
 * EndDowntimeTarget
 */
class EndDowntimeTarget extends EntityTarget<DowntimeEntity> {
	constructor(ent: DowntimeEntity) {
		super(ent, "endDowntime");
	}

	override process(): void {
		this.ent.endDowntime();
	}
}

/**
 * ScheduleDowntimeTarget
 */
class ScheduleDowntimeTarget extends EntityTarget<DowntimeEntity> {
	constructor(ent: DowntimeEntity) {
		super(ent, "scheduleDowntime");
	}

	override process(): void {
		this.ent.scheduleDowntime();
	}
}

// PrepareForDowntimeTarget
class PrepareForDowntimeTarget extends ProcessTarget {
	private readonly ent: DowntimeEntity;
	private readonly user: DowntimeUser;

	constructor(e: DowntimeEntity, u: DowntimeUser) {
		super();
		this.ent = e;
		this.user = u;
	}

	override process(): void {
		this.user.prepareForDowntime(this.ent);
	}

	override getDescription(): string {
		return this.user.getName() + ".prepareForDowntime";
	}
}

ClassRegistry.register("com.jaamsim.BasicObjects.DowntimeEntity", DowntimeEntity);

defineOutput(DowntimeEntity, {
	name: "UserList",
	description: "The objects that experience breakdowns or maintenance caused by this "
	           + "DowntimeEntity.",
	unitType: DimensionlessUnit, reportable: false, sequence: 0,
	returnType: "ArrayList",
	get: (e, simTime) => e.getUserList(simTime),
});

defineOutput(DowntimeEntity, {
	name: "NumberPending",
	description: "The number of downtime events that are backlogged. "
	           + "If two or more downtime events are pending they will be performed one after "
	           + "another.",
	unitType: DimensionlessUnit, reportable: false, sequence: 1,
	returnType: "int",
	get: (e, simTime) => e.getNumberPending(simTime),
});

defineOutput(DowntimeEntity, {
	name: "NumberStarted",
	description: "The number of downtime events that have been started, including ones that "
	           + "have been completed. "
	           + "Excludes downtimes that were started during the initialization period.",
	unitType: DimensionlessUnit, reportable: false, sequence: 2,
	returnType: "int",
	get: (e, simTime) => e.getNumberStarted(simTime),
});

defineOutput(DowntimeEntity, {
	name: "NumberCompleted",
	description: "The number of downtime events that have been completed. "
	           + "Excludes downtimes that were completed during the initialization period.",
	unitType: DimensionlessUnit, reportable: false, sequence: 3,
	returnType: "int",
	get: (e, simTime) => e.getNumberCompleted(simTime),
});

defineOutput(DowntimeEntity, {
	name: "StartTime",
	description: "The time that the most recent downtime event started.",
	unitType: TimeUnit, reportable: false, sequence: 4,
	returnType: "double",
	get: (e, simTime) => e.getStartTime(simTime),
});

defineOutput(DowntimeEntity, {
	name: "EndTime",
	description: "The time that the most recent downtime event finished or will finish.",
	unitType: TimeUnit, reportable: false, sequence: 5,
	returnType: "double",
	get: (e, simTime) => e.getEndTime(simTime),
});

defineOutput(DowntimeEntity, {
	name: "NextStartTime",
	description: "The time at which the next downtime event will begin. "
	           + "If downtime is based on the working time for an entity, then the next start "
	           + "time is estimated assuming that it will work continuously until the downtime "
	           + "event occurs.",
	unitType: TimeUnit, reportable: false, sequence: 6,
	returnType: "double",
	get: (e, simTime) => e.getNextStartTime(simTime),
});

defineOutput(DowntimeEntity, {
	name: "CalculatedDowntimeRatio",
	description: "The value calculated directly from model inputs for:\n"
	           + "(avg. downtime duration)/(avg. downtime interval)",
	unitType: DimensionlessUnit, reportable: false, sequence: 7,
	returnType: "double",
	get: (e, simTime) => e.getCalculatedDowntimeRatio(simTime),
});

defineOutput(DowntimeEntity, {
	name: "Availability",
	description: "The fraction of calendar time (excluding the initialisation period) during "
	           + "which this type of downtime did not occur.",
	unitType: DimensionlessUnit, reportable: false, sequence: 8,
	returnType: "double",
	get: (e, simTime) => e.getAvailability(simTime),
});

defineOutput(DowntimeEntity, {
	name: "LateEvents",
	description: "Number of events that did not finish within the Completion Time limit.",
	unitType: DimensionlessUnit, reportable: true, sequence: 9,
	returnType: "int",
	get: (e, simTime) => e.getLateEvents(simTime),
});

defineOutput(DowntimeEntity, {
	name: "TotalLateTime",
	description: "Total hours after completion time limit that the downtime took to complete.",
	unitType: TimeUnit, reportable: true, sequence: 10,
	returnType: "double",
	get: (e, simTime) => e.getTotalLateTime(simTime),
});
