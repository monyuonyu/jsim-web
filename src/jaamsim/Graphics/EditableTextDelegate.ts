//@@HEADER@@
import { jformat } from "../java/lang.ts";
import { Editable, KeyEvent } from "./Editable.ts";
import type { EditableText } from "./EditableText.ts";

/*
 * 移植の注意:
 * - クリップボード（GUIFrame.copyToClipboard / getStringFromClipboard）は画面の部品なので移さない。
 *   描画: 省略（three.js の画面を作るときに）。代わりに static の clipboard（関数を差し替えられる）を置いた。
 * - Java の switch の「break の無い case」（VK_C → VK_V → VK_X → default へ落ちる）はそのまま写した。
 */

export class EditableTextDelegate implements EditableText {

	/**
	 * クリップボードの読み書き（画面の側で差し替える）。既定はこの中だけの文字列。
	 * TODO(移植): three.js/ブラウザの画面では navigator.clipboard につなぐ（非同期なので工夫が要る）。
	 */
	static clipboard = {
		text: null as string | null,
		copyToClipboard(str: string): void {
			EditableTextDelegate.clipboard.text = str;
		},
		getStringFromClipboard(): string | null {
			return EditableTextDelegate.clipboard.text;
		},
	};

	private editMode = false;     // true if the entity is being edited
	private text = "";            // present text including any edits in progress
	private initText = "";        // text before any editing is performed
	private insertPos = 0;        // position in the string where new text will be inserted
	private numSelected = 0;      // number of characters selected (positive to the right of the insertion position)

	constructor() {
		this.setText("");
	}

	setText(str: string): void {
		this.editMode = false;
		this.text = str;
		this.initText = "";
		this.insertPos = 0;
		this.numSelected = 0;
	}

	getText(): string {
		return this.text;
	}

	setEditMode(bool: boolean): void {
		if (bool === this.editMode)
			return;
		this.editMode = bool;
		if (bool) {
			this.initText = this.text;
			this.insertPos = this.text.length;
		}
		else {
			this.initText = "";
			this.insertPos = 0;
		}
		this.numSelected = 0;
	}

	isEditMode(): boolean {
		return this.editMode;
	}

	acceptEdits(): void {
		this.setEditMode(false);
	}

	cancelEdits(): void {
		this.text = this.initText;
		this.setEditMode(false);
	}

	getInsertPosition(): number {
		return this.insertPos;
	}

	getNumberSelected(): number {
		return this.numSelected;
	}

	setNumberSelected(num: number): void {
		this.numSelected = num;
	}

	handleEditKeyPressed(keyCode: number, keyChar: string, shift: boolean, control: boolean, alt: boolean): number {

		let ret = Editable.CONTINUE_EDITS;
		switch (keyCode) {

			case KeyEvent.VK_DELETE:
				if (this.numSelected === 0) {
					if (this.insertPos === this.text.length)
						break;
					this.text = this.text.slice(0, this.insertPos) + this.text.slice(this.insertPos + 1);
					break;
				}
				this.deleteSelection();
				break;

			case KeyEvent.VK_BACK_SPACE:
				if (this.numSelected === 0) {
					if (this.insertPos === 0)
						break;
					this.text = this.text.slice(0, this.insertPos - 1) + this.text.slice(this.insertPos);
					this.insertPos--;
					break;
				}
				this.deleteSelection();
				break;

			case KeyEvent.VK_LEFT:
				if (!shift && !(this.numSelected === 0)) {
					if (this.numSelected < 0)
						this.setInsertPosition(this.insertPos + this.numSelected, shift);
					else
						this.setInsertPosition(this.insertPos, shift);
					break;
				}
				this.setInsertPosition(Math.max(0, this.insertPos-1), shift);
				break;

			case KeyEvent.VK_RIGHT:
				if (!shift && !(this.numSelected === 0)) {
					if (this.numSelected > 0)
						this.setInsertPosition(this.insertPos + this.numSelected, shift);
					else
						this.setInsertPosition(this.insertPos, shift);
					break;
				}
				this.setInsertPosition(Math.min(this.text.length, this.insertPos+1), shift);
				break;

			case KeyEvent.VK_UP: {
				const upPos = this.getUpPosition(this.insertPos);
				if (upPos >= 0) {
					this.setInsertPosition(upPos, shift);
				}
				break;
			}

			case KeyEvent.VK_DOWN: {
				const downPos = this.getDownPosition(this.insertPos);
				if (downPos >= 0) {
					this.setInsertPosition(downPos, shift);
				}
				break;
			}

			case KeyEvent.VK_HOME:
				if (control) {
					this.setInsertPosition(0, shift);
					break;
				}
				this.setInsertPosition(this.getLineStart(this.insertPos), shift);
				break;

			case KeyEvent.VK_END:
				if (control) {
					this.setInsertPosition(this.text.length, shift);
					break;
				}
				this.setInsertPosition(this.getLineEnd(this.insertPos), shift);
				break;

			case KeyEvent.VK_ENTER:
				if (control) {
					this.text = this.text.slice(0, this.insertPos) + "\n" + this.text.slice(this.insertPos);
					this.insertPos++;
					break;
				}
				ret = Editable.ACCEPT_EDITS;
				break;

			case KeyEvent.VK_ESCAPE:
				ret = Editable.CANCEL_EDITS;
				break;

			// Java と同じく、break が無ければ次の case へ落ちる
			case KeyEvent.VK_C:
				if (control) {
					this.copyToClipboard();
					break;
				}

			// Java と同じく、break が無ければ次の case へ落ちる
			case KeyEvent.VK_V:
				if (control) {
					this.deleteSelection();
					this.pasteFromClipboard();
					break;
				}

			// Java と同じく、break が無ければ次の case へ落ちる
			case KeyEvent.VK_X:
				if (control) {
					this.copyToClipboard();
					this.deleteSelection();
					break;
				}

			default:
				if (control || !KeyEvent.isPrintableKey(keyCode, false))
					break;
				this.deleteSelection();
				this.text = this.text.slice(0, this.insertPos) + keyChar + this.text.slice(this.insertPos);
				this.insertPos++;
				break;
		}
		return ret;
	}

	handleEditKeyReleased(keyCode: number, keyChar: string, shift: boolean, control: boolean, alt: boolean): number {
		return Editable.CONTINUE_EDITS;
	}

	setInsertPosition(pos: number, shift: boolean): void {
		if (shift)
			this.numSelected -= pos - this.insertPos;
		else
			this.numSelected = 0;
		this.insertPos = pos;
	}

	selectPresentWord(): void {

		// Find the end of the present word
		let end = this.text.length;
		for (let i = this.insertPos; i < this.text.length; i++) {
			if (this.text.charAt(i) === " ") {
				end = i + 1;
				break;
			}
			if (this.text.charAt(i) === "\n") {
				end = i;
				break;
			}
		}

		// Find the start of the present word
		let start = 0;
		for (let i = this.insertPos-1; i >= 0; i--) {
			if (this.text.charAt(i) === " " || this.text.charAt(i) === "\n") {
				start = i + 1;
				break;
			}
		}

		// Set the insert position and selection
		this.insertPos = end;
		this.numSelected = start - end;
	}

	deleteSelection(): void {
		if (this.numSelected === 0)
			return;
		const start = Math.min(this.insertPos, this.insertPos+this.numSelected);
		const end = Math.max(this.insertPos, this.insertPos+this.numSelected);
		this.text = this.text.slice(0, start) + this.text.slice(end);
		this.insertPos = start;
		this.numSelected = 0;
	}

	/**
	 * Returns the index of the first character in the line of text containing the specified index.
	 * @param i - index in the text string
	 * @return index of the first character in the line
	 */
	private getLineStart(ind: number): number {
		for (let i = ind - 1; i >= 0; i--) {
			if (this.text.charAt(i) === "\n") {
				return i + 1;
			}
		}
		return 0;
	}

	/**
	 * Returns the index of the first newline character after the specified index.
	 * @param i - index in the text string
	 * @return index of the first newline
	 */
	private getLineEnd(ind: number): number {
		for (let i = ind; i < this.text.length; i++) {
			if (this.text.charAt(i) === "\n") {
				return i;
			}
		}
		return this.text.length;
	}

	private getUpPosition(ind: number): number {
		const start = this.getLineStart(ind);
		if (start === 0)
			return -1;
		const linePos = ind - start;
		const end = start - 1;
		return Math.min(this.getLineStart(end) + linePos, end);
	}

	private getDownPosition(ind: number): number {
		const end = this.getLineEnd(ind);
		if (end === this.text.length)
			return -1;
		const linePos = ind - this.getLineStart(ind);
		return Math.min(end + 1 + linePos, this.getLineEnd(end + 1));
	}

	copyToClipboard(): void {
		const start = Math.min(this.insertPos, this.insertPos + this.numSelected);
		const end = Math.max(this.insertPos, this.insertPos + this.numSelected);
		const copiedText = this.text.substring(start, end);
		// 描画: 省略（three.js の画面を作るときに）。GUIFrame.copyToClipboard の代わり
		EditableTextDelegate.clipboard.copyToClipboard(copiedText);
	}

	pasteFromClipboard(): void {
		// 描画: 省略（three.js の画面を作るときに）。GUIFrame.getStringFromClipboard の代わり
		const newText = EditableTextDelegate.clipboard.getStringFromClipboard();
		if (newText === null)
			return;
		this.text = this.text.slice(0, this.insertPos) + newText + this.text.slice(this.insertPos);
		this.insertPos += newText.length;
	}

	toString(): string {
		return jformat("(text=%s, insertPos=%s, numSelected=%s, initText=%s)",
				this.text, this.insertPos, this.numSelected, this.initText);
	}

}
