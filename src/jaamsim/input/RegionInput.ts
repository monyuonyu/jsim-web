/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2019 JaamSim Software Inc.
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
import { Region } from "../internal.ts";
import type { Entity } from "../basicsim/Entity.ts";
import { tr } from "../internal.ts";
import { EntityInput } from "../internal.ts";
import { Input } from "../internal.ts";
import { InputErrorException } from "../internal.ts";
import type { KeywordIndex } from "./KeywordIndex.ts";

export class RegionInput extends EntityInput<Region> {

	constructor(key: string, cat: string, def: Region | null) {
		super(Region, key, cat, def);
	}

	/** @throws InputErrorException */
	override parse(thisEnt: Entity, kw: KeywordIndex): void {
		Input.assertCount(kw, 1);
		const reg = Input.parseEntity(thisEnt.getJaamSimModel(), kw.getArg(0), Region);
		if (thisEnt instanceof Region && this.isCircular(thisEnt, reg))
			throw new InputErrorException(tr("The assignment of %s to Region would create a circular loop."), reg);
		this.value = reg;
	}

	private isCircular(thisReg: Region, r: Region | null): boolean {
		let reg = r;
		while (reg !== null) {
			if (reg === thisReg)
				return true;
			reg = reg.getCurrentRegion();
		}
		return false;
	}

	override getValidOptions(ent: Entity): string[] {
		const list: string[] = [];
		const simModel = ent.getJaamSimModel();
		for (const each of simModel.getClonesOfIterator(Region)) {
			if (each.isGenerated())
				continue;

			if (ent instanceof Region && this.isCircular(ent, each))
				continue;

			list.push(each.getName());
		}
		list.sort((a, b) => Input.uiSortOrder.compare(a, b));
		return list;
	}

}
