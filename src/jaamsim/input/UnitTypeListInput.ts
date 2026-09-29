/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2015 Ausenco Engineering Canada Inc.
 * Copyright (C) 2017-2026 JaamSim Software Inc.
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
// 注（多重定義）:
// - setDefaultValue(ArrayList<Class<? extends Unit>>) と、基底の setDefaultValue(ArrayList<ObjectType>) は、
//   配列の最初の要素が ObjectType かどうかで見分ける（ObjectType なら基底の方。空の配列と null は単位の型の方）。
// - reset() の上書きは reset(ent?) の形（Input.ts の注）。
import { jIsAssignableFrom } from "../java/lang.ts";
import type { JClass } from "../java/lang.ts";
import { tr } from "../i18n/I18n.ts";
import type { Entity } from "../basicsim/Entity.ts";
import type { JaamSimModel } from "../basicsim/JaamSimModel.ts";
import { ObjectType } from "../basicsim/ObjectType.ts";
import { Unit } from "../units/Unit.ts";
import { ArrayListInput } from "./ArrayListInput.ts";
import { Input } from "./Input.ts";
import type { KeywordIndex } from "./KeywordIndex.ts";
import type { OutputReturnType } from "./OutputRegistry.ts";

export class UnitTypeListInput extends ArrayListInput<ObjectType> {
	private unitTypeList: JClass<Unit>[] | null = null;
	private defaultUnitTypeList: JClass<Unit>[] | null = null;

	constructor(key: string, cat: string, utList: JClass<Unit>[] | null) {
		super(key, cat, null);
		this.setDefaultValue(utList);
	}

	override setDefaultValue(utList: JClass<Unit>[] | ObjectType[] | null): void {
		// 基底の setDefaultValue(ArrayList<ObjectType>)
		// TODO(移植): 空の配列は、どちらの版か見分けられない（単位の型の方として扱う）
		if (utList !== null && utList.length > 0 && utList[0] instanceof ObjectType) {
			super.setDefaultValue(utList as ObjectType[]);
			return;
		}
		super.setDefaultValue(null);  // getValue is never used
		this.unitTypeList = utList as JClass<Unit>[] | null;
		this.defaultUnitTypeList = utList as JClass<Unit>[] | null;
	}

	private setUnitTypeList(otList: ObjectType[]): void {
		this.unitTypeList = [];
		for (const ot of otList) {
			const ut = Input.checkCast(ot.getJavaClass() as JClass<Entity>, Unit as unknown as JClass<Unit>);
			this.unitTypeList.push(ut);
		}
	}

	getUnitTypeList(): JClass<Unit>[] | null {
		if (this.isDef && this.protoInput !== null)
			return (this.protoInput as unknown as UnitTypeListInput).getUnitTypeList();
		return this.unitTypeList;
	}

	override reset(ent?: Entity): void {
		if (ent !== undefined) {
			super.reset(ent);
			return;
		}
		super.reset();
		this.unitTypeList = this.defaultUnitTypeList;
	}

	/** @throws InputErrorException */
	override parse(thisEnt: Entity, kw: KeywordIndex): void {
		Input.assertCountRange(kw, this.minCount, this.maxCount);
		this.value = Input.parseEntityList(thisEnt.getJaamSimModel(), kw, ObjectType, false);
		this.setUnitTypeList(this.value);
	}

	override getValidInputDesc(): string {
		return tr(Input.VALID_UNIT_TYPE_LIST);
	}

	override getValidOptions(ent: Entity | null): string[] {
		const list: string[] = [];
		for (const each of (ent as Entity).getJaamSimModel().getClonesOfIterator(ObjectType)) {
			const klass = each.getJavaClass();
			if (klass === null)
				continue;

			if (jIsAssignableFrom(Unit, klass))
				list.push(each.getName());
		}
		list.sort((a, b) => Input.uiSortOrder.compare(a, b));
		return list;
	}

	override getDefaultString(simModel: JaamSimModel | null): string {
		if (this.defValue === null || this.defValue.length === 0)
			return "";

		let tmp = "";
		tmp += this.defValue[0].getName();
		for (let i = 1; i < this.defValue.length; i++) {
			tmp += Input.SEPARATOR;
			tmp += this.defValue[i].getName();
		}
		return tmp;
	}

	override getReturnType(): OutputReturnType | null {
		return "ArrayList";
	}

}
