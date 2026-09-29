/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2015 Ausenco Engineering Canada Inc.
 * Copyright (C) 2022 JaamSim Software Inc.
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
import type { JClass } from "../java/lang.ts";
import { Input } from "../internal.ts";
import type { KeywordIndex } from "./KeywordIndex.ts";

// TODO(順番): Java は HashMap。Map は入れた順に回るので、値を順に回す所（toString など）は Java と順番が違う
export class StringKeyInput<T extends Entity> extends Input<Map<string, T | null>> {

	private entClass: JClass<T>;

	constructor(klass: JClass<T>, keyword: string, cat: string) {
		super(keyword, cat, null);
		this.entClass = klass;
	}

	/** @throws InputErrorException */
	override parse(thisEnt: Entity, kw: KeywordIndex): void {
		const hashMap = new Map<string, T | null>();
		const subArgs = kw.getSubArgs();
		for (let i = 0; i < subArgs.length; i++) {
			const subArg = subArgs[i];
			Input.assertCount(subArg, 2);
			const ent = Input.tryParseEntity(thisEnt.getJaamSimModel(), subArg.getArg(1), this.entClass );
			hashMap.set(subArg.getArg(0), ent);
		}
		this.value = hashMap;
	}

	getValueFor(str: string): T | null {
		const val = this.getValue();
		if (val === null)
			return null;
		return val.get(str) ?? null;
	}

}
