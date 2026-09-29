/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2013 Ausenco Engineering Canada Inc.
 * Copyright (C) 2016-2024 JaamSim Software Inc.
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

// DoubleCalculation の private の lastUpdateTime と同じ名前のフィールドがあるが、TS では同じ物になってしまうので、
// このクラスの方は pidLastUpdateTime にした（private なので外からは見えない）。

import type { JClass } from "../java/lang.ts";
import { ClassRegistry } from "../java/ClassRegistry.ts";
import { Double } from "../java/lang.ts";
import { SampleInput } from "../Samples/SampleInput.ts";
import { Entity } from "../basicsim/Entity.ts";
import type { Input } from "../input/Input.ts";
import type { InputCallback } from "../input/InputCallback.ts";
import { defineOutput } from "../input/OutputRegistry.ts";
import { UnitTypeInput } from "../input/UnitTypeInput.ts";
import { DimensionlessUnit } from "../units/DimensionlessUnit.ts";
import { RateUnit } from "../units/RateUnit.ts";
import { TimeUnit } from "../units/TimeUnit.ts";
import type { Unit } from "../units/Unit.ts";
import { UserSpecifiedUnit } from "../units/UserSpecifiedUnit.ts";
import { DoubleCalculation } from "./DoubleCalculation.ts";

/**
 * The PIDController simulates a Proportional-Integral-Differential type Controller.
 * Error = (SetPoint - ProcessVariable) / ProcessVariableScale
 * Output =  ProportionalGain * [ Error + (Integral/IntegralTime) + (DerivativeTime*Derivative) ]
 * @author Harry King
 *
 */
export class PIDController extends DoubleCalculation {

	private readonly setPoint: SampleInput;

	private readonly processVariable: SampleInput;

	private readonly processVariableScale: SampleInput;

	protected readonly outputUnitType: UnitTypeInput;

	private readonly proportionalGain: SampleInput;

	private readonly integralTime: SampleInput;

	private readonly derivativeTime: SampleInput;

	private readonly outputLow: SampleInput;

	private readonly outputHigh: SampleInput;

	private pidLastUpdateTime = 0;  // The time at which the last update was performed
	private lastError = 0;  // The previous value for the error signal
	private integral = 0;  // The integral of the error signal

	static override readonly unitTypeInputCallback: InputCallback = {
		callback(ent: Entity, inp: Input<unknown>): void {
			(ent as PIDController).updateUnitTypeCallback();
		},
	};

	constructor() {
		super();

		// Java の初期化ブロック
		this.inputValue.setHidden(true);

		this.setPoint = new SampleInput("SetPoint", Entity.KEY_INPUTS, Double.NaN);
		this.setKeywordDoc(this.setPoint, "The set point for the PID controller. The unit type for the set point "
		                     + "is given by the UnitType keyword.",
		         ["1.2 m", "TimeSeries1", "'1[m] + 2*[TimeSeries1].Value'"]);
		this.setPoint.setUnitType(UserSpecifiedUnit);
		this.setPoint.setRequired(true);
		this.addInput(this.setPoint);

		this.processVariable = new SampleInput("ProcessVariable", Entity.KEY_INPUTS, Double.NaN);
		this.setKeywordDoc(this.processVariable, "The process variable feedback to the PID controller. The unit type "
		                     + "for the process variable is given by the UnitType keyword.",
		         ["Process", "'1[m] + [Process].Value'"]);
		this.processVariable.setUnitType(UserSpecifiedUnit);
		this.processVariable.setRequired(true);
		this.addInput(this.processVariable);

		this.processVariableScale = new SampleInput("ProcessVariableScale", Entity.KEY_INPUTS, 1.0);
		this.setKeywordDoc(this.processVariableScale, "A constant with the same unit type as the process variable and the "
		                     + "set point. The difference between the process variable and the set "
		                     + "point is divided by this quantity to make a dimensionless variable.",
		         ["1.0 kg"]);
		this.processVariableScale.setValidRange(0.0, Double.POSITIVE_INFINITY);
		this.processVariableScale.setUnitType(UserSpecifiedUnit);
		this.addInput(this.processVariableScale);

		this.outputUnitType = new UnitTypeInput("OutputUnitType", Entity.KEY_INPUTS, UserSpecifiedUnit);
		this.setKeywordDoc(this.outputUnitType, "The unit type for the output from the PID controller.",
		         ["DistanceUnit"]);
		this.outputUnitType.setRequired(true);
		this.outputUnitType.setCallback(PIDController.unitTypeInputCallback);
		this.addInput(this.outputUnitType);

		this.proportionalGain = new SampleInput("ProportionalGain", Entity.KEY_INPUTS, 1.0);
		this.setKeywordDoc(this.proportionalGain, "The coefficient applied to the proportional feedback loop. "
		                     + "The unit type for the proportional gain is given by the "
		                     + "outputUnitType keyword.",
		         ["1.3 m"]);
		this.proportionalGain.setValidRange(0.0, Double.POSITIVE_INFINITY);
		this.proportionalGain.setUnitType(UserSpecifiedUnit);
		this.addInput(this.proportionalGain);

		this.integralTime = new SampleInput("IntegralTime", Entity.KEY_INPUTS, 1.0);
		this.setKeywordDoc(this.integralTime, "The time scale applied to the integral feedback loop.",
		         ["1.0 s"]);
		this.integralTime.setValidRange(1.0e-10, Double.POSITIVE_INFINITY);
		this.integralTime.setUnitType(TimeUnit);
		this.addInput(this.integralTime);

		this.derivativeTime = new SampleInput("DerivativeTime", Entity.KEY_INPUTS, 1.0);
		this.setKeywordDoc(this.derivativeTime, "The time scale applied to the differential feedback loop.",
		         ["1.0 s"]);
		this.derivativeTime.setValidRange(0.0, Double.POSITIVE_INFINITY);
		this.derivativeTime.setUnitType(TimeUnit);
		this.addInput(this.derivativeTime);

		this.outputLow = new SampleInput("OutputLow", Entity.KEY_INPUTS, Double.NEGATIVE_INFINITY);
		this.setKeywordDoc(this.outputLow, "The lower limit for the output signal.",
		         ["0.0 m"]);
		this.outputLow.setUnitType(UserSpecifiedUnit);
		this.addInput(this.outputLow);

		this.outputHigh = new SampleInput("OutputHigh", Entity.KEY_INPUTS, Double.POSITIVE_INFINITY);
		this.setKeywordDoc(this.outputHigh, "The upper limit for the output signal.",
		         ["1.0 m"]);
		this.outputHigh.setUnitType(UserSpecifiedUnit);
		this.addInput(this.outputHigh);
	}

	updateUnitTypeCallback(): void {
		const outUnitType = this.outputUnitType.getUnitType() as JClass<Unit>;
		this.outputLow.setUnitType(outUnitType);
		this.outputHigh.setUnitType(outUnitType);
		this.proportionalGain.setUnitType(outUnitType);
		this.updateUserOutputMap();
	}

	protected override setUnitType(ut: JClass<Unit>): void {
		super.setUnitType(ut);
		this.setPoint.setUnitType(ut);
		this.processVariable.setUnitType(ut);
		this.processVariableScale.setUnitType(ut);
	}

	override getUnitType(): JClass<Unit> | null {
		return this.outputUnitType.getUnitType();
	}

	override getUserUnitType(): JClass<Unit> {
		return this.outputUnitType.getUnitType() as JClass<Unit>;
	}

	override earlyInit(): void {
		super.earlyInit();
		this.lastError = 0.0;
		this.integral = 0.0;
		this.pidLastUpdateTime = 0.0;
	}

	getError(simTime: number): number {
		if (this.setPoint.isDefault() || this.processVariable.isDefault())
			return Double.NaN;
		const diff = this.setPoint.getNextSample(this, simTime)
				- this.processVariable.getNextSample(this, simTime);
		return diff/this.processVariableScale.getNextSample(this, simTime);
	}

	protected override calculateValue(simTime: number, inputVal: number, lastTime: number, lastInputVal: number, lastVal: number): number {

		// Calculate the elapsed time
		const dt = simTime - lastTime;

		// Calculate the error signal
		const error = this.getError(simTime);

		// Calculate integral and differential terms
		const intgrl = this.integral + error*dt;
		let deriv = 0.0;
		if (dt > 0.0)
			deriv = (error - this.lastError)/dt;

		// Calculate the output value
		let val = (error +  intgrl/this.integralTime.getNextSample(this, simTime) + deriv*this.derivativeTime.getNextSample(this, simTime));
		val *= this.proportionalGain.getNextSample(this, simTime);

		// Condition the output value
		val = Math.max(val, this.outputLow.getNextSample(this, simTime));
		val = Math.min(val, this.outputHigh.getNextSample(this, simTime));

		return val;
	}

	override update(simTime: number): void {
		super.update(simTime);
		const dt = simTime - this.pidLastUpdateTime;
		const error = this.getError(simTime);
		this.integral += error * dt;
		this.lastError = error;
		this.pidLastUpdateTime = simTime;
		return;
	}

	getIntegral(simTime: number): number {
		return this.integral;
	}

	getDerivative(simTime: number): number {
		let derivative = 0.0;
		const dt = simTime - this.pidLastUpdateTime;
		if (dt > 0.0)
			derivative = (this.getError(simTime) - this.lastError)/dt;
		return derivative;
	}

	getProportionalValue(simTime: number): number {
		return this.getError(simTime) * this.proportionalGain.getNextSample(this, simTime);
	}

	getIntegralValue(simTime: number): number {
		return (this.integral / this.integralTime.getNextSample(this, simTime)) * this.proportionalGain.getNextSample(this, simTime);
	}

	getDifferentialValue(simTime: number): number {
		return this.getDerivative(simTime) * this.derivativeTime.getNextSample(this, simTime) * this.proportionalGain.getNextSample(this, simTime);
	}

}

defineOutput(PIDController, {
	name: "Error",
	description: "The difference between the set point and the process variable values divided "
	           + "by the process variable scale.",
	unitType: DimensionlessUnit,
	sequence: 1,
	returnType: "double",
	get: (e, simTime) => e.getError(simTime),
});

defineOutput(PIDController, {
	name: "Integral",
	description: "The integral of the dimensionless error value.",
	unitType: TimeUnit,
	sequence: 2,
	returnType: "double",
	get: (e, simTime) => e.getIntegral(simTime),
});

defineOutput(PIDController, {
	name: "Derivative",
	description: "The derivative of the dimensionless error value.",
	unitType: RateUnit,
	sequence: 3,
	returnType: "double",
	get: (e, simTime) => e.getDerivative(simTime),
});

defineOutput(PIDController, {
	name: "ProportionalValue",
	description: "The proportional component of the output value.",
	unitType: UserSpecifiedUnit,
	sequence: 4,
	returnType: "double",
	get: (e, simTime) => e.getProportionalValue(simTime),
});

defineOutput(PIDController, {
	name: "IntegralValue",
	description: "The integral component of the output value.",
	unitType: UserSpecifiedUnit,
	sequence: 5,
	returnType: "double",
	get: (e, simTime) => e.getIntegralValue(simTime),
});

defineOutput(PIDController, {
	name: "DerivativeValue",
	description: "The derivative component of the output value.",
	unitType: UserSpecifiedUnit,
	sequence: 6,
	returnType: "double",
	get: (e, simTime) => e.getDifferentialValue(simTime),
});

ClassRegistry.register("com.jaamsim.CalculationObjects.PIDController", PIDController);
