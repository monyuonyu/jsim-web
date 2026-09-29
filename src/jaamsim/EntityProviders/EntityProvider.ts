/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2017-2022 JaamSim Software Inc.
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
 * Java の interface EntityProvider<T extends Entity>。
 * 実行時の判定（x instanceof EntityProvider）は isEntityProvider(x)。
 */
export interface EntityProvider<T extends Entity> {

	getNextEntity(thisEnt: Entity, simTime: number): T | null;

}

/**
 * o が EntityProvider か（getNextEntity を持つか）。
 * EntityProvInput も getNextEntity を持つが、Java では EntityProvider ではないので、
 * 入力（getKeyword を持つもの）は除く。
 */
export function isEntityProvider(o: unknown): o is EntityProvider<Entity> {
	if (o === null || typeof o !== "object")
		return false;
	const x = o as { getNextEntity?: unknown; getKeyword?: unknown };
	return typeof x.getNextEntity === "function" && typeof x.getKeyword !== "function";
}
