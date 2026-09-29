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

// updateGraphics は、処理中の物の位置（状態）を決めるので残した。

import { tr } from "../i18n/I18n.ts";
import { ClassRegistry } from "../java/ClassRegistry.ts";
import { BooleanProvInput } from "../BooleanProviders/BooleanProvInput.ts";
import type { DisplayEntity } from "../Graphics/DisplayEntity.ts";
import { Entity } from "../basicsim/Entity.ts";
import { AbstractCombine } from "./AbstractCombine.ts";

export class Combine extends AbstractCombine {

	private readonly retainAll: BooleanProvInput;

	private readonly processedEntityList: DisplayEntity[];  // entities being processed

	constructor() {
		super();
		this.stateGraphics.setHidden(true);

		this.retainAll = new BooleanProvInput("RetainAll", Entity.KEY_INPUTS, false);
		this.setKeywordDoc(this.retainAll, "If TRUE, all the matching entities are passed to the next component.\n"
		                     + "If FALSE, only the entity in the first queue is passed on.", []);
		this.addInput(this.retainAll);

		this.processedEntityList = [];
	}

	override earlyInit(): void {
		super.earlyInit();
		this.processedEntityList.length = 0;
	}

	override addEntity( ent: DisplayEntity ): void {
		this.error(tr("An entity cannot be sent directly to an Combine object. It must be sent to the appropriate queue."));
	}

	protected override startProcessing(simTime: number): boolean {

		// Do the queues have enough entities?
		const queueList = this.getQueues();

		const oldEnt = this.getReceivedEntity(simTime);
		this.setReceivedEntity(queueList[0].getFirst());
		const numList = this.getNumberRequired(simTime);
		this.setReceivedEntity(oldEnt);

		if (this.isMatchRequired(simTime)) {
			const m = AbstractCombine.selectMatchValue(queueList, numList, this.isFirstQueue(simTime));
			if (m === null) {
				return false;
			}
			this.setMatchValue(m);
		}
		else {
			if (!AbstractCombine.sufficientEntities(queueList, numList, null)) {
				return false;
			}
		}

		// Remove the appropriate entities from each queue
		this.clearConsumedEntityList();
		for (let i = 0; i < queueList.length; i++) {
			for (let n = 0; n < numList[i]; n++) {
				const ent = queueList[i].removeFirst(this.getMatchValue());
				if (ent === null)
					this.error(tr("An entity with the specified match value %s was not found in %s."),
							this.getMatchValue(), queueList[i]);

				// Destroy all the entities but the first
				if ((i > 0 || n > 0) && !this.isRetainAll(simTime)) {
					this.addConsumedEntity(ent);
					continue;
				}

				// Save the entities to be passed on
				this.receiveEntity(ent);
				this.setEntityState(ent);
				this.processedEntityList.push(ent);
			}
		}

		// Set the obj output
		this.setReceivedEntity(this.processedEntityList[0]);

		return true;
	}

	protected override processStep(simTime: number): void {
		for (const ent of this.processedEntityList) {
			this.sendToNextComponent(ent);
		}
		this.processedEntityList.length = 0;
	}

	override isFinished(): boolean {
		return this.processedEntityList.length === 0;
	}

	isRetainAll(simTime: number): boolean {
		return this.retainAll.getNextBoolean(this, simTime);
	}

	override updateGraphics(simTime: number): void {
		super.updateGraphics(simTime);

		// Copy the list to avoid concurrent modification exceptions
		let copiedList: DisplayEntity[];
		try {
			copiedList = [...this.processedEntityList];
		}
		catch (e) {
			return;
		}

		for (const ent of copiedList) {
			this.moveToProcessPosition(ent);
		}
	}

}

ClassRegistry.register("com.jaamsim.ProcessFlow.Combine", Combine);
