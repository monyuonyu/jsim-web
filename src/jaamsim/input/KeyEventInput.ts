/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2017-2021 JaamSim Software Inc.
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
// - Java は com.jogamp.newt.event.KeyEvent（JOGL の NEWT。java.awt.event.KeyEvent ではない）の VK_… の値と
//   utf16ToVKey を使う。画面の部品だが、モデルのファイルの入力を読むのに要るので、使っている分の値を
//   下の NewtKeyEvent に写した（jogl-all.jar の値を読み出して確かめた）。
// - setDefaultValue(String name) と、基底の setDefaultValue(Integer) は、引数の型（typeof string）で見分ける。
// - 値は Integer なので、toString() は整数の形で出す（基底の javaToString は double の形 "65.0" になるため上書きした）。
import type { Entity } from "../basicsim/Entity.ts";
import type { JaamSimModel } from "../basicsim/JaamSimModel.ts";
import { tr } from "../i18n/I18n.ts";
import { Input, javaToString } from "./Input.ts";
import type { KeywordIndex } from "./KeywordIndex.ts";

/** com.jogamp.newt.event.KeyEvent の定数（使っている分だけ。値は Java の short と同じ） */
const NewtKeyEvent = {
	VK_HOME: 2,
	VK_END: 3,
	VK_PRINTSCREEN: 5,
	VK_PAGE_DOWN: 11,
	VK_ENTER: 13,
	VK_SHIFT: 15,
	VK_PAGE_UP: 16,
	VK_CONTROL: 17,
	VK_ALT: 18,
	VK_INSERT: 26,
	VK_ESCAPE: 27,
	VK_SPACE: 32,
	VK_PLUS: 43,
	VK_F1: 97,
	VK_F2: 98,
	VK_F3: 99,
	VK_F4: 100,
	VK_F5: 101,
	VK_F6: 102,
	VK_F7: 103,
	VK_F8: 104,
	VK_F9: 105,
	VK_F10: 106,
	VK_F11: 107,
	VK_F12: 108,
	VK_F13: 109,
	VK_F14: 110,
	VK_F15: 111,
	VK_F16: 112,
	VK_F17: 113,
	VK_F18: 114,
	VK_F19: 115,
	VK_F20: 116,
	VK_F21: 117,
	VK_F22: 118,
	VK_F23: 119,
	VK_F24: 120,
	VK_SEPARATOR: 127,
	VK_NUMPAD0: 128,
	VK_NUMPAD1: 129,
	VK_NUMPAD2: 130,
	VK_NUMPAD3: 131,
	VK_NUMPAD4: 132,
	VK_NUMPAD5: 133,
	VK_NUMPAD6: 134,
	VK_NUMPAD7: 135,
	VK_NUMPAD8: 136,
	VK_NUMPAD9: 137,
	VK_DECIMAL: 138,
	VK_ADD: 139,
	VK_SUBTRACT: 140,
	VK_MULTIPLY: 141,
	VK_DIVIDE: 142,
	VK_DELETE: 147,
	VK_NUM_LOCK: 148,
	VK_LEFT: 149,
	VK_UP: 150,
	VK_RIGHT: 151,
	VK_DOWN: 152,

	/**
	 * KeyEvent.utf16ToVKey(char) を int にした値。'a'〜'z' は 'A'〜'Z' の値、ほかは文字の値のまま
	 * （jogl-all.jar で 0〜0xFFFF の全部を確かめた）。戻り値は Java の short なので、0x8000 以上は負の数になる。
	 */
	utf16ToVKey(c: string): number {
		let code = c.charCodeAt(0);
		if (code >= 0x61 && code <= 0x7a)
			code -= 0x20;
		return (code << 16) >> 16;  // short → int（符号を広げる）
	},
};

export class KeyEventInput extends Input<number> {

	constructor(key: string, cat: string, def: number | null) {
		super(key, cat, def);
	}

	private static readonly keyCodeMap = new Map<string, number>(); // key code for a given key name
	private static readonly keyNameMap = new Map<number, string>(); // key name for a given key code

	static {
		KeyEventInput.initMaps();
	}

	/** @throws InputErrorException */
	override parse(thisEnt: Entity, kw: KeywordIndex): void {
		Input.assertCount(kw, 1);

		// Many keys are represented by a name
		let temp = KeyEventInput.getKeyCode(kw.getArg(0));
		if (temp !== null) {
			this.value = temp;
			return;
		}

		// Remaining keys are represented by the key code
		temp = Input.parseInteger(kw.getArg(0));
		this.value = temp;
	}

	override getValidInputDesc(): string {
		return tr(Input.VALID_KEYEVENT);
	}

	override getValueTokens(toks: string[]): void {
		if (this.value === null || this.isDef)
			return;

		toks.push(KeyEventInput.getKeyName(this.value));
	}

	override getDefaultString(simModel: JaamSimModel | null): string {
		if (this.defValue === null)
			// TODO(移植): Java は null を返す。基底の戻り値の型が string なので、型だけ合わせて null を返している
			return null as unknown as string;

		const ret = KeyEventInput.getKeyName(this.defValue);
		if (ret !== null)
			return ret;

		return String(this.defValue);
	}

	override setDefaultValue(name: string | number | null): void {
		// setDefaultValue(String name)
		if (typeof name === "string") {
			this.setDefaultValue(KeyEventInput.getKeyCode(name));
			return;
		}
		super.setDefaultValue(name);
	}

	/** Java の Input.toString()（String.format("%s", value)。値は Integer） */
	override toString(): string {
		return javaToString(this.value, true);
	}

	static getKeyCode(name: string): number | null {
		let code: number | null;
		if (name.length === 1) {
			code = NewtKeyEvent.utf16ToVKey(name.charAt(0));
		}
		else {
			code = KeyEventInput.keyCodeMap.get(name.toUpperCase()) ?? null;
		}
		return code;
	}

	static getKeyName(code: number): string {
		let name: string | null;
		name = KeyEventInput.keyNameMap.get(code) ?? null;
		if (name === null) {
			name = String.fromCharCode(code & 0xFFFF);  // Java の String.valueOf((char) code)
		}
		return name;
	}

	private static mapKeyEvent(name: string, code: number): void {
		if (KeyEventInput.keyCodeMap.has(name)) {
			console.log(`KeyEvent name added twice: ${name} `);
		}
		KeyEventInput.keyCodeMap.set(name, code);
		if (KeyEventInput.keyNameMap.has(code)) {
			console.log(`KeyEvent code added twice: ${code} `);
		}
		KeyEventInput.keyNameMap.set(code, name);
	}

	private static initMaps(): void {
		KeyEventInput.mapKeyEvent("ADD",         NewtKeyEvent.VK_ADD);
		KeyEventInput.mapKeyEvent("ALT",         NewtKeyEvent.VK_ALT);
		KeyEventInput.mapKeyEvent("CONTROL",     NewtKeyEvent.VK_CONTROL);
		KeyEventInput.mapKeyEvent("DECIMAL",     NewtKeyEvent.VK_DECIMAL);
		KeyEventInput.mapKeyEvent("DELETE",      NewtKeyEvent.VK_DELETE);
		KeyEventInput.mapKeyEvent("DIVIDE",      NewtKeyEvent.VK_DIVIDE);
		KeyEventInput.mapKeyEvent("DOWN",        NewtKeyEvent.VK_DOWN);
		KeyEventInput.mapKeyEvent("END",         NewtKeyEvent.VK_END);
		KeyEventInput.mapKeyEvent("ENTER",       NewtKeyEvent.VK_ENTER);
		KeyEventInput.mapKeyEvent("ESCAPE",      NewtKeyEvent.VK_ESCAPE);
		KeyEventInput.mapKeyEvent("F1",          NewtKeyEvent.VK_F1);
		KeyEventInput.mapKeyEvent("F2",          NewtKeyEvent.VK_F2);
		KeyEventInput.mapKeyEvent("F3",          NewtKeyEvent.VK_F3);
		KeyEventInput.mapKeyEvent("F4",          NewtKeyEvent.VK_F4);
		KeyEventInput.mapKeyEvent("F5",          NewtKeyEvent.VK_F5);
		KeyEventInput.mapKeyEvent("F6",          NewtKeyEvent.VK_F6);
		KeyEventInput.mapKeyEvent("F7",          NewtKeyEvent.VK_F7);
		KeyEventInput.mapKeyEvent("F8",          NewtKeyEvent.VK_F8);
		KeyEventInput.mapKeyEvent("F9",          NewtKeyEvent.VK_F9);
		KeyEventInput.mapKeyEvent("F10",         NewtKeyEvent.VK_F10);
		KeyEventInput.mapKeyEvent("F11",         NewtKeyEvent.VK_F11);
		KeyEventInput.mapKeyEvent("F12",         NewtKeyEvent.VK_F12);
		KeyEventInput.mapKeyEvent("F13",         NewtKeyEvent.VK_F13);
		KeyEventInput.mapKeyEvent("F14",         NewtKeyEvent.VK_F14);
		KeyEventInput.mapKeyEvent("F15",         NewtKeyEvent.VK_F15);
		KeyEventInput.mapKeyEvent("F16",         NewtKeyEvent.VK_F16);
		KeyEventInput.mapKeyEvent("F17",         NewtKeyEvent.VK_F17);
		KeyEventInput.mapKeyEvent("F18",         NewtKeyEvent.VK_F18);
		KeyEventInput.mapKeyEvent("F19",         NewtKeyEvent.VK_F19);
		KeyEventInput.mapKeyEvent("F20",         NewtKeyEvent.VK_F20);
		KeyEventInput.mapKeyEvent("F21",         NewtKeyEvent.VK_F21);
		KeyEventInput.mapKeyEvent("F22",         NewtKeyEvent.VK_F22);
		KeyEventInput.mapKeyEvent("F23",         NewtKeyEvent.VK_F23);
		KeyEventInput.mapKeyEvent("F24",         NewtKeyEvent.VK_F24);
		KeyEventInput.mapKeyEvent("HOME",        NewtKeyEvent.VK_HOME);
		KeyEventInput.mapKeyEvent("INSERT",      NewtKeyEvent.VK_INSERT);
		KeyEventInput.mapKeyEvent("LEFT",        NewtKeyEvent.VK_LEFT);
		KeyEventInput.mapKeyEvent("MULTIPLY",    NewtKeyEvent.VK_MULTIPLY);
		KeyEventInput.mapKeyEvent("NUM_LOCK",    NewtKeyEvent.VK_NUM_LOCK);
		KeyEventInput.mapKeyEvent("NUMPAD0",     NewtKeyEvent.VK_NUMPAD0);
		KeyEventInput.mapKeyEvent("NUMPAD1",     NewtKeyEvent.VK_NUMPAD1);
		KeyEventInput.mapKeyEvent("NUMPAD2",     NewtKeyEvent.VK_NUMPAD2);
		KeyEventInput.mapKeyEvent("NUMPAD3",     NewtKeyEvent.VK_NUMPAD3);
		KeyEventInput.mapKeyEvent("NUMPAD4",     NewtKeyEvent.VK_NUMPAD4);
		KeyEventInput.mapKeyEvent("NUMPAD5",     NewtKeyEvent.VK_NUMPAD5);
		KeyEventInput.mapKeyEvent("NUMPAD6",     NewtKeyEvent.VK_NUMPAD6);
		KeyEventInput.mapKeyEvent("NUMPAD7",     NewtKeyEvent.VK_NUMPAD7);
		KeyEventInput.mapKeyEvent("NUMPAD8",     NewtKeyEvent.VK_NUMPAD8);
		KeyEventInput.mapKeyEvent("NUMPAD9",     NewtKeyEvent.VK_NUMPAD9);
		KeyEventInput.mapKeyEvent("PAGE_DOWN",   NewtKeyEvent.VK_PAGE_DOWN);
		KeyEventInput.mapKeyEvent("PAGE_UP",     NewtKeyEvent.VK_PAGE_UP);
		KeyEventInput.mapKeyEvent("PLUS",        NewtKeyEvent.VK_PLUS);
		KeyEventInput.mapKeyEvent("PRINTSCREEN", NewtKeyEvent.VK_PRINTSCREEN);
		KeyEventInput.mapKeyEvent("RIGHT",       NewtKeyEvent.VK_RIGHT);
		KeyEventInput.mapKeyEvent("SEPARATOR",   NewtKeyEvent.VK_SEPARATOR);
		KeyEventInput.mapKeyEvent("SHIFT",       NewtKeyEvent.VK_SHIFT);
		KeyEventInput.mapKeyEvent("SPACE",       NewtKeyEvent.VK_SPACE);
		KeyEventInput.mapKeyEvent("SUBTRACT",    NewtKeyEvent.VK_SUBTRACT);
		KeyEventInput.mapKeyEvent("UP",          NewtKeyEvent.VK_UP);
	}

}
