/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2018-2026 JaamSim Software Inc.
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

import { Entity } from "../internal.ts";
import { EntityInput } from "../internal.ts";
import { ExpressionInput } from "../internal.ts";
import type { Input } from "../input/Input.ts";
import { InputAgent } from "../internal.ts";
import type { InputCallback } from "../input/InputCallback.ts";
import { ClassRegistry } from "../internal.ts";
import type { JClass } from "../java/lang.ts";
import { CompoundEntity } from "../internal.ts";
import type { PassThroughData } from "./PassThroughData.ts";
import { PassThroughListInput } from "../internal.ts";

/** Java の ArrayList.indexOf（要素を equals で比べる） */
function indexOfData(list: PassThroughData[], data: PassThroughData): number {
	for (let i = 0; i < list.length; i++) {
		if (data.equals(list[i]))
			return i;
	}
	return -1;
}

/** Java の ArrayList.equals（要素を equals で比べる） */
function listEqualsData(a: PassThroughData[], b: PassThroughData[]): boolean {
	if (a.length !== b.length)
		return false;
	for (let i = 0; i < a.length; i++) {
		if (!a[i].equals(b[i]))
			return false;
	}
	return true;
}

export class SubModel extends CompoundEntity {

	protected readonly prototypeSubModel: EntityInput<SubModel>;

	protected readonly keywordListInput: PassThroughListInput;

	protected keywordList: PassThroughData[];
	private newInputList: ExpressionInput[];

	constructor() {
		super();

		this.prototypeSubModel = new EntityInput<SubModel>(SubModel, "Prototype", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.prototypeSubModel, "The prototype sub-model from which this sub-model is cloned.", []);
		this.prototypeSubModel.setHidden(true);
		this.prototypeSubModel.setCallback(SubModel.prototypeKeywordCallback);
		this.prototypeSubModel.setOutput(false);
		this.addInput(this.prototypeSubModel);

		this.keywordListInput = new PassThroughListInput("KeywordList", Entity.OPTIONS, []);
		this.setKeywordDoc(this.keywordListInput, "Defines new keywords for the sub-model and creates new outputs with "
				+ "the same names. "
				+ "This allows the components of a sub-model to receive all their inputs "
				+ "from either the parent sub-model or from other components.",
				["{ ServiceTime TimeUnit } { NumberOfUnits }"]);
		this.keywordListInput.setCallback(SubModel.keywordListKeywordCallback);
		this.addInput(this.keywordListInput);

		// Java のコンストラクタの本体
		this.keywordList = [];
		this.newInputList = [];

		const gui = this.getJaamSimModel().getGUIListener();
		if (gui != null)
			gui.updateModelBuilder();
	}

	static readonly prototypeKeywordCallback: InputCallback = {
		callback(ent: Entity, inp: Input<unknown>): void {
			// Set the prototype property and clear the Prototype input so that it is not saved
			const proto = inp.getValue() as SubModel | null;
			if (proto != null)
				ent.setPrototype(proto);
			inp.reset();
		},
	};

	static readonly keywordListKeywordCallback: InputCallback = {
		callback(ent: Entity, _inp: Input<unknown>): void {
			const sm = ent as SubModel;
			sm.updateKeywords();
			const gui = sm.getJaamSimModel().getGUIListener();
			if (gui != null)
				gui.updateInputEditor(sm);
		},
	};

	override setPrototype(proto: Entity | null): void {
		super.setPrototype(proto);
		this.update();
	}

	override postLoad(): void {
		super.postLoad();
		this.update();
	}

	/**
	 * Updates the added keywords to match the specified list.
	 * @param newDataList - data for the new list of added keywords
	 */
	updateKeywords(): void {
		const newDataList = this.keywordListInput.getValue()!;

		// Do nothing if the keywords are unchanged
		if (listEqualsData(newDataList, this.keywordList))
			return;

		// Remove the old inputs and outputs
		for (const inp of this.newInputList) {
			this.removeInput(inp);
		}

		// Add the new keywords, using the old ones whenever possible to save their input values
		const list: ExpressionInput[] = [];
		for (const data of newDataList) {
			const index = indexOfData(this.keywordList, data);
			let inp: ExpressionInput | null = null;
			if (index === -1) {
				inp = new ExpressionInput(data.getName(), Entity.KEY_INPUTS, null);
				inp.setUnitType(data.getUnitType());
				inp.setValid(true);
				inp.setRequired(true);
				if (this.isClone()) {
					const key = data.getName();
					inp.setProtoInput(this.getPrototype()!.getInput(key));
					if (!inp.isDefault())
						inp.doCallback(this);
				}
			}
			else {
				inp = this.newInputList[index];
			}
			this.addInput(inp);
			this.updateUserOutputMap();
			list.push(inp);
		}
		this.newInputList = list;
		this.keywordList = [...newDataList];
	}

	updateClones(): void {
		for (const clone of this.getAllClones()) {
			(clone as SubModel).update();
		}
	}

	/**
	 * Adjusts the clone to match the present setting for its prototype sub-model.
	 */
	update(): void {

		// Both the prototype and region must be set
		if (this.getPrototype() == null || this.getSubModelRegion() == null)
			return;

		// Do not record the components and their inputs to be 'edited'
		const bool = this.getJaamSimModel().isRecordEdits();
		this.getJaamSimModel().setRecordEdits(false);

		// Update the components
		this.createComponents();

		// Set the inputs for each component
		for (let seq = 0; seq < 2; seq++) {
			for (const protoComp of this.getPrototype()!.getChildren()) {
				const localName = protoComp.getLocalName()!;
				const comp = this.getChild(localName)!;
				comp.copyInputs(protoComp, seq);
			}
		}

		// Reset the record edits state
		this.getJaamSimModel().setRecordEdits(bool);
	}

	/**
	 * Creates this sub-model's components and sets their inputs to match its prototype's components.
	 * @param protoCompList - components for the prototype
	 */
	createComponents(): void {
		const proto = this.getPrototype() as SubModel | null;

		if (proto == null) {
			for (const comp of this.getChildren()) {
				comp.kill();
			}
			return;
		}

		// Delete any components that are not in the prototype
		for (const comp of this.getChildren()) {
			const protoComp = proto.getChild(comp.getLocalName()!);
			if (protoComp == null || comp.constructor !== protoComp.constructor
					|| comp.isAdded() || !comp.isGenerated()) {
				comp.kill();
			}
		}

		// Create the new components
		for (const protoComp of proto.getChildren()) {
			const name = protoComp.getLocalName();
			if (this.getChild(name!) != null)
				continue;
			InputAgent.generateEntityWithName(this.getJaamSimModel(),
					protoComp.constructor as JClass<Entity>, protoComp, name, this, true, true);
		}
	}

}

ClassRegistry.register("com.jaamsim.SubModels.SubModel", SubModel);
