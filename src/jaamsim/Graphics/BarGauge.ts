/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2016-2023 JaamSim Software Inc.
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
 * TypeScript への移植 (C) 2026 shota
 */
import { ColourProvInput } from "../internal.ts";
import { ShapeModel } from "../internal.ts";
import { SampleInput } from "../internal.ts";
import { Entity } from "../internal.ts";
import { ColourInput } from "../internal.ts";
import { defineOutput } from "../internal.ts";
import { ClassRegistry } from "../internal.ts";
import { Double } from "../internal.ts";
import type { Vec3d } from "../math/Vec3d.ts";
import { DimensionlessUnit } from "../internal.ts";
import { DisplayEntity } from "../internal.ts";
import { LateClasses } from "../internal.ts";

export class BarGauge extends DisplayEntity {

	private readonly dataSource: SampleInput;

	private readonly colour: ColourProvInput;

	private readonly backgroundColour: ColourProvInput;

	constructor() {
		super();

		// ---- Java の初期化ブロック ----
		this.dataSource = new SampleInput("DataSource", Entity.KEY_INPUTS, 0.5);
		this.setKeywordDoc(this.dataSource, "Height of the bar expressed as a value between 0 and 1. Values "
		                     + "outside this range will be truncated.",
				["0.5", "'0.5 + 0.5*sin(this.SimTime/10[s])'"]);
		this.dataSource.setUnitType(DimensionlessUnit);
		this.dataSource.setValidRange(0.0, 1.0);
		this.addInput(this.dataSource);

		this.colour = new ColourProvInput("Colour", Entity.KEY_INPUTS, ColourInput.BLUE);
		this.setKeywordDoc(this.colour, "Colour of the bar.", []);
		this.addInput(this.colour);
		this.addSynonym(this.colour, "Color");

		this.backgroundColour = new ColourProvInput("BackgroundColour", Entity.KEY_INPUTS, ColourInput.LIGHT_GREY);
		this.setKeywordDoc(this.backgroundColour, "Colour of the gauge's body.", []);
		this.addInput(this.backgroundColour);
		this.addSynonym(this.backgroundColour, "BackgroundColor");
	}

	getValue(simTime: number): number {
		let ret = this.dataSource.getNextSample(this, simTime);
		ret = Math.min(ret, 1.0);
		ret = Math.max(ret, 0.0);
		return ret;
	}

	override getSize(): Vec3d {
		const ret = super.getSize();
		ret.z = Math.max(ret.z, 0.001);
		return ret;
	}

	override updateGraphics(simTime: number): void {
		super.updateGraphics(simTime);

		let val = this.getValue(simTime);
		if (Double.isNaN(val)) {
			val = 0.0;
		}

		this.setTagSize(ShapeModel.TAG_CONTENTS, val);
		this.setTagColour(ShapeModel.TAG_CONTENTS, this.colour.getNextColour(this, simTime));
		this.setTagColour(ShapeModel.TAG_BODY, this.backgroundColour.getNextColour(this, simTime));
	}

}

defineOutput(BarGauge, {
	name: "Value",
	description: "Value displayed by the gauge.",
	unitType: DimensionlessUnit, reportable: false, sequence: 100,
	returnType: "double",
	get: (e, simTime) => e.getValue(simTime),
});

ClassRegistry.register("com.jaamsim.Graphics.BarGauge", BarGauge);
LateClasses.bind("com.jaamsim.Graphics.BarGauge", BarGauge);
