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

import { ClassRegistry } from "../java/ClassRegistry.ts";
import { Double } from "../java/lang.ts";
import { tr } from "../i18n/I18n.ts";
import { KeywordCommand } from "../Commands/KeywordCommand.ts";
import { DisplayEntity } from "../Graphics/DisplayEntity.ts";
import { SampleInput } from "../Samples/SampleInput.ts";
import { Entity } from "../basicsim/Entity.ts";
import { EventManager } from "../events/EventManager.ts";
import { InterfaceEntityListInput } from "../input/InterfaceEntityListInput.ts";
import { KeywordIndex } from "../input/KeywordIndex.ts";
import { DimensionlessUnit } from "../units/DimensionlessUnit.ts";
import { EntityGen } from "./EntityGen.ts";
import { Linkable } from "./Linkable.ts";
import { LinkedComponent } from "./LinkedComponent.ts";

/** Java の (int) x（double → int。NaN は 0、範囲の外は端の値） */
function jint(x: number): number {
	if (Number.isNaN(x))
		return 0;
	if (x >= 2147483647)
		return 2147483647;
	if (x <= -2147483648)
		return -2147483648;
	return Math.trunc(x);
}

/** Java の ArrayList.toString()（"[a, b]"） */
function jlistStr(list: unknown[] | null): string {
	if (list === null)
		return "null";
	return "[" + list.map(o => String(o)).join(", ") + "]";
}

export class Branch extends LinkedComponent {

	protected readonly nextComponentList: InterfaceEntityListInput<Linkable>;

	private readonly choice: SampleInput;

	constructor() {
		super();
		this.nextComponent.setHidden(true);

		this.nextComponentList = new InterfaceEntityListInput<Linkable>(Linkable, "NextComponentList", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.nextComponentList, "The list of possible next objects to which the processed DisplayEntity can be passed.",
		         ["Queue1 Queue2"]);
		this.nextComponentList.setRequired(true);
		this.addInput(this.nextComponentList);

		this.choice = new SampleInput("Choice", Entity.KEY_INPUTS, Double.NaN);
		this.setKeywordDoc(this.choice, "A number that determines the choice of next component: "
		                     + "1 = first branch, 2 = second branch, etc.",
		         ["2", "DiscreteDistribution1", "'indexOfMin([Queue1].QueueLength, [Queue2].QueueLength)'"]);
		this.choice.setUnitType(DimensionlessUnit );
		this.choice.setIntegerValue(true);
		this.choice.setValidRange(1, Double.POSITIVE_INFINITY);
		this.choice.setRequired(true);
		this.addInput(this.choice);
	}

	override addEntity( ent: DisplayEntity ): void {
		super.addEntity(ent);
		const simTime = EventManager.simSeconds();

		// Choose the next component for this entity
		const i = jint(this.choice.getNextSample(this, simTime));
		if (i<1 || i>this.nextComponentList.getValue()!.length)
			this.error(tr("Chosen index i=%s is out of range for NextComponentList: %s."),
			      i, jlistStr(this.nextComponentList.getValue()));

		// Set the standard outputs for a LinkedComponent
		this.releaseEntity(simTime);

		// Pass the entity to the selected next component
		this.nextComponentList.getValue()![i-1].addEntity(ent);
	}

	override getDestinationEntities(): DisplayEntity[] {
		const ret = super.getDestinationEntities();
		const ls = this.nextComponentList.getValue();
		if (ls === null)
			return ret;

		for (const l of ls) {
			if (l !== null && (l instanceof DisplayEntity)) {
				ret.push(l as DisplayEntity);
			}
		}
		return ret;
	}

	override canLink(dir: boolean): boolean {
		return true;
	}

	override linkTo(nextEnt: DisplayEntity, dir: boolean): void {
		if (!(nextEnt instanceof Linkable) || nextEnt instanceof EntityGen)
			return;

		const toks: string[] = [];
		this.nextComponentList.getValueTokens(toks);
		toks.push(nextEnt.getName());
		const kw = new KeywordIndex(this.nextComponentList.getKeyword(), toks, null);
		this.getJaamSimModel().storeAndExecute(new KeywordCommand(this, kw));
	}

}

ClassRegistry.register("com.jaamsim.ProcessFlow.Branch", Branch);
