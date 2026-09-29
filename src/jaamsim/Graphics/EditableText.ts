//@@HEADER@@
import { Editable, implementsFunctions } from "./Editable.ts";

/*
 * 移植の注意: instanceof EditableText の代わりは EditableText.isInstance(o)（関数の有無で見分ける）。
 */

export interface EditableText extends Editable {

	/**
	 * Assigns the present text.
	 * @param str - present text
	 */
	setText(str: string): void;

	/**
	 * Returns the present text.
	 * @return present text
	 */
	getText(): string;

	/**
	 * Sets the position in the text at which new characters will be inserted.
	 * @param pos - position in the text string
	 * @param shift - true is the shift key was pressed during the change in position
	 */
	setInsertPosition(pos: number, shift: boolean): void;

	/**
	 * Highlights the word the contains the present insert position.
	 */
	selectPresentWord(): void;

	/**
	 * Returns the position in the text at which new characters will be inserted.
	 * 0 = beginning of the text
	 * @return insert position
	 */
	getInsertPosition(): number;

	/**
	 * Returns the number of characters that have been highlighted relative to the insert position.
	 * The value is negative if the characters appear before the insert position.
	 * @return number of selected characters
	 */
	getNumberSelected(): number;

	/**
	 * Copies the selected characters to the system clipboard.
	 */
	copyToClipboard(): void;

	/**
	 * Copies the string saved to the system clipboard to the present insert location.
	 */
	pasteFromClipboard(): void;

	/**
	 * Deletes the selected characters.
	 */
	deleteSelection(): void;

}

export const EditableText = {
	/** o instanceof EditableText */
	isInstance(o: unknown): o is EditableText {
		return Editable.isInstance(o) && implementsFunctions(o, ["setText", "getText",
				"setInsertPosition", "selectPresentWord", "getInsertPosition", "getNumberSelected",
				"copyToClipboard", "pasteFromClipboard", "deleteSelection"]);
	},
};
