/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2014 Ausenco Engineering Canada Inc.
 * Copyright (C) 2023 JaamSim Software Inc.
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

import { ClassRegistry } from "../internal.ts";
import { BooleanProvInput } from "../internal.ts";
import type { DisplayEntity } from "../Graphics/DisplayEntity.ts";
import { SignalThreshold } from "../internal.ts";
import { Entity } from "../internal.ts";
import { EventManager } from "../internal.ts";
import { EntityInput } from "../internal.ts";
import { LinkedComponent } from "../internal.ts";

export class EntitySignal extends LinkedComponent {

	private readonly targetSignalThreshold: EntityInput<SignalThreshold>;

	private readonly newState: BooleanProvInput;

	constructor() {
		super();
		this.targetSignalThreshold = new EntityInput<SignalThreshold>( SignalThreshold, "TargetSignalThreshold", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.targetSignalThreshold, "The Threshold controlled by this Signal.", []);
		this.targetSignalThreshold.setRequired(true);
		this.addInput( this.targetSignalThreshold);

		this.newState = new BooleanProvInput( "NewState", Entity.KEY_INPUTS, true);
		this.setKeywordDoc(this.newState, "The new state for the target SignalThreshold: TRUE = Open, FALSE = Closed.", []);
		this.addInput( this.newState);
	}

	getNewState(simTime: number): boolean {
		return this.newState.getNextBoolean(this, simTime);
	}

	override addEntity( ent: DisplayEntity ): void {
		super.addEntity(ent);

		// Signal the target threshold
		const target = this.targetSignalThreshold.getValue()!;
		const bool = this.getNewState(EventManager.simSeconds());
		target.setOpen(bool);

		// Send the entity to the next component
		this.sendToNextComponent( ent );
	}

}

ClassRegistry.register("com.jaamsim.ProcessFlow.EntitySignal", EntitySignal);
