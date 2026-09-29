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

import { BooleanProvInput } from "../BooleanProviders/BooleanProvInput.ts";
import { Entity } from "../basicsim/Entity.ts";
import { ClassRegistry } from "../java/ClassRegistry.ts";
import { Threshold } from "./Threshold.ts";

/**
 * SignalThreshold is a type of Threshold that is controlled directly by
 * another object. At present, it is required only for EntitySignal.
 * @author Harry
 *
 */
export class SignalThreshold extends Threshold {

	private readonly initState: BooleanProvInput;

	constructor() {
		super();
		this.initState = new BooleanProvInput("InitialState", Entity.KEY_INPUTS, false);
		this.setKeywordDoc(this.initState, "The state for the SignalThreshold at the start of "
				+ "the simulation run: TRUE = Open, FALSE = Closed.", []);
		this.addInput(this.initState);
	}

	override startUp(): void {
		super.startUp();
		const bool = this.initState.getNextBoolean(this, 0.0);
		this.setOpen(bool);
	}

	override getInitialState(): string {
		if (this.initState.getNextBoolean(this, 0.0))
			return "Open";
		else
			return "Closed";
	}

}

ClassRegistry.register("com.jaamsim.Thresholds.SignalThreshold", SignalThreshold);
