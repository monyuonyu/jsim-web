/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2021-2024 JaamSim Software Inc.
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

import { Double, Integer } from "../internal.ts";
import { ClassRegistry } from "../internal.ts";
import { BooleanProvInput } from "../internal.ts";
import { ColourProvInput } from "../internal.ts";
import { ShapeModel } from "../internal.ts";
import { GameEntity } from "../internal.ts";
import { FillEntity } from "../internal.ts";
import { LineEntity } from "../internal.ts";
import { SampleInput } from "../internal.ts";
import { Entity } from "../internal.ts";
import type { ObserverEntity } from "../basicsim/ObserverEntity.ts";
import type { SubjectEntity } from "../basicsim/SubjectEntity.ts";
import { SubjectEntityDelegate } from "../internal.ts";
import { ColourInput } from "../internal.ts";
import type { Input } from "../input/Input.ts";
import type { InputCallback } from "../input/InputCallback.ts";
import { defineOutput } from "../internal.ts";
import type { Color4d } from "../math/Color4d.ts";
import { DimensionlessUnit } from "../internal.ts";

/** Java の (int) の型変換（0 の方向へ切り捨て、NaN は 0、範囲の外は端に張り付く） */
function toInt(x: number): number {
	if (Number.isNaN(x)) return 0;
	if (x >= Integer.MAX_VALUE) return Integer.MAX_VALUE;
	if (x <= Integer.MIN_VALUE) return Integer.MIN_VALUE;
	return Math.trunc(x);
}

export class ToggleButton extends GameEntity implements SubjectEntity, LineEntity, FillEntity {

	private readonly initialValue: BooleanProvInput;

	private readonly pressedColour: ColourProvInput;

	private readonly unpressedColour: ColourProvInput;

	protected readonly outlined: BooleanProvInput;

	protected readonly lineColour: ColourProvInput;

	protected readonly lineWidth: SampleInput;

	private value = false;  // true = pressed, false = not pressed
	private readonly subject: SubjectEntityDelegate;

	static readonly initialValueCallback: InputCallback = {
		callback(ent: Entity, inp: Input<unknown>): void {
			(ent as ToggleButton).updateInputValue();
		},
	};

	constructor() {
		super();

		// Java のフィールドの初期値（初期化ブロックの前に書かれている）
		this.subject = new SubjectEntityDelegate(this);

		// Java の初期化ブロック
		this.displayModelListInput.clearValidClasses();
		this.displayModelListInput.addValidClass(ShapeModel);

		this.initialValue = new BooleanProvInput("InitialValue", Entity.KEY_INPUTS, false);
		this.setKeywordDoc(this.initialValue, "The initial state for the button: "
		                     + "TRUE = button pressed, FALSE = button unpressed.", []);
		this.initialValue.setCallback(ToggleButton.initialValueCallback);
		this.addInput(this.initialValue);

		this.pressedColour = new ColourProvInput("PressedColour", Entity.FORMAT, ColourInput.MED_GREY);
		this.setKeywordDoc(this.pressedColour, "The colour of the button when pressed.", []);
		this.pressedColour.setDefaultText("ShapeModel value");
		this.addInput(this.pressedColour);
		this.addSynonym(this.pressedColour, "FillColour");

		this.unpressedColour = new ColourProvInput("UnpressedColour", Entity.FORMAT, ColourInput.getColorWithName("Ivory"));
		this.setKeywordDoc(this.unpressedColour, "The colour of the button when not pressed.", []);
		this.addInput(this.unpressedColour);

		this.outlined = new BooleanProvInput("Outlined", Entity.FORMAT, true);
		this.setKeywordDoc(this.outlined, "Determines whether or not the object is outlined. "
		                     + "If TRUE, it is outlined with a specified colour. "
		                     + "If FALSE, it is drawn without an outline.", []);
		this.outlined.setDefaultText("ShapeModel value");
		this.addInput(this.outlined);

		this.lineColour = new ColourProvInput("LineColour", Entity.FORMAT, ColourInput.BLACK);
		this.setKeywordDoc(this.lineColour, "The colour with which the object is outlined.", []);
		this.lineColour.setDefaultText("ShapeModel value");
		this.addInput(this.lineColour);

		this.lineWidth = SampleInput.ofInt("LineWidth", Entity.FORMAT, 1);
		this.setKeywordDoc(this.lineWidth, "Width of the outline in pixels.",
		         [ "3" ]);
		this.lineWidth.setValidRange(0, Double.POSITIVE_INFINITY);
		this.lineWidth.setIntegerValue(true);
		this.lineWidth.setDefaultText("ShapeModel value");
		this.addInput(this.lineWidth);
	}

	updateInputValue(): void {
		this.value = this.initialValue.getNextBoolean(this, 0.0);
	}

	override setState(): void {
		this.value = !this.value;
	}

	override doAction(): void {
		this.notifyObservers();
	}

	registerObserver(obs: ObserverEntity): void {
		this.subject.registerObserver(obs);
	}

	notifyObservers(): void {
		this.subject.notifyObservers();
	}

	getObserverList(): ObserverEntity[] {
		return this.subject.getObserverList();
	}

	isFilled(simTime: number): boolean {
		return true;
	}

	getFillColour(simTime: number): Color4d {
		if (this.pressedColour.isDefault()) {
			const model = this.getDisplayModel(FillEntity);
			if (model !== null)
				return model.getFillColour(simTime);
		}
		return this.pressedColour.getNextColour(this, simTime);
	}

	isOutlined(simTime: number): boolean {
		if (this.outlined.isDefault()) {
			const model = this.getDisplayModel(LineEntity);
			if (model !== null)
				return model.isOutlined(simTime);
		}
		return this.outlined.getNextBoolean(this, simTime);
	}

	getLineWidth(simTime: number): number {
		if (this.lineWidth.isDefault()) {
			const model = this.getDisplayModel(LineEntity);
			if (model !== null)
				return model.getLineWidth(simTime);
		}
		return toInt(this.lineWidth.getNextSample(this, simTime));
	}

	getLineColour(simTime: number): Color4d {
		if (this.lineColour.isDefault()) {
			const model = this.getDisplayModel(LineEntity);
			if (model !== null)
				return model.getLineColour(simTime);
		}
		return this.lineColour.getNextColour(this, simTime);
	}

	/** 描画の更新のうち、状態（色の値）の計算だけを残す（PORTING.md の 7） */
	override updateGraphics(simTime: number): void {
		super.updateGraphics(simTime);

		// Select the colour
		let col: Color4d;
		if (this.value) {
			col = this.getFillColour(simTime);
		}
		else {
			col = this.unpressedColour.getNextColour(this, simTime);
		}

		// Display the button
		this.setTagVisibility(ShapeModel.TAG_CONTENTS, true);
		this.setTagColour(ShapeModel.TAG_CONTENTS, col);
	}

	isPressed(simTime: number): boolean {
		return this.value;
	}

}

ClassRegistry.register("com.jaamsim.BasicObjects.ToggleButton", ToggleButton);

defineOutput(ToggleButton, {
	name: "Value",
	description: "Returns TRUE if the button is in the 'pressed' state, FALSE if it is not.",
	unitType: DimensionlessUnit, reportable: false, sequence: 1,
	returnType: "boolean",
	get: (e, simTime) => e.isPressed(simTime),
});
