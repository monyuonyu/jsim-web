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
import { BooleanProvInput } from "../internal.ts";
import { ColourProvInput } from "../internal.ts";
import { TextModel } from "../internal.ts";
import { type TessFontKey } from "../DisplayModels/TextModel.ts";
import { SampleInput } from "../internal.ts";
import { Entity } from "../internal.ts";
import { tr } from "../internal.ts";
import { ColourInput } from "../internal.ts";
import { Input } from "../internal.ts";
import { InputAgent } from "../internal.ts";
import { StringChoiceInput } from "../internal.ts";
import { StringListInput } from "../internal.ts";
import { Vec3dInput } from "../internal.ts";
import { Double } from "../internal.ts";
import type { Color4d } from "../math/Color4d.ts";
import { Vec3d } from "../internal.ts";
import { DistanceUnit } from "../internal.ts";
import { AbstractShape } from "../internal.ts";
import { Editable, KeyEvent } from "../internal.ts";
import { EditableText } from "../internal.ts";
import { EditableTextDelegate } from "../internal.ts";
import { LateClasses } from "../internal.ts";
import { TextEntity } from "../internal.ts";

/*
 * 移植の注意:
 * - 文字の大きさを測る所（RenderManager.getRenderedStringSize・getRenderedStringPosition）は描画の部品。
 *   描画: 省略（three.js の画面を作るときに）。代わりに static の TextBasics.fontMetrics を置いた。
 *   null の間は Java で RenderManager.isGood() が false のときと同じ扱い（resizeForText は何もしない）。
 *   three.js の画面の側で、字体の大きさを測る関数をここに入れる。
 * - RenderManager.redraw() の呼び出しは消した（描画: 省略）。
 * - TessFontKey は中身だけの値（DisplayModels/TextModel.ts の TessFontKey 型）。
 */

/** RenderManager の、文字の大きさを測る関数（描画: three.js の画面の側で用意する） */
export interface FontMetrics {
	getRenderedStringSize(fontKey: TessFontKey, textHeight: number, text: string): Vec3d;
	getRenderedStringPosition(fontKey: TessFontKey, textHeight: number, text: string, x: number, y: number): number;
}

/**
 * The "TextBasics" object displays text within the 3D model universe.
 * @author Harry King
 *
 */
export abstract class TextBasics extends AbstractShape implements TextEntity, EditableText {

	/** 描画: 文字の大きさを測る関数（null の間は RenderManager.isGood() が false と同じ） */
	static fontMetrics: FontMetrics | null = null;

	private readonly fontName: StringChoiceInput;

	protected readonly textHeight: SampleInput;

	private readonly fontStyle: StringListInput;

	private readonly fontColor: ColourProvInput;

	private readonly dropShadow: BooleanProvInput;

	private readonly dropShadowColor: ColourProvInput;

	private readonly dropShadowOffset: Vec3dInput;

	private readonly editableText: EditableTextDelegate;

	constructor() {
		super();

		// ---- Java の初期化ブロック ----
		this.displayModelListInput.clearValidClasses();
		this.displayModelListInput.addValidClass(TextModel);

		this.fontName = new StringChoiceInput("FontName", Entity.FONT, -1);
		this.setKeywordDoc(this.fontName, "The font to be used for the text.",
				[ "Arial" ]);
		this.fontName.setChoices(TextModel.validFontNames);
		this.fontName.setDefaultText("TextModel");
		this.addInput(this.fontName);

		this.textHeight = new SampleInput("TextHeight", Entity.FONT, 0.3);
		this.setKeywordDoc(this.textHeight, "The height of the font as displayed in the view window.",
				["15 m"]);
		this.textHeight.setValidRange(0.0, Double.POSITIVE_INFINITY);
		this.textHeight.setUnitType(DistanceUnit);
		this.textHeight.setDefaultText("TextModel");
		this.addInput(this.textHeight);

		this.fontColor = new ColourProvInput("FontColour", Entity.FONT, ColourInput.BLACK);
		this.setKeywordDoc(this.fontColor, "The colour of the text.", []);
		this.fontColor.setDefaultText("TextModel");
		this.addInput(this.fontColor);
		this.addSynonym(this.fontColor, "FontColor");

		this.fontStyle = new StringListInput("FontStyle", Entity.FONT, []);
		this.setKeywordDoc(this.fontStyle, "The font styles to be applied to the text, e.g. Bold, Italic. ",
				[ "Bold" ]);
		this.fontStyle.setValidOptions(TextModel.validStyles);
		this.fontStyle.setCaseSensitive(false);
		this.fontStyle.setDefaultText("TextModel");
		this.addInput(this.fontStyle);

		this.dropShadow = new BooleanProvInput("DropShadow", Entity.FONT, false);
		this.setKeywordDoc(this.dropShadow, "If TRUE, then a drop shadow appears for the text.", []);
		this.dropShadow.setDefaultText("TextModel");
		this.addInput(this.dropShadow);

		this.dropShadowColor = new ColourProvInput("DropShadowColour", Entity.FONT, ColourInput.BLACK);
		this.setKeywordDoc(this.dropShadowColor, "The colour for the drop shadow.", []);
		this.dropShadowColor.setDefaultText("TextModel");
		this.addInput(this.dropShadowColor);
		this.addSynonym(this.dropShadowColor, "DropShadowColor");

		this.dropShadowOffset = new Vec3dInput("DropShadowOffset", Entity.FONT, null);
		this.setKeywordDoc(this.dropShadowOffset, "The { x, y, z } coordinates of the drop shadow's offset, expressed "
		                     + "as a decimal fraction of the text height.",
				[ "0.1 -0.1 0.001" ]);
		this.dropShadowOffset.setDefaultText("TextModel");
		this.addInput(this.dropShadowOffset);

		// ---- Java のコンストラクタの中身 ----
		this.editableText = new EditableTextDelegate();
	}

	setText(str: string): void {
		this.editableText.setText(str);
	}

	getText(): string {
		return this.editableText.getText();
	}

	acceptEdits(): void {
		this.editableText.acceptEdits();
	}

	cancelEdits(): void {
		this.editableText.cancelEdits();
	}

	handleEditKeyPressed(keyCode: number, keyChar: string, shift: boolean, control: boolean, alt: boolean): number {
		if (keyChar === "'") {
			const gui = this.getJaamSimModel().getGUIListener();
			if (gui !== null && gui !== undefined)
				gui.invokeErrorDialogBox(tr("Input Error"), tr(Input.INP_ERR_QUOTE));
			return Editable.CONTINUE_EDITS;
		}
		return this.editableText.handleEditKeyPressed(keyCode, keyChar, shift, control, alt);
	}

	handleEditKeyReleased(keyCode: number, keyChar: string, shift: boolean, control: boolean, alt: boolean): number {
		return this.editableText.handleEditKeyReleased(keyCode, keyChar, shift, control, alt);
	}

	setInsertPosition(pos: number, shift: boolean): void {
		this.editableText.setInsertPosition(pos, shift);
	}

	selectPresentWord(): void {
		this.editableText.selectPresentWord();
	}

	override handleKeyPressed(keyCode: number, keyChar: string, shift: boolean, control: boolean, alt: boolean): boolean {

		// If F2 is pressed, set edit mode
		if (keyCode === KeyEvent.VK_F2) {
			this.setEditMode(true);
			// 描画: 省略（RenderManager.redraw()）
			return true;
		}

		// If not in edit mode, apply the normal action for the keystroke
		if (!this.isEditMode()) {
			const ret = super.handleKeyPressed(keyCode, keyChar, shift, control, alt);
			return ret;
		}

		// If in edit mode, the apply the keystroke to the text
		const result = this.handleEditKeyPressed(keyCode, keyChar, shift, control, alt);
		if (result === Editable.ACCEPT_EDITS) {
			this.acceptEdits();
		}
		else if (result === Editable.CANCEL_EDITS) {
			this.cancelEdits();
		}
		// 描画: 省略（RenderManager.redraw()）
		return true;
	}

	override handleKeyReleased(keyCode: number, keyChar: string, shift: boolean, control: boolean, alt: boolean): void {
		if (this.isEditMode()) {
			this.handleEditKeyReleased(keyCode, keyChar, shift, control, alt);
			return;
		}
		super.handleKeyReleased(keyCode, keyChar, shift, control, alt);
	}

	override handleMouseClicked(count: number, globalCoord: Vec3d,
			shift: boolean, control: boolean, alt: boolean): void {
		if (count > 2)
			return;

		// Double click starts edit mode
		if (!this.isEditMode() && count === 2) {
			this.setEditMode(true);
		}

		if (!this.isEditMode())
			return;

		// Position the insertion point where the text was clicked
		const pos = this.getStringPosition(globalCoord);
		this.editableText.setInsertPosition(pos, shift);

		// Double click selects a whole word
		if (count === 2)
			this.editableText.selectPresentWord();
	}

	override handleDrag(currentPt: Vec3d, firstPt: Vec3d): boolean {
		if (!this.isEditMode())
			return false;

		// Set the start and end of highlighting
		const insertPos = this.getStringPosition(currentPt);
		const firstPos = this.getStringPosition(firstPt);
		this.editableText.setInsertPosition(insertPos, false);
		this.editableText.setNumberSelected(firstPos - insertPos);
		return true;
	}

	override handleSelectionLost(): void {
		if (this.isEditMode()) {
			this.acceptEdits();
		}
	}

	getCachedText(): string {
		return this.getText();
	}

	/**
	 * Returns the insert position in the present text that corresponds to the specified global
	 * coordinate. Index 0 is located immediately before the first character in the text.
	 * 描画: 文字の大きさを測る関数（TextBasics.fontMetrics）が無ければ 0 を返す。
	 * @param globalCoord - position in the global coordinate system
	 * @return insert position in the text string
	 */
	getStringPosition(globalCoord: Vec3d): number {
		const metrics = TextBasics.fontMetrics;
		if (metrics === null)
			return 0;
		const height = this.getTextHeight(0.0);
		const fontKey = this.getTessFontKey();

		// Set up the transformation from global coordinates to the entity's coordinates
		const textsize = metrics.getRenderedStringSize(fontKey, height, this.getText());
		const trans = this.getEntityTransForSize(textsize);

		// Calculate the entity's coordinates for the mouse click
		const entityCoord = new Vec3d();
		trans.multAndTrans(globalCoord, entityCoord);

		// Position the insertion point where the text was clicked
		const x = entityCoord.x + 0.5*textsize.x;
		const y = entityCoord.y - 0.5*textsize.y;
		const pos = metrics.getRenderedStringPosition(fontKey, height, this.getText(), x, y);
		return pos;
	}

	/** 描画: 文字の大きさを測る関数（TextBasics.fontMetrics）が無ければ (0, 0, 0) を返す */
	getTextSize(fontName: string, style: number, textHeight: number): Vec3d {
		const fontKey: TessFontKey = { fontName, style };
		const metrics = TextBasics.fontMetrics;
		if (metrics === null)
			return new Vec3d();  // TODO(移植): 描画が無いときの値。Java では RenderManager が無いと誤りになる
		return metrics.getRenderedStringSize(fontKey, textHeight, this.getText());
	}

	getAutoSize(fontName: string, style: number, textHeight: number): Vec3d {
		let ret = this.getTextSize(fontName, style, textHeight);
		ret.x += textHeight;
		ret.y += textHeight;
		ret.z = 1.0;
		if (this.getSimulation().isSnapToGrid())
			ret = this.getSimulation().getSnapGridPosition(ret);
		return ret;
	}

	resizeForText(): void {
		// Java: if (!RenderManager.isGood()) return;
		if (TextBasics.fontMetrics === null)
			return;
		const newSize = this.getAutoSize(this.getFontName(), this.getStyle(), this.getTextHeight(0.0));
		InputAgent.applyVec3d(this, "Size", newSize, DistanceUnit);
	}

	isEditMode(): boolean {
		return this.editableText.isEditMode();
	}

	setEditMode(bool: boolean): void {
		this.editableText.setEditMode(bool);
	}

	getInsertPosition(): number {
		return this.editableText.getInsertPosition();
	}

	getNumberSelected(): number {
		return this.editableText.getNumberSelected();
	}

	copyToClipboard(): void {
		this.editableText.copyToClipboard();
	}

	pasteFromClipboard(): void {
		this.editableText.pasteFromClipboard();
	}

	deleteSelection(): void {
		this.editableText.deleteSelection();
	}

	getTextModel(): TextModel {
		return this.getDisplayModel(TextModel)!;
	}

	isDefault(): boolean {
		return this.fontName.isDefault() && this.textHeight.isDefault() && this.fontStyle.isDefault()
				&& this.fontColor.isDefault() && this.dropShadow.isDefault() && this.dropShadowColor.isDefault()
				&& this.dropShadowOffset.isDefault();
	}

	getFontName(): string {
		if (this.fontName.isDefault()) {
			return this.getTextModel().getFontName();
		}
		return this.fontName.getChoice();
	}

	getTextHeight(simTime: number): number {
		if (this.textHeight.isDefault()) {
			return this.getTextModel().getTextHeight(simTime);
		}
		return this.textHeight.getNextSample(this, simTime);
	}

	getTextHeightString(): string {
		if (this.textHeight.isDefault()) {
			return this.getTextModel().getTextHeightString();
		}
		return this.textHeight.getValueString();
	}

	getStyle(): number {
		if (this.fontStyle.isDefault()) {
			return this.getTextModel().getStyle();
		}
		return TextModel.getStyle(this.fontStyle.getValue()!);
	}

	isBold(): boolean {
		return TextModel.isBold(this.getStyle());
	}

	isItalic(): boolean {
		return TextModel.isItalic(this.getStyle());
	}

	getTessFontKey(): TessFontKey {
		return { fontName: this.getFontName(), style: this.getStyle() };
	}

	getFontColor(simTime: number): Color4d {
		if (this.fontColor.isDefault()) {
			return this.getTextModel().getFontColor(simTime);
		}
		return this.fontColor.getNextColour(this, simTime);
	}

	isDropShadow(simTime: number): boolean {
		if (this.dropShadow.isDefault()) {
			return this.getTextModel().isDropShadow(simTime);
		}
		return this.dropShadow.getNextBoolean(this, simTime);
	}

	getDropShadowColor(simTime: number): Color4d {
		if (this.dropShadowColor.isDefault()) {
			return this.getTextModel().getDropShadowColor(simTime);
		}
		return this.dropShadowColor.getNextColour(this, simTime);
	}

	getDropShadowOffset(): Vec3d {
		if (this.dropShadowOffset.isDefault()) {
			return this.getTextModel().getDropShadowOffset();
		}
		return this.dropShadowOffset.getValue()!;
	}

	override canLabel(): boolean {
		return false;
	}

}

LateClasses.bind("com.jaamsim.Graphics.TextBasics", TextBasics);
