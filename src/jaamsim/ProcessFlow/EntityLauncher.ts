/*
 * JaamSim Discrete Event Simulation
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

import { KeywordCommand } from "../internal.ts";
import { EntityProvInput } from "../internal.ts";
import { GameEntity } from "../internal.ts";
import { DisplayEntity } from "../internal.ts";
import { OverlayEntity } from "../internal.ts";
import { TextBasics } from "../internal.ts";
import { Entity } from "../internal.ts";
import { InputAgent } from "../internal.ts";
import { InterfaceEntityInput } from "../internal.ts";
import { KeywordIndex } from "../internal.ts";
import { StringInput } from "../internal.ts";
import { ClassRegistry } from "../internal.ts";
import { EntityGen } from "../internal.ts";
import { Linkable } from "../internal.ts";

export class EntityLauncher extends GameEntity implements EntityGen {

	private readonly prototypeEntity: EntityProvInput<DisplayEntity>;

	protected readonly nextComponent: InterfaceEntityInput<Linkable>;

	private readonly baseName: StringInput;

	private numberGenerated = 0;  // Number of entities generated so far

	constructor() {
		super();
		this.prototypeEntity = new EntityProvInput<DisplayEntity>(DisplayEntity, "PrototypeEntity", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.prototypeEntity, "The prototype for entities to be generated. "
		                     + "The generated entities will be copies of this entity.",
		         ["Proto", "'choose( this.NumberGenerated%2+1, [Proto1], [Proto2])'"]);
		this.prototypeEntity.setRequired(true);
		this.prototypeEntity.addInvalidClass(TextBasics);
		this.prototypeEntity.addInvalidClass(OverlayEntity);
		this.addInput(this.prototypeEntity);

		this.nextComponent = new InterfaceEntityInput<Linkable>(Linkable, "NextComponent", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.nextComponent, "The object to which the generated DisplayEntity is passed.",
		         ["Queue1"]);
		this.nextComponent.setRequired(true);
		this.addInput(this.nextComponent);

		this.baseName = new StringInput("BaseName", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.baseName, "The base for the names assigned to the generated entities. "
		                     + "The generated entities will be named Name1, Name2, etc.",
		         ["Customer", "Package"]);
		this.baseName.setDefaultText("Generator Name");
		this.addInput(this.baseName);
	}

	override earlyInit(): void {
		super.earlyInit();
		this.numberGenerated = 0;
	}

	override doAction(): void {

		// Set the name for the entities
		let name = this.baseName.getValue();
		if (name === null) {
			name = this.getName() + "_";
			name = name.split(".").join("_");
		}

		// Create a new entity
		this.numberGenerated++;
		const proto = this.prototypeEntity.getNextEntity(this, 0.0) as DisplayEntity;
		name = name + this.numberGenerated;
		const ent = InputAgent.getGeneratedClone(proto, name) as DisplayEntity;
		ent.earlyInit();
		ent.lateInit();

		// Send the entity to the next element in the chain
		this.nextComponent.getValue()!.addEntity(ent);
	}

	setPrototypeEntity(proto: DisplayEntity): void {
		const kw = KeywordIndex.formatArgs(this.prototypeEntity.getKeyword(), proto.getName());
		this.getJaamSimModel().storeAndExecute(new KeywordCommand(this, kw));
	}

	override canLink(dir: boolean): boolean {
		return true;
	}

	override linkTo(nextEnt: DisplayEntity, dir: boolean): void {
		if (!(nextEnt instanceof Linkable) || nextEnt instanceof EntityGen)
			return;

		const toks: string[] = [];
		toks.push(nextEnt.getName());
		const kw = new KeywordIndex(this.nextComponent.getKeyword(), toks, null);
		this.getJaamSimModel().storeAndExecute(new KeywordCommand(this, kw));
	}

	override getDestinationEntities(): DisplayEntity[] {
		const ret = super.getDestinationEntities();
		const l = this.nextComponent.getValue();
		if (l !== null && (l instanceof DisplayEntity)) {
			ret.push(l as DisplayEntity);
		}
		return ret;
	}

	override getSourceEntities(): DisplayEntity[] {
		const ret = super.getSourceEntities();
		try {
			const ent = this.prototypeEntity.getNextEntity(this, 0.0);
			if (ent !== null) {
				ret.push(ent);
			}
		}
		catch (e) {}
		return ret;
	}

}

EntityGen.register(EntityLauncher);

ClassRegistry.register("com.jaamsim.ProcessFlow.EntityLauncher", EntityLauncher);
