/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2014 Ausenco Engineering Canada Inc.
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

import { ClassRegistry } from "../internal.ts";
import { KeywordCommand } from "../internal.ts";
import { DisplayEntity } from "../internal.ts";
import { SampleListInput } from "../internal.ts";
import { Entity } from "../internal.ts";
import { EventManager } from "../internal.ts";
import { InputAgent } from "../internal.ts";
import { InterfaceEntityListInput } from "../internal.ts";
import { KeywordIndex } from "../internal.ts";
import { StringInput } from "../internal.ts";
import { StateEntity } from "../internal.ts";
import { DimensionlessUnit } from "../internal.ts";
import { EntityGen } from "../internal.ts";
import { Linkable } from "../internal.ts";
import { LinkedComponent } from "../internal.ts";

export class Duplicate extends LinkedComponent {

	protected readonly targetComponentList: InterfaceEntityListInput<Linkable>;

	private readonly numberOfDuplicates: SampleListInput;

	private readonly baseName: StringInput;

	constructor() {
		super();
		this.targetComponentList = new InterfaceEntityListInput<Linkable>( Linkable, "TargetComponentList", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.targetComponentList, "The list of components that will receive one or more duplicated entities.",
		         ["Assign1 Queue1"]);
		this.targetComponentList.setUnique(false);
		this.targetComponentList.setRequired(true);
		this.addInput( this.targetComponentList);

		this.numberOfDuplicates = SampleListInput.ofInt("NumberOfDuplicates", Entity.KEY_INPUTS, 1);
		this.setKeywordDoc(this.numberOfDuplicates, "The number of duplicated entities to be sent to each target. "
		                     + "The last value in the list is used if the number of targets is greater "
		                     + "than the number of values. "
		                     + "Only an integer number of entities can be handled. "
		                     + "A decimal value will be truncated to an integer.",
		         ["2 1", "{ 2 } { 1 }", "{ DiscreteDistribution1 } { 'this.obj.attrib1 + 1' }"]);
		this.numberOfDuplicates.setDimensionless(true);
		this.numberOfDuplicates.setUnitType(DimensionlessUnit);
		this.numberOfDuplicates.setIntegerValue(true);
		this.addInput(this.numberOfDuplicates);

		this.baseName = new StringInput("BaseName", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.baseName, "The base for the names assigned to the duplicated entities. "
		                     + "The duplicated entities will be named Name1, Name2, etc.",
		         ["Customer", "Package"]);
		this.baseName.setDefaultText("EntityName_Dup");
		this.addInput(this.baseName);
	}

	getNumberOfDuplicates(simTime: number): number[] {
		return this.numberOfDuplicates.getNextIntegers(this, simTime, this.targetComponentList.getListSize());
	}

	override addEntity(ent: DisplayEntity): void {
		super.addEntity(ent);
		const simTime = EventManager.simSeconds();

		// Set the base name for the duplicates
		let name = this.baseName.getValue();
		if (name === null) {
			name = ent.getName() + "_Dup";
			name = name.replaceAll(".", "_");
		}

		// Make the duplicates and send them to the targets
		let n = 1;
		const num = this.getNumberOfDuplicates(simTime);
		for (let index = 0; index < this.targetComponentList.getListSize(); index++) {
			const target = this.targetComponentList.getValue()![index];
			for (let i = 0; i < num[index]; i++) {

				// Create the duplicated entity
				const proto = ent.getPrototype();
				const dup = InputAgent.getGeneratedClone(proto!, name + n) as DisplayEntity;
				dup.earlyInit();
				dup.lateInit();

				// Set the attribute values for the duplicated entity
				Entity.copyAttributeValues(ent, dup);

				// Set the state for the duplicated entity
				if (dup instanceof StateEntity) {
					const state = (ent as unknown as StateEntity).getPresentState(simTime);
					(dup as StateEntity).setPresentState(state);
				}

				// Set the graphics for the duplicated entity
				dup.setRegion(ent.getCurrentRegion());
				dup.setPosition(ent.getPosition());
				dup.setDisplayModelList(ent.getDisplayModelList());
				dup.setSize(ent.getSize());
				dup.setOrientation(ent.getOrientation());
				dup.setAlignment(ent.getAlignment());

				// Send the duplicate to the target component
				target.addEntity(dup);
				n++;
			}
		}

		// Send the received entity to the next component
		this.sendToNextComponent(ent);
	}

	// LinkDisplayable
	override getDestinationEntities(): DisplayEntity[] {
		const ret = super.getDestinationEntities();

		const ls = this.targetComponentList.getValue();
		if (ls === null)
			return ret;

		for (const l of ls) {
			if (l !== null && (l instanceof DisplayEntity)) {
				ret.push(l as DisplayEntity);
			}
		}
		return ret;
	}

	override linkTo(nextEnt: DisplayEntity, dir: boolean): void {
		if (this.nextComponent.isDefault()) {
			super.linkTo(nextEnt, dir);
			return;
		}
		if (!(nextEnt instanceof Linkable) || nextEnt instanceof EntityGen)
			return;

		const toks: string[] = [];
		this.targetComponentList.getValueTokens(toks);
		toks.push(nextEnt.getName());
		const kw = new KeywordIndex(this.targetComponentList.getKeyword(), toks, null);
		this.getJaamSimModel().storeAndExecute(new KeywordCommand(this, kw));
	}

}

ClassRegistry.register("com.jaamsim.ProcessFlow.Duplicate", Duplicate);
