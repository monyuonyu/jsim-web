/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2015 Ausenco Engineering Canada Inc.
 * Copyright (C) 2018-2025 JaamSim Software Inc.
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
// - コンストラクタ StringProvInput(key, cat, StringProvider) と (key, cat, String) は、def の型（string か）で見分ける。
// - getNextString の 8 つの形は、1 つ目の引数が number か（Entity の無い形）と、残りの引数の数・型で見分ける:
//   (simTime) (thisEnt, simTime) (simTime, siFactor) (thisEnt, simTime, siFactor)
//   (simTime, siFactor, integerValue) (thisEnt, simTime, siFactor, integerValue)
//   (simTime, fmt, siFactor) (thisEnt, simTime, fmt, siFactor)
// - Input.getValue() と getValue(Entity, double, Class) は、引数の数で見分ける（Input.ts と同じく thisEnt の有無）。

import { Entity } from "../basicsim/Entity.ts";
import { ErrorException } from "../basicsim/ErrorException.ts";
import type { JaamSimModel } from "../basicsim/JaamSimModel.ts";
import { Input } from "../input/Input.ts";
import type { OutputReturnType } from "../input/OutputRegistry.ts";
import type { KeywordIndex } from "../input/KeywordIndex.ts";
import { Parser } from "../input/Parser.ts";
import { SampleConstant } from "../Samples/SampleConstant.ts";
import { isSampleProvider } from "../Samples/SampleProvider.ts";
import type { SampleProvider } from "../Samples/SampleProvider.ts";
import { DimensionlessUnit } from "../units/DimensionlessUnit.ts";
import type { Unit } from "../units/Unit.ts";
import { UserSpecifiedUnit } from "../units/UserSpecifiedUnit.ts";
import { tr } from "../i18n/I18n.ts";
import type { JClass } from "../java/lang.ts";
import { StringProvConstant } from "./StringProvConstant.ts";
import { StringProvExpression } from "./StringProvExpression.ts";
import { StringProvSample } from "./StringProvSample.ts";
import type { StringProvider } from "./StringProvider.ts";

export class StringProvInput extends Input<StringProvider> {

	private unitType: JClass<Unit> | null = null;

	constructor(key: string, cat: string, def: StringProvider | string | null) {
		super(key, cat, typeof def === "string" ? new StringProvConstant(def) : def);
		this.unitType = null;
	}

	setUnitType(ut: JClass<Unit> | null): void {

		if (ut === this.unitType)
			return;

		if (!this.isDef)
			this.setValid(false);
		this.unitType = ut;
		if (this.value instanceof StringProvExpression) {
			this.value.setUnitType(ut);
		}
	}

	override applyConditioning(str: string): string {
		return Parser.addQuotesIfNeeded(str);
	}

	/** @throws InputErrorException */
	override parse(thisEnt: Entity, kw: KeywordIndex): void {
		this.value = Input.parseStringProvider(kw, thisEnt, this.unitType as JClass<Unit>);  // Java は null のまま渡す
		this.setValid(true);
	}

	override getValidInputDesc(): string {
		return tr(Input.VALID_STRING_PROV);
	}

	override getValidOptions(ent: Entity): string[] {
		const list: string[] = [];
		const simModel = ent.getJaamSimModel();
		// Java: simModel.getClonesOfIterator(Entity.class, SampleProvider.class)
		for (const each of simModel.getClonesOfIterator(Entity) as Iterable<Entity>) {
			if (!isSampleProvider(each))
				continue;
			const sp: SampleProvider = each;
			if (sp.getUnitType() === this.unitType)
				list.push(each.getName());
		}
		list.sort((a, b) => Input.uiSortOrder.compare(a, b));
		return list;
	}

	override getValueTokens(toks: string[]): void {
		if (this.value === null || this.isDef)
			return;

		// Preserve the exact text for a constant value input
		if (this.value instanceof StringProvSample && this.value.getSampleProvider() instanceof SampleConstant) {
			super.getValueTokens(toks);
			return;
		}

		// All other inputs can be built from scratch
		toks.push(this.value.toString());
	}

	override removeReferences(ent: Entity): boolean {
		if (this.value === null)
			return false;

		if (this.value instanceof StringProvSample) {
			const spsamp: StringProvSample = this.value;
			if ((spsamp.getSampleProvider() as unknown) === ent) {
				this.reset();
				return true;
			}
		}
		return false;
	}

	override appendEntityReferences(list: Entity[]): void {
		if (this.value instanceof Entity) {
			const entref: Entity = this.value;
			if (list.includes(entref))
				return;
			list.push(entref);
			return;
		}

		if (this.value instanceof StringProvExpression) {
			this.value.appendEntityReferences(list);
			return;
		}
	}

	override useExpressionBuilder(): boolean {
		return true;
	}

	override getPresentValueString(thisEnt: Entity, simTime: number): string {
		if (this.value === null)
			return "";
		const simModel: JaamSimModel = thisEnt.getJaamSimModel();

		let sb = "";
		if (this.unitType === null || this.unitType === DimensionlessUnit
				|| this.unitType === UserSpecifiedUnit) {
			sb += this.value.getNextString(thisEnt, simTime);
		}
		else {
			const unitString = simModel.getDisplayedUnit(this.unitType);
			const sifactor = simModel.getDisplayedUnitFactor(this.unitType);
			sb += this.value.getNextString(thisEnt, simTime, sifactor);
			sb += "[" + unitString + "]";
		}
		return sb;
	}

	getNextString(simTime: number): string;
	getNextString(thisEnt: Entity | null, simTime: number): string;
	getNextString(simTime: number, siFactor: number): string;
	getNextString(thisEnt: Entity | null, simTime: number, siFactor: number): string;
	getNextString(simTime: number, siFactor: number, integerValue: boolean): string;
	getNextString(thisEnt: Entity | null, simTime: number, siFactor: number, integerValue: boolean): string;
	getNextString(simTime: number, fmt: string, siFactor: number): string;
	getNextString(thisEnt: Entity | null, simTime: number, fmt: string, siFactor: number): string;
	getNextString(...args: unknown[]): string {
		// Entity の無い形は getNextString(null, ...) と同じ
		if (typeof args[0] === "number")
			args.unshift(null);

		const thisEnt = args[0] as Entity | null;
		const simTime = args[1] as number;

		// getNextString(Entity thisEnt, double simTime) → getNextString(thisEnt, simTime, 1.0d, false)
		if (args.length === 2)
			return this.getNextStringSi(thisEnt, simTime, 1.0, false);

		// getNextString(Entity thisEnt, double simTime, String fmt, double siFactor)
		if (typeof args[2] === "string") {
			const fmt = args[2];
			const siFactor = args[3] as number;
			try {
				return this.getValue().getNextString(thisEnt, simTime, fmt, siFactor);
			}
			catch (e) {
				if (e instanceof ErrorException) {
					e.keyword = this.getKeyword();
					throw e;
				}
				throw new ErrorException(thisEnt, this.getKeyword(), e as Error);
			}
		}

		const siFactor = args[2] as number;

		// getNextString(Entity thisEnt, double simTime, double siFactor) → getNextString(thisEnt, simTime, siFactor, false)
		if (args.length === 3)
			return this.getNextStringSi(thisEnt, simTime, siFactor, false);

		return this.getNextStringSi(thisEnt, simTime, siFactor, args[3] as boolean);
	}

	/** Java の getNextString(Entity thisEnt, double simTime, double siFactor, boolean integerValue) */
	private getNextStringSi(thisEnt: Entity | null, simTime: number, siFactor: number, integerValue: boolean): string {
		try {
			return this.getValue().getNextString(thisEnt, simTime, siFactor, integerValue);
		}
		catch (e) {
			if (e instanceof ErrorException) {
				e.keyword = this.getKeyword();
				throw e;
			}
			throw new ErrorException(thisEnt, this.getKeyword(), e as Error);
		}
	}

	getNextValue(thisEnt: Entity | null, simTime: number): number {
		try {
			return this.getValue().getNextValue(thisEnt, simTime);
		}
		catch (e) {
			if (e instanceof ErrorException) {
				e.keyword = this.getKeyword();
				throw e;
			}
			throw new ErrorException(thisEnt, this.getKeyword(), e as Error);
		}
	}

	override getValue(): StringProvider;
	override getValue<V>(thisEnt: Entity, simTime: number, klass: JClass<V> | OutputReturnType | null): V | null;
	override getValue(thisEnt?: Entity, simTime?: number, klass?: unknown): unknown {
		// Input と同じく、thisEnt の有無で getValue() と getValue(thisEnt, simTime, klass) を見分ける
		if (thisEnt === undefined)
			return super.getValue();
		return this.getNextString(thisEnt, simTime as number);
	}

	override getReturnType(): OutputReturnType | null {
		return "String";
	}

	override getUnitType(): JClass<Unit> | null {
		return this.unitType;
	}

}
