/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2016-2024 JaamSim Software Inc.
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

// getNextString の多重定義は、引数の数と 3 つ目の引数の型で見分ける（StringProvider.ts を参照）。
// 入れ子のクラス ExpParser.Expression は ExpParser_Expression、
// ExpEvaluator.EntityParseContext は ExpEvaluator_EntityParseContext と仮定した（別の担当が決める）。

import type { Entity } from "../basicsim/Entity.ts";
import { ErrorException } from "../internal.ts";
import { ExpError } from "../internal.ts";
import { ExpEvaluator } from "../internal.ts";
import type { ExpEvaluator_EntityParseContext } from "../input/ExpEvaluator.ts";
import { ExpParser } from "../internal.ts";
import type { ExpParser_Expression } from "../input/ExpParser.ts";
import { ExpResType } from "../internal.ts";
import type { ExpResult } from "../input/ExpResult.ts";
import { Input } from "../internal.ts";
import { DimensionlessUnit } from "../internal.ts";
import type { Unit } from "../units/Unit.ts";
import { tr } from "../internal.ts";
import { Double, jformat, jstr } from "../internal.ts";
import type { JClass } from "../java/lang.ts";
import type { StringProvider } from "./StringProvider.ts";

/** Java の (int) x（0 の方向へ切り捨て、範囲外は端に張り付き、NaN は 0、-0 は 0） */
function toInt(x: number): number {
	if (Number.isNaN(x)) return 0;
	if (x >= 2147483647) return 2147483647;
	if (x <= -2147483648) return -2147483648;
	return Math.trunc(x) | 0;
}

/**
 * 利用者が書いた書式（fmt）に Java の double を渡すための箱。
 * %s では Java の Double.toString（jstr）の形、%f・%e・%g では数として使われる。
 */
function boxDouble(x: number): { valueOf(): number; toString(): string } {
	return { valueOf: () => x, toString: () => jstr(x) };
}

export class StringProvExpression implements StringProvider {

	private readonly exp: ExpParser_Expression;
	private unitType: JClass<Unit> | null;
	private readonly parseContext: ExpEvaluator_EntityParseContext;

	/** @throws ExpError */
	constructor(expString: string, thisEnt: Entity, ut: JClass<Unit> | null) {
		this.unitType = ut;
		this.parseContext = ExpEvaluator.getParseContext(thisEnt, expString);
		this.exp = ExpParser.parseExpression(this.parseContext, expString);
	}

	setUnitType(ut: JClass<Unit> | null): void {
		this.unitType = ut;
	}

	getNextString(thisEnt: Entity, simTime: number): string;
	getNextString(thisEnt: Entity, simTime: number, siFactor: number): string;
	getNextString(thisEnt: Entity, simTime: number, siFactor: number, integerValue: boolean): string;
	getNextString(thisEnt: Entity, simTime: number, fmt: string, siFactor: number): string;
	getNextString(thisEnt: Entity, simTime: number, a?: number | string, b?: number | boolean): string {
		// getNextString(Entity, double) → getNextString(thisEnt, simTime, 1.0d, false)
		if (a === undefined)
			return this.getNextStringInt(thisEnt, simTime, 1.0, false);

		// getNextString(Entity, double, String fmt, double siFactor)
		if (typeof a === "string")
			return this.getNextStringFmt(thisEnt, simTime, a, b as number);

		// getNextString(Entity, double, double siFactor) → getNextString(thisEnt, simTime, siFactor, false)
		if (b === undefined)
			return this.getNextStringInt(thisEnt, simTime, a, false);

		return this.getNextStringInt(thisEnt, simTime, a, b as boolean);
	}

	/** Java の getNextString(Entity thisEnt, double simTime, double siFactor, boolean integerValue) */
	private getNextStringInt(thisEnt: Entity, simTime: number, siFactor: number, integerValue: boolean): string {
		let ret = "";
		try {
			const result: ExpResult = ExpEvaluator.evaluateExpression(this.exp, thisEnt, simTime);
			switch (result.type) {
			case ExpResType.STRING:
				ret = result.stringVal as string;
				break;
			case ExpResType.ENTITY:
				ret = "null";
				if (result.entVal !== null)
					ret = result.entVal.getName();
				break;
			case ExpResType.NUMBER:
				if (result.unitType !== this.unitType) {
					const simModel = thisEnt.getJaamSimModel();
					ret = result.getOutputString(simModel);
					break;
				}
				if (integerValue) {
					ret = jstr(toInt(result.value / siFactor));
				}
				else {
					ret = jstr(result.value / siFactor);
				}
				break;
			case ExpResType.COLLECTION: {
				const simModel = thisEnt.getJaamSimModel();
				ret = result.colVal!.getOutputString(simModel);
				break;
			}
			default:
				// assert(false);
				ret = "???";
				break;
			}
		}
		catch (e) {
			if (!(e instanceof ExpError)) throw e;
			throw new ErrorException(thisEnt, e);
		}
		return ret;
	}

	/** Java の getNextString(Entity thisEnt, double simTime, String fmt, double siFactor) */
	private getNextStringFmt(thisEnt: Entity, simTime: number, fmt: string, siFactor: number): string {
		let ret = "";
		try {
			const result: ExpResult = ExpEvaluator.evaluateExpression(this.exp, thisEnt, simTime);
			switch (result.type) {
			case ExpResType.STRING:
				ret = jformat(fmt, result.stringVal);  // no double quotes
				break;
			case ExpResType.ENTITY:
				ret = jformat(fmt, result.entVal);  // no square brackets
				break;
			case ExpResType.NUMBER:
				if (result.unitType !== this.unitType) {
					if (this.unitType === DimensionlessUnit) {
						const simModel = thisEnt.getJaamSimModel();
						ret = jformat(fmt, result.getOutputString(simModel));
						break;
					}
					throw new ExpError(this.exp.source, 0, tr(Input.EXP_ERR_UNIT),
							thisEnt.getJaamSimModel().getObjectTypeForClass(result.unitType),
							thisEnt.getJaamSimModel().getObjectTypeForClass(this.unitType));
				}
				ret = jformat(fmt, boxDouble(result.value / siFactor));
				break;
			case ExpResType.COLLECTION: {
				const simModel = thisEnt.getJaamSimModel();
				ret = jformat(fmt, result.colVal!.getOutputString(simModel));
				break;
			}
			default:
				// assert(false);
				ret = jformat(fmt, "???");
				break;
			}
		}
		catch (e) {
			if (!(e instanceof ExpError)) throw e;
			throw new ErrorException(thisEnt, e);
		}
		return ret;
	}

	appendEntityReferences(list: Entity[]): void {
		try {
			ExpParser.appendEntityReferences(this.exp, list);
		}
		catch (e) {
			if (!(e instanceof ExpError)) throw e;
		}
	}

	getNextValue(thisEnt: Entity, simTime: number): number {
		let ret = Double.NaN;
		try {
			const result: ExpResult = ExpEvaluator.evaluateExpression(this.exp, thisEnt, simTime);
			if (result.type === ExpResType.NUMBER) {
				ret = result.value;
			}
		}
		catch (e) {
			if (!(e instanceof ExpError)) throw e;
			throw new ErrorException(thisEnt, e);
		}
		return ret;
	}

	toString(): string {
		return this.parseContext.getUpdatedSource();
	}

}
