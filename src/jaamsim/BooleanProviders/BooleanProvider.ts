/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2022-2023 JaamSim Software Inc.
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

/*
 * Java の interface BooleanProvider。
 * 実行時の判定（x instanceof BooleanProvider）は isBooleanProvider(x)。
 */
export interface BooleanProvider {
	getNextBoolean(thisEnt: Entity, simTime: number): boolean;
}

/**
 * o が BooleanProvider か（getNextBoolean を持つか）。
 * BooleanProvInput も getNextBoolean を持つが、Java では BooleanProvider ではないので、
 * 入力（getKeyword を持つもの）は除く。
 */
export function isBooleanProvider(o: unknown): o is BooleanProvider {
	if (o === null || typeof o !== "object")
		return false;
	const x = o as { getNextBoolean?: unknown; getKeyword?: unknown };
	return typeof x.getNextBoolean === "function" && typeof x.getKeyword !== "function";
}
