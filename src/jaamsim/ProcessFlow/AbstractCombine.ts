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

// 出力の getMatchValue(double) を null にする上書き（Java の「Delete 'MatchValue' output」）は、
// LinkedService で getMatchValue() と 1 つにしてあるので、引数があるときだけ null を返す。

import { tr } from "../internal.ts";
import { Double, Integer } from "../internal.ts";
import { BooleanProvInput } from "../internal.ts";
import { KeywordCommand } from "../internal.ts";
import { EntityProvListInput } from "../internal.ts";
import type { DisplayEntity } from "../Graphics/DisplayEntity.ts";
import { SampleInput } from "../internal.ts";
import { SampleListInput } from "../internal.ts";
import { Entity } from "../internal.ts";
import { KeywordIndex } from "../internal.ts";
import { defineOutput, hideOutput } from "../internal.ts";
import { DimensionlessUnit } from "../internal.ts";
import { TimeUnit } from "../internal.ts";
import { LinkedService } from "../internal.ts";
import { Queue } from "../internal.ts";

export abstract class AbstractCombine extends LinkedService {

	private readonly serviceTime: SampleInput;

	private readonly waitQueueList: EntityProvListInput<Queue>;

	private readonly numberRequired: SampleListInput;

	private readonly matchRequired: BooleanProvInput;

	private readonly firstQueue: BooleanProvInput;

	private readonly consumedEntityList: DisplayEntity[] = [];

	constructor() {
		super();
		this.waitQueue.setHidden(true);
		this.match.setHidden(true);
		this.watchList.setHidden(true);
		this.selectionCondition.setHidden(true);
		this.nextEntity.setHidden(true);
		this.assignmentsAtStart.setHidden(true);

		this.serviceTime = new SampleInput("ServiceTime", Entity.KEY_INPUTS, 0.0);
		this.setKeywordDoc(this.serviceTime, "The time required to process each set of entities.",
		         ["3.0 h", "ExponentialDistribution1", "'1[s] + 0.5*[TimeSeries1].PresentValue'"]);
		this.serviceTime.setUnitType(TimeUnit);
		this.serviceTime.setValidRange(0, Double.POSITIVE_INFINITY);
		this.addInput(this.serviceTime);

		this.waitQueueList = new EntityProvListInput<Queue>(Queue, "WaitQueueList", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.waitQueueList, "The Queue objects in which to place the arriving entities.", []);
		this.waitQueueList.setRequired(true);
		this.addInput(this.waitQueueList);

		this.numberRequired = SampleListInput.ofInt("NumberRequired", Entity.KEY_INPUTS, 1);
		this.setKeywordDoc(this.numberRequired, "The number of entities required from each queue for processing to "
		                     + "begin. "
		                     + "The last value in the list is used if the number of queues is greater "
		                     + "than the number of values. "
		                     + "Only an integer number of entities can be assembled. "
		                     + "A decimal value will be truncated to an integer.",
		         ["2 1", "{ 2 } { 1 }", "{ DiscreteDistribution1 } { 'this.obj.attrib1 + 1' }"]);
		this.numberRequired.setDimensionless(true);
		this.numberRequired.setUnitType(DimensionlessUnit);
		this.numberRequired.setIntegerValue(true);
		this.addInput(this.numberRequired);

		this.matchRequired = new BooleanProvInput("MatchRequired", Entity.KEY_INPUTS, false);
		this.setKeywordDoc(this.matchRequired, "If TRUE, the all entities to be processed must have the same Match "
		                     + "value. "
		                     + "The match value for an entity is determined by the Match keyword for "
		                     + "its queue. "
		                     + "The value is calculated when the entity first arrives at its queue.", []);
		this.addInput(this.matchRequired);

		this.firstQueue = new BooleanProvInput("FirstQueue", Entity.KEY_INPUTS, false);
		this.setKeywordDoc(this.firstQueue, "Determines which match value to use when several values have the "
		                     + "required number of entities. "
		                     + "If FALSE, the entity with the earliest arrival time in any of the "
		                     + "queues determines the match value. "
		                     + "If TRUE, the entity with the earliest arrival time in the first "
		                     + "queue determines the match value.", []);
		this.addInput(this.firstQueue);

	}

	override earlyInit(): void {
		super.earlyInit();
		this.consumedEntityList.length = 0;
	}

	override addEntity( ent: DisplayEntity ): void {
		this.error(tr("An entity cannot be sent directly to an Assemble object. It must be sent to the appropriate queue."));
	}

	override addQueue(que: Queue): void {
		const toks: string[] = [];
		this.waitQueueList.getValueTokens(toks);
		toks.push(que.getName());
		const kw = new KeywordIndex(this.waitQueueList.getKeyword(), toks, null);
		this.getJaamSimModel().storeAndExecute(new KeywordCommand(this, kw));
	}

	override getQueues(): Queue[] {
		return this.waitQueueList.getNextEntityList(this, 0.0);
	}

	getNumberRequired(simTime: number): number[] {
		return this.numberRequired.getNextIntegers(this, simTime, this.waitQueueList.getListSize());
	}

	isMatchRequired(simTime: number): boolean {
		return this.matchRequired.getNextBoolean(this, simTime);
	}

	isFirstQueue(simTime: number): boolean {
		return this.firstQueue.getNextBoolean(this, simTime);
	}

	protected override getStepDuration(simTime: number): number {
		return this.serviceTime.getNextSample(this, simTime);
	}

	/**
	 * Returns a match value that has sufficient numbers of entities in each
	 * queue. The first match value that satisfies the criterion is selected.
	 * @param queueList - list of queues to check.
	 * @param numberList - number of matches required for each queue.
	 * @return match value.
	 */
	static selectMatchValue(queueList: Queue[], numberList: number[], bool: boolean): string | null {

		// Check whether each queue has sufficient entities for any match value
		for (let i=0; i<queueList.length; i++) {
			if (queueList[i].getMaxCount() < numberList[i])
				return null;
		}

		// Find the queue with the fewest match values
		let shortest: Queue | null = null;
		let count = Integer.MAX_VALUE;
		for (const que of queueList) {
			if (que.getEntityTypes().length < count) {
				count = que.getEntityTypes().length;
				shortest = que;
			}
		}

		// Find the match values that have sufficient entities in each queue
		// （getEntityTypes() は Java の HashMap と同じ順番）
		const matchList: string[] = [];
		for (const m of shortest!.getEntityTypes()) {
			if (AbstractCombine.sufficientEntities(queueList, numberList, m))
				matchList.push(m);
		}

		// Select the match value with the earliest entity arrival
		let ret: string | null = null;
		let earliestTime = Double.POSITIVE_INFINITY;
		for (const m of matchList) {
			for (const que of queueList) {
				const timeAdded = que.getTimeAdded(m);
				if (timeAdded < earliestTime) {
					ret = m;
					earliestTime = timeAdded;
				}
				if (bool)
					break;
			}
		}
		return ret;
	}

	/**
	 * Returns true if each of the queues contains sufficient entities with
	 * the specified match value for processing to begin.
	 * If the match value m is null, then all the entities in each queue are counted.
	 * @param queueList - list of queues to check.
	 * @param numberList - number of matches required for each queue.
	 * @param m - match value.
	 * @return true if there are sufficient entities in each queue.
	 */
	static sufficientEntities(queueList: Queue[], numberList: number[], m: string | null): boolean {
		for (let i = 0; i < queueList.length; i++) {
			if (queueList[i].getCount(m) < numberList[i])
				return false;
		}
		return true;
	}

	clearConsumedEntityList(): void {
		for (const ent of this.consumedEntityList) {
			ent.setShow(true);
			ent.dispose();
		}
		this.consumedEntityList.length = 0;
	}

	addConsumedEntity(ent: DisplayEntity): void {
		ent.setShow(false);
		this.consumedEntityList.push(ent);
	}

	override getSourceEntities(): DisplayEntity[] {
		const ret = super.getSourceEntities();
		for (const queue of this.getQueues()) {
			if (queue === null)
				continue;
			ret.push(queue);
		}
		return ret;
	}

	/**
	 * 引数なし（Java の getMatchValue()）は LinkedService のまま。
	 * 引数あり（出力の getMatchValue(double)）は null（Delete 'MatchValue' output）。
	 */
	// TODO(移植): Java は @Output なしの上書きで出力 MatchValue を消す。TS の出力の表には消す仕組みが無く、null を返す出力として残る
	override getMatchValue(simTime?: number): string | null {
		if (simTime === undefined)
			return super.getMatchValue();
		return null;
	}

	getConsumedEntityList(simTime: number): DisplayEntity[] {
		return this.consumedEntityList;
	}

}

defineOutput(AbstractCombine, {
	name: "ConsumedEntityList",
	description: "The entities that were removed from the queues for processing and were then "
	             + "destroyed.",
	sequence: 0,
	returnType: "ArrayList",
	get: (e, simTime) => e.getConsumedEntityList(simTime),
});

// Java は @Output の付かない関数で上書きして、次の出力を消している
hideOutput(AbstractCombine, "MatchValue");
