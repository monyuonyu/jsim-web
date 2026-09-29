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
import { EntityProvInput } from "../EntityProviders/EntityProvInput.ts";
import { DisplayEntity } from "../Graphics/DisplayEntity.ts";
import { OverlayEntity } from "../Graphics/OverlayEntity.ts";
import { TextBasics } from "../Graphics/TextBasics.ts";
import { EntityGen } from "../ProcessFlow/EntityGen.ts";
import { Linkable } from "../ProcessFlow/Linkable.ts";
import { Entity } from "../basicsim/Entity.ts";
import { EventManager } from "../events/EventManager.ts";
import { KeywordIndex } from "../input/KeywordIndex.ts";
import { ClassRegistry } from "../java/ClassRegistry.ts";
import type { CompoundEntity } from "./CompoundEntity.ts";

export class SubModelEnd extends DisplayEntity implements Linkable {

	protected readonly nextComponent: EntityProvInput<DisplayEntity>;

	private submodel: CompoundEntity | null = null;

	constructor() {
		super();
		this.nextComponent = new EntityProvInput<DisplayEntity>(DisplayEntity, "NextComponent", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.nextComponent, "The next object, external to the sub-model, to which the processed "
				+ "entity is passed. "
				+ "If left blank, the entity is returned to the parent sub-model which "
				+ "directs it to the object specified by its NextComponent input.",
				["Statistics1"]);
		this.nextComponent.addInvalidClass(OverlayEntity);
		this.nextComponent.addInvalidClass(TextBasics);
		this.addInput(this.nextComponent);
	}

	setSubModel(sub: CompoundEntity): void {
		this.submodel = sub;
	}

	addEntity(ent: DisplayEntity): void {

		// If NextComponent is not specified, return the entity to the sub-model object
		if (this.nextComponent.isDefault()) {
			this.submodel!.addReturnedEntity(ent);
			return;
		}

		// If NextComponent is specified, send the entity to that object
		const nextComp = this.nextComponent.getNextEntity(this, EventManager.simSeconds());
		if (!(nextComp instanceof Linkable)) {
			this.error("Object '%s' returned by NextComponent does not accept an entity.", String(nextComp));
		}
		(nextComp as unknown as Linkable).addEntity(ent);
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
		try {
			const ent = this.nextComponent.getNextEntity(this, 0.0);
			if (ent != null) {
				ret.push(ent);
			}
		}
		catch (_e) {
			// Java の catch (Exception e) {}
			// TODO(移植): TS ではすべての例外を捕まえる（Java は Error 系を捕まえない）
		}
		return ret;
	}

}

Linkable.register(SubModelEnd);
ClassRegistry.register("com.jaamsim.SubModels.SubModelEnd", SubModelEnd);
