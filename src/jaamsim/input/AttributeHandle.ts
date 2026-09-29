/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2014 Ausenco Engineering Canada Inc.
 * Copyright (C) 2021-2025 JaamSim Software Inc.
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
// 注: getValue(simTime, klass) と getValue(klass) は、最初の引数が数かどうかで見分ける。
import { Integer, jformat } from "../java/lang.ts";
import type { JClass } from "../java/lang.ts";
import { tr } from "../i18n/I18n.ts";
import type { Entity } from "../basicsim/Entity.ts";
import { ErrorException } from "../basicsim/ErrorException.ts";
import type { Unit } from "../units/Unit.ts";
import { ExpError } from "./ExpError.ts";
import { ExpEvaluator } from "./ExpEvaluator.ts";
import type { ExpParser_Expression } from "./ExpParser.ts";
import { ExpResType } from "./ExpResType.ts";
import type { ExpResult } from "./ExpResult.ts";
import type { OutputReturnType } from "./OutputRegistry.ts";
import { ValueHandle } from "./ValueHandle.ts";
import type { JType } from "./ValueHandle.ts";

export class AttributeHandle extends ValueHandle {
	private readonly attributeName: string;
	private readonly expression: ExpParser_Expression | null;
	private value: ExpResult | null;
	private unitType: JClass<Unit> | null;

	constructor(e: Entity, name: string, exp: ExpParser_Expression | null, val: ExpResult | null, ut: JClass<Unit> | null) {
		super(e);
		this.attributeName = name;
		this.expression = exp;
		this.value = val;
		this.unitType = ut;
	}

	override getUnitType(): JClass<Unit> | null {
		if (this.value === null) {
			try {
				const res = ExpEvaluator.evaluateExpression(this.expression, this.ent, 0.0);
				return res.unitType;
			}
			catch (e) {
				if (!(e instanceof ExpError))
					throw e;
				throw new ErrorException(this.ent, e);
			}
		}
		return this.unitType;
	}

	getExpression(): ExpParser_Expression | null {
		return this.expression;
	}

	setValue(val: ExpResult): void {
		this.value = val;
		this.unitType = val.unitType;
	}

	override getValue<T>(simTime: number, klass: JType | null): T;
	override getValue<T>(klass: JType | null): T;
	override getValue<T>(a: number | JType | null, b?: JType | null): T {
		if (typeof a !== "number")
			return this.getValue<T>(0.0, a);
		const simTime = a;
		const klass = b ?? null;
		if (this.value === null) {
			try {
				const res = ExpEvaluator.evaluateExpression(this.expression, this.ent, simTime);
				return res.getValue(klass) as T;
			}
			catch (e) {
				if (!(e instanceof ExpError))
					throw e;
				throw new ErrorException(this.ent, e);
			}
		}
		return this.value.getValue(klass) as T;
	}

	copyValue(): ExpResult | null {
		if (this.value === null) {
			return null;
		}
		return this.value.getCopy();
	}

	override getValueAsDouble(simTime: number, def: number): number {
		// Java は value が null なら NullPointerException
		if ((this.value as ExpResult).type === ExpResType.NUMBER)
			return (this.value as ExpResult).value;
		else
			return def;
	}

	override getReturnType(): OutputReturnType {
		return "ExpResult";
	}
	override getDescription(): string {
		return jformat(tr("Value for the user-defined attribute '%s'."), this.attributeName);
	}

	override getTitle(): string {
		return tr("User-Defined Attributes");
	}

	override getName(): string {
		return this.attributeName;
	}
	override isReportable(): boolean {
		return true;
	}
	override getSequence(): number {
		return Integer.MAX_VALUE;
	}
	override canCache(): boolean {
		return false;
	}

}
