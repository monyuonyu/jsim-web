/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2013 Ausenco Engineering Canada Inc.
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

import { tr } from "../i18n/I18n.ts";
import { KeywordCommand } from "../Commands/KeywordCommand.ts";
import { DisplayEntity } from "../Graphics/DisplayEntity.ts";
import { StringProvInput } from "../StringProviders/StringProvInput.ts";
import { Entity } from "../basicsim/Entity.ts";
import type { ObserverEntity } from "../basicsim/ObserverEntity.ts";
import type { SubjectEntity } from "../basicsim/SubjectEntity.ts";
import { SubjectEntityDelegate } from "../basicsim/SubjectEntityDelegate.ts";
import { EventManager } from "../events/EventManager.ts";
import { EntityInput } from "../input/EntityInput.ts";
import type { Input } from "../input/Input.ts";
import type { InputCallback } from "../input/InputCallback.ts";
import { InputErrorException } from "../input/InputErrorException.ts";
import { InterfaceEntityInput } from "../input/InterfaceEntityInput.ts";
import { KeywordIndex } from "../input/KeywordIndex.ts";
import { defineOutput } from "../input/OutputRegistry.ts";
import { StateEntity } from "../states/StateEntity.ts";
import { DimensionlessUnit } from "../units/DimensionlessUnit.ts";
import { RateUnit } from "../units/RateUnit.ts";
import { TimeUnit } from "../units/TimeUnit.ts";
import { EntityGen } from "./EntityGen.ts";
import { Linkable } from "./Linkable.ts";
import { ProcessorData } from "./ProcessorData.ts";

/**
 * LinkedComponents are used to form a chain of components that process DisplayEntities that pass through the system.
 * Sub-classes for EntityGenerator, Server, and EntitySink.
 */
export abstract class LinkedComponent extends StateEntity implements SubjectEntity, Linkable {

	protected readonly defaultEntity: EntityInput<DisplayEntity>;

	protected readonly nextComponent: InterfaceEntityInput<Linkable>;

	protected readonly stateAssignment: StringProvInput;

	private readonly processor = new ProcessorData();
	private readonly subject = new SubjectEntityDelegate(this);

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
		this.defaultEntity.setHidden(true);
		this.defaultEntity.setCallback(LinkedComponent.inputCallback);
		this.addInput(this.defaultEntity);
		this.addSynonym(this.defaultEntity, "TestEntity");

		this.nextComponent = new InterfaceEntityInput<Linkable>(Linkable, "NextComponent", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.nextComponent, "The next object to which the processed entity is passed.",
				["Queue1"]);
		this.nextComponent.setRequired(true);
		this.addInput(this.nextComponent);

		this.stateAssignment = new StringProvInput("StateAssignment", Entity.OPTIONS, "");
		this.setKeywordDoc(this.stateAssignment, "The state to be assigned to each entity on arrival at this object.\n" +
				"No state is assigned if the entry is blank.",
		         ["Service"]);
		this.stateAssignment.setUnitType(DimensionlessUnit);
		this.addInput(this.stateAssignment);
	}

	static readonly inputCallback: InputCallback = {
		callback(ent: Entity, inp: Input<unknown>): void {
			(ent as LinkedComponent).updateInputValue();
		},
	} as InputCallback;

	updateInputValue(): void {
		this.setReceivedEntity(this.defaultEntity.getValue());
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
		this.subject.clear();
	}

	registerObserver(obs: ObserverEntity): void {
		this.subject.registerObserver(obs);
	}

	notifyObservers(): void {
		this.subject.notifyObservers();
	}

	override getObserverList(): ObserverEntity[] {
		return this.subject.getObserverList();
	}

	override getInitialState(): string {
		return "None";
	}

	override isValidState(state: string): boolean {
		return true;
	}

	addEntity(ent: DisplayEntity): void {
		if (this.isTraceFlag()) this.trace(0, "addEntity(%s)", ent);

		this.receiveEntity(ent);
		this.setEntityState(ent);

		// Notify any observers
		this.notifyObservers();
	}

	protected receiveEntity(ent: DisplayEntity): void {
		this.processor.receiveEntity(ent);
	}

	protected setReceivedEntity(ent: DisplayEntity | null): void {
		this.processor.setReceivedEntity(ent);
	}

	releaseEntity(simTime: number): void {
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

	/**
	 * Returns the number of entities that have been received from upstream during the entire
	 * simulation run, including the initialisation period.
	 */
	getTotalNumberAdded(): number {
		return this.processor.getTotalNumberReceived();
	}

	/**
	 * Returns the number of entities that have been received but whose processing has not been
	 * completed yet.
	 * （Java の getNumberInProgress() と、出力の getNumberInProgress(double simTime) を 1 つにしたもの）
	 */
	getNumberInProgress(simTime?: number): number {
		return  this.processor.getNumberInProgress();
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

Linkable.register(LinkedComponent);

defineOutput(LinkedComponent, {
	name: "obj",
	description: "The entity that was received most recently.",
	sequence: 0,
	returnType: "Entity",
	get: (e, simTime) => e.getReceivedEntity(simTime),
});

defineOutput(LinkedComponent, {
	name: "NumberAdded",
	description: "The number of entities received from upstream after the initialization period.",
	unitType: DimensionlessUnit,
	reportable: true,
	sequence: 1,
	returnType: "long",
	get: (e, simTime) => e.getNumberAdded(simTime),
});

defineOutput(LinkedComponent, {
	name: "NumberProcessed",
	description: "The number of entities processed by this component after the initialization period.",
	unitType: DimensionlessUnit,
	reportable: true,
	sequence: 2,
	returnType: "long",
	get: (e, simTime) => e.getNumberProcessed(simTime),
});

defineOutput(LinkedComponent, {
	name: "NumberInProgress",
	description: "The number of entities that have been received but whose processing has not been completed yet.",
	unitType: DimensionlessUnit,
	sequence: 3,
	returnType: "long",
	get: (e, simTime) => e.getNumberInProgress(simTime),
});

defineOutput(LinkedComponent, {
	name: "ProcessingRate",
	description: "The number of entities processed per unit time by this component after the initialization period.",
	unitType: RateUnit,
	sequence: 4,
	returnType: "double",
	get: (e, simTime) => e.getProcessingRate(simTime),
});

defineOutput(LinkedComponent, {
	name: "ReleaseTime",
	description: "The time at which the last entity was released.",
	unitType: TimeUnit,
	sequence: 5,
	returnType: "double",
	get: (e, simTime) => e.getReleaseTime(simTime),
});
