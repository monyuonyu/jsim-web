//@@HEADER@@
import { ColourProvInput } from "../ColourProviders/ColourProvInput.ts";
import { ShapeModel } from "../DisplayModels/ShapeModel.ts";
import { SampleInput } from "../Samples/SampleInput.ts";
import { Entity } from "../basicsim/Entity.ts";
import { ColourInput } from "../input/ColourInput.ts";
import { defineOutput } from "../input/OutputRegistry.ts";
import { ClassRegistry } from "../java/ClassRegistry.ts";
import { Double } from "../java/lang.ts";
import type { Vec3d } from "../math/Vec3d.ts";
import { DimensionlessUnit } from "../units/DimensionlessUnit.ts";
import { DisplayEntity } from "./DisplayEntity.ts";
import { LateClasses } from "./LateClasses.ts";

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
