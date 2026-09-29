//@@HEADER@@
import { BooleanProvInput } from "../BooleanProviders/BooleanProvInput.ts";
import { ColourProvInput } from "../ColourProviders/ColourProvInput.ts";
import type { FillEntity } from "../Graphics/FillEntity.ts";
import { LateClasses, jint } from "../Graphics/LateClasses.ts";
import type { LineEntity } from "../Graphics/LineEntity.ts";
import { SampleInput } from "../Samples/SampleInput.ts";
import { Entity } from "../basicsim/Entity.ts";
import { ColourInput } from "../input/ColourInput.ts";
import { Double } from "../java/lang.ts";
import type { Color4d } from "../math/Color4d.ts";
import { DisplayModel } from "./DisplayModel.ts";

/**
 * DisplayModel for two dimensional objects that can be filled and/or outlined in specified
 * colours.
 * @author Harry King
 *
 */
export abstract class AbstractShapeModel extends DisplayModel implements LineEntity, FillEntity {

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
		this.addInput(this.filled);

		this.fillColour = new ColourProvInput("FillColour", Entity.FORMAT, ColourInput.MED_GREY);
		this.setKeywordDoc(this.fillColour, "The colour with which the object is filled.", []);
		this.addInput(this.fillColour);
		this.addSynonym(this.fillColour, "FillColor");

		this.outlined = new BooleanProvInput("Outlined", Entity.FORMAT, false);
		this.setKeywordDoc(this.outlined, "Determines whether or not the object is outlined. "
		                     + "If TRUE, it is outlined with a specified colour. "
		                     + "If FALSE, it is drawn without an outline.", []);
		this.addInput(this.outlined);

		this.lineColour = new ColourProvInput("LineColour", Entity.FORMAT, ColourInput.BLACK);
		this.setKeywordDoc(this.lineColour, "The colour with which the object is outlined.", []);
		this.addInput(this.lineColour);
		this.addSynonym(this.lineColour, "OutlineColour");
		this.addSynonym(this.lineColour, "OutlineColor");

		this.lineWidth = SampleInput.ofInt("LineWidth", Entity.FORMAT, 1);
		this.setKeywordDoc(this.lineWidth, "Width of the outline in pixels.",
				[ "3" ]);
		this.lineWidth.setValidRange(0, Double.POSITIVE_INFINITY);
		this.lineWidth.setIntegerValue(true);
		this.addInput(this.lineWidth);
	}

	isFilled(simTime: number): boolean {
		return this.filled.getNextBoolean(this, simTime);
	}

	isOutlined(simTime: number): boolean {
		return this.outlined.getNextBoolean(this, simTime);
	}

	getLineWidth(simTime: number): number {
		return jint(this.lineWidth.getNextSample(this, simTime));
	}

	getFillColour(simTime: number): Color4d {
		return this.fillColour.getNextColour(this, simTime);
	}

	getLineColour(simTime: number): Color4d {
		return this.lineColour.getNextColour(this, simTime);
	}

}

LateClasses.bind("com.jaamsim.DisplayModels.AbstractShapeModel", AbstractShapeModel);
