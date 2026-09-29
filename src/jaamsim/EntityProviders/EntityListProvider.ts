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

/*
 * Java の interface EntityListProvider<T extends Entity>。
 * 実行時の判定（x instanceof EntityListProvider）は isEntityListProvider(x)。
 */
export interface EntityListProvider<T extends Entity> {

	getNextEntityList(thisEnt: Entity, simTime: number, list: T[], unique: boolean): void;

}

/**
 * o が EntityListProvider か（4 つの引数の getNextEntityList を持つか）。
 * EntityProvListInput の getNextEntityList は引数が 2 つで、Java では EntityListProvider ではないので、
 * 入力（getKeyword を持つもの）は除く。
 */
export function isEntityListProvider(o: unknown): o is EntityListProvider<Entity> {
	if (o === null || typeof o !== "object")
		return false;
	const x = o as { getNextEntityList?: unknown; getKeyword?: unknown };
	return typeof x.getNextEntityList === "function" && typeof x.getKeyword !== "function";
}
