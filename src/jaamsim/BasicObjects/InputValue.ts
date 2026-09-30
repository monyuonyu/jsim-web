/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2015 Ausenco Engineering Canada Inc.
 * Copyright (C) 2018-2024 JaamSim Software Inc.
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

import type { JClass } from "../java/lang.ts";
import { ClassRegistry } from "../internal.ts";
import { tr } from "../internal.ts";
import { KeywordCommand } from "../internal.ts";
import { TextBasics } from "../internal.ts";
import { SampleInput } from "../internal.ts";
import type { SampleProvider } from "../Samples/SampleProvider.ts";
import { Entity } from "../internal.ts";
import type { Input } from "../input/Input.ts";
import type { InputCallback } from "../input/InputCallback.ts";
import { InputErrorException } from "../internal.ts";
import { KeywordIndex } from "../internal.ts";
import { UnitTypeInput } from "../internal.ts";
import type { Unit } from "../units/Unit.ts";
import { UserSpecifiedUnit } from "../internal.ts";

export class InputValue extends TextBasics implements SampleProvider {

	protected readonly unitType: UnitTypeInput;

	protected readonly valInput: SampleInput;

	private suppressUpdate = false; // prevents the white space in the edited text from changing

	static readonly unitTypeInputCallback: InputCallback = {
		callback(ent: Entity, inp: Input<unknown>): void {
			(ent as InputValue).updateUnitType();
		},
	};

	static readonly valInputCallback: InputCallback = {
		callback(ent: Entity, inp: Input<unknown>): void {
			(ent as InputValue).updateValInput();
		},
	};

	constructor() {
		super();

		// Java の初期化ブロック
		this.unitType = new UnitTypeInput("UnitType", Entity.KEY_INPUTS, UserSpecifiedUnit);
		this.setKeywordDoc(this.unitType, "The unit type for the input value.",
		         ["DistanceUnit"]);
		this.unitType.setRequired(true);
		this.unitType.setCallback(InputValue.unitTypeInputCallback);
		this.addInput(this.unitType);

		this.valInput = new SampleInput("Value", Entity.KEY_INPUTS, 0.0);
		this.setKeywordDoc(this.valInput, "The numerical value for the input.",
		         ["1.5 km"]);
		this.valInput.setUnitType(UserSpecifiedUnit);
		this.valInput.setCallback(InputValue.valInputCallback);
		this.addInput(this.valInput);

		// Java のコンストラクタ
		this.setText(this.valInput.getDefaultString(this.getJaamSimModel()));
	}

	updateUnitType(): void {
		this.setUnitType(this.unitType.getUnitType()!);
		if (this.valInput.isDefault())
			this.setText(this.valInput.getDefaultString(this.getJaamSimModel()));
		this.updateUserOutputMap();
	}

	updateValInput(): void {
		if (!this.suppressUpdate)
			this.setText(this.valInput.getValueString());
		if (this.valInput.isDefault())
			this.setText(this.valInput.getDefaultString(this.getJaamSimModel()));
		this.suppressUpdate = false;
	}

	private setUnitType(ut: JClass<Unit>): void {
		this.valInput.setUnitType(ut);
	}

	override acceptEdits(): void {
		try {
			this.suppressUpdate = true;
			const kw = KeywordIndex.formatInput(this.valInput.getKeyword(), this.getText());
			this.getJaamSimModel().storeAndExecute(new KeywordCommand(this, kw));
			super.acceptEdits();
		}
		catch (e) {
			if (!(e instanceof InputErrorException)) throw e;
			const gui = this.getJaamSimModel().getGUIListener();
			if (gui !== null)
				gui.invokeErrorDialogBox(tr("Input Error"), e.message);
			this.suppressUpdate = false;
		}
	}

	getUnitType(): JClass<Unit> {
		return this.unitType.getUnitType()!;
	}

	override getUserUnitType(): JClass<Unit> {
		return this.unitType.getUnitType()!;
	}

	getNextSample(thisEnt: Entity, simTime: number): number {
		return this.valInput.getNextSample(this, simTime);
	}

	getMeanValue(simTime: number): number {
		return this.valInput.getNextSample(this, simTime);
	}

}

ClassRegistry.register("com.jaamsim.BasicObjects.InputValue", InputValue);
