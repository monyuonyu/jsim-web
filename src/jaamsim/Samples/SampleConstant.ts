/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2013 Ausenco Engineering Canada Inc.
 * Copyright (C) 2020-2024 JaamSim Software Inc.
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

// 多重定義: SampleConstant(Class, double) と SampleConstant(double) は同じコンストラクタで引数の数で見分ける。
// SampleConstant(int) は static の SampleConstant.ofInt(val)（docs/renamed.md）。

import type { Entity } from "../basicsim/Entity.ts";
import type { JaamSimModel } from "../basicsim/JaamSimModel.ts";
import { Input } from "../internal.ts";
import { DimensionlessUnit } from "../internal.ts";
import { Unit } from "../internal.ts";
import { jstr } from "../internal.ts";
import type { JClass } from "../java/lang.ts";
import type { SampleProvider } from "./SampleProvider.ts";

/** Java の (int) x（0 の方向へ切り捨て、範囲外は端に張り付き、NaN は 0、-0 は 0） */
function toInt(x: number): number {
	if (Number.isNaN(x)) return 0;
	if (x >= 2147483647) return 2147483647;
	if (x <= -2147483648) return -2147483648;
	return Math.trunc(x) | 0;
}

export class SampleConstant implements SampleProvider {
	private unitType: JClass<Unit>;
	private integerValue: boolean = false;
	private readonly val: number;

	constructor(unitType: JClass<Unit>, val: number);
	constructor(val: number);
	constructor(a: JClass<Unit> | number, b?: number) {
		if (typeof a === "number") {
			// SampleConstant(double val) → this(DimensionlessUnit.class, val)
			this.unitType = DimensionlessUnit;
			this.val = a;
			this.integerValue = false;
			return;
		}
		this.unitType = a;
		this.val = b as number;
		this.integerValue = false;
	}

	/** Java の SampleConstant(int val) */
	static ofInt(val: number): SampleConstant {
		const ret = new SampleConstant(DimensionlessUnit, val);
		ret.integerValue = true;
		return ret;
	}

	setUnitType(ut: JClass<Unit>): void {
		this.unitType = ut;
	}

	getUnitType(): JClass<Unit> {
		return this.unitType;
	}

	getNextSample(thisEnt: Entity | null, simTime: number): number {
		return this.val;
	}

	getMeanValue(simTime: number): number {
		return this.val;
	}

	getValueString(simModel: JaamSimModel): string {
		if (Number.isNaN(this.val))
			return "";

		if (this.integerValue)
			return String(toInt(this.val));

		let tmp = "";
		tmp += jstr(this.val / simModel.getDisplayedUnitFactor(this.unitType));
		if (this.unitType !== DimensionlessUnit)
			tmp += Input.SEPARATOR + simModel.getDisplayedUnit(this.unitType);
		return tmp;
	}

	toString(): string {
		if (this.integerValue)
			return String(toInt(this.val));

		let tmp = "";
		tmp += jstr(this.val);
		if (this.unitType !== DimensionlessUnit)
			tmp += Input.SEPARATOR + Unit.getSIUnit(this.unitType);
		return tmp;
	}

	getValueTokens(toks: string[]): void {

		if (this.integerValue) {
			toks.push(String(toInt(this.val)));
			return;
		}

		toks.push(jstr(this.val));
		if (this.unitType !== DimensionlessUnit)
			toks.push(Unit.getSIUnit(this.unitType));
		return;
	}
}
