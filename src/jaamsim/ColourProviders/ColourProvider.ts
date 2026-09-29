/*
 * JaamSim Discrete Event Simulation
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
import type { Entity } from "../basicsim/Entity.ts";
import type { Color4d } from "../math/Color4d.ts";

/*
 * Java の interface ColourProvider。
 * 実行時の判定（x instanceof ColourProvider）は isColourProvider(x)。
 */
export interface ColourProvider {

	getNextColour(thisEnt: Entity, simTime: number): Color4d;

	appendEntityReferences(list: Entity[]): void;

}

/**
 * o が ColourProvider か（getNextColour と appendEntityReferences を持つか）。
 * ColourProvInput も両方を持つが、Java では ColourProvider ではないので、
 * 入力（getKeyword を持つもの）は除く。
 */
export function isColourProvider(o: unknown): o is ColourProvider {
	if (o === null || typeof o !== "object")
		return false;
	const x = o as { getNextColour?: unknown; appendEntityReferences?: unknown; getKeyword?: unknown };
	return typeof x.getNextColour === "function" && typeof x.appendEntityReferences === "function"
			&& typeof x.getKeyword !== "function";
}
