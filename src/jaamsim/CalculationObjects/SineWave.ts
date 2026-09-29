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
 * Generates a sine wave.
 * @author Harry King
 *
 */
export class SineWave extends WaveGenerator {

	constructor() {
		super();
	}

	protected override getSignal(angle: number): number {
		return Math.sin(angle);
	}

}

ClassRegistry.register("com.jaamsim.CalculationObjects.SineWave", SineWave);
