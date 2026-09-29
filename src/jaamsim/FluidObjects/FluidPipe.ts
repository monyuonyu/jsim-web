/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2013 Ausenco Engineering Canada Inc.
 * Copyright (C) 2018-2023 JaamSim Software Inc.
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

import { ClassRegistry } from "../internal.ts";
import { Double, jint } from "../internal.ts";
import { tr } from "../internal.ts";
import { ColourProvInput } from "../internal.ts";
import { PolylineModel } from "../internal.ts";
import type { FillEntity } from "../Graphics/FillEntity.ts";
import { LineEntity } from "../internal.ts";
import { PolylineEntity } from "../internal.ts";
import { SampleInput } from "../internal.ts";
import { Entity } from "../internal.ts";
import { EventManager } from "../internal.ts";
import { ColourInput } from "../internal.ts";
import { defineOutput } from "../internal.ts";
import type { Color4d } from "../math/Color4d.ts";
import { DimensionlessUnit } from "../internal.ts";
import { DistanceUnit } from "../internal.ts";
import { FluidComponent } from "../internal.ts";

/**
 * FluidPipe is a pipe through which fluid can flow.
 * @author Harry King
 *
 */
export class FluidPipe extends FluidComponent implements LineEntity, FillEntity, PolylineEntity {

	private readonly lengthInput: SampleInput;

	private readonly heightChangeInput: SampleInput;

	private readonly roughnessInput: SampleInput;

	private readonly pressureLossCoefficientInput: SampleInput;

	protected readonly polylineWidth: SampleInput;

	private readonly widthInput: SampleInput;

	private readonly colourInput: ColourProvInput;

	private darcyFrictionFactor = 0;  // The Darcy Friction Factor for the pipe flow.

	constructor() {
		super();

		// Java の初期化ブロック
		this.displayModelListInput.clearValidClasses();
		this.displayModelListInput.addValidClass(PolylineModel);

		this.lengthInput = new SampleInput("Length", Entity.KEY_INPUTS, 1.0);
		this.setKeywordDoc(this.lengthInput, "The length of the pipe.",
		         ["10.0 m"]);
		this.lengthInput.setValidRange( 0.0, Double.POSITIVE_INFINITY);
		this.lengthInput.setUnitType( DistanceUnit );
		this.addInput( this.lengthInput);

		this.heightChangeInput = new SampleInput("HeightChange", Entity.KEY_INPUTS, 0.0);
		this.setKeywordDoc(this.heightChangeInput, "The height change over the length of the pipe. "
		                     + "Equal to (outlet height - inlet height).",
		         ["0.0 m"]);
		this.heightChangeInput.setValidRange( Double.NEGATIVE_INFINITY, Double.POSITIVE_INFINITY);
		this.heightChangeInput.setUnitType( DistanceUnit );
		this.addInput( this.heightChangeInput);

		this.roughnessInput = new SampleInput("Roughness", Entity.KEY_INPUTS, 0.0);
		this.setKeywordDoc(this.roughnessInput, "The roughness height of the inside pipe surface. "
		                     + "Used to calculate the Darcy friction factor for the pipe.",
		         ["0.01 m"]);
		this.roughnessInput.setValidRange( 0.0, Double.POSITIVE_INFINITY);
		this.roughnessInput.setUnitType( DistanceUnit );
		this.addInput( this.roughnessInput);

		this.pressureLossCoefficientInput = new SampleInput("PressureLossCoefficient", Entity.KEY_INPUTS, 0.0);
		this.setKeywordDoc(this.pressureLossCoefficientInput, "The pressure loss coefficient or 'K-factor' for the pipe. "
		                     + "The factor multiplies the dynamic pressure and is applied as a loss "
		                     + "at the pipe outlet.",
		         ["0.5"]);
		this.pressureLossCoefficientInput.setValidRange( 0.0, Double.POSITIVE_INFINITY);
		this.pressureLossCoefficientInput.setUnitType( DimensionlessUnit );
		this.addInput( this.pressureLossCoefficientInput);

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

	override calcOutletPressure( inletPres: number, flowAccel: number ): number {
		const simTime = EventManager.simSeconds();

		const dyn = this.getDynamicPressure(simTime);  // Note that dynamic pressure is negative for negative velocities
		let pres = inletPres;
		pres -= this.getFluid()!.getDensityxGravity(simTime) * this.heightChangeInput.getNextSample(this, simTime);
		if (Math.abs(dyn) > 0.0 && this.getFluid()!.getViscosity(simTime) > 0.0 ) {
			this.setDarcyFrictionFactor(simTime);
			pres -= this.darcyFrictionFactor * dyn * this.getLength(simTime) / this.getDiameter(simTime);
		}
		else {
			this.darcyFrictionFactor = 0.0;
		}
		pres -= this.pressureLossCoefficientInput.getNextSample(this, simTime) * dyn;
		pres -= flowAccel * this.getFluid()!.getDensity(simTime) * this.getLength(simTime) / this.getFlowArea();
		return pres;
	}

	override getLength(simTime: number): number {
		return this.lengthInput.getNextSample(this, simTime);
	}

	private setDarcyFrictionFactor(simTime: number): void {

		const reynoldsNumber = this.getReynoldsNumber(simTime);

		// Laminar Flow
		if( reynoldsNumber < 2300.0 ) {
			this.darcyFrictionFactor = this.getLaminarFrictionFactor(simTime, reynoldsNumber);
		}
		// Turbulent Flow
		else if( reynoldsNumber > 4000.0 ) {
			this.darcyFrictionFactor = this.getTurbulentFrictionFactor(simTime, reynoldsNumber);
		}
		// Transitional Flow
		else {
			this.darcyFrictionFactor = 0.5 * (this.getLaminarFrictionFactor(simTime, reynoldsNumber) + this.getTurbulentFrictionFactor(simTime, reynoldsNumber));
		}
	}

	/*
	 * Return the Darcy Friction Factor for a laminar flow.
	 */
	private getLaminarFrictionFactor(simTime: number, reynoldsNumber: number): number {
		return 64.0 / reynoldsNumber;
	}

	/*
	 * Return the Darcy Friction Factor for a turbulent flow.
	 */
	private getTurbulentFrictionFactor(simTime: number, reynoldsNumber: number): number {
		let x = 1.0;  // The present value for x = 1 / sqrt( frictionfactor ).
		let lastx = 0.0;

		const a = (this.roughnessInput.getNextSample(this, simTime) / this.getDiameter(simTime)) / 3.7;
		const b = 2.51 / reynoldsNumber;

		let n = 0;
		while( Math.abs(x-lastx)/lastx > 1.0e-10 && n < 20 ) {
			lastx = x;
			x = -2.0 * Math.log10( a + b*lastx );
			n++;
		}

		if( n >= 20 ) {
			this.error(tr("Darcy Friction Factor iterations did not converge: lastx = %f  x = %f  n = %d"),
			      lastx, x, n);
		}

		return 1.0 / ( x * x );
	}

	isOutlined(simTime: number): boolean {
		return (this.getPolylineWidth(simTime) <= 0.0);
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

	getDarcyFrictionFactor(simTime: number): number {
		return this.darcyFrictionFactor;
	}

}

defineOutput(FluidPipe, {
	name: "DarcyFrictionFactor",
	description: "The Darcy Friction Factor for the pipe.",
	unitType: DimensionlessUnit,
	returnType: "double",
	get: (e, simTime) => e.getDarcyFrictionFactor(simTime),
});

ClassRegistry.register("com.jaamsim.FluidObjects.FluidPipe", FluidPipe);
