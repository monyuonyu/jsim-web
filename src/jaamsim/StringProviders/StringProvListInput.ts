/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2015 Ausenco Engineering Canada Inc.
 * Copyright (C) 2017-2026 JaamSim Software Inc.
 * TypeScript への移植 (C) 2026 shota
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
 */

// 多重定義:
// - getNextString(int i, double simTime) と getNextString(int i, Entity thisEnt, double simTime) は、引数の数で見分ける。
// - Input.getValue() と getValue(Entity, double, Class) は、引数の数で見分ける（Input.ts と同じく thisEnt の有無）。

import { Entity } from "../basicsim/Entity.ts";
import { ErrorException } from "../basicsim/ErrorException.ts";
import type { JaamSimModel } from "../basicsim/JaamSimModel.ts";
import { ArrayListInput } from "../input/ArrayListInput.ts";
import { Input } from "../input/Input.ts";
import type { OutputReturnType } from "../input/OutputRegistry.ts";
import { InputErrorException } from "../input/InputErrorException.ts";
import type { KeywordIndex } from "../input/KeywordIndex.ts";
import { Parser } from "../input/Parser.ts";
import { isSampleProvider } from "../Samples/SampleProvider.ts";
import type { SampleProvider } from "../Samples/SampleProvider.ts";
import { DimensionlessUnit } from "../units/DimensionlessUnit.ts";
import { tr } from "../i18n/I18n.ts";
import { jformat } from "../java/lang.ts";
import type { JClass } from "../java/lang.ts";
import { StringProvExpression } from "./StringProvExpression.ts";
import { StringProvSample } from "./StringProvSample.ts";
import type { StringProvider } from "./StringProvider.ts";

export class StringProvListInput extends ArrayListInput<StringProvider> {

	constructor(key: string, cat: string, def: StringProvider[] | null) {
		super(key, cat, def);
	}

	override applyConditioning(str: string): string {
		return Parser.addSubstringQuotesIfNeeded(str);
	}

	/** @throws InputErrorException */
	override parse(thisEnt: Entity, kw: KeywordIndex): void {
		const subArgs = kw.getSubArgs();
		const temp: StringProvider[] = [];
		for (let i = 0; i < subArgs.length; i++) {
			const subArg = subArgs[i];
			try {
				const sp = Input.parseStringProvider(subArg, thisEnt, DimensionlessUnit);
				temp.push(sp);
			}
			catch (e) {
				if (!(e instanceof InputErrorException)) throw e;
				let msg = e.getMessage();
				if (subArg.numArgs() > 1)
					msg = jformat(tr(Input.INP_ERR_ELEMENT), i + 1, e.getMessage());
				throw new InputErrorException(e.position, e.source, msg, e);
			}
		}
		this.value = temp;
		this.setValid(true);
	}

	override getValidInputDesc(): string {
		return tr(Input.VALID_STRING_PROV_LIST);
	}

	override getValidOptions(ent: Entity): string[] {
		const list: string[] = [];
		const simModel = ent.getJaamSimModel();
		// Java: simModel.getClonesOfIterator(Entity.class, SampleProvider.class)
		for (const each of simModel.getClonesOfIterator(Entity) as Iterable<Entity>) {
			if (!isSampleProvider(each))
				continue;
			const samp: SampleProvider = each;
			if (samp.getUnitType() === DimensionlessUnit)
				list.push(each.getName());
		}
		list.sort((a, b) => Input.uiSortOrder.compare(a, b));
		return list;
	}

	override getValueTokens(toks: string[]): void {
		if (this.value === null || this.isDef)
			return;

		for (let i = 0; i < this.value.length; i++) {
			toks.push("{");
			toks.push(this.value[i].toString());
			toks.push("}");
		}
	}

	override getDefaultString(simModel: JaamSimModel): string {
		if (this.defValue === null || this.defValue.length === 0) {
			return "";
		}

		let tmp = "";
		for (let i = 0; i < this.defValue.length; i++) {
			if (i > 0)
				tmp += Input.SEPARATOR;

			tmp += "{ ";
			tmp += String(this.defValue[i]);
			tmp += " }";
		}

		return tmp;
	}

	override removeReferences(ent: Entity): boolean {
		if (this.value === null)
			return false;

		const list: StringProvider[] = [];
		for (const samp of this.value) {
			if (samp instanceof StringProvSample) {
				const spsamp: StringProvSample = samp;
				if ((spsamp.getSampleProvider() as unknown) === ent) {
					list.push(samp);
				}
			}
		}
		// value.removeAll(list)（同じ配列の中で消す）
		let ret = false;
		for (let i = this.value.length - 1; i >= 0; i--) {
			if (list.includes(this.value[i])) {
				this.value.splice(i, 1);
				ret = true;
			}
		}
		return ret;
	}

	override appendEntityReferences(list: Entity[]): void {
		if (this.value === null)
			return;
		for (const sp of this.value) {
			if (sp instanceof Entity) {
				const entref: Entity = sp;
				if (list.includes(entref))
					continue;
				list.push(entref);
				continue;
			}

			if (sp instanceof StringProvExpression) {
				sp.appendEntityReferences(list);
			}
		}
	}

	override useExpressionBuilder(): boolean {
		return true;
	}

	override getPresentValueString(thisEnt: Entity, simTime: number): string {
		if (this.value === null)
			return "";

		let sb = "";
		for (let i = 0; i < this.value.length; i++) {
			if (i > 0)
				sb += Input.BRACE_SEPARATOR;
			sb += "{" + Input.BRACE_SEPARATOR;
			sb += this.getNextString(i, thisEnt, simTime);
			sb += Input.BRACE_SEPARATOR + "}";
		}
		return sb;
	}

	getNextString(i: number, simTime: number): string;
	getNextString(i: number, thisEnt: Entity | null, simTime: number): string;
	getNextString(i: number, a: Entity | null | number, b?: number): string {
		// getNextString(int i, double simTime) → getNextString(i, null, simTime)
		if (b === undefined)
			return this.getNextString(i, null, a as number);

		const thisEnt = a as Entity | null;
		const simTime = b;
		try {
			return this.getValue()[i].getNextString(thisEnt, simTime);
		}
		catch (e) {
			if (e instanceof ErrorException) {
				e.keyword = this.getKeyword();
				e.index = i + 1;
				throw e;
			}
			throw new ErrorException(thisEnt, this.getKeyword(), i + 1, e as Error);
		}
	}

	getNextValue(i: number, thisEnt: Entity | null, simTime: number): number {
		try {
			return this.getValue()[i].getNextValue(thisEnt, simTime);
		}
		catch (e) {
			if (e instanceof ErrorException) {
				e.keyword = this.getKeyword();
				e.index = i + 1;
				throw e;
			}
			throw new ErrorException(thisEnt, this.getKeyword(), i + 1, e as Error);
		}
	}

	getNextStrings(thisEnt: Entity | null, simTime: number): string[] {
		const ret = new Array<string>(this.getListSize()).fill("");
		for (let i = 0; i < this.getListSize(); i++) {
			ret[i] = this.getNextString(i, thisEnt, simTime);
		}
		return ret;
	}

	override getValue(): StringProvider[];
	override getValue<V>(thisEnt: Entity, simTime: number, klass: JClass<V> | OutputReturnType | null): V | null;
	override getValue(thisEnt?: Entity, simTime?: number, klass?: unknown): unknown {
		// Input と同じく、thisEnt の有無で getValue() と getValue(thisEnt, simTime, klass) を見分ける
		if (thisEnt === undefined)
			return super.getValue();
		return this.getNextStrings(thisEnt, simTime as number);
	}

	override getReturnType(): OutputReturnType | null {
		// TODO(移植): OutputRegistry の OutputReturnType に "String[]" が無い（OutputRegistry の担当に足してもらう）
		return "String[]" as OutputReturnType;
	}

}
