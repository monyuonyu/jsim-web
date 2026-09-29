//@@HEADER@@
import type { DisplayModel } from "../DisplayModels/DisplayModel.ts";
import { EntityProvInput } from "../EntityProviders/EntityProvInput.ts";
import { Entity } from "../basicsim/Entity.ts";
import type { Input } from "../input/Input.ts";
import type { InputCallback } from "../input/InputCallback.ts";
import { ClassRegistry } from "../java/ClassRegistry.ts";
import { DisplayEntity } from "./DisplayEntity.ts";
import { LateClasses } from "./LateClasses.ts";
import { OverlayEntity } from "./OverlayEntity.ts";
import { TextBasics } from "./TextBasics.ts";

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
