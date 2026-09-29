/*
 * JaamSim Discrete Event Simulation
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
import { DisplayEntity } from "../Graphics/DisplayEntity.ts";
import type { Entity } from "../basicsim/Entity.ts";
import { ErrorException } from "../basicsim/ErrorException.ts";
import { Input } from "../input/Input.ts";
import type { KeywordIndex } from "../input/KeywordIndex.ts";
import { Parser } from "../input/Parser.ts";
import type { OutputReturnType } from "../input/OutputRegistry.ts";
import { ClassRegistry } from "../java/ClassRegistry.ts";
import { jformat, jIsAssignableFrom } from "../java/lang.ts";
import type { JClass } from "../java/lang.ts";
import { tr } from "../i18n/I18n.ts";
import type { EntityProvider } from "./EntityProvider.ts";
import { EntityProvConstant } from "./EntityProvConstant.ts";
import { EntityProvExpression } from "./EntityProvExpression.ts";

export class EntityProvInput<T extends Entity> extends Input<EntityProvider<T>> {

	private entClass: JClass<T>;
	private invalidClasses: JClass<Entity>[];

	constructor(aClass: JClass<T>, key: string, cat: string, def: EntityProvider<T> | null) {
		super(key, cat, def);
		this.entClass = aClass;
		this.invalidClasses = [];
	}

	public override applyConditioning(str: string): string {
		return Parser.addQuotesIfNeeded(str);
	}

	/** @throws InputErrorException */
	public override parse(thisEnt: Entity, kw: KeywordIndex): void {
		this.value = Input.parseEntityProvider(kw, thisEnt, this.entClass);
		this.setValid(true);
	}

	public override getValidInputDesc(): string {
		if (this.entClass === (DisplayEntity as unknown as JClass<T>)) {
			return tr(Input.VALID_ENTITY_PROV);
		}
		return jformat(tr(Input.VALID_ENTITY_PROV_TYPE), ClassRegistry.simpleName(this.entClass));
	}

	public override getValidOptions(ent: Entity): string[] {
		const list: string[] = [];

		for (const each of ent.getJaamSimModel().getClonesOfIterator(this.entClass)) {
			if (!each.isRegistered())
				continue;

			if (!this.isValidEntity(each))
				continue;

			list.push(each.getName());
		}
		list.sort(Input.uiSortOrder);
		return list;
	}

	public addInvalidClass(aClass: JClass<Entity>): void {
		this.invalidClasses.push(aClass);
	}

	private isValidEntity(ent: T): boolean {

		for (const cls of this.invalidClasses) {
			if (jIsAssignableFrom(cls, ent.constructor as JClass)) {
				return false;
			}
		}

		return true;
	}

	public override getValueTokens(toks: string[]): void {
		if (this.value === null || this.isDef)
			return;

		toks.push(this.value.toString());
	}

	public override removeReferences(ent: Entity): boolean {
		if (this.value instanceof EntityProvConstant) {
			const epc = this.value as EntityProvConstant<T>;
			if (epc.getEntity() === ent) {
				this.reset();
				return true;
			}
		}
		return false;
	}

	public override appendEntityReferences(list: Entity[]): void {
		if (this.value === null)
			return;
		if (this.value instanceof EntityProvConstant) {
			const ent: Entity | null = (this.value as EntityProvConstant<T>).getEntity();
			if (ent === null || list.includes(ent))
				return;
			list.push(ent);
			return;
		}

		if (this.value instanceof EntityProvExpression) {
			(this.value as EntityProvExpression<T>).appendEntityReferences(list);
			return;
		}
	}

	public override useExpressionBuilder(): boolean {
		return true;
	}

	public override getPresentValueString(thisEnt: Entity, simTime: number): string {
		if (this.value === null)
			return "";

		return jformat("[%s]", this.value.getNextEntity(thisEnt, simTime));
	}

	public getNextEntity(thisEnt: Entity, simTime: number): T | null {
		if (this.getValue() === null)
			return null;
		try {
			return (this.getValue() as EntityProvider<T>).getNextEntity(thisEnt, simTime);
		}
		catch (e) {
			if (e instanceof ErrorException) {
				e.keyword = this.getKeyword();
				throw e;
			}
			throw new ErrorException(thisEnt, this.getKeyword(), e);
		}
	}

	// Java の多重定義 getValue() と getValue(Entity, double, Class<V>) は、引数の数で見分けて 1 つにした。
	// TODO(移植): Input.getValue が同じ形（引数なしなら value、3 つなら式の値）になることを前提にしている。
	public override getValue(): EntityProvider<T> | null;
	public override getValue<V>(thisEnt: Entity, simTime: number, klass: JClass<V> | null): V | null;
	public override getValue<V>(thisEnt?: Entity, simTime?: number, klass?: JClass<V> | null): unknown {
		if (thisEnt === undefined)
			return super.getValue();
		if (this.getValue() === null)
			return null;
		return this.getNextEntity(thisEnt, simTime as number);
	}

	// TODO(移植): Java は Class<?>（Entity.class）を返す。Input.getReturnType の型は OutputRegistry の
	// OutputReturnType の文字列と仮定した（Input の担当が決める）。
	public override getReturnType(): OutputReturnType | null {
		return "Entity";
	}

}
