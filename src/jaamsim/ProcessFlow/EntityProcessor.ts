/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2017-2026 JaamSim Software Inc.
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

// 入れ子のクラス: ProcessorEntry → EntityProcessor_ProcessorEntry、
//   CapacityChangeConditional → EntityProcessor_CapacityChangeConditional、
//   UpdateForCapacityChangeTarget → EntityProcessor_UpdateForCapacityChangeTarget（どちらも外側の物をコンストラクタで受け取る）。
// 多重定義 getUnitsInUse() と出力の getUnitsInUse(double) は同じ中身なので 1 つにした（引数は無視する）。
// updateGraphics は、処理中の物の位置（状態）を決めるので残した。

import type { DowntimeEntity } from "../BasicObjects/DowntimeEntity.ts";
import type { DisplayEntity } from "../Graphics/DisplayEntity.ts";
import { SampleConstant } from "../Samples/SampleConstant.ts";
import { SampleInput } from "../Samples/SampleInput.ts";
import { TimeSeries } from "../Samples/TimeSeries.ts";
import { TimeBasedFrequency } from "../Statistics/TimeBasedFrequency.ts";
import { TimeBasedStatistics } from "../Statistics/TimeBasedStatistics.ts";
import { Entity } from "../basicsim/Entity.ts";
import { EntityTarget } from "../basicsim/EntityTarget.ts";
import type { SubjectEntity } from "../basicsim/SubjectEntity.ts";
import type { Conditional } from "../events/Conditional.ts";
import { EventHandle } from "../events/EventHandle.ts";
import { EventManager } from "../events/EventManager.ts";
import { ProcessTarget } from "../events/ProcessTarget.ts";
import { defineOutput } from "../input/OutputRegistry.ts";
import { ClassRegistry } from "../java/ClassRegistry.ts";
import { Double, Long, jRemove, jformat, jstr } from "../java/lang.ts";
import { AbstractResourceProvider } from "../resourceObjects/AbstractResourceProvider.ts";
import { DimensionlessUnit } from "../units/DimensionlessUnit.ts";
import { TimeUnit } from "../units/TimeUnit.ts";
import { AbstractLinkedResourceUser } from "./AbstractLinkedResourceUser.ts";

/** Java の (int) x（double → int。0 の方向へ切り捨て、範囲外は端、NaN は 0） */
function jint(x: number): number {
	if (Number.isNaN(x))
		return 0;
	if (x >= 2147483647)
		return 2147483647;
	if (x <= -2147483648)
		return -2147483648;
	return Math.trunc(x);
}

/** Java の ArrayList.toString()・Arrays.toString(int[])（"[a, b]"） */
function listStr(list: readonly unknown[]): string {
	return "[" + list.map(o => String(o)).join(", ") + "]";
}

export class EntityProcessor extends AbstractLinkedResourceUser {

	private readonly capacity: SampleInput;

	private readonly serviceTime: SampleInput;

	private readonly entryList: EntityProcessor_ProcessorEntry[];  // List of the entities being processed
	private readonly newEntryList: EntityProcessor_ProcessorEntry[];  // List of the entities to add to entryList
	private lastCapacity = 0; // Last recorded value for capacity

	private readonly stats: TimeBasedStatistics;
	private readonly freq: TimeBasedFrequency;

	constructor() {
		super();
		this.releaseThresholdList.setHidden(false);

		this.resourceList.setRequired(false);

		this.capacity = SampleInput.ofInt("Capacity", Entity.KEY_INPUTS, 1);
		this.setKeywordDoc(this.capacity, "The maximum number of entities that can be processed simultaneously.\n"
		                     + "If the capacity changes during the simulation run, the EntityProcessor "
		                     + "will attempt to use an increase in capacity as soon as it occurs. "
		                     + "However, a decrease in capacity will have no affect on entities that "
		                     + "have already started processing.",
		         ["3", "TimeSeries1", "this.attrib1"]);
		this.capacity.setUnitType(DimensionlessUnit);
		this.capacity.setIntegerValue(true);
		this.capacity.setValidRange(0, Double.POSITIVE_INFINITY);
		this.addInput(this.capacity);

		this.serviceTime = new SampleInput("ServiceTime", Entity.KEY_INPUTS, 0.0);
		this.setKeywordDoc(this.serviceTime, "The service time required to process an entity.",
		         ["3.0 h", "NormalDistribution1", "'1[s] + 0.5*[TimeSeries1].PresentValue'"]);
		this.serviceTime.setUnitType(TimeUnit);
		this.serviceTime.setValidRange(0, Double.POSITIVE_INFINITY);
		this.addInput(this.serviceTime);

		// Java のコンストラクタ
		this.entryList = [];
		this.newEntryList = [];
		this.stats = new TimeBasedStatistics();
		this.freq = new TimeBasedFrequency(0, 10);
	}

	override earlyInit(): void {
		super.earlyInit();
		this.entryList.length = 0;
		this.newEntryList.length = 0;
		this.stats.clear();
		this.stats.addValue(0.0, 0);
		this.freq.clear();
		this.freq.addValue(0.0,  0);
	}

	override startUp(): void {
		super.startUp();

		if (!(this.getWatchList().length === 0) || this.capacity.getValue() instanceof SampleConstant)
			return;

		// Track any changes in capacity
		this.waitForCapacityChange();
	}

	stateChanged(): void {
		if (this.getResourceList().length === 0) {
			this.startNextEntities();
			return;
		}
		if (!this.isReadyToStart())
			return;
		AbstractResourceProvider.notifyResourceUsers(this.getResourceList());
	}

	override queueChanged(): void {
		this.stateChanged();
	}

	override observerUpdate(subj: SubjectEntity): void {
		if (!this.stateChangedHandle.isScheduled()) {
			EventManager.scheduleTicks(0, Entity.PRI_LOW, Entity.EVT_FIFO, this.stateChangedTarget, this.stateChangedHandle);
		}
	}

	private readonly stateChangedHandle = new EventHandle();
	private readonly stateChangedTarget: ProcessTarget = new (class extends EntityTarget<EntityProcessor> {
		override process(): void {
			this.ent.stateChanged();
		}
	})(this, "stateChanged");

	override isReadyToStart(): boolean {
		return super.isReadyToStart() && (this.getUnitsInUse() < this.getCapacity(EventManager.simSeconds()));
	}

	override startNextEntity(): void {
		super.startNextEntity();
		const simTime = EventManager.simSeconds();
		const ent = this.getReceivedEntity(simTime) as DisplayEntity;

		// Set the service duration
		const dur = this.serviceTime.getNextSample(this, simTime);
		const ticks = EventManager.current().secondsToNearestTick(dur);

		// Add the entity to the list of entities to be processed
		this.newEntryList.push(new EntityProcessor_ProcessorEntry(ent, this.getSeizedUnits(simTime), ticks));
		if (this.isTraceFlag()) this.traceLine(3, "newEntryList=%s", listStr(this.newEntryList));

		// Interrupt the processing loop
		this.performUnscheduledUpdate();
	}

	/** Java の getUnitsInUse() と、出力の getUnitsInUse(double simTime) */
	getUnitsInUse(simTime?: number): number {
		return this.entryList.length + this.newEntryList.length;
	}

	collectStatistics(simTime: number, unitsInUse: number): void {
		this.stats.addValue(simTime, unitsInUse);
		this.freq.addValue(simTime, unitsInUse);
	}

	override clearStatistics(): void {
		super.clearStatistics();
		const simTime = EventManager.simSeconds();
		this.stats.clear();
		this.stats.addValue(simTime, this.getUnitsInUse());
		this.freq.clear();
		this.freq.addValue(simTime, this.getUnitsInUse());
	}

	protected override startProcessing(simTime: number): boolean {
		if (this.isTraceFlag()) this.trace(2, "startProcessing");

		// Add any new entries
		if (!(this.newEntryList.length === 0)) {
			this.entryList.push(...this.newEntryList);
			this.newEntryList.length = 0;
			if (this.isTraceFlag()) this.traceLine(3, "entryList=%s", listStr(this.entryList));

			// Record the number of units in use
			this.collectStatistics(simTime, this.getUnitsInUse());
		}

		// Stop when there are no entities to process
		return !(this.entryList.length === 0);  // return true to continue
	}

	protected override getStepDuration(simTime: number): number {
		// TODO(移植): 全部の物が済んでいて ReleaseThreshold が閉じているときは Long.MAX_VALUE（TS では 2^53-1）の tick になる。Java（2^63-1）と大きさが違う
		const ticks = this.getDurationTicks(this.isReleaseThresholdClosure());
		const evt = this.getJaamSimModel().getEventManager();
		return evt.ticksToSeconds(ticks);
	}

	private getDurationTicks(bool: boolean): number {
		let ticks = Long.MAX_VALUE;
		for (const entry of this.entryList) {
			if (entry.remainingTicks <= 0 && bool)
				continue;
			ticks = Math.min(ticks, entry.remainingTicks);
		}
		return ticks;
	}

	override updateProgress(dt: number): void {
		if (this.isTraceFlag()) this.trace(2, "updateProgress(%s)", jstr(dt));

		// Decrement the remaining durations for each of the entities
		if (this.isTraceFlag()) this.traceLine(3, "BEFORE - entryList=%s", listStr(this.entryList));
		const delta = EventManager.current().secondsToNearestTick(dt);
		for (const entry of this.entryList) {
			entry.remainingTicks -= delta;
			entry.remainingTicks = Math.max(0, entry.remainingTicks);
		}
		if (this.isTraceFlag()) this.traceLine(3, "AFTER  - entryList=%s", listStr(this.entryList));
	}

	protected override processStep(simTime: number): void {

		// Identify the entities whose processing is finished
		const completedEntries: EntityProcessor_ProcessorEntry[] = [];
		for (const entry of this.entryList) {
			if (entry.remainingTicks <= 0) {
				completedEntries.push(entry);
			}
		}
		if (completedEntries.length === 0)
			return;

		// Check for a release threshold closure
		if (this.isReleaseThresholdClosure()) {
			if (completedEntries.length === this.getCapacity(simTime))
				this.setReadyToRelease(true);
			return;
		}

		// Release the completed entities one at a time
		for (const entry of completedEntries) {
			jRemove(this.entryList, entry);

			// Release the resources
			this.releaseResources(entry.resourceUnits, entry.entity);

			// Pass the entity to the next component
			this.sendToNextComponent(entry.entity);

			// Re-check the release condition
			if (this.isReleaseThresholdClosure())
				break;
		}

		// Record the number of units in use
		this.collectStatistics(simTime, this.getUnitsInUse());

		// Notify any resource users that are waiting for these Resources
		if (this.getResourceList().length === 0) {
			this.startNextEntities();
		}
		else {
			AbstractResourceProvider.notifyResourceUsers(this.getResourceList());
		}
	}

	protected startNextEntities(): void {
		while (this.isReadyToStart()) {
			this.startNextEntity();
		}
	}

	protected override isNewStepReqd(completed: boolean): boolean {
		return true;
	}

	override thresholdChanged(): void {
		if (this.isImmediateReleaseThresholdClosure()) {
			for (const entry of this.entryList) {
				entry.remainingTicks = 0;
			}
		}
		this.stateChanged();

		// Release entities that have been waiting for a ReleaseThreshold to open
		if (!this.isReleaseThresholdClosure() && this.getDurationTicks(false) <= 0)
			this.performUnscheduledUpdate();

		super.thresholdChanged();
	}

	override isFinished(): boolean {
		return this.entryList.length === 0 && this.newEntryList.length === 0;
	}

	override endDowntime(down: DowntimeEntity): void {
		this.stateChanged();
		super.endDowntime(down);
	}

	/**
	 * Returns true if the saved capacity differs from the present capacity
	 * @return true if the capacity has changed
	 */
	isCapacityChanged(): boolean {
		return this.getCapacity(EventManager.simSeconds()) !== this.lastCapacity;
	}

	/**
	 * Loops from one capacity change to the next.
	 */
	waitForCapacityChange(): void {

		// Set the present capacity
		this.lastCapacity = this.getCapacity(EventManager.simSeconds());

		// Wait until the state is ready to change
		if (this.capacity.getValue() instanceof TimeSeries) {
			const ts = this.capacity.getValue() as TimeSeries;
			const simTicks = EventManager.simTicks();
			const durTicks = ts.getNextChangeAfterTicks(simTicks) - simTicks;
			EventManager.scheduleTicks(durTicks, Entity.PRI_LOW, Entity.EVT_FIFO, this.updateForCapacityChangeTarget, null);
		}
		else {
			EventManager.scheduleUntil(this.updateForCapacityChangeTarget, this.capacityChangeConditional, null);
		}
	}

	/**
	 * Responds to a change in capacity.
	 */
	updateForCapacityChange(): void {
		if (this.isTraceFlag()) this.trace(0, "updateForCapacityChange");

		// Select the resource users to notify
		if (this.getCapacity(EventManager.simSeconds()) > this.lastCapacity) {
			this.stateChanged();
		}

		// Wait for the next capacity change
		this.waitForCapacityChange();
	}

	private readonly capacityChangeConditional: Conditional = new EntityProcessor_CapacityChangeConditional(this);

	private readonly updateForCapacityChangeTarget: ProcessTarget = new EntityProcessor_UpdateForCapacityChangeTarget(this);

	override updateGraphics(simTime: number): void {
		super.updateGraphics(simTime);

		// Copy the lists to avoid concurrent modification exceptions
		let copiedList: EntityProcessor_ProcessorEntry[];
		try {
			copiedList = [...this.entryList];
			copiedList.push(...this.newEntryList);
		}
		catch (e) {
			return;
		}

		for (const entry of copiedList) {
			this.moveToProcessPosition(entry.entity);
		}
	}

	getCapacity(simTime: number): number {
		return jint(this.capacity.getNextSample(this, simTime));
	}

	getEntityList(simTime: number): DisplayEntity[] {
		const ret: DisplayEntity[] = [];
		for (const entry of this.entryList) {
			ret.push(entry.entity);
		}
		return ret;
	}

	getServiceDurationList(simTime: number): number[] {
		const evt = this.getJaamSimModel().getEventManager();
		const ret: number[] = new Array<number>(this.entryList.length).fill(0);
		for (let i = 0; i < this.entryList.length; i++) {
			ret[i] = evt.ticksToSeconds(this.entryList[i].durationTicks);
		}
		return ret;
	}

	getServicePerformedList(simTime: number): number[] {
		const ret: number[] = new Array<number>(this.entryList.length).fill(0);
		const remainingTime = this.getRemainingTime(simTime);
		const serviceDuration = this.getServiceDurationList(simTime);
		for (let i = 0; i < this.entryList.length; i++) {
			ret[i] = serviceDuration[i] - remainingTime[i];
		}
		return ret;
	}

	getRemainingTime(simTime: number): number[] {
		const ret: number[] = new Array<number>(this.entryList.length).fill(0);
		let dt = 0.0;
		if (this.isBusy()) {
			dt = simTime - this.getLastUpdateTime();
		}
		const evt = this.getJaamSimModel().getEventManager();
		for (let i = 0; i < this.entryList.length; i++) {
			ret[i] = evt.ticksToSeconds(this.entryList[i].remainingTicks) - dt;
			ret[i] = Math.max(0.0, ret[i]);
		}
		return ret;
	}

	getFractionCompletedList(simTime: number): number[] {
		const ret: number[] = new Array<number>(this.entryList.length).fill(0);
		const remainingTime = this.getRemainingTime(simTime);
		const serviceDuration = this.getServiceDurationList(simTime);
		for (let i = 0; i < this.entryList.length; i++) {
			ret[i] = 0.0;
			if (serviceDuration[i] > 0.0) {
				ret[i] = 1.0 - remainingTime[i]/serviceDuration[i];
			}
		}
		return ret;
	}

	getAvailableUnits(simTime: number): number {
		return this.getCapacity(simTime) - this.getUnitsInUse();
	}

	getUnitsInUseAverage(simTime: number): number {
		return this.stats.getMean(simTime);
	}

	getUnitsInUseStandardDeviation(simTime: number): number {
		return this.stats.getStandardDeviation(simTime);
	}

	getUnitsInUseMinimum(simTime: number): number {
		return jint(this.stats.getMin());
	}

	getUnitsInUseMaximum(simTime: number): number {
		const ret = jint(this.stats.getMax());
		// A unit that is seized and released immediately
		// does not count as a non-zero maximum in use
		if (ret === 1 && this.freq.getBinTime(simTime, 1) === 0.0)
			return 0;
		return ret;
	}

	getUnitsInUseDistribution(simTime: number): number[] {
		return this.freq.getBinTimes(simTime, 0, this.freq.getMax());
	}

	getUnitsInUseFractions(simTime: number): number[] {
		return this.freq.getBinFractions(simTime, 0, this.freq.getMax());
	}

	getUnitsInUseCumulativeFractions(simTime: number): number[] {
		return this.freq.getBinCumulativeFractions(simTime, 0, this.freq.getMax());
	}

}

/** Java の EntityProcessor.ProcessorEntry（private static） */
class EntityProcessor_ProcessorEntry {
	readonly entity: DisplayEntity;
	readonly resourceUnits: number[];
	durationTicks: number;
	remainingTicks: number;

	constructor(ent: DisplayEntity, units: number[], ticks: number) {
		this.entity = ent;
		this.resourceUnits = units;
		this.durationTicks = ticks;
		this.remainingTicks = ticks;
	}

	toString(): string {
		return jformat("(%s, %s, %s)",
				this.entity, listStr(this.resourceUnits), String(this.remainingTicks));
	}
}

/** Java の EntityProcessor.CapacityChangeConditional（Conditional for isCapacityChanged()） */
class EntityProcessor_CapacityChangeConditional implements Conditional {
	constructor(private readonly outer: EntityProcessor) {}

	evaluate(): boolean {
		return this.outer.isCapacityChanged();
	}
}

/** Java の EntityProcessor.UpdateForCapacityChangeTarget（Target for updateForCapacityChange()） */
class EntityProcessor_UpdateForCapacityChangeTarget extends ProcessTarget {
	constructor(private readonly outer: EntityProcessor) {
		super();
	}

	override getDescription(): string {
		return this.outer.getName() + ".updateForCapacityChange";
	}

	override process(): void {
		this.outer.updateForCapacityChange();
	}
}

ClassRegistry.register("com.jaamsim.ProcessFlow.EntityProcessor", EntityProcessor);

defineOutput(EntityProcessor, {
	name: "EntityList",
	description: "The entities being processed at present.",
	sequence: 1,
	returnType: "ArrayList",
	get: (e, simTime) => e.getEntityList(simTime),
});

defineOutput(EntityProcessor, {
	name: "ServiceDuration",
	description: "The total working time required for each entity being processed.",
	unitType: TimeUnit,
	sequence: 2,
	returnType: "double[]",
	get: (e, simTime) => e.getServiceDurationList(simTime),
});

defineOutput(EntityProcessor, {
	name: "ServicePerformed",
	description: "The working time that has been completed for each entity being processed.",
	unitType: TimeUnit,
	sequence: 3,
	returnType: "double[]",
	get: (e, simTime) => e.getServicePerformedList(simTime),
});

defineOutput(EntityProcessor, {
	name: "RemainingTime",
	description: "The remaining working time required for each entity being processed.",
	unitType: TimeUnit,
	sequence: 4,
	returnType: "double[]",
	get: (e, simTime) => e.getRemainingTime(simTime),
});

defineOutput(EntityProcessor, {
	name: "FractionCompleted",
	description: "The portion of the total service time for the present service activity that "
	             + "has been completed.",
	unitType: DimensionlessUnit,
	sequence: 5,
	returnType: "double[]",
	get: (e, simTime) => e.getFractionCompletedList(simTime),
});

defineOutput(EntityProcessor, {
	name: "UnitsInUse",
	description: "The present number of capacity units that are being used.",
	unitType: DimensionlessUnit,
	sequence: 6,
	returnType: "int",
	get: (e, simTime) => e.getUnitsInUse(simTime),
});

defineOutput(EntityProcessor, {
	name: "AvailableUnits",
	description: "The number of processor units that are not in use.",
	unitType: DimensionlessUnit,
	sequence: 7,
	returnType: "int",
	get: (e, simTime) => e.getAvailableUnits(simTime),
});

defineOutput(EntityProcessor, {
	name: "UnitsInUseAverage",
	description: "The average number of processor units that are in use.",
	unitType: DimensionlessUnit,
	reportable: true,
	sequence: 8,
	returnType: "double",
	get: (e, simTime) => e.getUnitsInUseAverage(simTime),
});

defineOutput(EntityProcessor, {
	name: "UnitsInUseStandardDeviation",
	description: "The standard deviation of the number of processor units that are in use.",
	unitType: DimensionlessUnit,
	reportable: true,
	sequence: 9,
	returnType: "double",
	get: (e, simTime) => e.getUnitsInUseStandardDeviation(simTime),
});

defineOutput(EntityProcessor, {
	name: "UnitsInUseMinimum",
	description: "The minimum number of processor units that are in use.",
	unitType: DimensionlessUnit,
	reportable: true,
	sequence: 10,
	returnType: "int",
	get: (e, simTime) => e.getUnitsInUseMinimum(simTime),
});

defineOutput(EntityProcessor, {
	name: "UnitsInUseMaximum",
	description: "The maximum number of processor units that are in use.",
	unitType: DimensionlessUnit,
	reportable: true,
	sequence: 11,
	returnType: "int",
	get: (e, simTime) => e.getUnitsInUseMaximum(simTime),
});

defineOutput(EntityProcessor, {
	name: "UnitsInUseTimes",
	description: "The total time that the number of processor units in use was 0, 1, 2, etc.",
	unitType: TimeUnit,
	reportable: true,
	sequence: 12,
	returnType: "double[]",
	get: (e, simTime) => e.getUnitsInUseDistribution(simTime),
});

defineOutput(EntityProcessor, {
	name: "UnitsInUseFractions",
	description: "Fraction of total time that the number of processor units in use was 0, 1, 2, "
	             + "etc.",
	reportable: true,
	sequence: 13,
	returnType: "double[]",
	get: (e, simTime) => e.getUnitsInUseFractions(simTime),
});

defineOutput(EntityProcessor, {
	name: "UnitsInUseCumulativeFractions",
	description: "Fraction of total time that the number of processor units in use was less than "
	             + "or equal to 0, 1, 2, etc.",
	reportable: true,
	sequence: 14,
	returnType: "double[]",
	get: (e, simTime) => e.getUnitsInUseCumulativeFractions(simTime),
});
