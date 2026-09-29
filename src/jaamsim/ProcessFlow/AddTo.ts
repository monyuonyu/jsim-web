/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2014 Ausenco Engineering Canada Inc.
 * Copyright (C) 2018-2025 JaamSim Software Inc.
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
import { ClassRegistry } from "../java/ClassRegistry.ts";
import { Double } from "../java/lang.ts";
import type { DisplayEntity } from "../Graphics/DisplayEntity.ts";
import { Entity } from "../basicsim/Entity.ts";
import { EventManager } from "../events/EventManager.ts";
import { EntityInput } from "../input/EntityInput.ts";
import { AbstractPack } from "./AbstractPack.ts";
import { EntContainer } from "./EntContainer.ts";
import { Queue } from "./Queue.ts";

export class AddTo extends AbstractPack {

	private readonly containerQueue: EntityInput<Queue>;

	constructor() {
		super();
		this.numberOfEntities.setValidRange(0, Double.POSITIVE_INFINITY);

		this.containerQueue = new EntityInput<Queue>(Queue, "ContainerQueue", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.containerQueue, "The queue in which the waiting containers will be placed.", []);
		this.containerQueue.setRequired(true);
		this.addInput(this.containerQueue);
	}

	override addEntity(ent: DisplayEntity): void {
		const simTime = EventManager.simSeconds();

		// Add an incoming container to its queue
		if (ent instanceof EntContainer)
			this.containerQueue.getValue()!.addEntity(ent);
		else
			this.getQueue(simTime)!.addEntity(ent);
	}

	override getQueues(): Queue[] {
		const ret = super.getQueues();
		if (this.containerQueue.getValue() !== null)
			ret.push(this.containerQueue.getValue()!);
		return ret;
	}

	protected override isContainerAvailable(): boolean {
		return !this.containerQueue.getValue()!.isEmpty();
	}

	protected override getNextContainer(): EntContainer {
		const ret = this.containerQueue.getValue()!.removeFirst();
		if (!(ret instanceof EntContainer))
			this.error(tr("Entity '%s' is not an EntityContainer or equivalent"), ret);
		return ret as unknown as EntContainer;
	}

	protected override startProcessing(simTime: number): boolean {

		// Is there a container waiting to be filled?
		if (this.container === null && this.containerQueue.getValue()!.isEmpty()) {
			return false;
		}

		return super.startProcessing(simTime);
	}

	override getSourceEntities(): DisplayEntity[] {
		const ret = super.getSourceEntities();
		if (this.containerQueue.getValue() !== null)
			ret.push(this.containerQueue.getValue()!);
		return ret;
	}

}

ClassRegistry.register("com.jaamsim.ProcessFlow.AddTo", AddTo);
