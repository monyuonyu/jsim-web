//@@HEADER@@
import { KeywordCommand } from "../Commands/KeywordCommand.ts";
import { Entity } from "../basicsim/Entity.ts";
import { tr } from "../i18n/I18n.ts";
import type { Input } from "../input/Input.ts";
import type { InputCallback } from "../input/InputCallback.ts";
import { InputErrorException } from "../input/InputErrorException.ts";
import { KeywordIndex } from "../input/KeywordIndex.ts";
import { KeywordInput } from "../input/KeywordInput.ts";
import { ClassRegistry } from "../java/ClassRegistry.ts";
import { LateClasses } from "./LateClasses.ts";
import { TextBasics } from "./TextBasics.ts";

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
			const kw = KeywordIndex.formatInput(this.target.getValue(), this.getText());
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
