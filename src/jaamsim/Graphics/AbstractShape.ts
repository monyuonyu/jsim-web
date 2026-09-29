/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2021-2023 JaamSim Software Inc.
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
import { BooleanProvInput } from "../internal.ts";
import { ColourProvInput } from "../internal.ts";
import { SampleInput } from "../internal.ts";
import { Entity } from "../internal.ts";
import { ColourInput } from "../internal.ts";
import { Double } from "../internal.ts";
import type { Color4d } from "../math/Color4d.ts";
import { DisplayEntity } from "../internal.ts";
import { FillEntity } from "../internal.ts";
import { LateClasses, jint } from "../internal.ts";
import { LineEntity } from "../internal.ts";

/**
 * Two dimensional objects that can be filled and/or outlined in specified colours.
 * @author Harry King
 *
 */
export abstract class AbstractShape extends DisplayEntity implements LineEntity, FillEntity {

	protected readonly filled: BooleanProvInput;

	protected readonly fillColour: ColourProvInput;

	protected readonly outlined: BooleanProvInput;

	protected readonly lineColour: ColourProvInput;

	protected readonly lineWidth: SampleInput;

	constructor() {
		super();

		// ---- Java の初期化ブロック ----
		this.filled = new BooleanProvInput("Filled", Entity.FORMAT, false);
		this.setKeywordDoc(this.filled, "Determines whether or not the object is filled. "
		                     + "If TRUE, it is filled with a specified colour. "
		                     + "If FALSE, it is hollow.", []);
		this.filled.setDefaultText("DisplayModel value");
		this.addInput(this.filled);

		this.fillColour = new ColourProvInput("FillColour", Entity.FORMAT, ColourInput.MED_GREY);
		this.setKeywordDoc(this.fillColour, "The colour with which the object is filled.", []);
		this.fillColour.setDefaultText("DisplayModel value");
		this.addInput(this.fillColour);

		this.outlined = new BooleanProvInput("Outlined", Entity.FORMAT, false);
		this.setKeywordDoc(this.outlined, "Determines whether or not the object is outlined. "
		                     + "If TRUE, it is outlined with a specified colour. "
		                     + "If FALSE, it is drawn without an outline.", []);
		this.outlined.setDefaultText("DisplayModel value");
		this.addInput(this.outlined);

		this.lineColour = new ColourProvInput("LineColour", Entity.FORMAT, ColourInput.BLACK);
		this.setKeywordDoc(this.lineColour, "The colour with which the object is outlined.", []);
		this.lineColour.setDefaultText("DisplayModel value");
		this.addInput(this.lineColour);

		this.lineWidth = SampleInput.ofInt("LineWidth", Entity.FORMAT, 1);
		this.setKeywordDoc(this.lineWidth, "Width of the outline in pixels.",
				[ "3" ]);
		this.lineWidth.setValidRange(0, Double.POSITIVE_INFINITY);
		this.lineWidth.setIntegerValue(true);
		this.lineWidth.setDefaultText("DisplayModel value");
		this.addInput(this.lineWidth);
	}

	isFilled(simTime: number): boolean {
		if (this.filled.isDefault()) {
			const model = this.getDisplayModel(FillEntity);
			if (model !== null)
				return model.isFilled(simTime);
		}
		return this.filled.getNextBoolean(this, simTime);
	}

	getFillColour(simTime: number): Color4d {
		if (this.fillColour.isDefault()) {
			const model = this.getDisplayModel(FillEntity);
			if (model !== null)
				return model.getFillColour(simTime);
		}
		return this.fillColour.getNextColour(this, simTime);
	}

	isOutlined(simTime: number): boolean {
		if (this.outlined.isDefault()) {
			const model = this.getDisplayModel(LineEntity);
			if (model !== null)
				return model.isOutlined(simTime);
		}
		return this.outlined.getNextBoolean(this, simTime);
	}

	getLineWidth(simTime: number): number {
		if (this.lineWidth.isDefault()) {
			const model = this.getDisplayModel(LineEntity);
			if (model !== null)
				return model.getLineWidth(simTime);
		}
		return jint(this.lineWidth.getNextSample(this, simTime));
	}

	getLineColour(simTime: number): Color4d {
		if (this.lineColour.isDefault()) {
			const model = this.getDisplayModel(LineEntity);
			if (model !== null)
				return model.getLineColour(simTime);
		}
		return this.lineColour.getNextColour(this, simTime);
	}

}

LateClasses.bind("com.jaamsim.Graphics.AbstractShape", AbstractShape);
