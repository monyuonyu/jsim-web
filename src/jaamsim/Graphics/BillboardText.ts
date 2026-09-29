//@@HEADER@@
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
