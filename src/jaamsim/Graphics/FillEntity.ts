/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2018-2019 JaamSim Software Inc.
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
 * TypeScript への移植 (C) 2026 shota
 */
import type { JaamSimModel } from "../basicsim/JaamSimModel.ts";
import type { Color4d } from "../math/Color4d.ts";
import { implementsFunctions } from "../internal.ts";

/*
 * 移植の注意: instanceof FillEntity と getDisplayModel(FillEntity.class) の代わりは、
 * 同じ名前の値 FillEntity（isInstance を持つ）を使う。見分けは関数の有無による。
 */

export interface FillEntity {
	getJaamSimModel(): JaamSimModel;
	isFilled(simTime: number): boolean;
	getFillColour(simTime: number): Color4d;
}

export const FillEntity = {
	/** o instanceof FillEntity */
	isInstance(o: unknown): o is FillEntity {
		return implementsFunctions(o, ["getJaamSimModel", "isFilled", "getFillColour"]);
	},
};
