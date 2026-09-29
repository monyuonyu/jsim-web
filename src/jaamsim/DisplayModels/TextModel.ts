//@@HEADER@@
import { BooleanProvInput } from "../BooleanProviders/BooleanProvInput.ts";
import { ColourProvInput } from "../ColourProviders/ColourProvInput.ts";
import type { EntityLabel } from "../Graphics/EntityLabel.ts";
import { LateClasses, jint } from "../Graphics/LateClasses.ts";
import type { TextEntity } from "../Graphics/TextEntity.ts";
import { SampleInput } from "../Samples/SampleInput.ts";
import { Entity } from "../basicsim/Entity.ts";
import { ColourInput } from "../input/ColourInput.ts";
import type { Input } from "../input/Input.ts";
import type { InputCallback } from "../input/InputCallback.ts";
import { StringChoiceInput } from "../input/StringChoiceInput.ts";
import { StringListInput } from "../input/StringListInput.ts";
import { Vec3dInput } from "../input/Vec3dInput.ts";
import { ClassRegistry } from "../java/ClassRegistry.ts";
import { Double, jCompare, jEqualsIgnoreCase } from "../java/lang.ts";
import type { Color4d } from "../math/Color4d.ts";
import { Vec3d } from "../math/Vec3d.ts";
import { DistanceUnit } from "../units/DistanceUnit.ts";
import { AbstractShapeModel } from "./AbstractShapeModel.ts";

/*
 * 移植の注意:
 * - java.awt.Font の PLAIN・BOLD・ITALIC は、このファイルの Font に写した（値は Java と同じ 0・1・2）。
 * - validFontNames は、Java では動かしている機械の字体の一覧（GraphicsEnvironment）を並べたもの。
 *   ブラウザでは字体の一覧を得られないので、よく使われる字体の決まった一覧にした（Java と同じく並べ替える）。
 *   TODO(移植): 一覧に無い字体の名前がモデルのファイルにあると、Java と同じく入力の誤りになる。
 * - render.TessFontKey は描画の部品なので、中身（字体の名前と飾り）だけの TessFontKey 型にした。
 * - 描画: 省略（three.js の画面を作るときに）。入れ子のクラス Binding（空間の中の文字）・OverlayBinding
 *   （画面に重ねる文字）・BillboardBinding（いつも正面を向く文字）は移さない。要点は docs/todo-F.md に書いた。
 */

/** java.awt.Font の定数の写し */
export const Font = {
	PLAIN: 0,
	BOLD: 1,
	ITALIC: 2,
};

/** render.TessFontKey の中身（描画: three.js の画面を作るときに、字体を選ぶのに使う） */
export interface TessFontKey {
	fontName: string;
	style: number;
}

/** 字体の一覧（Java の GraphicsEnvironment.getAvailableFontFamilyNames の代わり） */
const FONT_NAMES: string[] = [
	"Arial", "Arial Black", "Arial Narrow", "Book Antiqua", "Bookman Old Style", "Calibri",
	"Cambria", "Candara", "Century Gothic", "Comic Sans MS", "Consolas", "Constantia", "Corbel",
	"Courier", "Courier New", "DejaVu Sans", "DejaVu Sans Mono", "DejaVu Serif", "Dialog",
	"DialogInput", "Franklin Gothic Medium", "Garamond", "Georgia", "Helvetica", "Impact",
	"Liberation Mono", "Liberation Sans", "Liberation Serif", "Lucida Console", "Lucida Sans",
	"Lucida Sans Unicode", "MS Gothic", "MS Mincho", "MS PGothic", "MS PMincho", "Meiryo",
	"Monospaced", "Noto Sans", "Noto Sans CJK JP", "Noto Sans JP", "Noto Serif", "Noto Serif JP",
	"Palatino Linotype", "SansSerif", "Segoe UI", "Serif", "Tahoma", "Times New Roman",
	"Trebuchet MS", "Verdana", "Yu Gothic", "Yu Mincho",
];

const TEXT_BASICS = "com.jaamsim.Graphics.TextBasics";
const OVERLAY_TEXT = "com.jaamsim.Graphics.OverlayText";
const ENTITY_LABEL = "com.jaamsim.Graphics.EntityLabel";

export class TextModel extends AbstractShapeModel implements TextEntity {

	private readonly fontName: StringChoiceInput;

	protected readonly textHeight: SampleInput;

	protected readonly textHeightInPixels: SampleInput;

	private readonly fontStyle: StringListInput;

	private readonly fontColor: ColourProvInput;

	private readonly dropShadow: BooleanProvInput;

	private readonly dropShadowColor: ColourProvInput;

	private readonly dropShadowOffset: Vec3dInput;

	private style: number; // Font Style

	private static readonly defFont: number;
	static readonly validFontNames: string[];
	static readonly validStyles: string[];

	static {
		const fontNames = [...FONT_NAMES];
		fontNames.sort(jCompare);
		(TextModel as { validFontNames: string[] }).validFontNames = [...fontNames];
		const def = TextModel.validFontNames.indexOf("Verdana");
		if (def > -1)
			(TextModel as unknown as { defFont: number }).defFont = def;
		else
			(TextModel as unknown as { defFont: number }).defFont = 0;

		(TextModel as { validStyles: string[] }).validStyles = [];
		TextModel.validStyles.push("BOLD");
		TextModel.validStyles.push("ITALIC");
	}

	constructor() {
		super();

		// ---- Java の初期化ブロック ----
		this.fontName = new StringChoiceInput("FontName", Entity.KEY_INPUTS, TextModel.defFont);
		this.setKeywordDoc(this.fontName, "The font to be used for the text.",
				[ "Arial" ]);
		this.fontName.setChoices(TextModel.validFontNames);
		this.addInput(this.fontName);

		this.textHeight = new SampleInput("TextHeight", Entity.KEY_INPUTS, 0.3);
		this.setKeywordDoc(this.textHeight, "The height of the text as displayed in the view window.",
				["15 m"]);
		this.textHeight.setValidRange(0.0, Double.POSITIVE_INFINITY);
		this.textHeight.setUnitType(DistanceUnit);
		this.textHeight.setCallback(TextModel.textheightCallback);
		this.addInput(this.textHeight);

		this.textHeightInPixels = new SampleInput("TextHeightInPixels", Entity.KEY_INPUTS, 10);
		this.setKeywordDoc(this.textHeightInPixels, "The height of the text in pixels, used by billboard text and "
		                     + "overlay text.",
				["15"]);
		this.textHeightInPixels.setValidRange(0, Double.POSITIVE_INFINITY);
		this.textHeightInPixels.setIntegerValue(true);
		this.addInput(this.textHeightInPixels);

		this.fontColor = new ColourProvInput("FontColour", Entity.KEY_INPUTS, ColourInput.BLACK);
		this.setKeywordDoc(this.fontColor, "The colour of the text.", []);
		this.addInput(this.fontColor);
		this.addSynonym(this.fontColor, "FontColor");

		this.fontStyle = new StringListInput("FontStyle", Entity.KEY_INPUTS, []);
		this.setKeywordDoc(this.fontStyle, "The font styles to be applied to the text, e.g. Bold, Italic. ",
				[ "Bold" ]);
		this.fontStyle.setValidOptions(TextModel.validStyles);
		this.fontStyle.setCaseSensitive(false);
		this.fontStyle.setCallback(TextModel.fontstyleCallback);
		this.addInput(this.fontStyle);

		this.dropShadow = new BooleanProvInput("DropShadow", Entity.KEY_INPUTS, false);
		this.setKeywordDoc(this.dropShadow, "If TRUE, then a drop shadow appears for the text.", []);
		this.addInput(this.dropShadow);

		this.dropShadowColor = new ColourProvInput("DropShadowColour", Entity.KEY_INPUTS, ColourInput.BLACK);
		this.setKeywordDoc(this.dropShadowColor, "The colour for the drop shadow", []);
		this.addInput(this.dropShadowColor);
		this.addSynonym(this.dropShadowColor, "DropShadowColor");

		this.dropShadowOffset = new Vec3dInput("DropShadowOffset", Entity.KEY_INPUTS, new Vec3d(-0.1, -0.1, -0.001));
		this.setKeywordDoc(this.dropShadowOffset, "The { x, y, z } coordinates of the drop shadow's offset, expressed "
		                     + "as a decimal fraction of the text height.",
				[ "0.1 -0.1 0.001" ]);
		this.addInput(this.dropShadowOffset);

		this.style = Font.PLAIN;
	}

	static readonly fontstyleCallback: InputCallback = {
		callback(ent: Entity, inp: Input<unknown>): void {
			(ent as TextModel).updatefontstyle();
		},
	} as InputCallback;

	updatefontstyle(): void {
		this.style = TextModel.getStyle(this.fontStyle.getValue());
	}

	static readonly textheightCallback: InputCallback = {
		callback(ent: Entity, inp: Input<unknown>): void {
			(ent as TextModel).updatetextheight();
		},
	} as InputCallback;

	updatetextheight(): void {
		const cls = LateClasses.get<EntityLabel>(ENTITY_LABEL);
		for (const text of this.getJaamSimModel().getClonesOfIterator(cls)) {
			if (text.getDisplayModelList()[0] === this) {
				text.resizeForText();
			}
		}
	}

	/**
	 * Java の static getStyle(ArrayList<String>) と、TextEntity の getStyle()。
	 * static の方はクラスから、引数の無い方は個々の物から呼ぶ（名前は同じまま）。
	 */
	static getStyle(strArray: string[]): number {
		let ret = Font.PLAIN;
		for (const each of strArray ) {
			if (jEqualsIgnoreCase(each, "Bold") ) {
				ret += Font.BOLD;
			}
			else if (jEqualsIgnoreCase(each, "Italic")) {
				ret += Font.ITALIC;
			}
		}
		return ret;
	}

	/** Java の static isBold(int style) と、TextEntity の isBold()（static の方はクラスから呼ぶ） */
	static isBold(style: number): boolean {
		return (style & Font.BOLD) !== 0;
	}

	/** Java の static isItalic(int style) と、TextEntity の isItalic()（static の方はクラスから呼ぶ） */
	static isItalic(style: number): boolean {
		return (style & Font.ITALIC) !== 0;
	}

	/**
	 * 描画: 省略（three.js の画面を作るときに）。
	 * Java は BillboardText なら BillboardBinding、TextBasics なら Binding、OverlayText なら OverlayBinding を返す。
	 */
	override getBinding(ent: Entity): object | null {
		return null;
	}

	override canDisplayEntity(ent: Entity): boolean {
		return LateClasses.isInstance(ent, TEXT_BASICS) || LateClasses.isInstance(ent, OVERLAY_TEXT);
	}

	getTessFontKey(): TessFontKey {
		return { fontName: this.fontName.getChoice(), style: this.style };
	}

	static getDefaultTessFontKey(): TessFontKey {
		return { fontName: "Verdana", style: Font.PLAIN };
	}

	getFontColor(simTime: number): Color4d {
		return this.fontColor.getNextColour(this, simTime);
	}

	getTextHeight(simTime: number): number {
		return this.textHeight.getNextSample(this, simTime);
	}

	getTextHeightInPixels(simTime: number): number {
		return jint(this.textHeightInPixels.getNextSample(this, simTime));
	}

	getTextHeightString(): string {
		if (this.textHeight.isDefault())
			return this.textHeight.getDefaultString(this.getJaamSimModel());
		return this.textHeight.getValueString();
	}

	getTextHeightInPixelsString(): string {
		if (this.textHeightInPixels.isDefault())
			return this.textHeightInPixels.getDefaultString(this.getJaamSimModel());
		return this.textHeightInPixels.getValueString();
	}

	getFontName(): string {
		return this.fontName.getChoice();
	}

	/** TextEntity の getStyle()（static の getStyle(ArrayList<String>) とは別） */
	getStyle(): number {
		return TextModel.getStyle(this.fontStyle.getValue());
	}

	/** TextEntity の isBold()（static の isBold(int) とは別） */
	isBold(): boolean {
		return TextModel.isBold(this.getStyle());
	}

	/** TextEntity の isItalic()（static の isItalic(int) とは別） */
	isItalic(): boolean {
		return TextModel.isItalic(this.getStyle());
	}

	isDropShadow(simTime: number): boolean {
		return this.dropShadow.getNextBoolean(this, simTime);
	}

	getDropShadowColor(simTime: number): Color4d {
		return this.dropShadowColor.getNextColour(this, simTime);
	}

	getDropShadowOffset(): Vec3d {
		return this.dropShadowOffset.getValue();
	}

}

ClassRegistry.register("com.jaamsim.DisplayModels.TextModel", TextModel);
LateClasses.bind("com.jaamsim.DisplayModels.TextModel", TextModel);
