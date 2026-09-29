/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2011 Ausenco Engineering Canada Inc.
 * Copyright (C) 2018-2026 JaamSim Software Inc.
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
import { LateClasses } from "../internal.ts";
import { Tag } from "../internal.ts";
import { Entity } from "../internal.ts";
import { ColourInput } from "../internal.ts";
import { EnumInput } from "../internal.ts";
import type { Input } from "../input/Input.ts";
import type { InputCallback } from "../input/InputCallback.ts";
import { StringInput } from "../internal.ts";
import { ClassRegistry } from "../internal.ts";
import { AbstractShapeModel } from "../internal.ts";

/*
 * 移植の注意:
 * - 入れ子の enum ShapeModel.ValidShapes は、このファイルの enum ShapeModel_ValidShapes にした
 *   （ShapeModel.ValidShapes からも引ける）。値は名前と同じ文字列。
 * - 描画: 省略（three.js の画面を作るときに）。入れ子のクラス Binding（形ごとの多角形・棒グラフ・格子の描き方）は移さない。
 *   形の点の列は RenderUtils（RECT_POINTS・CIRCLE_POINTS など）にある。docs/todo-F.md に要点を書いた。
 */

export enum ShapeModel_ValidShapes {
	RECTANGLE = "RECTANGLE",
	CIRCLE = "CIRCLE",
	ARROW2D = "ARROW2D",
	TRIANGLE = "TRIANGLE",
	PENTAGON = "PENTAGON",
	HEXAGON = "HEXAGON",
	OCTAGON = "OCTAGON",
	PENTAGRAM = "PENTAGRAM",
	HEPTAGRAM = "HEPTAGRAM",
	OCTAGRAM = "OCTAGRAM",
	BARGAUGE2D = "BARGAUGE2D",
	GRID = "GRID",
}

export class ShapeModel extends AbstractShapeModel {

	static readonly ValidShapes = ShapeModel_ValidShapes;

	static readonly TAG_CONTENTS = "CONTENTS";
	static readonly TAG_CONTENTS2 = "CONTENTS2";
	static readonly TAG_CAPACITY = "CAPACITY";
	static readonly TAG_OUTLINES = "OUTLINES";
	static readonly TAG_BODY = "BODY";

	private readonly shape: EnumInput<ShapeModel_ValidShapes>;

	private readonly colladaFile: StringInput;

	constructor() {
		super();

		// ---- Java の初期化ブロック ----
		this.filled.setDefaultValue(true);
		this.outlined.setDefaultValue(true);

		this.shape = new EnumInput<ShapeModel_ValidShapes>(ShapeModel_ValidShapes, "Shape", Entity.KEY_INPUTS,
				ShapeModel_ValidShapes.CIRCLE);
		this.setKeywordDoc(this.shape, "The shape of a display model determines the appearance of the display model.", []);
		this.addInput(this.shape);

		this.colladaFile = new StringInput("ColladaFile", Entity.KEY_INPUTS, "");
		this.setKeywordDoc(this.colladaFile, "Provides backward compatibility for the Grid100x100 object in older "
		                     + "models where it was a ColladaModel instead of a ShapeModel.", []);
		this.colladaFile.setCallback(ShapeModel.colladaFileCallback);
		this.colladaFile.setHidden(true);
		this.colladaFile.setOutput(false);
		this.addInput(this.colladaFile);
	}

	static readonly colladaFileCallback: InputCallback = {
		callback(ent: Entity, inp: Input<unknown>): void {
			// Clear the ColladaFile input so that it is not saved
			inp.reset();
		},
	} as InputCallback;

	getShapeName(): string {
		return this.shape.getValue()!;
	}

	override canDisplayEntity(ent: Entity): boolean {
		return LateClasses.isInstance(ent, "com.jaamsim.Graphics.DisplayEntity");
	}

	/** 描画: 省略（three.js の画面を作るときに）。Java は new Binding(ent, this) */
	override getBinding(ent: Entity): object | null {
		return null;
	}

	// 描画: Binding の中で使う値（three.js の画面を作るときに使う）
	static readonly emptyTagSet = new Map<string, Tag>();
	static readonly tag_contents_def = new Tag([ColourInput.BLUE], [0.5], true);
}

ClassRegistry.register("com.jaamsim.DisplayModels.ShapeModel", ShapeModel);
LateClasses.bind("com.jaamsim.DisplayModels.ShapeModel", ShapeModel);
