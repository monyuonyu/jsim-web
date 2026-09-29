/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2018-2024 JaamSim Software Inc.
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

// 多重定義の扱い（どれも引数で見分ける。名前は変えていない）:
// - canSeize(DisplayEntity)（Seizable）と canSeize(double, int, DisplayEntity)（ResourceProvider）: 最初の引数が数かどうか
// - seize(DisplayEntity)（Seizable）と seize(int, DisplayEntity)（ResourceProvider）: 最初の引数が数かどうか
// - release()（Seizable）と release(int, DisplayEntity)（ResourceProvider）: 引数の数
// - getUserList() と出力の getUserList(double simTime): 値が違う。simTime を省くと前者、渡すと後者
// - getUnitsInUse() と getUnitsInUse(double)、getAssignment() と getAssignment(double): 同じ値

import { Double, Integer } from "../java/lang.ts";
import { ClassRegistry } from "../java/ClassRegistry.ts";
import { tr } from "../i18n/I18n.ts";
import type { DowntimeEntity } from "../BasicObjects/DowntimeEntity.ts";
import { BooleanProvInput } from "../BooleanProviders/BooleanProvInput.ts";
import { ShapeModel } from "../DisplayModels/ShapeModel.ts";
import type { DisplayEntity } from "../Graphics/DisplayEntity.ts";
import { StateUserEntity } from "../ProcessFlow/StateUserEntity.ts";
import { TimeBasedFrequency } from "../Statistics/TimeBasedFrequency.ts";
import { TimeBasedStatistics } from "../Statistics/TimeBasedStatistics.ts";
import { Entity } from "../basicsim/Entity.ts";
import { EventManager } from "../events/EventManager.ts";
import { ColourInput } from "../input/ColourInput.ts";
import { EntityInput } from "../input/EntityInput.ts";
import { ExpResType } from "../input/ExpResType.ts";
import { ExpressionInput } from "../input/ExpressionInput.ts";
import { defineOutput } from "../input/OutputRegistry.ts";
import { Vec3dInput } from "../input/Vec3dInput.ts";
import type { Color4d } from "../math/Color4d.ts";
import { Vec3d } from "../math/Vec3d.ts";
import { DimensionlessUnit } from "../units/DimensionlessUnit.ts";
import { DistanceUnit } from "../units/DistanceUnit.ts";
import { TimeUnit } from "../units/TimeUnit.ts";
import { AbstractResourceProvider } from "./AbstractResourceProvider.ts";
import { ResourcePool } from "./ResourcePool.ts";
import { ResourceProvider } from "./ResourceProvider.ts";
import type { ResourceUser } from "./ResourceUser.ts";
import type { Seizable } from "./Seizable.ts";

/** Java の (int) の型変換（0 の方向へ切り捨て、NaN は 0、範囲の外は端に張り付く） */
function toInt(x: number): number {
	if (Number.isNaN(x)) return 0;
	if (x >= Integer.MAX_VALUE) return Integer.MAX_VALUE;
	if (x <= Integer.MIN_VALUE) return Integer.MIN_VALUE;
	return Math.trunc(x);
}

export class ResourceUnit extends StateUserEntity implements Seizable, ResourceProvider {

	private readonly resourcePool: EntityInput<ResourcePool>;

	private readonly assignmentCondition: ExpressionInput;

	private readonly assignmentPriority: ExpressionInput;

	private readonly followAssignment: BooleanProvInput;

	protected readonly assignmentOffset: Vec3dInput;

	private presentAssignment: DisplayEntity | null = null;  // entity to which this unit is assigned
	private assignmentTicks = 0;   // clock ticks at which the unit was assigned
	private lastReleaseTicks = 0;  // clock ticks at which the unit was unassigned
	private userList: ResourceUser[];  // objects that can use this resource

	//	Statistics
	private unitsSeized = 0;    // number of units that have been seized
	private unitsReleased = 0;  // number of units that have been released
	private readonly stats: TimeBasedStatistics;
	private readonly freq: TimeBasedFrequency;

	static readonly COL_OUTLINE: Color4d = ColourInput.MED_GREY;

	constructor() {
		super();

		// Java の初期化ブロック
		this.active.setHidden(false);
		this.stateGraphics.setHidden(false);
		this.immediateThresholdList.setHidden(true);
		this.immediateReleaseThresholdList.setHidden(true);
		this.immediateMaintenanceList.setHidden(true);
		this.immediateBreakdownList.setHidden(true);

		this.resourcePool = new EntityInput<ResourcePool>(ResourcePool, "ResourcePool", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.resourcePool, "The name of the ResourcePool from which this ResourceUnit can be "
		                     + "selected. If no pool is specified, the ResourceUnit itself is "
		                     + "considered to be a ResourcePool with one unit.", []);
		this.addInput(this.resourcePool);

		this.assignmentCondition = new ExpressionInput("AssignmentCondition", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.assignmentCondition, "An optional expression that tests whether an entity is elible to "
		                     + "seize this unit. "
		                     + "The entry 'this.Assignment' represents the entity that is being "
		                     + "tested in the expression. "
		                     + "The expression should return 1 (true) if the entity is eligible.",
		         ["'this.Assignment.type == 1'"]);
		this.assignmentCondition.setUnitType(DimensionlessUnit);
		this.assignmentCondition.setResultType(ExpResType.NUMBER);
		this.addInput(this.assignmentCondition);

		this.assignmentPriority = new ExpressionInput("AssignmentPriority", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.assignmentPriority, "An optional expression that returns the priority for this unit to be "
		                     + "used by the ResourcePool when choosing the next unit to be seized. "
		                     + "The calculated priority should be a positive integer, with a lower "
		                     + "value indicating a higher priority. "
		                     + "The entry 'this.Assignment' can be used in the expression to "
		                     + "represent the entity that would seize the unit.",
		         ["'this.Assignment.type == 1 ? 1 : 2'"]);
		this.assignmentPriority.setUnitType(DimensionlessUnit);
		this.assignmentPriority.setResultType(ExpResType.NUMBER);
		this.assignmentPriority.setDefaultText("1");
		this.addInput(this.assignmentPriority);
		this.addSynonym(this.assignmentPriority, "Priority");

		this.followAssignment = new BooleanProvInput("FollowAssignment", Entity.FORMAT, false);
		this.setKeywordDoc(this.followAssignment, "If TRUE, the ResourceUnit will move next to the entity that has "
		                     + "seized it, and will follow that entity until it is released.", []);
		this.addInput(this.followAssignment);

		this.assignmentOffset = new Vec3dInput("AssignmentOffset", Entity.FORMAT, new Vec3d());
		this.setKeywordDoc(this.assignmentOffset, "The position of the ResourceUnit relative to the entity that has seized it.",
		         ["0.0 1.0 0.01 m"]);
		this.assignmentOffset.setUnitType(DistanceUnit);
		this.addInput(this.assignmentOffset);

		// Java のコンストラクタ
		this.userList = [];
		this.stats = new TimeBasedStatistics();
		this.freq = new TimeBasedFrequency(0, 10);
	}

	override earlyInit(): void {
		super.earlyInit();
		this.presentAssignment = null;
		this.assignmentTicks = -1;
		this.lastReleaseTicks = 0;

		this.unitsSeized = 0;
		this.unitsReleased = 0;
		this.stats.clear();
		this.stats.addValue(0.0, 0);
		this.freq.clear();
		this.freq.addValue(0.0,  0);
	}

	override lateInit(): void {
		super.lateInit();
		this.userList = ResourceProvider.getUserList(this);
	}

	getResourcePool(): ResourcePool | null {
		return this.resourcePool.getValue();
	}

	/**
	 * Returns the ResourceProvider that manages this ResourceUnit.
	 * Normally, the ResourceProvider is the ResourceUnit's ResourcePool, however if no
	 * ResourcePool was assigned then the ResourceUnit as its own ResourceProv, essentially as a
	 * ResourcePool with one unit.
	 * @return ResourceProvider that manages this ResourceUnit
	 */
	getResourceProvider(): ResourceProvider {
		return this.resourcePool.isDefault() ? this : this.getResourcePool()!;
	}

	/**
	 * Tests whether the specified entity is eligible to seize this unit.
	 * @param ent - entity to be tested
	 * @return true if the entity is eligible
	 */
	isAllowed(ent: DisplayEntity): boolean {
		if (this.assignmentCondition.isDefault())
			return true;

		// Temporarily set the present user so that the expression can be evaluated
		const oldAssignment = this.presentAssignment;
		this.presentAssignment = ent;

		// Evaluate the condition for the proposed user
		const ret = this.assignmentCondition.getNextResult(this, EventManager.simSeconds()).value !== 0;

		// Reset the original user
		this.presentAssignment = oldAssignment;

		return ret;
	}

	/**
	 * Java の canSeize(DisplayEntity)（Seizable）と canSeize(double simTime, int n, DisplayEntity ent)（ResourceProvider）
	 */
	canSeize(ent: DisplayEntity): boolean;
	canSeize(simTime: number, n: number, ent: DisplayEntity): boolean;
	canSeize(a: DisplayEntity | number, n?: number, ent?: DisplayEntity): boolean {
		if (typeof a !== "number") {
			return (this.presentAssignment === null && this.isAllowed(a) && this.isAbleToRestart());
		}

		// ResourcePool interface methods
		return this.canSeize(ent!) && n! <= 1;
	}

	/**
	 * Java の seize(DisplayEntity)（Seizable）と seize(int n, DisplayEntity ent)（ResourceProvider）
	 */
	seize(ent: DisplayEntity): void;
	seize(n: number, ent: DisplayEntity): void;
	seize(a: DisplayEntity | number, b?: DisplayEntity): void {
		if (typeof a === "number") {
			const n = a;
			if (n > 1)
				this.error(tr(AbstractResourceProvider.ERR_CAPACITY), 1, n);
			this.seize(b!);
			return;
		}

		const ent = a;
		const simTime = EventManager.simSeconds();
		if (!this.canSeize(ent)) {
			this.error(tr("Unit is already in use: assignment=%s, entity=%s"), this.presentAssignment, ent);
		}
		this.presentAssignment = ent;
		this.assignmentTicks = EventManager.simTicks();
		this.unitsSeized++;
		this.setPresentState();
		this.collectStatistics(simTime, this.getUnitsInUse());
	}

	/**
	 * Java の release()（Seizable）と release(int n, DisplayEntity ent)（ResourceProvider）
	 */
	release(): void;
	release(n: number, ent: DisplayEntity): void;
	release(n?: number, ent?: DisplayEntity): void {
		if (n !== undefined) {
			this.release();
			return;
		}

		const simTime = EventManager.simSeconds();
		this.presentAssignment = null;
		this.assignmentTicks = -1;
		this.lastReleaseTicks = EventManager.simTicks();
		this.unitsReleased++;
		this.setPresentState();
		this.collectStatistics(simTime, this.getUnitsInUse());
	}

	collectStatistics(simTime: number, unitsInUse: number): void {
		this.stats.addValue(simTime, unitsInUse);
		this.freq.addValue(simTime, unitsInUse);
	}

	override clearStatistics(): void {
		super.clearStatistics();
		const simTime = EventManager.simSeconds();
		this.unitsSeized = 0;
		this.unitsReleased = 0;
		this.stats.clear();
		this.stats.addValue(simTime, this.getUnitsInUse());
		this.freq.clear();
		this.freq.addValue(simTime, this.getUnitsInUse());
	}

	getCapacity(simTime: number): number {
		return 1;
	}

	/** Java の getUnitsInUse() と、出力の getUnitsInUse(double simTime)（どちらも同じ値） */
	getUnitsInUse(simTime?: number): number {
		return this.presentAssignment === null ? 0 : 1;
	}

	override isBusy(): boolean {
		return this.presentAssignment !== null;
	}

	/** Java の getAssignment() と、出力の getAssignment(double simTime)（どちらも同じ値） */
	getAssignment(simTime?: number): DisplayEntity | null {
		return this.presentAssignment;
	}

	getPriority(ent: DisplayEntity): number {
		if (this.assignmentPriority.isDefault())
			return 1;

		// Temporarily set the present user so that the expression can be evaluated
		const oldAssignment = this.presentAssignment;
		this.presentAssignment = ent;

		// Evaluate the condition for the proposed user
		const ret = toInt(this.assignmentPriority.getNextResult(this, EventManager.simSeconds()).value);

		// Reset the original user
		this.presentAssignment = oldAssignment;

		return ret;
	}

	getLastReleaseTicks(): number {
		return this.lastReleaseTicks;
	}

	/**
	 * Java の getUserList()（ResourceProvider。この部品の userList を返す）と、
	 * 出力の getUserList(double simTime)（getResourceProvider().getUserList() を返す）。
	 * 値が違うので、simTime を渡したかどうかで見分ける。
	 */
	getUserList(simTime?: number): ResourceUser[] {
		if (simTime === undefined)
			return this.userList;
		return this.getResourceProvider().getUserList();
	}

	isStrictOrder(): boolean {
		return false;
	}

	override thresholdChanged(): void {
		if (this.isTraceFlag())
			this.trace(0, "thresholdChanged");
		this.setPresentState();

		// If the resource unit is available, try to put it to work
		if (this.isAvailable()) {
			AbstractResourceProvider.notifyResourceUsers(this.getResourceProvider());
			return;
		}
		// Do nothing if the threshold is closed. A threshold closure takes effect after the
		// ResourceUnit has been released
	}

	override endDowntime(down: DowntimeEntity): void {
		super.endDowntime(down);

		// If the resource unit is available, try to put it to work
		if (this.isAvailable()) {
			AbstractResourceProvider.notifyResourceUsers(this.getResourceProvider());
			return;
		}
	}

	/** 描画の更新のうち、状態（位置と色の値）の計算だけを残す（PORTING.md の 7） */
	override updateGraphics(simTime: number): void {
		super.updateGraphics(simTime);

		// Set the resource unit's position
		if (this.followAssignment.getNextBoolean(this, simTime)) {
			if (this.presentAssignment === null) {
				this.setPosition(this.positionInput.getValue());
			}
			else {
				const pos = this.presentAssignment.getGlobalPosition();
				pos.add3(this.assignmentOffset.getValue());
				this.setGlobalPosition(pos);
			}
		}

		// Set the resource unit's colour based on its state
		this.setTagVisibility(ShapeModel.TAG_CONTENTS, true);
		this.setTagVisibility(ShapeModel.TAG_OUTLINES, true);
		this.setTagColour(ShapeModel.TAG_CONTENTS, this.getColourForPresentState());
		this.setTagColour(ShapeModel.TAG_OUTLINES, ResourceUnit.COL_OUTLINE);
	}

	getPresentCapacity(simTime: number): number {
		return this.getCapacity(simTime);
	}

	getAvailableUnits(simTime: number): number {
		return this.getCapacity(simTime) - this.getUnitsInUse();
	}

	getUnitsSeized(simTime: number): number {
		return this.unitsSeized;
	}

	getUnitsReleased(simTime: number): number {
		return this.unitsReleased;
	}

	getUnitsInUseAverage(simTime: number): number {
		return this.stats.getMean(simTime);
	}

	getUnitsInUseStandardDeviation(simTime: number): number {
		return this.stats.getStandardDeviation(simTime);
	}

	getUnitsInUseMinimum(simTime: number): number {
		return toInt(this.stats.getMin());
	}

	getUnitsInUseMaximum(simTime: number): number {
		const ret = toInt(this.stats.getMax());
		// A unit that is seized and released immediately
		// does not count as a non-zero maximum in use
		if (ret === 1 && this.freq.getBinTime(simTime, 1) === 0.0)
			return 0;
		return ret;
	}

	getUnitsInUseDistribution(simTime: number): number[] {
		return this.freq.getBinTimes(simTime);
	}

	getAssignmentTime(simTime: number): number {
		if (this.presentAssignment === null)
			return Double.NaN;
		const evt = this.getJaamSimModel().getEventManager();
		return evt.ticksToSeconds(this.assignmentTicks);
	}

	getReleaseTime(simTime: number): number {
		if (this.presentAssignment !== null)
			return Double.NaN;
		const evt = this.getJaamSimModel().getEventManager();
		return evt.ticksToSeconds(this.lastReleaseTicks);
	}

}

ClassRegistry.register("com.jaamsim.resourceObjects.ResourceUnit", ResourceUnit);

defineOutput(ResourceUnit, {
	name: "UserList",
	description: "The objects that can seize this resource unit.",
	unitType: DimensionlessUnit, reportable: false, sequence: 1,
	returnType: "ArrayList",
	get: (e, simTime) => e.getUserList(simTime),
});

defineOutput(ResourceUnit, {
	name: "Capacity",
	description: "The total number of resource units that can be used.",
	unitType: DimensionlessUnit, reportable: false, sequence: 2,
	returnType: "int",
	get: (e, simTime) => e.getPresentCapacity(simTime),
});

defineOutput(ResourceUnit, {
	name: "UnitsInUse",
	description: "The present number of resource units that are in use.",
	unitType: DimensionlessUnit, reportable: false, sequence: 3,
	returnType: "int",
	get: (e, simTime) => e.getUnitsInUse(simTime),
});

defineOutput(ResourceUnit, {
	name: "AvailableUnits",
	description: "The number of resource units that are not in use.",
	unitType: DimensionlessUnit, reportable: false, sequence: 4,
	returnType: "int",
	get: (e, simTime) => e.getAvailableUnits(simTime),
});

defineOutput(ResourceUnit, {
	name: "UnitsSeized",
	description: "The total number of times that the unit has been seized.",
	unitType: DimensionlessUnit, reportable: true, sequence: 5,
	returnType: "int",
	get: (e, simTime) => e.getUnitsSeized(simTime),
});

defineOutput(ResourceUnit, {
	name: "UnitsReleased",
	description: "The total number of times that the unit has been released.",
	unitType: DimensionlessUnit, reportable: true, sequence: 6,
	returnType: "int",
	get: (e, simTime) => e.getUnitsReleased(simTime),
});

defineOutput(ResourceUnit, {
	name: "UnitsInUseAverage",
	description: "The average number of resource units that are in use.",
	unitType: DimensionlessUnit, reportable: true, sequence: 7,
	returnType: "double",
	get: (e, simTime) => e.getUnitsInUseAverage(simTime),
});

defineOutput(ResourceUnit, {
	name: "UnitsInUseStandardDeviation",
	description: "The standard deviation of the number of resource units that are in use.",
	unitType: DimensionlessUnit, reportable: true, sequence: 8,
	returnType: "double",
	get: (e, simTime) => e.getUnitsInUseStandardDeviation(simTime),
});

defineOutput(ResourceUnit, {
	name: "UnitsInUseMinimum",
	description: "The minimum number of resource units that are in use.",
	unitType: DimensionlessUnit, reportable: true, sequence: 9,
	returnType: "int",
	get: (e, simTime) => e.getUnitsInUseMinimum(simTime),
});

defineOutput(ResourceUnit, {
	name: "UnitsInUseMaximum",
	description: "The maximum number of resource units that are in use.",
	unitType: DimensionlessUnit, reportable: true, sequence: 10,
	returnType: "int",
	get: (e, simTime) => e.getUnitsInUseMaximum(simTime),
});

defineOutput(ResourceUnit, {
	name: "UnitsInUseTimes",
	description: "The total time that the number of resource units in use was 0, 1, 2, etc.",
	unitType: TimeUnit, reportable: true, sequence: 11,
	returnType: "double[]",
	get: (e, simTime) => e.getUnitsInUseDistribution(simTime),
});

defineOutput(ResourceUnit, {
	name: "Assignment",
	description: "The entity to which this unit is assigned.",
	unitType: DimensionlessUnit, reportable: false, sequence: 12,
	returnType: "Entity",
	get: (e, simTime) => e.getAssignment(simTime),
});

defineOutput(ResourceUnit, {
	name: "AssignmentTime",
	description: "Time at which this unit became assigned to its present entity. "
	           + "NaN is returned if the unit is unassigned.",
	unitType: TimeUnit, reportable: false, sequence: 13,
	returnType: "double",
	get: (e, simTime) => e.getAssignmentTime(simTime),
});

defineOutput(ResourceUnit, {
	name: "ReleaseTime",
	description: "Time at which this unit became unassigned. "
	           + "NaN is returned if the unit is assigned.",
	unitType: TimeUnit, reportable: false, sequence: 14,
	returnType: "double",
	get: (e, simTime) => e.getReleaseTime(simTime),
});
