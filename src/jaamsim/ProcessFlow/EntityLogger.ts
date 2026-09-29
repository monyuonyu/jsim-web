/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2014 Ausenco Engineering Canada Inc.
 * Copyright (C) 2015-2024 JaamSim Software Inc.
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

// Java の StateEntityListener（interface）は、isStateEntityListener(x) で見分ける（関数 isWatching と updateForStateChange を持つ）。

import { ClassRegistry } from "../java/ClassRegistry.ts";
import { Logger } from "../BasicObjects/Logger.ts";
import { BooleanProvInput } from "../BooleanProviders/BooleanProvInput.ts";
import { KeywordCommand } from "../Commands/KeywordCommand.ts";
import { DisplayEntity } from "../Graphics/DisplayEntity.ts";
import type { FileEntity } from "../basicsim/FileEntity.ts";
import { Entity } from "../basicsim/Entity.ts";
import { EventManager } from "../events/EventManager.ts";
import { InterfaceEntityInput } from "../input/InterfaceEntityInput.ts";
import { KeywordIndex } from "../input/KeywordIndex.ts";
import { defineOutput } from "../input/OutputRegistry.ts";
import { StateEntity } from "../states/StateEntity.ts";
import type { StateEntityListener } from "../states/StateEntityListener.ts";
import type { StateRecord } from "../states/StateRecord.ts";
import { EntityGen } from "./EntityGen.ts";
import { Linkable } from "./Linkable.ts";

export class EntityLogger extends Logger implements Linkable, StateEntityListener {

	protected readonly nextComponent: InterfaceEntityInput<Linkable>;

	private readonly traceEntityStates: BooleanProvInput;

	private receivedEntity: DisplayEntity | null = null;

	constructor() {
		super();
		this.nextComponent = new InterfaceEntityInput<Linkable>(Linkable, "NextComponent", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.nextComponent, "The next object to which the processed DisplayEntity is passed.",
				["Queue1"]);
		this.nextComponent.setRequired(true);
		this.addInput(this.nextComponent);

		this.traceEntityStates = new BooleanProvInput("TraceEntityStates", Entity.KEY_INPUTS, false);
		this.setKeywordDoc(this.traceEntityStates, "If TRUE, an entry will made in the log file every time one of the "
		                     + "received entities changes state.\n\n"
		                     + "With this option, entities are NOT logged when the are received. "
		                     + "They are logged ONLY when their 'State' output changes as they move "
		                     + "through the model.", []);
		this.addInput(this.traceEntityStates);
	}

	override earlyInit(): void {
		super.earlyInit();
		this.receivedEntity = null;
	}

	isTraceEntityStates(simTime: number): boolean {
		return this.traceEntityStates.getNextBoolean(this, simTime);
	}

	addEntity(ent: DisplayEntity): void {

		this.receivedEntity = ent;

		// Trace states for received entities
		const simTime = EventManager.simSeconds();
		if (this.isTraceEntityStates(simTime) && ent instanceof StateEntity) {
			(ent as StateEntity).addStateListener(this);
			this.nextComponent.getValue()!.addEntity(ent);
			return;
		}

		// Record the entry in the log
		this.recordLogEntry(EventManager.simSeconds(), ent);

		// Send the entity to the next element in the chain
		this.nextComponent.getValue()!.addEntity(ent);
	}

	protected override printColumnTitles(file: FileEntity): void {
		const simTime = EventManager.simSeconds();
		if (this.isTraceEntityStates(simTime)) {
			file.format("\t%s\t%s", "Entity", "State");
			return;
		}
		file.format("\t%s", "this.obj");
	}

	protected override recordEntry(file: FileEntity, simTime: number, ent: DisplayEntity | null): void {
		if (this.isTraceEntityStates(simTime) && ent instanceof StateEntity) {
			file.format("\t%s\t%s", ent, (ent as StateEntity).getPresentState(simTime));
			return;
		}
		file.format("\t%s", ent);
	}

	isWatching(ent: StateEntity): boolean {
		// Method not used
		return false;
	}

	updateForStateChange(ent: StateEntity, prev: StateRecord, next: StateRecord): void {
		this.recordLogEntry(EventManager.simSeconds(), ent);
	}

	override canLink(dir: boolean): boolean {
		return !this.nextComponent.getHidden();
	}

	override linkTo(nextEnt: DisplayEntity, dir: boolean): void {
		if (!(nextEnt instanceof Linkable) || nextEnt instanceof EntityGen)
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

	getReceivedEntity(simTime: number): DisplayEntity | null {
		return this.receivedEntity;
	}

}

Linkable.register(EntityLogger);

defineOutput(EntityLogger, {
	name: "obj",
	description: "The entity that was received most recently.",
	sequence: 0,
	returnType: "Entity",
	get: (e, simTime) => e.getReceivedEntity(simTime),
});

ClassRegistry.register("com.jaamsim.ProcessFlow.EntityLogger", EntityLogger);
