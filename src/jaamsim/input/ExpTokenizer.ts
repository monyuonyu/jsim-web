/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2014 Ausenco Engineering Canada Inc.
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
// 入れ子のクラス ExpTokenizer.Token は、同じファイルの ExpTokenizer_Token にした（ExpTokenizer.Token でも使える）。
import { Double, JChar, NumberFormatException } from "../internal.ts";
import { tr } from "../internal.ts";
import { ExpError } from "../internal.ts";

export class ExpTokenizer_Token {
	public type = 0;
	public value: string = null as unknown as string;
	public pos = 0;
}

// Java の Character.isJavaIdentifierStart / isJavaIdentifierPart（1 文字＝UTF-16 の 1 単位）
const JAVA_ID_START = /^[\p{L}\p{Sc}\p{Pc}\p{Nl}]$/u;
const JAVA_ID_PART = /^[\p{L}\p{Sc}\p{Pc}\p{Nl}\p{Nd}\p{Mn}\p{Mc}\p{Cf}\u0000-\u0008\u000E-\u001B\u007F-\u009F]$/u;

export class ExpTokenizer {

	public static readonly VAR_TYPE = 0;
	public static readonly NUM_TYPE = 1;
	public static readonly SYM_TYPE = 2;
	public static readonly SQ_TYPE = 3; // Square quoted tokens
	public static readonly STRING_TYPE = 4; // A literal string
	public static readonly NULL_TYPE = 5; // The specific null keyword

	public static isWhiteSpace(c: string): boolean {
		// Java の Character.isWhitespace（﻿ は Java では空白でない）
		if (JChar.isWhitespace(c) && c !== "﻿") return true;
		return false;
	}

	// Use java style identifiers for now
	public static isVarStartChar(c: string): boolean {
		if (JAVA_ID_START.test(c)) return true;

		return false;
	}

	private static isVarMemberChar(c: string): boolean {
		if (JAVA_ID_PART.test(c)) return true;

		return false;
	}

	private static isNumMemberChar(c: string): boolean {
		if (JChar.isDigit(c)) return true;
		if (c === ".") return true;

		return false;
	}

	// List of 'long' symbols to check for, in order
	private static longSymbols: string[] = ["==", "!=", "<=", ">=", "&&", "||"];

	/** @throws ExpError */
	public static tokenize(input: string): ExpTokenizer_Token[] {
		let pos = 0;

		const res: ExpTokenizer_Token[] = [];

		while (pos < input.length) {
			const c = input.charAt(pos);
			if (ExpTokenizer.isWhiteSpace(c)) {
				pos++;
				continue;
			}

			if (c === "#") {
				pos = ExpTokenizer.skipComment(pos, input);
				continue;
			}
			if (c === "[") {
				// This is the beginning of a square quoted string
				pos = ExpTokenizer.getSQToken(res, pos, input);
				continue;
			}
			if (c === "\"") {
				// This is the beginning of a regular quoted string
				pos = ExpTokenizer.getQuotedToken(res, pos, input);
				continue;
			}

			if (ExpTokenizer.isVarStartChar(c)) {
				pos = ExpTokenizer.getVarToken(res, pos, input);
				continue;
			}

			if (JChar.isDigit(c)) {
				pos = ExpTokenizer.getNumToken(res, pos, input);
				continue;
			}

			pos = ExpTokenizer.getSymbolToken(res, pos, input);
		}

		return res;
	}

	private static getVarToken(res: ExpTokenizer_Token[], startPos: number, input: string): number {
		const newTok = new ExpTokenizer_Token();
		newTok.type = ExpTokenizer.VAR_TYPE;
		newTok.pos = startPos;

		let pos = startPos;
		let sb = "";

		while (pos < input.length) {
			const next = input.charAt(pos);
			if (!ExpTokenizer.isVarMemberChar(next)) {
				break;
			}
			sb += next;
			++pos;
		}

		newTok.value = sb;
		// If the string is specifically "null" this is actually a keyword
		if (newTok.value === "null") {
			newTok.type = ExpTokenizer.NULL_TYPE;
		}

		res.push(newTok);
		return pos;
	}

	/** @throws ExpError */
	private static skipComment(startPos: number, input: string): number {
		let closePos = startPos + 1;

		while (closePos < input.length) {
			const c = input.charAt(closePos);
			if (c === "#")
				return closePos + 1;

			closePos++;
		}
		// Made it to the end of the input
		throw new ExpError(input, startPos, tr("No closing mark for comment"));
	}

	/** @throws ExpError */
	private static getSQToken(res: ExpTokenizer_Token[], startPos: number, input: string): number {

		let closePos = startPos + 1;

		while (closePos < input.length) {
			const c = input.charAt(closePos);
			if (c === "[")
				throw new ExpError(input, closePos, tr("Nested square brace"));
			if (c === "]")
				break;

			closePos++;
		}

		if (closePos === input.length) {
			throw new ExpError(input, startPos, tr("No closing square brace for brace"));
		}

		const newTok = new ExpTokenizer_Token();
		newTok.pos = startPos;
		newTok.type = ExpTokenizer.SQ_TYPE;
		newTok.value = input.substring(startPos + 1, closePos);
		res.push(newTok);
		return closePos + 1;

	}

	/** @throws ExpError */
	private static getQuotedToken(res: ExpTokenizer_Token[], startPos: number, input: string): number {

		let closePos = startPos + 1;

		while (closePos < input.length) {
			const c = input.charAt(closePos);
			if (c === "\"")
				break;

			closePos++;
		}

		if (closePos === input.length) {
			throw new ExpError(input, startPos, tr("No closing quote character for string."));
		}

		const newTok = new ExpTokenizer_Token();
		newTok.pos = startPos;
		newTok.type = ExpTokenizer.STRING_TYPE;
		newTok.value = input.substring(startPos + 1, closePos);
		res.push(newTok);
		return closePos + 1;
	}

	// TODO: Should this include 'f' or 'd' as in the java convention? Also, should we support hex?
	/** @throws ExpError */
	private static getNumToken(res: ExpTokenizer_Token[], startPos: number, input: string): number {
		const newTok = new ExpTokenizer_Token();
		newTok.type = ExpTokenizer.NUM_TYPE;
		newTok.pos = startPos;

		let pos = startPos;
		let sb = "";

		while (pos < input.length) {
			const next = input.charAt(pos);
			if (!ExpTokenizer.isNumMemberChar(next)) {
				break;
			}
			sb += next;
			++pos;
		}

		// Now check for an optional exponent
		if (pos < input.length &&
		    (input.charAt(pos) === "e" || input.charAt(pos) === "E")) {

			sb += input.charAt(pos++);

			// Now check for an option -
			if (pos < input.length && input.charAt(pos) === "-") {
				sb += input.charAt(pos++);
			}
			// An another digit
			while (pos < input.length) {
				const next = input.charAt(pos);
				if (!JChar.isDigit(next)) {
					break;
				}
				sb += next;
				++pos;
			}
		}

		newTok.value = sb;

		// Check that this string can be parsed to a valid double
		try {
			Double.parseDouble(newTok.value);
		} catch (ex) {
			if (!(ex instanceof NumberFormatException)) throw ex;
			throw new ExpError(input, startPos, tr("Error parsing number literal: ") + newTok.value);
		}

		res.push(newTok);
		return pos;
	}

	private static getSymbolToken(res: ExpTokenizer_Token[], startPos: number, input: string): number {
		// For now, tokens are single character strings that are not numbers, variables or whitespace
		const newTok = new ExpTokenizer_Token();
		newTok.type = ExpTokenizer.SYM_TYPE;
		newTok.pos = startPos;

		for (const s of ExpTokenizer.longSymbols) {
			if (input.length - startPos >= s.length &&
				  input.substring(startPos, startPos + s.length) === s) {
				// This option matches the current long symbol
				newTok.value = s;
			}
		}
		if (newTok.value === null) {
			// Use a simple one character symbol
			newTok.value = input.substring(startPos, startPos + 1);
		}

		res.push(newTok);
		return startPos + newTok.value.length;

	}
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace ExpTokenizer {
	export type Token = ExpTokenizer_Token;
	export const Token = ExpTokenizer_Token;
}
