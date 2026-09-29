/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2012 Ausenco Engineering Canada Inc.
 * Copyright (C) 2023-2026 JaamSim Software Inc.
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
// - getValue() と getValue(thisEnt, simTime, klass) は、引数の数で見分けて 1 つにした（Input.ts と同じ）。
// - Java の Class<T>（enum）は JEnumClass<T>（Input.ts）。
import type { Entity } from "../basicsim/Entity.ts";
import type { JClass } from "../java/lang.ts";
import { enumConstants, enumName, Input } from "./Input.ts";
import type { JEnumClass } from "./Input.ts";
import type { KeywordIndex } from "./KeywordIndex.ts";
import type { OutputReturnType } from "./OutputRegistry.ts";


export class EnumInput<T> extends Input<T> {
	private readonly type: JEnumClass<T>;

	constructor(atype: JEnumClass<T>, key: string, cat: string, def: T | null) {
		super(key, cat, def);
		this.type = atype;
	}

	/** @throws InputErrorException */
	override parse(thisEnt: Entity, kw: KeywordIndex): void {
		Input.assertCount(kw, 1);
		this.value = Input.parseEnum(this.type, kw.getArg(0));
	}

	override getValidOptions(ent: Entity | null): string[] | null {
		const tmp: string[] = [];
		for (const each of enumConstants(this.type))
			tmp.push(enumName(this.type, each));
		return tmp;
	}

	override getExamples(): string[] {
		// Java は長さ 1 の配列（定数が無ければ中は null）
		const ret: (string | null)[] = [null];
		const array = enumConstants(this.type);
		if (array.length > 0)
			ret[0] = enumName(this.type, array[0]);
		return ret as string[];
	}

	override getValue(): T | null;
	override getValue<V>(thisEnt: Entity, simTime: number, klass: JClass<V> | OutputReturnType | null): V | null;
	override getValue(thisEnt?: Entity, simTime?: number, klass?: unknown): unknown {
		if (thisEnt === undefined)
			return super.getValue();
		const val = this.getValue();
		if (val === null)
			return "";
		// Java の toString()（上書きしていなければ name()）
		return String(val);
	}

	override getReturnType(): OutputReturnType | null {
		return "String";
	}

}
