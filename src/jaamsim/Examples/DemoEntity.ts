/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2016-2024 JaamSim Software Inc.
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

// 移植のメモ:
// - 入れ子のクラス EndTravelTarget は同じファイルの DemoEntity_EndTravelTarget。
// - updateGraphics は位置の計算（状態）なので残した。
import { Double } from "../internal.ts";
import { Entity } from "../internal.ts";
import { DisplayEntity } from "../internal.ts";
import { SampleInput } from "../internal.ts";
import { EntityTarget } from "../internal.ts";
import { EventManager } from "../internal.ts";
import { Vec3dInput } from "../internal.ts";
import { MathUtils } from "../internal.ts";
import { Vec3d } from "../internal.ts";
import { DimensionlessUnit } from "../internal.ts";
import { DistanceUnit } from "../internal.ts";
import { RateUnit } from "../internal.ts";
import { TimeUnit } from "../internal.ts";
import { ClassRegistry } from "../internal.ts";
import { defineOutput } from "../internal.ts";
import type { ProcessTarget } from "../events/ProcessTarget.ts";

/**
 * Example of how to create a new simulation object in JaamSim. The demo entity travels back and
 * forth between two nodes with a specified travel time.
 */
export class DemoEntity extends DisplayEntity {

	private readonly travelTime: SampleInput;

	protected readonly node1: Vec3dInput;

	protected readonly node2: Vec3dInput;

	private lastUpdateTime = 0; // time at which the distance was calculated
	private distance = 0; // relative position between node1 and node2 (node1 = 0, node2 = 1)
	private speed = 0; // relative speed of the entity between node1 and node2
	private numberOfTrips = 0; // number of times the entity has travelled between the nodes

	private readonly endTravelTarget: ProcessTarget;

	constructor() {
		super();

		// ---- Java の初期化ブロック ----
		this.travelTime = new SampleInput("TravelTime", Entity.KEY_INPUTS, Double.NaN);
		this.setKeywordDoc(this.travelTime, "The time required to travel from one end of the route to the other.",
				["3.0 h", "NormalDistribution1",
				 "'1[s] + 0.5*[TimeSeries1].PresentValue'"]);
		this.travelTime.setUnitType(TimeUnit);
		this.travelTime.setRequired(true);
		this.travelTime.setValidRange(1.0e-6, Double.POSITIVE_INFINITY);
		this.addInput(this.travelTime);

		this.node1 = new Vec3dInput("Node1", Entity.KEY_INPUTS, new Vec3d(0.0, 0.0, 0.0));
		this.setKeywordDoc(this.node1, "The position of the first node.",
				["1.5 0 0 m"]);
		this.node1.setUnitType(DistanceUnit);
		this.addInput(this.node1);

		this.node2 = new Vec3dInput("Node2", Entity.KEY_INPUTS, new Vec3d(1.0, 0.0, 0.0));
		this.setKeywordDoc(this.node2, "The position of the second node.",
				["1.5 0 0 m"]);
		this.node2.setUnitType(DistanceUnit);
		this.addInput(this.node2);

		// ---- Java のフィールドの初期値（初期化ブロックの後） ----
		this.endTravelTarget = new DemoEntity_EndTravelTarget(this);
	}

	override earlyInit(): void {
		super.earlyInit();
		this.lastUpdateTime = 0.0;
		this.distance = 0.0;
		this.speed = 0.0;
		this.numberOfTrips = 0;
	}

	override startUp(): void {
		super.startUp();
		this.startTravel();
	}

	/**
	 * Starts a new trip from one node to the other
	 */
	private startTravel(): void {

		// Set the duration for the trip
		const simTime = EventManager.simSeconds();
		const duration = this.travelTime.getNextSample(this, simTime);

		// Set the speed
		this.speed = 1.0 / duration;
		if (MathUtils.near(this.distance, 1.0)) {
			this.speed = -this.speed;
		}
		this.lastUpdateTime = simTime;

		// Schedule the time at which the entity will reach the next node
		EventManager.scheduleSeconds(duration, Entity.PRI_NORMAL, Entity.EVT_LIFO, this.endTravelTarget, null);
	}

	/**
	 * Ends the trip at the next node
	 */
	endTravel(): void {

		// Update the entity's relative position
		const simTime = EventManager.simSeconds();
		this.distance += this.getDistanceTravelled(simTime);

		// Adjust the relative distance to avoid round-off error
		if (MathUtils.near(this.distance, 0.0)) {
			this.distance = 0.0;
		}
		if (MathUtils.near(this.distance, 1.0)) {
			this.distance = 1.0;
		}

		// Count the number of trips
		this.numberOfTrips++;

		// Start the next trip
		this.startTravel();
	}

	/**
	 * Returns the relative distance travelled by the entity since the last update
	 * @param simTime - present simulation time
	 * @return relative distance travelled
	 */
	private getDistanceTravelled(simTime: number): number {
		return (simTime - this.lastUpdateTime)*this.speed;
	}

	override updateGraphics(simTime: number): void {
		super.updateGraphics(simTime);

		// Leave the entity in its present position until the simulation starts
		if (simTime === 0.0)
			return;

		// Calculate the relative position of the entity at this time
		const dist = this.distance + this.getDistanceTravelled(simTime);

		// Set the entity's position
		const pos = new Vec3d();
		pos.interpolate3(this.node1.getValue()!, this.node2.getValue()!, dist);
		this.setGlobalPosition(pos);
	}

	getNumberOfTrips(simTime: number): number {
		return this.numberOfTrips;
	}

	getRelativePosition(simTime: number): number {
		return this.distance + this.getDistanceTravelled(simTime);
	}

	getRelativeSpeed(simTime: number): number {
		return this.speed;
	}

}

/**
 * EndActionTarget
 */
class DemoEntity_EndTravelTarget extends EntityTarget<DemoEntity> {
	constructor(ent: DemoEntity) {
		super(ent, "endTravel");
	}

	override process(): void {
		this.ent.endTravel();
	}
}

defineOutput(DemoEntity, {
	name: "NumberOfTrips",
	description: "Number of times the entity has travelled  in either direction between the "
	           + "two nodes.",
	unitType: DimensionlessUnit, reportable: true, sequence: 1,
	returnType: "long",
	get: (e, simTime) => e.getNumberOfTrips(simTime),
});

defineOutput(DemoEntity, {
	name: "RelativePosition",
	description: "Position of the entity between the two nodes: Node1 = 0, Node2 = 1.",
	unitType: DistanceUnit, reportable: false, sequence: 2,
	returnType: "double",
	get: (e, simTime) => e.getRelativePosition(simTime),
});

defineOutput(DemoEntity, {
	name: "RelativeSpeed",
	description: "Speed of the entity expressed as the change in relative position per unit "
	           + "time.",
	unitType: RateUnit, reportable: false, sequence: 3,
	returnType: "double",
	get: (e, simTime) => e.getRelativeSpeed(simTime),
});

ClassRegistry.register("com.jaamsim.Examples.DemoEntity", DemoEntity);
