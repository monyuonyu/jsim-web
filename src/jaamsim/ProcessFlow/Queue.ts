/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2003-2011 Ausenco Engineering Canada Inc.
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

// 入れ子のクラス QueueEntry・DoQueueChanged・RenegeActionTarget は、このファイルの
// Queue_QueueEntry・Queue_DoQueueChanged・Queue_RenegeActionTarget にした。
// 多重定義 removeFirst()/removeFirst(String)/removeFirst(String, LinkedService, double, DisplayEntity)、
// getFirst(…) も同様、getCount()/getCount(String)、isEmpty()/isEmpty(String)、getEntityList()/getEntityList(String) は
// 引数の数で見分ける 1 つの関数にした（省いた match は null）。
// getPosition(DisplayEntity) は DisplayEntity.getPosition()（位置の Vec3d）とぶつかるので getPositionOf にした（docs/renamed.md）。
// updateGraphics は、並んだ物の位置・向き・表示の計算（状態）なので残した。

import { Double } from "../internal.ts";
import { ClassRegistry } from "../internal.ts";
import { tr } from "../internal.ts";
import { BooleanProvInput } from "../internal.ts";
import { DisplayEntity } from "../internal.ts";
import { SampleInput } from "../internal.ts";
import { TimeBasedFrequency } from "../internal.ts";
import { TimeBasedStatistics } from "../internal.ts";
import { StringProvInput } from "../internal.ts";
import { CompoundEntity } from "../internal.ts";
import { Entity } from "../internal.ts";
import { EntityTarget } from "../internal.ts";
import { EventHandle } from "../internal.ts";
import { EventManager } from "../internal.ts";
import { ProcessTarget } from "../internal.ts";
import { Input } from "../internal.ts";
import type { InputCallback } from "../input/InputCallback.ts";
import { InterfaceEntityInput } from "../internal.ts";
import { defineOutput } from "../internal.ts";
import { Quaternion } from "../internal.ts";
import { Vec3d } from "../internal.ts";
import { DimensionlessUnit } from "../internal.ts";
import { DistanceUnit } from "../internal.ts";
import { TimeUnit } from "../internal.ts";
import { EntStorage, EntStorage_StorageEntry } from "../internal.ts";
import { Linkable } from "../internal.ts";
import { LinkedComponent } from "../internal.ts";
import { LinkedService } from "../internal.ts";
import { QueueUser } from "../internal.ts";

/** Java の (int) x（double → int。NaN は 0、範囲の外は端に丸める） */
function jint(x: number): number {
	if (Number.isNaN(x))
		return 0;
	if (x >= 2147483647)
		return 2147483647;
	if (x <= -2147483648)
		return -2147483648;
	return Math.trunc(x);
}

export class Queue extends LinkedComponent {

	private readonly priority: SampleInput;

	private readonly match: StringProvInput;

	private readonly fifo: BooleanProvInput;

	private readonly renegeTime: SampleInput;

	private readonly renegeCondition: SampleInput;

	protected readonly renegeDestination: InterfaceEntityInput<Linkable>;

	protected readonly maxValidLength: SampleInput;

	private readonly spacing: SampleInput;

	protected readonly maxPerLine: SampleInput; // maximum items per sub line-up of queue

	protected readonly maxRows: SampleInput;

	protected readonly showEntities: BooleanProvInput;

	private readonly storage: EntStorage;  // stores the entities in the queue
	private readonly userList: QueueUser[];  // other objects that use this queue
	private readonly stats: TimeBasedStatistics;
	private readonly freq: TimeBasedFrequency;
	protected numberReneged = 0;  // number of entities that reneged from the queue

	constructor() {
		super();
		this.defaultEntity.setHidden(true);
		this.nextComponent.setHidden(true);

		this.priority = SampleInput.ofInt("Priority", Entity.KEY_INPUTS, 0);
		this.setKeywordDoc(this.priority, "The priority for positioning the received entity in the queue. "
		                     + "Priority is integer valued and a lower numerical value indicates a "
		                     + "higher priority. "
		                     + "For example, priority 3 is higher than 4, and priorities 3, 3.2, and "
		                     + "3.8 are equivalent.",
		         ["this.obj.Attrib1"]);
		this.priority.setUnitType(DimensionlessUnit);
		this.priority.setIntegerValue(true);
		this.priority.setValidRange(0.0, Double.POSITIVE_INFINITY);
		this.addInput(this.priority);

		this.match = new StringProvInput("Match", Entity.KEY_INPUTS, "");
		this.setKeywordDoc(this.match, "An expression returning a string value that categorizes the queued "
		                     + "entities. The expression is evaluated and the value saved when the "
		                     + "entity first arrives at the queue. "
		                     + "Expressions that return a dimensionless integer or an object are also "
		                     + "valid. The returned number or object is converted to a string "
		                     + "automatically. A floating point number is truncated to an integer.",
		         ["this.obj.Attrib1"]);
		this.match.setUnitType(DimensionlessUnit);
		this.addInput(this.match);

		this.fifo = new BooleanProvInput("FIFO", Entity.KEY_INPUTS, true);
		this.setKeywordDoc(this.fifo, "Determines the order in which entities are placed in the queue (FIFO "
		                     + "or LIFO):\n"
		                     + "TRUE = first in first out (FIFO) order (the default setting),\n"
		                     + "FALSE = last in first out (LIFO) order.", []);
		this.addInput(this.fifo);

		this.renegeTime = new SampleInput("RenegeTime", Entity.KEY_INPUTS, Double.POSITIVE_INFINITY);
		this.setKeywordDoc(this.renegeTime, "The time an entity will wait in the queue before deciding whether or "
		                     + "not to renege. Evaluated when the entity first enters the queue.",
		         ["3.0 h", "NormalDistribution1",
		                        "'1[s] + 0.5*[TimeSeries1].PresentValue'"]);
		this.renegeTime.setUnitType(TimeUnit);
		this.renegeTime.setValidRange(0.0, Double.POSITIVE_INFINITY);
		this.renegeTime.setCallback(Queue.inputCallback);
		this.addInput(this.renegeTime);

		this.renegeCondition = SampleInput.ofInt("RenegeCondition", Entity.KEY_INPUTS, 1);
		this.setKeywordDoc(this.renegeCondition, "A logical condition that determines whether an entity will renege "
		                     + "after waiting for its RenegeTime value. Note that TRUE and FALSE are "
		                     + "entered as 1 and 0, respectively.",
		         ["1", "'this.QueuePosition > 1'",
		                        "'this.QueuePostion > [Queue2].QueueLength'"]);
		this.renegeCondition.setUnitType(DimensionlessUnit);
		this.renegeCondition.setValidRange(0.0, 1.0);
		this.addInput(this.renegeCondition);

		this.renegeDestination = new InterfaceEntityInput<Linkable>(Linkable, "RenegeDestination", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.renegeDestination, "The object to which an entity will be sent if it reneges.",
		         ["Branch1"]);
		this.addInput(this.renegeDestination);

		this.maxValidLength = SampleInput.ofInt("MaxValidLength", Entity.KEY_INPUTS, 10000);
		this.setKeywordDoc(this.maxValidLength, "Maximum number of objects that can be placed in the queue. "
		                     + "An error message is generated if this limit is exceeded.\n\n"
		                     + "This input is intended to trap a model error that causes the queue "
		                     + "length to grow without bound. "
		                     + "It has no effect on model logic.",
		         ["100"]);
		this.maxValidLength.setValidRange(0, Double.POSITIVE_INFINITY);
		this.maxValidLength.setIntegerValue(true);
		this.addInput(this.maxValidLength);

		this.spacing = new SampleInput("Spacing", Entity.FORMAT, 0.0);
		this.setKeywordDoc(this.spacing, "The amount of graphical space shown between objects in the queue.",
		         ["1 m"]);
		this.spacing.setUnitType(DistanceUnit);
		this.addInput(this.spacing);

		this.maxPerLine = new SampleInput("MaxPerLine", Entity.FORMAT, Double.POSITIVE_INFINITY);
		this.setKeywordDoc(this.maxPerLine, "Maximum number of objects in each row of the Queue.",
				["4"]);
		this.maxPerLine.setValidRange(1, Double.POSITIVE_INFINITY);
		this.maxPerLine.setIntegerValue(true);
		this.addInput(this.maxPerLine);

		this.maxRows = new SampleInput("MaxRows", Entity.FORMAT, Double.POSITIVE_INFINITY);
		this.setKeywordDoc(this.maxRows, "The number of rows in each level of the Queue.",
				["4"]);
		this.maxRows.setValidRange(1, Double.POSITIVE_INFINITY);
		this.maxRows.setIntegerValue(true);
		this.addInput(this.maxRows);

		this.showEntities = new BooleanProvInput("ShowEntities", Entity.FORMAT, true);
		this.setKeywordDoc(this.showEntities, "If TRUE, the objects in the Queue are displayed.", []);
		this.addInput(this.showEntities);

		this.userUpdate = new Queue_DoQueueChanged(this);
		this.userUpdateHandle = new EventHandle();

		this.storage = new EntStorage();
		this.userList = [];
		this.stats = new TimeBasedStatistics();
		this.freq = new TimeBasedFrequency(0, 10);
	}

	static override readonly inputCallback: InputCallback = {
		callback(ent: Entity, inp: Input<unknown>): void {
			(ent as Queue).updateRenegeTimeCallback();
		},
	} as InputCallback;

	updateRenegeTimeCallback(): void {
		const bool = !this.renegeTime.isDefault();
		this.renegeDestination.setRequired(bool);
	}

	override earlyInit(): void {
		super.earlyInit();

		// Clear the entries in the queue
		this.storage.clear();

		// Clear statistics
		this.stats.clear();
		this.stats.addValue(0.0, 0.0);
		this.freq.clear();
		this.freq.addValue(0.0, 0);
		this.numberReneged = 0;

		// Identify the objects that use this queue
		this.userList.length = 0;
		for (const each of this.getJaamSimModel().getClonesOfIterator(Entity, (o: unknown) => o instanceof QueueUser)) {
			const u = each as unknown as QueueUser;
			if (u.getQueues().includes(this))
				this.userList.push(u);
		}
	}

	isFIFO(simTime: number): boolean {
		return this.fifo.getNextBoolean(this, simTime);
	}

	isShowEntities(simTime: number): boolean {
		return this.showEntities.getNextBoolean(this, simTime);
	}

	private readonly userUpdate: Queue_DoQueueChanged;
	private readonly userUpdateHandle: EventHandle;

	/** Queue_DoQueueChanged から使う（Java では入れ子のクラスが private の userList を直接読む） */
	getUserList(): QueueUser[] {
		return this.userList;
	}

	// ******************************************************************************************************
	// QUEUE HANDLING METHODS
	// ******************************************************************************************************

	override addEntity(ent: DisplayEntity): void {
		super.addEntity(ent);
		const simTime = EventManager.simSeconds();

		// Update the queue statistics
		this.stats.addValue(simTime, this.storage.size() + 1);
		this.freq.addValue(simTime, this.storage.size() + 1);

		// Build the entry for the entity
		let n = this.getTotalNumberAdded();
		if (!this.isFIFO(simTime))
			n *= -1;
		const pri = jint(this.priority.getNextSample(this, simTime));
		let m: string | null = null;
		if (!this.match.isDefault())
			m = this.match.getNextString(this, simTime, 1.0, true);

		let rh: EventHandle | null = null;
		if (!this.renegeTime.isDefault())
			rh = new EventHandle();

		const entry = new Queue_QueueEntry(ent, m, pri, n, simTime, rh);
		this.storage.add(entry);

		const maxLength = jint(this.maxValidLength.getNextSample(this, simTime));
		if (this.storage.size() > maxLength)
			this.error(tr("Number of objects in the queue exceeds the limit of %s set by the "
					+ "'MaxValidLength' input."), maxLength);

		// Notify the users of this queue
		if (!this.userUpdateHandle.isScheduled())
			EventManager.scheduleTicks(0, Entity.PRI_HIGH, Entity.EVT_LIFO, this.userUpdate, this.userUpdateHandle);

		// Schedule the time to check the renege condition
		if (!this.renegeTime.isDefault()) {
			const dur = this.renegeTime.getNextSample(this, EventManager.simSeconds());
			// Schedule the renege tests in FIFO order so that if two or more entities are added to
			// the queue at the same time, the one nearest the front of the queue is tested first
			EventManager.scheduleSeconds(dur, Entity.PRI_NORMAL, Entity.EVT_FIFO, new Queue_RenegeActionTarget(this, entry), rh);
		}
	}

	renegeAction(entry: Queue_QueueEntry): void {

		// Temporarily set the obj entity to the one that might renege
		const simTime = EventManager.simSeconds();
		const oldEnt = this.getReceivedEntity(simTime);
		this.setReceivedEntity(entry.entity);

		// Check the condition for reneging
		const bool = (this.renegeCondition.getNextSample(this, simTime) === 0.0);
		this.setReceivedEntity(oldEnt);
		if (bool) {
			return;
		}

		// Remove the entity from the queue and send it to the renege destination
		this.remove(entry);
		this.numberReneged++;
		this.renegeDestination.getValue()!.addEntity(entry.entity);
	}

	removeEntity(ent: DisplayEntity): DisplayEntity {
		return this.remove(this.getQueueEntry(ent)!);
	}

	/**
	 * Removes a specified entity from the queue
	 */
	private remove(entry: Queue_QueueEntry): DisplayEntity {
		const simTime = EventManager.simSeconds();

		// Update the queue statistics
		this.stats.addValue(simTime, this.storage.size() - 1);
		this.freq.addValue(simTime, this.storage.size() - 1);

		// Remove the entity from the storage
		const found = this.storage.remove(entry);
		if (!found)
			this.error(tr("Cannot find the entry in itemSet."));

		// Kill the renege event
		if (entry.renegeHandle !== null)
			EventManager.killEvent(entry.renegeHandle);

		// Reset the entity's orientation to its original value
		entry.entity.setShow(true);

		// Notify any observers
		this.notifyObservers();

		this.releaseEntity(simTime);
		return entry.entity;
	}

	private getQueueEntry(ent: DisplayEntity): Queue_QueueEntry | null {
		const itr = this.storage.iterator()!;
		while (itr.hasNext()) {
			const entry = itr.next() as Queue_QueueEntry;
			if (entry.entity === ent)
				return entry;
		}
		return null;
	}

	/**
	 * Returns the position of the specified entity in the queue.
	 * Returns -1 if the entity is not found.
	 * @param ent - entity in question
	 * @return index of the entity in the queue.
	 */
	getPositionOf(ent: DisplayEntity): number {
		let ret = 0;
		const itr = this.storage.iterator()!;
		while (itr.hasNext()) {
			if (itr.next().entity === ent)
				return ret;

			ret++;
		}
		return -1;
	}

	/**
	 * Returns the number of seconds spent by the first object in the queue
	 */
	getQueueTime(): number {
		const entry = this.storage.first() as Queue_QueueEntry;
		return EventManager.simSeconds() - entry.timeAdded;
	}

	/**
	 * Returns the priority value for the first object in the queue
	 */
	getFirstPriority(): number {
		return this.storage.first()!.priority;
	}

	/**
	 * Returns the number of times that the specified match value appears in
	 * the queue. If the match value is null, then every entity is counted.
	 * （Java の getCount() は getCount(null)）
	 * @param m - value to be matched.
	 * @return number of entities that have this match value.
	 */
	getCount(m: string | null = null): number {
		return this.storage.size(m);
	}

	/** Returns true if the queue is empty（Java の isEmpty() は isEmpty(null)） */
	isEmpty(m: string | null = null): boolean {
		return this.storage.isEmpty(m);
	}

	/**
	 * getFirst()・getFirst(String m)・getFirst(String m, LinkedService serv, double simTime, DisplayEntity ent)。
	 * serv を渡したときは、SelectionCondition を満たす最初の物（ent が null でなければ、その物だけが対象）。
	 */
	getFirst(m: string | null = null, serv?: LinkedService, simTime?: number, ent?: DisplayEntity | null): DisplayEntity | null {
		if (serv === undefined) {
			const entry = this.storage.first(m);
			if (entry === null)
				return null;
			return entry.entity;
		}
		const entry = this.getFirstEntry(m, serv, simTime!, ent ?? null);
		if (entry === null)
			return null;
		return entry.entity;
	}

	getTimeAdded(m: string | null): number {
		return this.storage.first(m)!.timeAdded;
	}

	/**
	 * removeFirst()・removeFirst(String m)・removeFirst(String m, LinkedService serv, double simTime, DisplayEntity ent)。
	 * Returns the first entity in the queue whose match value is equal to the
	 * specified value. The returned entity is removed from the queue.
	 * If the match value is null, the first entity is removed.
	 * serv を渡したときは、SelectionCondition を満たす最初の物（ent が null でなければ、その物だけが対象）。
	 * @param m - value to be matched.
	 * @return entity whose match value equals the specified value.
	 */
	removeFirst(m: string | null = null, serv?: LinkedService, simTime?: number, ent?: DisplayEntity | null): DisplayEntity | null {
		if (serv === undefined) {
			const entry = this.storage.first(m) as Queue_QueueEntry | null;
			if (entry === null)
				return null;
			return this.remove(entry);
		}
		const entry = this.getFirstEntry(m, serv, simTime!, ent ?? null);
		if (entry === null)
			return null;
		return this.remove(entry);
	}

	private getFirstEntry(m: string | null, serv: LinkedService, simTime: number, ent: DisplayEntity | null): Queue_QueueEntry | null {
		const itr = this.storage.iterator(m);
		if (itr === null)
			return null;
		while (itr.hasNext()) {
			const entry = itr.next() as Queue_QueueEntry;
			if ((ent === null || entry.entity === ent) && serv.isAllowed(entry.entity, simTime))
				return entry;
		}
		return null;
	}

	/**
	 * Returns the match value that has the largest number of entities in the queue.
	 * @return match value with the most entities.
	 */
	getMatchForMax(): string | null {
		return this.storage.getTypeWithMaxCount();
	}

	/**
	 * Returns the number of entities in the longest match value queue.
	 * @return number of entities in the longest match value queue.
	 */
	getMaxCount(): number {
		return this.storage.getCountForMaxType();
	}

	/**
	 * Returns the set of entity types that are present in this Queue.
	 * （Java の Set<String> の代わりに、Java の HashMap と同じ順番の配列）
	 */
	getEntityTypes(): string[] {
		return this.storage.getTypes();
	}

	getEntityList(m: string | null = null): DisplayEntity[] {
		return this.storage.getEntityList(m);
	}

	/**
	 * Update the position of all entities in the queue. ASSUME that entities
	 * will line up according to the orientation of the queue.
	 */
	override updateGraphics(simTime: number): void {
		super.updateGraphics(simTime);

		const visible = this.isShowEntities(simTime);
		const orientQ = new Quaternion();
		orientQ.setEuler3(this.getOrientation());
		const qSize = this.getSize();
		const tmp = new Vec3d();
		const maxPerLineVal = jint(this.maxPerLine.getNextSample(this, simTime));
		const maxRowsVal = jint(this.maxRows.getNextSample(this, simTime));

		let distanceX = 0.5 * qSize.x;
		let maxWidth = 0;
		let maxHeight = 0;

		// Copy the storage entries to avoid some concurrent modification exceptions
		let entityList: DisplayEntity[];
		try {
			entityList = this.storage.getEntityList(null);
		}
		catch (e) {
			return;
		}

		// If the queue is not visible show the entities at the sub-model's process position
		if (!this.getShow() && this.getVisibleParent() instanceof CompoundEntity) {
			const ce = this.getVisibleParent() as CompoundEntity;
			for (const ent of entityList) {
				ent.moveToProcessPosition(ce, ce.getProcessPosition());
			}
			return;
		}

		// Find the maximum width and height of the entities
		if (entityList.length >  maxPerLineVal){
			for (const ent of entityList) {
				maxWidth = Math.max(maxWidth, ent.getGlobalSize().y);
				maxHeight = Math.max(maxHeight, ent.getGlobalSize().z);
			 }
		}

		// update item locations
		let i = 0;
		for (const ent of entityList) {

			// Calculate the row and level number for the entity
			const ind = i % maxPerLineVal;
			const row = Math.trunc(i / maxPerLineVal) % maxRowsVal;
			const level = Math.trunc(Math.trunc(i / maxPerLineVal) / maxRowsVal);

			// Reset the x-position for the first entity in a row
			if( i > 0 && ind === 0 ){
				distanceX = 0.5 * qSize.x;
			}

			i++;

			// Set the region
			ent.setRegion(this.getCurrentRegion());

			// Rotate each transporter about its center so it points to the right direction
			ent.setRelativeOrientation(orientQ);
			ent.setShow(visible);

			// Calculate the y- and z- coordinates
			const space = this.spacing.getNextSample(this, simTime);
			const distanceY = row * (space + maxWidth);
			const distanceZ = level * (space + maxHeight);

			// Calculate the x-coordinate
			const length = ent.getGlobalSize().x;
			distanceX += 0.5 * length;
			tmp.set3(-distanceX, distanceY, distanceZ);

			// increment total distance
			distanceX += 0.5 * length + space;

			// Set Position
			const pos = this.getGlobalPositionForPosition(tmp);
			ent.setGlobalPositionForAlignment(pos, new Vec3d());
		}
	}

	// *******************************************************************************************************
	// STATISTICS
	// *******************************************************************************************************

	override clearStatistics(): void {
		super.clearStatistics();
		const simTime = EventManager.simSeconds();
		this.stats.clear();
		this.stats.addValue(simTime, this.storage.size());
		this.freq.clear();
		this.freq.addValue(simTime, this.storage.size());
		this.numberReneged = 0;
	}

	override canLink(dir: boolean): boolean {
		return true;
	}

	override linkTo(nextEnt: DisplayEntity, dir: boolean): void {
		if (!(nextEnt instanceof LinkedService))
			return;

		const serv = nextEnt as LinkedService;
		serv.addQueue(this);
	}

	// LinkDisplayable
	override getDestinationEntities(): DisplayEntity[] {
		const ret = super.getDestinationEntities();
		const l = this.renegeDestination.getValue();
		if (l !== null && (l instanceof DisplayEntity)) {
			ret.push(l as DisplayEntity);
		}
		return ret;
	}

	// ******************************************************************************************************
	// OUTPUT METHODS
	// ******************************************************************************************************

	getQueueLength(simTime: number): number {
		return this.getCount();
	}

	getQueueList(simTime: number): DisplayEntity[] {
		return this.getEntityList();
	}

	getQueueTimes(simTime: number): number[] {
		return this.storage.getStorageTimeList(simTime);
	}

	getPriorityValues(simTime: number): number[] {
		return this.storage.getPriorityList();
	}

	getMatchValues(simTime: number): string[] {
		return this.storage.getTypeList();
	}

	getQueueLengthAverage(simTime: number): number {
		return this.stats.getMean(simTime);
	}

	getQueueLengthStandardDeviation(simTime: number): number {
		return this.stats.getStandardDeviation(simTime);
	}

	getQueueLengthMinimum(simTime: number): number {
		return jint(this.stats.getMin());
	}

	getQueueLengthMaximum(simTime: number): number {
		// An entity that is added to an empty queue and removed immediately
		// does not count as a non-zero queue length
		const ret = jint(this.stats.getMax());
		if (ret === 1 && this.freq.getBinTime(simTime, 1) === 0.0)
			return 0;
		return ret;
	}

	getQueueLengthDistribution(simTime: number): number[] {
		return this.freq.getBinTimes(simTime, 0, this.freq.getMax());
	}

	getQueueLengthFractions(simTime: number): number[] {
		return this.freq.getBinFractions(simTime, 0, this.freq.getMax());
	}

	getQueueLengthCumulativeFractions(simTime: number): number[] {
		return this.freq.getBinCumulativeFractions(simTime, 0, this.freq.getMax());
	}

	getAverageQueueTime(simTime: number): number {
		return this.stats.getSum(simTime) / this.getNumberAdded(simTime);
	}

	getMatchValueCount(simTime: number): number {
		return this.getEntityTypes().length;
	}

	getUniqueMatchValues(simTime: number): string[] {
		const ret: string[] = [...this.getEntityTypes()];
		ret.sort((a, b) => Input.uiSortOrder.compare(a, b));
		return ret;
	}

	getMatchValueCountMap(simTime: number): Map<string, number> {
		const ret = new Map<string, number>();
		for (const m of this.getUniqueMatchValues(simTime)) {
			ret.set(m, this.getCount(m));
		}
		return ret;
	}

	getMatchValueMap(simTime: number): Map<string, DisplayEntity[]> {
		const ret = new Map<string, DisplayEntity[]>();
		for (const m of this.getUniqueMatchValues(simTime)) {
			ret.set(m, this.getEntityList(m));
		}
		return ret;
	}

	getNumberReneged(simTime: number): number {
		return this.numberReneged;
	}

	getQueuePosition(simTime: number): number {
		const objEnt = this.getReceivedEntity(simTime);
		if (objEnt === null)
			return -1;
		let pos = this.getPositionOf(objEnt);
		if (pos >= 0)
			pos++;
		return pos;
	}

}

class Queue_QueueEntry extends EntStorage_StorageEntry {
	readonly renegeHandle: EventHandle | null;

	constructor(ent: DisplayEntity, m: string | null, pri: number, n: number, t: number, rh: EventHandle | null) {
		super(ent, m, pri, n, t);
		this.renegeHandle = rh;
	}
}

class Queue_DoQueueChanged extends ProcessTarget {
	private readonly queue: Queue;

	constructor(q: Queue) {
		super();
		this.queue = q;
	}

	override process(): void {
		for (const each of this.queue.getUserList())
			each.queueChanged();
	}

	override getDescription(): string {
		return this.queue.getName() + ".UpdateAllQueueUsers";
	}
}

class Queue_RenegeActionTarget extends EntityTarget<Queue> {
	private readonly entry: Queue_QueueEntry;

	constructor(q: Queue, e: Queue_QueueEntry) {
		super(q, "renegeAction");
		this.entry = e;
	}

	override process(): void {
		this.ent.renegeAction(this.entry);
	}
}

ClassRegistry.register("com.jaamsim.ProcessFlow.Queue", Queue);

defineOutput(Queue, {
	name: "QueueLength",
	description: "The present number of entities in the queue.",
	unitType: DimensionlessUnit,
	sequence: 0,
	returnType: "int",
	get: (e, simTime) => e.getQueueLength(simTime),
});

defineOutput(Queue, {
	name: "QueueList",
	description: "The entities in the queue.",
	sequence: 1,
	returnType: "ArrayList",
	get: (e, simTime) => e.getQueueList(simTime),
});

defineOutput(Queue, {
	name: "QueueTimes",
	description: "The waiting time for each entity in the queue.",
	unitType: TimeUnit,
	sequence: 2,
	returnType: "ArrayList",
	get: (e, simTime) => e.getQueueTimes(simTime),
});

defineOutput(Queue, {
	name: "PriorityValues",
	description: "The Priority expression value for each entity in the queue.",
	unitType: DimensionlessUnit,
	sequence: 3,
	returnType: "ArrayList<Integer>",
	get: (e, simTime) => e.getPriorityValues(simTime),
});

defineOutput(Queue, {
	name: "MatchValues",
	description: "The Match expression value for each entity in the queue.",
	unitType: DimensionlessUnit,
	sequence: 4,
	returnType: "ArrayList",
	get: (e, simTime) => e.getMatchValues(simTime),
});

defineOutput(Queue, {
	name: "QueueLengthAverage",
	description: "The average number of entities in the queue.",
	unitType: DimensionlessUnit,
	reportable: true,
	sequence: 5,
	returnType: "double",
	get: (e, simTime) => e.getQueueLengthAverage(simTime),
});

defineOutput(Queue, {
	name: "QueueLengthStandardDeviation",
	description: "The standard deviation of the number of entities in the queue.",
	unitType: DimensionlessUnit,
	reportable: true,
	sequence: 6,
	returnType: "double",
	get: (e, simTime) => e.getQueueLengthStandardDeviation(simTime),
});

defineOutput(Queue, {
	name: "QueueLengthMinimum",
	description: "The minimum number of entities in the queue.",
	unitType: DimensionlessUnit,
	reportable: true,
	sequence: 7,
	returnType: "int",
	get: (e, simTime) => e.getQueueLengthMinimum(simTime),
});

defineOutput(Queue, {
	name: "QueueLengthMaximum",
	description: "The maximum number of entities in the queue.",
	unitType: DimensionlessUnit,
	reportable: true,
	sequence: 8,
	returnType: "int",
	get: (e, simTime) => e.getQueueLengthMaximum(simTime),
});

defineOutput(Queue, {
	name: "QueueLengthTimes",
	description: "The total time that the queue has length 0, 1, 2, etc.",
	unitType: TimeUnit,
	reportable: true,
	sequence: 9,
	returnType: "double[]",
	get: (e, simTime) => e.getQueueLengthDistribution(simTime),
});

defineOutput(Queue, {
	name: "QueueLengthFractions",
	description: "Fraction of total time that the queue has length 0, 1, 2, etc.",
	reportable: true,
	sequence: 10,
	returnType: "double[]",
	get: (e, simTime) => e.getQueueLengthFractions(simTime),
});

defineOutput(Queue, {
	name: "QueueLengthCumulativeFractions",
	description: "Fraction of total time that the queue has length less than or equal to 0, 1, "
	             + "2, etc.",
	reportable: true,
	sequence: 11,
	returnType: "double[]",
	get: (e, simTime) => e.getQueueLengthCumulativeFractions(simTime),
});

defineOutput(Queue, {
	name: "AverageQueueTime",
	description: "Average time each entity waits in the queue. "
	             + "Calculated as total queue time to date divided by the total number of "
	             + "entities added to the queue.",
	unitType: TimeUnit,
	reportable: true,
	sequence: 12,
	returnType: "double",
	get: (e, simTime) => e.getAverageQueueTime(simTime),
});

defineOutput(Queue, {
	name: "MatchValueCount",
	description: "The present number of unique match values in the queue.",
	unitType: DimensionlessUnit,
	sequence: 13,
	returnType: "int",
	get: (e, simTime) => e.getMatchValueCount(simTime),
});

defineOutput(Queue, {
	name: "UniqueMatchValues",
	description: "The list of unique Match values for the entities in the queue.",
	sequence: 14,
	returnType: "ArrayList",
	get: (e, simTime) => e.getUniqueMatchValues(simTime),
});

defineOutput(Queue, {
	name: "MatchValueCountMap",
	description: "The number of entities in the queue for each Match expression value.\n"
	             + "For example, '[Queue1].MatchValueCountMap(\"SKU1\")' returns the number of "
	             + "entities whose Match value is \"SKU1\".",
	unitType: DimensionlessUnit,
	sequence: 15,
	returnType: "LinkedHashMap<String,Integer>",
	get: (e, simTime) => e.getMatchValueCountMap(simTime),
});

defineOutput(Queue, {
	name: "MatchValueMap",
	description: "Provides a list of entities in the queue for each Match expression value.\n"
	             + "For example, '[Queue1].MatchValueMap(\"SKU1\")' returns a list of entities "
	             + "whose Match value is \"SKU1\".",
	sequence: 16,
	returnType: "LinkedHashMap",
	get: (e, simTime) => e.getMatchValueMap(simTime),
});

defineOutput(Queue, {
	name: "NumberReneged",
	description: "The number of entities that reneged from the queue.",
	unitType: DimensionlessUnit,
	reportable: true,
	sequence: 17,
	returnType: "long",
	get: (e, simTime) => e.getNumberReneged(simTime),
});

defineOutput(Queue, {
	name: "QueuePosition",
	description: "The position in the queue for an entity undergoing the RenegeCondition test.\n"
	             + "First in queue = 1, second in queue = 2, etc.",
	unitType: DimensionlessUnit,
	reportable: false,
	sequence: 18,
	returnType: "long",
	get: (e, simTime) => e.getQueuePosition(simTime),
});
