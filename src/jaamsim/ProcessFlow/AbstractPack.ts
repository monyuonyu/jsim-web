/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2014 Ausenco Engineering Canada Inc.
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

import { Double } from "../internal.ts";
import { BooleanProvInput } from "../internal.ts";
import type { DisplayEntity } from "../Graphics/DisplayEntity.ts";
import { SampleInput } from "../internal.ts";
import { StringProvInput } from "../internal.ts";
import { Entity } from "../internal.ts";
import { EventManager } from "../internal.ts";
import { defineOutput } from "../internal.ts";
import { DimensionlessUnit } from "../internal.ts";
import { TimeUnit } from "../internal.ts";
import type { EntContainer } from "./EntContainer.ts";
import { LinkedService } from "../internal.ts";

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

export abstract class AbstractPack extends LinkedService {

	protected readonly numberOfEntities: SampleInput;

	private readonly serviceTime: SampleInput;

	protected readonly containerStateAssignment: StringProvInput;

	private readonly numberToStart: SampleInput;

	private readonly waitForEntities: BooleanProvInput;

	private readonly recalculate: BooleanProvInput;

	protected container: EntContainer | null = null;	// the generated EntityContainer
	private numberInserted = 0;   // Number of entities inserted to the EntityContainer
	private numberToInsert = 0;   // Number of entities to insert in the present EntityContainer
	private numberToStartPacking = 0;  // Number of entities required before packing can begin
	private startedPacking = false;  // True if the packing process has already started
	private packedEntity: DisplayEntity | null = null;  // the entity being packed

	constructor() {
		super();
		this.numberOfEntities = SampleInput.ofInt("NumberOfEntities", Entity.KEY_INPUTS, 1);
		this.setKeywordDoc(this.numberOfEntities, "The number of entities to pack into the container.",
		         ["2", "DiscreteDistribution1", "'1 + [TimeSeries1].PresentValue'"]);
		this.numberOfEntities.setUnitType(DimensionlessUnit);
		this.numberOfEntities.setIntegerValue(true);
		this.numberOfEntities.setValidRange(1, Double.POSITIVE_INFINITY);
		this.addInput(this.numberOfEntities);

		this.serviceTime = new SampleInput("ServiceTime", Entity.KEY_INPUTS, 0.0);
		this.setKeywordDoc(this.serviceTime, "The service time required to pack each entity in the container.",
		         ["3.0 h", "ExponentialDistribution1", "'1[s] + 0.5*[TimeSeries1].PresentValue'"]);
		this.serviceTime.setUnitType(TimeUnit);
		this.serviceTime.setValidRange(0, Double.POSITIVE_INFINITY);
		this.addInput(this.serviceTime);

		this.containerStateAssignment = new StringProvInput("ContainerStateAssignment", Entity.OPTIONS, "");
		this.setKeywordDoc(this.containerStateAssignment, "The state to be assigned to container on arrival at this object.\n"
		                     + "No state is assigned if the entry is blank.",
		         ["Service"]);
		this.containerStateAssignment.setUnitType(DimensionlessUnit);
		this.addInput(this.containerStateAssignment);

		this.numberToStart = new SampleInput("NumberToStart", Entity.OPTIONS, Double.NaN);
		this.setKeywordDoc(this.numberToStart, "The minimum number of entities required to start packing.",
		         ["2", "DiscreteDistribution1", "'1 + [TimeSeries1].PresentValue'"]);
		this.numberToStart.setUnitType(DimensionlessUnit);
		this.numberToStart.setIntegerValue(true);
		this.numberToStart.setDefaultText("NumberOfEntities Input");
		this.numberToStart.setValidRange(0, Double.POSITIVE_INFINITY);
		this.addInput(this.numberToStart);

		this.waitForEntities = new BooleanProvInput("WaitForEntities", Entity.OPTIONS, false);
		this.setKeywordDoc(this.waitForEntities, "If TRUE, the EntityContainer will be held in its queue until "
		                     + "sufficient entities are available to start packing.", []);
		this.addInput(this.waitForEntities);

		this.recalculate = new BooleanProvInput("Recalculate", Entity.OPTIONS, false);
		this.setKeywordDoc(this.recalculate, "If TRUE, the 'NumberOfEntities' and 'NumberToStart' inputs "
		                     + "are recalculated each time the condition to start packing is tested. "
		                     + "Otherwise, these inputs are assigned fixed values for an "
		                     + "EntityContainer when they are first evaluated.", []);
		this.addInput(this.recalculate);
	}

	override earlyInit(): void {
		super.earlyInit();
		this.container = null;
		this.numberInserted = 0;
		this.numberToInsert = -1;
		this.numberToStartPacking = -1;
		this.startedPacking = false;
		this.packedEntity = null;
	}

	protected abstract isContainerAvailable(): boolean;

	protected abstract getNextContainer(): EntContainer;

	private setContainerState(): void {
		if (!this.containerStateAssignment.isDefault()) {
			const simTime = EventManager.simSeconds();
			const state = this.containerStateAssignment.getNextString(this, simTime);
			this.container!.setPresentState(state);
		}
	}

	protected override startProcessing(simTime: number): boolean {

		// A container must be available before packing can start
		if (this.container === null) {
			if (!this.isContainerAvailable())
				return false;

			// If necessary, get a new container
			if (!this.waitForEntities.getNextBoolean(this, simTime)) {
				this.container = this.getNextContainer();
				this.setContainerState();
			}
		}

		// Are there sufficient entities in the queue to start packing?
		if (!this.startedPacking) {
			const m = this.getNextMatchValue(simTime);
			this.setMatchValue(m);
			if (this.numberToStartPacking < 0 || this.recalculate.getNextBoolean(this, simTime)) {
				this.numberToInsert = this.getNumberToInsert(simTime);
				this.numberToStartPacking = this.getNumberToStart(simTime);
			}
			if (this.getQueue(simTime)!.getCount(m) < this.numberToStartPacking) {
				return false;
			}

			// If necessary, get a new container
			if (this.container === null) {
				this.container = this.getNextContainer();
				this.setContainerState();
			}

			// Start packing
			this.numberInserted = 0;
			this.startedPacking = true;
		}

		// Select the next entity to pack and set its state
		if (this.numberInserted < this.numberToInsert) {
			this.packedEntity = this.removeNextEntity(this.getMatchValue());
			if (this.packedEntity === null)
				return false;

			this.receiveEntity(this.packedEntity);
			this.setEntityState(this.packedEntity);
			this.assignAttributesAtStart(simTime);
		}
		return true;
	}

	protected override processStep(simTime: number): void {

		// Remove the next entity from the queue and pack the container
		if (this.packedEntity !== null) {
			this.container!.addEntity(this.packedEntity);
			this.releaseEntity(simTime);
			this.packedEntity = null;
			this.numberInserted++;
		}

		// If the container is full, send it to the next component
		if (this.numberInserted >= this.numberToInsert) {
			this.getNextComponent()!.addEntity(this.container as unknown as DisplayEntity);
			this.container = null;
			this.numberInserted = 0;
			this.numberToInsert = -1;
			this.numberToStartPacking = -1;
			this.startedPacking = false;
		}
	}

	protected getNumberToInsert(simTime: number): number {
		return jint(this.numberOfEntities.getNextSample(this, simTime));
	}

	private getNumberToStart(simTime: number): number {
		let ret = this.numberToInsert;
		if (!this.numberToStart.isDefault() && this.numberToInsert > 0) {
			ret = jint(this.numberToStart.getNextSample(this, simTime));
			ret = Math.max(ret, 1);
		}
		return ret;
	}

	protected override getStepDuration(simTime: number): number {
		return this.serviceTime.getNextSample(this, simTime);
	}

	override isFinished(): boolean {
		return this.container === null;
	}

	override thresholdChanged(): void {

		// If an immediate release closure, stop packing and release the container
		if (this.isImmediateReleaseThresholdClosure()) {
			this.numberToInsert = 0;
			if (!this.isBusy() && !this.isFinished()) {
				this.processStep(EventManager.simSeconds());
				return;
			}
		}

		super.thresholdChanged();
	}

	override updateGraphics(simTime: number): void {
		super.updateGraphics(simTime);

		if (this.container !== null)
			this.moveToProcessPosition(this.container as unknown as DisplayEntity);
		if (this.packedEntity !== null)
			this.moveToProcessPosition(this.packedEntity);
	}

	getContainer(simTime: number): DisplayEntity | null {
		return this.container as unknown as DisplayEntity | null;
	}

}

defineOutput(AbstractPack, {
	name: "Container",
	description: "The EntityContainer that is being filled.",
	returnType: "Entity",
	get: (e, simTime) => e.getContainer(simTime),
});
