/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2010-2015 Ausenco Engineering Canada Inc.
 * Copyright (C) 2019-2022 JaamSim Software Inc.
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
// 注（多重定義）: コンストラクタ RunNumberInput(key, cat, SampleProvider) と (key, cat, int) は、
// def の型（typeof number）で見分ける（int の方は SampleConstant.ofInt）。
import { Integer } from "../internal.ts";
import { tr } from "../internal.ts";
import { SampleConstant } from "../internal.ts";
import { SampleInput } from "../internal.ts";
import type { SampleProvider } from "../Samples/SampleProvider.ts";
import type { Entity } from "../basicsim/Entity.ts";
import { JaamSimModel } from "../internal.ts";
import { IntegerVector } from "../internal.ts";
import { Input } from "../internal.ts";
import { InputErrorException } from "../internal.ts";
import type { KeywordIndex } from "./KeywordIndex.ts";
import { jsplit } from "../internal.ts";

export class RunNumberInput extends SampleInput {

	private rangeList: IntegerVector;
	private max: number;

	constructor(key: string, cat: string, def: SampleProvider | number | null) {
		super(key, cat, typeof def === "number" ? SampleConstant.ofInt(def) : def);
		this.rangeList = new IntegerVector(1);
		this.max = Integer.MAX_VALUE;
	}

	setRunIndexRangeList(list: IntegerVector): void {

		// If the index ranges have not changed, then do nothing
		if (list.size() === this.rangeList.size()) {
			let equal = true;
			for (let i=0; i<list.size(); i++) {
				if (list.get(i) !== this.rangeList.get(i)) {
					equal = false;
					break;
				}
			}
			if (equal)
				return;
		}

		this.reset();
		this.rangeList = list;
		this.max = 1;
		for (let i=0; i<this.rangeList.size(); i++) {
			this.max = Math.imul(this.max, this.rangeList.get(i));  // Java の int の掛け算（あふれは折り返す）
		}
		if (this.rangeList.size() === 0)
			this.max = Integer.MAX_VALUE;
		this.setValidRange(1, this.max);
	}

	/** @throws InputErrorException */
	override parse(thisEnt: Entity, kw: KeywordIndex): void {
		Input.assertCount(kw, 1);
		const data = jsplit(kw.getArg(0), "-");

		// Run number entered as a number or expression
		if (data.length !== this.rangeList.size()) {
			super.parse(thisEnt, kw);
			return;
		}

		// Run number entered as a series of run indices
		const indexList = new IntegerVector(data.length);
		indexList.fillWithEntriesOf(data.length, 0);
		for (let i=0; i<data.length; i++) {
			const val = Input.parseInteger(data[i]);

			if (val > this.rangeList.get(i))
				throw new InputErrorException(tr("The run index value %s exceeds the defined range "
						+ "of %s."), val, this.rangeList.get(i));
			if (val <= 0)
				throw new InputErrorException(tr("The run index value must be greater than or equal "
						+ "to 1. Received: %s"), val);

			indexList.set(i, val);
		}

		const temp = JaamSimModel.getRunNumber(indexList, this.rangeList);
		if (temp < 1 || temp > this.max)
			throw new InputErrorException(tr(Input.INP_ERR_INTEGERRANGE), 1, this.max, temp);

		this.value = SampleConstant.ofInt(temp);
	}

	override getValidInputDesc(): string {
		return tr(Input.VALID_SCENARIO_NUMBER);
	}

	override getValueTokens(toks: string[]): void {
		if (this.value === null || this.isDef)
			return;

		if (this.rangeList.size() === 0) {
			super.getValueTokens(toks);
			return;
		}

		if (this.valueTokens === null)
			return;

		for (const each of this.valueTokens)
			toks.push(each);
	}

}
