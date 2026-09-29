/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2014 Ausenco Engineering Canada Inc.
 * Copyright (C) 2021-2024 JaamSim Software Inc.
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

// 多重定義の扱い: 出力の getNextSample(double simTime) と、SampleProvider の getNextSample(Entity, double) は、
// 最初の引数が数かどうかで見分ける（1 つの関数）。

import { Double } from "../java/lang.ts";
import type { JClass } from "../java/lang.ts";
import { ClassRegistry } from "../java/ClassRegistry.ts";
import { tr } from "../i18n/I18n.ts";
import { DisplayEntity } from "../Graphics/DisplayEntity.ts";
import { SampleInput } from "../Samples/SampleInput.ts";
import type { SampleProvider } from "../Samples/SampleProvider.ts";
import { Entity } from "../basicsim/Entity.ts";
import { EventManager } from "../events/EventManager.ts";
import { InputErrorException } from "../input/InputErrorException.ts";
import { defineOutput } from "../input/OutputRegistry.ts";
import { ValueListInput } from "../input/ValueListInput.ts";
import { DimensionlessUnit } from "../units/DimensionlessUnit.ts";
import { TimeUnit } from "../units/TimeUnit.ts";
import type { Unit } from "../units/Unit.ts";

export class EventSchedule extends DisplayEntity implements SampleProvider {

	private readonly timeList: ValueListInput;

	private readonly cycleTime: SampleInput;

	private index = -1;
	private firstSample = true;

	constructor() {
		super();

		// Java の初期化ブロック
		this.timeList = new ValueListInput("TimeList", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.timeList, "A sequence of monotonically-increasing simulation times at which to "
		                     + "generate events. "
		                     + "Times entered in date format are converted to simulation time using "
		                     + "the StartDate input for the Simulation object.",
		         ["2  10  18  h",
		          "'1970-01-15 12:30:00'  '1970-02-07 8:00:00'  '1970-03-30 18:00:00'"]);
		this.timeList.setUnitType(TimeUnit);
		this.timeList.setValidRange(0.0, Double.POSITIVE_INFINITY);
		this.timeList.setMonotonic(1);
		this.timeList.setRequired(true);
		this.addInput(this.timeList);

		this.cycleTime = new SampleInput("CycleTime", Entity.KEY_INPUTS, Double.NaN);
		this.setKeywordDoc(this.cycleTime, "Defines when the event times will repeat from the start.",
		         ["8760.0 h"]);
		this.cycleTime.setUnitType(TimeUnit);
		this.cycleTime.setValidRange(0.0, Double.POSITIVE_INFINITY);
		this.cycleTime.setRequired(true);
		this.addInput(this.cycleTime);
	}

	override validate(): void {
		super.validate();
		const list = this.timeList.getValue()!;
		if (list.get(list.size()-1) > this.cycleTime.getNextSample(this, 0.0))
			throw new InputErrorException(tr("The input for CycleTime must be greater than or equal "
					+ "to the last entry for TimeList."));
	}

	override earlyInit(): void {
		super.earlyInit();
		this.index = -1;
		this.firstSample = true;
	}

	getUnitType(): JClass<Unit> {
		return TimeUnit;
	}

	getMeanValue(simTime: number): number {
		return 0;
	}

	getIndexOfSample(simTime: number): number {
		return this.index+1;
	}

	/**
	 * Java の出力 getNextSample(double simTime) と、SampleProvider の getNextSample(Entity thisEnt, double simTime)。
	 */
	getNextSample(thisEnt: Entity | number, simTime?: number): number {
		if (typeof thisEnt === "number")
			return this.getNextSample(this, thisEnt);

		const list = this.timeList.getValue();

		if (list === null)
			return Double.NaN;

		// If called from a model thread, increment the index to be selected
		if (EventManager.hasCurrent()) {
			this.index = (this.index + 1) % list.size();
			if (this.firstSample && this.index > 0)
				this.firstSample = false;
		}

		// Trap an index that is out of range. Note that index can exceed the size of the list
		// if the TimeList keyword is edited in the middle of a run
		if (this.index < 0 || this.index >= list.size())
			return Double.NaN;


		if (this.index === 0) {
			// The first IAT calculated from the list is referenced to zero simulation time
			if (this.firstSample)
				return list.get(0);

			// All but the first IATs are referenced to the last time in the list
			return list.get(0) + this.cycleTime.getNextSample(this, simTime!) - list.get(list.size()-1);
		}

		return list.get(this.index) - list.get(this.index-1);
	}

}

ClassRegistry.register("com.jaamsim.BasicObjects.EventSchedule", EventSchedule);

defineOutput(EventSchedule, {
	name: "Index",
	description: "The position of the event time in the list for the last inter-arrival time "
	           + "that was returned.",
	unitType: DimensionlessUnit, reportable: false, sequence: 0,
	returnType: "int",
	get: (e, simTime) => e.getIndexOfSample(simTime),
});

defineOutput(EventSchedule, {
	name: "Value",
	description: "The last inter-arrival time returned from the sequence. When used in an "
	           + "expression, this output returns a new value every time the expression "
	           + "is evaluated.",
	unitType: TimeUnit, reportable: false, sequence: 1,
	returnType: "double",
	get: (e, simTime) => e.getNextSample(simTime),
});
