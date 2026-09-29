/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2016-2026 JaamSim Software Inc.
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
// 注: Java の Class<T>（interface のことが多い）は JClass<T> | JInterface<T>（Input.ts）で受ける。
import { Entity } from "../basicsim/Entity.ts";
import { tr } from "../i18n/I18n.ts";
import { ClassRegistry } from "../java/ClassRegistry.ts";
import { jformat } from "../java/lang.ts";
import type { JClass } from "../java/lang.ts";
import { Input } from "./Input.ts";
import type { JInterface } from "./Input.ts";
import type { KeywordIndex } from "./KeywordIndex.ts";
import type { OutputReturnType } from "./OutputRegistry.ts";

/** Class.getSimpleName（JInterface なら javaName の最後） */
export function interfaceSimpleName(klass: JClass | JInterface): string {
	if (typeof klass === "function")
		return ClassRegistry.simpleName(klass);
	const n = klass.javaName;
	return n.slice(n.lastIndexOf(".") + 1);
}

/** JaamSimModel.getClonesOfIterator(proto, iface) に渡す判定の関数（Java の Class<?> iface の代わり） */
export function interfacePredicate(klass: JClass | JInterface): (o: unknown) => boolean {
	if (typeof klass === "function")
		return (o: unknown) => o instanceof klass;
	return (o: unknown) => klass.isInstance(o);
}

export class InterfaceEntityInput<T> extends Input<T> {

	private entClass: JClass<T> | JInterface<T>;

	constructor(aClass: JClass<T> | JInterface<T>, key: string, cat: string, def: T | null) {
		super(key, cat, def);
		this.entClass = aClass;
	}

	/** @throws InputErrorException */
	override parse(thisEnt: Entity, kw: KeywordIndex): void {
		Input.assertCount(kw, 1);
		const tmp = Input.parseInterfaceEntity(thisEnt.getJaamSimModel(), kw.getArg(0), this.entClass);
		this.value = tmp;
	}

	override getValidInputDesc(): string {
		return jformat(tr(Input.VALID_INTERFACE_ENTITY), interfaceSimpleName(this.entClass));
	}

	override getValidOptions(ent: Entity): string[] | null {
		const list: string[] = [];
		const simModel = ent.getJaamSimModel();
		for (const each of simModel.getClonesOfIterator(Entity, interfacePredicate(this.entClass))) {
			if (!each.isRegistered())
				continue;

			list.push(each.getName());
		}
		list.sort((a, b) => Input.uiSortOrder.compare(a, b));
		return list;
	}

	override getValueTokens(toks: string[]): void {
		if (this.value === null || this.isDef)
			return;

		toks.push(String(this.value));
	}

	override removeReferences(ent: Entity): boolean {
		if (this.value === (ent as unknown)) {
			this.reset();
			return true;
		}
		return false;
	}

	override appendEntityReferences(list: Entity[]): void {
		if (this.value === null || list.includes(this.value as unknown as Entity))
			return;
		list.push(this.value as unknown as Entity);
	}

	override getReturnType(): OutputReturnType | null {
		return "Entity";
	}

}
