/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2014 Ausenco Engineering Canada Inc.
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

import { Double } from "../internal.ts";
import { ClassRegistry } from "../internal.ts";
import { DisplayEntity } from "../internal.ts";
import { SampleInput } from "../internal.ts";
import { Entity } from "../internal.ts";
import { EventManager } from "../internal.ts";
import { InputAgent } from "../internal.ts";
import { defineOutput } from "../internal.ts";
import type { ParseContext } from "../input/ParseContext.ts";
import { MRG1999a } from "../internal.ts";
import { DimensionlessUnit } from "../internal.ts";
import { RandomStreamUser } from "../internal.ts";

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

export class BooleanSelector extends DisplayEntity implements RandomStreamUser {
	private readonly randomSeedInput: SampleInput;

	private trueProbInput: SampleInput;

	private readonly rng: MRG1999a = new MRG1999a();
	private lastValue: boolean = false;

	constructor() {
		super();
		this.randomSeedInput = SampleInput.ofInt("RandomSeed", Entity.KEY_INPUTS, -1);
		this.setKeywordDoc(this.randomSeedInput, "Random stream number for the random number generator used by this "
		                     + "object. "
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

		this.trueProbInput = new SampleInput("TrueProbability", Entity.KEY_INPUTS, 1.0);
		this.setKeywordDoc(this.trueProbInput, "The probability of the Selector returning true.",
		         ["0.5", "InputValue1", "'2 * [InputValue1].Value'"]);
		this.trueProbInput.setUnitType(DimensionlessUnit);
		this.trueProbInput.setValidRange(0.0, 1.0);
		this.addInput(this.trueProbInput);
	}

	override setInputsForDragAndDrop(): void {
		super.setInputsForDragAndDrop();

		// Set the random number seed to the smallest unused value
		const seed = this.getJaamSimModel().getSmallestAvailableStreamNumber();
		InputAgent.applyIntegers(this, this.randomSeedInput.getKeyword(), seed);
	}

	override earlyInit(): void {
		super.earlyInit();
		this.rng.setSeedStream(this.getStreamNumber(), this.getSimulation().getSubstreamNumber());
		this.lastValue = false;
	}

	getStreamNumber(): number {
		return jint(this.randomSeedInput.getNextSample(this, 0.0));
	}

	getStreamNumberKeyword(): string {
		return this.randomSeedInput.getKeyword();
	}

	/**
	 * Java の getNextValue() と getNextValue(double simTime) を 1 つにしたもの。
	 * - 引数なし: モデルの外かどうかを見ずに引き、確率は simTime = 0 で求める
	 * - 引数あり（出力 "Value"）: モデルの外なら最後の値を返す。確率は simTime で求める
	 */
	getNextValue(simTime?: number): boolean {
		if (simTime === undefined) {
			const samp = this.rng.nextUniform();
			const prob = this.trueProbInput.getNextSample(this, 0);
			this.lastValue = samp < prob;
			return this.lastValue;
		}

		// If we are not in a model context, do not perturb the distribution by sampling,
		// instead simply return the last sampled value
		if (!EventManager.hasCurrent()) {
			return this.lastValue;
		}

		// Select the next sample
		const samp = this.rng.nextUniform();
		const prob = this.trueProbInput.getNextSample(this, simTime);
		this.lastValue = samp < prob;
		return this.lastValue;
	}

	override copyInput(ent: Entity, key: string, context: ParseContext | null): void {
		if (key === this.getStreamNumberKeyword() && this.getJaamSimModel() === ent.getJaamSimModel()) {
			RandomStreamUser.setUniqueRandomSeed(this);
			return;
		}
		super.copyInput(ent, key, context);
	}
}

RandomStreamUser.register(BooleanSelector);

ClassRegistry.register("com.jaamsim.ProbabilityDistributions.BooleanSelector", BooleanSelector);

defineOutput(BooleanSelector, {
	name: "Value",
	description: "The last value sampled from the distribution. When used in an "
	             + "expression, this output returns a new sample every time the expression "
	             + "is evaluated.",
	returnType: "boolean",
	get: (e, simTime) => e.getNextValue(simTime),
});
