/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2013 Ausenco Engineering Canada Inc.
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
// 注（多重定義）:
// - setDefaultValue(Class<? extends Unit>) と、基底の setDefaultValue(ObjectType) は、引数の型で見分ける
//   （ObjectType なら基底の方。クラスか null なら単位の型の方。Java で null を渡すのは単位の型の方なので）。
// - reset() の上書きは reset(ent?) の形（Input.ts の注）。
import { ClassRegistry } from "../internal.ts";
import type { JClass } from "../java/lang.ts";
import type { Entity } from "../basicsim/Entity.ts";
import type { JaamSimModel } from "../basicsim/JaamSimModel.ts";
import { ObjectType } from "../internal.ts";
import { Unit } from "../internal.ts";
import { UserSpecifiedUnit } from "../internal.ts";
import { Input } from "../internal.ts";
import type { KeywordIndex } from "./KeywordIndex.ts";
import type { OutputReturnType } from "./OutputRegistry.ts";

export class UnitTypeInput extends Input<ObjectType> {
	private unitType: JClass<Unit> | null = null;
	private defaultUnitType: JClass<Unit> | null = null;

	constructor(key: string, cat: string, ut: JClass<Unit> | null) {
		super(key, cat, null);
		this.setDefaultValue(ut);
	}

	override setDefaultValue(ut: JClass<Unit> | ObjectType | null): void {
		// 基底の setDefaultValue(ObjectType)
		if (ut instanceof ObjectType) {
			super.setDefaultValue(ut);
			return;
		}
		super.setDefaultValue(null);  // getValue is never used
		this.unitType = ut;
		this.defaultUnitType = ut;
	}

	override getDefaultString(simModel: JaamSimModel | null): string {
		if (this.defaultUnitType === null || this.defaultUnitType === UserSpecifiedUnit)
			// TODO(移植): Java は null を返す。基底の戻り値の型が string なので、型だけ合わせて null を返している
			return null as unknown as string;  // Shown as 'None' in the Input Editor
		return ClassRegistry.simpleName(this.defaultUnitType);
	}

	override reset(ent?: Entity): void {
		if (ent !== undefined) {
			super.reset(ent);
			return;
		}
		super.reset();
		this.unitType = this.defaultUnitType;
	}

	/** @throws InputErrorException */
	override parse(thisEnt: Entity, kw: KeywordIndex): void {
		Input.assertCount(kw, 1);
		const t = Input.parseEntity(thisEnt.getJaamSimModel(), kw.getArg(0), ObjectType);
		const type = Input.checkCast(t.getJavaClass() as JClass<Entity>, Unit as unknown as JClass<Unit>);

		this.value = t;
		this.unitType = type;
	}

	override getValidOptions(ent: Entity | null): string[] {
		return Unit.getUnitTypeList((ent as Entity).getJaamSimModel());
	}

	override getUnitType(): JClass<Unit> | null {
		if (this.isDef && this.protoInput !== null)
			return (this.protoInput as unknown as UnitTypeInput).getUnitType();
		return this.unitType;
	}

	override getReturnType(): OutputReturnType | null {
		return "Entity";
	}

}
