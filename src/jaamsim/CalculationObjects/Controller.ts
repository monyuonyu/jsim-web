/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2013 Ausenco Engineering Canada Inc.
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

// 入れ子のクラス: EntitySequenceSort → Controller_EntitySequenceSort、DoUpdateTarget → Controller_DoUpdateTarget（このファイルの中）。
// getCount() と出力の getCount(double) は同じ値なので、getCount(simTime?) の 1 つにした。
// ProcessTarget のフィールド doUpdate は、関数 doUpdate() とぶつかるので doUpdateTarget にした（private）。

import { ClassRegistry } from "../internal.ts";
import { Double, jint } from "../internal.ts";
import { DisplayEntity } from "../internal.ts";
import { SampleInput } from "../internal.ts";
import { Entity } from "../internal.ts";
import { EntityTarget } from "../internal.ts";
import type { ObserverEntity } from "../basicsim/ObserverEntity.ts";
import type { SubjectEntity } from "../basicsim/SubjectEntity.ts";
import { SubjectEntityDelegate } from "../internal.ts";
import { EventManager } from "../internal.ts";
import type { ProcessTarget } from "../events/ProcessTarget.ts";
import { defineOutput } from "../internal.ts";
import { DimensionlessUnit } from "../internal.ts";
import { TimeUnit } from "../internal.ts";
import { isControllable } from "../internal.ts";
import { type Controllable } from "./Controllable.ts";

/** Java の Double.compare（NaN は最も大きい、-0.0 は 0.0 より小さい） */
function doubleCompare(d1: number, d2: number): number {
	if (d1 < d2)
		return -1;
	if (d1 > d2)
		return 1;
	const n1 = Number.isNaN(d1);
	const n2 = Number.isNaN(d2);
	if (n1 || n2)
		return n1 === n2 ? 0 : (n1 ? 1 : -1);
	const z1 = Object.is(d1, -0);
	const z2 = Object.is(d2, -0);
	return z1 === z2 ? 0 : (z1 ? -1 : 1);
}

/**
 * Generates update signals that are sent to the objects managed by the Controller.
 * @author Harry King
 *
 */
export class Controller extends DisplayEntity implements SubjectEntity {

	private readonly firstTime: SampleInput;

	private readonly interval: SampleInput;

	private readonly maxUpdates: SampleInput;

	private readonly entityList: Controllable[];  // Entities controlled by this Controller.
	private count = 0;  // Number of update cycle completed.

	private readonly doUpdateTarget: ProcessTarget = new Controller_DoUpdateTarget(this);

	private readonly subject = new SubjectEntityDelegate(this);

	constructor() {
		super();

		// Java の初期化ブロック
		this.firstTime = new SampleInput("FirstTime", Entity.KEY_INPUTS, 0.0);
		this.setKeywordDoc(this.firstTime, "Simulation time for the first update signal.",
		         ["5 s"]);
		this.firstTime.setUnitType(TimeUnit);
		this.firstTime.setValidRange(0.0, Double.POSITIVE_INFINITY);
		this.addInput(this.firstTime);

		this.interval = new SampleInput("Interval", Entity.KEY_INPUTS, Double.NaN);
		this.setKeywordDoc(this.interval, "Time interval between update signals.",
		         ["100 ms"]);
		this.interval.setUnitType(TimeUnit);
		this.interval.setValidRange(0.0, Double.POSITIVE_INFINITY);
		this.interval.setRequired(true);
		this.addInput(this.interval);
		this.addSynonym(this.interval, "SamplingTime");

		this.maxUpdates = new SampleInput("MaxUpdates", Entity.KEY_INPUTS, Double.POSITIVE_INFINITY);
		this.setKeywordDoc(this.maxUpdates, "Maximum number of updates to perform.",
		         ["5"]);
		this.maxUpdates.setValidRange(0, Double.POSITIVE_INFINITY);
		this.maxUpdates.setIntegerValue(true);
		this.addInput(this.maxUpdates);

		// Java のコンストラクタ
		this.entityList = [];
	}

	private static readonly sequenceSort = new (class Controller_EntitySequenceSort {
		compare(c1: Controllable, c2: Controllable): number {
			return doubleCompare(c1.getSequenceNumber(), c2.getSequenceNumber());
		}
	})();

	override earlyInit(): void {
		super.earlyInit();
		this.count = 0;

		// Prepare a list of the calculation entities managed by this controller
		this.entityList.length = 0;
		for (const ent of this.getJaamSimModel().getClonesOfIterator(Entity, isControllable)) {
			const con = ent as unknown as Controllable;
			if (con.getController() === this)
				this.entityList.push(con);
		}

		// Sort the calculation entities into the correct sequence
		// TODO(移植): Java の Collections.sort（TimSort）と Array.prototype.sort は、どちらも安定なので並びは同じ。
		// ただし比べる回数・順番は違うので、SequenceNumber に乱数（確率分布）を使っていると、乱数を引く回数が変わる。
		this.entityList.sort((a, b) => Controller.sequenceSort.compare(a, b));

		// Clear the list of observers
		this.subject.clear();
	}

	registerObserver(obs: ObserverEntity): void {
		this.subject.registerObserver(obs);
	}

	notifyObservers(): void {
		this.subject.notifyObservers();
	}

	override getObserverList(_simTime?: number): ObserverEntity[] {
		return this.subject.getObserverList();
	}

	override startUp(): void {
		super.startUp();

		// Schedule the first update
		if (this.getMaxUpdates(0.0) > 0)
			EventManager.scheduleSeconds(this.firstTime.getNextSample(this, 0.0), Entity.PRI_NORMAL, Entity.EVT_LIFO, this.doUpdateTarget, null);
	}

	doUpdate(): void {

		// Update the last value for each entity
		const simTime = EventManager.simSeconds();
		for (const ent of this.entityList) {
			ent.update(simTime);
		}

		// Notify any observers
		this.notifyObservers();

		// Increment the number of cycles
		this.count++;

		// Schedule the next update
		if (this.count < this.getMaxUpdates(simTime))
			EventManager.scheduleSeconds(this.interval.getNextSample(this, simTime), Entity.PRI_NORMAL, Entity.EVT_LIFO, this.doUpdateTarget, null);
	}

	/** Java の getCount() と出力の getCount(double)（同じ値） */
	getCount(_simTime?: number): number {
		return this.count;
	}

	getMaxUpdates(simTime: number): number {
		return jint(this.maxUpdates.getNextSample(this, simTime));
	}

	getEntityList(_simTime: number): Controllable[] {
		return this.entityList;
	}

}

class Controller_DoUpdateTarget extends EntityTarget<Controller> {
	constructor(ent: Controller) {
		super(ent, "doUpdate");
	}

	override process(): void {
		this.ent.doUpdate();
	}
}

defineOutput(Controller, {
	name: "EntityList",
	description: "Objects that receive update signals from this Controller, listed in the "
	           + "sequence in which the updates are performed.",
	unitType: DimensionlessUnit,
	sequence: 1,
	returnType: "ArrayList",
	get: (e, simTime) => e.getEntityList(simTime),
});

defineOutput(Controller, {
	name: "Count",
	description: "Total number of updates that have been performed.",
	unitType: DimensionlessUnit,
	sequence: 1,
	returnType: "double",
	get: (e, simTime) => e.getCount(simTime),
});

ClassRegistry.register("com.jaamsim.CalculationObjects.Controller", Controller);
