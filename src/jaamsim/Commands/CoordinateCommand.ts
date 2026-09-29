/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2017-2026 JaamSim Software Inc.
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
import { DisplayEntity } from "../internal.ts";
import { InputAgent } from "../internal.ts";
import { KeywordIndex } from "../internal.ts";
import { Vec3d } from "../internal.ts";
import { DistanceUnit } from "../internal.ts";
import type { Command } from "./Command.ts";
import { KeywordCommand } from "../internal.ts";

export class CoordinateCommand extends KeywordCommand {

	private readonly dispEnt: DisplayEntity;
	private readonly globalPos: Vec3d;
	private readonly globalPts: Vec3d[] | null;

	constructor(ent: DisplayEntity, ...kws: KeywordIndex[]) {
		super(ent, ...kws);
		this.dispEnt = ent;
		this.globalPos = ent.getGlobalPosition();
		const pts = ent.getPoints();
		if (pts == null || pts.length === 0) {
			this.globalPts = null;
		}
		else {
			this.globalPts = ent.getGlobalPosition(pts);
		}
	}

	override execute(): void {
		super.execute();
		this.resetPosition();
	}

	override undo(): void {
		super.undo();
		this.resetPosition();
	}

	private resetPosition(): void {
		// Normal object
		if (!this.dispEnt.usePointsInput()) {
			const localPos = this.dispEnt.getLocalPosition(this.globalPos);
			InputAgent.applyVec3d(this.dispEnt, "Position", localPos, DistanceUnit);
			return;
		}

		// Polyline object
		if (this.globalPts != null) {
			const localPts = this.dispEnt.getLocalPosition(this.globalPts);
			const ptsKw = KeywordIndex.formatPointsInputs(this.dispEnt, "Points", localPts, new Vec3d());
			InputAgent.apply(this.dispEnt, ptsKw);
		}
	}

	override tryRepeat(ent: Entity | null): Command | null {
		if (ent instanceof DisplayEntity) {
			return new CoordinateCommand(ent, ...this.newKws);
		}
		return null;
	}

}
