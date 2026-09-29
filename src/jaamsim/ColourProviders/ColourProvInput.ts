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
import type { Entity } from "../basicsim/Entity.ts";
import { ErrorException } from "../internal.ts";
import { ColourInput } from "../internal.ts";
import { Input } from "../internal.ts";
import type { KeywordIndex } from "../input/KeywordIndex.ts";
import { Parser } from "../internal.ts";
import type { OutputReturnType } from "../input/OutputRegistry.ts";
import { Color4d } from "../internal.ts";
import { DimensionlessUnit } from "../internal.ts";
import type { Unit } from "../units/Unit.ts";
import type { JClass } from "../java/lang.ts";
import { tr } from "../internal.ts";
import type { ColourProvider } from "./ColourProvider.ts";
import { ColourProvConstant } from "../internal.ts";

export class ColourProvInput extends Input<ColourProvider> {

	// Java の多重定義 ColourProvInput(String, String, ColourProvider) と (String, String, Color4d) は、
	// def が Color4d かで見分けて 1 つにした。
	constructor(key: string, cat: string, def: ColourProvider | Color4d | null) {
		super(key, cat, def instanceof Color4d ? new ColourProvConstant(def) : def);
	}

	public override applyConditioning(str: string): string {

		// No changes required if the input is a constant colour value
		const tokens: string[] = [];
		Parser.tokenize(tokens, str, true);
		if (tokens.length === 1 && ColourInput.getColorWithName(tokens[0]) !== null)
			return str;
		if (tokens.length === 2 && ColourInput.getColorWithName(tokens[0]) !== null
				&& Input.isDouble(tokens[1]))
			return str;
		if (tokens.length === 3 && Input.isDouble(tokens[0]) && Input.isDouble(tokens[1])
				&& Input.isDouble(tokens[2]))
			return str;
		if (tokens.length === 4 && Input.isDouble(tokens[0]) && Input.isDouble(tokens[1])
				&& Input.isDouble(tokens[2]) && Input.isDouble(tokens[3]))
			return str;

		return Parser.addQuotesIfNeeded(str);
	}

	/** @throws InputErrorException */
	public override parse(thisEnt: Entity, kw: KeywordIndex): void {
		this.value = Input.parseColourProvider(kw, thisEnt);
		this.setValid(true);
	}

	public override getValidInputDesc(): string {
		return tr(Input.VALID_COLOUR_PROV);
	}

	public override getExamples(): string[] {
		return Input.EXAMPLE_COLOUR_PROV;
	}

	public override getValueTokens(toks: string[]): void {
		if (this.value === null || this.isDef)
			return;

		// Preserve the exact text for a constant value input
		if (this.isConstant()) {
			super.getValueTokens(toks);
			return;
		}

		// All other inputs can be built from scratch
		toks.push(this.value.toString());
	}

	public override appendEntityReferences(list: Entity[]): void {
		// Java では value が null なら NullPointerException（ここでも TypeError になる）
		(this.value as ColourProvider).appendEntityReferences(list);
	}

	public override useExpressionBuilder(): boolean {
		return true;
	}

	public override getPresentValueString(thisEnt: Entity, simTime: number): string {
		if (this.value === null)
			return "";
		return this.value.getNextColour(thisEnt, simTime).toString();
	}

	public getNextColour(thisEnt: Entity, simTime: number): Color4d {
		try {
			// Java では getValue() が null なら NullPointerException（ここでも TypeError になる）
			return (this.getValue() as ColourProvider).getNextColour(thisEnt, simTime);
		}
		catch (e) {
			if (!(e instanceof ErrorException))
				throw e;
			e.keyword = this.getKeyword();
			throw e;
		}
	}

	public isConstant(): boolean {
		return (this.value instanceof ColourProvConstant);
	}

	// Java の多重定義 getValue() と getValue(Entity, double, Class<V>) は、引数の数で見分けて 1 つにした。
	// TODO(移植): Input.getValue が同じ形（引数なしなら value、3 つなら式の値）になることを前提にしている。
	public override getValue(): ColourProvider | null;
	public override getValue<V>(thisEnt: Entity, simTime: number, klass: JClass<V> | null): V | null;
	public override getValue<V>(thisEnt?: Entity, simTime?: number, klass?: JClass<V> | null): unknown {
		if (thisEnt === undefined)
			return super.getValue();
		const col: Color4d = this.getNextColour(thisEnt, simTime as number);
		// Java の (int) Math.round(double)（.5 は正の方向。int の範囲に収まる値）
		const r = Math.round(255 * col.r);
		const g = Math.round(255 * col.g);
		const b = Math.round(255 * col.b);
		const a = Math.round(255 * col.a);
		return [r, g, b, a];
	}

	// TODO(移植): Java は Class<?>（int[].class）を返す。OutputReturnType の文字列と仮定した。
	public override getReturnType(): OutputReturnType | null {
		return "int[]";
	}

	public override getUnitType(): JClass<Unit> | null {
		return DimensionlessUnit;
	}

}
