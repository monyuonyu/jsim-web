/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2018-2020 JaamSim Software Inc.
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

// 入れ子のクラス SeizableUnit は、ファイルの中のクラスにした（Comparable の compareTo はそのまま）。

import { ClassRegistry } from "../java/ClassRegistry.ts";
import { tr } from "../i18n/I18n.ts";
import { DisplayEntity } from "../Graphics/DisplayEntity.ts";
import { StateUserEntity } from "../ProcessFlow/StateUserEntity.ts";
import { Entity } from "../basicsim/Entity.ts";
import { EventManager } from "../events/EventManager.ts";
import { defineOutput } from "../input/OutputRegistry.ts";
import { DimensionlessUnit } from "../units/DimensionlessUnit.ts";
import { AbstractResourceProvider } from "./AbstractResourceProvider.ts";
import { isSeizable, type Seizable } from "./Seizable.ts";

export class ResourcePool extends AbstractResourceProvider {

	private readonly seizableList: Seizable[];

	constructor() {
		super();
		this.seizableList = [];
	}

	override earlyInit(): void {
		super.earlyInit();

		this.seizableList.length = 0;
		for (const ent of this.getJaamSimModel().getClonesOfIterator(Entity, isSeizable)) {
			const unit = ent as unknown as Seizable;
			if (unit.getResourcePool() !== this || !(unit as unknown as DisplayEntity).isActive())
				continue;
			this.seizableList.push(unit);
		}
	}

	override getCapacity(simTime: number): number {
		let ret = 0;
		for (const unit of this.seizableList) {
			if (unit instanceof StateUserEntity && !unit.isAvailable())
				continue;
			ret++;
		}
		return ret;
	}

	override getUnitsInUse(simTime?: number): number {
		let ret = 0;
		for (const unit of this.seizableList) {
			if (unit.getAssignment() === null)
				continue;
			ret++;
		}
		return ret;
	}

	getEligibleList(ent: DisplayEntity): Seizable[] {
		const ret: Seizable[] = [];
		for (const unit of this.seizableList) {
			if (!unit.canSeize(ent))
				continue;
			ret.push(unit);
		}
		return ret;
	}

	override canSeize(simTime: number, n: number, ent: DisplayEntity): boolean {
		return n <= this.getEligibleList(ent).length;
	}

	override seize(n: number, ent: DisplayEntity): void {
		super.seize(n, ent);

		// List the units that are eligible to be seized
		const eligibleList = this.getEligibleList(ent);
		if (n > eligibleList.length)
			this.error(tr(AbstractResourceProvider.ERR_CAPACITY), eligibleList.length, n);

		// Sort the units by priority and release time
		const list: SeizableUnit[] = [];
		for (const unit of eligibleList) {
			list.push(new SeizableUnit(unit, ent));
		}
		list.sort((a, b) => a.compareTo(b));  // Java の Collections.sort と同じく、安定な並べ替え

		// Seize the first n units
		for (let i = 0; i < n; i++) {
			list[i].unit.seize(ent);
		}

		const simTime = EventManager.simSeconds();
		this.collectStatistics(simTime, this.getUnitsInUse());
	}

	override release(n: number, ent: DisplayEntity): void {
		super.release(n, ent);
		for (const unit of this.seizableList) {
			if (unit.getAssignment() !== ent)
				continue;
			unit.release();
		}

		const simTime = EventManager.simSeconds();
		this.collectStatistics(simTime, this.getUnitsInUse());
	}

	getUnitsList(simTime: number): Seizable[] {
		return this.seizableList;
	}

	getUnitsInUseList(simTime: number): Seizable[] {
		const ret: Seizable[] = [];
		for (const unit of this.seizableList) {
			if (unit.getAssignment() === null)
				continue;
			ret.push(unit);
		}
		return ret;
	}

	getAvailableUnitsList(simTime: number): Seizable[] {
		const ret: Seizable[] = [];
		for (const unit of this.seizableList) {
			if (unit.getAssignment() !== null)
				continue;
			if (unit instanceof StateUserEntity && !unit.isAvailable())
				continue;
			ret.push(unit);
		}
		return ret;
	}

}

class SeizableUnit {
	readonly unit: Seizable;
	private readonly priority: number;
	private readonly ticks: number;

	constructor(u: Seizable, ent: DisplayEntity) {
		this.unit = u;
		this.priority = u.getPriority(ent);
		this.ticks = u.getLastReleaseTicks();
	}

	compareTo(su: SeizableUnit): number {

		// Compare priorities
		const ret = this.priority < su.priority ? -1 : this.priority > su.priority ? 1 : 0;  // Integer.compare
		if (ret !== 0)
			return ret;

		// Priorities are equal
		// Compare the release times
		return this.ticks < su.ticks ? -1 : this.ticks > su.ticks ? 1 : 0;  // Long.compare
	}

	toString(): string {
		return String(this.unit);
	}
}

ClassRegistry.register("com.jaamsim.resourceObjects.ResourcePool", ResourcePool);

defineOutput(ResourcePool, {
	name: "UnitsList",
	description: "The ResourceUnits that are members of this ResourcePool.",
	unitType: DimensionlessUnit, reportable: false, sequence: 1,
	returnType: "ArrayList",
	get: (e, simTime) => e.getUnitsList(simTime),
});

defineOutput(ResourcePool, {
	name: "UnitsInUseList",
	description: "The present number of resource units that are in use.",
	unitType: DimensionlessUnit, reportable: false, sequence: 2,
	returnType: "ArrayList",
	get: (e, simTime) => e.getUnitsInUseList(simTime),
});

defineOutput(ResourcePool, {
	name: "AvailableUnitsList",
	description: "The number of resource units that are not in use.",
	unitType: DimensionlessUnit, reportable: false, sequence: 3,
	returnType: "ArrayList",
	get: (e, simTime) => e.getAvailableUnitsList(simTime),
});
