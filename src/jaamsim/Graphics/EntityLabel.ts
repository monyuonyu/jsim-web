/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2015 Ausenco Engineering Canada Inc.
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
import type { VisibilityInfo } from "../DisplayModels/DisplayModel.ts";
import { Entity } from "../basicsim/Entity.ts";
import { tr } from "../i18n/I18n.ts";
import { EntityInput } from "../input/EntityInput.ts";
import type { Input } from "../input/Input.ts";
import { InputAgent } from "../input/InputAgent.ts";
import type { InputCallback } from "../input/InputCallback.ts";
import { ClassRegistry } from "../java/ClassRegistry.ts";
import { Vec3d } from "../math/Vec3d.ts";
import { DistanceUnit } from "../units/DistanceUnit.ts";
import { DisplayEntity } from "./DisplayEntity.ts";
import { LateClasses } from "./LateClasses.ts";
import type { Region } from "./Region.ts";
import { TextBasics } from "./TextBasics.ts";

/*
 * 移植の注意:
 * - Java は getRelativeEntity()（引数なし）だけを上書きし、getRelativeEntity(double) は上書きしない。
 *   TS では 1 つの関数なので、引数の無いときだけ getTarget() を返すようにした。
 * - "ERROR"（名前の無いとき）はモデルのファイルに書き出す値ではないが、Java と同じく英語のまま残した。
 */

export class EntityLabel extends TextBasics {

	protected readonly targetEntity: EntityInput<DisplayEntity>;

	constructor() {
		super();

		// ---- Java の初期化ブロック ----
		this.nameInput.setHidden(true);
		this.parentInput.setHidden(true);
		this.desc.setHidden(true);
		this.attributeDefinitionList.setHidden(true);
		this.namedExpressionInput.setHidden(true);
		this.visibleViews.setHidden(true);
		this.drawRange.setHidden(true);

		this.targetEntity = new EntityInput<DisplayEntity>(DisplayEntity, "TargetEntity", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.targetEntity, "The name of an entity that is labelled by this EntityLabel.", []);
		this.targetEntity.setCallback(EntityLabel.targetEntityCallback);
		this.targetEntity.setHidden(true);
		this.addInput(this.targetEntity);

		this.relativeEntity.setHidden(true);
		this.relativeEntity.setCallback(EntityLabel.disabledInputCallback);

		this.regionInput.setHidden(true);
		this.regionInput.setCallback(EntityLabel.disabledInputCallback);

		this.textHeight.setCallback(EntityLabel.textHeightCallback);
	}

	static getLabel(ent: Entity | null): EntityLabel | null {
		if (!(ent instanceof DisplayEntity))
			return null;

		// Is there a label with the correct name?
		let label: Entity | null = ent.getChild("Label");

		// Old ways in which labels were defined
		if (label === null) // FIXME - remove when all labels have the correct name
			label = ent.getJaamSimModel().getNamedEntity(ent.getName() + "_Label");
		if (label === null)
			label = ent.getJaamSimModel().getNamedEntity(ent.getName() + "_Label1");

		if (label instanceof EntityLabel)
			return label;

		// Otherwise, search for a label with the correct target entity
		// (Required when the entity's name has been changed)
		for (const lab of ent.getJaamSimModel().getClonesOfIterator(EntityLabel)) {
			if (lab.getTarget() === ent)
				return lab;
		}
		return null;
	}

	override resetGraphics(): void {}

	static readonly targetEntityCallback: InputCallback = {
		callback(ent: Entity, inp: Input<unknown>): void {
			if (inp.getValue() === ent.getParent())
				inp.reset();
		},
	} as InputCallback;

	static readonly textHeightCallback: InputCallback = {
		callback(ent: Entity, inp: Input<unknown>): void {
			(ent as EntityLabel).resizeForText();
		},
	} as InputCallback;

	static readonly disabledInputCallback: InputCallback = {
		callback(ent: Entity, inp: Input<unknown>): void {
			inp.reset();
		},
	} as InputCallback;

	override isGraphicsNominal(): boolean {
		return true;
	}

	/** Java は引数の無い getRelativeEntity() だけを上書きする */
	override getRelativeEntity(simTime?: number): DisplayEntity | null {
		if (simTime === undefined)
			return this.getTarget();
		return super.getRelativeEntity(simTime);
	}

	override getCurrentRegion(): Region | null {
		const target = this.getTarget();
		if (target === null)
			return null;
		return target.getCurrentRegion();
	}

	override isRegionNominal(): boolean {
		return true;
	}

	override getText(): string {
		if (this.isEditMode())
			return super.getText();
		const ent: Entity | null = this.getTarget();
		if (ent === null || ent.getName() === null || ent.getName() === undefined)
			return "ERROR";
		return ent.getLocalName()!;
	}

	override setEditMode(bool: boolean): void {
		this.updateForTargetNameChange();
		super.setEditMode(bool);
	}

	override acceptEdits(): void {
		const gui = this.getJaamSimModel().getGUIListener();
		if (gui === null || gui === undefined)
			return;
		try {
			// Rename both the target entity and the label
			const ent = this.getTarget();
			const localName = this.getText();
			gui.renameEntity(ent!, localName);
			super.acceptEdits();
		}
		catch (e) {
			super.cancelEdits();
			gui.invokeErrorDialogBox(tr("Input Error"), (e as Error).message);
		}
	}

	private getTarget(): DisplayEntity | null {
		if (!this.targetEntity.getIsDef())
			return this.targetEntity.getValue()!;
		if (this.getParent() instanceof DisplayEntity)
			return this.getParent() as DisplayEntity;
		return null;
	}

	updateForTargetNameChange(): void {
		const targetName = this.getTarget()!.getLocalName()!;
		this.setText(targetName);
		this.resizeForText();
	}

	/**
	 * Creates a label for the specified entity.
	 * @param ent - entity to be labeled
	 * @param undo - true if undo is to be enabled
	 * @return label object
	 */
	static createLabel(ent: DisplayEntity): EntityLabel {

		// Create the EntityLabel object
		const simModel = ent.getJaamSimModel();
		const proto = EntityLabel.getLabel(ent.getPrototype());
		const label = InputAgent.defineEntityWithUniqueName(simModel, EntityLabel, proto, ent.getName() + ".Label", "", true)!;

		// Set the label's position
		InputAgent.applyVec3d(label, "Position", label.getDefaultPosition(), DistanceUnit);

		// Set the label's size
		label.resizeForText();

		return label;
	}

	getDefaultPosition(): Vec3d {
		const ent = this.getTarget()!;
		let ypos = -0.15;
		if (!ent.usePointsInput())
			ypos -= 0.5*ent.getSize().y;
		return new Vec3d(0.0, ypos, 0.0);
	}

	static showLabel(ent: DisplayEntity, bool: boolean): void {
		let label = EntityLabel.getLabel(ent);

		// Does the label exist yet?
		if (label === null) {
			if (!bool)
				return;
			label = EntityLabel.createLabel(ent);
		}

		// Show or hide the label
		if (label.getShowInput() === bool)
			return;
		InputAgent.applyBoolean(label, "Show", bool);
	}

	static showTemporaryLabel(ent: DisplayEntity): void {
		let label = EntityLabel.getLabel(ent);
		if (label === null) {
			label = EntityLabel.createLabel(ent);
			InputAgent.applyBoolean(label, "Show", false);
		}
	}

	override isDefault(): boolean {
		if (this.getTarget() === null)
			return true;
		const pos = this.getDefaultPosition();
		return this.getPosition().near3(pos) && super.isDefault();
	}

	override getShow(simTime: number = 0.0): boolean {
		return (super.getShow(simTime) || this.getSimulation().isShowLabels())
				&& this.getTarget() !== null && this.getTarget()!.getShow(simTime) && this.getTarget()!.isMovable();
	}

	override getVisibilityInfo(): VisibilityInfo | null {
		const target = this.getTarget();
		if (target === null)
			return null;
		return target.getVisibilityInfo();
	}

}

ClassRegistry.register("com.jaamsim.Graphics.EntityLabel", EntityLabel);
LateClasses.bind("com.jaamsim.Graphics.EntityLabel", EntityLabel);
