/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2015 Ausenco Engineering Canada Inc.
 * Copyright (C) 2018-2019 JaamSim Software Inc.
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
import { KeywordCommand } from "../internal.ts";
import { Entity } from "../internal.ts";
import { tr } from "../internal.ts";
import type { Input } from "../input/Input.ts";
import type { InputCallback } from "../input/InputCallback.ts";
import { InputErrorException } from "../internal.ts";
import { KeywordIndex } from "../internal.ts";
import { KeywordInput } from "../internal.ts";
import { ClassRegistry } from "../internal.ts";
import { LateClasses } from "../internal.ts";
import { TextBasics } from "../internal.ts";

export class InputBox extends TextBasics {

	protected readonly target: KeywordInput;

	constructor() {
		super();

		// ---- Java の初期化ブロック ----
		this.target = new KeywordInput("TargetInput", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.target, "The name of the entity and keyword that will receive the input value.",
				["DisplayEntity1 Size"]);
		this.target.setRequired(true);
		this.target.setCallback(InputBox.inputCallback);
		this.addInput(this.target);
	}

	override setInputsForDragAndDrop(): void {
		super.setInputsForDragAndDrop();
		this.setText(this.getName());
	}

	static readonly inputCallback: InputCallback = {
		callback(ent: Entity, inp: Input<unknown>): void {
			(ent as InputBox).cancelEdits();
		},
	} as InputCallback;

	override acceptEdits(): void {
		if (this.target.getValue() === null) {
			super.acceptEdits();
			return;
		}
		try {
			const kw = KeywordIndex.formatInput(this.target.getValue()!, this.getText());
			this.getJaamSimModel().storeAndExecute(new KeywordCommand(this.target.getTargetEntity(), kw));
			super.acceptEdits();
		}
		catch (e) {
			if (!(e instanceof InputErrorException)) throw e;
			const gui = this.getJaamSimModel().getGUIListener();
			if (gui !== null && gui !== undefined)
				gui.invokeErrorDialogBox(tr("Input Error"), e.message);
		}
	}

	override getCachedText(): string {
		const targetInput = this.target.getTargetInput();
		if (!this.isEditMode() && targetInput !== null && targetInput !== undefined) {
			let str = targetInput.getValueString();
			if (str.length === 0)
				str = targetInput.getDefaultString(this.getJaamSimModel());
			this.setText(str);
		}
		return this.getText();
	}

}

ClassRegistry.register("com.jaamsim.Graphics.InputBox", InputBox);
LateClasses.bind("com.jaamsim.Graphics.InputBox", InputBox);
