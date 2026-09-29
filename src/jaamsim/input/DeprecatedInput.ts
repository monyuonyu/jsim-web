/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2010-2011 Ausenco Engineering Canada Inc.
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
import type { Entity } from "../basicsim/Entity.ts";
import { tr } from "../i18n/I18n.ts";
import { Input } from "./Input.ts";
import { InputErrorException } from "./InputErrorException.ts";
import type { KeywordIndex } from "./KeywordIndex.ts";

export class DeprecatedInput extends Input<string> {
	private fatal: boolean;

	constructor(key: string, msg: string) {
		super(key, "", "");
		this.value = msg;
		this.fatal = true;
	}

	setFatal(fatal: boolean): void {
		this.fatal = fatal;
	}

	/** @throws InputErrorException */
	override parse(thisEnt: Entity, kw: KeywordIndex): void {
		// Java は value を書式として渡す（引数なし）
		if (this.fatal)
			throw new InputErrorException(tr(this.value as string));

		thisEnt.getJaamSimModel().logWarning("%s - %s", this.getKeyword(), this.value);
	}
}
