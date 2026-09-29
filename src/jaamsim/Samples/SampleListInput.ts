/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2015 Ausenco Engineering Canada Inc.
 * Copyright (C) 2017-2026 JaamSim Software Inc.
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
// - コンストラクタ SampleListInput(key, cat, ArrayList) と SampleListInput(key, cat, double) は、def の型（number か）で見分ける。
//   SampleListInput(key, cat, int) は static の SampleListInput.ofInt(key, cat, def)（docs/renamed.md）。
// - getUnitType() と getUnitType(int i) は、引数の有無で見分ける。
// - getNextIntegers(Entity, double) と getNextIntegers(Entity, double, int) は、3 つ目の引数の有無で見分ける。
// - Input.getValue() と getValue(Entity, double, Class) は、引数の数で見分ける（Input.ts と同じく thisEnt の有無）。

import { Entity } from "../basicsim/Entity.ts";
import { ErrorException } from "../basicsim/ErrorException.ts";
import type { JaamSimModel } from "../basicsim/JaamSimModel.ts";
import { ArrayListInput } from "../input/ArrayListInput.ts";
import { Input } from "../input/Input.ts";
import type { OutputReturnType } from "../input/OutputRegistry.ts";
import { InputErrorException } from "../input/InputErrorException.ts";
import { KeywordIndex } from "../input/KeywordIndex.ts";
import { Parser } from "../input/Parser.ts";
import { DimensionlessUnit } from "../units/DimensionlessUnit.ts";
import type { Unit } from "../units/Unit.ts";
import { tr } from "../i18n/I18n.ts";
import { Double, IndexOutOfBoundsException, jformat, jstr } from "../java/lang.ts";
import type { JClass } from "../java/lang.ts";
import { SampleConstant } from "./SampleConstant.ts";
import { SampleExpression } from "./SampleExpression.ts";
import { SampleProvider, isSampleProvider } from "./SampleProvider.ts";

/** Java の (int) x（0 の方向へ切り捨て、範囲外は端に張り付き、NaN は 0、-0 は 0） */
function toInt(x: number): number {
	if (Number.isNaN(x)) return 0;
	if (x >= 2147483647) return 2147483647;
	if (x <= -2147483648) return -2147483648;
	return Math.trunc(x) | 0;
}

export class SampleListInput extends ArrayListInput<SampleProvider> {

	private readonly unitTypeList: (JClass<Unit> | null)[] = [];
	private dimensionless: boolean = false;
	private minValue: number = Double.NEGATIVE_INFINITY;
	private maxValue: number = Double.POSITIVE_INFINITY;
	private integerValue: boolean = false;
	private monotonic: number = 0;  // -1 = monotonically decreasing, +1 = monotonically increasing

	constructor(key: string, cat: string, def: SampleProvider[] | number | null) {
		// SampleListInput(String key, String cat, double def)
		super(key, cat, typeof def === "number" ? [new SampleConstant(def)] : def);
	}

	/** Java の SampleListInput(String key, String cat, int def) */
	static ofInt(key: string, cat: string, def: number): SampleListInput {
		return new SampleListInput(key, cat, [SampleConstant.ofInt(def)]);
	}

	private setUnitTypeList(utList: (JClass<Unit> | null)[]): void {

		// utList.equals(unitTypeList)
		if (utList.length === this.unitTypeList.length
				&& utList.every((ut, i) => ut === this.unitTypeList[i]))
			return;

		// Save the new unit types
		if (!this.isDef)
			this.setValid(false);
		this.unitTypeList.length = 0;
		this.unitTypeList.push(...utList);

		// Set the units for the default value column in the Input Editor
		if (this.defValue === null)
			return;
		for (let i = 0; i < this.defValue.length; i++) {
			const p = this.defValue[i];
			if (p instanceof SampleConstant)
				p.setUnitType(this.getUnitType(i) as JClass<Unit>);
		}
	}

	setUnitType(u: JClass<Unit> | null): void {
		const utList: (JClass<Unit> | null)[] = [];
		utList.push(u);
		this.setUnitTypeList(utList);
	}

	setDimensionless(bool: boolean): void {
		this.dimensionless = bool;
	}

	setIntegerValue(bool: boolean): void {
		this.integerValue = bool;
	}

	setMonotonic(dir: number): void {
		this.monotonic = dir;
	}

	/**
	 * getUnitType(int i):
	 * Returns the unit type for the specified expression.
	 * <p>
	 * If the number of expressions exceeds the number of unit types
	 * then the last unit type in the list is returned.
	 * @param i - index of the expression
	 * @return unit type for the expression
	 *
	 * getUnitType(): 最初の単位の種類（Java の unitTypeList.get(0)）
	 */
	override getUnitType(i?: number): JClass<Unit> | null {
		if (i === undefined) {
			if (this.unitTypeList.length === 0)
				throw new IndexOutOfBoundsException("Index 0 out of bounds for length 0");
			return this.unitTypeList[0];
		}
		if (this.unitTypeList.length === 0)
			return null;
		const k = Math.min(i, this.unitTypeList.length - 1);
		return this.unitTypeList[k];
	}

	setValidRange(min: number, max: number): void {
		this.minValue = min;
		this.maxValue = max;
	}

	override applyConditioning(str: string): string {
		if (!str.includes("{")) {
			return str;
		}
		const array = Parser.splitSubstrings(str);
		let sb = "";
		for (let i = 0; i < array.length; i++) {
			array[i] = SampleProvider.addQuotesIfNeeded(array[i]);
			sb += "{" + array[i] + "}";
		}
		return sb;
	}

	/** @throws InputErrorException */
	override parse(thisEnt: Entity, kw: KeywordIndex): void {
		const subArgs = kw.getSubArgs();

		// Simple format without inner braces
		if (this.dimensionless && subArgs.length === 1) {
			const subArg = subArgs[0];
			const temp: SampleProvider[] = [];
			for (let i = 0; i < subArg.numArgs(); i++) {
				const argKw = new KeywordIndex(subArg, i, i + 1);
				try {
					let sp: SampleProvider = Input.parseSampleExp(argKw, thisEnt, this.minValue, this.maxValue, this.getUnitType(i) as JClass<Unit>);  // Java は null のまま渡す
					if (this.integerValue && sp instanceof SampleConstant)
						sp = SampleConstant.ofInt(toInt(sp.getNextSample(thisEnt, 0.0)));
					temp.push(sp);
				}
				catch (e) {
					if (!(e instanceof InputErrorException)) throw e;
					let msg = e.getMessage();
					if (subArg.numArgs() > 1)
						msg = jformat(tr(Input.INP_ERR_ELEMENT), i + 1, e.getMessage());
					throw new InputErrorException(e.position, e.source, msg, e);
				}
			}
			if (this.monotonic !== 0 && SampleListInput.isConstant(temp)) {
				Input.assertMonotonic(this.getConstantValues(temp), this.monotonic);
			}
			this.value = temp;
			this.setValid(true);
			return;
		}

		// Normal format with inner braces
		const temp: SampleProvider[] = [];
		for (let i = 0; i < subArgs.length; i++) {
			const subArg = subArgs[i];
			try {
				let sp: SampleProvider = Input.parseSampleExp(subArg, thisEnt, this.minValue, this.maxValue, this.getUnitType(i) as JClass<Unit>);  // Java は null のまま渡す
				if (this.integerValue && sp instanceof SampleConstant)
					sp = SampleConstant.ofInt(toInt(sp.getNextSample(thisEnt, 0.0)));
				temp.push(sp);
			}
			catch (e) {
				if (!(e instanceof InputErrorException)) throw e;
				let msg = e.getMessage();
				if (subArg.numArgs() > 1)
					msg = jformat(tr(Input.INP_ERR_ELEMENT), i + 1, e.getMessage());
				throw new InputErrorException(e.position, e.source, msg, e);
			}
		}
		if (this.monotonic !== 0 && SampleListInput.isConstant(temp)) {
			Input.assertMonotonic(this.getConstantValues(temp), this.monotonic);
		}
		this.value = temp;
		this.setValid(true);
	}

	override getValidInputDesc(): string {
		if (this.integerValue)
			return tr(Input.VALID_SAMPLE_LIST_INTEGER);
		if (this.dimensionless) {
			return tr(Input.VALID_SAMPLE_LIST_DIMLESS);
		}
		return tr(Input.VALID_SAMPLE_LIST);
	}

	override getValidOptions(ent: Entity): string[] {
		const list: string[] = [];
		const simModel = ent.getJaamSimModel();
		// Java: simModel.getClonesOfIterator(Entity.class, SampleProvider.class)
		for (const each of simModel.getClonesOfIterator(Entity) as Iterable<Entity>) {
			if (!isSampleProvider(each))
				continue;
			const samp: SampleProvider = each;
			if (this.unitTypeList.includes(samp.getUnitType()))
				list.push(each.getName());
		}
		list.sort((a, b) => Input.uiSortOrder.compare(a, b));
		return list;
	}

	override getValueTokens(toks: string[]): void {
		if (this.value === null || this.valueTokens === null || this.isDef)
			return;

		// No inner braces
		if (this.valueTokens[0] !== "{") {
			for (let i = 0; i < this.value.length; i++) {
				if (this.value[i] instanceof SampleConstant && !this.integerValue) {
					toks.push(this.valueTokens[i]);
					// Single input value with dimensions
					if (!this.dimensionless && this.getUnitType(i) !== DimensionlessUnit && i + 1 < this.valueTokens.length) {
						toks.push(this.valueTokens[i + 1]);
						return;
					}
				}
				else
					toks.push(this.value[i].toString());
			}
			return;
		}

		// With inner braces
		for (let i = 0; i < this.value.length; i++) {
			toks.push("{");
			if (this.value[i] instanceof SampleConstant && !this.integerValue)
				this.getSubValueTokens(i, toks);
			else
				toks.push(this.value[i].toString());
			toks.push("}");
		}
	}

	override getDefaultString(simModel: JaamSimModel): string {
		if (this.defValue === null || this.defValue.length === 0) {
			return "";
		}

		let tmp = "";
		for (let i = 0; i < this.defValue.length; i++) {
			if (i > 0)
				tmp += Input.SEPARATOR;
			tmp += String(this.defValue[i]);
		}

		return tmp;
	}

	override removeReferences(ent: Entity): boolean {
		if (this.value !== null && isSampleProvider(ent)) {
			// value.removeAll(Collections.singleton(ent))（同じ配列の中で消す）
			let ret = false;
			for (let i = this.value.length - 1; i >= 0; i--) {
				if ((this.value[i] as unknown) === ent) {
					this.value.splice(i, 1);
					ret = true;
				}
			}
			return ret;
		}
		return false;
	}

	override appendEntityReferences(list: Entity[]): void {
		if (this.value === null)
			return;
		for (const samp of this.value) {
			if (samp instanceof Entity) {
				const sampEnt: Entity = samp;
				if (list.includes(sampEnt))
					continue;
				list.push(sampEnt);
				continue;
			}

			if (samp instanceof SampleExpression) {
				samp.appendEntityReferences(list);
				continue;
			}
		}
	}

	override useExpressionBuilder(): boolean {
		return true;
	}

	override getPresentValueString(thisEnt: Entity, simTime: number): string {
		if (this.value === null)
			return "";
		const simModel = thisEnt.getJaamSimModel();

		let sb = "";
		for (let i = 0; i < this.value.length; i++) {
			const samp = this.value[i];
			if (i > 0)
				sb += Input.BRACE_SEPARATOR;
			sb += "{" + Input.BRACE_SEPARATOR;
			const ut = samp.getUnitType();
			if (ut === DimensionlessUnit) {
				sb += jstr(samp.getNextSample(thisEnt, simTime));
			}
			else {
				const unitString = simModel.getDisplayedUnit(ut);
				const sifactor = simModel.getDisplayedUnitFactor(ut);
				sb += jstr(samp.getNextSample(thisEnt, simTime) / sifactor);
				sb += "[" + unitString + "]";
			}
			sb += Input.BRACE_SEPARATOR + "}";
		}
		return sb;
	}

	/**
	 * isConstant(): この入力の値が全部定数か。
	 * static の isConstant(ArrayList) は SampleListInput.isConstant(list)。
	 */
	isConstant(): boolean {
		return SampleListInput.isConstant(this.getValue());
	}

	static isConstant(list: SampleProvider[]): boolean {
		let ret = true;
		for (const sp of list) {
			ret = ret && (sp instanceof SampleConstant);
		}
		return ret;
	}

	getConstantValues(list: SampleProvider[]): number[] {
		const ret = new Array<number>(list.length).fill(0);
		for (let i = 0; i < list.length; i++) {
			const sp = list[i];
			if (sp instanceof SampleConstant) {
				ret[i] = sp.getNextSample(null as unknown as Entity, 0.0);  // Java も null を渡す
			}
		}
		return ret;
	}

	getNextSample(i: number, thisEnt: Entity, simTime: number): number {
		try {
			return this.getValue()[i].getNextSample(thisEnt, simTime);
		}
		catch (e) {
			if (e instanceof ErrorException) {
				if (e.entName.length === 0) {
					e.entName = thisEnt.getName();
					e.keyword = this.getKeyword();
					e.index = i + 1;
				}
				throw e;
			}
			throw new ErrorException(thisEnt, this.getKeyword(), i + 1, e as Error);
		}
	}

	getNextDoubles(thisEnt: Entity, simTime: number): number[] {
		const ret = new Array<number>(this.getListSize()).fill(0);
		for (let i = 0; i < this.getListSize(); i++) {
			ret[i] = this.getNextSample(i, thisEnt, simTime);
			if (this.integerValue)
				ret[i] = toInt(ret[i]);
		}
		if (this.monotonic !== 0 && !this.isConstant()) {
			Input.assertMonotonic(ret, this.monotonic);
		}
		return ret;
	}

	getNextIntegers(thisEnt: Entity, simTime: number, length?: number): number[] {
		if (length === undefined)
			return this.getNextIntegers(thisEnt, simTime, this.getListSize());

		const ret = new Array<number>(length).fill(0);
		for (let i = 0; i < length; i++) {
			const ind = Math.min(i, this.getListSize() - 1);
			ret[i] = toInt(this.getNextSample(ind, thisEnt, simTime));
		}
		return ret;
	}

	override getValue(): SampleProvider[];
	override getValue<V>(thisEnt: Entity, simTime: number, klass: JClass<V> | OutputReturnType | null): V | null;
	override getValue(thisEnt?: Entity, simTime?: number, klass?: unknown): unknown {
		// Input と同じく、thisEnt の有無で getValue() と getValue(thisEnt, simTime, klass) を見分ける
		if (thisEnt === undefined)
			return super.getValue();
		return this.getNextDoubles(thisEnt, simTime as number);
	}

	override getReturnType(): OutputReturnType | null {
		return "double[]";
	}

}
