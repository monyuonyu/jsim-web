/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2019-2026 JaamSim Software Inc.
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

import { ExpressionThreshold } from "../Thresholds/ExpressionThreshold.ts";
import { Queue } from "../ProcessFlow/Queue.ts";
import { Server } from "../ProcessFlow/Server.ts";
import { SampleInput } from "../Samples/SampleInput.ts";
import { Entity } from "../basicsim/Entity.ts";
import { InputAgent } from "../input/InputAgent.ts";
import { ClassRegistry } from "../java/ClassRegistry.ts";
import { Double } from "../java/lang.ts";
import { Vec3d } from "../math/Vec3d.ts";
import { DimensionlessUnit } from "../units/DimensionlessUnit.ts";
import { DistanceUnit } from "../units/DistanceUnit.ts";
import { CompoundEntity } from "./CompoundEntity.ts";
import { SubModelEnd } from "./SubModelEnd.ts";
import { SubModelStart } from "./SubModelStart.ts";

export class ServerAndQueue extends CompoundEntity {

	private maxQueueLength: SampleInput;

	constructor() {
		super();
		this.maxQueueLength = new SampleInput("MaxQueueLength", Entity.KEY_INPUTS, Double.POSITIVE_INFINITY);
		this.setKeywordDoc(this.maxQueueLength, "The queue length at which the Threshold output closes.",
				[ "3", "[InputValue1].Value" ]);
		this.maxQueueLength.setUnitType(DimensionlessUnit);
		this.maxQueueLength.setIntegerValue(true);
		this.maxQueueLength.setValidRange(0.0, Double.POSITIVE_INFINITY);
		this.addInput(this.maxQueueLength);
	}

	override postDefine(): void {
		super.postDefine();

		// Create the sub-model components
		const simModel = this.getJaamSimModel();
		const start = InputAgent.generateEntityWithName(simModel, SubModelStart, null, "Start", this, true, true);
		const queue = InputAgent.generateEntityWithName(simModel, Queue, null, "Queue", this, true, true);
		const threshold = InputAgent.generateEntityWithName(simModel, ExpressionThreshold, null, "Threshold", this, true, true);
		const server = InputAgent.generateEntityWithName(simModel, Server, null, "Server", this, true, true);
		const end = InputAgent.generateEntityWithName(simModel, SubModelEnd, null, "End", this, true, true);

		// SubModelStart inputs
		InputAgent.applyArgs(start, "NextComponent", queue.getName());
		start.getInput("NextComponent")!.setLocked(true);

		// Server inputs
		InputAgent.applyArgs(server, "WaitQueue", queue.getName());
		InputAgent.applyArgs(server, "NextComponent", end.getName());
		server.getInput("WaitQueue")!.setLocked(true);
		server.getInput("NextComponent")!.setLocked(true);

		// Threshold inputs
		const expString = "sub.[Queue].QueueLength < sub.MaxQueueLength";
		InputAgent.applyArgs(threshold, "OpenCondition", expString);
		InputAgent.applyArgs(threshold, "WatchList", queue.getName());
		threshold.getInput("OpenCondition")!.setLocked(true);
		threshold.getInput("WatchList")!.setLocked(true);

		// Set the scale, size, and position of the sub-model region
		const region = this.getSubModelRegion()!;
		InputAgent.applyValue(region, "Scale",    0.5, "");
		InputAgent.applyVec3d(region, "Size",     new Vec3d(1.5,  1.0, 0.0), DistanceUnit);
		InputAgent.applyVec3d(region, "Position", new Vec3d(0.0, -1.5, 0.0), DistanceUnit);

		// Set the region
		InputAgent.applyArgs(start,     "Region", region.getName());
		InputAgent.applyArgs(queue,     "Region", region.getName());
		InputAgent.applyArgs(threshold, "Region", region.getName());
		InputAgent.applyArgs(server,    "Region", region.getName());
		InputAgent.applyArgs(end,       "Region", region.getName());
		start.getInput("Region")!.setLocked(true);
		queue.getInput("Region")!.setLocked(true);
		threshold.getInput("Region")!.setLocked(true);
		server.getInput("Region")!.setLocked(true);
		end.getInput("Region")!.setLocked(true);

		// Set the component positions within the sub-model region
		InputAgent.applyVec3d(start,     "Position", new Vec3d(-1.0, -0.4, 0.0), DistanceUnit);
		InputAgent.applyVec3d(queue,     "Position", new Vec3d(-0.5,  0.4, 0.0), DistanceUnit);
		InputAgent.applyVec3d(threshold, "Position", new Vec3d( 0.5,  0.4, 0.0), DistanceUnit);
		InputAgent.applyVec3d(server,    "Position", new Vec3d( 0.0, -0.4, 0.0), DistanceUnit);
		InputAgent.applyVec3d(end,       "Position", new Vec3d( 1.0, -0.4, 0.0), DistanceUnit);
	}

}

ClassRegistry.register("com.jaamsim.SubModels.ServerAndQueue", ServerAndQueue);
