/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2011 Ausenco Engineering Canada Inc.
 * Copyright (C) 2018-2021 JaamSim Software Inc.
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
 *
 * TypeScript への移植 (C) 2026 shota
 */
// 注（移植）:
// - Java の static の色の定数（WHITE など）と色の名前の表は、循環 import（Color4d ⇔ ColourInput ⇔ Input）で
//   クラスの定義の時に Color4d がまだ無いことがあるので、初めて使うときに作る（定数は static の getter、表は ensureInit）。
//   Java の static の初期化も初めてクラスを使うときに行われるので、結果は同じ。
// - HashMap<Color4d, String>（colorNameMap）は、Color4d の equals（4 つの成分が ==）と同じになるよう、
//   成分を並べた文字列をキーにした Map にした。
// - Comparator（colourComparator・luminosityComparator）は、Input.uiSortOrder と同じく compare(a, b) を持つ物にした。
// - static の toString(Color4d) と、インスタンスの toString() は、名前をそのまま残した（static と instance で別の物）。
import { Double } from "../java/lang.ts";
import { tr } from "../i18n/I18n.ts";
import type { Entity } from "../basicsim/Entity.ts";
import type { JaamSimModel } from "../basicsim/JaamSimModel.ts";
import { Color4d } from "../math/Color4d.ts";
import { Input } from "./Input.ts";
import type { KeywordIndex } from "./KeywordIndex.ts";

/** Color4d の equals（r, g, b, a が ==）と同じ意味の、Map のキー */
function colorKey(col: Color4d): string {
	return col.r + "," + col.g + "," + col.b + "," + col.a;
}

export class ColourInput extends Input<Color4d> {

	private static _WHITE: Color4d | null = null;
	private static _BLACK: Color4d | null = null;
	private static _RED: Color4d | null = null;
	private static _GREEN: Color4d | null = null;
	private static _BLUE: Color4d | null = null;
	private static _CYAN: Color4d | null = null;
	private static _YELLOW: Color4d | null = null;
	private static _PURPLE: Color4d | null = null;
	private static _LIGHT_GREY: Color4d | null = null;
	private static _MED_GREY: Color4d | null = null;
	private static _DARK_RED: Color4d | null = null;
	private static _DARK_GREEN: Color4d | null = null;
	private static _DARK_BLUE: Color4d | null = null;
	private static _DARK_CYAN: Color4d | null = null;
	private static _DARK_YELLOW: Color4d | null = null;
	private static _DARK_PURPLE: Color4d | null = null;

	static get WHITE(): Color4d       { return ColourInput._WHITE       ??= Color4d.fromInts(255, 255, 255); }
	static get BLACK(): Color4d       { return ColourInput._BLACK       ??= Color4d.fromInts(  0,   0,   0); }
	static get RED(): Color4d         { return ColourInput._RED         ??= Color4d.fromInts(255,   0,   0); }
	static get GREEN(): Color4d       { return ColourInput._GREEN       ??= Color4d.fromInts(  0, 255,   0); }
	static get BLUE(): Color4d        { return ColourInput._BLUE        ??= Color4d.fromInts(  0,   0, 255); }
	static get CYAN(): Color4d        { return ColourInput._CYAN        ??= Color4d.fromInts(  0, 255, 255); }
	static get YELLOW(): Color4d      { return ColourInput._YELLOW      ??= Color4d.fromInts(255, 255,   0); }
	static get PURPLE(): Color4d      { return ColourInput._PURPLE      ??= Color4d.fromInts(255,   0, 255); }
	static get LIGHT_GREY(): Color4d  { return ColourInput._LIGHT_GREY  ??= Color4d.fromInts(191, 191, 191); }
	static get MED_GREY(): Color4d    { return ColourInput._MED_GREY    ??= Color4d.fromInts(128, 128, 128); }
	static get DARK_RED(): Color4d    { return ColourInput._DARK_RED    ??= Color4d.fromInts(191,   0,   0); }
	static get DARK_GREEN(): Color4d  { return ColourInput._DARK_GREEN  ??= Color4d.fromInts(  0, 191,   0); }
	static get DARK_BLUE(): Color4d   { return ColourInput._DARK_BLUE   ??= Color4d.fromInts(  0,   0, 191); }
	static get DARK_CYAN(): Color4d   { return ColourInput._DARK_CYAN   ??= Color4d.fromInts(  0, 191, 191); }
	static get DARK_YELLOW(): Color4d { return ColourInput._DARK_YELLOW ??= Color4d.fromInts(191, 191,   0); }
	static get DARK_PURPLE(): Color4d { return ColourInput._DARK_PURPLE ??= Color4d.fromInts(191,   0, 191); }

	private static readonly colorMap = new Map<string, Color4d>();
	private static readonly colorNameMap = new Map<string, string>();  // キーは colorKey(Color4d)
	private static readonly colorFamilyMap = new Map<string, string[]>();
	private static initialized = false;

	private static readonly colorFamilies: string[] = ["Pink", "Red", "Orange", "Yellow",
			"Brown", "Green", "Cyan", "Blue", "Purple", "White", "Black"];

	static readonly colourComparator = {
		compare(col1: Color4d | null, col2: Color4d | null): number {
			const str1 = ColourInput.toString(col1);
			const str2 = ColourInput.toString(col2);
			return Input.uiSortOrder.compare(str1, str2);
		},
	};

	static readonly luminosityComparator = {
		compare(name1: string, name2: string): number {
			const col1 = ColourInput.getColorWithName(name1) as Color4d;
			const col2 = ColourInput.getColorWithName(name2) as Color4d;
			const lum1 = 0.2126*col1.r + 0.7152*col1.g + 0.0722*col1.b;
			const lum2 = 0.2126*col2.r + 0.7152*col2.g + 0.0722*col2.b;
			return Double.compare(lum2, lum1);  // from light to dark
		},
	};

	/** Java の static { ... }（初めて表を使うときに 1 回だけ行う） */
	private static ensureInit(): void {
		if (ColourInput.initialized)
			return;
		ColourInput.initialized = true;

		for (const family of ColourInput.colorFamilies) {
			ColourInput.colorFamilyMap.set(family, []);
		}

		ColourInput.initColors();

		for (const family of ColourInput.colorFamilies) {
			const list = ColourInput.colorFamilyMap.get(family) as string[];
			list.sort((a, b) => ColourInput.luminosityComparator.compare(a, b));
		}
	}

	constructor(key: string, cat: string, def: Color4d | null) {
		super(key, cat, def);
	}

	/** @throws InputErrorException */
	override parse(thisEnt: Entity, kw: KeywordIndex): void {
		this.value = Input.parseColour(thisEnt.getJaamSimModel(), kw);
	}

	override getValidInputDesc(): string {
		return tr(Input.VALID_COLOUR);
	}

	static getColorWithName(colorName: string): Color4d | null {
		ColourInput.ensureInit();
		return ColourInput.colorMap.get(colorName.toLowerCase()) ?? null;
	}

	static getColorName(col: Color4d): string | null {
		ColourInput.ensureInit();
		return ColourInput.colorNameMap.get(colorKey(col)) ?? null;
	}

	static getColorFamilies(): string[] {
		return ColourInput.colorFamilies;
	}

	static getColorListForFamily(family: string): string[] | null {
		ColourInput.ensureInit();
		return ColourInput.colorFamilyMap.get(family) ?? null;
	}

	private static defColor(colorName: string, family: string, r: number, g: number, b: number): void {
		ColourInput.mapColor(colorName, family, Color4d.fromInts(r, g, b, 255));
	}

	private static mapColor(colorName: string, family: string, col: Color4d): void {
		const name = colorName.toLowerCase();
		const prev = ColourInput.colorMap.get(name);
		ColourInput.colorMap.set(name, col);
		if (prev !== undefined)
			console.log(`ColorName added twice: ${colorName} `);

		const key = colorKey(col);
		if (!ColourInput.colorNameMap.has(key)) {
			ColourInput.colorNameMap.set(key, colorName);
		}

		const list = ColourInput.colorFamilyMap.get(family);
		if (list === undefined) {
			console.log(`Invalid color family: ${family}`);
			return;
		}
		list.push(colorName);
	}

	private static initColors(): void {

		// Pink colours
		ColourInput.defColor("Pink",            "Pink", 255, 192, 203);
		ColourInput.defColor("LightPink",       "Pink", 255, 182, 193);
		ColourInput.defColor("HotPink",         "Pink", 255, 105, 180);
		ColourInput.defColor("DeepPink",        "Pink", 255,  20, 147);
		ColourInput.defColor("PaleVioletRed",   "Pink", 219, 112, 147);
		ColourInput.defColor("MediumVioletRed", "Pink", 199,  21, 133);

		ColourInput.defColor("VioletRed",       "Pink", 247,  83, 148);

		// Red colours
		ColourInput.defColor("LightSalmon", "Red", 255, 160, 122);
		ColourInput.defColor("Salmon",      "Red", 250, 128, 114);
		ColourInput.defColor("DarkSalmon",  "Red", 233, 150, 122);
		ColourInput.defColor("LightCoral",  "Red", 240, 128, 128);
		ColourInput.defColor("IndianRed",   "Red", 205,  92,  92);
		ColourInput.defColor("Crimson",     "Red", 220,  20,  60);
		ColourInput.defColor("FireBrick",   "Red", 178,  34,  34);
		ColourInput.defColor("DarkRed",     "Red", 139,   0,   0);
		ColourInput.defColor("Red",         "Red", 255,   0,   0);  // RED

		// Orange colours
		ColourInput.defColor("OrangeRed",     "Orange", 255,  69,   0);
		ColourInput.defColor("Tomato",        "Orange", 255,  99,  71);
		ColourInput.defColor("Coral",         "Orange", 255, 127,  80);
		ColourInput.defColor("DarkOrange",    "Orange", 255, 140,   0);
		ColourInput.defColor("Orange",        "Orange", 255, 165,   0);

		ColourInput.defColor("Flesh",         "Orange", 255, 125,  64);
		ColourInput.defColor("Carrot",        "Orange", 237, 145,  33);
		ColourInput.defColor("CadmiumOrange", "Orange", 237, 135,  45);

		// Yellow colours
		ColourInput.defColor("Yellow",               "Yellow", 255, 255,   0);  // YELLOW
		ColourInput.defColor("LightYellow",          "Yellow", 255, 255, 224);
		ColourInput.defColor("LemonChiffon",         "Yellow", 255, 250, 205);
		ColourInput.defColor("LightGoldenrodYellow", "Yellow", 250, 250, 210);
		ColourInput.defColor("PapayaWhip",           "Yellow", 255, 239, 213);
		ColourInput.defColor("Moccasin",             "Yellow", 255, 228, 181);
		ColourInput.defColor("PeachPuff",            "Yellow", 255, 218, 185);
		ColourInput.defColor("PaleGoldenrod",        "Yellow", 238, 232, 170);
		ColourInput.defColor("Khaki",                "Yellow", 240, 230, 140);
		ColourInput.defColor("DarkKhaki",            "Yellow", 189, 183, 107);
		ColourInput.defColor("Gold",                 "Yellow", 255, 215,   0);

		ColourInput.defColor("CadmiumYellow",        "Yellow", 255, 246,   0);
		ColourInput.defColor("LightGoldenrod",       "Yellow", 255, 236, 139);
		ColourInput.defColor("Banana",               "Yellow", 255, 255,  53);
		ColourInput.defColor("DarkYellow",           "Yellow", 155, 135,  12);

		// Brown colours
		ColourInput.defColor("Cornsilk",       "Brown", 255, 248, 220);
		ColourInput.defColor("BlanchedAlmond", "Brown", 255, 235, 205);
		ColourInput.defColor("Bisque",         "Brown", 255, 228, 196);
		ColourInput.defColor("NavajoWhite",    "Brown", 255, 222, 173);
		ColourInput.defColor("Wheat",          "Brown", 245, 222, 179);
		ColourInput.defColor("Burlywood",      "Brown", 222, 184, 135);
		ColourInput.defColor("Tan",            "Brown", 210, 180, 140);
		ColourInput.defColor("RosyBrown",      "Brown", 188, 143, 143);
		ColourInput.defColor("SandyBrown",     "Brown", 244, 164,  96);
		ColourInput.defColor("Goldenrod",      "Brown", 218, 165,  32);
		ColourInput.defColor("DarkGoldenrod",  "Brown", 184, 134,  11);
		ColourInput.defColor("Peru",           "Brown", 205, 133,  63);
		ColourInput.defColor("Chocolate",      "Brown", 210, 105,  30);
		ColourInput.defColor("SaddleBrown",    "Brown", 139,  69,  19);
		ColourInput.defColor("Sienna",         "Brown", 160,  82,  45);
		ColourInput.defColor("Brown",          "Brown", 138,  54,  15);
		ColourInput.defColor("Maroon",         "Brown", 128,   0,   0);

		ColourInput.defColor("RawSienna",      "Brown", 199,  97,  20);
		ColourInput.defColor("BurntUmber",     "Brown", 138,  51,  36);
		ColourInput.defColor("Sepia",          "Brown",  94,  38,  18);
		ColourInput.defColor("Brick",          "Brown", 156, 102,  31);
		ColourInput.defColor("Melon",          "Brown", 227, 168, 105);

		// Green colours
		ColourInput.defColor("DarkOliveGreen",    "Green",  85, 107,  47);
		ColourInput.defColor("Olive",             "Green", 128, 128,   0);
		ColourInput.defColor("OliveDrab",         "Green", 107, 142,  35);
		ColourInput.defColor("YellowGreen",       "Green", 154, 205,  50);
		ColourInput.defColor("LimeGreen",         "Green",  50, 205,  50);
		ColourInput.defColor("Lime",              "Green",   0, 255,   0);  // GREEN
		ColourInput.defColor("LawnGreen",         "Green", 124, 252,   0);
		ColourInput.defColor("Chartreuse",        "Green", 127, 255,   0);
		ColourInput.defColor("GreenYellow",       "Green", 173, 255,  47);
		ColourInput.defColor("SpringGreen",       "Green",   0, 255, 127);
		ColourInput.defColor("MediumSpringGreen", "Green",   0, 250, 154);
		ColourInput.defColor("LightGreen",        "Green", 144, 238, 144);
		ColourInput.defColor("PaleGreen",         "Green", 152, 251, 152);
		ColourInput.defColor("DarkSeaGreen",      "Green", 143, 188, 143);
		ColourInput.defColor("MediumAquamarine",  "Green", 102, 205, 170);
		ColourInput.defColor("MediumSeaGreen",    "Green",  60, 179, 113);
		ColourInput.defColor("SeaGreen",          "Green",  46, 139,  87);
		ColourInput.defColor("ForestGreen",       "Green",  34, 139,  34);
		ColourInput.defColor("Green",             "Green",   0, 128,   0);
		ColourInput.defColor("DarkGreen",         "Green",   0, 100,   0);

		ColourInput.defColor("Mint",              "Green", 189, 252, 201);
		ColourInput.defColor("EmeraldGreen",      "Green",   0, 201,  87);
		ColourInput.defColor("CobaltGreen",       "Green",  61, 145,  64);
		ColourInput.defColor("SapGreen",          "Green",  48, 128,  20);

		// Cyan colours
		ColourInput.defColor("Cyan",            "Cyan",   0, 255, 255);  // CYAN
		ColourInput.defColor("Aqua",            "Cyan",   0, 255, 255);  // same as Cyan
		ColourInput.defColor("LightCyan",       "Cyan", 224, 255, 255);
		ColourInput.defColor("PaleTurquoise",   "Cyan", 175, 238, 238);
		ColourInput.defColor("Aquamarine",      "Cyan", 127, 255, 212);
		ColourInput.defColor("Turquoise",       "Cyan",  64, 224, 208);
		ColourInput.defColor("MediumTurquoise", "Cyan",  72, 209, 204);
		ColourInput.defColor("DarkTurquoise",   "Cyan",   0, 206, 209);
		ColourInput.defColor("LightSeaGreen",   "Cyan",  32, 178, 170);
		ColourInput.defColor("CadetBlue",       "Cyan",  95, 158, 160);
		ColourInput.defColor("DarkCyan",        "Cyan",   0, 139, 139);
		ColourInput.defColor("Teal",            "Cyan",   0, 128, 128);

		ColourInput.defColor("ManganeseBlue",   "Cyan",   3, 168, 158);
		ColourInput.defColor("TurquoiseBlue",   "Cyan",   0, 199, 140);

		// Blue colours
		ColourInput.defColor("LightSteelBlue", "Blue", 176, 196, 222);
		ColourInput.defColor("PowderBlue",     "Blue", 176, 224, 230);
		ColourInput.defColor("LightBlue",      "Blue", 173, 216, 230);
		ColourInput.defColor("SkyBlue",        "Blue", 135, 206, 235);
		ColourInput.defColor("LightSkyBlue",   "Blue", 135, 206, 250);
		ColourInput.defColor("DeepSkyBlue",    "Blue",   0, 191, 255);
		ColourInput.defColor("DodgerBlue",     "Blue",  30, 144, 255);
		ColourInput.defColor("CornflowerBlue", "Blue", 100, 149, 237);
		ColourInput.defColor("SteelBlue",      "Blue",  70, 130, 180);
		ColourInput.defColor("RoyalBlue",      "Blue",  65, 105, 225);
		ColourInput.defColor("Blue",           "Blue",   0,   0, 255);  // BLUE
		ColourInput.defColor("MediumBlue",     "Blue",   0,   0, 205);
		ColourInput.defColor("DarkBlue",       "Blue",   0,   0, 139);
		ColourInput.defColor("Navy",           "Blue",   0,   0, 128);
		ColourInput.defColor("MidnightBlue",   "Blue",  25,  25, 112);

		ColourInput.defColor("Cobalt",         "Blue",  61,  89, 171);
		ColourInput.defColor("Peacock",        "Blue",  51, 161, 201);

		// Purple, violet, and magenta colours
		ColourInput.defColor("Lavender",        "Purple", 230, 230, 250);
		ColourInput.defColor("Thistle",         "Purple", 216, 191, 216);
		ColourInput.defColor("Plum",            "Purple", 221, 160, 221);
		ColourInput.defColor("Violet",          "Purple", 238, 130, 238);
		ColourInput.defColor("Orchid",          "Purple", 218, 112, 214);
		ColourInput.defColor("Magenta",         "Purple", 255,   0, 255);
		ColourInput.defColor("Fuchsia",         "Purple", 255,   0, 255);  // same as Magenta
		ColourInput.defColor("MediumOrchid",    "Purple", 186,  85, 211);
		ColourInput.defColor("MediumPurple",    "Purple", 147, 112, 219);
		ColourInput.defColor("BlueViolet",      "Purple", 138,  43, 226);
		ColourInput.defColor("DarkViolet",      "Purple", 148,   0, 211);
		ColourInput.defColor("DarkOrchid",      "Purple", 153,  50, 204);
		ColourInput.defColor("DarkMagenta",     "Purple", 139,   0, 139);
		ColourInput.defColor("Purple",          "Purple", 128,   0, 128);
		ColourInput.defColor("Indigo",          "Purple",  75,   0, 130);
		ColourInput.defColor("DarkSlateBlue",   "Purple",  72,  61, 139);
		ColourInput.defColor("SlateBlue",       "Purple", 106,  90, 205);
		ColourInput.defColor("MediumSlateBlue", "Purple", 123, 104, 238);

		ColourInput.defColor("DarkPurple",      "Purple", 191,   0, 191);  // DARK_PURPLE
		ColourInput.defColor("Raspberry",       "Purple", 135,  38,  87);
		ColourInput.defColor("LightSlateBlue",  "Purple", 132, 112, 255);

		// White colours
		ColourInput.defColor("White",         "White", 255, 255, 255);  // WHITE
		ColourInput.defColor("Snow",          "White", 255, 250, 250);
		ColourInput.defColor("Honeydew",      "White", 240, 255, 240);
		ColourInput.defColor("MintCream",     "White", 245, 255, 250);
		ColourInput.defColor("Azure",         "White", 240, 255, 255);
		ColourInput.defColor("AliceBlue",     "White", 240, 248, 255);
		ColourInput.defColor("GhostWhite",    "White", 248, 248, 255);
		ColourInput.defColor("WhiteSmoke",    "White", 245, 245, 245);
		ColourInput.defColor("Seashell",      "White", 255, 245, 238);
		ColourInput.defColor("Beige",         "White", 245, 245, 220);
		ColourInput.defColor("OldLace",       "White", 253, 245, 230);
		ColourInput.defColor("FloralWhite",   "White", 255, 250, 240);
		ColourInput.defColor("Ivory",         "White", 255, 255, 240);
		ColourInput.defColor("AntiqueWhite",  "White", 250, 235, 215);
		ColourInput.defColor("Linen",         "White", 250, 240, 230);
		ColourInput.defColor("LavenderBlush", "White", 255, 240, 245);
		ColourInput.defColor("MistyRose",     "White", 255, 228, 225);

		ColourInput.defColor("EggShell",      "White", 240, 234, 214);

		// Grey and black colours
		ColourInput.defColor("Gainsboro",      "Black", 220, 220, 220);
		ColourInput.defColor("LightGray",      "Black", 211, 211, 211);
		ColourInput.defColor("Silver",         "Black", 192, 192, 192);
		ColourInput.defColor("DarkGray",       "Black", 169, 169, 169);
		ColourInput.defColor("Gray",           "Black", 128, 128, 128);  // MED_GREY
		ColourInput.defColor("DimGray",        "Black", 105, 105, 105);
		ColourInput.defColor("LightSlateGray", "Black", 119, 136, 153);
		ColourInput.defColor("SlateGray",      "Black", 112, 128, 144);
		ColourInput.defColor("DarkSlateGray",  "Black",  47,  79,  79);
		ColourInput.defColor("Black",          "Black",   0,   0,   0);  // BLACK

		ColourInput.defColor("gray99",         "Black", 252, 252, 252);
		ColourInput.defColor("gray98",         "Black", 250, 250, 250);
		ColourInput.defColor("gray97",         "Black", 247, 247, 247);
		ColourInput.defColor("gray96",         "Black", 245, 245, 245);
		ColourInput.defColor("gray95",         "Black", 242, 242, 242);
		ColourInput.defColor("gray94",         "Black", 240, 240, 240);
		ColourInput.defColor("gray93",         "Black", 237, 237, 237);
		ColourInput.defColor("gray92",         "Black", 235, 235, 235);
		ColourInput.defColor("gray91",         "Black", 232, 232, 232);
		ColourInput.defColor("gray90",         "Black", 229, 229, 229);
		ColourInput.defColor("gray89",         "Black", 227, 227, 227);
		ColourInput.defColor("gray88",         "Black", 224, 224, 224);
		ColourInput.defColor("gray87",         "Black", 222, 222, 222);
		ColourInput.defColor("gray86",         "Black", 219, 219, 219);
		ColourInput.defColor("gray85",         "Black", 217, 217, 217);
		ColourInput.defColor("gray84",         "Black", 214, 214, 214);
		ColourInput.defColor("gray83",         "Black", 212, 212, 212);
		ColourInput.defColor("gray82",         "Black", 209, 209, 209);
		ColourInput.defColor("gray81",         "Black", 207, 207, 207);
		ColourInput.defColor("gray80",         "Black", 204, 204, 204);
		ColourInput.defColor("gray79",         "Black", 201, 201, 201);
		ColourInput.defColor("gray78",         "Black", 199, 199, 199);
		ColourInput.defColor("gray77",         "Black", 196, 196, 196);
		ColourInput.defColor("gray76",         "Black", 194, 194, 194);
		ColourInput.defColor("gray75",         "Black", 191, 191, 191);  // LIGHT_GREY
		ColourInput.defColor("gray74",         "Black", 189, 189, 189);
		ColourInput.defColor("gray73",         "Black", 186, 186, 186);
		ColourInput.defColor("gray72",         "Black", 184, 184, 184);
		ColourInput.defColor("gray71",         "Black", 181, 181, 181);
		ColourInput.defColor("gray70",         "Black", 179, 179, 179);
		ColourInput.defColor("gray69",         "Black", 176, 176, 176);
		ColourInput.defColor("gray68",         "Black", 173, 173, 173);
		ColourInput.defColor("gray67",         "Black", 171, 171, 171);
		ColourInput.defColor("gray66",         "Black", 168, 168, 168);
		ColourInput.defColor("gray65",         "Black", 166, 166, 166);
		ColourInput.defColor("gray64",         "Black", 163, 163, 163);
		ColourInput.defColor("gray63",         "Black", 161, 161, 161);
		ColourInput.defColor("gray62",         "Black", 158, 158, 158);
		ColourInput.defColor("gray61",         "Black", 156, 156, 156);
		ColourInput.defColor("gray60",         "Black", 153, 153, 153);
		ColourInput.defColor("gray59",         "Black", 150, 150, 150);
		ColourInput.defColor("gray58",         "Black", 148, 148, 148);
		ColourInput.defColor("gray57",         "Black", 145, 145, 145);
		ColourInput.defColor("gray56",         "Black", 143, 143, 143);
		ColourInput.defColor("gray55",         "Black", 140, 140, 140);
		ColourInput.defColor("gray54",         "Black", 138, 138, 138);
		ColourInput.defColor("gray53",         "Black", 135, 135, 135);
		ColourInput.defColor("gray52",         "Black", 133, 133, 133);
		ColourInput.defColor("gray51",         "Black", 130, 130, 130);
		ColourInput.defColor("gray50",         "Black", 128, 128, 128);  // MED_GREY
		ColourInput.defColor("gray49",         "Black", 125, 125, 125);
		ColourInput.defColor("gray48",         "Black", 122, 122, 122);
		ColourInput.defColor("gray47",         "Black", 120, 120, 120);
		ColourInput.defColor("gray46",         "Black", 117, 117, 117);
		ColourInput.defColor("gray45",         "Black", 115, 115, 115);
		ColourInput.defColor("gray44",         "Black", 112, 112, 112);
		ColourInput.defColor("gray43",         "Black", 110, 110, 110);
		ColourInput.defColor("gray42",         "Black", 107, 107, 107);
		ColourInput.defColor("gray41",         "Black", 105, 105, 105);
		ColourInput.defColor("gray40",         "Black", 102, 102, 102);
		ColourInput.defColor("gray39",         "Black", 99, 99, 99);
		ColourInput.defColor("gray38",         "Black", 97, 97, 97);
		ColourInput.defColor("gray37",         "Black", 94, 94, 94);
		ColourInput.defColor("gray36",         "Black", 92, 92, 92);
		ColourInput.defColor("gray35",         "Black", 89, 89, 89);
		ColourInput.defColor("gray34",         "Black", 87, 87, 87);
		ColourInput.defColor("gray33",         "Black", 84, 84, 84);
		ColourInput.defColor("gray32",         "Black", 82, 82, 82);
		ColourInput.defColor("gray31",         "Black", 79, 79, 79);
		ColourInput.defColor("gray30",         "Black", 77, 77, 77);
		ColourInput.defColor("gray29",         "Black", 74, 74, 74);
		ColourInput.defColor("gray28",         "Black", 71, 71, 71);
		ColourInput.defColor("gray27",         "Black", 69, 69, 69);
		ColourInput.defColor("gray26",         "Black", 66, 66, 66);
		ColourInput.defColor("gray25",         "Black", 64, 64, 64);
		ColourInput.defColor("gray24",         "Black", 61, 61, 61);
		ColourInput.defColor("gray23",         "Black", 59, 59, 59);
		ColourInput.defColor("gray22",         "Black", 56, 56, 56);
		ColourInput.defColor("gray21",         "Black", 54, 54, 54);
		ColourInput.defColor("gray20",         "Black", 51, 51, 51);
		ColourInput.defColor("gray19",         "Black", 48, 48, 48);
		ColourInput.defColor("gray18",         "Black", 46, 46, 46);
		ColourInput.defColor("gray17",         "Black", 43, 43, 43);
		ColourInput.defColor("gray16",         "Black", 41, 41, 41);
		ColourInput.defColor("gray15",         "Black", 38, 38, 38);
		ColourInput.defColor("gray14",         "Black", 36, 36, 36);
		ColourInput.defColor("gray13",         "Black", 33, 33, 33);
		ColourInput.defColor("gray12",         "Black", 31, 31, 31);
		ColourInput.defColor("gray11",         "Black", 28, 28, 28);
		ColourInput.defColor("gray10",         "Black", 26, 26, 26);
		ColourInput.defColor("gray9",          "Black", 23, 23, 23);
		ColourInput.defColor("gray8",          "Black", 20, 20, 20);
		ColourInput.defColor("gray7",          "Black", 18, 18, 18);
		ColourInput.defColor("gray6",          "Black", 15, 15, 15);
		ColourInput.defColor("gray5",          "Black", 13, 13, 13);
		ColourInput.defColor("gray4",          "Black", 10, 10, 10);
		ColourInput.defColor("gray3",          "Black", 8, 8, 8);
		ColourInput.defColor("gray2",          "Black", 5, 5, 5);
		ColourInput.defColor("gray1",          "Black", 3, 3, 3);
	}

	static override toString(col?: Color4d | null): string {
		if (col === null || col === undefined)
			return "";

		const red = Math.round(col.r * 255);
		const green = Math.round(col.g * 255);
		const blue = Math.round(col.b * 255);
		const alpha = Math.round(col.a * 255);

		let sb = "";
		const colorName = ColourInput.getColorName(new Color4d(col.r, col.g, col.b));
		if (colorName !== null) {
			sb += colorName;
		}
		else {
			sb += String(red) + Input.SEPARATOR;
			sb += String(green) + Input.SEPARATOR;
			sb += String(blue);
		}

		if (alpha === 255) {
			return sb;
		}
		else {
			sb += Input.SEPARATOR + String(alpha);
			return sb;
		}
	}

	override getDefaultString(simModel: JaamSimModel | null): string {
		return ColourInput.toString(this.defValue);
	}

	override getValidOptions(ent: Entity | null): string[] {
		ColourInput.ensureInit();
		const list = [...ColourInput.colorMap.keys()];
		list.sort((a, b) => Input.uiSortOrder.compare(a, b));
		return list;
	}

	override toString(): string {
		return ColourInput.toString(this.value);
	}
}

// Input.parseColour から色の名前を引く呼び口（Input.ts が ColourInput を import しないため。Input.ts の注）
Input.colourNameResolver = (name: string): Color4d | null => ColourInput.getColorWithName(name);
