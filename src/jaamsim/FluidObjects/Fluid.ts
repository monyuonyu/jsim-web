/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2013 Ausenco Engineering Canada Inc.
 * Copyright (C) 2023 JaamSim Software Inc.
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
import { Double } from "../internal.ts";
import { ColourProvInput } from "../internal.ts";
import { DisplayEntity } from "../internal.ts";
import { SampleInput } from "../internal.ts";
import { Entity } from "../internal.ts";
import { ColourInput } from "../internal.ts";
import type { Color4d } from "../math/Color4d.ts";
import { AccelerationUnit } from "../internal.ts";
import { DensityUnit } from "../internal.ts";
import { ViscosityUnit } from "../internal.ts";

/**
 * Fluid defines the properties of the fluid being used in a hydraulic calculation.
 * @author Harry King
 *
 */
export class Fluid extends DisplayEntity {

	private readonly densityInput: SampleInput;

	private readonly viscosityInput: SampleInput;

	private readonly colourInput: ColourProvInput;

	private readonly gravityInput: SampleInput;

	constructor() {
		super();

		// Java の初期化ブロック
		this.densityInput = new SampleInput("Density", Entity.KEY_INPUTS, 1000.0);
		this.setKeywordDoc(this.densityInput, "The density of the fluid (default = water).",
		         ["1000 kg/m3"]);
		this.densityInput.setValidRange( 0.0, Double.POSITIVE_INFINITY);
		this.densityInput.setUnitType( DensityUnit );
		this.addInput( this.densityInput);

		this.viscosityInput = new SampleInput("Viscosity", Entity.KEY_INPUTS, 0.001002);
		this.setKeywordDoc(this.viscosityInput, "The dynamic viscosity of the fluid (default = water).",
		         ["0.001002 Pa-s"]);
		this.viscosityInput.setValidRange( 0.0, Double.POSITIVE_INFINITY);
		this.viscosityInput.setUnitType( ViscosityUnit );
		this.addInput( this.viscosityInput);

		this.colourInput = new ColourProvInput("Colour", Entity.KEY_INPUTS, ColourInput.RED);
		this.setKeywordDoc(this.colourInput, "The colour used to represent the fluid.", []);
		this.addInput(this.colourInput);
		this.addSynonym(this.colourInput, "Color");

		this.gravityInput = new SampleInput("Gravity", Entity.KEY_INPUTS, 9.81);
		this.setKeywordDoc(this.gravityInput, "The acceleration of gravity to be used in the fluid flow "
		                     + "calculations.",
		         ["9.81 m/s2"]);
		this.gravityInput.setValidRange( 0.0, Double.POSITIVE_INFINITY);
		this.gravityInput.setUnitType( AccelerationUnit );
		this.addInput( this.gravityInput);
	}

	getDensity(simTime: number): number {
		return this.densityInput.getNextSample(this, simTime);
	}

	getViscosity(simTime: number): number {
		return this.viscosityInput.getNextSample(this, simTime);
	}

	getColour(simTime: number): Color4d {
		return this.colourInput.getNextColour(this, simTime);
	}

	getGravity(simTime: number): number {
		return this.gravityInput.getNextSample(this, simTime);
	}

	getDensityxGravity(simTime: number): number {
		return this.getDensity(simTime) * this.getGravity(simTime);
	}

	getKinematicViscosity(simTime: number): number {
		return this.getViscosity(simTime) / this.getDensity(simTime);
	}
}

ClassRegistry.register("com.jaamsim.FluidObjects.Fluid", Fluid);
