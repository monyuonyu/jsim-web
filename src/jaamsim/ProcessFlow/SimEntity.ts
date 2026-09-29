/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2014 Ausenco Engineering Canada Inc.
 * Copyright (C) 2016-2021 JaamSim Software Inc.
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

import { ClassRegistry } from "../java/ClassRegistry.ts";
import type { DisplayEntity } from "../Graphics/DisplayEntity.ts";
import { Entity } from "../basicsim/Entity.ts";
import { StringInput } from "../input/StringInput.ts";
import { StringListInput } from "../input/StringListInput.ts";
import { StateEntity } from "../states/StateEntity.ts";
import { EntityGen } from "./EntityGen.ts";

export class SimEntity extends StateEntity {

	protected readonly defaultStateList: StringListInput;

	protected readonly initialState: StringInput;

	constructor() {
		super();
		this.attributeDefinitionList.setHidden(false);
		this.stateGraphics.setHidden(false);
		this.workingStateListInput.setHidden(true);

		this.defaultStateList = new StringListInput("DefaultStateList", Entity.KEY_INPUTS, []);
		this.setKeywordDoc(this.defaultStateList, "A list of states that will always appear in the output report, "
		                     + "even if no time is recorded for this state.",
		         ["Idle Working"]);
		this.addInput(this.defaultStateList);

		this.initialState = new StringInput("InitialState", Entity.KEY_INPUTS, "None");
		this.setKeywordDoc(this.initialState, "The state of the SimEntity at the start of the simulation run or when "
		                     + "it is first created during a simulation run.",
		         ["Idle"]);
		this.addInput(this.initialState);
	}

	override earlyInit(): void {
		super.earlyInit();

		for (const state of this.defaultStateList.getValue()!) {
			this.addState(state);
		}
	}

	override getInitialState(): string {
		return this.initialState.getValue()!;
	}

	override clearStatistics(): void {
		if (this.isGenerated())
			return;
		super.clearStatistics();
	}

	override isValidState(state: string): boolean {
		return true;
	}

	override canLink(dir: boolean): boolean {
		return true;
	}

	override linkTo(nextEnt: DisplayEntity, dir: boolean): void {
		if (!(nextEnt instanceof EntityGen))
			return;

		const gen = nextEnt as EntityGen;
		gen.setPrototypeEntity(this);
	}

}

ClassRegistry.register("com.jaamsim.ProcessFlow.SimEntity", SimEntity);
