/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2013 Ausenco Engineering Canada Inc.
 * Copyright (C) 2016-2023 JaamSim Software Inc.
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
import { SampleInput } from "../internal.ts";
import { Entity } from "../internal.ts";
import { DoubleCalculation } from "../internal.ts";

/**
 * The MovingAverage block returns the average of the current input and the N-1 previous inputs.
 * Output(i) = 1/N * [ Input(i) + Input(i-1) + ... + Input(i-N+1) ]
 * where Input(i) = input value to the block for the i-th update,
 * and Output(i) = output value from the block for the i-th update.
 * @author Harry King
 *
 */
export class MovingAverage extends DoubleCalculation {

	private readonly numberOfSamples: SampleInput;

	private samples: number[];  // The previous input values over which to average
	private index = 0;  // The next index to overwrite (the oldest value on the list)
	private n = 0;  // The number of inputs values over which to average
	private average = 0;  // The present value for the moving average

	constructor() {
		super();

		// Java の初期化ブロック
		this.numberOfSamples = SampleInput.ofInt("NumberOfSamples", Entity.KEY_INPUTS, 1);
		this.setKeywordDoc(this.numberOfSamples, "The number of input values over which to average.",
		         ["10"]);
		this.numberOfSamples.setValidRange(1, Double.POSITIVE_INFINITY);
		this.numberOfSamples.setIntegerValue(true);
		this.addInput(this.numberOfSamples);

		// Java のコンストラクタ
		this.samples = new Array<number>(1).fill(0);
	}

	override earlyInit(): void {
		super.earlyInit();
		const num = jint(this.numberOfSamples.getNextSample(this, 0.0));
		this.samples = new Array<number>(num).fill(0);
		this.index = 0;
		this.n = num;
		this.average = 0.0;
	}

	override calculateValue(simTime: number, inputVal: number, lastTime: number, lastInputVal: number, lastVal: number): number {
		return this.average + (inputVal - this.samples[this.index])/this.n;
	}

	override update(simTime: number): void {
		super.update(simTime);

		// Overwrite the oldest value in the list
		this.samples[this.index] = this.getInputValue(simTime);

		// Set the index to the next oldest value
		this.index++;
		if (this.index >= this.n) {
			this.index = 0;
		}

		// Calculate the average value
		let val = 0.0;
		for (let i=0; i<this.n; i++) {
			val += this.samples[i];
		}
		this.average = val/this.n;
		return;
	}

}

ClassRegistry.register("com.jaamsim.CalculationObjects.MovingAverage", MovingAverage);
