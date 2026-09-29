/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2014 Ausenco Engineering Canada Inc.
 * Copyright (C) 2016-2022 JaamSim Software Inc.
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
// 入れ子の interface ExpResult.Iterator と ExpResult.Collection は、同じ名前の namespace に置いた。
import type { JClass } from "../java/lang.ts";
import { jstr, jIsAssignableFrom } from "../internal.ts";
import { Entity } from "../internal.ts";
import type { JaamSimModel } from "../basicsim/JaamSimModel.ts";
import { Unit } from "../internal.ts";
import { ExpResType } from "../internal.ts";
import type { ExpParser_LambdaClosure } from "./ExpParser.ts";

export class ExpResult {

	public readonly type: ExpResType;

	public readonly value: number;
	public readonly unitType: JClass<Unit> | null;

	public readonly stringVal: string | null;
	public readonly entVal: Entity | null;
	public readonly colVal: ExpResult.Collection | null;
	public readonly lcVal: ExpParser_LambdaClosure | null;

	public static makeNumResult(val: number, ut: JClass<Unit> | null): ExpResult {
		return new ExpResult(ExpResType.NUMBER, val, ut, null, null, null, null);
	}

	public static makeStringResult(str: string | null): ExpResult {
		return new ExpResult(ExpResType.STRING, 0, null, str, null, null, null);
	}

	public static makeEntityResult(ent: Entity | null): ExpResult {
		return new ExpResult(ExpResType.ENTITY, 0, null, null, ent, null, null);
	}

	public static makeCollectionResult(col: ExpResult.Collection): ExpResult {
		return new ExpResult(ExpResType.COLLECTION, 0, null, null, null, col, null);
	}

	public static makeLambdaResult(lc: ExpParser_LambdaClosure): ExpResult {
		return new ExpResult(ExpResType.LAMBDA, 0, null, null, null, null, lc);
	}

	private constructor(type: ExpResType, val: number, ut: JClass<Unit> | null, str: string | null,
			ent: Entity | null, col: ExpResult.Collection | null, lc: ExpParser_LambdaClosure | null) {
		this.type = type;
		this.value = val;
		this.unitType = ut;

		this.stringVal = str;
		this.entVal = ent;
		this.colVal = col;
		this.lcVal = lc;
	}

	/**
	 * Java の getValue(Class<T> klass)。
	 * klass はクラス（ExpResult・Entity とその子・String・Number・Object）か、型の名前（"String" "double" "Double" など）。
	 */
	public getValue(klass: unknown): unknown {
		// Make a best effort to return the type
		if (klass === ExpResult || klass === Object || klass === "ExpResult" || klass === "Object")
			return this;

		if (this.type === ExpResType.STRING && (klass === String || klass === "String" || klass === Object)) {
			return this.stringVal;
		}

		if (this.type === ExpResType.ENTITY && (klass === "Entity"
				|| (typeof klass === "function" && jIsAssignableFrom(klass as JClass, Entity)))) {
			return this.entVal;
		}

		if (klass === Number || klass === "double" || klass === "Double") {
			if (this.type === ExpResType.NUMBER)
				return this.value;
		}

		return null;
	}

	public getCopy(): ExpResult {
		if (this.type === ExpResType.COLLECTION) {
			return ExpResult.makeCollectionResult(this.colVal!.getCopy());
		}
		return this;
	}

	public getOutputString(simModel: JaamSimModel | null): string {
		switch (this.type) {
		case ExpResType.NUMBER: {
			let factor = 1.0;
			let unitString = Unit.getSIUnit(this.unitType);
			if (simModel !== null) {
				factor = simModel.getDisplayedUnitFactor(this.unitType!);
				unitString = simModel.getDisplayedUnit(this.unitType!);
			}
			if (unitString === "")
				return jstr(this.value);
			return `${jstr(this.value / factor)}[${unitString}]`;
		}
		case ExpResType.STRING:
			return `"${this.stringVal}"`;
		case ExpResType.ENTITY:
			if (this.entVal === null)
				return "null";
			return `[${this.entVal.getName()}]`;
		case ExpResType.COLLECTION:
			return this.colVal!.getOutputString(simModel);
		case ExpResType.LAMBDA:
			return "function|" + String(this.lcVal!.getNumParams()) + "|";

		default:
			return "???";
		}
	}

	// Like 'getOutputString' but does not quote string types, making it more useful in string formaters
	public getFormatString(): string {
		switch (this.type) {
		case ExpResType.NUMBER: {
			const unitString = Unit.getSIUnit(this.unitType);
			if (unitString === "")
				return jstr(this.value);
			return `${jstr(this.value)}[${unitString}]`;
		}
		case ExpResType.STRING:
			return String(this.stringVal);
		case ExpResType.ENTITY:
			if (this.entVal === null)
				return "null";
			return `[${this.entVal.getName()}]`;
		case ExpResType.COLLECTION:
			return this.colVal!.getOutputString(null);
		case ExpResType.LAMBDA:
			return "function|" + String(this.lcVal!.getNumParams()) + "|";

		default:
			return "???";
		}
	}

	public getTypeName(): string {
		switch (this.type) {
		case ExpResType.NUMBER:
			return "NUMBER";
		case ExpResType.STRING:
			return "STRING";
		case ExpResType.ENTITY:
			return "ENTITY";
		case ExpResType.COLLECTION:
			return "COLLECTION";
		case ExpResType.LAMBDA:
			return "LAMBDA";

		default:
			return "???";
		}
	}

	public toString(): string {
		return this.getOutputString(null);
	}

	public equals(o: unknown): boolean {
		if (!(o instanceof ExpResult)) {
			return false;
		}
		const other = o;

		switch (this.type) {
		case ExpResType.NUMBER:
			return this.value === other.value && this.unitType === other.unitType;
		case ExpResType.STRING:
			return this.stringVal === other.stringVal;
		case ExpResType.ENTITY:
			return this.entVal === other.entVal;
		case ExpResType.COLLECTION:
			return this.colVal === other.colVal;

		default:
			return false;
		}

	}

}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace ExpResult {
	/** Java の interface ExpResult.Iterator */
	export interface Iterator {
		hasNext(): boolean;
		/** @throws ExpError */
		nextKey(): ExpResult;
	}

	/** Java の interface ExpResult.Collection */
	export interface Collection {
		/** @throws ExpError */
		index(index: ExpResult): ExpResult;

		// Collections have a copy-on-write feature, where the old reference may be invalidated
		// after assigning, always use the value returned as the new collection
		/** @throws ExpError */
		assign(key: ExpResult, value: ExpResult): Collection;

		getIter(): Iterator;

		getSize(): number;

		getOutputString(simModel: JaamSimModel | null): string;

		getCopy(): Collection;
	}
}
