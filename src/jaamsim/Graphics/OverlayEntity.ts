/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2013 Ausenco Engineering Canada Inc.
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
import { BooleanProvInput } from "../BooleanProviders/BooleanProvInput.ts";
import { KeywordCommand } from "../Commands/KeywordCommand.ts";
import { Entity } from "../basicsim/Entity.ts";
import { IntegerVector } from "../datatypes/IntegerVector.ts";
import { InputAgent } from "../input/InputAgent.ts";
import { IntegerListInput } from "../input/IntegerListInput.ts";
import { KeywordIndex } from "../input/KeywordIndex.ts";
import type { Vec3d } from "../math/Vec3d.ts";
import { DisplayEntity } from "./DisplayEntity.ts";
import { KeyEvent } from "./Editable.ts";
import { LateClasses } from "./LateClasses.ts";

/*
 * 移植の注意: 画面の座標（画素）で受ける handleMouseClicked(short, int, int, int, int, boolean, boolean, boolean) と
 * handleDrag(int, int, int, int, int, int) は、DisplayEntity の同じ名前の関数（空間の座標で受ける）と
 * 引数が違って 1 つにできないので、handleOverlayMouseClicked と handleOverlayDrag に名前を変えた（docs/renamed.md）。
 */

/**
 * OverlayEntity is the superclass for DisplayEntities that have 2D overlay graphics instead of 3D graphics.  Overlay graphics
 * are those that appear relative to the View window and whose position and size are specified in pixels.
 * @author Harry King
 *
 */
export abstract class OverlayEntity extends DisplayEntity {

	private readonly screenPosition: IntegerListInput;

	private readonly alignRight: BooleanProvInput;

	private readonly alignBottom: BooleanProvInput;

	constructor() {
		super();

		// ---- Java の初期化ブロック ----
		const defPos = new IntegerVector(2);
		defPos.add(10);
		defPos.add(10);
		this.screenPosition = new IntegerListInput("ScreenPosition", Entity.GRAPHICS, defPos);
		this.setKeywordDoc(this.screenPosition, "The position of the overlay, from the upper left corner of the window to the upper left corner " +
		                "of the overlay. Value is in pixels",
				["20 20"]);
		this.screenPosition.setValidCount(2);
		this.screenPosition.setValidRange(0, 2500);
		this.addInput(this.screenPosition);

		this.alignRight = new BooleanProvInput("AlignRight", Entity.GRAPHICS, false);
		this.setKeywordDoc(this.alignRight, "If this overlay should be aligned from the right edge of the window (instead of the left)", []);
		this.addInput(this.alignRight);

		this.alignBottom = new BooleanProvInput("AlignBottom", Entity.GRAPHICS, false);
		this.setKeywordDoc(this.alignBottom, "If this overlay should be aligned from the bottom edge of the window (instead of the top)", []);
		this.addInput(this.alignBottom);
	}

	getAlignRight(): boolean {
		return this.alignRight.getNextBoolean(this, 0.0);
	}

	getAlignBottom(): boolean {
		return this.alignBottom.getNextBoolean(this, 0.0);
	}

	getScreenPosition(): IntegerVector {
		return this.screenPosition.getValue()!;
	}

	override dragged(x: number, y: number, newPos: Vec3d): void {
		const kw = KeywordIndex.formatIntegers("ScreenPosition", x, y);
		InputAgent.apply(this, kw);
	}

	override handleKeyPressed(keyCode: number, keyChar: string, shift: boolean, control: boolean, alt: boolean): boolean {
		if (!this.isMovable())
			return false;

		const pos = this.screenPosition.getValue()!;
		let x = pos.get(0);
		let y = pos.get(1);

		switch (keyCode) {

			case KeyEvent.VK_LEFT:
				x += this.getAlignRight() ? 1 : -1;
				break;

			case KeyEvent.VK_RIGHT:
				x += this.getAlignRight() ? -1 : 1;
				break;

			case KeyEvent.VK_UP:
				y += this.getAlignBottom() ? 1 : -1;
				break;

			case KeyEvent.VK_DOWN:
				y += this.getAlignBottom() ? -1 : 1;
				break;

			default:
				return false;
		}

		x = Math.max(0, x);
		y = Math.max(0, y);
		const kw = KeywordIndex.formatIntegers(this.screenPosition.getKeyword(), x, y);
		this.getJaamSimModel().storeAndExecute(new KeywordCommand(this, kw));
		return true;
	}

	/** Java の handleMouseClicked(short count, int x, int y, int windowWidth, int windowHeight, ...)（名前を変えた） */
	handleOverlayMouseClicked(count: number, x: number, y: number, windowWidth: number, windowHeight: number,
			shift: boolean, control: boolean, alt: boolean): void {}

	/** Java の handleDrag(int x, int y, int startX, int startY, int windowWidth, int windowHeight)（名前を変えた） */
	handleOverlayDrag(x: number, y: number, startX: number, startY: number, windowWidth: number, windowHeight: number): boolean {
		return false;
	}

	override canLabel(): boolean {
		return false;
	}

}

LateClasses.bind("com.jaamsim.Graphics.OverlayEntity", OverlayEntity);
