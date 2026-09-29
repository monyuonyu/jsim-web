/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2014 Ausenco Engineering Canada Inc.
 * Copyright (C) 2018-2023 JaamSim Software Inc.
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
import { ClassRegistry } from "../java/ClassRegistry.ts";
import { DimensionlessUnit } from "../units/DimensionlessUnit.ts";
import { LateClasses } from "./LateClasses.ts";
import { Text } from "./Text.ts";

/**
 * BillboardText is a DisplayEntity used to display billboarded text labels
 * @author matt.chudleigh
 *
 */
export class BillboardText extends Text {

	constructor() {
		super();

		// ---- Java の初期化ブロック ----
		// Set the default text height to 10 pixels
		this.textHeight.setUnitType(DimensionlessUnit);
		this.textHeight.setDefaultValue(10.0);

		// Alignment and AutoSize inputs are ignored
		this.alignmentInput.setHidden(true);
		this.autoSize.setHidden(true);
		this.autoSize.setDefaultValue(false);
	}

	override getTextHeight(simTime: number): number {
		if (this.textHeight.isDefault()) {
			return this.getTextModel().getTextHeightInPixels(simTime);
		}
		return this.textHeight.getNextSample(this, simTime);
	}

	override getTextHeightString(): string {
		if (this.textHeight.isDefault()) {
			return this.getTextModel().getTextHeightInPixelsString();
		}
		return this.textHeight.getValueString();
	}

}

ClassRegistry.register("com.jaamsim.Graphics.BillboardText", BillboardText);
LateClasses.bind("com.jaamsim.Graphics.BillboardText", BillboardText);
