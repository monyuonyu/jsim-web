/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2013 Ausenco Engineering Canada Inc.
 * Copyright (C) 2018 JaamSim Software Inc.
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
import { IconModel } from "../DisplayModels/IconModel.ts";
import { ImageModel } from "../DisplayModels/ImageModel.ts";
import { Entity } from "../basicsim/Entity.ts";
import { IntegerVector } from "../datatypes/IntegerVector.ts";
import { IntegerListInput } from "../input/IntegerListInput.ts";
import { ClassRegistry } from "../java/ClassRegistry.ts";
import { LateClasses } from "./LateClasses.ts";
import { OverlayEntity } from "./OverlayEntity.ts";

/**
 * OverlayImage displays a 2D image (JPG, PNG, etc.) as an overlay on a View window.
 * @author Matt Chudleight, with modifications by Harry King
 *
 */
/*
 * 移植の注意: 入力のフィールド size は、DisplayEntity の private の size（大きさ）と、JS では同じ
 * プロパティになってしまうので imageSize にした。
 */
export class OverlayImage extends OverlayEntity {

	private readonly imageSize: IntegerListInput;  // Java の size（DisplayEntity の private の size とぶつかるため）

	constructor() {
		super();

		// ---- Java の初期化ブロック ----
		this.displayModelListInput.clearValidClasses();
		this.displayModelListInput.addValidClass(ImageModel);
		this.displayModelListInput.addInvalidClass(IconModel);

		const defSize = new IntegerVector(2);
		defSize.add(100);
		defSize.add(100);
		this.imageSize = new IntegerListInput("ImageSize", Entity.GRAPHICS, defSize);
		this.setKeywordDoc(this.imageSize, "The size of the image. Value is in pixels",
				["200 100"]);
		this.imageSize.setValidCount(2);
		this.imageSize.setValidRange(0, 2500);
		this.addInput(this.imageSize);
	}

	getImageSize(): IntegerVector {
		return this.imageSize.getValue()!;
	}
}

ClassRegistry.register("com.jaamsim.Graphics.OverlayImage", OverlayImage);
LateClasses.bind("com.jaamsim.Graphics.OverlayImage", OverlayImage);
