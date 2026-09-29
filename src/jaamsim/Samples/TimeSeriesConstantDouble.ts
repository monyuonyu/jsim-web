/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2013 Ausenco Engineering Canada Inc.
 * Copyright (C) 2020-2022 JaamSim Software Inc.
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

// 多重定義: TimeSeriesConstantDouble(Class, double) と (double) は引数の数で見分ける。
// getNextSample(double) と getNextSample(Entity, double) も引数の数で見分ける。

import type { Entity } from "../basicsim/Entity.ts";
import type { JaamSimModel } from "../basicsim/JaamSimModel.ts";
import { Input } from "../internal.ts";
import { DimensionlessUnit } from "../internal.ts";
import { Unit } from "../internal.ts";
import { Double, Long, jstr } from "../internal.ts";
import type { JClass } from "../java/lang.ts";
import type { TimeSeriesProvider } from "./TimeSeriesProvider.ts";

export class TimeSeriesConstantDouble implements TimeSeriesProvider {
	private unitType: JClass<Unit>;
	private readonly val: number;

	constructor(unitType: JClass<Unit>, val: number);
	constructor(val: number);
	constructor(a: JClass<Unit> | number, b?: number) {
		if (typeof a === "number") {
			this.unitType = Unit;
			this.val = a;
			return;
		}
		this.unitType = a;
		this.val = b as number;
	}

	setUnitType(ut: JClass<Unit>): void {
		this.unitType = ut;
	}

	getUnitType(): JClass<Unit> {
		return this.unitType;
	}

	getNextSample(simTime: number): number;
	getNextSample(thisEnt: Entity | null, simTime: number): number;
	getNextSample(a: Entity | null | number, b?: number): number {
		return this.val;
	}

	getValueForTicks(ticks: number): number {
		return this.val;
	}

	getNextTimeAfter(simTime: number): number {
		return Double.POSITIVE_INFINITY;
	}

	getLastChangeBeforeTicks(ticks: number): number {
		return Long.MAX_VALUE;
	}

	getNextChangeAfterTicks(ticks: number): number {
		return Long.MAX_VALUE;
	}

	getMaxValue(): number {
		return this.val;
	}

	getMinValue(): number {
		return this.val;
	}

	getMaxTicksValue(): number {
		return 0;
	}

	getMeanValue(simTime: number): number {
		return this.val;
	}

	getValueString(simModel: JaamSimModel): string {
		let tmp = "";
		tmp += jstr(this.val / simModel.getDisplayedUnitFactor(this.unitType));
		if (this.unitType !== DimensionlessUnit)
			tmp += Input.SEPARATOR + simModel.getDisplayedUnit(this.unitType);
		return tmp;
	}

	toString(): string {
		let tmp = "";
		tmp += jstr(this.val);
		if (this.unitType !== Unit)
			tmp += Input.SEPARATOR + Unit.getSIUnit(this.unitType);
		return tmp;
	}

	getInterpolatedTicksForValue(val: number): number {
		return 0;
	}

	getInterpolatedCumulativeValueForTicks(ticks: number): number {
		return this.val;
	}
}
