/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2013 Ausenco Engineering Canada Inc.
 * Copyright (C) 2016-2026 JaamSim Software Inc.
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

// 入れ子のクラス CapacityChangeConditional・UpdateForCapacityChangeTarget は、ファイルの中のクラスにした
// （Java の Resource.this は、コンストラクタで受け取る）。

import { Double, Integer } from "../internal.ts";
import { ClassRegistry } from "../internal.ts";
import { tr } from "../internal.ts";
import type { DisplayEntity } from "../Graphics/DisplayEntity.ts";
import { Entity } from "../internal.ts";
import { Distribution } from "../internal.ts";
import { SampleConstant } from "../internal.ts";
import { SampleInput } from "../internal.ts";
import { TimeSeries } from "../internal.ts";
import type { Conditional } from "../events/Conditional.ts";
import { EventManager } from "../internal.ts";
import { ProcessTarget } from "../internal.ts";
import { InputErrorException } from "../internal.ts";
import { DimensionlessUnit } from "../internal.ts";
import { AbstractResourceProvider } from "../internal.ts";
import type { ResourceProvider } from "./ResourceProvider.ts";

/** Java の (int) の型変換（0 の方向へ切り捨て、NaN は 0、範囲の外は端に張り付く） */
function toInt(x: number): number {
	if (Number.isNaN(x)) return 0;
	if (x >= Integer.MAX_VALUE) return Integer.MAX_VALUE;
	if (x <= Integer.MIN_VALUE) return Integer.MIN_VALUE;
	return Math.trunc(x);
}

export class Resource extends AbstractResourceProvider {

	private readonly capacity: SampleInput;

	private unitsInUse = 0;  // number of resource units that are being used at present
	private lastCapacity = 0; // capacity for the resource

	private readonly capacityChangeConditional: Conditional;
	private readonly updateForCapacityChangeTarget: ProcessTarget;

	constructor() {
		super();

		// Java の初期化ブロック
		this.attributeDefinitionList.setHidden(false);

		this.capacity = new SampleInput("Capacity", Entity.KEY_INPUTS, 1);
		this.setKeywordDoc(this.capacity, "The number of equivalent resource units that are available. "
		                     + "Only an integer number of resource units can be specified. "
		                     + "A decimal value will be truncated to an integer.\n"
		                     + "If the capacity changes during the simulation run, the Resource will "
		                     + "attempt to use an increase in capacity as soon as it occurs. "
		                     + "However, a decrease in capacity will have no affect on entities that "
		                     + "have already seized Resource capacity.",
		         ["3", "TimeSeries1", "this.attrib1"]);
		this.capacity.setUnitType(DimensionlessUnit);
		this.capacity.setIntegerValue(true);
		this.capacity.setValidRange(0, Double.POSITIVE_INFINITY);
		this.capacity.setOutput(false);
		this.addInput(this.capacity);

		// Java のフィールドの初期値（初期化ブロックの後に書かれている）
		this.capacityChangeConditional = new CapacityChangeConditional(this);
		this.updateForCapacityChangeTarget = new UpdateForCapacityChangeTarget(this);
	}

	override validate(): void {
		super.validate();

		if( this.capacity.getValue() instanceof Distribution )
			throw new InputErrorException(tr("The Capacity keyword cannot accept a probability distribution."));
	}

	override earlyInit(): void {
		super.earlyInit();
		this.unitsInUse = 0;
		this.lastCapacity = this.getCapacity(0.0);
	}

	override startUp(): void {
		super.startUp();

		if (this.capacity.getValue() instanceof SampleConstant)
			return;

		// Track any changes in the Resource's capacity
		this.waitForCapacityChange();
	}

	override getCapacity(simTime: number): number {
		return toInt(this.capacity.getNextSample(this, simTime));
	}

	override getUnitsInUse(simTime?: number): number {
		return this.unitsInUse;
	}

	override canSeize(simTime: number, n: number, ent: DisplayEntity): boolean {
		return this.getAvailableUnits(simTime) >= n;
	}

	override seize(n: number, ent: DisplayEntity): void {
		super.seize(n, ent);
		const simTime = EventManager.simSeconds();
		if (this.getAvailableUnits(simTime) < n)
			this.error(tr(AbstractResourceProvider.ERR_CAPACITY), this.getAvailableUnits(simTime), n);

		this.unitsInUse += n;
		this.collectStatistics(simTime, this.unitsInUse);
	}

	override release(m: number, ent: DisplayEntity): void {
		const n = Math.min(m, this.unitsInUse);
		super.release(n, ent);
		this.unitsInUse -= n;
		const simTime = EventManager.simSeconds();
		this.collectStatistics(simTime, this.unitsInUse);
	}

	/**
	 * Returns true if the saved capacity differs from the present capacity
	 * @return true if the capacity has changed
	 */
	isCapacityChanged(): boolean {
		return this.getCapacity(EventManager.simSeconds()) !== this.lastCapacity;
	}

	/**
	 * Loops from one capacity change to the next.
	 */
	waitForCapacityChange(): void {

		// Set the present capacity
		this.lastCapacity = this.getCapacity(EventManager.simSeconds());

		// Wait until the state is ready to change
		if (this.capacity.getValue() instanceof TimeSeries) {
			const ts = this.capacity.getValue() as TimeSeries;
			const simTicks = EventManager.simTicks();
			const durTicks = ts.getNextChangeAfterTicks(simTicks) - simTicks;
			EventManager.scheduleTicks(durTicks, Entity.PRI_LOW, Entity.EVT_FIFO, this.updateForCapacityChangeTarget, null);
		}
		else {
			EventManager.scheduleUntil(this.updateForCapacityChangeTarget, this.capacityChangeConditional, null);
		}
	}

	/**
	 * Responds to a change in capacity.
	 */
	updateForCapacityChange(): void {
		if (this.isTraceFlag()) this.trace(0, "updateForCapacityChange");

		// Select the resource users to notify
		if (this.getCapacity(EventManager.simSeconds()) > this.lastCapacity) {
			const resList: ResourceProvider[] = [];
			resList.push(this);
			Resource.notifyResourceUsers(resList);
		}

		// Wait for the next capacity change
		this.waitForCapacityChange();
	}

}

// Conditional for isCapacityChanged()
class CapacityChangeConditional implements Conditional {
	constructor(private readonly res: Resource) {}

	evaluate(): boolean {
		return this.res.isCapacityChanged();
	}
}

// Target for updateForCapacityChange()
class UpdateForCapacityChangeTarget extends ProcessTarget {
	constructor(private readonly res: Resource) {
		super();
	}

	override getDescription(): string {
		return this.res.getName() + ".updateForCapacityChange";
	}

	override process(): void {
		this.res.updateForCapacityChange();
	}
}

ClassRegistry.register("com.jaamsim.resourceObjects.Resource", Resource);
