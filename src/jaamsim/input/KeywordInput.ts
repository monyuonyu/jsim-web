/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2015 Ausenco Engineering Canada Inc.
 * Copyright (C) 2021 JaamSim Software Inc.
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
import { DisplayEntity } from "../Graphics/DisplayEntity.ts";
import type { Entity } from "../basicsim/Entity.ts";
import { tr } from "../i18n/I18n.ts";
import { Input } from "./Input.ts";
import { InputErrorException } from "./InputErrorException.ts";
import type { KeywordIndex } from "./KeywordIndex.ts";

export class KeywordInput extends Input<string> {
	private targetEntity: DisplayEntity | null;
	private targetInput: Input<unknown> | null;

	constructor(key: string, cat: string, def: string | null) {
		super(key, cat, def);
		this.targetEntity = null;
		this.targetInput = null;
	}

	/** @throws InputErrorException */
	override parse(thisEnt: Entity, kw: KeywordIndex): void {
		Input.assertCount(kw, 2);
		try {
			const ent = Input.parseEntity(thisEnt.getJaamSimModel(), kw.getArg(0), DisplayEntity);

			const key = kw.getArg(1);
			const inp = ent.getInput(key);
			if (inp === null)
				throw new InputErrorException(tr("'%s' is not a valid keyword for entity '%s'"), key, ent);

			this.value = key;
			this.targetEntity = ent;
			this.targetInput = inp;
		}
		catch (e) {
			if (!(e instanceof InputErrorException))
				throw e;
			// Java も、元のメッセージを書式として使う（new InputErrorException(e.getMessage())）
			throw new InputErrorException(e.getMessage() as string);
		}
	}

	getTargetInput(): Input<unknown> | null {
		return this.targetInput;
	}

	getTargetEntity(): DisplayEntity | null {
		return this.targetEntity;
	}

	override getValueTokens(toks: string[]): void {
		if (this.value === null || this.isDef)
			return;
		toks.push((this.targetEntity as DisplayEntity).getName());
		toks.push(this.value);
	}

}
