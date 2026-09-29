/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2016-2024 JaamSim Software Inc.
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
import { jformat, Integer } from "../internal.ts";
import { ClassRegistry } from "../internal.ts";
import { tr } from "../internal.ts";
import type { Entity } from "../basicsim/Entity.ts";
import { ErrorException } from "../internal.ts";
import type { Unit } from "../units/Unit.ts";
import { ExpError } from "../internal.ts";
import { ExpEvaluator } from "../internal.ts";
import type { ExpParser_Expression } from "./ExpParser.ts";
import { ExpResType } from "../internal.ts";
import type { ExpResult } from "./ExpResult.ts";
import { Input } from "../internal.ts";
import type { OutputReturnType } from "./OutputRegistry.ts";
import { ValueHandle } from "../internal.ts";
import type { JType } from "./ValueHandle.ts";

export class ExpressionHandle extends ValueHandle {

	private readonly exp: ExpParser_Expression;
	private readonly name: string;
	private readonly unitType: JClass<Unit> | null;

	constructor(ent: Entity, exp: ExpParser_Expression, name: string, unitType: JClass<Unit> | null) {
		super(ent);
		this.exp = exp;
		this.name = name;
		this.unitType = unitType;
	}

	getUnitType(): JClass<Unit> | null {
		return this.unitType;
	}

	getValue<T>(simTime: number, klass: JType | null): T {
		// Make a best effort to return the type
		const res = this.evaluateExp(simTime);

		return res.getValue(klass) as T;
	}

	getValueAsDouble(simTime: number, def: number): number {
		const res = this.evaluateExp(simTime);
		if (res.type === ExpResType.NUMBER)
			return res.value;

		return def;
	}

	private evaluateExp(simTime: number): ExpResult {
		try {
			const er = ExpEvaluator.evaluateExpression(this.exp, this.ent, simTime);
			if (er.type === ExpResType.NUMBER && er.unitType !== this.unitType) {
				throw new ExpError(this.exp.source, 0, tr(Input.EXP_ERR_UNIT),
						ClassRegistry.simpleName(er.unitType!), ClassRegistry.simpleName(this.unitType!));
			}
			return er;
		}
		catch (e) {
			if (!(e instanceof ExpError)) throw e;
			throw new ErrorException(this.ent, e);
		}
	}

	/** Java は ExpResult.class */
	getReturnType(): OutputReturnType | null {
		return "ExpResult";
	}

	getDescription(): string {
		return jformat(tr("Value for the user-defined custom output '%s'."), this.name);
	}

	getTitle(): string {
		return tr("User-Defined Outputs");
	}

	getName(): string {
		return this.name;
	}

	isReportable(): boolean {
		return true;
	}

	getSequence(): number {
		return Integer.MAX_VALUE;
	}
	canCache(): boolean {
		return false;
	}

}
