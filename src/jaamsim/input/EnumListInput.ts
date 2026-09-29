/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2017-2022 JaamSim Software Inc.
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
// 注: Java の Class<T>（enum）は JEnumClass<T>（Input.ts）。
import type { Entity } from "../basicsim/Entity.ts";
import { ArrayListInput } from "../internal.ts";
import { enumConstants, enumName, Input } from "../internal.ts";
import type { JEnumClass } from "./Input.ts";
import type { KeywordIndex } from "./KeywordIndex.ts";

export class EnumListInput<T> extends ArrayListInput<T> {

	private readonly type: JEnumClass<T>;

	constructor(atype: JEnumClass<T>, key: string, cat: string, def: T[] | null) {
		super(key, cat, def);
		this.type = atype;
	}

	/** @throws InputErrorException */
	override parse(thisEnt: Entity, kw: KeywordIndex): void {
		this.value = Input.parseEnumList(this.type, kw);
	}

	override getValidOptions(ent: Entity | null): string[] | null {
		const tmp: string[] = [];
		for (const each of enumConstants(this.type))
			tmp.push(enumName(this.type, each));
		return tmp;
	}

}
