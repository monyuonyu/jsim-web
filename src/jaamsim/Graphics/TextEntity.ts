/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2018-2023 JaamSim Software Inc.
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
import type { Vec3d } from "../math/Vec3d.ts";
import { implementsFunctions } from "./Editable.ts";

/*
 * 移植の注意: instanceof TextEntity の代わりは TextEntity.isInstance(o)（関数の有無で見分ける）。
 */

export interface TextEntity {
	getJaamSimModel(): JaamSimModel;
	getFontName(): string;
	getTextHeight(simTime: number): number;
	getTextHeightString(): string;
	getStyle(): number;
	isBold(): boolean;
	isItalic(): boolean;
	getFontColor(simTime: number): Color4d;
	isDropShadow(simTime: number): boolean;
	getDropShadowColor(simTime: number): Color4d;
	getDropShadowOffset(): Vec3d;
}

export const TextEntity = {
	/** o instanceof TextEntity */
	isInstance(o: unknown): o is TextEntity {
		return implementsFunctions(o, ["getJaamSimModel", "getFontName", "getTextHeight",
				"getTextHeightString", "getStyle", "isBold", "isItalic", "getFontColor",
				"isDropShadow", "getDropShadowColor", "getDropShadowOffset"]);
	},
};
