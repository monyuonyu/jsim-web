/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2017-2022 JaamSim Software Inc.
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
import type { DisplayModel } from "../DisplayModels/DisplayModel.ts";
import { EntityProvInput } from "../internal.ts";
import { Entity } from "../internal.ts";
import type { Input } from "../input/Input.ts";
import type { InputCallback } from "../input/InputCallback.ts";
import { ClassRegistry } from "../internal.ts";
import { DisplayEntity } from "../internal.ts";
import { LateClasses } from "../internal.ts";
import { OverlayEntity } from "../internal.ts";
import { TextBasics } from "../internal.ts";

/*
 * 移植の注意: 描画の部品（DisplayModelBinding）は移していないので、sourceBindings は
 * DisplayEntity.getDisplayBindings の戻り値（今は null を並べた配列）を持つだけ。
 */

export class MimicEntity extends DisplayEntity {

	private readonly sourceEntity: EntityProvInput<DisplayEntity>;

	private sourceBindings: (object | null)[] | null = null;

	constructor() {
		super();

		// ---- Java の初期化ブロック ----
		this.sourceEntity = new EntityProvInput<DisplayEntity>(DisplayEntity, "SourceEntity", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.sourceEntity, "The entity whose graphics are to be copied.",
				["Server1", "this.ent"]);
		this.sourceEntity.addInvalidClass(MimicEntity);
		this.sourceEntity.addInvalidClass(TextBasics);
		this.sourceEntity.addInvalidClass(OverlayEntity);
		this.sourceEntity.setCallback(MimicEntity.inputCallback);
		this.addInput(this.sourceEntity);
	}

	static readonly inputCallback: InputCallback = {
		callback(ent: Entity, inp: Input<unknown>): void {
			(ent as MimicEntity).clearBindings();
		},
	} as InputCallback;

	override getDisplayModelList(): DisplayModel[] {
		try {
			const ent = this.sourceEntity.getNextEntity(this, 0.0);
			if (ent !== null) {
				return ent.getDisplayModelList();
			}
		}
		catch (e) {
			// Java: catch (Exception e) {}
		}
		return super.getDisplayModelList();
	}

	override getDisplayBindings(): (object | null)[] {
		try {
			const ent = this.sourceEntity.getNextEntity(this, 0.0);
			if (ent !== null && this.sourceBindings !== ent.getDisplayBindings()) {
				this.sourceBindings = ent.getDisplayBindings();
				this.clearBindings();
			}
		}
		catch (e) {
			// Java: catch (Exception e) {}
		}
		return super.getDisplayBindings();
	}

}

ClassRegistry.register("com.jaamsim.Graphics.MimicEntity", MimicEntity);
LateClasses.bind("com.jaamsim.Graphics.MimicEntity", MimicEntity);
