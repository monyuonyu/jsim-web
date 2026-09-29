/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2024 JaamSim Software Inc.
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
import type { Entity } from "../basicsim/Entity.ts";
import { tr } from "../internal.ts";
import { ClassRegistry } from "../internal.ts";
import { Input } from "../internal.ts";
import { InputAgent } from "../internal.ts";
import { InputErrorException } from "../internal.ts";
import type { KeywordIndex } from "./KeywordIndex.ts";

export class EntityNameInput extends Input<string> {

	constructor(key: string, cat: string, def: string | null) {
		super(key, cat, def);
	}

	/** @throws InputErrorException */
	override parse(thisEnt: Entity, kw: KeywordIndex): void {
		Input.assertCount(kw, 1);

		const localName = kw.getArg(0);
		if (!this.isDef) {

			// Check that the entity was defined AFTER the RecordEdits command
			if (!thisEnt.isAdded())
				throw new InputErrorException(tr("Cannot rename an entity that was defined before the "
						+ "RecordEdits command."));

			// Check that the new name is valid
			if (!InputAgent.isValidName(localName))
				throw new InputErrorException(tr(InputAgent.INP_ERR_BADNAME), localName);

			// Get the new absolute name
			let name = localName;
			const parent = thisEnt.getParent();
			if (parent !== null)
				name = parent.getName() + "." + localName;

			// Check that the new absolute name does not conflict with another entity
			const ent = thisEnt.getJaamSimModel().getNamedEntity(name);
			if (ent !== null && ent !== thisEnt)
				throw new InputErrorException(tr(InputAgent.INP_ERR_DEFINEUSED), name,
						ClassRegistry.simpleName(ent));
		}

		this.value = localName;
	}

	override getValidInputDesc(): string {
		return tr(Input.VALID_ENTITY_NAME);
	}

	override isEdited(): boolean {
		// Name inputs are not saved to the configuration file
		return false;
	}

	setInitialValue(name: string): void {
		this.value = name;
		this.valueTokens = [name];
		this.isDef = false;
	}

}
