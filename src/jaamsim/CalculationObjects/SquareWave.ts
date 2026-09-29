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
import { WaveGenerator } from "../internal.ts";

/**
 * Java の Math.IEEEremainder(x, p)（fdlibm の e_remainder と同じ手順。商は最も近い整数、同じ近さなら偶数）
 */
function ieeeRemainder(x: number, p: number): number {
	if (Number.isNaN(x) || Number.isNaN(p) || !Number.isFinite(x) || p === 0)
		return Number.NaN;
	if (!Number.isFinite(p))
		return x;
	const neg = (x < 0 || Object.is(x, -0));
	p = Math.abs(p);
	if (p <= Number.MAX_VALUE / 2)
		x = x % (p + p);  // now |x| < 2p（% は fmod と同じく正確）
	if (Math.abs(x) === p)
		return 0 * x;
	x = Math.abs(x);
	if (p < 2.2250738585072014e-308 * 2) {  // hp < 0x00200000
		if (x + x > p) {
			x -= p;
			if (x + x >= p)
				x -= p;
		}
	}
	else {
		const pHalf = 0.5 * p;
		if (x > pHalf) {
			x -= p;
			if (x >= pHalf)
				x -= p;
		}
	}
	return neg ? -x : x;
}

/**
 * Generates a square wave.
 * @author Harry King
 *
 */
export class SquareWave extends WaveGenerator {

	constructor() {
		super();
	}

	protected override getSignal(angle: number): number {
		if( ieeeRemainder(angle, 2.0*Math.PI) >= 0.0) {
			return 1.0;
		}
		else {
			return -1.0;
		}
	}

}

ClassRegistry.register("com.jaamsim.CalculationObjects.SquareWave", SquareWave);
