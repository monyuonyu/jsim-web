/*
 * JaamSim Discrete Event Simulation
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
// 注: Java の Class<?>（戻り値の型）は、OutputRegistry の OutputReturnType の文字列で表す
//     （"double" "int" "long" "boolean" "String" "Entity" "DoubleVector" "ArrayList" "ExpResult" など）。
//     getValue(simTime, klass) の klass も、その文字列かクラス（JClass）。
import type { JClass } from "../java/lang.ts";
import type { Entity } from "../basicsim/Entity.ts";
import type { Unit } from "../units/Unit.ts";
import type { OutputReturnType } from "./OutputRegistry.ts";

/** Java の Class<?> を渡す所の型（OutputReturnType の文字列か、クラス） */
export type JType = OutputReturnType | JClass;

export abstract class ValueHandle {
	readonly ent: Entity;

	constructor(e: Entity) {
		this.ent = e;
	}

	abstract getValue<T>(simTime: number, klass: JType | null): T;

	abstract getValueAsDouble(simTime: number, def: number): number;

	abstract getUnitType(): JClass<Unit> | null;

	abstract getReturnType(): OutputReturnType | null;

	abstract getDescription(): string;

	abstract getTitle(): string;

	abstract getName(): string;

	abstract isReportable(): boolean;

	abstract getSequence(): number;

	abstract canCache(): boolean;

	getDeclaringClass(): JClass {
		return this.ent.constructor as JClass;
	}

	isNumericValue(): boolean {
		return ValueHandle.isNumericType(this.getReturnType());
	}

	isIntegerValue(): boolean {
		return ValueHandle.isIntegerType(this.getReturnType());
	}

	/** Java の double・int・long・float・short・char（と、その箱の型）。TS では型の名前の文字列で見る */
	static isNumericType(rtype: JType | string | null): boolean {

		if (rtype === "double") return true;
		if (rtype === "int") return true;
		if (rtype === "long") return true;
		if (rtype === "float") return true;
		if (rtype === "short") return true;
		if (rtype === "char") return true;

		if (rtype === "Double") return true;
		if (rtype === "Integer") return true;
		if (rtype === "Long") return true;
		if (rtype === "Float") return true;
		if (rtype === "Short") return true;
		if (rtype === "Character") return true;

		return false;
	}

	static isIntegerType(rtype: JType | string | null): boolean {

		if (rtype === "int") return true;
		if (rtype === "long") return true;

		if (rtype === "Integer") return true;
		if (rtype === "Long") return true;

		return false;
	}

	toString(): string {
		return this.getName();
	}

}
