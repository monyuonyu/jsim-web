/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2009-2011 Ausenco Engineering Canada Inc.
 * Copyright (C) 2017-2026 JaamSim Software Inc.
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
import { ColourProvInput } from "../internal.ts";
import { PolylineModel } from "../internal.ts";
import { SampleInput } from "../internal.ts";
import { Entity } from "../internal.ts";
import { ColourInput } from "../internal.ts";
import { Vec3dInput } from "../internal.ts";
import { ClassRegistry } from "../internal.ts";
import { Double } from "../internal.ts";
import type { Color4d } from "../math/Color4d.ts";
import { Vec3d } from "../internal.ts";
import { DistanceUnit } from "../internal.ts";
import { DisplayEntity } from "../internal.ts";
import { LateClasses, jint } from "../internal.ts";
import { LineEntity } from "../internal.ts";

export class Arrow extends DisplayEntity implements LineEntity {

	private readonly color: ColourProvInput;

	private readonly width: SampleInput;

	private readonly arrowHeadSize: Vec3dInput;

	constructor() {
		super();

		// ---- Java の初期化ブロック ----
		this.displayModelListInput.clearValidClasses();
		this.displayModelListInput.addValidClass(PolylineModel);

		this.color = new ColourProvInput("LineColour", Entity.FORMAT, ColourInput.BLACK);
		this.setKeywordDoc(this.color, "The colour of the arrow.", []);
		this.color.setDefaultText("PolylineModel");
		this.addInput(this.color);
		this.addSynonym(this.color, "Color");
		this.addSynonym(this.color, "Colour");

		this.width = SampleInput.ofInt("LineWidth", Entity.FORMAT, 1);
		this.setKeywordDoc(this.width, "The width of the Arrow line segments in pixels.",
				["1"]);
		this.width.setValidRange(1, Double.POSITIVE_INFINITY);
		this.width.setIntegerValue(true);
		this.width.setDefaultText("PolylineModel");
		this.addInput(this.width);
		this.addSynonym(this.width, "Width");

		this.arrowHeadSize = new Vec3dInput( "ArrowHeadSize", Entity.FORMAT, new Vec3d(0.1, 0.1, 0.0) );
		this.setKeywordDoc(this.arrowHeadSize, "A set of (x, y, z) numbers that define the size of the arrowhead.",
				["0.165 0.130 0.0 m"]);
		this.arrowHeadSize.setUnitType(DistanceUnit);
		this.arrowHeadSize.setDefaultText("PolylineModel");
		this.addInput( this.arrowHeadSize );
		this.addSynonym(this.arrowHeadSize, "ArrowSize");
	}

	getArrowHeadSize(): Vec3d {
		if (this.arrowHeadSize.isDefault()) {
			const model = this.getDisplayModel(PolylineModel);
			if (model !== null)
				return model.getArrowHeadSize();
		}
		return this.arrowHeadSize.getValue()!;
	}

	isOutlined(simTime: number): boolean {
		return true;
	}

	getLineWidth(simTime: number): number {
		if (this.width.isDefault()) {
			const model = this.getDisplayModel(LineEntity);
			if (model !== null)
				return model.getLineWidth(simTime);
		}
		return jint(this.width.getNextSample(this, simTime));
	}

	getLineColour(simTime: number): Color4d {
		if (this.color.isDefault()) {
			const model = this.getDisplayModel(LineEntity);
			if (model !== null)
				return model.getLineColour(simTime);
		}
		return this.color.getNextColour(this, simTime);
	}

	override canLabel(): boolean {
		return false;
	}

}

ClassRegistry.register("com.jaamsim.Graphics.Arrow", Arrow);
LateClasses.bind("com.jaamsim.Graphics.Arrow", Arrow);
