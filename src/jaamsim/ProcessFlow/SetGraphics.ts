/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2014 Ausenco Engineering Canada Inc.
 * Copyright (C) 2017-2024 JaamSim Software Inc.
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
import { Double } from "../internal.ts";
import { tr } from "../internal.ts";
import { EntityProvInput } from "../internal.ts";
import { DisplayEntity } from "../internal.ts";
import { OverlayEntity } from "../internal.ts";
import { TextBasics } from "../internal.ts";
import { SampleInput } from "../internal.ts";
import { Entity } from "../internal.ts";
import { EventManager } from "../internal.ts";
import { EntityListInput } from "../internal.ts";
import { DimensionlessUnit } from "../internal.ts";
import { LinkedComponent } from "../internal.ts";

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

export class SetGraphics extends LinkedComponent {

	private readonly targetEntity: EntityProvInput<DisplayEntity>;

	private readonly graphicsList: EntityListInput<DisplayEntity>;

	private readonly choice: SampleInput;

	constructor() {
		super();
		this.targetEntity = new EntityProvInput<DisplayEntity>(DisplayEntity, "TargetEntity", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.targetEntity, "The entity whose graphics are to be changed. Defaults to the entity "
		                     + "that was received.",
		         ["Server1", "this.target"]);
		this.targetEntity.setDefaultText("this.obj");
		this.targetEntity.addInvalidClass(TextBasics);
		this.targetEntity.addInvalidClass(OverlayEntity);
		this.addInput(this.targetEntity);

		this.graphicsList = new EntityListInput<DisplayEntity>(DisplayEntity, "GraphicsList", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.graphicsList, "List of entities whose graphics can chosen for assignment to the "
		                     + "target entity.", []);
		this.graphicsList.setRequired(true);
		this.graphicsList.addInvalidClass(TextBasics);
		this.graphicsList.addInvalidClass(OverlayEntity);
		this.addInput(this.graphicsList);

		this.choice = SampleInput.ofInt("Choice", Entity.KEY_INPUTS, 1);
		this.setKeywordDoc(this.choice, "A number that determines the choice of entities from the "
		                     + "GraphicsList:\n"
		                     + "   1 = first entity's graphics, 2 = second entity's graphics, etc.",
		         ["2", "DiscreteDistribution1", "'1 + [TimeSeries1].PresentValue'"]);
		this.choice.setUnitType(DimensionlessUnit);
		this.choice.setIntegerValue(true);
		this.choice.setValidRange(1, Double.POSITIVE_INFINITY);
		this.addInput(this.choice);
	}

	override addEntity(ent: DisplayEntity): void {
		super.addEntity(ent);
		const simTime = EventManager.simSeconds();

		// Identify the entity whose graphics are to be changed
		let target: DisplayEntity = ent;
		if (!this.targetEntity.isDefault()) {
			target = this.targetEntity.getNextEntity(this, simTime)!;
		}

		// Choose the new graphics for this entity
		const i = jint(this.choice.getNextSample(this, simTime));
		if (i<1 || i>this.graphicsList.getValue()!.length)
			this.error(tr("Chosen index i=%s is out of range for GraphicList: %s."), i, jlistStr(this.graphicsList.getValue()));
		const chosen = this.graphicsList.getValue()![i-1];

		target.setDisplayModelList(chosen.getDisplayModelList());
		target.setSize(chosen.getSize());
		target.setOrientation(chosen.getOrientation());
		target.setAlignment(chosen.getAlignment());

		// Send the entity to the next component in the chain
		this.sendToNextComponent(ent);
	}

}

ClassRegistry.register("com.jaamsim.ProcessFlow.SetGraphics", SetGraphics);
