/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2013 Ausenco Engineering Canada Inc.
 * Copyright (C) 2016-2023 JaamSim Software Inc.
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

// interface Controllable は、ファイルの最後で Controllable.register(CalculationEntity) として印を付けた（子クラスにも効く）。

import { DisplayEntity } from "../Graphics/DisplayEntity.ts";
import { SampleInput } from "../Samples/SampleInput.ts";
import { Entity } from "../basicsim/Entity.ts";
import { EntityInput } from "../input/EntityInput.ts";
import { Double } from "../java/lang.ts";
import { DimensionlessUnit } from "../units/DimensionlessUnit.ts";
import { Controllable } from "./Controllable.ts";
import { Controller } from "./Controller.ts";

/**
 * CalculationEntity is the super-class for all Calculation Objects.
 * @author Harry King
 *
 */
export abstract class CalculationEntity extends DisplayEntity implements Controllable {

	protected readonly controller: EntityInput<Controller>;

	private readonly sequenceNumber: SampleInput;

	constructor() {
		super();

		// Java の初期化ブロック
		this.controller = new EntityInput<Controller>(Controller, "Controller", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.controller, "The Controller object that signals the updating of the calculation.", []);
		this.controller.setRequired(true);
		this.addInput(this.controller);

		this.sequenceNumber = new SampleInput("SequenceNumber", Entity.KEY_INPUTS, 0.0);
		this.setKeywordDoc(this.sequenceNumber, "The sequence number used by the Controller to determine the order "
		                     + "in which calculations are performed. A calculation with a lower value "
		                     + "is executed before one with a higher value.",
		         ["2.1"]);
		this.sequenceNumber.setValidRange(0.0, Double.POSITIVE_INFINITY);
		this.sequenceNumber.setUnitType(DimensionlessUnit);
		this.addInput(this.sequenceNumber);
	}

	getController(): Controller | null {
		return this.controller.getValue();
	}

	getSequenceNumber(): number {
		return this.sequenceNumber.getNextSample(this, 0.0);
	}

	abstract update(simTime: number): void;
}

Controllable.register(CalculationEntity);
