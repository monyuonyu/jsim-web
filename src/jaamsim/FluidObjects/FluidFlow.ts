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
import { tr } from "../internal.ts";
import { EventManager } from "../internal.ts";
import { InputErrorException } from "../internal.ts";
import { defineOutput } from "../internal.ts";
import type { FluidComponent } from "./FluidComponent.ts";
import { FluidFlowCalculation } from "../internal.ts";

/**
 * FluidFlow tracks the flow rate between a source and a destination.
 * @author Harry King
 *
 */
export class FluidFlow extends FluidFlowCalculation {

	private flowAcceleration = 0;  // The rate of change of the volumetric flow rate with respect to time (m3/s2).

	private routeList: FluidComponent[];  // A list of the hydraulic components in the flow, from source to destination.
	private totalFlowInertia = 0;  // The sum of Density x Length / FlowArea for the hydraulic components in the route.
	private destinationBaseInletPressure = 0;  // The base pressure at the destination's inlet.
	private destinationTargetInletPressure = 0;  // The desired inlet pressure at the destination's inlet.

	constructor() {
		super();

		// Java の初期化ブロック
		this.sourceInput.setRequired(true);
		this.destinationInput.setRequired(true);

		// Java のコンストラクタ
		this.routeList = [];
	}

	override earlyInit(): void {
		super.earlyInit();

		this.flowAcceleration = 0.0;

		// Construct the list of hydraulic components in the flow path
		this.routeList.length = 0;
		this.routeList.push( this.getDestination()! );
		let prev = this.routeList[0].getPrevious();
		while( prev !== null ) {
			this.routeList.splice(0, 0, prev);
			prev = prev.getPrevious();
		}

		// Confirm that the first component is the source
		if( this.routeList[0] !== this.getSource() ) {
			throw new InputErrorException( tr("The source of the route is not connected to the destination by the 'Previous' keyword inputs for the individual components.") );
		}

		// Set the Flow object for each component in the route
		for( const each of this.routeList ) {
			each.setFluidFlow( this );
		}

		// Calculate the total flow inertia of the flow path
		this.totalFlowInertia = 0.0;
		for( const each of this.routeList ) {
			each.earlyInit();  // Needs to be called to set flowArea
			this.totalFlowInertia += each.getLength(0.0) / each.getFlowArea();
		}
		this.totalFlowInertia *= this.getFluid()!.getDensity(0.0);
	}

	protected override calcFlowRate( source: FluidComponent | null, destination: FluidComponent | null, dt: number ): void {
		const simTime = EventManager.simSeconds();

		// Update the flow rate
		this.setFlowRate( this.getFlowRate() + this.flowAcceleration * dt );

		// Update the flow velocity and base pressures in each component of the flow route
		// (base pressure ignores the affect of acceleration)
		for( const each of this.routeList ) {
			each.updateVelocity();
			each.updateBaseInletPressure(simTime);
			each.updateBaseOutletPressure();
		}

		// Update the flow acceleration
		this.destinationBaseInletPressure = destination!.getBaseInletPressure();
		this.destinationTargetInletPressure = destination!.getTargetInletPressure();
		this.flowAcceleration = ( this.destinationBaseInletPressure
				- this.destinationTargetInletPressure ) / this.totalFlowInertia;

		// Update the pressure in each component of the flow route after allowing for acceleration
		for( const each of this.routeList ) {
			each.updateInletPressure(simTime);
			each.updateOutletPressure( this.flowAcceleration );
		}

		// Confirm that the pressure is now balanced
		const diff = destination!.getInletPressure() /
				destination!.getTargetInletPressure() - 1.0;
		if( Math.abs( diff ) > 1.0e-4 ) {
			this.error(tr("Pressure did not balance correctly.  Difference = %f"), diff);
		}
	}

	getFlowAcceleration( simTime: number ): number {
		return this.flowAcceleration;
	}

	getFlowInertia( simTime: number ): number {
		return this.totalFlowInertia;
	}
}

defineOutput(FluidFlow, {
	name: "FlowAcceleration",
	description: "The time derivative of the volumetric flow rate.",
	returnType: "double",
	get: (e, simTime) => e.getFlowAcceleration(simTime),
});

defineOutput(FluidFlow, {
	name: "FlowInertia",
	description: "The sum of (density)(length)/(flow area) for the hydraulic components in the route.",
	returnType: "double",
	get: (e, simTime) => e.getFlowInertia(simTime),
});

ClassRegistry.register("com.jaamsim.FluidObjects.FluidFlow", FluidFlow);
