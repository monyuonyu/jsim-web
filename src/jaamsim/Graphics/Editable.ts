//@@HEADER@@

/*
 * 移植の注意:
 * - Java の interface の定数（ACCEPT_EDITS など）と instanceof の代わりは、同じ名前の値 Editable に置いた。
 *   TS の interface は実行時に無いので、Editable.isInstance(o) は関数の有無で見分ける。
 * - JOGL（newt）の KeyEvent の値は、このファイルの KeyEvent に写した（キー操作の処理が使う）。
 *   描画: JOGL は移さないが、キーの番号は編集の動きに要るので残す。値は jogl-all.jar から読んだもの。
 */

export interface Editable {

	/**
	 * Sets the edit mode.
	 * @param bool - new mode: true = editing, false = not editing
	 */
	setEditMode(bool: boolean): void;

	/**
	 * Returns whether edit mode is set.
	 * @return true if in edit mode
	 */
	isEditMode(): boolean;

	/**
	 * Accepts any edits that have been made.
	 */
	acceptEdits(): void;

	/**
	 * Cancels any edits that have been made.
	 */
	cancelEdits(): void;

	/**
	 * Performs the editing action for the specified key on the keyboard is first pressed.
	 * @param keyCode - Newt code for the keyboard key
	 * @param keyChar - Newt character code for the keyboard key
	 * @param shift - true if the Shift key is pressed
	 * @param control - true if the Control key is pressed
	 * @param alt - true if the Alt key is pressed
	 * @return state after the keystroke: ACCEPT_EDITS, CONTINUE_EDITS, or CANCEL_EDITS
	 */
	handleEditKeyPressed(keyCode: number, keyChar: string, shift: boolean, control: boolean, alt: boolean): number;

	/**
	 * Performs the editing action for the specified key on the keyboard is released.
	 * @param keyCode - Newt code for the keyboard key
	 * @param keyChar - Newt character code for the keyboard key
	 * @param shift - true if the Shift key is pressed
	 * @param control - true if the Control key is pressed
	 * @param alt - true if the Alt key is pressed
	 * @return state after the keystroke: ACCEPT_EDITS, CONTINUE_EDITS, or CANCEL_EDITS
	 */
	handleEditKeyReleased(keyCode: number, keyChar: string, shift: boolean, control: boolean, alt: boolean): number;

}

function hasFunctions(o: unknown, names: string[]): boolean {
	if (o === null || typeof o !== "object")
		return false;
	const rec = o as Record<string, unknown>;
	return names.every(n => typeof rec[n] === "function");
}

export const Editable = {
	ACCEPT_EDITS: 1,
	CONTINUE_EDITS: 0,
	CANCEL_EDITS: -1,

	/** o instanceof Editable */
	isInstance(o: unknown): o is Editable {
		return hasFunctions(o, ["setEditMode", "isEditMode", "acceptEdits", "cancelEdits",
				"handleEditKeyPressed", "handleEditKeyReleased"]);
	},
};

/** 関数の有無で interface を見分ける（ほかの interface のファイルも使う） */
export function implementsFunctions(o: unknown, names: string[]): boolean {
	return hasFunctions(o, names);
}

/**
 * JOGL（com.jogamp.newt.event.KeyEvent）のキーの番号の写し。
 * TODO(移植): three.js の画面を作るときに、ブラウザのキー（KeyboardEvent.key）からこの番号に直す所が要る。
 */
export const KeyEvent = {
	VK_HOME: 0x02,
	VK_END: 0x03,
	VK_BACK_SPACE: 0x08,
	VK_TAB: 0x09,
	VK_ENTER: 0x0D,
	VK_ESCAPE: 0x1B,
	VK_C: 0x43,
	VK_V: 0x56,
	VK_X: 0x58,
	VK_F2: 0x62,
	VK_DELETE: 0x93,
	VK_LEFT: 0x95,
	VK_UP: 0x96,
	VK_RIGHT: 0x97,
	VK_DOWN: 0x98,
	VK_UNDEFINED: 0,

	/**
	 * KeyEvent.isPrintableKey(uniChar, isKeyChar) の写し（isKeyChar = false の場合だけ使う）。
	 * TODO(移植): newt の元のコードを記憶から写した。範囲は newt の nonPrintableKeys による。
	 */
	isPrintableKey(uniChar: number, isKeyChar: boolean): boolean {
		// Java は (short) に直してから渡している
		const c = (uniChar << 16) >> 16;
		if (c === KeyEvent.VK_BACK_SPACE || c === KeyEvent.VK_TAB || c === KeyEvent.VK_ENTER)
			return true;
		const u = c & 0xFFFF;
		if (!isKeyChar) {
			if ((0x0000 <= u && u <= 0x001F) ||
					(0x0061 <= u && u <= 0x0078) ||
					(0x008F <= u && u <= 0x009F) ||
					(0xE000 <= u && u <= 0xF8FF))
				return false;
		}
		else {
			if ((0x0000 <= u && u <= 0x001F) ||
					(0x008F <= u && u <= 0x009F) ||
					(0xE000 <= u && u <= 0xF8FF))
				return false;
		}
		return c !== KeyEvent.VK_UNDEFINED;
	},
};
