/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2014 Ausenco Engineering Canada Inc.
 * Copyright (C) 2018-2024 JaamSim Software Inc.
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
import { DisplayEntity } from "../Graphics/DisplayEntity.ts";
import { SampleInput } from "../Samples/SampleInput.ts";
import { Entity } from "../basicsim/Entity.ts";
import { EventManager } from "../events/EventManager.ts";
import { InterfaceEntityInput } from "../input/InterfaceEntityInput.ts";
import { DimensionlessUnit } from "../units/DimensionlessUnit.ts";
import { AbstractUnpack } from "./AbstractUnpack.ts";
import type { EntContainer } from "./EntContainer.ts";
import { Linkable } from "./Linkable.ts";

/** Java の (int) x（double → int。NaN は 0、範囲の外は端に丸める） */
function jint(x: number): number {
	if (Number.isNaN(x))
		return 0;
	if (x >= 2147483647)
		return 2147483647;
	if (x <= -2147483648)
		return -2147483648;
	return Math.trunc(x);
}

export class RemoveFrom extends AbstractUnpack {

	private readonly numberOfEntities: SampleInput;

	protected readonly nextForContainers: InterfaceEntityInput<Linkable>;

	constructor() {
		super();
		this.numberOfEntities = SampleInput.ofInt("NumberOfEntities", Entity.KEY_INPUTS, 1);
		this.setKeywordDoc(this.numberOfEntities, "The maximum number of entities to remove from the container.",
		         ["2", "DiscreteDistribution1", "this.attrib"]);
		this.numberOfEntities.setUnitType(DimensionlessUnit);
		this.numberOfEntities.setIntegerValue(true);
		this.numberOfEntities.setValidRange(0, Double.POSITIVE_INFINITY);
		this.addInput(this.numberOfEntities);

		this.nextForContainers = new InterfaceEntityInput<Linkable>(Linkable, "NextForContainers", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.nextForContainers, "The next object to which the processed EntityContainer is passed.",
		         ["Queue1"]);
		this.nextForContainers.setRequired(true);
		this.addInput(this.nextForContainers);
	}

	protected override disposeContainer(c: EntContainer): void {
		if( this.nextForContainers.getValue() !== null )
			this.nextForContainers.getValue()!.addEntity(c as unknown as DisplayEntity);
	}

	protected override getNumberToRemove(): number {
		return jint(this.numberOfEntities.getNextSample(this, EventManager.simSeconds()));
	}

	// LinkDisplayable
	override getDestinationEntities(): DisplayEntity[] {
		const ret = super.getDestinationEntities();
		const l = this.nextForContainers.getValue();
		if (l !== null && (l instanceof DisplayEntity)) {
			ret.push(l as DisplayEntity);
		}
		return ret;
	}

}

ClassRegistry.register("com.jaamsim.ProcessFlow.RemoveFrom", RemoveFrom);
