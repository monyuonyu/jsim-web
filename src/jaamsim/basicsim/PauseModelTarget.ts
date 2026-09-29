/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2015 Ausenco Engineering Canada Inc.
 * Copyright (C) 2019 JaamSim Software Inc.
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
import { EventManager } from "../internal.ts";
import { ProcessTarget } from "../internal.ts";
import type { Conditional } from "../events/Conditional.ts";
import type { JaamSimModel } from "./JaamSimModel.ts";

// 入れ子のクラス PauseModelTarget.PauseModelCondition は、同じファイルの PauseModelTarget_PauseModelCondition にした
export class PauseModelTarget extends ProcessTarget {
	readonly simModel: JaamSimModel;
	readonly condition: Conditional;

	constructor(model: JaamSimModel) {
		super();
		this.simModel = model;
		this.condition = new PauseModelTarget_PauseModelCondition(model);
	}

	override getDescription(): string {
		return "Simulation.pause";
	}

	override process(): void {
		this.simModel.event_pause();
	}
}

class PauseModelTarget_PauseModelCondition implements Conditional {
	readonly simModel: JaamSimModel;

	constructor(model: JaamSimModel) {
		this.simModel = model;
	}

	evaluate(): boolean {
		const simTime = EventManager.simSeconds();
		return this.simModel.getSimulation()!.isPauseConditionSatisfied(simTime);
	}
}
