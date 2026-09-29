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

// 引数の無い関数と、同じ値を返す出力の関数（double simTime を受ける方）は、1 つにした:
// getFlowArea(simTime?)・getVelocity(simTime?)・getInletPressure(simTime?)・getOutletPressure(simTime?)。

import { ClassRegistry } from "../internal.ts";
import { Double } from "../internal.ts";
import { DisplayEntity } from "../internal.ts";
import { SampleInput } from "../internal.ts";
import { Entity } from "../internal.ts";
import { EntityInput } from "../internal.ts";
import { defineOutput } from "../internal.ts";
import { AreaUnit } from "../internal.ts";
import { DimensionlessUnit } from "../internal.ts";
import { DistanceUnit } from "../internal.ts";
import { PressureUnit } from "../internal.ts";
import { SpeedUnit } from "../internal.ts";
import type { Fluid } from "./Fluid.ts";
import type { FluidFlow } from "./FluidFlow.ts";

/**
 * FluidComponent is the super-class for tanks, pipes, pumps, etc. in a hydraulic flow.
 * @author Harry King
 *
 */
export class FluidComponent extends DisplayEntity {

	private readonly previousInput: EntityInput<FluidComponent>;

	private readonly diameterInput: SampleInput;

	private fluidFlow: FluidFlow | null = null;  // The fluid flow object that controls the flow from one component to the next.
	private baseInletPressure = 0;  // The static pressure at the component's inlet, ignoring the effect of flow acceleration.
	private baseOutletPressure = 0;  // The static pressure at the component's outlet, ignoring the effect of flow acceleration.
	private inletPressure = 0;  // The static pressure at the component's inlet.
	private outletPressure = 0;  // The static pressure at the component's outlet.
	private velocity = 0;  // The fluid velocity throughout the component.
	private flowArea = 0;  // The cross-section area of the flow.

	constructor() {
		super();

		// Java の初期化ブロック
		this.previousInput = new EntityInput<FluidComponent>( FluidComponent, "Previous", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.previousInput, "The upstream component that feeds this component.", []);
		this.addInput( this.previousInput);

		this.diameterInput = new SampleInput("Diameter", Entity.KEY_INPUTS, Double.POSITIVE_INFINITY);
		this.setKeywordDoc(this.diameterInput, "The hydraulic diameter of the component. "
		                     + "Equal to the inside diameter of a pipe with a circular cross-section.",
		         ["1.0 m"]);
		this.diameterInput.setValidRange( 0.0, Double.POSITIVE_INFINITY);
		this.diameterInput.setUnitType( DistanceUnit );
		this.addInput( this.diameterInput);
	}

	override earlyInit(): void {
		super.earlyInit();
		this.flowArea = 0.25 * Math.PI * this.getDiameter(0.0) * this.getDiameter(0.0);
	}

	updateVelocity(): void {
		this.velocity = this.fluidFlow!.getFlowRate() / this.flowArea;
	}

	updateBaseInletPressure(simTime: number): void {
		const prev = this.previousInput.getValue();
		if( prev !== null ) {
			this.baseInletPressure = prev.getBaseOutletPressure() + prev.getDynamicPressure(simTime)
				- this.getDynamicPressure(simTime);
		}
		else {
			this.baseInletPressure = - this.getDynamicPressure(simTime);
		}
	}

	/*
	 * Calculate the inlet pressure after allowing for acceleration
	 */
	updateInletPressure(simTime: number): void {
		const prev = this.previousInput.getValue();
		if( prev !== null ) {
			this.inletPressure = prev.getOutletPressure() + prev.getDynamicPressure(simTime)
				- this.getDynamicPressure(simTime);
		}
		else {
			this.inletPressure = - this.getDynamicPressure(simTime);
		}
	}

	updateBaseOutletPressure(): void {
		this.baseOutletPressure = this.calcOutletPressure( this.baseInletPressure, 0.0 );
	}

	/*
	 * Update the outlet pressure after allowing for acceleration
	 */
	updateOutletPressure( flowAccel: number ): void {
		this.outletPressure = this.calcOutletPressure( this.inletPressure, flowAccel );
	}

	/*
	 * Return the outlet pressure for the given inlet pressure and flow acceleration.
	 */
	calcOutletPressure( inletPres: number, flowAccel: number ): number {
		return inletPres;
	}

	setFluidFlow( flow: FluidFlow ): void {
		this.fluidFlow = flow;
	}

	getPrevious(): FluidComponent | null {
		return this.previousInput.getValue();
	}

	getFluidFlow(): FluidFlow | null {
		return this.fluidFlow;
	}

	getFluid(): Fluid | null {
		if( this.fluidFlow !== null ) {
			return this.fluidFlow.getFluid();
		}
		else {
			return null;  // fluidFlow is null for FluidFixedFlow
		}
	}

	getLength(simTime: number): number {
		return 0.0;
	}

	getDiameter(simTime: number): number {
		return this.diameterInput.getNextSample(this, simTime);
	}

	/** Java の getFlowArea() と出力の getFlowArea(double)（同じ値） */
	getFlowArea(_simTime?: number): number {
		return this.flowArea;
	}

	addVolume( v: number ): void {}

	getBaseInletPressure(): number {
		return this.baseInletPressure;
	}

	getBaseOutletPressure(): number {
		return this.baseOutletPressure;
	}

	setBaseOutletPressure( x: number ): void {
		this.baseOutletPressure = x;
	}

	/** Java の getInletPressure() と出力の getInletPressure(double)（同じ値） */
	getInletPressure(_simTime?: number): number {
		return this.inletPressure;
	}

	/** Java の getOutletPressure() と出力の getOutletPressure(double)（同じ値） */
	getOutletPressure(_simTime?: number): number {
		return this.outletPressure;
	}

	setOutletPressure( x: number ): void {
		this.outletPressure = x;
	}

	/** Java の getVelocity() と出力の getVelocity(double)（同じ値） */
	getVelocity(_simTime?: number): number {
		return this.velocity;
	}

	getTargetInletPressure(): number {
		return 0.0;
	}

	getFluidVolume(_simTime?: number): number {
		return 0.0;
	}

	getReynoldsNumber(simTime: number): number {
		if (this.fluidFlow === null)
			return 0.0;
		return Math.abs(this.velocity) * this.getDiameter(simTime) / this.fluidFlow.getFluid()!.getKinematicViscosity(simTime);
	}

	getDynamicPressure(simTime: number): number {
		if (this.fluidFlow === null)
			return 0.0;
		return 0.5 * this.fluidFlow.getFluid()!.getDensity(simTime) * this.velocity * Math.abs(this.velocity);
	}
}

defineOutput(FluidComponent, {
	name: "FlowArea",
	description: "The cross-sectional area of the component.",
	unitType: AreaUnit,
	sequence: 0,
	returnType: "double",
	get: (e, simTime) => e.getFlowArea(simTime),
});

defineOutput(FluidComponent, {
	name: "Velocity",
	description: "The velocity of the fluid within the component.",
	unitType: SpeedUnit,
	sequence: 1,
	returnType: "double",
	get: (e, simTime) => e.getVelocity(simTime),
});

defineOutput(FluidComponent, {
	name: "ReynoldsNumber",
	description: "The Reynolds Number for the fluid within the component. "
	           + "Equal to (velocity)(diameter)/(kinematic viscosity).",
	unitType: DimensionlessUnit,
	sequence: 2,
	returnType: "double",
	get: (e, simTime) => e.getReynoldsNumber(simTime),
});

defineOutput(FluidComponent, {
	name: "DynamicPressure",
	description: "The dynamic pressure of the fluid flow. "
	           + "Equal to (0.5)(density)(velocity^2). "
	           + "Dynamic pressure is negative for negative velocities.",
	unitType: PressureUnit,
	sequence: 3,
	returnType: "double",
	get: (e, simTime) => e.getDynamicPressure(simTime),
});

defineOutput(FluidComponent, {
	name: "InletPressure",
	description: "The static pressure at the component's inlet.",
	unitType: PressureUnit,
	sequence: 4,
	returnType: "double",
	get: (e, simTime) => e.getInletPressure(simTime),
});

defineOutput(FluidComponent, {
	name: "OutletPressure",
	description: "The static pressure at the component's outlet.",
	unitType: PressureUnit,
	sequence: 5,
	returnType: "double",
	get: (e, simTime) => e.getOutletPressure(simTime),
});

ClassRegistry.register("com.jaamsim.FluidObjects.FluidComponent", FluidComponent);
