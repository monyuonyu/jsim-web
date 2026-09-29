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

// 多重定義の扱い:
// - getUserList() と出力の getUserList(simTime) は、同じ値を返すので 1 つの関数（simTime は省略できる）
// - getUnitsInUse() と出力の getUnitsInUse(simTime) も同じ
// - notifyResourceUsers(ResourceProvider) と notifyResourceUsers(ArrayList<ResourceProvider>) は、配列かどうかで見分ける
// - 入れ子のクラス UserCompare は、ファイルの中の関数 userCompare にした

import { Integer, Double } from "../internal.ts";
import { BooleanProvInput } from "../internal.ts";
import { DisplayEntity } from "../internal.ts";
import { Entity } from "../internal.ts";
import { TimeBasedFrequency } from "../internal.ts";
import { TimeBasedStatistics } from "../internal.ts";
import { EventManager } from "../internal.ts";
import { defineOutput } from "../internal.ts";
import { DimensionlessUnit } from "../internal.ts";
import { TimeUnit } from "../internal.ts";
import { ResourceProvider } from "../internal.ts";
import type { ResourceUser } from "./ResourceUser.ts";

/** Java の (int) の型変換（0 の方向へ切り捨て、NaN は 0、範囲の外は端に張り付く） */
function toInt(x: number): number {
	if (Number.isNaN(x)) return 0;
	if (x >= Integer.MAX_VALUE) return Integer.MAX_VALUE;
	if (x <= Integer.MIN_VALUE) return Integer.MIN_VALUE;
	return Math.trunc(x);
}

export abstract class AbstractResourceProvider extends DisplayEntity implements ResourceProvider {

	private readonly strictOrder: BooleanProvInput;

	private userList: ResourceUser[];  // objects that can use this provider's units

	//	Statistics
	private unitsSeized = 0;    // number of units that have been seized
	private unitsReleased = 0;  // number of units that have been released
	private readonly stats: TimeBasedStatistics;
	private readonly freq: TimeBasedFrequency;

	static readonly ERR_CAPACITY = "Insufficient resource units: available=%s, req'd=%s";

	constructor() {
		super();

		// Java の初期化ブロック
		this.strictOrder = new BooleanProvInput("StrictOrder", Entity.KEY_INPUTS, false);
		this.setKeywordDoc(this.strictOrder, "If TRUE, the next entity to seize the resource will be chosen "
		                     + "strictly on the basis of priority and waiting time. If this entity "
		                     + "is unable to seize the resource because of other restrictions such as "
		                     + "an OperatingThreshold input or the unavailability of other resources "
		                     + "it needs to seize at the same time, then other entities with lower "
		                     + "priority or shorter waiting time will NOT be allowed to seize the "
		                     + "resource. If FALSE, the entities will be tested in the same order of "
		                     + "priority and waiting time, but the first entity that is able to seize "
		                     + "the resource will be allowed to do so.", []);
		this.addInput(this.strictOrder);

		// Java のコンストラクタ
		this.userList = [];
		this.stats = new TimeBasedStatistics();
		this.freq = new TimeBasedFrequency(0, 10);
	}

	override earlyInit(): void {
		super.earlyInit();
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

	isStrictOrder(): boolean {
		return this.strictOrder.getNextBoolean(this, EventManager.simSeconds());
	}

	/** Java の getUserList() と、出力の getUserList(double simTime)（どちらも同じ値） */
	getUserList(simTime?: number): ResourceUser[] {
		return this.userList;
	}

	abstract canSeize(simTime: number, n: number, ent: DisplayEntity): boolean;

	abstract getCapacity(simTime: number): number;

	/** Java の getUnitsInUse() と、出力の getUnitsInUse(double simTime)（どちらも同じ値） */
	abstract getUnitsInUse(simTime?: number): number;

	seize(n: number, ent: DisplayEntity): void {
		if (this.isTraceFlag()) this.trace(1, "seize(%s, %s)", n, ent);
		this.unitsSeized += n;
	}

	release(n: number, ent: DisplayEntity): void {
		if (this.isTraceFlag()) this.trace(1, "release(%s, %s)", n, ent);
		this.unitsReleased += n;
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

	/**
	 * Starts resource users on their next entities.
	 * Java の notifyResourceUsers(ResourceProvider) と notifyResourceUsers(ArrayList<ResourceProvider>)。
	 */
	static notifyResourceUsers(arg: ResourceProvider | ResourceProvider[]): void {
		if (!Array.isArray(arg)) {
			AbstractResourceProvider.notifyResourceUsers([arg]);
			return;
		}
		const resList = arg;

		// Prepare a sorted list of the resource users that have a waiting entity
		let list: ResourceUser[] = [];
		for (const res of resList) {
			for (const ru of res.getUserList()) {
				if (!list.includes(ru) && ru.hasWaitingEntity()) {
					list.push(ru);
				}
			}
		}
		// TODO(移植): 比べる関数は getPriority()（式の評価）を呼ぶので、比べる回数・順番が Java の TimSort と違うと、
		// 式の中の乱数などの副作用がずれうる（V8 も TimSort なのでほぼ同じはず。確かめていない）
		list.sort(userCompare);  // Java の Collections.sort と同じく、安定な並べ替え

		// Attempt to start the resource users in order of priority and wait time
		while (true) {

			// Find the first resource user that can seize its resources
			let selection: ResourceUser | null = null;
			for (const ru of list) {
				if (ru.isReadyToStart()) {
					selection = ru;
					break;
				}

				// In strict-order mode, only the highest priority/longest wait time entity is
				// eligible to seize its resources
				if (ru.hasStrictResource())
					return;
			}

			// If none of the resource users can seize its resources, then we are done
			if (selection === null)
				return;

			// Seize the resources
			selection.startNextEntity();

			// Remove any resource users than have no waiting entities and then re-sort
			// （Java の Iterator.remove と同じく、前から順に hasWaitingEntity を 1 回ずつ呼ぶ）
			const kept: ResourceUser[] = [];
			for (const ru of list) {
				if (ru.hasWaitingEntity()) {
					kept.push(ru);
				}
			}
			list = kept;
			list.sort(userCompare);
		}
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
		return this.freq.getBinTimes(simTime, 0, this.freq.getMax());
	}

	getUnitsInUseFractions(simTime: number): number[] {
		return this.freq.getBinFractions(simTime, 0, this.freq.getMax());
	}

	getUnitsInUseCumulativeFractions(simTime: number): number[] {
		return this.freq.getBinCumulativeFractions(simTime, 0, this.freq.getMax());
	}

}

/**
 * Sorts the users of the Resource by their priority and waiting time
 * （Java の入れ子のクラス UserCompare）
 */
function userCompare(ru1: ResourceUser, ru2: ResourceUser): number {

	// Chose the object with the highest priority entity
	// (lowest numerical value, i.e. 1 is higher priority than 2)
	const p1 = ru1.getPriority(), p2 = ru2.getPriority();
	const ret = p1 < p2 ? -1 : p1 > p2 ? 1 : 0;  // Integer.compare

	// If the priorities are the same, choose the one with the longest waiting time
	if (ret === 0) {
		return Double.compare(ru2.getWaitTime(), ru1.getWaitTime());
	}
	return ret;
}

defineOutput(AbstractResourceProvider, {
	name: "UserList",
	description: "The objects that can seize units from this resource.",
	unitType: DimensionlessUnit, reportable: false, sequence: 1,
	returnType: "ArrayList",
	get: (e, simTime) => e.getUserList(simTime),
});

defineOutput(AbstractResourceProvider, {
	name: "Capacity",
	description: "The total number of resource units that can be used.",
	unitType: DimensionlessUnit, reportable: false, sequence: 2,
	returnType: "int",
	get: (e, simTime) => e.getPresentCapacity(simTime),
});

defineOutput(AbstractResourceProvider, {
	name: "UnitsInUse",
	description: "The present number of resource units that are in use.",
	unitType: DimensionlessUnit, reportable: false, sequence: 3,
	returnType: "int",
	get: (e, simTime) => e.getUnitsInUse(simTime),
});

defineOutput(AbstractResourceProvider, {
	name: "AvailableUnits",
	description: "The number of resource units that are not in use.",
	unitType: DimensionlessUnit, reportable: false, sequence: 4,
	returnType: "int",
	get: (e, simTime) => e.getAvailableUnits(simTime),
});

defineOutput(AbstractResourceProvider, {
	name: "UnitsSeized",
	description: "The total number of resource units that have been seized.",
	unitType: DimensionlessUnit, reportable: true, sequence: 5,
	returnType: "int",
	get: (e, simTime) => e.getUnitsSeized(simTime),
});

defineOutput(AbstractResourceProvider, {
	name: "UnitsReleased",
	description: "The total number of resource units that have been released.",
	unitType: DimensionlessUnit, reportable: true, sequence: 6,
	returnType: "int",
	get: (e, simTime) => e.getUnitsReleased(simTime),
});

defineOutput(AbstractResourceProvider, {
	name: "UnitsInUseAverage",
	description: "The average number of resource units that are in use.",
	unitType: DimensionlessUnit, reportable: true, sequence: 7,
	returnType: "double",
	get: (e, simTime) => e.getUnitsInUseAverage(simTime),
});

defineOutput(AbstractResourceProvider, {
	name: "UnitsInUseStandardDeviation",
	description: "The standard deviation of the number of resource units that are in use.",
	unitType: DimensionlessUnit, reportable: true, sequence: 8,
	returnType: "double",
	get: (e, simTime) => e.getUnitsInUseStandardDeviation(simTime),
});

defineOutput(AbstractResourceProvider, {
	name: "UnitsInUseMinimum",
	description: "The minimum number of resource units that are in use.",
	unitType: DimensionlessUnit, reportable: true, sequence: 9,
	returnType: "int",
	get: (e, simTime) => e.getUnitsInUseMinimum(simTime),
});

defineOutput(AbstractResourceProvider, {
	name: "UnitsInUseMaximum",
	description: "The maximum number of resource units that are in use.",
	unitType: DimensionlessUnit, reportable: true, sequence: 10,
	returnType: "int",
	get: (e, simTime) => e.getUnitsInUseMaximum(simTime),
});

defineOutput(AbstractResourceProvider, {
	name: "UnitsInUseTimes",
	description: "The total time that the number of resource units in use was 0, 1, 2, etc.",
	unitType: TimeUnit, reportable: true, sequence: 11,
	returnType: "double[]",
	get: (e, simTime) => e.getUnitsInUseDistribution(simTime),
});

defineOutput(AbstractResourceProvider, {
	name: "UnitsInUseFractions",
	description: "Fraction of total time that the number of resource units in use was 0, 1, 2, "
	           + "etc.",
	unitType: DimensionlessUnit, reportable: true, sequence: 12,
	returnType: "double[]",
	get: (e, simTime) => e.getUnitsInUseFractions(simTime),
});

defineOutput(AbstractResourceProvider, {
	name: "UnitsInUseCumulativeFractions",
	description: "Fraction of total time that the number of resource units in use was less than "
	           + "or equal to 0, 1, 2, etc.",
	unitType: DimensionlessUnit, reportable: true, sequence: 13,
	returnType: "double[]",
	get: (e, simTime) => e.getUnitsInUseCumulativeFractions(simTime),
});
