//@@HEADER@@
import { BooleanProvInput } from "../BooleanProviders/BooleanProvInput.ts";
import { ColourProvInput } from "../ColourProviders/ColourProvInput.ts";
import { SampleInput } from "../Samples/SampleInput.ts";
import { Entity } from "../basicsim/Entity.ts";
import { ColourInput } from "../input/ColourInput.ts";
import { Double } from "../java/lang.ts";
import type { Color4d } from "../math/Color4d.ts";
import { DisplayEntity } from "./DisplayEntity.ts";
import { FillEntity } from "./FillEntity.ts";
import { LateClasses, jint } from "./LateClasses.ts";
import { LineEntity } from "./LineEntity.ts";

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

		this.lineWidth = new SampleInput("LineWidth", Entity.FORMAT, 1);
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
