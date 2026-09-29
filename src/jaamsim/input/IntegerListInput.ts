/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2010-2011 Ausenco Engineering Canada Inc.
 * Copyright (C) 2021-2026 JaamSim Software Inc.
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
// 注（多重定義の扱い）:
// - setDefaultValue(IntegerVector)（基底）と setDefaultValue(int... args) は、引数の型で見分けて 1 つにした
//   （IntegerVector か null なら基底の版、数なら int... の版）。
import type { Entity } from "../basicsim/Entity.ts";
import type { JaamSimModel } from "../basicsim/JaamSimModel.ts";
import { IntegerVector } from "../datatypes/IntegerVector.ts";
import { Integer } from "../java/lang.ts";
import type { JClass } from "../java/lang.ts";
import { DimensionlessUnit } from "../units/DimensionlessUnit.ts";
import type { Unit } from "../units/Unit.ts";
import { Input } from "./Input.ts";
import type { KeywordIndex } from "./KeywordIndex.ts";
import { ListInput } from "./ListInput.ts";
import type { OutputReturnType } from "./OutputRegistry.ts";

export class IntegerListInput extends ListInput<IntegerVector> {
	private minValue = Integer.MIN_VALUE;
	private maxValue = Integer.MAX_VALUE;
	protected validCounts: number[]; // valid list sizes not including units

	constructor(key: string, cat: string, def: IntegerVector | null) {
		super(key, cat, def);
		this.validCounts = [];
	}

	override setDefaultValue(...args: (IntegerVector | null)[] | number[]): void {
		if (args.length === 1 && typeof args[0] !== "number") {
			super.setDefaultValue(args[0]);
			return;
		}
		const nums = args as number[];
		const def = new IntegerVector(nums.length);
		for (const each of nums) {
			def.add(each);
		}
		this.setDefaultValue(def);
	}

	/** @throws InputErrorException */
	override parse(thisEnt: Entity, kw: KeywordIndex): void {
		Input.assertCountRange(kw, this.minCount, this.maxCount);
		Input.assertCount(kw, ...this.validCounts);
		this.value = Input.parseIntegerVector(kw, this.minValue, this.maxValue);
	}

	override getListSize(): number {
		const val = this.getValue();
		if (val === null)
			return 0;
		else
			return val.size();
	}

	setValidRange(min: number, max: number): void {
		this.minValue = min;
		this.maxValue = max;
	}

	setValidCounts(...list: number[]): void {
		this.validCounts = list;
	}

	override getDefaultString(simModel: JaamSimModel | null): string {
		if (this.defValue === null || this.defValue.size() === 0)
			return "";

		let tmp = "";
		tmp += String(this.defValue.get(0));
		for (let i = 1; i < this.defValue.size(); i++) {
			tmp += Input.SEPARATOR;
			tmp += String(this.defValue.get(i));
		}

		return tmp;
	}

	override getReturnType(): OutputReturnType | null {
		return "IntegerVector";
	}

	override getUnitType(): JClass<Unit> | null {
		return DimensionlessUnit;
	}
}
