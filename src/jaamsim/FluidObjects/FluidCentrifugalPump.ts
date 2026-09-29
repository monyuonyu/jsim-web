/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2013 Ausenco Engineering Canada Inc.
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
import { DoubleCalculation } from "../internal.ts";
import { SampleInput } from "../internal.ts";
import { Entity } from "../internal.ts";
import { EventManager } from "../internal.ts";
import { EntityInput } from "../internal.ts";
import { PressureUnit } from "../internal.ts";
import { VolumeFlowUnit } from "../internal.ts";
import { FluidComponent } from "../internal.ts";

/**
 * FluidCentrifugalPump models the performance of a centrifugal pump.
 * @author Harry King
 *
 */
export class FluidCentrifugalPump extends FluidComponent {

	private readonly maxFlowRateInput: SampleInput;

	private readonly maxPressureInput: SampleInput;

	private readonly maxPressureLossInput: SampleInput;

	private readonly speedControllerInput: EntityInput<DoubleCalculation>;

	constructor() {
		super();

		// Java の初期化ブロック
		this.maxFlowRateInput = new SampleInput("MaxFlowRate", Entity.KEY_INPUTS, 1.0);
		this.setKeywordDoc(this.maxFlowRateInput, "Maximum volumetric flow rate that the pump can generate.",
		         ["1.0 m3/s"]);
		this.maxFlowRateInput.setValidRange( 0.0, Double.POSITIVE_INFINITY);
		this.maxFlowRateInput.setUnitType( VolumeFlowUnit );
		this.addInput( this.maxFlowRateInput);

		this.maxPressureInput = new SampleInput("MaxPressure", Entity.KEY_INPUTS, 1.0);
		this.setKeywordDoc(this.maxPressureInput, "Maximum static pressure that the pump can generate (at zero flow rate).",
		         ["1.0 Pa"]);
		this.maxPressureInput.setValidRange( 0.0, Double.POSITIVE_INFINITY);
		this.maxPressureInput.setUnitType( PressureUnit );
		this.addInput( this.maxPressureInput);

		this.maxPressureLossInput = new SampleInput("MaxPressureLoss", Entity.KEY_INPUTS, 1.0);
		this.setKeywordDoc(this.maxPressureLossInput, "Maximum static pressure loss for the pump (at maximum flow rate).",
		         ["1.0 Pa"]);
		this.maxPressureLossInput.setValidRange( 0.0, Double.POSITIVE_INFINITY);
		this.maxPressureLossInput.setUnitType( PressureUnit );
		this.addInput( this.maxPressureLossInput);

		this.speedControllerInput = new EntityInput<DoubleCalculation>( DoubleCalculation, "SpeedController", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.speedControllerInput, "The CalculationEntity whose output sets the rotational speed of the pump. "
		                     + "The output value is ratio of present speed to maximum speed (0.0 - 1.0).",
		         ["Calc1"]);
		this.addInput( this.speedControllerInput);
		this.speedControllerInput.setRequired(true);
	}

	/*
	 * Return the outlet pressure for the given inlet pressure and flow acceleration.
	 */
	override calcOutletPressure( inletPres: number, flowAccel: number ): number {
		const simTime = EventManager.simSeconds();
		let speedFactor = this.speedControllerInput.getValue()!.getLastValue();
		speedFactor = Math.max(speedFactor, 0.0);
		speedFactor = Math.min(speedFactor, 1.0);
		const flowFactor = this.getFluidFlow()!.getFlowRate() / this.maxFlowRateInput.getNextSample(this, simTime);
		let pres = inletPres;
		pres += this.maxPressureInput.getNextSample(this, simTime) * speedFactor * speedFactor;
		pres -= this.maxPressureLossInput.getNextSample(this, simTime) * Math.abs(flowFactor) * flowFactor;
		return pres;
	}
}

ClassRegistry.register("com.jaamsim.FluidObjects.FluidCentrifugalPump", FluidCentrifugalPump);
