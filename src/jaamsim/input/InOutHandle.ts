/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2018-2024 JaamSim Software Inc.
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
// 注: 戻り値の型（Java の Class<?>）は、OutputReturnType の文字列（ValueHandle.ts の注を参照）。
import { Integer, jformat } from "../internal.ts";
import type { JClass } from "../java/lang.ts";
import { tr } from "../internal.ts";
import type { Entity } from "../basicsim/Entity.ts";
import type { Unit } from "../units/Unit.ts";
import type { Input } from "./Input.ts";
import type { OutputReturnType } from "./OutputRegistry.ts";
import { ValueHandle } from "../internal.ts";
import type { JType } from "./ValueHandle.ts";

export class InOutHandle extends ValueHandle {

	private readonly in: Input<unknown>;
	private readonly name: string;
	private readonly returnType: OutputReturnType | null;
	private readonly unitType: JClass<Unit> | null;

	constructor(ent: Entity, inp: Input<unknown>, name: string, retType: OutputReturnType | null, ut: JClass<Unit> | null) {
		super(ent);
		this.in = inp;
		this.name = name;
		this.returnType = retType;
		this.unitType = ut;
	}

	override getValue<V>(simTime: number, klass: JType | null): V {
		return this.in.getValue<V>(this.ent, simTime, klass) as V;
	}

	override getReturnType(): OutputReturnType | null {
		return this.returnType;
	}

	override getDescription(): string {
		return jformat(tr("Value for the input '%s'."), this.name);
	}

	override getTitle(): string {
		return tr("Input Values");
	}

	override getName(): string {
		return this.name;
	}

	override getUnitType(): JClass<Unit> | null {
		return this.unitType;
	}

	override isIntegerValue(): boolean {
		return this.in.isIntegerValue();
	}

	override isReportable(): boolean {
		return this.in.isReportable();
	}

	override getSequence(): number {
		return Integer.MAX_VALUE;
	}
	override canCache(): boolean {
		return true;
	}

	/**
	 * Checks the output for all possible numerical types and returns a double representing the value
	 * （Java は double・int・boolean・long などの型ごとに分けて読む。Java の箱の型（Double など）は null なら def）
	 * @param simTime
	 * @param def - the default value if the return is null or not a number value
	 */
	override getValueAsDouble(simTime: number, def: number): number {
		const retType = this.getReturnType();

		if (retType === "double") {
			const val = this.getValue<number | null>(simTime, "double");
			if (val === null || val === undefined) return def;
			return val;
		}

		if (retType === "int") {
			const val = this.getValue<number | null>(simTime, "int");
			if (val === null || val === undefined) return def;
			return val;
		}

		if (retType === "boolean") {
			const val = this.getValue<boolean | null>(simTime, "boolean");
			if (val === null || val === undefined) return def;
			return val ? 1.0 : 0.0;
		}

		if (retType === "long") {
			const val = this.getValue<number | null>(simTime, "long");
			if (val === null || val === undefined) return def;
			return val;
		}

		return def;
	}
}
