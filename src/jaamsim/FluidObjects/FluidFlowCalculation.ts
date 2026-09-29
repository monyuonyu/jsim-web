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

// getFlowRate() と出力の getFlowRate(double)（Java では Double を返す）は同じ値なので、getFlowRate(simTime?) の 1 つにした。

import { CalculationEntity } from "../internal.ts";
import { Entity } from "../internal.ts";
import { EntityInput } from "../internal.ts";
import { defineOutput } from "../internal.ts";
import { VolumeFlowUnit } from "../internal.ts";
import { Fluid } from "../internal.ts";
import { FluidComponent } from "../internal.ts";

/**
 * FluidFlowCalculation is the super-class for all flows between source and destination tanks.
 * @author Harry King
 *
 */
export abstract class FluidFlowCalculation extends CalculationEntity {

	private readonly fluidInput: EntityInput<Fluid>;

	protected readonly sourceInput: EntityInput<FluidComponent>;

	protected readonly destinationInput: EntityInput<FluidComponent>;

	private flowRate = 0;  // The volumetric flow rate (m3/s) for the route.
	private lastUpdateTime = 0;  // The time at which the last update was performed.

	constructor() {
		super();

		// Java の初期化ブロック
		this.fluidInput = new EntityInput<Fluid>( Fluid, "Fluid", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.fluidInput, "The Fluid being moved by the flow.", []);
		this.addInput( this.fluidInput);
		this.fluidInput.setRequired(true);

		this.sourceInput = new EntityInput<FluidComponent>( FluidComponent, "Source", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.sourceInput, "The source object for the flow.",
		         ["Tank1"]);
		this.addInput( this.sourceInput);

		this.destinationInput = new EntityInput<FluidComponent>( FluidComponent, "Destination", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.destinationInput, "The destination object for the flow.",
		         ["Tank1"]);
		this.addInput( this.destinationInput);
	}

	override earlyInit(): void {
		super.earlyInit();
		this.lastUpdateTime = 0.0;
	}

	override update(simTime: number): void {

		const dt = simTime - this.lastUpdateTime;
		this.lastUpdateTime = simTime;

		// Update the volume stored at the source and destination
		const source = this.sourceInput.getValue();
		const destination = this.destinationInput.getValue();
		let dV = this.flowRate * dt;
		if( dV > 0.0 && source !== null ) {
			dV = Math.min( dV, source.getFluidVolume() );
		}
		else if( dV < 0.0 && destination !== null ) {
			dV = - Math.min( - dV, destination.getFluidVolume() );
		}
		if( source !== null ) { source.addVolume( -dV ); }
		if( destination !== null ) { destination.addVolume( dV ); }

		// Set the new flow rate
		this.calcFlowRate( source, destination, dt);
	}

	protected abstract calcFlowRate( source: FluidComponent | null, destination: FluidComponent | null, dt: number ): void;

	protected setFlowRate( rate: number ): void {
		this.flowRate = rate;
	}

	/** Java の getFlowRate() と出力の getFlowRate(double)（同じ値） */
	getFlowRate(_simTime?: number): number {
		return this.flowRate;
	}

	protected getSource(): FluidComponent | null {
		return this.sourceInput.getValue();
	}

	protected getDestination(): FluidComponent | null {
		return this.destinationInput.getValue();
	}

	getFluid(): Fluid | null {
		return this.fluidInput.getValue();
	}
}

defineOutput(FluidFlowCalculation, {
	name: "FlowRate",
	description: "The volumetric flow rate for the system.",
	unitType: VolumeFlowUnit,
	returnType: "double",  // Java は Double（箱に入れた double）
	get: (e, simTime) => e.getFlowRate(simTime),
});
