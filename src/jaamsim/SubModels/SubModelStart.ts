/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2018-2022 JaamSim Software Inc.
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

import { KeywordCommand } from "../Commands/KeywordCommand.ts";
import { DisplayEntity } from "../Graphics/DisplayEntity.ts";
import { EntityGen } from "../ProcessFlow/EntityGen.ts";
import { Linkable } from "../ProcessFlow/Linkable.ts";
import { Entity } from "../basicsim/Entity.ts";
import { InterfaceEntityInput } from "../input/InterfaceEntityInput.ts";
import { KeywordIndex } from "../input/KeywordIndex.ts";
import { ClassRegistry } from "../java/ClassRegistry.ts";

export class SubModelStart extends DisplayEntity implements Linkable {

	protected readonly nextComponent: InterfaceEntityInput<Linkable>;

	constructor() {
		super();
		this.nextComponent = new InterfaceEntityInput<Linkable>(Linkable, "NextComponent", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.nextComponent, "The next component in the sub-model.",
				["Queue1"]);
		this.nextComponent.setRequired(true);
		this.addInput(this.nextComponent);
	}

	addEntity(ent: DisplayEntity): void {
		this.nextComponent.getValue()!.addEntity(ent);
	}

	override canLink(dir: boolean): boolean {
		return dir;
	}

	override linkTo(nextEnt: DisplayEntity, _dir: boolean): void {
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
		if (l != null && (l instanceof DisplayEntity)) {
			ret.push(l);
		}
		return ret;
	}

}

Linkable.register(SubModelStart);
ClassRegistry.register("com.jaamsim.SubModels.SubModelStart", SubModelStart);
