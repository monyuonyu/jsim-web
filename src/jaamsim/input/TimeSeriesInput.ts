/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2013 Ausenco Engineering Canada Inc.
 * Copyright (C) 2018-2026 JaamSim Software Inc.
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
// 注（多重定義）:
// - コンストラクタ TimeSeriesInput(key, cat, TimeSeriesProvider) と (key, cat, double) は、def の型（typeof number）で見分ける。
// - getValue() と getValue(thisEnt, simTime, klass) は、引数の数で見分ける（Input.ts と同じ）。
// - Java の TimeSeriesProvider.class（interface）は、JInterface（TimeSeriesProviderInterface）で渡す。
import { jformat, Double } from "../internal.ts";
import type { JClass } from "../java/lang.ts";
import { ClassRegistry } from "../internal.ts";
import { tr } from "../internal.ts";
import { TimeSeriesConstantDouble } from "../internal.ts";
import type { TimeSeriesProvider } from "../Samples/TimeSeriesProvider.ts";
import { isTimeSeriesProvider } from "../internal.ts";
import { Entity } from "../internal.ts";
import type { JaamSimModel } from "../basicsim/JaamSimModel.ts";
import { DimensionlessUnit } from "../internal.ts";
import type { Unit } from "../units/Unit.ts";
import { UserSpecifiedUnit } from "../internal.ts";
import { Input } from "../internal.ts";
import type { JInterface } from "./Input.ts";
import { InputErrorException } from "../internal.ts";
import type { KeywordIndex } from "./KeywordIndex.ts";
import type { OutputReturnType } from "./OutputRegistry.ts";

/** TimeSeriesProvider（Java の interface）を Class として渡す所の代わり */
const TimeSeriesProviderInterface: JInterface<TimeSeriesProvider> = {
	javaName: "com.jaamsim.Samples.TimeSeriesProvider",
	isInstance: (o: unknown): o is TimeSeriesProvider => isTimeSeriesProvider(o),
};

export class TimeSeriesInput extends Input<TimeSeriesProvider> {
	private unitType: JClass<Unit> = DimensionlessUnit;

	constructor(key: string, cat: string, def: TimeSeriesProvider | number | null) {
		super(key, cat, typeof def === "number" ? new TimeSeriesConstantDouble(def) : def);
	}

	setUnitType(u: JClass<Unit>): void {
		if (u !== this.unitType)
			this.reset();
		this.unitType = u;
		if (this.defValue instanceof TimeSeriesConstantDouble)
			this.defValue.setUnitType(this.unitType);
	}

	/** @throws InputErrorException */
	override parse(thisEnt: Entity, kw: KeywordIndex): void {
		Input.assertCountRange(kw, 1, 2);

		// Try to parse as a constant value
		try {
			const tmp = Input.parseDoubles(thisEnt.getJaamSimModel(), kw, Double.NEGATIVE_INFINITY, Double.POSITIVE_INFINITY, this.unitType);
			Input.assertCount(tmp, 1);
			this.value = new TimeSeriesConstantDouble(this.unitType, tmp.get(0));
			return;
		}
		catch (e) {
			if (!(e instanceof InputErrorException))
				throw e;
		}

		// If not a constant, try parsing a TimeSeriesProvider
		Input.assertCount(kw, 1);
		const ent = Input.parseEntity(thisEnt.getJaamSimModel(), kw.getArg(0), Entity);
		const s = Input.castImplements(ent, TimeSeriesProviderInterface);
		if( s.getUnitType() !== UserSpecifiedUnit )
			Input.assertUnitsMatch(this.unitType, s.getUnitType());
		this.value = s;
	}

	override getValidInputDesc(): string {
		if (this.unitType === UserSpecifiedUnit) {
			return tr(Input.VALID_TIMESERIES_PROV_UNIT);
		}
		return jformat(tr(Input.VALID_TIMESERIES_PROV), ClassRegistry.simpleName(this.unitType));
	}

	override getValidOptions(ent: Entity | null): string[] {
		const list: string[] = [];
		const simModel = (ent as Entity).getJaamSimModel();
		for (const each of simModel.getClonesOfIterator(Entity, isTimeSeriesProvider)) {
			const tsp = each as unknown as TimeSeriesProvider;
			if (tsp.getUnitType() === this.unitType)
				list.push(each.getName());
		}
		list.sort((a, b) => Input.uiSortOrder.compare(a, b));
		return list;
	}

	override getValueTokens(toks: string[]): void {
		if (this.value === null || this.isDef)
			return;

		if (this.value instanceof TimeSeriesConstantDouble) {
			super.getValueTokens(toks);
			return;
		}
		else {
			toks.push((this.value as unknown as Entity).getName());
		}
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
			const entref = this.value;
			if (list.includes(entref))
				return;
			list.push(entref);
		}
	}

	override getDefaultString(simModel: JaamSimModel | null): string {
		if (this.defValue instanceof TimeSeriesConstantDouble) {
			return this.defValue.getValueString(simModel as JaamSimModel);
		}
		return super.getDefaultString(simModel);
	}

	override getValue(): TimeSeriesProvider | null;
	override getValue<V>(thisEnt: Entity, simTime: number, klass: JClass<V> | OutputReturnType | null): V | null;
	override getValue(thisEnt?: Entity, simTime?: number, klass?: unknown): unknown {
		if (thisEnt === undefined)
			return super.getValue();
		const val = this.getValue();
		if (val === null)
			return null;
		return val.getNextSample(thisEnt, simTime as number);
	}

	override getReturnType(): OutputReturnType | null {
		return "double";
	}

	override getUnitType(): JClass<Unit> | null {
		return this.unitType;
	}

}
