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

import { tr } from "../i18n/I18n.ts";
import { Double } from "../java/lang.ts";
import type { DisplayEntity } from "../Graphics/DisplayEntity.ts";
import { SampleInput } from "../Samples/SampleInput.ts";
import { StringProvInput } from "../StringProviders/StringProvInput.ts";
import { Entity } from "../basicsim/Entity.ts";
import { EventManager } from "../events/EventManager.ts";
import { defineOutput } from "../input/OutputRegistry.ts";
import { DimensionlessUnit } from "../units/DimensionlessUnit.ts";
import { TimeUnit } from "../units/TimeUnit.ts";
import { EntContainer } from "./EntContainer.ts";
import { LinkedService } from "./LinkedService.ts";

export abstract class AbstractUnpack extends LinkedService {

	private readonly matchForEntities: StringProvInput;

	private readonly serviceTime: SampleInput;

	protected readonly containerStateAssignment: StringProvInput;

	private entityMatch: string | null = null;   // Match value for the entities to be removed from the container
	private numberToRemove = 0;   // Number of entities to remove from the present EntityContainer
	private container: EntContainer | null = null;	// the received EntityContainer
	private numberRemoved = 0;   // Number of entities removed from the received EntityContainer
	private unpackedEntity: DisplayEntity | null = null;  // the entity being unpacked

	constructor() {
		super();
		this.matchForEntities = new StringProvInput("MatchForEntities", Entity.KEY_INPUTS, "");
		this.setKeywordDoc(this.matchForEntities, "An expression returning a string value that determines which of the "
		                     + "entities in the container are eligible to be removed. "
		                     + "If used, the only entities eligible for selection are the ones whose "
		                     + "inputs for the container's Match keyword are equal to value returned by "
		                     + "the expression entered for this Match keyword. "
		                     + "Expressions that return a dimensionless integer or an object are also "
		                     + "valid. The returned number or object is converted to a string "
		                     + "automatically. A floating point number is truncated to an integer.",
		         ["this.obj.Attrib1"]);
		this.matchForEntities.setUnitType(DimensionlessUnit);
		this.addInput(this.matchForEntities);

		this.serviceTime = new SampleInput("ServiceTime", Entity.KEY_INPUTS, 0.0);
		this.setKeywordDoc(this.serviceTime, "The service time required to unpack each entity.",
		         ["3.0 h", "NormalDistribution1", "'1[s] + 0.5*[TimeSeries1].PresentValue'"]);
		this.serviceTime.setUnitType(TimeUnit);
		this.serviceTime.setValidRange(0, Double.POSITIVE_INFINITY);
		this.addInput(this.serviceTime);

		this.containerStateAssignment = new StringProvInput("ContainerStateAssignment", Entity.OPTIONS, "");
		this.setKeywordDoc(this.containerStateAssignment, "The state to be assigned to container on arrival at this object.\n"
		                     + "No state is assigned if the entry is blank.",
		         ["Service"]);
		this.containerStateAssignment.setUnitType(DimensionlessUnit);
		this.addInput(this.containerStateAssignment);
	}

	override earlyInit(): void {
		super.earlyInit();
		this.entityMatch = "";
		this.numberToRemove = 0;
		this.container = null;
		this.numberRemoved = 0;
		this.unpackedEntity = null;
	}

	private setContainerState(): void {
		if (!this.containerStateAssignment.isDefault()) {
			const simTime = EventManager.simSeconds();
			const state = this.containerStateAssignment.getNextString(this, simTime);
			this.container!.setPresentState(state);
		}
	}

	protected override startProcessing(simTime: number): boolean {

		// If a container has not been started yet, remove one from the queue
		if (this.container === null) {

			// Set the match value for the container
			const m = this.getNextMatchValue(EventManager.simSeconds());
			this.setMatchValue(m);

			// Remove the container from the queue
			const ent = this.removeNextEntity(m);
			if (ent === null)
				return false;
			if (!(ent instanceof EntContainer))
				this.error(tr("Entity '%s' is not an EntityContainer or equivalent"), ent);
			this.container = ent as unknown as EntContainer;

			this.setContainerState();

			// Set the match value for the entities to remove
			this.entityMatch = null;
			if (!this.matchForEntities.isDefault())
				this.entityMatch = this.matchForEntities.getNextString(this, simTime, 1.0, true);

			// Set the number of entities to remove
			this.numberToRemove = this.getNumberToRemove();
			this.numberRemoved = 0;
		}

		// Remove the next entity to unpack and set its state
		if (this.numberRemoved < this.numberToRemove && !this.container.isEmpty(this.entityMatch)) {
			this.unpackedEntity = this.container.removeEntity(this.entityMatch);
			this.receiveEntity(this.unpackedEntity!);
			this.setEntityState(this.unpackedEntity!);
			this.assignAttributesAtStart(simTime);
		}

		return true;
	}

	protected abstract disposeContainer(c: EntContainer): void;

	protected abstract getNumberToRemove(): number;

	protected override processStep(simTime: number): void {

		// Send the unpacked entity to the next component
		if (this.unpackedEntity !== null) {
			this.sendToNextComponent(this.unpackedEntity);
			this.unpackedEntity = null;
			this.numberRemoved++;
		}

		// Stop when the desired number of entities have been removed
		if (this.numberRemoved >= this.numberToRemove || this.container!.isEmpty(this.entityMatch)) {
			this.disposeContainer(this.container!);
			this.container = null;
			this.numberRemoved = 0;
		}
	}

	override isFinished(): boolean {
		return this.container === null;
	}

	override thresholdChanged(): void {

		// If an immediate release closure, stop packing and release the container
		if (this.isImmediateReleaseThresholdClosure())
			this.numberToRemove = 0;

		super.thresholdChanged();
	}

	override updateGraphics(simTime: number): void {
		super.updateGraphics(simTime);

		if (this.container !== null)
			this.moveToProcessPosition(this.container as unknown as DisplayEntity);
		if (this.unpackedEntity !== null)
			this.moveToProcessPosition(this.unpackedEntity);
	}

	protected override getStepDuration(simTime: number): number {
		let dur = 0.0;
		if (this.unpackedEntity !== null)
			dur = this.serviceTime.getNextSample(this, simTime);
		return dur;
	}

	getContainer(simTime: number): DisplayEntity | null {
		return this.container as unknown as DisplayEntity | null;
	}

}

defineOutput(AbstractUnpack, {
	name: "Container",
	description: "The EntityContainer that is being unpacked.",
	returnType: "Entity",
	get: (e, simTime) => e.getContainer(simTime),
});
