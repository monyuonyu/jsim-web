/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2010-2011 Ausenco Engineering Canada Inc.
 * Copyright (C) 2021-2026 JaamSim Software Inc.
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
import type { Entity } from "../basicsim/Entity.ts";
import type { JaamSimModel } from "../basicsim/JaamSimModel.ts";
import { jformat } from "../internal.ts";
import type { JClass } from "../java/lang.ts";
import { Input } from "../internal.ts";
import type { KeywordIndex } from "./KeywordIndex.ts";
import type { OutputReturnType } from "./OutputRegistry.ts";
import { Parser } from "../internal.ts";


export class StringChoiceInput extends Input<number> {
	// Java の初期化ブロック（choices = new ArrayList<>()）。基底のコンストラクタからは触らない
	private choices: string[] = [];

	constructor(key: string, cat: string, def: number | null) {
		super(key, cat, def);
	}

	override applyConditioning(str: string): string {
		return Parser.addQuotesIfNeeded(str);
	}

	/** @throws InputErrorException */
	override parse(thisEnt: Entity, kw: KeywordIndex): void {
		Input.assertCount(kw, 1);
		const temp = Input.parseString(kw.getArg(0), this.choices);
		this.value = this.choices.indexOf( temp );
	}

	addChoice(choice: string): void {
		if (!this.choices.includes(choice))
			this.choices.push(choice);
	}

	getChoice(): string {
		// Java では値が null なら NullPointerException、範囲の外なら IndexOutOfBoundsException
		return listGet(this.choices, this.getValue() as number);
	}

	getDefaultChoice(): string {
		// Java では defValue が null なら NullPointerException
		if ((this.defValue as number) === -1)
			return "";
		return listGet(this.choices, this.defValue as number);
	}

	setChoices(list: string[]): void {
		this.choices = list;
	}

	override getValidOptions(ent: Entity | null): string[] | null {
		return this.choices;
	}

	override getDefaultString(simModel: JaamSimModel | null): string {
		if (this.getDefaultChoice().length === 0)
			return "";

		return jformat("%s", this.getDefaultChoice());
	}

	override getValue(): number | null;
	override getValue<V>(thisEnt: Entity, simTime: number, klass: JClass<V> | OutputReturnType | null): V | null;
	override getValue(thisEnt?: Entity, simTime?: number, klass?: unknown): unknown {
		if (thisEnt === undefined)
			return super.getValue();
		if (this.getIsDef())
			return this.getDefaultChoice();
		return this.getChoice();
	}

	override getReturnType(): OutputReturnType | null {
		return "String";
	}
}

/** Java の ArrayList.get（範囲の外なら例外） */
function listGet(list: string[], index: number): string {
	if (index === null || index === undefined)
		throw new TypeError("Cannot read the value: null");
	if (index < 0 || index >= list.length)
		throw new RangeError("Index " + index + " out of bounds for length " + list.length);
	return list[index];
}
