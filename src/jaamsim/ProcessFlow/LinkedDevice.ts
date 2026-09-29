/*
 * JaamSim Discrete Event Simulation
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

import { tr } from "../internal.ts";
import { KeywordCommand } from "../internal.ts";
import { DisplayEntity } from "../internal.ts";
import { StringProvInput } from "../internal.ts";
import { Entity } from "../internal.ts";
import { EventManager } from "../internal.ts";
import { EntityInput } from "../internal.ts";
import type { Input } from "../input/Input.ts";
import type { InputCallback } from "../input/InputCallback.ts";
import { InputErrorException } from "../internal.ts";
import { InterfaceEntityInput } from "../internal.ts";
import { KeywordIndex } from "../internal.ts";
import { defineOutput } from "../internal.ts";
import { StateEntity } from "../internal.ts";
import { DimensionlessUnit } from "../internal.ts";
import { RateUnit } from "../internal.ts";
import { TimeUnit } from "../internal.ts";
import { Device } from "../internal.ts";
import { EntityGen } from "../internal.ts";
import { Linkable } from "../internal.ts";
import { ProcessorData } from "../internal.ts";

export abstract class LinkedDevice extends Device implements Linkable {

	protected readonly defaultEntity: EntityInput<DisplayEntity>;

	protected readonly nextComponent: InterfaceEntityInput<Linkable>;

	protected readonly stateAssignment: StringProvInput;

	private processor = new ProcessorData();

	constructor() {
		super();
		this.attributeDefinitionList.setHidden(false);
		this.workingStateListInput.setHidden(true);

		this.defaultEntity = new EntityInput<DisplayEntity>(DisplayEntity, "DefaultEntity", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.defaultEntity, "The default value for the output obj.\n"
		                     + "Normally, obj is set to the last entity received by this object. "
		                     + "Prior to receiving its first entity, obj is set to the object "
		                     + "provided by DefaultEntity. If an input for DefaultEntity is not "
		                     + "provided, then obj is set to null until the first entity is received.", []);
		this.defaultEntity.setCallback(LinkedDevice.inputCallback);
		this.addInput(this.defaultEntity);
		this.addSynonym(this.defaultEntity, "TestEntity");
		this.defaultEntity.setHidden(true);

		this.nextComponent = new InterfaceEntityInput<Linkable>(Linkable, "NextComponent", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.nextComponent, "The next object to which the processed entity is passed.",
		         ["Queue1"]);
		this.nextComponent.setRequired(true);
		this.addInput(this.nextComponent);

		this.stateAssignment = new StringProvInput("StateAssignment", Entity.OPTIONS, "");
		this.setKeywordDoc(this.stateAssignment, "The state to be assigned to each entity on arrival at this object.\n"
                         + "No state is assigned if the entry is blank.",
		         ["Service"]);
		this.stateAssignment.setUnitType(DimensionlessUnit);
		this.addInput(this.stateAssignment);
	}

	static readonly inputCallback: InputCallback = {
		callback(ent: Entity, inp: Input<unknown>): void {
			(ent as LinkedDevice).updateInputValue();
		},
	} as InputCallback;

	updateInputValue(): void {
		this.processor.setReceivedEntity(this.defaultEntity.getValue());
	}

	override validate(): void {
		super.validate();

		// If a state is to be assigned, ensure that the prototype is a StateEntity
		if (this.defaultEntity.getValue() !== null && !this.stateAssignment.isDefault()) {
			if (!(this.defaultEntity.getValue() instanceof StateEntity)) {
				throw new InputErrorException(tr("Only a SimEntity can be specified for the TestEntity keyword if a state is be be assigned."));
			}
		}
	}

	override earlyInit(): void {
		super.earlyInit();
		this.processor.clear();
	}

	override isValidState(state: string): boolean {
		return true;
	}

	addEntity(ent: DisplayEntity): void {
		this.receiveEntity(ent);
		this.setEntityState(ent);
	}

	protected receiveEntity(ent: DisplayEntity): void {
		this.processor.receiveEntity(ent);
	}

	protected setReceivedEntity(ent: DisplayEntity | null): void {
		this.processor.setReceivedEntity(ent);
	}

	protected releaseEntity(simTime: number): void {
		this.processor.releaseEntity(simTime);
	}

	/**
	 * Sends the specified entity to the next component downstream.
	 * @param ent - the entity to be sent downstream.
	 */
	sendToNextComponent(ent: DisplayEntity): void {
		this.releaseEntity(EventManager.simSeconds());
		if (this.getNextComponent() !== null )
			this.getNextComponent()!.addEntity(ent);
	}

	protected setEntityState(ent: DisplayEntity): void {
		if (this.stateAssignment.isDefault() || !(ent instanceof StateEntity))
			return;
		const state = this.stateAssignment.getNextString(this, EventManager.simSeconds());
		(ent as StateEntity).setPresentState(state);
	}

	protected getNextComponent(): Linkable | null {
		return this.nextComponent.getValue();
	}

	override clearStatistics(): void {
		super.clearStatistics();
		this.processor.clearStatistics();
	}

	override canLink(dir: boolean): boolean {
		return !this.nextComponent.getHidden();
	}

	override linkTo(nextEnt: DisplayEntity, dir: boolean): void {
		if (this.nextComponent.getHidden() || !(nextEnt instanceof Linkable)
				|| nextEnt instanceof EntityGen)
			return;

		const toks: string[] = [];
		toks.push(nextEnt.getName());
		const kw = new KeywordIndex(this.nextComponent.getKeyword(), toks, null);
		this.getJaamSimModel().storeAndExecute(new KeywordCommand(this, kw));
	}

	override getDestinationEntities(): DisplayEntity[] {
		const ret = super.getDestinationEntities();
		const l = this.nextComponent.getValue();
		if (l !== null && (l instanceof DisplayEntity)) {
			ret.push(l as DisplayEntity);
		}
		return ret;
	}

	// ******************************************************************************************************
	// OUTPUT METHODS
	// ******************************************************************************************************

	getReceivedEntity(simTime: number): DisplayEntity | null {
		return this.processor.getReceivedEntity();
	}

	getNumberAdded(simTime: number): number {
		return this.processor.getNumberReceived();
	}

	getNumberProcessed(simTime: number): number {
		return this.processor.getNumberProcessed();
	}

	getNumberInProgress(simTime: number): number {
		return  this.processor.getNumberInProgress();
	}

	getProcessingRate(simTime: number): number {
		const dur = simTime - this.getSimulation().getInitializationTime();
		if (dur <= 0.0)
			return 0.0;
		return this.processor.getNumberProcessed()/dur;
	}

	getReleaseTime(simTime: number): number {
		return this.processor.getReleaseTime();
	}

}

Linkable.register(LinkedDevice);

defineOutput(LinkedDevice, {
	name: "obj",
	description: "The entity that was received most recently.",
	sequence: 0,
	returnType: "Entity",
	get: (e, simTime) => e.getReceivedEntity(simTime),
});

defineOutput(LinkedDevice, {
	name: "NumberAdded",
	description: "The number of entities received from upstream after the initialization period.",
	unitType: DimensionlessUnit,
	reportable: true,
	sequence: 1,
	returnType: "long",
	get: (e, simTime) => e.getNumberAdded(simTime),
});

defineOutput(LinkedDevice, {
	name: "NumberProcessed",
	description: "The number of entities processed by this component after the initialization period.",
	unitType: DimensionlessUnit,
	reportable: true,
	sequence: 2,
	returnType: "long",
	get: (e, simTime) => e.getNumberProcessed(simTime),
});

defineOutput(LinkedDevice, {
	name: "NumberInProgress",
	description: "The number of entities that have been received but whose processing has not been completed yet.",
	unitType: DimensionlessUnit,
	sequence: 3,
	returnType: "long",
	get: (e, simTime) => e.getNumberInProgress(simTime),
});

defineOutput(LinkedDevice, {
	name: "ProcessingRate",
	description: "The number of entities processed per unit time by this component after the initialization period.",
	unitType: RateUnit,
	sequence: 4,
	returnType: "double",
	get: (e, simTime) => e.getProcessingRate(simTime),
});

defineOutput(LinkedDevice, {
	name: "ReleaseTime",
	description: "The time at which the last entity was released.",
	unitType: TimeUnit,
	sequence: 5,
	returnType: "double",
	get: (e, simTime) => e.getReleaseTime(simTime),
});
