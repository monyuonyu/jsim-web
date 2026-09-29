/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2023-2026 JaamSim Software Inc.
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
import { DisplayEntity } from "../Graphics/DisplayEntity.ts";
import type { Entity } from "../basicsim/Entity.ts";
import { ErrorException } from "../basicsim/ErrorException.ts";
import type { JaamSimModel } from "../basicsim/JaamSimModel.ts";
import { ArrayListInput } from "../input/ArrayListInput.ts";
import { Input } from "../input/Input.ts";
import { InputErrorException } from "../input/InputErrorException.ts";
import { KeywordIndex } from "../input/KeywordIndex.ts";
import { Parser } from "../input/Parser.ts";
import type { OutputReturnType } from "../input/OutputRegistry.ts";
import { ClassRegistry } from "../java/ClassRegistry.ts";
import { jformat } from "../java/lang.ts";
import type { JClass } from "../java/lang.ts";
import { tr } from "../i18n/I18n.ts";
import type { EntityListProvider } from "./EntityListProvider.ts";
import { EntityProvConstant } from "./EntityProvConstant.ts";
import { EntityProvExpression } from "./EntityProvExpression.ts";

export class EntityProvListInput<T extends Entity> extends ArrayListInput<EntityListProvider<T>> {

	private entClass: JClass<T>;
	private unique: boolean; // flag to determine if list must be unique or not

	constructor(aClass: JClass<T>, key: string, cat: string, def: EntityListProvider<T>[] | null) {
		super(key, cat, def);
		this.entClass = aClass;
		this.unique = true;
	}

	public override applyConditioning(str: string): string {
		if (!str.includes("{")) {
			return str;
		}
		return Parser.addSubstringQuotesIfNeeded(str);
	}

	/** @throws InputErrorException */
	public override parse(thisEnt: Entity, kw: KeywordIndex): void {
		const subArgs: KeywordIndex[] = kw.getSubArgs();

		// Simple format without inner braces
		if (subArgs.length === 1) {
			const subArg: KeywordIndex = subArgs[0];
			const temp: EntityListProvider<T>[] = [];
			for (let i = 0; i < subArg.numArgs(); i++) {
				const argKw = new KeywordIndex(subArg, i, i + 1);
				try {
					const ep: EntityListProvider<T> = Input.parseEntityListProvider(argKw, thisEnt, this.entClass);
					temp.push(ep);
				}
				catch (e) {
					if (!(e instanceof InputErrorException))
						throw e;
					let msg = e.getMessage();
					if (subArg.numArgs() > 1)
						msg = jformat(tr(Input.INP_ERR_ELEMENT), i + 1, e.getMessage());
					throw new InputErrorException(e.position, e.source, msg, e);
				}
			}
			this.value = temp;
			this.setValid(true);
			return;
		}

		// Normal format with inner braces
		const temp: EntityListProvider<T>[] = [];
		for (let i = 0; i < subArgs.length; i++) {
			const subArg: KeywordIndex = subArgs[i];
			try {
				const ep: EntityListProvider<T> = Input.parseEntityListProvider(subArg, thisEnt, this.entClass);
				temp.push(ep);
			}
			catch (e) {
				if (!(e instanceof InputErrorException))
					throw e;
				let msg = e.getMessage();
				if (subArg.numArgs() > 1)
					msg = jformat(tr(Input.INP_ERR_ELEMENT), i + 1, e.getMessage());
				throw new InputErrorException(e.position, e.source, msg, e);
			}
		}
		this.value = temp;
		this.setValid(true);
	}

	public override getValidInputDesc(): string {
		if (this.entClass === (DisplayEntity as unknown as JClass<T>)) {
			return tr(Input.VALID_ENTITY_PROV_LIST);
		}
		return jformat(tr(Input.VALID_ENTITY_PROV_LIST_TYPE), ClassRegistry.simpleName(this.entClass));
	}

	public override getExamples(): string[] {
		let name = ClassRegistry.simpleName(this.entClass);
		if (this.entClass === (DisplayEntity as unknown as JClass<T>)) {
			name = "Entity";
		}
		return [name + "1 " + name + "2",
				"{ " + name + "1 } { " + name + "2 }",
				"{ this.attrib1 } { this.attrib2 }"];
	}

	public setUnique(unique: boolean): void {
		this.unique = unique;
	}

	public override getValidOptions(ent: Entity): string[] {
		const list: string[] = [];
		const simModel: JaamSimModel = ent.getJaamSimModel();
		for (const each of simModel.getClonesOfIterator(this.entClass)) {
			list.push(each.getName());
		}
		list.sort(Input.uiSortOrder);
		return list;
	}

	public override getValueTokens(toks: string[]): void {
		if (this.value === null || this.valueTokens === null || this.isDef)
			return;

		const braces: boolean = this.valueTokens[0] === "{";
		for (let i = 0; i < this.value.length; i++) {
			if (braces) {
				toks.push("{");
			}
			toks.push(this.value[i].toString());
			if (braces) {
				toks.push("}");
			}
		}
	}

	public override removeReferences(ent: Entity): boolean {
		if (this.value === null)
			return false;
		let ret = false;
		for (let i = this.value.length - 1; i >= 0; i--) {
			const ep: EntityListProvider<T> = this.value[i];
			if (ep instanceof EntityProvConstant
					&& (ep as EntityProvConstant<T>).getEntity() === ent) {
				this.value.splice(i, 1);
				ret = true;
			}
		}
		return ret;
	}

	public override appendEntityReferences(list: Entity[]): void {
		if (this.value === null)
			return;
		for (const ep of this.value) {
			if (ep instanceof EntityProvConstant) {
				const ent: Entity | null = (ep as EntityProvConstant<T>).getEntity();
				if (ent === null || list.includes(ent))
					continue;
				list.push(ent);
			}

			else if (ep instanceof EntityProvExpression) {
				(ep as EntityProvExpression<T>).appendEntityReferences(list);
			}
		}
	}

	public override useExpressionBuilder(): boolean {
		return true;
	}

	public override getPresentValueString(thisEnt: Entity, simTime: number): string {
		if (this.value === null)
			return "";

		let sb = "";
		sb += "{" + Input.BRACE_SEPARATOR;
		let first = true;
		for (const ent of this.getNextEntityList(thisEnt, simTime)) {
			if (!first) {
				sb += ", ";
			}
			first = false;
			sb += jformat("[%s]", ent);
		}
		sb += Input.BRACE_SEPARATOR + "}";
		return sb;
	}

	public getNextEntityList(thisEnt: Entity, simTime: number): T[] {
		const ret: T[] = [];
		for (let i = 0; i < this.getListSize(); i++) {
			try {
				(this.getValue() as EntityListProvider<T>[])[i].getNextEntityList(thisEnt, simTime, ret, this.unique);
			}
			catch (e) {
				if (e instanceof ErrorException) {
					e.keyword = this.getKeyword();
					e.index = i + 1;
					throw e;
				}
				throw new ErrorException(thisEnt, this.getKeyword(), i + 1, e);
			}
		}
		return ret;
	}

	// Java の多重定義 getValue() と getValue(Entity, double, Class<V>) は、引数の数で見分けて 1 つにした。
	// TODO(移植): Input.getValue が同じ形（引数なしなら value、3 つなら式の値）になることを前提にしている。
	public override getValue(): EntityListProvider<T>[] | null;
	public override getValue<V>(thisEnt: Entity, simTime: number, klass: JClass<V> | null): V | null;
	public override getValue<V>(thisEnt?: Entity, simTime?: number, klass?: JClass<V> | null): unknown {
		if (thisEnt === undefined)
			return super.getValue();
		return this.getNextEntityList(thisEnt, simTime as number);
	}

	// TODO(移植): Java は Class<?>（ArrayList.class）を返す。OutputReturnType の文字列と仮定した。
	public override getReturnType(): OutputReturnType | null {
		return "ArrayList";
	}

}
