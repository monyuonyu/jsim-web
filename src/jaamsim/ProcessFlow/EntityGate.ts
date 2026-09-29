/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2014 Ausenco Engineering Canada Inc.
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

// updateGraphics は、放す直前の物の位置（状態）を決めるので残した。

import type { DowntimeEntity } from "../BasicObjects/DowntimeEntity.ts";
import type { DisplayEntity } from "../Graphics/DisplayEntity.ts";
import { SampleInput } from "../Samples/SampleInput.ts";
import { Entity } from "../basicsim/Entity.ts";
import { EventManager } from "../events/EventManager.ts";
import { defineOutput } from "../input/OutputRegistry.ts";
import { ClassRegistry } from "../java/ClassRegistry.ts";
import { Double } from "../java/lang.ts";
import { DimensionlessUnit } from "../units/DimensionlessUnit.ts";
import { TimeUnit } from "../units/TimeUnit.ts";
import { LinkedService } from "./LinkedService.ts";

/** Java の (int) x（double → int。0 の方向へ切り捨て、範囲外は端、NaN は 0） */
function jint(x: number): number {
	if (Number.isNaN(x))
		return 0;
	if (x >= 2147483647)
		return 2147483647;
	if (x <= -2147483648)
		return -2147483648;
	return Math.trunc(x);
}

export class EntityGate extends LinkedService {

	private readonly releaseDelay: SampleInput;

	private readonly numberToRelease: SampleInput;

	private servedEntity: DisplayEntity | null = null; // the entity about to be released from the queue
	private num = 0;  // number released since the gate opened

	constructor() {
		super();
		this.releaseDelay = new SampleInput("ReleaseDelay", Entity.KEY_INPUTS, 0.0);
		this.setKeywordDoc(this.releaseDelay, "The time delay before each queued entity is released.\n" +
				"Entities arriving at an open gate are not delayed.",
		         ["3.0 h", "ExponentialDistribution1", "'1[s] + 0.5*[TimeSeries1].PresentValue'"]);
		this.releaseDelay.setUnitType(TimeUnit);
		this.releaseDelay.setValidRange(0.0, Double.POSITIVE_INFINITY);
		this.addInput(this.releaseDelay);

		this.numberToRelease = new SampleInput("NumberToRelease", Entity.KEY_INPUTS, Double.POSITIVE_INFINITY);
		this.setKeywordDoc(this.numberToRelease, "Maximum number of entites to release each time the gate is opened.",
		         ["3", "[InputValue1].Value"]);
		this.numberToRelease.setUnitType(DimensionlessUnit);
		this.numberToRelease.setIntegerValue(true);
		this.numberToRelease.setValidRange(0.0, Double.POSITIVE_INFINITY);
		this.addInput(this.numberToRelease);
	}

	override earlyInit(): void {
		super.earlyInit();
		this.servedEntity = null;
		this.num = 0;
	}

	override addEntity(ent: DisplayEntity): void {

		// If the gate is closed, in maintenance or breakdown, or other entities are already
		// queued, then add the entity to the queue
		const simTime = EventManager.simSeconds();
		const queue = this.getQueue(simTime)!;
		if (!queue.isEmpty() || !this.isIdle() || this.num >= this.getNumberToRelease(EventManager.simSeconds())) {
			queue.addEntity(ent);
			return;
		}

		// If the gate is open and there are no other entities still in the queue,
		// then send the entity to the next component
		this.num++;
		this.receiveEntity(ent);
		this.setEntityState(ent);
		this.sendToNextComponent(ent);
	}

	protected override startProcessing(simTime: number): boolean {

		if (this.num >= this.getNumberToRelease(simTime))
			return false;

		// Determine the match value
		const m = this.getNextMatchValue(EventManager.simSeconds());
		this.setMatchValue(m);

		// Select the next entity to release
		this.servedEntity = this.removeNextEntity(m);
		if (this.servedEntity === null)
			return false;

		this.receiveEntity(this.servedEntity);
		this.setEntityState(this.servedEntity);
		this.num++;

		// Assign attributes
		this.assignAttributesAtStart(simTime);

		return true;
	}

	/**
	 * Loop recursively through the queued entities, releasing them one by one.
	 */
	protected override processStep(simTime: number): void {

		// Release the first element in the queue and send to the next component
		this.sendToNextComponent(this.servedEntity!);
		this.servedEntity = null;
	}

	protected override getStepDuration(simTime: number): number {
		return this.releaseDelay.getNextSample(this, simTime);
	}

	override thresholdChanged(): void {
		super.thresholdChanged();
		if (!this.isOpen()) {
			this.num = 0;
		}
	}

	override startDowntime(down: DowntimeEntity): void {
		super.startDowntime(down);
		this.num = 0;
	}

	getNumberToRelease(simTime: number): number {
		return jint(this.numberToRelease.getNextSample(this, simTime));
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

	getNumberReleased(simTime: number): number {
		return this.num;
	}

}

ClassRegistry.register("com.jaamsim.ProcessFlow.EntityGate", EntityGate);

defineOutput(EntityGate, {
	name: "NumberReleased",
	description: "Number of entities released during the present opening of the gate. "
	             + "Zero is returned if the gate is closed.",
	unitType: DimensionlessUnit,
	sequence: 0,
	returnType: "int",
	get: (e, simTime) => e.getNumberReleased(simTime),
});
