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

// updateGraphics は、処理中の物の位置（状態）を決めるので残した。

import type { DisplayEntity } from "../Graphics/DisplayEntity.ts";
import { SampleInput } from "../Samples/SampleInput.ts";
import { Entity } from "../basicsim/Entity.ts";
import { EventManager } from "../events/EventManager.ts";
import { ClassRegistry } from "../java/ClassRegistry.ts";
import { Double } from "../java/lang.ts";
import { TimeUnit } from "../units/TimeUnit.ts";
import { LinkedService } from "./LinkedService.ts";

/**
 * Server processes entities one by one from a queue.  When finished with an entity, it passes it to the next
 * LinkedComponent in the chain.
 */
export class Server extends LinkedService {

	private readonly serviceTime: SampleInput;

	private servedEntity: DisplayEntity | null = null;	// the DisplayEntity being server

	constructor() {
		super();
		this.releaseThresholdList.setHidden(false);

		this.serviceTime = new SampleInput("ServiceTime", Entity.KEY_INPUTS, 0.0);
		this.setKeywordDoc(this.serviceTime, "The service time required to process an entity.",
		         ["3.0 h", "NormalDistribution1", "'1[s] + 0.5*[TimeSeries1].PresentValue'"]);
		this.serviceTime.setUnitType(TimeUnit);
		this.serviceTime.setValidRange(0, Double.POSITIVE_INFINITY);
		this.addInput(this.serviceTime);
	}

	override earlyInit(): void {
		super.earlyInit();
		this.servedEntity = null;
	}

	protected override startProcessing(simTime: number): boolean {

		// Determine the match value
		const m = this.getNextMatchValue(EventManager.simSeconds());
		this.setMatchValue(m);

		// Remove the first entity from the queue
		this.servedEntity = this.removeNextEntity(m);
		if (this.servedEntity === null)
			return false;

		this.receiveEntity(this.servedEntity);
		this.setEntityState(this.servedEntity);

		// Assign attributes
		this.assignAttributesAtStart(simTime);

		return true;
	}

	protected override processStep(simTime: number): void {

		// Check for a release threshold closure
		if (this.isReleaseThresholdClosure()) {
			this.setReadyToRelease(true);
			return;
		}

		// Send the entity to the next component in the chain
		this.sendToNextComponent(this.servedEntity!);
		this.servedEntity = null;
	}

	protected override getStepDuration(simTime: number): number {
		return this.serviceTime.getNextSample(this, simTime);
	}

	protected override isNewStepReqd(completed: boolean): boolean {
		return completed && this.servedEntity === null;
	}

	override isFinished(): boolean {
		return this.servedEntity === null;
	}

	override updateGraphics(simTime: number): void {
		super.updateGraphics(simTime);

		if (this.servedEntity === null)
			return;
		this.moveToProcessPosition(this.servedEntity);
	}

}

ClassRegistry.register("com.jaamsim.ProcessFlow.Server", Server);
