/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2011 Ausenco Engineering Canada Inc.
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
import type { Entity } from "../basicsim/Entity.ts";
import type { JaamSimModel } from "../basicsim/JaamSimModel.ts";
import { jRemove } from "../internal.ts";
import { ArrayListInput } from "../internal.ts";
import { Input } from "../internal.ts";
import type { KeywordIndex } from "./KeywordIndex.ts";
import type { OutputReturnType } from "./OutputRegistry.ts";


export class StringListInput extends ArrayListInput<string> {
	private validOptions: string[] | null;

	 // If true convert all the the items to uppercase
	private caseSensitive: boolean;

	constructor(key: string, cat: string, def: string[] | null) {
		super(key, cat, def);
		this.validOptions = null;
		this.caseSensitive = true;
	}

	/** @throws InputErrorException */
	override parse(thisEnt: Entity, kw: KeywordIndex): void {

		// If adding to the list
		if (kw.getArg( 0 ) === "++") {
			const input: string[] = [];
			for (let i = 1; i < kw.numArgs(); i++) {
				if (this.validOptions === null)
					input.push(kw.getArg(i));
				else
					input.push(Input.parseString(kw.getArg(i), this.validOptions, this.caseSensitive));
			}

			let newValue: string[];
			if (this.value === null)
				newValue = [];
			else
				newValue = [...this.value];

			Input.assertCountRange(input, 0, this.maxCount - newValue.length);

			newValue.push(...input);
			this.value = newValue;
		}
		// If removing from the list
		else if (kw.getArg( 0 ) === "--") {
			const input: string[] = [];
			for (let i = 1; i < kw.numArgs(); i++) {
				if (this.validOptions === null)
					input.push(kw.getArg(i));
				else
					input.push(Input.parseString(kw.getArg(i), this.validOptions, this.caseSensitive));
			}

			// Java では value が null なら NullPointerException（ここでも TypeError になる）
			const value = this.value as string[];
			Input.assertCountRange(input, 0, value.length - this.minCount );

			const newValue = [...value];
			for (const val of input) {
				if (! newValue.includes( val ))
					thisEnt.getJaamSimModel().logWarning("Could not remove " + val + " from " + this.getKeyword() );
				jRemove(newValue, val);
			}
			this.value = newValue;
		}
		// Otherwise, just set the list normally
		else {
			Input.assertCountRange(kw, this.minCount, this.maxCount);
			if (this.validOptions !== null) {
				this.value = Input.parseStrings(kw, this.validOptions, this.caseSensitive);
				return;
			}

			const tmp: string[] = [];
			for (let i = 0; i < kw.numArgs(); i++) {
				tmp.push(kw.getArg(i));
			}
			this.value = tmp;
		}
	}

	override setTokens(kw: KeywordIndex): void {
		this.isDef = false;

		const args = kw.getArgArray();
		if (args.length > 0) {

			// Consider the following input case:
			// Object1 Keyword1 { ++ String1 ...
			if (args[0] === "++") {
				this.addTokens(args);
				return;
			}

			// Consider the following input case:
			// Object1 Keyword1 { -- String1 ...
			if (args[0] === "--") {
				if (this.removeTokens(args))
					return;
			}
		}

		this.valueTokens = args;
	}

	setValidOptions(list: string[] | null): void {
		this.validOptions = list;
	}

	setCaseSensitive(bool: boolean): void {
		this.caseSensitive = bool;
	}

	getCaseSensitive(): boolean {
		return this.caseSensitive;
	}

	override getValidOptions(ent: Entity | null): string[] | null {
		return this.validOptions;
	}

	override getDefaultString(simModel: JaamSimModel | null): string {
		if (this.defValue === null || this.defValue.length === 0)
			return "";

		let tmp = this.defValue[0];
		for (let i = 1; i < this.defValue.length; i++) {
			tmp += Input.SEPARATOR;
			tmp += this.defValue[i];
		}

		return tmp;
	}

	override getReturnType(): OutputReturnType | null {
		return "ArrayList";
	}
}
