/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2019-2024 JaamSim Software Inc.
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

// 抽象クラスなので ClassRegistry には入れない。DisplayEntity が名前で引く（LateClasses.isInstance）ので、
// ファイルの最後で LateClasses.bind する。

import { BooleanProvInput } from "../internal.ts";
import type { DisplayEntity } from "../Graphics/DisplayEntity.ts";
import { LateClasses } from "../internal.ts";
import { Region } from "../internal.ts";
import { LinkedComponent } from "../internal.ts";
import { Entity } from "../internal.ts";
import type { Input } from "../input/Input.ts";
import { InputAgent } from "../internal.ts";
import type { InputCallback } from "../input/InputCallback.ts";
import { Vec3dInput } from "../internal.ts";
import { Vec3d } from "../internal.ts";
import { DimensionlessUnit } from "../internal.ts";
import { DistanceUnit } from "../internal.ts";
import { SubModelEnd } from "../internal.ts";
import { SubModelStart } from "../internal.ts";

export abstract class CompoundEntity extends LinkedComponent {

	protected readonly showComponents: BooleanProvInput;

	protected readonly processPosition: Vec3dInput;

	private smStart: SubModelStart | null = null;

	private static readonly smRegionName = "Region";

	constructor() {
		super();

		this.nextComponent.setRequired(false);

		this.regionInput.setCallback(CompoundEntity.regionCallback);

		this.showComponents = new BooleanProvInput("ShowComponents", Entity.FORMAT, false);
		this.setKeywordDoc(this.showComponents, "Determines whether to display the sub-model's components.", []);
		this.addInput(this.showComponents);

		this.processPosition = new Vec3dInput("ProcessPosition", Entity.FORMAT, new Vec3d(0.0, 0.0, 0.01));
		this.setKeywordDoc(this.processPosition, "The position of the entities being processed relative to the "
				+ "sub-model. "
				+ "This position is used when the sub-model's components are not shown.",
				["1.0 0.0 0.01 m"]);
		this.processPosition.setUnitType(DistanceUnit);
		this.addInput(this.processPosition);
	}

	override postDefine(): void {
		super.postDefine();

		// If a clone, the region and its inputs are copied from the prototype
		let smRegion = this.getSubModelRegion();
		if (smRegion != null)
			return;

		// Create the region
		const simModel = this.getJaamSimModel();
		let proto: Region | null = null;
		if (this.getPrototype() != null)
			proto = (this.getPrototype() as CompoundEntity).getSubModelRegion();
		smRegion = InputAgent.generateEntityWithName(simModel, Region, proto, CompoundEntity.smRegionName, this, true, true);

		// Set the region's default inputs if it has no prototype from which to inherit its inputs
		if (proto == null) {
			InputAgent.applyArgs( smRegion, "RelativeEntity", this.getName());
			InputAgent.applyArgs( smRegion, "DisplayModel",   "RegionRectangle");
			InputAgent.applyValue(smRegion, "Scale",          0.5, "");
			InputAgent.applyVec3d(smRegion, "Size",           new Vec3d(2.0,  1.0, 0.0), DistanceUnit);
			InputAgent.applyVec3d(smRegion, "Position",       new Vec3d(0.0, -1.5, 0.0), DistanceUnit);
			InputAgent.applyVec3d(smRegion, "Alignment",      new Vec3d(), DimensionlessUnit);
		}
	}

	static override readonly regionCallback: InputCallback = {
		callback(ent: Entity, inp: Input<unknown>): void {
			const sm = ent as CompoundEntity;
			const region = inp.getValue() as Region | null;

			// Set the region for the sub-model
			sm.setRegion(region);

			// Set the region input for the sub-model's region
			const subModelRegion = sm.getSubModelRegion();
			if (subModelRegion != null && region != null) {
				InputAgent.applyArgs(subModelRegion, inp.getKeyword(), region.getName());
			}
		},
	};

	override earlyInit(): void {
		super.earlyInit();

		// Find the first component in the sub-model
		for (const comp of this.getChildren()) {
			if (comp instanceof SubModelStart) {
				this.smStart = comp;
				break;
			}
		}

		// Find the last component in the sub-model
		for (const comp of this.getChildren()) {
			if (comp instanceof SubModelEnd) {
				comp.setSubModel(this);
			}
		}
	}

	getSubModelRegion(): Region | null {
		return this.getChild(CompoundEntity.smRegionName) as Region | null;
	}

	isShowComponents(_simTime: number): boolean {
		return this.showComponents.getNextBoolean(this, 0.0);
	}

	override addEntity(ent: DisplayEntity): void {
		super.addEntity(ent);
		this.smStart!.addEntity(ent);
	}

	addReturnedEntity(ent: DisplayEntity): void {
		this.sendToNextComponent(ent);
	}

	getProcessPosition(): Vec3d {
		return this.processPosition.getValue()!;
	}

}

LateClasses.bind("com.jaamsim.SubModels.CompoundEntity", CompoundEntity);
