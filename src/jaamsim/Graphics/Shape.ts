/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2018-2021 JaamSim Software Inc.
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
import { ShapeModel } from "../DisplayModels/ShapeModel.ts";
import { ClassRegistry } from "../java/ClassRegistry.ts";
import { AbstractShape } from "./AbstractShape.ts";
import { LateClasses } from "./LateClasses.ts";

/**
 * Two dimension geometric objects such a rectangles, circles, etc.
 * @author Harry King
 *
 */
export class Shape extends AbstractShape {

	constructor() {
		super();

		// ---- Java の初期化ブロック ----
		this.displayModelListInput.clearValidClasses();
		this.displayModelListInput.addValidClass(ShapeModel);

		this.filled.setDefaultValue(true);
		this.outlined.setDefaultValue(true);
	}

}

ClassRegistry.register("com.jaamsim.Graphics.Shape", Shape);
LateClasses.bind("com.jaamsim.Graphics.Shape", Shape);
