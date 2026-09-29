/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2014-2015 Ausenco Engineering Canada Inc.
 * Copyright (C) 2022-2024 JaamSim Software Inc.
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

import { Double } from "../java/lang.ts";
import { ClassRegistry } from "../java/ClassRegistry.ts";
import { ColourProvInput } from "../ColourProviders/ColourProvInput.ts";
import { ShapeModel } from "../DisplayModels/ShapeModel.ts";
import { DisplayEntity } from "../Graphics/DisplayEntity.ts";
import { SampleInput } from "../Samples/SampleInput.ts";
import { Entity } from "../basicsim/Entity.ts";
import { ColourInput } from "../input/ColourInput.ts";
import { defineOutput } from "../input/OutputRegistry.ts";
import { StringInput } from "../input/StringInput.ts";
import { DimensionlessUnit } from "../units/DimensionlessUnit.ts";

export class BooleanIndicator extends DisplayEntity {

	private readonly expInput: SampleInput;

	private readonly trueColor: ColourProvInput;

	private readonly falseColor: ColourProvInput;

	private readonly trueText: StringInput;

	private readonly falseText: StringInput;

	constructor() {
		super();

		// Java の初期化ブロック
		this.expInput = new SampleInput("DataSource", Entity.KEY_INPUTS, Double.NaN);
		this.setKeywordDoc(this.expInput, "An expression returning a boolean value: zero = FALSE, "
		                     + "non-zero = TRUE.",
		         ["'[Queue1].QueueLength > 2'", "[Server1].Working"]);
		this.expInput.setUnitType(DimensionlessUnit);
		this.expInput.setRequired(true);
		this.addInput(this.expInput);
		this.addSynonym(this.expInput, "OutputName");

		this.trueColor = new ColourProvInput("TrueColour", Entity.KEY_INPUTS, ColourInput.GREEN);
		this.setKeywordDoc(this.trueColor, "The colour of the indicator when the DataSource expression is TRUE.", []);
		this.addInput(this.trueColor);
		this.addSynonym(this.trueColor, "TrueColor");

		this.falseColor = new ColourProvInput("FalseColour", Entity.KEY_INPUTS, ColourInput.RED);
		this.setKeywordDoc(this.falseColor, "The colour of the indicator when the DataSource expression is FALSE.", []);
		this.addInput(this.falseColor);
		this.addSynonym(this.falseColor, "FalseColor");

		this.trueText = new StringInput("TrueText", Entity.KEY_INPUTS, "TRUE");
		this.setKeywordDoc(this.trueText, "The string returned by the Text output when the DataSource expression "
		                     + "is TRUE.",
		         ["'True text'"]);
		this.addInput(this.trueText);

		this.falseText = new StringInput("FalseText", Entity.KEY_INPUTS, "FALSE");
		this.setKeywordDoc(this.falseText, "The string returned by the Text output when the DataSource expression "
		                     + "is FALSE.",
		         ["'False text'"]);
		this.addInput(this.falseText);
	}

	/** 描画の更新のうち、状態（色の値）の計算だけを残す（PORTING.md の 7） */
	override updateGraphics(simTime: number): void {
		super.updateGraphics(simTime);

		if (this.expInput.isDefault())
			return;
		if (this.expInput.getNextSample(this, simTime) !== 0.0)
			this.setTagColour(ShapeModel.TAG_CONTENTS, this.trueColor.getNextColour(this, simTime));
		else
			this.setTagColour(ShapeModel.TAG_CONTENTS, this.falseColor.getNextColour(this, simTime));
	}

	getText(simTime: number): string {
		if (this.expInput.isDefault())
			return "";
		if (this.expInput.getNextSample(this, simTime) !== 0.0)
			return this.trueText.getValue();
		else
			return this.falseText.getValue();
	}

}

ClassRegistry.register("com.jaamsim.BasicObjects.BooleanIndicator", BooleanIndicator);

defineOutput(BooleanIndicator, {
	name: "Text",
	description: "If the DataSource expression is TRUE, then return TrueText. "
	           + "If it is FALSE, then return FalseText.",
	unitType: DimensionlessUnit, reportable: false, sequence: 100,
	returnType: "String",
	get: (e, simTime) => e.getText(simTime),
});
