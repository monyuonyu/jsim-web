/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2013 Ausenco Engineering Canada Inc.
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

// 入れ子のクラス ConveyorEntry は、このファイルの EntityConveyor_ConveyorEntry にした。
// setPresentState() は StateEntity の setPresentState(String) と 1 つにした（引数が無ければ状態を計算する）。
// Device の final の updateProgress() は updateProgressToNow() という名前（docs/renamed.md）。
// updateGraphics は、コンベヤの上の物の位置・向きの計算（状態）なので残した。

import { ClassRegistry } from "../internal.ts";
import { Double, Long, jformat, jstr } from "../internal.ts";
import { tr } from "../internal.ts";
import { BooleanProvInput } from "../internal.ts";
import { ColourProvInput } from "../internal.ts";
import { PolylineModel } from "../internal.ts";
import type { DisplayEntity } from "../Graphics/DisplayEntity.ts";
import { LineEntity } from "../internal.ts";
import { PolylineInfo } from "../internal.ts";
import { SampleInput } from "../internal.ts";
import { CompoundEntity } from "../internal.ts";
import { Entity } from "../internal.ts";
import type { SubjectEntity } from "../basicsim/SubjectEntity.ts";
import { EventManager } from "../internal.ts";
import { ColourInput } from "../internal.ts";
import { InputErrorException } from "../internal.ts";
import { defineOutput, hideOutput } from "../internal.ts";
import type { Color4d } from "../math/Color4d.ts";
import { MathUtils } from "../internal.ts";
import { DimensionlessUnit } from "../internal.ts";
import { DistanceUnit } from "../internal.ts";
import { TimeUnit } from "../internal.ts";
import { AbstractStateUserEntity } from "../internal.ts";
import { LinkedService } from "../internal.ts";

/** Java の (int) x（double → int。NaN は 0、範囲の外は端の値） */
function jint(x: number): number {
	if (Number.isNaN(x))
		return 0;
	if (x >= 2147483647)
		return 2147483647;
	if (x <= -2147483648)
		return -2147483648;
	return Math.trunc(x);
}

/** trace に long を出すとき、Long.MAX_VALUE（TS では 2^53-1）を Java と同じ字面にする */
function jlongStr(x: number): string {
	if (x === Long.MAX_VALUE)
		return "9223372036854775807";
	return String(x);
}

/**
 * Moves one or more Entities along a path at a constant speed.
 */
export class EntityConveyor extends LinkedService implements LineEntity {

	private readonly travelTimeInput: SampleInput;

	private readonly length: SampleInput;

	private readonly entitySpace: SampleInput;

	private readonly accumulationLength: SampleInput;

	private readonly accumulating: BooleanProvInput;

	protected readonly maxValidNumber: SampleInput;

	private readonly rotateEntities: BooleanProvInput;

	private readonly alignEntities: BooleanProvInput;

	private readonly widthInput: SampleInput;

	private readonly colorInput: ColourProvInput;

	private readonly entryList: EntityConveyor_ConveyorEntry[];  // List of the entities being conveyed
	private presentTravelTime = 0.0;
	private nextDuration = 0.0;
	private readyForNext = false;

	private exitFlag = false;
	private nextEntFlag = false;
	private nextTriggerFlag = false;

	constructor() {
		super();
		this.displayModelListInput.clearValidClasses();
		this.displayModelListInput.addValidClass(PolylineModel);

		this.triggerPointList.setHidden(false);
		this.releaseThresholdList.setHidden(false);

		this.operatingThresholdList.setHidden(true);
		this.waitQueue.setHidden(true);
		this.match.setHidden(true);
		this.processPosition.setHidden(true);
		this.forcedMaintenanceList.setHidden(true);
		this.forcedBreakdownList.setHidden(true);
		this.selectionCondition.setHidden(true);
		this.nextEntity.setHidden(true);

		this.travelTimeInput = new SampleInput("TravelTime", Entity.KEY_INPUTS, 0.0);
		this.setKeywordDoc(this.travelTimeInput, "The travel time for the conveyor. "
		                     + "If value returned by an expression input changes during the "
		                     + "simulation run, the new value will not be used until an entity "
		                     + "arrives or departs from the conveyor, or when an update is triggered "
		                     + "by an object in the 'WatchList' input.",
		         ["10.0 s"]);
		this.travelTimeInput.setValidRange(0.0, Double.POSITIVE_INFINITY);
		this.travelTimeInput.setUnitType(TimeUnit);
		this.addInput(this.travelTimeInput);

		this.length = new SampleInput("Length", Entity.KEY_INPUTS, 0.0);
		this.setKeywordDoc(this.length, "Length of the conveyor.",
		         ["10.0 m"]);
		this.length.setValidRange(0.0, Double.POSITIVE_INFINITY);
		this.length.setUnitType(DistanceUnit);
		this.addInput(this.length);

		this.entitySpace = new SampleInput("EntitySpace", Entity.KEY_INPUTS, 0.0);
		this.setKeywordDoc(this.entitySpace, "Unused distance along the conveyor that is required to add the "
		                     + "present entity.",
		         ["1.0 m"]);
		this.entitySpace.setValidRange(0.0, Double.POSITIVE_INFINITY);
		this.entitySpace.setUnitType(DistanceUnit);
		this.addInput(this.entitySpace);

		this.accumulationLength = new SampleInput("AccumulationLength", Entity.KEY_INPUTS, 0.0);
		this.setKeywordDoc(this.accumulationLength, "Distance along the conveyor that is occupied by the present entity "
		                     + "when it is accumulated.",
		         ["1.0 m"]);
		this.accumulationLength.setValidRange(0.0, Double.POSITIVE_INFINITY);
		this.accumulationLength.setUnitType(DistanceUnit);
		this.addInput(this.accumulationLength);

		this.accumulating = new BooleanProvInput("Accumulating", Entity.KEY_INPUTS, false);
		this.setKeywordDoc(this.accumulating, "Specifies whether the conveyor is accumulating (TRUE) or "
		                     + "non-accumulating (FALSE). "
		                     + "This property determines the conveyor's behaviour when its exit is "
		                     + "blocked. "
		                     + "If accumulating, the conveyor will continue running until all the "
		                     + "entities are bunched together at the end. "
		                     + "If non-accumulating, the conveyor will stop when the first entity "
		                     + "reaches the end and cannot exit.", []);
		this.addInput(this.accumulating);

		this.maxValidNumber = SampleInput.ofInt("MaxValidNumber", Entity.KEY_INPUTS, 10000);
		this.setKeywordDoc(this.maxValidNumber, "Maximum number of objects that can be moved by the conveyor at one "
		                     + "time. "
		                     + "An error message is generated if this limit is exceeded.\n\n"
		                     + "This input is intended to trap a model error that causes the number "
		                     + "of objects to grow without bound. "
		                     + "It has no effect on model logic.",
		         ["100"]);
		this.maxValidNumber.setValidRange(0, Double.POSITIVE_INFINITY);
		this.maxValidNumber.setIntegerValue(true);
		this.addInput(this.maxValidNumber);

		this.rotateEntities = new BooleanProvInput("RotateEntities", Entity.FORMAT, false);
		this.setKeywordDoc(this.rotateEntities, "If TRUE, the entities are rotated to match the direction of "
		                     + "the path.", []);
		this.addInput(this.rotateEntities);

		this.alignEntities = new BooleanProvInput("AlignEntities", Entity.FORMAT, false);
		this.setKeywordDoc(this.alignEntities, "If TRUE, the entities are aligned with their back-end at their "
		                     + "position on the conveyor. "
		                     + "This input should be set to TRUE for an accumulating conveyor that "
		                     + "carries entities of differing lengths.", []);
		this.addInput(this.alignEntities);

		this.widthInput = SampleInput.ofInt("LineWidth", Entity.FORMAT, 1);
		this.setKeywordDoc(this.widthInput, "The width of the conveyor in pixels.",
		         ["1"]);
		this.widthInput.setValidRange(1, Double.POSITIVE_INFINITY);
		this.widthInput.setIntegerValue(true);
		this.widthInput.setDefaultText("PolylineModel");
		this.addInput(this.widthInput);
		this.addSynonym(this.widthInput, "Width");

		this.colorInput = new ColourProvInput("LineColour", Entity.FORMAT, ColourInput.BLACK);
		this.setKeywordDoc(this.colorInput, "The colour of the conveyor.", []);
		this.colorInput.setDefaultText("PolylineModel");
		this.addInput(this.colorInput);
		this.addSynonym(this.colorInput, "Colour");
		this.addSynonym(this.colorInput, "Color");

		// Java のコンストラクタの本体
		this.entryList = [];
	}

	override validate(): void {
		super.validate();
		if (this.isAccumulating() && this.length.getNextSample(this, 0.0) <= 0.0)
			throw new InputErrorException(tr("A non-zero 'Length' input must be specified when the "
					+ "'Accumulating' input is TRUE"));
	}

	override earlyInit(): void {
		super.earlyInit();
		this.entryList.length = 0;
		this.presentTravelTime = 0.0;
		this.readyForNext = true;
	}

	override startUp(): void {
		super.startUp();
		this.presentTravelTime = this.travelTimeInput.getNextSample(this, 0.0);
	}

	override observerUpdate(subj: SubjectEntity): void {
		const simTime = EventManager.simSeconds();
		this.updateProgressToNow();
		this.updateTravelTime(simTime);
	}

	isAccumulating(): boolean {
		return this.accumulating.getNextBoolean(this, 0.0);
	}

	isRotateEntities(simTime: number): boolean {
		return this.rotateEntities.getNextBoolean(this, simTime);
	}

	isAlignEntities(simTime: number): boolean {
		return this.alignEntities.getNextBoolean(this, simTime);
	}

	override addEntity(ent: DisplayEntity ): void {
		super.addEntity(ent);
		const simTime = EventManager.simSeconds();

		// Update the positions of the entities on the conveyor
		this.updateProgressToNow();

		// Update the travel time
		this.updateTravelTime(simTime);

		// Add the entity to the conveyor
		const convLength = this.length.getNextSample(this, simTime);
		const reqdLength = this.entitySpace.getNextSample(this, simTime);
		const entLength = this.accumulationLength.getNextSample(this, simTime);
		let position = 0.0;
		if (this.entryList.length !== 0 && convLength > 0.0) {
			position = this.entryList[this.entryList.length - 1].position - reqdLength/convLength;
			position = Math.min(position, 0.0);
		}
		const entry = new EntityConveyor_ConveyorEntry(ent, entLength, position);
		this.entryList.push(entry);

		const maxNumber = jint(this.maxValidNumber.getNextSample(this, simTime));
		if (this.entryList.length > maxNumber)
			this.error(tr("Number of objects on the conveyor exceeds the limit of %s set by the "
					+ "'MaxValidNumber' input."), maxNumber);

		this.readyForNext = (position * convLength >= reqdLength);

		// Assign attributes
		this.assignAttributesAtStart(simTime);

		// Notify any observers
		this.notifyObservers();

		// If necessary, wake up the conveyor
		this.performUnscheduledUpdate();
	}

	protected override startProcessing(simTime: number): boolean {
		if (this.isTraceFlag()) this.trace(2, "startProcessing");

		if (this.entryList.length === 0) {
			this.readyForNext = true;
			return false;
		}

		const convLength = this.length.getNextSample(this, simTime);
		const reqdLength = this.entitySpace.getNextSample(this, simTime);

		let nextEntTicks = Long.MAX_VALUE;
		let exitTicks = Long.MAX_VALUE;
		let accumTicks = Long.MAX_VALUE;
		let nextTriggerTicks = Long.MAX_VALUE;
		const evt = EventManager.current();

		// Time for the conveyor to be ready for the next entity
		if (!this.readyForNext) {
			const entry = this.entryList[this.entryList.length - 1];
			const reqdPos = reqdLength/convLength;
			const reqdFrac = Math.max(reqdPos - entry.position, 0.0);
			nextEntTicks = evt.secondsToNearestTick(reqdFrac * this.presentTravelTime);
		}

		// Time for the last entity to accumulate at the end of the conveyor
		if (this.isAccumulating() && this.isReleaseThresholdClosure()) {
			let maxPos = 1.0;
			let lastEntry: EntityConveyor_ConveyorEntry | null = null;
			for (const entry of this.entryList) {
				if (lastEntry !== null)
					maxPos -= entry.length/convLength;
				lastEntry = entry;
			}
			const reqdFrac = Math.max(maxPos - lastEntry!.position, 0.0);
			const ticks = evt.secondsToNearestTick(reqdFrac * this.presentTravelTime);
			if (ticks > 0)
				accumTicks = ticks;

			// Ensure that there is room for the next entity to be added
			if (reqdLength/convLength > maxPos)
				nextEntTicks = Long.MAX_VALUE;
		}

		// Time for the first entity to reach the end of the conveyor
		else {
			const reqdFrac = Math.max(1.0 - this.entryList[0].position, 0.0);
			exitTicks = evt.secondsToNearestTick(reqdFrac * this.presentTravelTime);
		}

		// Time for the next trigger point
		for (const entry of this.entryList) {
			const ticks = this.getNextTriggerTicks(this.presentTravelTime, entry.position);
			if (ticks === -1)
				continue;
			nextTriggerTicks = Math.min(ticks, nextTriggerTicks);
		}

		// Determine the type of event to occur at the end of the time step
		const durTicks = Math.min(Math.min(nextEntTicks, nextTriggerTicks), Math.min(exitTicks, accumTicks));
		this.exitFlag = (exitTicks === durTicks);
		this.nextEntFlag = (nextEntTicks === durTicks);
		this.nextTriggerFlag = (nextTriggerTicks === durTicks);
		this.nextDuration = evt.ticksToSeconds(durTicks);

		if (this.isTraceFlag()) {
			this.traceLine(2, "nextEntTicks=%s, exitTicks=%s, accumTicks=%s",
					jlongStr(nextEntTicks), jlongStr(exitTicks), jlongStr(accumTicks));
			this.traceLine(2, "nextEntFlag=%s, exitFlag=%s", this.nextEntFlag, this.exitFlag);
		}

		return durTicks !== Long.MAX_VALUE;
	}

	protected override processStep(simTime: number): void {
		if (this.isTraceFlag()) this.trace(2, "processStep - exitFlag=%s, nextEntFlag=%s", this.exitFlag, this.nextEntFlag);

		// Release the entity at the exit of the conveyor
		if (this.exitFlag) {
			if (this.isReleaseThresholdClosure()) {
				this.setReadyToRelease(true);
			}
			else {
				const entry = this.entryList.splice(0, 1)[0];
				const ent = entry.entity;
				this.sendToNextComponent(ent);
			}
		}

		// Allow the next entity to be added to the conveyor
		if (this.nextEntFlag) {
			this.readyForNext = true;
		}

		// Notify the observers
		if (this.nextTriggerFlag) {
			this.notifyObservers();
		}

		// Reset all flags
		this.exitFlag = false;
		this.nextEntFlag = false;
		this.nextTriggerFlag = false;

		// Update the travel time
		this.updateTravelTime(simTime);
	}

	protected override getStepDuration(simTime: number): number {
		return this.nextDuration;
	}

	protected override isNewStepReqd(completed: boolean): boolean {
		return true;
	}

	override updateProgress(dt: number): void {
		if (this.isTraceFlag()) this.trace(2, "updateProgress(%s)", jstr(dt));

		if (this.presentTravelTime === 0.0)
			return;

		// Calculate the fractional distance travelled since the last update
		const frac = dt/this.presentTravelTime;
		if (MathUtils.near(frac, 0.0))
			return;

		// Increment the positions of the entities on the conveyor
		if (this.isTraceFlag()) this.traceLine(2, "BEFORE - entryList=%s", EntityConveyor.entryListStr(this.entryList));

		let lastEntry: EntityConveyor_ConveyorEntry | null = null;
		const convLength = this.length.getNextSample(this, EventManager.simSeconds());
		let maxPos = 1.0;
		for (const entry of this.entryList) {
			if (lastEntry !== null && convLength > 0.0)
				maxPos = lastEntry.position - entry.length/convLength;
			entry.position = Math.min(entry.position + frac, maxPos);
			lastEntry = entry;
		}

		if (this.isTraceFlag()) this.traceLine(2, "AFTER  - entryList=%s", EntityConveyor.entryListStr(this.entryList));
	}

	/** Java の ArrayList<ConveyorEntry>.toString()（"[(…), (…)]"） */
	private static entryListStr(list: EntityConveyor_ConveyorEntry[]): string {
		return "[" + list.map(e => e.toString()).join(", ") + "]";
	}

	private updateTravelTime(simTime: number): void {

		// Has the travel time changed?
		const newTime = this.travelTimeInput.getNextSample(this, simTime);
		if (newTime !== this.presentTravelTime) {

			if (this.isTraceFlag()) {
				this.trace(1, "updateTravelTime");
				this.traceLine(2, "newTime=%.6f, presentTravelTime=%.6f", newTime, this.presentTravelTime);
			}

			// Set the new travel time
			this.presentTravelTime = newTime;

			// Adjust the time at which the next entity will reach the end of the conveyor
			// (required when an entity is added to a conveyor that already has entities in flight)
			this.resetProcess();
		}
	}

	override thresholdChanged(): void {
		if (this.isImmediateReleaseThresholdClosure()) {
			for (const entry of this.entryList) {
				entry.position = 1.0;
			}
		}
		if (this.isBusy() && this.isAccumulating()) {
			this.performUnscheduledUpdate();
			return;
		}
		super.thresholdChanged();
	}

	override isFinished(): boolean {
		return this.entryList.length === 0;
	}

	override isStopped(): boolean {
		return this.isImmediateThresholdClosure() || this.isImmediateReleaseThresholdClosure()
				|| (this.isOperatingThresholdClosure() && this.isFinished())
				|| (this.isReleaseThresholdClosure() && this.isReadyToRelease() && !this.isAccumulating());
	}

	/**
	 * 引数があれば StateEntity の setPresentState(String)。無ければ Java の EntityConveyor.setPresentState()。
	 */
	override setPresentState(state?: string): void {
		if (state !== undefined) {
			super.setPresentState(state);
			return;
		}
		if (this.isIdle() && this.entryList.length !== 0) {
			this.setPresentState(AbstractStateUserEntity.STATE_BLOCKED);
			return;
		}
		super.setPresentState();
	}

	// ********************************************************************************************
	// GRAPHICS
	// ********************************************************************************************

	isOutlined(simTime: number): boolean {
		return true;
	}

	getLineWidth(simTime: number): number {
		if (this.widthInput.isDefault()) {
			const model = this.getDisplayModel(LineEntity);
			if (model !== null)
				return model.getLineWidth(simTime);
		}
		return jint(this.widthInput.getNextSample(this, simTime));
	}

	getLineColour(simTime: number): Color4d {
		if (this.colorInput.isDefault()) {
			const model = this.getDisplayModel(LineEntity);
			if (model !== null)
				return model.getLineColour(simTime);
		}
		return this.colorInput.getNextColour(this, simTime);
	}

	override updateGraphics(simTime: number): void {
		super.updateGraphics(simTime);

		if (this.presentTravelTime === 0.0 || !this.usePointsInput())
			return;

		// Copy the list to avoid concurrent modification exceptions
		const copiedList = [...this.entryList];

		// If the conveyor is not visible show the entities at the sub-model's process position
		if (!this.getShow() && this.getVisibleParent() instanceof CompoundEntity) {
			const ce = this.getVisibleParent() as CompoundEntity;
			for (const entry of copiedList) {
				entry.entity.moveToProcessPosition(ce, ce.getProcessPosition());
			}
			return;
		}

		// Move each entity on the conveyor to its present position
		let frac = 0.0;
		if (this.isBusy()) {
			frac = (simTime - this.getLastUpdateTime())/this.presentTravelTime;
		}
		const convLength = this.length.getNextSample(this, simTime);
		let lastEntry: EntityConveyor_ConveyorEntry | null = null;
		let lastPos = 0.0;
		for (const entry of copiedList) {

			entry.entity.setRegion(this.getCurrentRegion());

			let maxPos = 1.0;
			if (lastEntry !== null && convLength > 0.0)
				maxPos = lastPos - entry.length/convLength;
			let convPos = Math.min(entry.position + frac, maxPos);
			lastPos = convPos;
			lastEntry = entry;

			convPos = Math.max(convPos, 0.0);
			const localPos = PolylineInfo.getPositionOnPolyline(this.getCurvePoints(), convPos);
			if (this.isAlignEntities(simTime)) {
				const alignment = entry.entity.getAlignment();
				alignment.x = -0.5;
				entry.entity.setGlobalPositionForAlignment(this.getGlobalPosition(localPos), alignment);
			}
			else {
				entry.entity.setGlobalPosition(this.getGlobalPosition(localPos));
			}

			if (this.isRotateEntities(simTime)) {
				const orient = PolylineInfo.getOrientationOnPolyline(this.getCurvePoints(), convPos);
				entry.entity.setRelativeOrientation(orient);
			}
		}
	}

	getEntityList(simTime: number): DisplayEntity[] {
		const ret: DisplayEntity[] = [];
		for (const entry of this.entryList) {
			ret.push(entry.entity);
		}
		return ret;
	}

	getFractionCompletedList(simTime: number): number[] {
		const ret = new Array<number>(this.entryList.length).fill(0);
		let frac = 0.0;
		if (this.isBusy() && this.presentTravelTime > 0.0) {
			frac = (simTime - this.getLastUpdateTime())/this.presentTravelTime;
		}
		for (let i = 0; i < this.entryList.length; i++) {
			ret[i] = this.entryList[i].position + frac;
		}
		return ret;
	}

	readyForNextEntity(simTime: number): boolean {
		return this.readyForNext;
	}

	getPresentTravelTime(simTime: number): number {
		return this.presentTravelTime;
	}

	/**
	 * Delete 'MatchValue' output
	 * 引数が無い呼び出し（Java の getMatchValue()）は LinkedService のまま。引数のある出力の方だけ null を返す。
	 * TODO(移植): Java では @Output の無い上書きで出力 MatchValue が消える。OutputRegistry に消す仕組みが無いので残っている。
	 */
	override getMatchValue(simTime?: number): string | null {
		if (simTime === undefined)
			return super.getMatchValue();
		return null;
	}

	// Delete 'ServiceDuration' output
	// TODO(移植): 出力 ServiceDuration が消えない（上と同じ）
	override getServiceDuration(simTime: number): number {
		return 0.0;
	}

	// Delete 'ServicePerformed' output
	// TODO(移植): 出力 ServicePerformed が消えない（上と同じ）
	override getServicePerformed(simTime: number): number {
		return 0.0;
	}

	// Delete 'FractionCompleted' output
	// （出力の名前 FractionCompleted は、下で getFractionCompletedList に定義し直している）
	override getFractionCompleted(simTime: number): number {
		return 0.0;
	}

}

class EntityConveyor_ConveyorEntry {
	readonly entity: DisplayEntity;
	length: number;
	position: number;

	constructor(ent: DisplayEntity, lgth: number, pos: number) {
		this.entity = ent;
		this.length = lgth;
		this.position = pos;
	}

	toString(): string {
		return jformat("(%s, %.6f, %.6f)", this.entity, this.length, this.position);
	}
}

defineOutput(EntityConveyor, {
	name: "EntityList",
	description: "The entities being processed at present.",
	sequence: 1,
	returnType: "ArrayList",
	get: (e, simTime) => e.getEntityList(simTime),
});

defineOutput(EntityConveyor, {
	name: "FractionCompleted",
	description: "The fraction of the conveyor length (or travel time) that has been completed "
	             + "by each entity being processed.",
	unitType: DimensionlessUnit,
	sequence: 2,
	returnType: "double[]",
	get: (e, simTime) => e.getFractionCompletedList(simTime),
});

defineOutput(EntityConveyor, {
	name: "ReadyForNextEntity",
	description: "Returns true if there is enough space on the conveyor to accept the next "
	             + "entity.",
	sequence: 3,
	returnType: "boolean",
	get: (e, simTime) => e.readyForNextEntity(simTime),
});

defineOutput(EntityConveyor, {
	name: "PresentTravelTime",
	description: "Returns the travel time that is being used at present for the conveyor. "
	             + "This time can differ from the value for the TravelTime input if the conveyor "
	             + "has not been updated by the arrival or exit of an entity, or been triggered "
	             + "by an entry in its WatchList.",
	unitType: TimeUnit,
	sequence: 4,
	returnType: "double",
	get: (e, simTime) => e.getPresentTravelTime(simTime),
});

ClassRegistry.register("com.jaamsim.ProcessFlow.EntityConveyor", EntityConveyor);

// Java は @Output の付かない関数で上書きして、次の出力を消している
hideOutput(EntityConveyor, "MatchValue");
hideOutput(EntityConveyor, "ServiceDuration");
hideOutput(EntityConveyor, "ServicePerformed");
