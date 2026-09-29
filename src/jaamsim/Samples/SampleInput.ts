/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2013 Ausenco Engineering Canada Inc.
 * Copyright (C) 2016-2025 JaamSim Software Inc.
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

// 多重定義:
// - コンストラクタ SampleInput(key, cat, SampleProvider) と SampleInput(key, cat, double) は、def の型（number か）で見分ける。
//   SampleInput(key, cat, int) は static の SampleInput.ofInt(key, cat, def)（docs/renamed.md）。
// - setDefaultValue(double) と setDefaultValue(SampleProvider) は、引数の型で見分ける。
// - Input.getValue() と getValue(Entity, double, Class) は、引数の数で見分ける（Input.ts と同じく thisEnt の有無）。

import { Distribution } from "../ProbabilityDistributions/Distribution.ts";
import { Entity } from "../basicsim/Entity.ts";
import { ErrorException } from "../basicsim/ErrorException.ts";
import type { JaamSimModel } from "../basicsim/JaamSimModel.ts";
import { Input } from "../input/Input.ts";
import type { OutputReturnType } from "../input/OutputRegistry.ts";
import type { KeywordIndex } from "../input/KeywordIndex.ts";
import { DimensionlessUnit } from "../units/DimensionlessUnit.ts";
import type { Unit } from "../units/Unit.ts";
import { UserSpecifiedUnit } from "../units/UserSpecifiedUnit.ts";
import { tr } from "../i18n/I18n.ts";
import { ClassRegistry } from "../java/ClassRegistry.ts";
import { Double, jformat, jstr } from "../java/lang.ts";
import type { JClass } from "../java/lang.ts";
import { SampleConstant } from "./SampleConstant.ts";
import { SampleExpression } from "./SampleExpression.ts";
import { SampleProvider, isSampleProvider } from "./SampleProvider.ts";
import { TimeSeries } from "./TimeSeries.ts";
import { TimeSeriesConstantDouble } from "./TimeSeriesConstantDouble.ts";

/** Java の (int) x（0 の方向へ切り捨て、範囲外は端に張り付き、NaN は 0、-0 は 0） */
function toInt(x: number): number {
	if (Number.isNaN(x)) return 0;
	if (x >= 2147483647) return 2147483647;
	if (x <= -2147483648) return -2147483648;
	return Math.trunc(x) | 0;
}

export class SampleInput extends Input<SampleProvider> {
	private unitType: JClass<Unit> = DimensionlessUnit;
	private minValue: number = Double.NEGATIVE_INFINITY;
	private maxValue: number = Double.POSITIVE_INFINITY;
	private integerValue: boolean = false;

	constructor(key: string, cat: string, def: SampleProvider | number | null) {
		super(key, cat, typeof def === "number" ? new SampleConstant(def) : def);
	}

	/** Java の SampleInput(String key, String cat, int def) */
	static ofInt(key: string, cat: string, def: number): SampleInput {
		return new SampleInput(key, cat, SampleConstant.ofInt(def));
	}

	override setDefaultValue(def: SampleProvider | number | null): void {
		// setDefaultValue(double def)
		if (typeof def === "number") {
			this.setDefaultValue(new SampleConstant(def));
			return;
		}

		super.setDefaultValue(def);
		if (this.defValue instanceof SampleConstant)
			this.defValue.setUnitType(this.unitType);
		if (this.defValue instanceof TimeSeriesConstantDouble)
			this.defValue.setUnitType(this.unitType);
	}

	setUnitType(u: JClass<Unit>): void {

		if (u === this.unitType)
			return;

		if (!this.isDef)
			this.setValid(false);
		this.unitType = u;

		if (this.defValue instanceof SampleConstant)
			this.defValue.setUnitType(this.unitType);
		if (this.defValue instanceof TimeSeriesConstantDouble)
			this.defValue.setUnitType(this.unitType);
	}

	setValidRange(min: number, max: number): void {
		this.minValue = min;
		this.maxValue = max;
	}

	setIntegerValue(bool: boolean): void {
		this.integerValue = bool;
	}

	override applyConditioning(str: string): string {
		return SampleProvider.addQuotesIfNeeded(str);
	}

	/** @throws InputErrorException */
	override parse(thisEnt: Entity, kw: KeywordIndex): void {
		let sp: SampleProvider = Input.parseSampleExp(kw, thisEnt, this.minValue, this.maxValue, this.unitType);
		if (this.integerValue && sp instanceof SampleConstant)
			sp = SampleConstant.ofInt(toInt(sp.getNextSample(thisEnt, 0.0)));
		this.value = sp;
		this.setValid(true);
	}

	override getValidInputDesc(): string {
		if (this.integerValue) {
			return tr(Input.VALID_SAMPLE_PROV_INTEGER);
		}
		if (this.unitType === UserSpecifiedUnit) {
			return tr(Input.VALID_SAMPLE_PROV_UNIT);
		}
		if (this.unitType === DimensionlessUnit) {
			return tr(Input.VALID_SAMPLE_PROV_DIMLESS);
		}
		return jformat(tr(Input.VALID_SAMPLE_PROV), ClassRegistry.simpleName(this.unitType));
	}

	override getValidOptions(ent: Entity): string[] {
		const list: string[] = [];
		const simModel = ent.getJaamSimModel();
		// Java: simModel.getClonesOfIterator(Entity.class, SampleProvider.class)
		for (const each of simModel.getClonesOfIterator(Entity) as Iterable<Entity>) {
			if (!isSampleProvider(each))
				continue;
			const sp: SampleProvider = each;
			if (sp.getUnitType() === this.unitType && sp !== (ent as unknown))
				list.push(each.getName());
		}
		list.sort((a, b) => Input.uiSortOrder.compare(a, b));
		return list;
	}

	override getValueTokens(toks: string[]): void {
		if (this.value === null || this.isDef)
			return;

		// Preserve the exact text for a constant value input
		if (this.value instanceof SampleConstant) {
			if (this.integerValue) {
				this.value.getValueTokens(toks);
				return;
			}
			super.getValueTokens(toks);
			return;
		}

		// All other inputs can be built from scratch
		toks.push(this.value.toString());
	}

	override removeReferences(ent: Entity): boolean {
		if ((this.value as unknown) === ent) {
			this.reset();
			return true;
		}
		return false;
	}

	override appendEntityReferences(list: Entity[]): void {
		if (this.value instanceof Entity) {
			const entRef: Entity = this.value;
			if (list.includes(entRef))
				return;
			list.push(entRef);
			return;
		}

		if (this.value instanceof SampleExpression) {
			this.value.appendEntityReferences(list);
			return;
		}
	}

	override useExpressionBuilder(): boolean {
		return true;
	}

	override getDefaultString(simModel: JaamSimModel): string {
		if (this.defValue instanceof SampleConstant) {
			return this.defValue.getValueString(simModel);
		}
		return super.getDefaultString(simModel);
	}

	override getPresentValueString(thisEnt: Entity, simTime: number): string {
		if (this.value === null)
			return "";
		const simModel = thisEnt.getJaamSimModel();

		let sb = "";
		const ut = this.value.getUnitType();
		if (ut === DimensionlessUnit) {
			sb += jstr(this.value.getNextSample(thisEnt, simTime));
		}
		else {
			const unitString = simModel.getDisplayedUnit(ut!);
			const sifactor = simModel.getDisplayedUnitFactor(ut!);
			sb += jstr(this.value.getNextSample(thisEnt, simTime) / sifactor);
			sb += "[" + unitString + "]";
		}
		return sb;
	}

	getNextSample(thisEnt: Entity, simTime: number): number {
		try {
			const ret = this.getValue().getNextSample(thisEnt, simTime);

			const val = this.getValue();
			if (val instanceof SampleExpression && (ret < this.minValue || ret > this.maxValue)) {
				const msg = jformat(tr(Input.INP_ERR_DOUBLERANGE), this.minValue, this.maxValue, ret);
				const source = val.getExpressionString();
				throw new ErrorException(source, 0, thisEnt.getName(), "", -1, msg, null);
			}

			return ret;
		}
		catch (e) {
			if (e instanceof ErrorException) {
				if (e.entName.length === 0) {
					e.entName = thisEnt.getName();
					e.keyword = this.getKeyword();
					e.index = -1;
				}
				throw e;
			}
			throw new ErrorException(thisEnt, this.getKeyword(), e as Error);
		}
	}

	override getValue(): SampleProvider;
	override getValue<V>(thisEnt: Entity, simTime: number, klass: JClass<V> | OutputReturnType | null): V | null;
	override getValue(thisEnt?: Entity, simTime?: number, klass?: unknown): unknown {
		// Input と同じく、thisEnt の有無で getValue() と getValue(thisEnt, simTime, klass) を見分ける
		if (thisEnt === undefined)
			return super.getValue();
		return this.getNextSample(thisEnt, simTime as number);
	}

	override getReturnType(): OutputReturnType | null {
		return "double";
	}

	override getUnitType(): JClass<Unit> {
		return this.unitType;
	}

	override isIntegerValue(): boolean {
		return this.integerValue;
	}

	override validate(): void {
		super.validate();

		if (this.value instanceof Distribution) {
			const d: Distribution = this.value;
			const minSample = d.getMinValue(0.0);
			const maxSample = d.getMaxValue(0.0);
			if (minSample < this.minValue || maxSample > this.maxValue)
				throw new ErrorException(Input.INP_ERR_SAMPLERANGE, this.minValue, this.maxValue, String(this.value), minSample, maxSample);
		}

		if (this.value instanceof TimeSeries) {
			const ts: TimeSeries = this.value;
			const minSample = ts.getMinValue();
			const maxSample = ts.getMaxValue();
			if (minSample < this.minValue || maxSample > this.maxValue)
				throw new ErrorException(Input.INP_ERR_SAMPLERANGE, this.minValue, this.maxValue, String(this.value), minSample, maxSample);
		}
	}

}

