/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2019-2026 JaamSim Software Inc.
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
import { BooleanProvInput } from "../BooleanProviders/BooleanProvInput.ts";
import { PolylineModel } from "../DisplayModels/PolylineModel.ts";
import { SampleInput } from "../Samples/SampleInput.ts";
import { Entity } from "../basicsim/Entity.ts";
import { ClassRegistry } from "../java/ClassRegistry.ts";
import { Double } from "../java/lang.ts";
import { DistanceUnit } from "../units/DistanceUnit.ts";
import { AbstractShape } from "./AbstractShape.ts";
import { LateClasses } from "./LateClasses.ts";
import { PolylineEntity } from "./PolylineEntity.ts";

/**
 * A series of nodes that are connected by straight or curved lines. A filled polyline can be used
 * to generate an arbitrary two dimensional shape.
 * @author Harry King
 *
 */
export class Polyline extends AbstractShape implements PolylineEntity  {

	protected readonly closed: BooleanProvInput;

	protected readonly polylineWidth: SampleInput;

	constructor() {
		super();

		// ---- Java の初期化ブロック ----
		this.displayModelListInput.clearValidClasses();
		this.displayModelListInput.addValidClass(PolylineModel);

		this.outlined.setDefaultValue(true);

		this.closed = new BooleanProvInput("Closed", Entity.FORMAT, false);
		this.setKeywordDoc(this.closed, "Determines whether or not to show a line between the last point of "
		                     + "the polyline and its first point. "
		                     + "If TRUE, the closing line is displayed. "
		                     + "If FALSE, the closing line is not displayed.", []);
		this.closed.setDefaultText("DisplayModel value");
		this.addInput(this.closed);

		this.polylineWidth = new SampleInput("PolylineWidth", Entity.FORMAT, 0.0);
		this.setKeywordDoc(this.polylineWidth, "Physical width of the polyline with units of distance.",
				[ "0.5 m" ]);
		this.polylineWidth.setUnitType(DistanceUnit);
		this.polylineWidth.setValidRange(0.0, Double.POSITIVE_INFINITY);
		this.polylineWidth.setDefaultText("DisplayModel value");
		this.addInput(this.polylineWidth);
	}

	isClosed(simTime: number): boolean {
		if (this.closed.isDefault()) {
			const model = this.getDisplayModel(PolylineEntity);
			if (model !== null)
				return model.isClosed(simTime);
		}
		return this.closed.getNextBoolean(this, simTime);
	}

	getPolylineWidth(simTime: number): number {
		if (this.polylineWidth.isDefault()) {
			const model = this.getDisplayModel(PolylineEntity);
			if (model !== null)
				return model.getPolylineWidth(simTime);
		}
		return this.polylineWidth.getNextSample(this, simTime);
	}

	override canLabel(): boolean {
		return false;
	}

}

ClassRegistry.register("com.jaamsim.Graphics.Polyline", Polyline);
LateClasses.bind("com.jaamsim.Graphics.Polyline", Polyline);
