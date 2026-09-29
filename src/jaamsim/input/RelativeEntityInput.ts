/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2015 Ausenco Engineering Canada Inc.
 * Copyright (C) 2019-2026 JaamSim Software Inc.
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
import { EntityProvConstant } from "../internal.ts";
import { EntityProvInput } from "../internal.ts";
import type { EntityProvider } from "../EntityProviders/EntityProvider.ts";
import { DisplayEntity } from "../internal.ts";
import { EntityLabel } from "../internal.ts";
import { OverlayEntity } from "../internal.ts";
import { Region } from "../internal.ts";
import type { Entity } from "../basicsim/Entity.ts";
import { tr } from "../internal.ts";
import { Input } from "../internal.ts";
import { InputErrorException } from "../internal.ts";
import type { KeywordIndex } from "./KeywordIndex.ts";

export class RelativeEntityInput extends EntityProvInput<DisplayEntity> {
	constructor(key: string, cat: string, def: EntityProvider<DisplayEntity> | null) {
		super(DisplayEntity, key, cat, def);
	}

	/** @throws InputErrorException */
	override parse(thisEnt: Entity, kw: KeywordIndex): void {
		const temp = Input.parseEntityProvider(kw, thisEnt, DisplayEntity);
		if (temp instanceof EntityProvConstant) {
			const ent = temp.getNextEntity(thisEnt, 0.0);
			if (RelativeEntityInput.isCircular(thisEnt, ent)) {
				throw new InputErrorException(tr("The assignment of %s to RelativeEntity would create a circular loop."), ent);
			}
		}
		this.setValid(true);
		this.value = temp;
	}

	private static isCircular(thisEnt: Entity, e: DisplayEntity | null): boolean {
		let ent = e;
		while (ent !== null) {
			if (ent === thisEnt)
				return true;
			ent = ent.getRelativeEntity();
		}
		return false;
	}

	override getValidOptions(ent: Entity): string[] {
		const list: string[] = [];
		const simModel = ent.getJaamSimModel();
		for (const each of simModel.getClonesOfIterator(DisplayEntity)) {
			if (each.isGenerated())
				continue;

			if (each instanceof OverlayEntity || each instanceof Region || each instanceof EntityLabel)
				continue;

			if (RelativeEntityInput.isCircular(ent, each))
				continue;

			list.push(each.getName());
		}
		list.sort((a, b) => Input.uiSortOrder.compare(a, b));
		return list;
	}

}
