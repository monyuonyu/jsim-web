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

// getFluidVolume() と出力の getFluidVolume(double)、getFluidLevel() と出力の getFluidLevel(double) は、
// それぞれ同じ値なので simTime を省ける 1 つの関数にした。
// updateGraphics は、中身の量の割合と色（状態の値）を決めるだけなので残した。

import { ClassRegistry } from "../internal.ts";
import { Double } from "../internal.ts";
import { ShapeModel } from "../internal.ts";
import { SampleInput } from "../internal.ts";
import { Entity } from "../internal.ts";
import { EventManager } from "../internal.ts";
import { ColourInput } from "../internal.ts";
import type { Input } from "../input/Input.ts";
import type { InputCallback } from "../input/InputCallback.ts";
import { defineOutput } from "../internal.ts";
import type { Color4d } from "../math/Color4d.ts";
import { DistanceUnit } from "../internal.ts";
import { PressureUnit } from "../internal.ts";
import { VolumeUnit } from "../internal.ts";
import { FluidComponent } from "../internal.ts";

/**
 * FluidTank is a storage tank that contains a fluid.
 * @author Harry King
 *
 */
export class FluidTank extends FluidComponent {

	private readonly capacityInput: SampleInput;

	private readonly initialVolumeInput: SampleInput;

	private readonly ambientPressureInput: SampleInput;

	private readonly inletHeightInput: SampleInput;

	private fluidVolume = 0;  // The present volume of the fluid in the tank.
	private fluidLevel = 0;  // The height of the fluid in the tank.

	static readonly updateInitialVolumeInputCallback: InputCallback = {
		callback(ent: Entity, inp: Input<unknown>): void {
			const val = (inp as SampleInput).getNextSample(ent, 0.0);
			(ent as FluidTank).setFluidVolume(val);
		},
	};

	constructor() {
		super();

		// Java の初期化ブロック
		this.capacityInput = new SampleInput("Capacity", Entity.KEY_INPUTS, 1.0);
		this.setKeywordDoc(this.capacityInput, "The total volume of fluid that can be stored in the tank.",
		         ["1.0 m3"]);
		this.capacityInput.setValidRange( 0.0, Double.POSITIVE_INFINITY);
		this.capacityInput.setUnitType( VolumeUnit );
		this.addInput( this.capacityInput);

		this.initialVolumeInput = new SampleInput("InitialVolume", Entity.KEY_INPUTS, 0.0);
		this.setKeywordDoc(this.initialVolumeInput, "The volume of fluid in the tank at the start of the simulation run.",
		         ["1.0 m3"]);
		this.initialVolumeInput.setValidRange( 0.0, Double.POSITIVE_INFINITY);
		this.initialVolumeInput.setUnitType( VolumeUnit );
		this.initialVolumeInput.setCallback(FluidTank.updateInitialVolumeInputCallback);
		this.addInput( this.initialVolumeInput);

		this.ambientPressureInput = new SampleInput("AmbientPressure", Entity.KEY_INPUTS, 0.0);
		this.setKeywordDoc(this.ambientPressureInput, "The atmospheric pressure acting on the surface of the fluid in the "
		                     + "tank.",
		         ["1.0 Pa"]);
		this.ambientPressureInput.setUnitType( PressureUnit );
		this.addInput( this.ambientPressureInput);

		this.inletHeightInput = new SampleInput("InletHeight", Entity.KEY_INPUTS, 0.0);
		this.setKeywordDoc(this.inletHeightInput, "The height of the flow feeding the tank. Measured relative to the "
		                     + "bottom of the tank.",
		         ["1.0 m"]);
		this.inletHeightInput.setValidRange( 0.0, Double.POSITIVE_INFINITY);
		this.inletHeightInput.setUnitType( DistanceUnit );
		this.addInput( this.inletHeightInput);
	}

	override earlyInit(): void {
		super.earlyInit();
		this.setFluidVolume(this.initialVolumeInput.getNextSample(this, 0.0));
	}

	override addVolume( v: number ): void {
		this.fluidVolume += v;
		this.fluidLevel = this.fluidVolume / this.getFlowArea();
	}

	override calcOutletPressure( inletPres: number, flowAccel: number ): number {
		return this.getFluidPressure(0.0);
	}

	override getTargetInletPressure(): number {
		const h = this.inletHeightInput.getNextSample(this, EventManager.simSeconds());
		return this.getFluidPressure(h);
	}

	/*
	 * Return the pressure in the tank at the given height above the outlet.
	 */
	private getFluidPressure( h: number ): number {
		const simTime = EventManager.simSeconds();
		let pres = this.ambientPressureInput.getNextSample(this, simTime);
		if( h < this.fluidLevel ) {
			pres += (this.fluidLevel - h) * this.getFluid()!.getDensityxGravity(simTime);
		}
		return pres;
	}

	setFluidVolume(val: number): void {
		this.fluidVolume = val;
	}

	/** Java の getFluidVolume() と出力の getFluidVolume(double)（同じ値） */
	override getFluidVolume(_simTime?: number): number {
		return this.fluidVolume;
	}

	/** Java の getFluidLevel() と出力の getFluidLevel(double)（同じ値） */
	getFluidLevel(_simTime?: number): number {
		return this.fluidLevel;
	}

	override updateGraphics(simTime: number): void {
		super.updateGraphics(simTime);

		const ratio = Math.min(1.0, this.fluidVolume / this.capacityInput.getNextSample(this, simTime));

		this.setTagSize(ShapeModel.TAG_CONTENTS, ratio);

		if( this.getFluid() !== null )
			this.setTagColour(ShapeModel.TAG_CONTENTS, this.getFluid()!.getColour(simTime));
		else
			this.setTagColour(ShapeModel.TAG_CONTENTS, ColourInput.getColorWithName("black") as Color4d);
	}
}

defineOutput(FluidTank, {
	name: "FluidVolume",
	description: "The volume of the fluid stored in the tank.",
	unitType: VolumeUnit,
	returnType: "double",
	get: (e, simTime) => e.getFluidVolume(simTime),
});

defineOutput(FluidTank, {
	name: "FluidLevel",
	description: "The height of the fluid from the bottom of the tank.",
	unitType: DistanceUnit,
	returnType: "double",
	get: (e, simTime) => e.getFluidLevel(simTime),
});

ClassRegistry.register("com.jaamsim.FluidObjects.FluidTank", FluidTank);
