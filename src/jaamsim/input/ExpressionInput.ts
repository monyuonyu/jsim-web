/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2014 Ausenco Engineering Canada Inc.
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
import type { JClass } from "../java/lang.ts";
import { ClassRegistry } from "../java/ClassRegistry.ts";
import { tr } from "../i18n/I18n.ts";
import type { Entity } from "../basicsim/Entity.ts";
import { ErrorException } from "../basicsim/ErrorException.ts";
import { DimensionlessUnit } from "../units/DimensionlessUnit.ts";
import type { Unit } from "../units/Unit.ts";
import { ExpError } from "./ExpError.ts";
import { ExpEvaluator } from "./ExpEvaluator.ts";
import type { ExpEvaluator_EntityParseContext } from "./ExpEvaluator.ts";
import { ExpParser } from "./ExpParser.ts";
import type { ExpParser_Expression } from "./ExpParser.ts";
import { ExpResType } from "./ExpResType.ts";
import type { ExpResult } from "./ExpResult.ts";
import { Input } from "./Input.ts";
import { InputErrorException } from "./InputErrorException.ts";
import type { KeywordIndex } from "./KeywordIndex.ts";
import type { OutputReturnType } from "./OutputRegistry.ts";
import { Parser } from "./Parser.ts";
import type { JType } from "./ValueHandle.ts";

export class ExpressionInput extends Input<ExpParser_Expression> {
	private unitType: JClass<Unit> | null = null;
	private parseContext: ExpEvaluator_EntityParseContext | null = null;
	private resType: ExpResType | null = null;

	constructor(key: string, cat: string, def: ExpParser_Expression | null) {
		super(key, cat, def);
	}

	public setUnitType(u: JClass<Unit> | null): void {
		if (u === this.unitType) {
			return;
		}
		if (!this.isDef)
			this.setValid(false);
		this.unitType = u;
	}

	public setResultType(type: ExpResType | null): void {
		this.resType = type;
	}

	override getUnitType(): JClass<Unit> | null {
		return this.unitType;
	}

	override applyConditioning(str: string): string {
		return Parser.addQuotesIfNeeded(str);
	}

	/** @throws InputErrorException */
	override parse(thisEnt: Entity, kw: KeywordIndex): void {
		Input.assertCount(kw, 1);
		try {
			const expString = kw.getArg(0);

			const pc = ExpEvaluator.getParseContext(thisEnt, expString);
			const exp = ExpParser.parseExpression(pc, expString);
			ExpParser.assertUnitType(exp, this.unitType);
			if (this.resType !== null)
				ExpParser.assertResultType(exp, this.resType);

			// Save the expression
			this.parseContext = pc;
			this.value = exp;
			this.setValid(true);

		} catch (e) {
			if (!(e instanceof ExpError)) throw e;
			throw new InputErrorException(e);
		}
	}

	override getValidInputDesc(): string | null {

		if (this.resType === ExpResType.NUMBER) {
			if (this.unitType === DimensionlessUnit)
				return tr(Input.VALID_EXP_DIMLESS);
			else
				return tr(Input.VALID_EXP_NUM);
		}

		if (this.resType === ExpResType.STRING)
			return tr(Input.VALID_EXP_STR);

		if (this.resType === ExpResType.ENTITY)
			return tr(Input.VALID_EXP_ENT);

		if (this.resType === ExpResType.COLLECTION)
			return tr(Input.VALID_EXP_COL);

		return tr(Input.VALID_EXP);
	}

	override getValueTokens(toks: string[]): void {
		if (this.value === null || this.isDef)
			return;
		toks.push(this.parseContext!.getUpdatedSource());
	}

	override appendEntityReferences(list: Entity[]): void {
		if (this.value === null)
			return;
		try {
			ExpParser.appendEntityReferences(this.value, list);
		}
		catch (e) {
			if (!(e instanceof ExpError)) throw e;
		}
	}

	override useExpressionBuilder(): boolean {
		return true;
	}

	override getPresentValueString(thisEnt: Entity, simTime: number): string {
		if (this.value === null)
			return "";

		try {
			const res = ExpEvaluator.evaluateExpression(this.value, thisEnt, simTime);
			return res.toString();
		}
		catch (e) {
			if (!(e instanceof ExpError)) throw e;
			return this.getValueString();
		}
	}

	public getNextResult(thisEnt: Entity, simTime: number): ExpResult {
		try {
			const ret = ExpEvaluator.evaluateExpression(this.getValue(), thisEnt, simTime);
			if (this.resType !== null && ret.type !== this.resType)
				throw new ExpError(this.parseContext!.getUpdatedSource(), 0, tr(Input.EXP_ERR_RESULT_TYPE),
						ret.type, this.resType);
			if (ret.type === ExpResType.NUMBER && ret.unitType !== this.unitType)
				throw new ExpError(this.parseContext!.getUpdatedSource(), 0, tr(Input.EXP_ERR_UNIT),
						ClassRegistry.simpleName(ret.unitType!), ClassRegistry.simpleName(this.unitType!));
			return ret;
		}
		catch (e) {
			if (!(e instanceof ExpError)) throw e;
			throw new ErrorException(thisEnt, this.getKeyword(), e);
		}
	}

	/** Java の getValue() と getValue(Entity, double, Class) を、引数の数で見分ける（Input と同じ） */
	override getValue(): ExpParser_Expression | null;
	override getValue<V>(thisEnt: Entity, simTime: number, klass: JClass<V> | JType | null): V | null;
	override getValue(thisEnt?: Entity, simTime?: number, _klass?: unknown): unknown {
		if (thisEnt === undefined)
			return super.getValue();
		if (this.getValue() === null)
			return null;
		return this.getNextResult(thisEnt, simTime!);
	}

	/** Java は ExpResult.class */
	override getReturnType(): OutputReturnType | null {
		return "ExpResult";
	}

}
