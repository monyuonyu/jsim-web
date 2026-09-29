/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2022-2026 JaamSim Software Inc.
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
import type { Entity } from "../basicsim/Entity.ts";
import { ErrorException } from "../internal.ts";
import { BooleanInput } from "../internal.ts";
import { Input } from "../internal.ts";
import type { KeywordIndex } from "../input/KeywordIndex.ts";
import { Parser } from "../internal.ts";
import type { OutputReturnType } from "../input/OutputRegistry.ts";
import { DimensionlessUnit } from "../internal.ts";
import type { Unit } from "../units/Unit.ts";
import type { JClass } from "../java/lang.ts";
import { tr } from "../internal.ts";
import type { BooleanProvider } from "./BooleanProvider.ts";
import { BooleanProvConstant } from "../internal.ts";
import { BooleanProvExpression } from "../internal.ts";

export class BooleanProvInput extends Input<BooleanProvider> {

	// Java の多重定義 BooleanProvInput(String, String, BooleanProvider) と (String, String, boolean) は、
	// def の型（typeof boolean）で見分けて 1 つにした。
	constructor(key: string, cat: string, def: BooleanProvider | boolean | null) {
		super(key, cat, typeof def === "boolean" ? new BooleanProvConstant(def) : def);
	}

	// Java の多重定義 setDefaultValue(boolean) と setDefaultValue(T) は、引数の型で見分けて 1 つにした。
	public override setDefaultValue(def: BooleanProvider | boolean | null): void {
		if (typeof def === "boolean") {
			this.setDefaultValue(new BooleanProvConstant(def));
			return;
		}
		super.setDefaultValue(def);
	}

	public override applyConditioning(str: string): string {
		if (str === "t" || str === "T" || str === "1")
			return BooleanInput.TRUE;
		if (str === "f" || str === "F" || str === "0")
			return BooleanInput.FALSE;
		return Parser.addQuotesIfNeeded(str);
	}

	/** @throws InputErrorException */
	public override parse(thisEnt: Entity, kw: KeywordIndex): void {
		this.value = Input.parseBooleanProvider(kw, thisEnt);
		this.setValid(true);
	}

	public override getValidInputDesc(): string {
		return tr(Input.VALID_BOOLEAN_PROV);
	}

	public override getExamples(): string[] {
		return Input.EXAMPLE_BOOLEAN_PROV;
	}

	public override getValidOptions(ent: Entity): string[] {
		return [...BooleanInput.validOptions];
	}

	public override getValueTokens(toks: string[]): void {
		if (this.value === null || this.isDef)
			return;
		toks.push(this.value.toString());
	}

	public override appendEntityReferences(list: Entity[]): void {
		if (this.value === null)
			return;
		if (this.value instanceof BooleanProvExpression) {
			(this.value as BooleanProvExpression).appendEntityReferences(list);
			return;
		}
	}

	public override useExpressionBuilder(): boolean {
		return true;
	}

	public override getPresentValueString(thisEnt: Entity, simTime: number): string {
		if (this.value === null)
			return "";
		return this.value.getNextBoolean(thisEnt, simTime) ? "true" : "false";
	}

	public getNextBoolean(thisEnt: Entity, simTime: number): boolean {
		try {
			// Java では getValue() が null なら NullPointerException（ここでも TypeError になる）
			return (this.getValue() as BooleanProvider).getNextBoolean(thisEnt, simTime);
		}
		catch (e) {
			if (!(e instanceof ErrorException))
				throw e;
			e.keyword = this.getKeyword();
			throw e;
		}
	}

	public isConstant(): boolean {
		return (this.value instanceof BooleanProvConstant);
	}

	// Java の多重定義 getValue() と getValue(Entity, double, Class<V>) は、引数の数で見分けて 1 つにした。
	// TODO(移植): Input.getValue が同じ形（引数なしなら value、3 つなら式の値）になることを前提にしている。
	public override getValue(): BooleanProvider | null;
	public override getValue<V>(thisEnt: Entity, simTime: number, klass: JClass<V> | null): V | null;
	public override getValue<V>(thisEnt?: Entity, simTime?: number, klass?: JClass<V> | null): unknown {
		if (thisEnt === undefined)
			return super.getValue();
		return this.getNextBoolean(thisEnt, simTime as number);
	}

	// TODO(移植): Java は Class<?>（Boolean.class）を返す。OutputReturnType の文字列と仮定した。
	public override getReturnType(): OutputReturnType | null {
		return "boolean";
	}

	public override getUnitType(): JClass<Unit> | null {
		return DimensionlessUnit;
	}

}
