/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2013 Ausenco Engineering Canada Inc.
 * Copyright (C) 2017-2026 JaamSim Software Inc.
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
// - コンストラクタ ValueListInput(key, cat, DoubleVector) と ValueListInput(key, cat, double) は、
//   def の型（typeof number）で見分けて 1 つにした。
import type { Entity } from "../basicsim/Entity.ts";
import type { JaamSimModel } from "../basicsim/JaamSimModel.ts";
import { DoubleVector } from "../datatypes/DoubleVector.ts";
import { tr } from "../i18n/I18n.ts";
import { Double, jstr } from "../java/lang.ts";
import type { JClass } from "../java/lang.ts";
import { DimensionlessUnit } from "../units/DimensionlessUnit.ts";
import { Unit } from "../units/Unit.ts";
import { Input } from "./Input.ts";
import type { KeywordIndex } from "./KeywordIndex.ts";
import { ListInput } from "./ListInput.ts";
import type { OutputReturnType } from "./OutputRegistry.ts";

export class ValueListInput extends ListInput<DoubleVector> {
	private unitType: JClass<Unit> = DimensionlessUnit;
	private minValue = Double.NEGATIVE_INFINITY;
	private maxValue = Double.POSITIVE_INFINITY;
	private sumValue = Double.NaN;
	private sumTolerance = 1e-10;
	private sumMin = Double.NEGATIVE_INFINITY;
	private sumMax = Double.POSITIVE_INFINITY;
	private validCounts: number[] | null = null; // valid list sizes not including units
	private monotonic = 0;  // -1 = monotonically decreasing, +1 = monotonically increasing

	constructor(key: string, cat: string, def: DoubleVector | number | null) {
		// Java の new DoubleVector(double...)（値が 1 つの DoubleVector）
		super(key, cat, typeof def === "number" ? DoubleVector.ofValues(def) : def);
	}

	setUnitType(units: JClass<Unit>): void {
		if (units !== this.unitType)
			this.reset();
		this.unitType = units;
	}

	override getReturnType(): OutputReturnType | null {
		return "DoubleVector";
	}

	override getUnitType(): JClass<Unit> | null {
		return this.unitType;
	}

	/** @throws InputErrorException */
	override parse(thisEnt: Entity, kw: KeywordIndex): void {
		const temp = Input.parseDoubles(thisEnt.getJaamSimModel(), kw, this.minValue, this.maxValue, this.unitType);
		// Java の assertCount(DoubleVector, int...) は counts が null なら何もしない
		Input.assertCount(temp, ...(this.validCounts ?? []));
		Input.assertCountRange(temp, this.minCount, this.maxCount);
		Input.assertMonotonic(temp, this.monotonic);
		if (!Number.isNaN(this.sumValue))
			Input.assertSumTolerance(temp, this.sumValue, this.sumTolerance);
		Input.assertSumRange(temp, this.sumMin, this.sumMax);

		this.value = temp;
	}

	override getValidInputDesc(): string {
		if (this.unitType === DimensionlessUnit) {
			return tr(Input.VALID_VALUE_LIST_DIMLESS);
		}
		return tr(Input.VALID_VALUE_LIST);
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

	setValidSum(sum: number, tol: number): void {
		this.sumValue = sum;
		this.sumTolerance = tol;
	}

	setValidSumRange(min: number, max: number): void {
		this.sumMin = min;
		this.sumMax = max;
	}

	setValidCounts(...list: number[]): void {
		this.validCounts = list;
	}

	setMonotonic(dir: number): void {
		this.monotonic = dir;
	}

	override getDefaultString(simModel: JaamSimModel | null): string {
		if (this.defValue === null || this.defValue.size() === 0)
			return "";

		// Java では simModel が null なら NullPointerException
		const sm = simModel as JaamSimModel;
		let tmp = "";
		for (let i = 0; i < this.defValue.size(); i++) {
			if (i > 0)
				tmp += Input.SEPARATOR;
			tmp += jstr(this.defValue.get(i)/sm.getDisplayedUnitFactor(this.unitType));
		}

		if (this.unitType !== Unit) {
			tmp += Input.SEPARATOR;
			tmp += sm.getDisplayedUnit(this.unitType);
		}

		return tmp;
	}
}
