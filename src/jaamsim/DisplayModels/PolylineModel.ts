/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2013 Ausenco Engineering Canada Inc.
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
import { BooleanProvInput } from "../internal.ts";
import { LateClasses } from "../internal.ts";
import type { PolylineEntity } from "../Graphics/PolylineEntity.ts";
import { SampleInput } from "../internal.ts";
import { Entity } from "../internal.ts";
import { ColourInput } from "../internal.ts";
import { Vec3dInput } from "../internal.ts";
import { ClassRegistry } from "../internal.ts";
import { Double } from "../internal.ts";
import type { Color4d } from "../math/Color4d.ts";
import { Vec3d } from "../internal.ts";
import { Vec4d } from "../internal.ts";
import { DistanceUnit } from "../internal.ts";
import { AbstractShapeModel } from "../internal.ts";

/*
 * 移植の注意:
 * - 描画: 省略（three.js の画面を作るときに）。入れ子のクラス Binding（線・塗り・幅のある線・矢じり・
 *   選択用の点と線の描き方）と addPoint は移さない。要点は docs/todo-F.md に書いた。
 * - MINT と arrowHeadVerts は Binding が使う値だが、three.js の画面で使うので残した。
 */

export class PolylineModel extends AbstractShapeModel implements PolylineEntity {

	protected readonly closed: BooleanProvInput;

	protected readonly polylineWidth: SampleInput;

	protected readonly showArrowHead: BooleanProvInput;

	protected readonly arrowHeadSize: Vec3dInput;

	constructor() {
		super();

		// ---- Java の初期化ブロック ----
		this.outlined.setDefaultValue(true);

		this.addSynonym(this.lineColour, "Color");
		this.addSynonym(this.lineColour, "Colour");

		this.addSynonym(this.lineWidth, "Width");

		this.addSynonym(this.fillColour, "FillColor");

		this.polylineWidth = new SampleInput("PolylineWidth", Entity.KEY_INPUTS, 0.0);
		this.setKeywordDoc(this.polylineWidth, "Physical width of the polyline with units of distance.",
				[ "0.5 m" ]);
		this.polylineWidth.setUnitType(DistanceUnit);
		this.polylineWidth.setValidRange(0.0, Double.POSITIVE_INFINITY);
		this.addInput(this.polylineWidth);

		this.closed = new BooleanProvInput("Closed", Entity.KEY_INPUTS, false);
		this.setKeywordDoc(this.closed, "Determines whether or not to show a line between the last point of "
		                     + "the polyline and its first point. "
		                     + "If TRUE, the closing line is displayed. "
		                     + "If FALSE, the closing line is not displayed.", []);
		this.addInput(this.closed);

		this.showArrowHead = new BooleanProvInput("ShowArrowHead", Entity.KEY_INPUTS, false);
		this.setKeywordDoc(this.showArrowHead, "If TRUE, an arrow head is displayed at the end of the polyline.", []);
		this.addInput(this.showArrowHead);

		this.arrowHeadSize = new Vec3dInput("ArrowHeadSize", Entity.KEY_INPUTS, new Vec3d(0.1, 0.1, 0.0));
		this.setKeywordDoc(this.arrowHeadSize, "A set of (x, y, z) numbers that define the size of the arrowhead.",
				[ "0.165 0.130 0.0 m" ]);
		this.arrowHeadSize.setUnitType(DistanceUnit);
		this.addInput(this.arrowHeadSize);
		this.addSynonym(this.arrowHeadSize, "ArrowSize");
	}

	// 描画: Binding が使う値（three.js の画面を作るときに使う）
	private static readonly MINT: Color4d = ColourInput.getColorWithName("mint")!;
	protected static arrowHeadVerts: Vec4d[] = [
		new Vec4d(0.0,  0.0, 0.0, 1.0),
		new Vec4d(1.0, -0.5, 0.0, 1.0),
		new Vec4d(1.0,  0.5, 0.0, 1.0),
	];

	/** 描画: 省略（three.js の画面を作るときに）。Java は new Binding(ent, this) */
	override getBinding(ent: Entity): object | null {
		return null;
	}

	override canDisplayEntity(ent: Entity): boolean {
		return LateClasses.isInstance(ent, "com.jaamsim.Graphics.DisplayEntity");
	}

	isClosed(simTime: number): boolean {
		return this.closed.getNextBoolean(this, simTime);
	}

	getPolylineWidth(simTime: number): number {
		return this.polylineWidth.getNextSample(this, simTime);
	}

	isShowArrowHead(simTime: number): boolean {
		return this.showArrowHead.getNextBoolean(this, simTime);
	}

	getArrowHeadSize(): Vec3d {
		return this.arrowHeadSize.getValue()!;
	}

}

ClassRegistry.register("com.jaamsim.DisplayModels.PolylineModel", PolylineModel);
LateClasses.bind("com.jaamsim.DisplayModels.PolylineModel", PolylineModel);
