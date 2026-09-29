/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2013 Ausenco Engineering Canada Inc.
 * Copyright (C) 2018-2024 JaamSim Software Inc.
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
// 注: tokenize の多重定義（3 引数と 4 引数）は、引数の数で見分ける。
// Java の String.split・String.trim と同じ振る舞いの補助（jsplit・jtrim）も、ここに置く。

// Input.BRACE_SEPARATOR・Input.SEPARATOR と同じ値（Parser を Input に頼らず読み込めるように、ここにも置く）
const BRACE_SEPARATOR = " ";
const SEPARATOR = "  ";

/**
 * Java の String.trim（前後の、文字の値が ' ' 以下の文字を除く。JS の trim とは除く文字が違う）
 */
export function jtrim(s: string): string {
	let st = 0;
	let len = s.length;
	while (st < len && s.charCodeAt(st) <= 32)
		st++;
	while (st < len && s.charCodeAt(len - 1) <= 32)
		len--;
	return (st > 0 || len < s.length) ? s.substring(st, len) : s;
}

/**
 * Java の String.split(regex, limit)。
 * limit が 0 なら、末尾の空の文字列を除く。正でなければ全部に分ける。正なら、多くても limit 個。
 * 何も一致しなければ [str]。先頭の幅 0 の一致による空の文字列は除く（Java 8 以降）。
 */
export function jsplit(str: string, regex: string | RegExp, limit = 0): string[] {
	const src = typeof regex === "string" ? regex : regex.source;
	const flags = typeof regex === "string" ? "g" : (regex.flags.includes("g") ? regex.flags : regex.flags + "g");
	const re = new RegExp(src, flags);
	const ret: string[] = [];
	let index = 0;
	let m: RegExpExecArray | null;
	while ((m = re.exec(str)) !== null) {
		if (m[0].length === 0) {
			// 幅 0 の一致
			if (m.index === 0 || m.index >= str.length) {
				re.lastIndex++;
				continue;
			}
		}
		if (limit > 0 && ret.length >= limit - 1)
			break;
		ret.push(str.substring(index, m.index));
		index = m.index + m[0].length;
		if (m[0].length === 0)
			re.lastIndex++;
	}
	// 一致が無ければ元の文字列
	if (index === 0 && ret.length === 0)
		return [str];
	ret.push(str.substring(index));
	if (limit === 0) {
		let n = ret.length;
		while (n > 0 && ret[n - 1] === "")
			n--;
		ret.length = n;
	}
	return ret;
}

export class Parser {

	/**
	 * Tokenize the given record and append to the given list of tokens
	 *
	 * Valid delimiter characters are space, tab and comma.
	 *
	 * tokenize(tokens, rec, stripComments) と tokenize(tokens, rec, quoted, stripComments) の両方。
	 * @param tokens list of String tokens to append to
	 * @param rec record to tokenize and append
	 * @param stripComments if true, do not append any commented tokens
	 * @return true if in quoted context
	 */
	static tokenize(tokens: string[], rec: string, stripComments: boolean): boolean;
	static tokenize(tokens: string[], rec: string, quoted: boolean, stripComments: boolean): boolean;
	static tokenize(tokens: string[], rec: string, a: boolean, b?: boolean): boolean {
		if (b === undefined)
			return Parser.tokenize(tokens, rec, false, a);
		const quoted = a;
		const stripComments = b;

		// Already in the quoted state
		let recStart = 0;
		if (quoted) {

			// Find the closing single quote
			for (let i = 0; i < rec.length; i++) {
				const c = rec.charAt(i);
				if (c === "'") {
					const lastRec = tokens.splice(tokens.length - 1, 1)[0];
					tokens.push(lastRec + rec.substring(0, i));
					recStart = i + 1;
					break;
				}
			}

			// If no closing single quote is found, then append the entire record to the previous token
			if (recStart === 0) {
				const lastRec = tokens.splice(tokens.length - 1, 1)[0];
				tokens.push(lastRec + rec + "\n");
				return true;
			}
		}

		// Records can be divided into two pieces, the contents portion and possibly
		// a commented portion, the division point is the first " character, if no
		// quoting in a record, the entire line is contents for tokenizing
		let tokStart = -1;
		let quoteStart = -1;
		let cIndex = -1;
		let endOfRec = rec.length;
		for (let i = recStart; i < rec.length; i++) {
			const c = rec.charAt(i);
			if (c === "'") {
				// end the current token
				if (tokStart !== -1) {
					if (i - tokStart > 0) tokens.push(rec.substring(tokStart, i));
					tokStart = -1;
				}

				// Set the quoting state
				if (quoteStart !== -1) {
					tokens.push(rec.substring(quoteStart + 1, i));
					quoteStart = -1;
				}
				else {
					quoteStart = i;
				}
				continue;
			}

			// we are currently quoted, skip
			if (quoteStart > -1)
				continue;

			// handle delimiter chars
			if (c === "{" || c === "}" || c === " " || c === "\t" || c === "\n") {
				if (tokStart !== -1 && i - tokStart > 0) {
					tokens.push(rec.substring(tokStart, i));
					tokStart = -1;
				}

				if (c === "{")
					tokens.push("{");

				if (c === "}")
					tokens.push("}");

				continue;
			}

			// start a comment
			if (c === "#") {
				cIndex = i;
				endOfRec = i;
				break;
			}
			// start a new token
			if (tokStart === -1) tokStart = i;
		}

		// clean up the final trailing token
		if (tokStart !== -1)
			tokens.push(rec.substring(tokStart, endOfRec));

		if (quoteStart !== -1)
			tokens.push(rec.substring(quoteStart + 1, endOfRec) + "\n");

		// add comments if they exist including the leading # to denote it as commented
		if (!stripComments && cIndex > -1)
			tokens.push(rec.substring(cIndex, rec.length));

		return quoteStart !== -1;
	}

	static needsQuoting(s: string): boolean {
		for (let i = 0; i < s.length; ++i) {
			const c = s.charAt(i);
			if (c === " " || c === "\t" || c === "{" || c === "}" || c === "\"" || c === "#" || c === "\n")
				return true;
		}
		return false;
	}

	static isQuoted(s: string): boolean {
		if (s.length < 2) return false;
		if (s.charAt(0) !== "'") return false;
		if (s.charAt(s.length - 1) !== "'") return false;

		return true;
	}

	static addQuotes(str: string): string {
		return Parser.addEnclosure("'", str, "'");
	}

	static addQuotesIfNeeded(str: string): string {
		if (Parser.needsQuoting(str) && !Parser.isQuoted(str))
			return Parser.addQuotes(str);
		return str;
	}

	static addEnclosure(prefix: string, str: string, suffix: string): string {
		let sb = "";
		if (!str.startsWith(prefix))
			sb += prefix;
		sb += str;
		if (!str.endsWith(suffix))
			sb += suffix;
		return sb;
	}

	static removeEnclosure(prefix: string, str: string, suffix: string): string {
		if (!str.startsWith(prefix) && !str.endsWith(suffix))
			return str;
		let beginIndex = 0;
		let endIndex = str.length;
		if (str.startsWith(prefix))
			beginIndex = prefix.length;
		if (str.endsWith(suffix))
			endIndex -= suffix.length;
		// Java の substring は beginIndex > endIndex で例外になる（"[" 1 文字など）
		if (beginIndex > endIndex)
			throw new RangeError(`begin ${beginIndex}, end ${endIndex}, length ${str.length}`);
		return str.substring(beginIndex, endIndex);
	}

	/**
	 * Parses the specified input string into an array of input substrings that were grouped by opening
	 * and closing curly braces.
	 * @param str - input string
	 * @return array of substrings
	 */
	static splitSubstrings(str: string): string[] {
		str = jtrim(str);
		if (str.charAt(0) === "{") {  // TODO(移植): Java は空の文字列で例外（StringIndexOutOfBounds）。ここでは例外にしない
			str = str.substring(1);
		}
		if (str.length > 0 && str.charAt(str.length - 1) === "}") {
			str = str.substring(0, str.length - 1);
		}
		const ret = jsplit(str, "\\}\\s*\\{");
		for (let i = 0; i < ret.length; i++) {
			ret[i] = jtrim(ret[i]);
		}
		return ret;
	}

	/**
	 * Returns a formated input string that includes single quote marks when necessary around the
	 * contents of each pair of curly braces.<p>
	 * Note that the format for the returned string MUST be consistent with Input.getValueString
	 * otherwise any carriage returns added in the Input Builder will be lost when
	 * CellEditor.setInputValue is executed on the completion of editing.
	 * @param str - input string to be formated
	 * @return formatted input string
	 */
	static addSubstringQuotesIfNeeded(str: string): string {
		const array = Parser.splitSubstrings(str);
		let sb = "";
		for (let i = 0; i < array.length; i++) {
			if (i > 0)
				sb += BRACE_SEPARATOR;
			sb += "{" + BRACE_SEPARATOR;
			sb += Parser.addQuotesIfNeeded(array[i]);
			sb += BRACE_SEPARATOR + "}";
		}
		return sb;
	}

	static addQuotesIfNeededToDefinitions(str: string): string {
		const array = Parser.splitSubstrings(str);
		let sb = "";
		for (let i = 0; i < array.length; i++) {
			const args = jsplit(array[i], "\\s+", 2);

			// Opening curly brace
			if (i > 0)
				sb += BRACE_SEPARATOR;
			sb += "{" + BRACE_SEPARATOR;

			// Name of the attribute or custom output
			sb += args[0];

			// Parse the unit type if present
			if (args.length === 2) {
				let utName = "";
				if (args[1].endsWith("Unit")) {
					const index = args[1].lastIndexOf(" ") + 1;
					utName = args[1].substring(index);
					args[1] = jtrim(args[1].substring(0, index));
				}

				// Expression for the attribute or custom output value
				args[1] = Parser.addQuotesIfNeeded(args[1]);
				sb += SEPARATOR + args[1];

				// Unit type if present
				if (utName.length > 0) {
					sb += SEPARATOR + utName;
				}
			}
			sb += BRACE_SEPARATOR + "}";
		}
		return sb;
	}

}
