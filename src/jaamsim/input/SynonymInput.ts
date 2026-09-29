/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2015 Ausenco Engineering Canada Inc.
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
import { Input } from "../internal.ts";
import type { KeywordIndex } from "./KeywordIndex.ts";

export class SynonymInput extends Input<unknown> {
	readonly input: Input<unknown>;

	constructor(key: string, input: Input<unknown>) {
		super(key, input.getCategory(), null);
		this.input = input;
	}

	override isSynonym(): boolean {
		return true;
	}

	/** @throws InputErrorException */
	override parse(thisEnt: Entity, kw: KeywordIndex): void {
		this.input.parse(thisEnt, kw);
	}
}
