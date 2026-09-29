/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2013 Ausenco Engineering Canada Inc.
 * Copyright (C) 2020-2026 JaamSim Software Inc.
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

// updateGraphics は、最後に受け取った物の位置（状態）を決めるので残した。

import type { DisplayEntity } from "../Graphics/DisplayEntity.ts";
import { EventManager } from "../events/EventManager.ts";
import { defineOutput } from "../input/OutputRegistry.ts";
import { ClassRegistry } from "../java/ClassRegistry.ts";
import { DimensionlessUnit } from "../units/DimensionlessUnit.ts";
import { LinkedComponent } from "./LinkedComponent.ts";

/**
 * EntitySink kills the DisplayEntities sent to it.
 */
export class EntitySink extends LinkedComponent {

	lastEnt: DisplayEntity | null = null;
	private numberDestroyed = 0;  // Number of entities destroyed so far

	constructor() {
		super();
		this.nextComponent.setHidden(true);
		this.defaultEntity.setHidden(true);
		this.stateAssignment.setHidden(true);
	}

	override earlyInit(): void {
		super.earlyInit();
		this.lastEnt = null;
		this.numberDestroyed = 0;
	}

	override addEntity( ent: DisplayEntity ): void {
		super.addEntity(ent);
		const simTime = EventManager.simSeconds();

		// Increment the number processed
		this.releaseEntity(simTime);
		this.numberDestroyed++;

		// Save the new entity and kill the previous one
		if (this.lastEnt !== null) {
			this.lastEnt.dispose();
		}
		this.lastEnt = ent;

		// Hide the received entity
		ent.setShow(false);
	}

	override updateGraphics(simTime: number): void {
		super.updateGraphics(simTime);
		if (this.lastEnt === null)
			return;
		this.lastEnt.setGlobalPosition(this.getGlobalPosition());
	}

	getNumberDestroyed(simTime: number): number {
		return this.numberDestroyed;
	}

}

ClassRegistry.register("com.jaamsim.ProcessFlow.EntitySink", EntitySink);

defineOutput(EntitySink, {
	name: "NumberDestroyed",
	description: "Total number of entities that have been destroyed, including the initialization period.",
	unitType: DimensionlessUnit,
	sequence: 1,
	returnType: "int",
	get: (e, simTime) => e.getNumberDestroyed(simTime),
});
