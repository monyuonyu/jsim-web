/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2022 JaamSim Software Inc.
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

// 入れ子のクラス Token は、このファイルの JSONTokenizer_Token にした（JSONTokenizer.Token とも書ける）。
// char は長さ 1 の文字列。文字の大小の比べ（c < ' ' など）は、JS の文字列の比べ（UTF-16 の符号の順）で Java と同じになる。

import { tr } from "../i18n/I18n.ts";
import { NumberFormatException } from "../java/lang.ts";
import { JSONError } from "./JSONError.ts";

export class JSONTokenizer_Token {
	public type = 0;
	public value: string = null as unknown as string;
	public pos = 0;
}

/** Java の Integer.parseUnsignedInt(s, 16) */
function parseUnsignedHex(s: string): number {
	if (!/^\+?[0-9a-fA-F]+$/.test(s))
		throw new NumberFormatException(`For input string: "${s}"`);
	return parseInt(s, 16);
}

export class JSONTokenizer {

	public static readonly STRING_TYPE = 0;
	public static readonly NUM_TYPE = 1;
	public static readonly SYM_TYPE = 2;
	public static readonly KEYWORD_TYPE = 3;

	static readonly Token = JSONTokenizer_Token;

	static symTok(c: string, pos: number): JSONTokenizer_Token {
		const ret = new JSONTokenizer_Token();
		ret.type = JSONTokenizer.SYM_TYPE;
		ret.value = c;
		ret.pos = pos;
		return ret;

	}

	static isWhiteSpace(c: string): boolean {
		let isWhite = c === " ";
		isWhite = isWhite || c === "\t";
		isWhite = isWhite || c === "\r";
		isWhite = isWhite || c === "\n";
		return isWhite;
	}

	static isNumberStart(c: string): boolean {
		return (c >= "0" && c <= "9") || c === "-";
	}

	static nextChar(input: string, pos: number): string {
		if (pos >= input.length) {
			return "$";
		}
		return input.charAt(pos);
	}

	private static getStringToken(res: JSONTokenizer_Token[], startPos: number, input: string): number {
		let closePos = startPos + 1;

		while (closePos < input.length) {
			const c = JSONTokenizer.nextChar(input, closePos);
			if (c === "\"" && JSONTokenizer.nextChar(input, closePos-1) !== "\\")
				break;

			closePos++;
		}
		if (closePos === input.length) {
			throw new JSONError(input, startPos, tr("No closing quote character for string."));
		}

		// Scan the string and un-escape any sequences in it
		let sb = "";
		let pos = startPos;
		while (pos < closePos) {
			let c = JSONTokenizer.nextChar(input, pos++);

			if (c < " ") {
				throw new JSONError(input, pos, tr("Invalid character in string"));
			}

			if (c !== "\\") {
				sb += c;
				continue;
			}
			// Java の assert(pos != closePos)（普段は無効）

			c = JSONTokenizer.nextChar(input, pos++);
			switch (c) {
			case "\"":
				sb += "\"";
				continue;
			case "\\":
				sb += "\\";
				continue;
			case "/":
				sb += "/";
				continue;
			case "b":
				sb += "\b";
				continue;
			case "f":
				sb += "\f";
				continue;
			case "n":
				sb += "\n";
				continue;
			case "r":
				sb += "\r";
				continue;
			case "t":
				sb += "\t";
				continue;
			case "u": {
				if (closePos - pos < 4) {
					throw new JSONError(input, pos, tr("Unicode escape sequence is too short"));
				}
				const unicodeStr = input.substring(pos, pos+4);
				try {
					const unicodeVal = parseUnsignedHex(unicodeStr);
					pos+=4;
					sb += String.fromCodePoint(unicodeVal);
				} catch (ex) {
					if (!(ex instanceof NumberFormatException)) throw ex;
					throw new JSONError(input, pos, tr("Could not parse unicode escape sequence"));
				}
				// Java のまま（\u の後に \t を足している）
				sb += "\t";
				continue;
			}
			}

		}
		const tok = new JSONTokenizer_Token();
		tok.type = JSONTokenizer.STRING_TYPE;
		tok.value = sb;
		tok.pos = startPos;
		res.push(tok);
		return closePos+1;

	}

	private static getDigits(startPos: number, input: string): string {
		let sb = "";
		let pos = startPos;
		let c = JSONTokenizer.nextChar(input, pos++);
		while (c >= "0" && c <= "9") {
			sb += c;
			c = JSONTokenizer.nextChar(input, pos++);
		}
		return sb;
	}

	private static getNumToken(res: JSONTokenizer_Token[], startPos: number, input: string): number {
		let pos = startPos;
		let c = JSONTokenizer.nextChar(input, pos);
		let numStr = "";

		if (c === "-") {
			numStr += c;
			pos++;
		}

		const intStr = JSONTokenizer.getDigits(pos, input);
		if (intStr.length === 0) {
			throw new JSONError(input, pos, tr("Number format error"));
		}

		numStr += intStr;
		pos += intStr.length;

		c = JSONTokenizer.nextChar(input, pos);
		if (c === ".") {
			numStr += c;
			pos++;
			const fracStr = JSONTokenizer.getDigits(pos, input);
			if (fracStr.length === 0) {
				throw new JSONError(input, pos, tr("Number format error"));
			}
			numStr += fracStr;
			pos+=fracStr.length;
			c = JSONTokenizer.nextChar(input, pos);
		}
		if (c === "e" || c === "E") {
			numStr += c;
			pos++;
			c = JSONTokenizer.nextChar(input, pos);
			if (c === "+" || c === "-") {
				numStr += c;
				pos++;
			}
			const expStr = JSONTokenizer.getDigits(pos, input);
			if (expStr.length === 0) {
				throw new JSONError(input, pos, tr("Number format error"));
			}
			numStr += expStr;
			pos+=expStr.length;
		}

		const tok = new JSONTokenizer_Token();
		tok.type = JSONTokenizer.NUM_TYPE;
		tok.value = numStr;
		tok.pos = startPos;
		res.push(tok);
		return pos;

	}

	private static geKeywordToken(res: JSONTokenizer_Token[], pos: number, input: string): number {
		let keyword: string | null = null;
		let endPos = -1;
		if (input.length >= pos + 4 && input.substring(pos, pos+4) === "true") {
			keyword = "true";
			endPos = pos+4;
		}
		if (input.length >= pos + 5 && input.substring(pos, pos+5) === "false") {
			keyword = "false";
			endPos = pos+5;
		}
		if (input.length >= pos + 4 && input.substring(pos, pos+4) === "null") {
			keyword = "null";
			endPos = pos+4;
		}

		if (keyword == null) {
			throw new JSONError(input, pos, tr("Unexpected value"));
		}

		const tok = new JSONTokenizer_Token();
		tok.type = JSONTokenizer.KEYWORD_TYPE;
		tok.value = keyword;
		tok.pos = pos;
		res.push(tok);
		return endPos;
	}

	static tokenize(input: string): JSONTokenizer_Token[] {
		let pos = 0;

		const res: JSONTokenizer_Token[] = [];

		while (pos < input.length) {
			const c = JSONTokenizer.nextChar(input, pos++);
			if (JSONTokenizer.isWhiteSpace(c)) {
				continue;
			}

			if (c === "[" || c === "]" || c === "{" || c === "}" || c === "," || c === ":") {
				res.push(JSONTokenizer.symTok(c,pos));
				continue;
			}
			if (c === "\"") {
				pos = JSONTokenizer.getStringToken(res, pos, input);
				continue;
			}
			if (JSONTokenizer.isNumberStart(c)) {
				pos = JSONTokenizer.getNumToken(res, pos-1, input);
				continue;
			}
			// Otherwise check for the 3 simple reserved words
			if (c === "t" || c === "f" || c === "n") {
				pos = JSONTokenizer.geKeywordToken(res, pos-1, input);
				continue;
			}
			throw new JSONError(input, pos-1, tr("Unexpected value"));
		}
		return res;
	}
}
