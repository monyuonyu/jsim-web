/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2026 JaamSim Software Inc.
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
 *
 * TypeScript への移植 (C) 2026 shota
 */
// 注（多重定義の扱い）:
// - Java は reset(Entity) だけを上書きしている。reset(ent?) の 1 つにし、ent が無ければ基底の reset() と同じ。
import { DisplayEntity } from "../internal.ts";
import { EntityLabel } from "../internal.ts";
import { OverlayEntity } from "../internal.ts";
import { Region } from "../internal.ts";
import { Entity } from "../internal.ts";
import { tr } from "../internal.ts";
import { EntityInput } from "../internal.ts";
import { Input } from "../internal.ts";
import { InputErrorException } from "../internal.ts";
import type { KeywordIndex } from "./KeywordIndex.ts";

export class ParentEntityInput extends EntityInput<Entity> {

	constructor(key: string, cat: string, def: Entity | null) {
		super(Entity, key, cat, def);
	}

	/** @throws InputErrorException */
	override parse(thisEnt: Entity, kw: KeywordIndex): void {
		Input.assertCount(kw, 1);
		const tmp: Entity | null = Input.parseEntity(thisEnt.getJaamSimModel(), kw.getArg(0), Entity);
		if (tmp === null)
			throw new InputErrorException(tr(Input.INP_ERR_ENTNAME), tmp);

		const localName = thisEnt.getLocalName() as string;
		if (tmp.getChild(localName) !== null)
			throw new InputErrorException(tr("Entity %s already has a child entity named %s.%n"
					+ "Change the new child's name before assigning it to this parent entity."),
					tmp, localName);

		if (ParentEntityInput.isCircular(thisEnt, tmp))
			throw new InputErrorException(tr("The assignment of %s to Parent would create a circular loop."), tmp);
		this.value = tmp;
	}

	private static isCircular(thisEnt: Entity, e: Entity | null): boolean {
		let ent = e;
		while (ent !== null) {
			if (ent === thisEnt)
				return true;
			ent = ent.getParent();
		}
		return false;
	}

	override getValidOptions(ent: Entity): string[] | null {
		const list: string[] = [];
		for (const each of ent.getJaamSimModel().getClonesOfIterator(DisplayEntity)) {
			if (!each.isRegistered())
				continue;

			if (each instanceof OverlayEntity || each instanceof Region || each instanceof EntityLabel)
				continue;

			if (ParentEntityInput.isCircular(ent, each))
				continue;

			if (each !== ent.getParent() && each.getChild(ent.getLocalName() as string) !== null)
				continue;

			list.push(each.getName());
		}
		list.sort((a, b) => Input.uiSortOrder.compare(a, b));
		return list;
	}

	override isEdited(): boolean {
		// Parent name inputs are not saved to the configuration file
		return false;
	}

	setInitialValue(newParent: Entity | null): void {
		this.value = newParent;
		let name = "";
		if (newParent !== null)
			name = newParent.getName();
		this.valueTokens = [name];
		this.isDef = false;
	}

	override reset(ent?: Entity): void {
		if (ent === undefined) {
			super.reset();
			return;
		}
		const localName = ent.getLocalName() as string;
		if (ent.getParent() !== null && ent.getJaamSimModel().getEntity(localName) !== null)
			throw new InputErrorException(tr("Entity named %s already exists.%n"
					+ "Change the entity's name before deleting its 'Parent' input."),
					localName);
		super.reset();
	}

}
