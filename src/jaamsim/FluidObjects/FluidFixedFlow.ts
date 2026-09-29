/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2013 Ausenco Engineering Canada Inc.
 * Copyright (C) 2018-2026 JaamSim Software Inc.
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

import { ClassRegistry } from "../java/ClassRegistry.ts";
import { Double, jint } from "../java/lang.ts";
import { ColourProvInput } from "../ColourProviders/ColourProvInput.ts";
import { PolylineModel } from "../DisplayModels/PolylineModel.ts";
import type { FillEntity } from "../Graphics/FillEntity.ts";
import { LineEntity } from "../Graphics/LineEntity.ts";
import { PolylineEntity } from "../Graphics/PolylineEntity.ts";
import { SampleInput } from "../Samples/SampleInput.ts";
import { Entity } from "../basicsim/Entity.ts";
import { EventManager } from "../events/EventManager.ts";
import { ColourInput } from "../input/ColourInput.ts";
import type { Color4d } from "../math/Color4d.ts";
import { DistanceUnit } from "../units/DistanceUnit.ts";
import { VolumeFlowUnit } from "../units/VolumeFlowUnit.ts";
import type { FluidComponent } from "./FluidComponent.ts";
import { FluidFlowCalculation } from "./FluidFlowCalculation.ts";

/**
 * FluidFixedFlow models a specified flow rate between a source and destination.
 * A null source is taken to be an infinite reservoir to supply fluid.
 * A null destination is taken to be an infinite reservoir to receive fluid.
 * @author Harry King
 *
 */
export class FluidFixedFlow extends FluidFlowCalculation implements LineEntity, FillEntity, PolylineEntity {

	private readonly flowRateInput: SampleInput;

	protected readonly polylineWidth: SampleInput;

	private readonly widthInput: SampleInput;

	private readonly colourInput: ColourProvInput;

	constructor() {
		super();

		// Java の初期化ブロック
		this.displayModelListInput.clearValidClasses();
		this.displayModelListInput.addValidClass(PolylineModel);

		this.flowRateInput = new SampleInput("FlowRate", Entity.KEY_INPUTS, 0.0);
		this.setKeywordDoc(this.flowRateInput, "The constant volumetric flow rate from the source to the destination.",
		         ["1.0 m3/s"]);
		this.flowRateInput.setValidRange( 0.0, Double.POSITIVE_INFINITY);
		this.flowRateInput.setUnitType( VolumeFlowUnit );
		this.flowRateInput.setOutput(false);
		this.addInput( this.flowRateInput);

		this.polylineWidth = new SampleInput("PolylineWidth", Entity.FORMAT, 0.0);
		this.setKeywordDoc(this.polylineWidth, "Physical width of the pipe segments with units of distance.",
		         [ "0.5 m" ]);
		this.polylineWidth.setUnitType(DistanceUnit);
		this.polylineWidth.setValidRange(0.0, Double.POSITIVE_INFINITY);
		this.polylineWidth.setDefaultText("PolylineModel");
		this.addInput(this.polylineWidth);

		this.widthInput = SampleInput.ofInt("LineWidth", Entity.FORMAT, 1);
		this.setKeywordDoc(this.widthInput, "The width of the pipe segments in pixels.",
		         ["1"]);
		this.widthInput.setValidRange(1, Double.POSITIVE_INFINITY);
		this.widthInput.setIntegerValue(true);
		this.widthInput.setDefaultText("PolylineModel");
		this.addInput(this.widthInput);
		this.addSynonym(this.widthInput, "Width");

		this.colourInput = new ColourProvInput("LineColour", Entity.FORMAT, ColourInput.BLACK);
		this.setKeywordDoc(this.colourInput, "The colour of the pipe.", []);
		this.colourInput.setDefaultText("PolylineModel");
		this.colourInput.setHidden(true);
		this.addInput(this.colourInput);
		this.addSynonym(this.colourInput, "Color");
		this.addSynonym(this.colourInput, "Colour");
	}

	protected override calcFlowRate(source: FluidComponent | null, destination: FluidComponent | null, dt: number): void {

		// Update the flow rate
		this.setFlowRate( this.flowRateInput.getNextSample(this, EventManager.simSeconds()) );
	}

	isOutlined(simTime: number): boolean {
		return (this.getPolylineWidth(0.0) <= 0.0);
	}

	getLineWidth(simTime: number): number {
		if (this.widthInput.isDefault()) {
			const model = this.getDisplayModel(LineEntity);
			if (model !== null)
				return model.getLineWidth(simTime);
		}
		return jint(this.widthInput.getNextSample(this, simTime));
	}

	getLineColour(simTime: number): Color4d {
		if (this.colourInput.isDefault()) {
			const model = this.getDisplayModel(LineEntity);
			if (model !== null)
				return model.getLineColour(simTime);
		}
		return this.colourInput.getNextColour(this, simTime);
	}

	isFilled(simTime: number): boolean {
		return false;
	}

	getFillColour(simTime: number): Color4d {
		if (this.getFluid() === null)
			return ColourInput.BLACK;
		return this.getFluid()!.getColour(simTime);
	}

	isClosed(simTime: number): boolean {
		return false;
	}

	getPolylineWidth(simTime: number): number {
		if (this.polylineWidth.isDefault()) {
			const model = this.getDisplayModel(PolylineEntity);
			if (model !== null)
				return model.getPolylineWidth(simTime);
		}
		return this.polylineWidth.getNextSample(this, simTime);
	}

}

ClassRegistry.register("com.jaamsim.FluidObjects.FluidFixedFlow", FluidFixedFlow);
