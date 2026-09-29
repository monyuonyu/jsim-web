/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2014 Ausenco Engineering Canada Inc.
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
 * TypeScript への移植 (C) 2026 shota
 */
import type { Entity } from "../basicsim/Entity.ts";
import type { JaamSimModel } from "../basicsim/JaamSimModel.ts";
import { Input } from "../input/Input.ts";
import type { KeywordIndex } from "../input/KeywordIndex.ts";
import type { OutputReturnType } from "../input/OutputRegistry.ts";
import { Double, type JClass } from "../java/lang.ts";
import { DimensionlessUnit } from "./DimensionlessUnit.ts";
import type { Unit } from "./Unit.ts";

const defFactors: number[] = [1.0];

export class SIUnitFactorInput extends Input<number[]> {
	// Java では初期値なし（0.0）。Input のコンストラクタは setDefaultValue を呼ばないので、ここで 0 にしてよい
	private siFactor = 0.0;

	constructor(key: string, cat: string) {
		super(key, cat, defFactors);
	}

	override parse(thisEnt: Entity, kw: KeywordIndex): void {
		const temp = Input.parseDoubles(thisEnt.getJaamSimModel(), kw, 1e-15, Double.POSITIVE_INFINITY, DimensionlessUnit);
		Input.assertCountRange(temp, 1, 2);
		const tmp: number[] = new Array<number>(temp.size()).fill(0.0);
		tmp[0] = temp.get(0);
		if (temp.size() === 2)
			tmp[1] = temp.get(1);

		this.calculateSI(tmp);
		this.value = tmp;
	}

	/** Java では package-private */
	getSIFactor(): number {
		return this.siFactor;
	}

	private calculateSI(factors: number[]): void {
		this.siFactor = factors[0];
		if (factors.length === 2)
			this.siFactor /= factors[1];
	}

	override setDefaultValue(val: number[] | null): void {
		super.setDefaultValue(val);
		this.calculateSI(this.value!);
	}

	override getDefaultString(simModel: JaamSimModel): string {
		return "1.0";
	}

	// Java は double[].class（Input.getReturnType は OutputReturnType の文字列を返す約束）
	override getReturnType(): OutputReturnType | null {
		return "double[]";
	}

	override getUnitType(): JClass<Unit> {
		return DimensionlessUnit;
	}
}
