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

// 多重定義 parse(ArrayList<Token>)・parse(String)（static）と parse()（インスタンス）は、
// static の方を 1 つの static parse(toks | json) にし、インスタンスの parse() はそのまま（TS では static とインスタンスで同じ名前が使える）。
// Java の ArrayList.get の範囲の外（IndexOutOfBoundsException）は、getTok で同じ例外を投げる。

import { tr } from "../i18n/I18n.ts";
import { Double, IndexOutOfBoundsException, NumberFormatException } from "../java/lang.ts";
import { JSONError } from "./JSONError.ts";
import { JSONTokenizer, type JSONTokenizer_Token } from "./JSONTokenizer.ts";
import { JSONValue } from "./JSONValue.ts";
import { JavaHashOrder } from "../ProcessFlow/MappedTreeSet.ts";

/** Java の ArrayList.get(index)（範囲の外は IndexOutOfBoundsException） */
function getTok(toks: JSONTokenizer_Token[], index: number): JSONTokenizer_Token {
	if (index < 0 || index >= toks.length)
		throw new IndexOutOfBoundsException(`Index ${index} out of bounds for length ${toks.length}`);
	return toks[index];
}

export class JSONParser {

	static isSymTok(tok: JSONTokenizer_Token, sym: string): boolean {
		return tok.type === JSONTokenizer.SYM_TYPE && tok.value === sym;
	}
	static isStringTok(tok: JSONTokenizer_Token): boolean {
		return tok.type === JSONTokenizer.STRING_TYPE;
	}

	private static parseMap(toks: JSONTokenizer_Token[], startPos: number, outVal: JSONValue): number {
		// Consume the opening token
		let pos = startPos;
		let tok = getTok(toks, pos);
		const vals = new JavaHashOrder<JSONValue>();

		// special case: empty list
		if (JSONParser.isSymTok(tok, "}")) {
			// This map has terminated
			outVal.mapVal = vals;
			return pos+1;
		}

		while (pos < toks.length) {
			if (!JSONParser.isStringTok(tok)) {
				throw new JSONError(null, tok.pos, tr("Map keys must be strings"));
			}
			const key = tok.value;
			pos++;

			tok = getTok(toks, pos);
			if (!JSONParser.isSymTok(tok, ":")) {
				throw new JSONError(null, tok.pos, tr("Expected \":\""));
			}
			pos++;

			const val = new JSONValue();
			pos = JSONParser.parseElement(toks, pos, val);
			vals.set(key, val);

			tok = getTok(toks, pos);

			if (JSONParser.isSymTok(tok, "}")) {
				// Terminated
				outVal.mapVal = vals;
				return pos+1;
			}
			if (JSONParser.isSymTok(tok, ",")) {
				pos++;
				tok = getTok(toks, pos);
				continue;
			}
			throw new JSONError(null, tok.pos, tr("Unexpected symbol in map"));

		}
		tok = getTok(toks, startPos);
		throw new JSONError(null, tok.pos, tr("Unterminated list"));
	}

	private static parseList(toks: JSONTokenizer_Token[], startPos: number, outVal: JSONValue): number {
		// Consume the opening token
		let pos = startPos;
		let tok = getTok(toks, pos);
		const vals: JSONValue[] = [];

		// special case: empty list
		if (JSONParser.isSymTok(tok, "]")) {
			// This list has terminated
			outVal.listVal = vals;
			return pos+1;
		}

		while (pos < toks.length) {
			const val = new JSONValue();
			pos = JSONParser.parseElement(toks, pos, val);
			vals.push(val);

			tok = getTok(toks, pos);

			if (JSONParser.isSymTok(tok, "]")) {
				// Terminated
				outVal.listVal = vals;
				return pos+1;
			}
			if (JSONParser.isSymTok(tok, ",")) {
				tok = getTok(toks, pos++);
				continue;
			}
			throw new JSONError(null, tok.pos, tr("Unexpected symbol in list"));

		}
		tok = getTok(toks, startPos);
		throw new JSONError(null, tok.pos, tr("Unterminated list"));
	}

	private static parseElement(toks: JSONTokenizer_Token[], startPos: number, outVal: JSONValue): number {
		let pos = startPos;
		const startTok = getTok(toks, pos++);
		switch (startTok.type) {
		case JSONTokenizer.NUM_TYPE:
			try {
				outVal.numVal = Double.parseDouble(startTok.value);
				return pos;
			} catch (ex) {
				if (!(ex instanceof NumberFormatException)) throw ex;
				throw new JSONError(null, startTok.pos, tr("Number format error"));
			}
		case JSONTokenizer.STRING_TYPE:
			outVal.stringVal = startTok.value;
			return pos;
		case JSONTokenizer.SYM_TYPE:
			switch (startTok.value) {
			case "[":
				return JSONParser.parseList(toks, pos, outVal);
			case "{":
				return JSONParser.parseMap(toks, pos, outVal);
			default:
				throw new JSONError(null, startTok.pos, tr("Unexpected token to start element"));
			}
		case JSONTokenizer.KEYWORD_TYPE:
			outVal.isKey = true;
			if (startTok.value === "true") {
				outVal.numVal = JSONValue.TRUE_VAL;
			}
			if (startTok.value === "false") {
				outVal.numVal = JSONValue.FALSE_VAL;
			}
			if (startTok.value === "null") {
				outVal.numVal = JSONValue.NULL_VAL;
			}
			return pos;

		default:
			throw new JSONError(null, startTok.pos, tr("Internal error: Unknown token type"));
		}

	}

	/** parse(ArrayList<Token>) と parse(String) */
	static parse(arg: JSONTokenizer_Token[] | string): JSONValue {
		if (typeof arg === "string") {
			const toks = JSONTokenizer.tokenize(arg);
			return JSONParser.parse(toks);
		}
		const ret = new JSONValue();
		JSONParser.parseElement(arg, 0, ret);
		return ret;
	}

	pieces: (string | null)[];
	private scannerInString = false;
	private scannerEscaping = false;
	private scannerPiece = 0;
	//int scannerPos = 0;
	private firstElemFound = false;
	private topElemIsObj = false;
	private scannerError = false;
	private objDepth = 0;
	private arrayDepth = 0;
	private topElemIsComplete = false;

	constructor() {
		this.pieces = [];
	}

	addPiece(piece: string | null): void {
		this.pieces.push(piece);
	}

	scanningError(): boolean {
		return this.scannerError;
	}

	isObject(): boolean {
		return this.topElemIsObj;
	}

	// Scan all the existing pieces and see if the current element is possibly complete
	// The simple parser does not support partial elements. Attempting to parse incomplete data
	// will return a parse error
	isElementComplete(): boolean {
		if (this.scannerError) return false;
		if (this.topElemIsComplete) return true;

		let piecePos = 0;
		while (true) {
			if (this.scannerPiece >= this.pieces.length) {
				break;
			}
			// Java では null の断片で NullPointerException になる（TS でも .length で TypeError になる）
			const curPiece = this.pieces[this.scannerPiece] as string;
			if (piecePos >= curPiece.length) {
				piecePos = 0;
				this.scannerPiece++;
				continue;
			}

			const scannedChar = curPiece.charAt(piecePos);
			piecePos++;

			if (this.scannerEscaping) {
				// TODO: be more selecting of the escape logic
				// All we currently care about is escaped quotes
				this.scannerEscaping = false;
				continue;
			}

			if (this.scannerInString) {
				if (scannedChar === "\\") {
					this.scannerEscaping = true;
					continue;
				}
				if (scannedChar === "\"") {
					this.scannerInString = false;
					continue;
				}
				continue;
			}

			// Not in a string
			if (scannedChar === "\"") {
				this.scannerInString = true;
				continue;
			}

			if (scannedChar === "{") {
				if (!this.firstElemFound) {
					this.firstElemFound = true;
					this.topElemIsObj = true;
				}
				this.objDepth++;
				continue;
			}
			if (scannedChar === "}") {
				if (this.objDepth <= 0) {
					this.scannerError = true;
					return false;
				}
				this.objDepth--;
				continue;
			}

			if (scannedChar === "[") {
				if (!this.firstElemFound) {
					this.firstElemFound = true;
					this.topElemIsObj = false;
				}
				this.arrayDepth++;
				continue;
			}
			if (scannedChar === "]") {
				if (this.arrayDepth <= 0) {
					this.scannerError = true;
					return false;
				}
				this.arrayDepth--;
				continue;
			}

		}

		if (this.objDepth === 0 && this.arrayDepth === 0 && this.firstElemFound) {
			this.topElemIsComplete = true;
			return true;
		}
		return false;
	}

	parse(): JSONValue {
		// Build up a single string (this is not super efficient...)
		let sb = "";
		for (const s of this.pieces) {
			sb += String(s);  // Java の StringBuilder.append(null) は "null"
		}
		const source = sb;

		// Scan the listed pieces
		const isComp = this.isElementComplete();
		if (this.scannerError) {
			// The preliminary scanner detected a parse error
			throw new JSONError(source, -1, tr("Mismatched brackets detected"));
		}
		if (!isComp) {
			// This element is not yet complete
			throw new JSONError(source, source.length, tr("Incomplete JSON element"));
		}
		const toks = JSONTokenizer.tokenize(source);
		return JSONParser.parse(toks);

	}
}
