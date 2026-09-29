/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2018-2023 JaamSim Software Inc.
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
import { Editable, implementsFunctions } from "../internal.ts";

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
