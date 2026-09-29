/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2013 Ausenco Engineering Canada Inc.
 * Copyright (C) 2017-2025 JaamSim Software Inc.
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

// ResourceUser は、関数がそろっているかで判定する（resourceObjects/ResourceUser.ts。register は無い）。
// Java の「出力を消す」上書き（getServiceDuration などを @Output なしで上書きして出力を消す）は、
// TS の出力の表では消せない。TODO(移植) を参照。

import { tr } from "../internal.ts";
import type { DisplayEntity } from "../Graphics/DisplayEntity.ts";
import { SampleListInput } from "../internal.ts";
import { Entity } from "../internal.ts";
import { EventManager } from "../internal.ts";
import { InterfaceEntityListInput } from "../internal.ts";
import { defineOutput, hideOutput } from "../internal.ts";
import { Double } from "../internal.ts";
import { ResourceProvider } from "../internal.ts";
import type { ResourceUser } from "../resourceObjects/ResourceUser.ts";
import { ResourceUserDelegate } from "../internal.ts";
import { DimensionlessUnit } from "../internal.ts";
import { LinkedService } from "../internal.ts";

export abstract class AbstractLinkedResourceUser extends LinkedService implements ResourceUser {

	protected readonly resourceList: InterfaceEntityListInput<ResourceProvider>;

	private readonly numberOfUnitsList: SampleListInput;

	private resUserDelegate: ResourceUserDelegate | null = null;
	private seizedUnits: number[] = new Array<number>(1).fill(0);  // resource units seized by the last entity

	constructor() {
		super();
		const resDef: ResourceProvider[] = [];
		this.resourceList = new InterfaceEntityListInput<ResourceProvider>(ResourceProvider, "ResourceList", Entity.KEY_INPUTS, resDef);
		this.setKeywordDoc(this.resourceList, "The Resources from which units are to be seized. "
		                     + "All the resource units must be available to be seized before any one "
		                     + "unit is seized.\n\n"
		                     + "When more than one object attempts to seize the same resource, the "
		                     + "resource is assigned based on the priorities and arrival times of "
		                     + "entities waiting in the objects' Queues. "
		                     + "An entity's priority is determined by the 'Priority' input for its "
		                     + "Queue, and is assigned to the entity when it first arrives to the "
		                     + "Queue. "
		                     + "This priority determines both the position of the entity in the queue "
		                     + "and its priority for seizing a resource. "
		                     + "If several entities have the same priority, the resource is assigned "
		                     + "to entity that arrived first to its Queue.",
		         ["Resource1 Resource2"]);
		this.addInput(this.resourceList);
		this.addSynonym(this.resourceList, "Resource");

		this.numberOfUnitsList = SampleListInput.ofInt("NumberOfUnits", Entity.KEY_INPUTS, 1);
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
	}

	override earlyInit(): void {
		super.earlyInit();
		this.resUserDelegate = new ResourceUserDelegate(this.resourceList.getValue()!);
		this.seizedUnits = new Array<number>(this.resUserDelegate.getListSize()).fill(0);
	}

	hasWaitingEntity(): boolean {
		const simTime = EventManager.simSeconds();
		return !this.getQueue(simTime)!.isEmpty();
	}

	getPriority(): number {
		const simTime = EventManager.simSeconds();
		return this.getQueue(simTime)!.getFirstPriority();
	}

	getWaitTime(): number {
		const simTime = EventManager.simSeconds();
		return this.getQueue(simTime)!.getQueueTime();
	}

	startNextEntity(): void {
		if (this.isTraceFlag()) this.trace(2, "startNextEntity");

		// Remove the first entity from the queue
		const simTime = EventManager.simSeconds();
		const m = this.getNextMatchValue(simTime);
		this.setMatchValue(m);
		const ent = this.removeNextEntity(m);
		if (ent === null)
			this.error(tr("Entity not found for specified Match value: %s"), m);
		this.receiveEntity(ent);
		this.setEntityState(ent);

		// Seize the resources
		this.seizedUnits = this.numberOfUnitsList.getNextIntegers(this, simTime, this.resUserDelegate!.getListSize());
		this.seizeResources(this.seizedUnits, ent);

		// Assign attributes
		this.assignAttributesAtStart(simTime);
	}

	hasStrictResource(): boolean {
		return this.resUserDelegate!.hasStrictResource();
	}

	isReadyToStart(): boolean {
		if (!this.isAbleToRestart()) {
			return false;
		}
		const simTime = EventManager.simSeconds();
		const m = this.getNextMatchValue(simTime);
		const ent = this.getNextEntity(m);
		return ent !== null && this.checkResources(ent);
	}

	/**
	 * Determine whether the required Resources are available.
	 * @return = TRUE if all the resources are available
	 */
	checkResources(ent: DisplayEntity): boolean {
		const simTime = EventManager.simSeconds();

		// Temporarily set the obj entity to the first one in the queue
		const oldEnt = this.getReceivedEntity(simTime);
		this.setReceivedEntity(ent);

		const nums = this.numberOfUnitsList.getNextIntegers(this, simTime, this.resUserDelegate!.getListSize());
		const ret = this.resUserDelegate!.canSeizeResources(simTime, nums, ent);

		// Reset the obj entity
		this.setReceivedEntity(oldEnt);
		return ret;
	}

	/**
	 * Seize the required Resources.
	 */
	seizeResources(nums: number[], ent: DisplayEntity): void {
		this.resUserDelegate!.seizeResources(nums, ent);
	}

	releaseResources(nums: number[], ent: DisplayEntity): void {
		this.resUserDelegate!.releaseResources(nums, ent);
	}

	getResourceList(): ResourceProvider[] {
		return this.resUserDelegate!.getResourceList();
	}

	requiresResource(res: ResourceProvider): boolean {
		return this.resUserDelegate!.requiresResource(res);
	}

	// Delete 'ServiceDuration' output
	// TODO(移植): Java では @Output なしの上書きで出力 ServiceDuration が消える。TS の出力の表には消す仕組みが無く、0 を返す出力として残る
	override getServiceDuration(simTime: number): number {
		return 0.0;
	}

	// Delete 'ServicePerformed' output
	override getServicePerformed(simTime: number): number {
		return 0.0;
	}

	// Delete 'FractionCompleted' output
	override getFractionCompleted(simTime: number): number {
		return 0.0;
	}

	getSeizedUnits(simTime: number): number[] {
		return this.seizedUnits.slice(0, this.seizedUnits.length);
	}

}

defineOutput(AbstractLinkedResourceUser, {
	name: "SeizedUnits",
	description: "The number of resource units seized by the last entity.",
	unitType: DimensionlessUnit,
	sequence: 1,
	returnType: "int[]",
	get: (e, simTime) => e.getSeizedUnits(simTime),
});

// Java は @Output の付かない関数で上書きして、次の出力を消している
hideOutput(AbstractLinkedResourceUser, "ServiceDuration");
hideOutput(AbstractLinkedResourceUser, "ServicePerformed");
hideOutput(AbstractLinkedResourceUser, "FractionCompleted");
