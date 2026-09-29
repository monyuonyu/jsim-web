/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2014 Ausenco Engineering Canada Inc.
 * Copyright (C) 2016-2025 JaamSim Software Inc.
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

// 多重定義 getMatchValue() と出力の getMatchValue(double) は、同じ中身なので 1 つにした。
// moveToProcessPosition(DisplayEntity) は、物の位置（状態）を決めるので残した。DisplayEntity の
// moveToProcessPosition(DisplayEntity, Vec3d) と、引数の数で見分ける 1 つの関数にした。

import { tr } from "../i18n/I18n.ts";
import { KeywordCommand } from "../Commands/KeywordCommand.ts";
import { EntityProvInput } from "../EntityProviders/EntityProvInput.ts";
import type { DisplayEntity } from "../Graphics/DisplayEntity.ts";
import { SampleListInput } from "../Samples/SampleListInput.ts";
import { StringProvInput } from "../StringProviders/StringProvInput.ts";
import { CompoundEntity } from "../SubModels/CompoundEntity.ts";
import { Entity } from "../basicsim/Entity.ts";
import { isSubjectEntity, type SubjectEntity } from "../basicsim/SubjectEntity.ts";
import { EventManager } from "../events/EventManager.ts";
import { AssignmentListInput } from "../input/AssignmentListInput.ts";
import { ExpResType } from "../input/ExpResType.ts";
import { ExpressionInput } from "../input/ExpressionInput.ts";
import { InputErrorException } from "../input/InputErrorException.ts";
import { InterfaceEntityListInput } from "../input/InterfaceEntityListInput.ts";
import { KeywordIndex } from "../input/KeywordIndex.ts";
import { defineOutput } from "../input/OutputRegistry.ts";
import { Vec3dInput } from "../input/Vec3dInput.ts";
import { Vec3d } from "../math/Vec3d.ts";
import { DimensionlessUnit } from "../units/DimensionlessUnit.ts";
import { DistanceUnit } from "../units/DistanceUnit.ts";
import { TimeUnit } from "../units/TimeUnit.ts";
import { LinkedDevice } from "./LinkedDevice.ts";
import { Queue } from "./Queue.ts";
import { QueueUser } from "./QueueUser.ts";

/**
 * Java の SubjectEntity.class の代わり（SubjectEntity には値が無いので、instanceof で使える物を作った）。
 * TODO(移植): InterfaceEntityListInput に渡すインターフェースの形を まとまり C（input）に合わせる
 */
const SubjectEntityClass = {
	[Symbol.hasInstance](o: unknown): o is SubjectEntity {
		return isSubjectEntity(o);
	},
};

/** Java の Arrays.binarySearch(long[], long) */
function binarySearch(a: number[], key: number): number {
	let low = 0;
	let high = a.length - 1;
	while (low <= high) {
		const mid = (low + high) >>> 1;
		const midVal = a[mid];
		if (midVal < key)
			low = mid + 1;
		else if (midVal > key)
			high = mid - 1;
		else
			return mid; // key found
	}
	return -(low + 1);  // key not found.
}

export abstract class LinkedService extends LinkedDevice implements QueueUser {

	protected readonly processPosition: Vec3dInput;

	protected readonly waitQueue: EntityProvInput<Queue>;

	protected readonly match: StringProvInput;

	protected readonly selectionCondition: ExpressionInput;

	protected readonly nextEntity: ExpressionInput;

	protected readonly watchList: InterfaceEntityListInput<SubjectEntity>;

	protected readonly assignmentsAtStart: AssignmentListInput;

	protected readonly triggerPointList: SampleListInput;

	private matchValue: string | null = null;

	constructor() {
		super();
		this.stateGraphics.setHidden(false);
		this.workingStateListInput.setHidden(false);

		this.processPosition = new Vec3dInput("ProcessPosition", Entity.FORMAT, new Vec3d(0.0, 0.0, 0.01));
		this.setKeywordDoc(this.processPosition, "The position of the entity being processed relative to the processor.",
		         ["1.0 0.0 0.01 m"]);
		this.processPosition.setUnitType(DistanceUnit);
		this.addInput(this.processPosition);

		this.waitQueue = new EntityProvInput<Queue>(Queue, "WaitQueue", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.waitQueue, "Queue from which the next entity for processing will be selected.\n\n"
		                     + "If an expression is entered that can return various Queues, it is "
		                     + "necessary for each Queue to be included in the entry to the "
		                     + "'WatchList' keyword. "
		                     + "If a Queue is not included, then the arrival of an entity to that "
		                     + "Queue will not wake up this processor.",
		         ["Queue1", "'this.NumberProcessed % 2 == 0 ? [Queue1] : [Queue2]'"]);
		this.waitQueue.setRequired(true);
		this.addInput(this.waitQueue);

		this.match = new StringProvInput("Match", Entity.KEY_INPUTS, "");
		this.setKeywordDoc(this.match, "An expression returning a string value that determines which of the "
		                     + "queued entities are eligible to be selected. "
		                     + "If used, the only entities eligible for selection are the ones whose "
		                     + "inputs for the Queue's 'Match' keyword are equal to value returned by "
		                     + "the expression entered for this 'Match' keyword. "
		                     + "Expressions that return a dimensionless integer or an object are also "
		                     + "valid. The returned number or object is converted to a string "
		                     + "automatically. A floating point number is truncated to an integer."
		                     + "\n\n"
		                     + "A match value of null or an empty string allows any entity in the "
		                     + "Queue to be eligible for selection, regardless of its match value."
		                     + "\n\n"
		                     + "Note that a change in the 'Match' value does not trigger "
		                     + "the processor automatically to re-check the Queue. "
		                     + "The processor can be triggered by adding one or more objects to the "
		                     + "'WatchList' input.",
		         ["this.obj.Attrib1"]);
		this.match.setUnitType(DimensionlessUnit);
		this.addInput(this.match);

		this.selectionCondition = new ExpressionInput("SelectionCondition", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.selectionCondition, "An optional expression that tests whether an entity in the queue is "
		                     + "eligible to be processed. "
		                     + "The expression should return 1 (true) if the entity is eligible. "
		                     + "The entity chosen for processing is the first one in the queue that "
		                     + "satisfies both the 'SelectionCondition' expression and the 'Match' "
		                     + "value (if specified)."
		                     + "\n\n"
		                     + "Unlike the 'Match' value, which must be specified when an entity "
		                     + "first enters the queue, the 'SelectionCondition' is evaluated when an "
		                     + "entity is to be removed from the queue. "
		                     + "Consequently, a 'SelectionCondition' is more flexible than a 'Match' "
		                     + "value, but is significantly less efficient."
		                     + "\n\n"
		                     + "Note that a change in the 'SelectionCondition' value does not "
		                     + "trigger the processor automatically to re-check the Queue. "
		                     + "The processor can be triggered by adding one or more objects to the "
		                     + "'WatchList' input.",
		         ["'this.obj.attrib > 10'"]);
		this.selectionCondition.setUnitType(DimensionlessUnit);
		this.selectionCondition.setResultType(ExpResType.NUMBER);
		this.addInput(this.selectionCondition);

		this.nextEntity = new ExpressionInput("NextEntity", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.nextEntity, "An optional expression that returns the next entity to be removed "
		                     + "from the queue. "
		                     + "No entity is removed if the expression returns null or the entity is "
		                     + "not present in the queue. "
		                     + "To be removed, the entity must also satisfy the 'Match' and "
		                     + "'SelectionCondition' inputs if these are entered."
		                     + "\n\n"
		                     + "Note that a change in the value of the 'NextEntity' input does not "
		                     + "trigger the processor to automatically to re-check the Queue. "
		                     + "The processor can be triggered by adding one or more objects to the "
		                     + "'WatchList' input.",
		         ["'this.nextEntity'"]);
		this.nextEntity.setResultType(ExpResType.ENTITY);
		this.addInput(this.nextEntity);

		this.watchList = new InterfaceEntityListInput<SubjectEntity>(SubjectEntityClass, "WatchList", Entity.KEY_INPUTS, []);
		this.setKeywordDoc(this.watchList, "An optional list of objects to monitor.\n\n"
		                     + "The queue will be inspected for an entity to process whenever one of "
		                     + "the 'WatchList' objects changes state.",
		         ["Object1  Object2"]);
		this.watchList.setIncludeSelf(false);
		this.watchList.setUnique(true);
		this.addInput(this.watchList);

		this.assignmentsAtStart = new AssignmentListInput("AssignmentsAtStart", Entity.OPTIONS, []);
		this.setKeywordDoc(this.assignmentsAtStart, "A list of attribute assignments that are triggered at the start of "
		                     + "processing for each new entity, after any resources have been seized.", []);
		this.addInput(this.assignmentsAtStart);

		this.triggerPointList = new SampleListInput("TriggerPointList", Entity.OPTIONS, []);
		this.setKeywordDoc(this.triggerPointList, "Optional values for the fraction of service time completed at which "
		                     + "to update this object and to notify the watchers of this object. "
		                     + "Each entry must be a dimensionless number between 0.0 and 1.0, and be "
		                     + "entered in order of increasing value.",
		         ["0.5 0.8"]);
		this.triggerPointList.setUnitType(DimensionlessUnit);
		this.triggerPointList.setDimensionless(true);
		this.triggerPointList.setValidRange(0.0, 1.0);
		this.triggerPointList.setMonotonic(1);
		this.triggerPointList.setHidden(true);
		this.addInput(this.triggerPointList);
	}

	override validate(): void {
		super.validate();

		// Check the WaitQueue expression
		if (!this.waitQueue.isDefault()) {
			const q = this.getQueue(0.0);  // Ensures that the expression can be evaluated
			if (q === null)
				throw new InputErrorException(0, this.waitQueue.getValueString(),
						tr("Input to 'WaitQueue' returns null"));
		}
	}

	override earlyInit(): void {
		super.earlyInit();
		this.matchValue = null;
	}

	override getWatchList(): SubjectEntity[] {
		return this.watchList.getValue();
	}

	override observerUpdate(subj: SubjectEntity): void {

		// Avoid unnecessary updates
		if (this.isBusy())
			return;

		this.performUnscheduledUpdate();
	}

	override addEntity(ent: DisplayEntity): void {
		if (this.isTraceFlag()) this.trace(0, "addEntity(%s)", ent);

		// If there is no queue, then process the entity immediately
		const simTime = EventManager.simSeconds();
		const queue = this.getQueue(simTime);
		if (queue === null) {
			super.addEntity(ent);
			return;
		}

		// Add the entity to the queue
		queue.addEntity(ent);
	}

	// ********************************************************************************************
	// SELECTING AN ENTITY FROM THE WAIT QUEUE
	// ********************************************************************************************

	/**
	 * Removes the next entity to be processed from the queue.
	 * If the specified match value is not null, then only the queued entities
	 * with the same match value are eligible to be removed.
	 * @param m - match value.
	 * @return next entity for processing.
	 */
	protected removeNextEntity(m: string | null): DisplayEntity | null {
		const simTime = EventManager.simSeconds();
		const queue = this.getQueue(simTime)!;

		if (this.selectionCondition.isDefault() && this.nextEntity.isDefault())
			return queue.removeFirst(m);

		// Evaluate the NextEntity input
		let entity: DisplayEntity | null = null;
		if (!this.nextEntity.isDefault()) {
			entity = this.getNextEntityValue(simTime);
			if (entity === null)
				return null;
		}

		// Find the first entity that satisfies the SelectionCondition and NextEntity inputs
		return queue.removeFirst(m, this, simTime, entity);
	}

	protected getNextEntity(m: string | null): DisplayEntity | null {
		const simTime = EventManager.simSeconds();
		const queue = this.getQueue(simTime)!;

		if (this.selectionCondition.isDefault() && this.nextEntity.isDefault())
			return queue.getFirst(m);

		// Evaluate the NextEntity input
		let entity: DisplayEntity | null = null;
		if (!this.nextEntity.isDefault()) {
			entity = this.getNextEntityValue(simTime);
			if (entity === null)
				return null;
		}

		// Find the first entity that satisfies the SelectionCondition and NextEntity inputs
		return queue.getFirst(m, this, simTime, entity);
	}

	private getNextEntityValue(simTime: number): DisplayEntity | null {
		return this.nextEntity.getNextResult(this, simTime).entVal as DisplayEntity | null;
	}

	/**
	 * Returns a value which determines which of the entities in the queue are
	 * eligible to be removed. Returns null if the Match keyword has not been set.
	 * @param simTime - present simulation time in seconds.
	 * @return match value.
	 */
	protected getNextMatchValue(simTime: number): string | null {
		if (this.match.isDefault())
			return null;
		const ret = this.match.getNextString(this, simTime, 1.0, true);
		if (ret === null || ret.length === 0 || ret === "null")
			return null;
		return ret;
	}

	protected setMatchValue(m: string | null): void {
		this.matchValue = m;
	}

	/** Java の getMatchValue() と出力の getMatchValue(double simTime) */
	getMatchValue(simTime?: number): string | null {
		return this.matchValue;
	}

	/**
	 * Returns whether the specified entity satisfies the SelectionCondition input.
	 * @param ent - entity to be tested
	 * @param simTime - present simulation time
	 * @return true if the entity satisfies the SelectionCondition
	 */
	isAllowed(ent: DisplayEntity, simTime: number): boolean {
		if (this.selectionCondition.isDefault())
			return true;

		// Temporarily set the output 'obj' so that the expression can be evaluated
		const oldEnt = this.getReceivedEntity(simTime);
		this.setReceivedEntity(ent);

		// Evaluate the condition for the proposed user
		const ret = this.selectionCondition.getNextResult(this, simTime).value !== 0;

		// Reset the output 'obj' to the original entity
		this.setReceivedEntity(oldEnt);

		return ret;
	}

	assignAttributesAtStart(simTime: number): void {
		this.assignmentsAtStart.executeAssignments(this, simTime);
	}

	// ********************************************************************************************
	// WAIT QUEUE
	// ********************************************************************************************

	addQueue(que: Queue): void {
		if (this.waitQueue.getHidden()) {
			return;
		}

		const toks: string[] = [];
		toks.push(que.getName());
		const kw = new KeywordIndex(this.waitQueue.getKeyword(), toks, null);
		this.getJaamSimModel().storeAndExecute(new KeywordCommand(this, kw));
	}

	getQueue(simTime: number): Queue | null {
		return this.waitQueue.getNextEntity(this, simTime);
	}

	getQueues(): Queue[] {
		const ret: Queue[] = [];

		// Do not register the WaitQueue when the 'WatchList' input is set
		if (!(this.getWatchList().length === 0))
			return ret;

		try {
			const queue = this.getQueue(0.0);
			if (queue !== null)
				ret.push(queue);
		}
		catch (e) {}
		return ret;
	}

	queueChanged(): void {
		if (this.isTraceFlag()) this.trace(0, "queueChanged");
		this.restart();
	}

	// ********************************************************************************************
	// DEVICE METHODS
	// ********************************************************************************************

	protected override updateProgress(dt: number): void {}

	protected override processChanged(): void {}

	protected override isNewStepReqd(completed: boolean): boolean {
		return completed;
	}

	protected override setProcessStopped(): void {}

	/**
	 * Return the time in clock ticks until the next trigger point is reached.
	 * @param dur - service time for the process
	 * @param pos - fraction of the process that has been completed
	 * @return clock ticks until the next trigger point
	 */
	protected getNextTriggerTicks(dur: number, pos: number): number {
		if (this.triggerPointList.isDefault() || dur <= 0.0)
			return -1;
		const simTime = this.getJaamSimModel().getSimTime();
		const evt = this.getJaamSimModel().getEventManager();

		// Service completed in clock ticks
		const ticks = evt.secondsToNearestTick(pos * dur);

		// Construct an array of trigger points in clock ticks
		const n = this.triggerPointList.getListSize();
		const triggerTicks: number[] = new Array<number>(n).fill(0);
		const triggerPoints = this.triggerPointList.getNextDoubles(this, simTime);
		for (let i = 0; i < n; i++) {
			triggerTicks[i] = evt.secondsToNearestTick(triggerPoints[i] * dur);
		}

		// Find the index for the next trigger point
		let index = binarySearch(triggerTicks, ticks);
		if (index >= 0) {
			index++;
		}
		else {
			index = -index - 1;
		}

		if (index >= n)
			return -1;
		return triggerTicks[index] - ticks;
	}

	// ********************************************************************************************
	// GRAPHICS
	// ********************************************************************************************

	/**
	 * 引数が 1 つなら Java の LinkedService.moveToProcessPosition(DisplayEntity ent)（ent をこの物の処理の位置へ動かす）。
	 * 引数が 2 つなら DisplayEntity.moveToProcessPosition(DisplayEntity ent, Vec3d offset)（多重定義のもう一方）。
	 */
	override moveToProcessPosition(ent: DisplayEntity, offset?: Vec3d): void {
		if (offset !== undefined) {
			super.moveToProcessPosition(ent, offset);
			return;
		}
		if (!this.getShow() && this.getVisibleParent() instanceof CompoundEntity) {
			const ce = this.getVisibleParent() as CompoundEntity;
			ent.moveToProcessPosition(ce, ce.getProcessPosition());
			return;
		}
		ent.moveToProcessPosition(this, this.processPosition.getValue());
	}

	override getSourceEntities(): DisplayEntity[] {
		const ret = super.getSourceEntities();
		try {
			const queue = this.getQueue(0.0);
			if (queue !== null)
				ret.push(queue);
		}
		catch (e) {}
		return ret;
	}

	// ********************************************************************************************
	// OUTPUTS
	// ********************************************************************************************

	getServiceDuration(simTime: number): number {
		return this.getDuration();
	}

	getServicePerformed(simTime: number): number {
		return this.getDuration() - this.getRemainingDuration(simTime);
	}

	getFractionCompleted(simTime: number): number {
		if (this.getDuration() <= 0.0)
			return 0.0;
		return this.getServicePerformed(simTime)/this.getDuration();
	}

}

QueueUser.register(LinkedService);

defineOutput(LinkedService, {
	name: "MatchValue",
	description: "The present value to be matched in the queue.",
	sequence: 0,
	returnType: "String",
	get: (e, simTime) => e.getMatchValue(simTime),
});

defineOutput(LinkedService, {
	name: "ServiceDuration",
	description: "The total working time required for the present service activity.",
	unitType: TimeUnit,
	sequence: 1,
	returnType: "double",
	get: (e, simTime) => e.getServiceDuration(simTime),
});

defineOutput(LinkedService, {
	name: "ServicePerformed",
	description: "The working time that has been completed for the present service activity.",
	unitType: TimeUnit,
	sequence: 2,
	returnType: "double",
	get: (e, simTime) => e.getServicePerformed(simTime),
});

defineOutput(LinkedService, {
	name: "FractionCompleted",
	description: "The portion of the total service time for the present service activity that "
	             + "has been completed.",
	unitType: DimensionlessUnit,
	sequence: 3,
	returnType: "double",
	get: (e, simTime) => e.getFractionCompleted(simTime),
});
