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

import { Double, jstr, type JClass } from "../java/lang.ts";
import { tr } from "../i18n/I18n.ts";
import { DisplayEntity } from "../Graphics/DisplayEntity.ts";
import { SampleInput } from "../Samples/SampleInput.ts";
import type { SampleProvider } from "../Samples/SampleProvider.ts";
import { SampleStatistics } from "../Statistics/SampleStatistics.ts";
import { Entity } from "../basicsim/Entity.ts";
import { EventManager } from "../events/EventManager.ts";
import type { Input } from "../input/Input.ts";
import { InputAgent } from "../input/InputAgent.ts";
import type { InputCallback } from "../input/InputCallback.ts";
import { InputErrorException } from "../input/InputErrorException.ts";
import { defineOutput } from "../input/OutputRegistry.ts";
import type { ParseContext } from "../input/ParseContext.ts";
import { UnitTypeInput } from "../input/UnitTypeInput.ts";
import { DimensionlessUnit } from "../units/DimensionlessUnit.ts";
import type { Unit } from "../units/Unit.ts";
import { UserSpecifiedUnit } from "../units/UserSpecifiedUnit.ts";
import { RandomStreamUser } from "./RandomStreamUser.ts";

/** Java の (int) x（double → int。NaN は 0、範囲の外は端に丸める） */
function jint(x: number): number {
	if (Number.isNaN(x))
		return 0;
	if (x >= 2147483647)
		return 2147483647;
	if (x <= -2147483648)
		return -2147483648;
	return Math.trunc(x);
}

/**
 * ProbablityDistribution is the super-class for the various probability distributions implemented in JaamSim.
 * @author Harry King
 *
 */
export abstract class Distribution extends DisplayEntity
implements SampleProvider, RandomStreamUser {

	protected readonly unitType: UnitTypeInput;

	private readonly randomSeedInput: SampleInput;

	protected readonly minValueInput: SampleInput;

	protected readonly maxValueInput: SampleInput;

	protected readonly locationInput: SampleInput;

	protected readonly scaleInput: SampleInput;

	private readonly stats: SampleStatistics = new SampleStatistics();
	private lastSample: number = Double.NaN;

	private static MAX_ATTEMPTS = 1000;

	constructor() {
		super();
		this.unitType = new UnitTypeInput("UnitType", Entity.KEY_INPUTS, UserSpecifiedUnit);
		this.setKeywordDoc(this.unitType, "The unit type for the values returned by the distribution. "
		                     + "MUST be entered before most other inputs.",
		         ["DistanceUnit"]);
		this.unitType.setRequired(true);
		this.unitType.setCallback(Distribution.inputCallback);
		this.addInput(this.unitType);

		this.randomSeedInput = new SampleInput("RandomSeed", Entity.KEY_INPUTS, -1);
		this.setKeywordDoc(this.randomSeedInput, "Random stream number for the random number generator used by this "
		                     + "probability distribution. "
		                     + "Accepts an integer value >= 0.\n\n"
		                     + "The 'RandomSeed' keyword works together with the "
		                     + "'GlobalSubstreamSeed' keyword for Simulation to determine the random "
		                     + "sequence. "
		                     + "The 'GlobalSubsteamSeed' keyword allows the user to change all the "
		                     + "random sequences in a model with a single input.\n\n"
		                     + "When an object with this input is copied and pasted, the RandomSeed "
		                     + "input is reset to an unused value for each copy that is pasted.",
				 ["547"]);
		this.randomSeedInput.setValidRange(0, Double.POSITIVE_INFINITY);
		this.randomSeedInput.setIntegerValue(true);
		this.randomSeedInput.setRequired(true);
		this.randomSeedInput.setDefaultText("None");
		this.addInput(this.randomSeedInput);

		this.minValueInput = new SampleInput("MinValue", Entity.KEY_INPUTS, Double.NEGATIVE_INFINITY);
		this.setKeywordDoc(this.minValueInput, "Minimum value that can be returned. "
		                     + "Smaller values are rejected and resampled.",
		         ["0.0", "InputValue1", "'2 * [InputValue1].Value'"]);
		this.minValueInput.setUnitType(UserSpecifiedUnit);
		this.addInput(this.minValueInput);

		this.maxValueInput = new SampleInput("MaxValue", Entity.KEY_INPUTS, Double.POSITIVE_INFINITY);
		this.setKeywordDoc(this.maxValueInput, "Maximum value that can be returned. "
		                     + "Larger values are rejected and resampled.",
		         ["200.0", "InputValue1", "'2 * [InputValue1].Value'"]);
		this.maxValueInput.setUnitType(UserSpecifiedUnit);
		this.addInput(this.maxValueInput);

		this.locationInput = new SampleInput("Location", Entity.KEY_INPUTS, 0.0);
		this.setKeywordDoc(this.locationInput, "Offset that is applied to the random samples from the distribution. "
		                     + "A non-zero value shifts the distribution right or left along the "
		                     + "x-axis.",
		         ["3.0 h", "InputValue1", "'2 * [InputValue1].Value'"]);
		this.locationInput.setUnitType(UserSpecifiedUnit);
		this.locationInput.setHidden(true);
		this.addInput(this.locationInput);

		this.scaleInput = new SampleInput("Scale", Entity.KEY_INPUTS, 1.0);
		this.setKeywordDoc(this.scaleInput, "Factor that is applied to the random samples from the distribution. "
		                     + "The value applies the unit type to the samples from the distribution.",
		         ["3.0 h", "InputValue1", "'2 * [InputValue1].Value'"]);
		this.scaleInput.setValidRange(0.0, Double.POSITIVE_INFINITY);
		this.scaleInput.setUnitType(UserSpecifiedUnit);
		this.scaleInput.setHidden(true);
		this.addInput(this.scaleInput);
	}

	override validate(): void {
		super.validate();

		if (this.getMinValueInput(0.0) > this.getMaxValueInput(0.0))
			throw new InputErrorException(tr("'MinValue' input is greater than the 'MaxValue' "
					+ "input. MinValue: %s, MaxValue: %s"),
					jstr(this.getMinValueInput(0.0)), jstr(this.getMaxValueInput(0.0)));

		if (this.getMinValue(0.0) > this.getMax(0.0))
			throw new InputErrorException(tr("'MinValue' input is greater than the maximum value "
					+ "returned by the distribution function. MinValue: %s, distribution max.: %s"),
					jstr(this.getMinValueInput(0.0)), jstr(this.getMax(0.0)));

		if (this.getMaxValue(0.0) < this.getMin(0.0))
			throw new InputErrorException(tr("'MaxValue' input is less than the minimum value "
					+ "returned by the distribution function. MaxValue: %s, distribution min.: %s"),
					jstr(this.getMaxValueInput(0.0)), jstr(this.getMin(0.0)));
	}

	override earlyInit(): void {
		super.earlyInit();
		this.stats.clear();
		this.lastSample = Double.NaN;
	}

	static readonly inputCallback: InputCallback = {
		callback(ent: Entity, inp: Input<unknown>): void {
			(ent as Distribution).updateInputValue();
		},
	} as InputCallback;

	updateInputValue(): void {
		this.setUnitType(this.getUnitType());
	}

	override setInputsForDragAndDrop(): void {
		super.setInputsForDragAndDrop();

		// Set the random number seed to the smallest unused value
		const seed = this.getJaamSimModel().getSmallestAvailableStreamNumber();
		InputAgent.applyIntegers(this, this.randomSeedInput.getKeyword(), seed);
	}

	override getUserUnitType(): JClass<Unit> {
		return this.unitType.getUnitType();
	}

	/**
	 * Select the next sample from the probability distribution.
	 */
	protected abstract getSample(simTime: number): number;

	getUnitType(): JClass<Unit> {
		return this.unitType.getUnitType();
	}

	protected setUnitType(ut: JClass<Unit>): void {
		this.minValueInput.setUnitType(ut);
		this.maxValueInput.setUnitType(ut);
		this.locationInput.setUnitType(ut);
		this.scaleInput.setUnitType(ut);
		this.updateUserOutputMap();
	}

	getStreamNumber(): number {
		return jint(this.randomSeedInput.getNextSample(this, 0.0));
	}

	getStreamNumberKeyword(): string {
		return this.randomSeedInput.getKeyword();
	}

	getSubstreamNumber(): number {
		return this.getSimulation().getSubstreamNumber();
	}

	/**
	 * Returns the next sample from the probability distribution.
	 * Java の getNextSample(double simTime) と getNextSample(Entity thisEnt, double simTime) を 1 つにしたもの
	 * （引数が 1 つなら simTime だけ）。
	 */
	getNextSample(simTime: number): number;
	getNextSample(thisEnt: Entity | null, simTime: number): number;
	getNextSample(a: Entity | number | null, b?: number): number {
		if (b === undefined)
			return this.getNextSample(this, a as number);
		const simTime = b;

		// If we are not in a model context, do not perturb the distribution by sampling,
		// instead simply return the last sampled value
		if (!EventManager.hasCurrent())
			return this.lastSample;

		// Loop until the select sample falls within the desired min and max values
		let nextSample: number;
		const minVal = this.getMinValueInput(simTime);
		const maxVal = this.getMaxValueInput(simTime);
		let n = 0;
		do {
			if (n > Distribution.MAX_ATTEMPTS) {
				this.error(tr("Could not find a sample value that was within the range specified by "
						+ "the MinValue and MaxValue inputs.%n"
						+ "Number of samples tested = %s"), Distribution.MAX_ATTEMPTS);
			}
			nextSample = this.getSample(simTime);
			n++;
		}
		while (nextSample < minVal ||
		       nextSample > maxVal);

		this.lastSample = nextSample;
		this.stats.addValue(nextSample);
		return nextSample;
	}

	getMinValueInput(simTime: number): number {
		return this.minValueInput.getNextSample(this, simTime);
	}

	getMaxValueInput(simTime: number): number {
		return this.maxValueInput.getNextSample(this, simTime);
	}

	getLocationInput(simTime: number): number {
		return this.locationInput.getNextSample(this, simTime);
	}

	getScaleInput(simTime: number): number {
		return this.scaleInput.getNextSample(this, simTime);
	}

	/**
	 * Returns the minimum value that can be sampled from the distribution object, including the
	 * limits imposed by the 'MinValue' and 'MaxValue' inputs.
	 * @param simTime - present simulation time
	 * @return minimum value that can be sampled
	 */
	getMinValue(simTime: number): number {
		return Math.max(this.getMin(simTime), this.getMinValueInput(simTime));
	}

	/**
	 * Returns the maximum value that can be sampled from the distribution object, including the
	 * limits imposed by the 'MinValue' and 'MaxValue' inputs.
	 * @param simTime - present simulation time
	 * @return maximum value that can be sampled
	 */
	getMaxValue(simTime: number): number {
		return Math.min(this.getMax(simTime), this.getMaxValueInput(simTime));
	}

	/**
	 * Returns the mean value for the distribution calculated from the inputs.
	 * It is NOT the mean of the sampled values.
	 * @param simTime - present simulation time
	 * @return calculated mean
	 */
	protected abstract getMean(simTime: number): number;

	/**
	 * Returns the standard deviation for the distribution calculated from the inputs.
	 * It is NOT the standard deviation of the sampled values.
	 * @param simTime - present simulation time
	 * @return calculated standard deviation
	 */
	protected abstract getStandardDev(simTime: number): number;

	/**
	 * Returns the minimum value that can be sampled calculated from the inputs.
	 * It is NOT the minimum of the sampled values.
	 * @param simTime - present simulation time
	 * @return calculated minimum value
	 */
	protected abstract getMin(simTime: number): number;

	/**
	 * Returns the maximum value that can be sampled calculated from the inputs.
	 * It is NOT the maximum of the sampled values.
	 * @param simTime - present simulation time
	 * @return calculated maximum value
	 */
	protected abstract getMax(simTime: number): number;

	override copyInput(ent: Entity, key: string, context: ParseContext | null): void {
		if (key === this.getStreamNumberKeyword() && this.getJaamSimModel() === ent.getJaamSimModel()) {
			RandomStreamUser.setUniqueRandomSeed(this);
			return;
		}
		super.copyInput(ent, key, context);
	}

	getMeanValue(simTime: number): number {
		return this.getMean(simTime);
	}

	getStandardDeviation(simTime: number): number {
		return this.getStandardDev(simTime);
	}

	getCalculatedMin(simTime: number): number {
		return this.getMin(simTime);
	}

	getCalculatedMax(simTime: number): number {
		return this.getMax(simTime);
	}

	getNumberOfSamples(simTime: number): number {
		return this.stats.getCount();
	}

	getSampleMean(simTime: number): number {
		return this.stats.getMean();
	}

	getSampleStandardDeviation(simTime: number): number {
		return this.stats.getStandardDeviation();
	}

	getSampleMin(simTime: number): number {
		return this.stats.getMin();
	}

	getSampleMax(simTime: number): number {
		return this.stats.getMax();
	}
}

RandomStreamUser.register(Distribution);

defineOutput(Distribution, {
	name: "Value",
	description: "The last value sampled from the distribution. When used in an "
	             + "expression, this output returns a new sample every time the expression "
	             + "is evaluated.",
	unitType: UserSpecifiedUnit,
	sequence: 0,
	returnType: "double",
	get: (e, simTime) => e.getNextSample(simTime),
});

defineOutput(Distribution, {
	name: "CalculatedMean",
	description: "The mean of the probability distribution calculated directly from the inputs. "
	             + "It is NOT the mean of the sampled values. "
	             + "The inputs for MinValue and MaxValue are ignored.",
	unitType: UserSpecifiedUnit,
	sequence: 1,
	returnType: "double",
	get: (e, simTime) => e.getMeanValue(simTime),
});

defineOutput(Distribution, {
	name: "CalculatedStandardDeviation",
	description: "The standard deviation of the probability distribution calculated directly "
	             + "from the inputs. It is NOT the standard deviation of the sampled values. "
	             + "The inputs for MinValue and MaxValue are ignored.",
	unitType: UserSpecifiedUnit,
	sequence: 2,
	returnType: "double",
	get: (e, simTime) => e.getStandardDeviation(simTime),
});

defineOutput(Distribution, {
	name: "CalculatedMin",
	description: "The smallest value that can be returned by the probability distribution "
	             + "calculated directly from the inputs. "
	             + "It is NOT the minimum of the sampled values. "
	             + "The inputs for MinValue and MaxValue are ignored.",
	unitType: UserSpecifiedUnit,
	sequence: 3,
	returnType: "double",
	get: (e, simTime) => e.getCalculatedMin(simTime),
});

defineOutput(Distribution, {
	name: "CalculatedMax",
	description: "The largest value that can be returned by the probability distribution "
	             + "calculated directly from the inputs. "
	             + "It is NOT the maximum of the sampled values. "
	             + "The inputs for MinValue and MaxValue are ignored.",
	unitType: UserSpecifiedUnit,
	sequence: 4,
	returnType: "double",
	get: (e, simTime) => e.getCalculatedMax(simTime),
});

defineOutput(Distribution, {
	name: "NumberOfSamples",
	description: "The number of times the probability distribution has been sampled.",
	unitType: DimensionlessUnit,
	sequence: 5,
	returnType: "long",
	get: (e, simTime) => e.getNumberOfSamples(simTime),
});

defineOutput(Distribution, {
	name: "SampleMean",
	description: "The mean of the values sampled from the probability distribution.",
	unitType: UserSpecifiedUnit,
	sequence: 6,
	returnType: "double",
	get: (e, simTime) => e.getSampleMean(simTime),
});

defineOutput(Distribution, {
	name: "SampleStandardDeviation",
	description: "The standard deviation of the values sampled from the probability "
	             + "distribution.",
	unitType: UserSpecifiedUnit,
	sequence: 7,
	returnType: "double",
	get: (e, simTime) => e.getSampleStandardDeviation(simTime),
});

defineOutput(Distribution, {
	name: "SampleMin",
	description: "The minimum of the values sampled from the probability distribution.",
	unitType: UserSpecifiedUnit,
	sequence: 8,
	returnType: "double",
	get: (e, simTime) => e.getSampleMin(simTime),
});

defineOutput(Distribution, {
	name: "SampleMax",
	description: "The maximum of the values sampled from the probability distribution.",
	unitType: UserSpecifiedUnit,
	sequence: 9,
	returnType: "double",
	get: (e, simTime) => e.getSampleMax(simTime),
});
