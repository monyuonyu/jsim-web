/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2013 Ausenco Engineering Canada Inc.
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
// 注: Java は String.format(temp, 0.0d) が例外を投げるかどうかで書式を確かめる。
//     jformat は誤りの書式でも例外を投げないので、java.util.Formatter の調べ方（double の引数 1 つで書く時）を
//     checkJavaFormat として写した。
import type { Entity } from "../basicsim/Entity.ts";
import { tr } from "../i18n/I18n.ts";
import { Input } from "./Input.ts";
import { InputErrorException } from "./InputErrorException.ts";
import type { KeywordIndex } from "./KeywordIndex.ts";
import { StringInput } from "./StringInput.ts";

export class FormatInput extends StringInput {
	constructor(key: string, cat: string, def: string | null) {
		super(key, cat, def);
	}

	/** @throws InputErrorException */
	override parse(thisEnt: Entity, kw: KeywordIndex): void {
		Input.assertCount(kw, 1);
		const temp = kw.getArg(0);
		try {
			// Java: String.format(temp, 0.0d)
			checkJavaFormat(temp);
		}
		catch (e) {
			throw new InputErrorException(tr("Invalid Java format string: %s"), temp);
		}

		this.value = temp;
	}

	override getValidInputDesc(): string {
		return tr(Input.VALID_FORMAT);
	}
}

/**
 * Java の String.format(fmt, 0.0d) が例外を投げるなら、ここでも例外を投げる（java.util.Formatter の調べ方を写したもの）。
 * TODO(移植): Formatter の全部の決まりを写したわけではない（よく使う形と、誤りになる主な形だけ）。
 */
export function checkJavaFormat(fmt: string): void {
	// java.util.Formatter の書式の正規表現
	const re = /%(\d+\$)?([-#+ 0,(<]*)?(\d+)?(\.\d+)?([tT])?([a-zA-Z%])/y;
	let ordinary = 0;   // 番号なしで使った引数の数
	let hasLast = false; // "<" で前の引数を使えるか
	let i = 0;
	while (i < fmt.length) {
		const p = fmt.indexOf("%", i);
		if (p < 0)
			break;
		re.lastIndex = p;
		const m = re.exec(fmt);
		if (m === null)
			throw new Error("UnknownFormatConversionException");  // "%" の後ろが書式でない（末尾の "%" も）
		i = re.lastIndex;

		const index = m[1];
		const flags = m[2] ?? "";
		const width = m[3] !== undefined ? Number(m[3]) : -1;
		const precision = m[4] !== undefined ? Number(m[4].substring(1)) : -1;
		const dt = m[5] !== undefined;
		const c = m[6];

		// 同じフラグが 2 度 → DuplicateFormatFlagsException
		for (let k = 0; k < flags.length; k++)
			if (flags.indexOf(flags[k]) !== k)
				throw new Error("DuplicateFormatFlagsException");

		if (dt) {
			// 日付・時刻（%t?）は double に使えない → IllegalFormatConversionException など
			throw new Error("IllegalFormatConversionException");
		}

		if (c === "%" || c === "n") {
			if (precision !== -1)
				throw new Error("IllegalFormatPrecisionException");
			if (c === "n") {
				if (flags.length > 0)
					throw new Error("IllegalFormatFlagsException");
				if (width !== -1)
					throw new Error("IllegalFormatWidthException");
			}
			else {
				for (const f of flags)
					if (f !== "-")
						throw new Error("IllegalFormatFlagsException");
				if (flags.includes("-") && width === -1)
					throw new Error("MissingFormatWidthException");
			}
			continue;
		}

		if (!"bBhHsScCdoxXeEfgGaA".includes(c))
			throw new Error("UnknownFormatConversionException");

		// フラグの調べ
		const lower = c.toLowerCase();
		if (lower === "b" || lower === "h" || lower === "s") {
			if ((lower === "b" || lower === "h") && flags.includes("#"))
				throw new Error("FormatFlagsConversionMismatchException");
			if (width === -1 && flags.includes("-"))
				throw new Error("MissingFormatWidthException");
			for (const f of "+ 0,(")
				if (flags.includes(f))
					throw new Error("FormatFlagsConversionMismatchException");
		}
		else if (lower === "c" || lower === "d" || lower === "o" || lower === "x") {
			// 文字・整数の書式は double に使えない → IllegalFormatConversionException（その前の調べでも誤りになる）
			throw new Error("IllegalFormatConversionException");
		}
		else {
			// e f g a（checkNumeric と checkFloat）
			if ((flags.includes("-") || flags.includes("0")) && width === -1)
				throw new Error("MissingFormatWidthException");
			if (flags.includes("+") && flags.includes(" "))
				throw new Error("IllegalFormatFlagsException");
			if (flags.includes("-") && flags.includes("0"))
				throw new Error("IllegalFormatFlagsException");
			if (lower === "e" && flags.includes(","))
				throw new Error("FormatFlagsConversionMismatchException");
			if (lower === "g" && flags.includes("#"))
				throw new Error("FormatFlagsConversionMismatchException");
			if (lower === "a" && (flags.includes("(") || flags.includes(",")))
				throw new Error("FormatFlagsConversionMismatchException");
		}

		// 引数の数（引数は 0.0d の 1 つだけ）
		if (flags.includes("<")) {
			if (!hasLast)
				throw new Error("MissingFormatArgumentException");
		}
		else if (index !== undefined) {
			const n = Number(index.substring(0, index.length - 1));
			if (n > 1)
				throw new Error("MissingFormatArgumentException");
		}
		else {
			ordinary++;
			if (ordinary > 1)
				throw new Error("MissingFormatArgumentException");
		}
		hasLast = true;

		// %s に "#" は、引数が Formattable でないので FormatFlagsConversionMismatchException
		if (lower === "s" && flags.includes("#"))
			throw new Error("FormatFlagsConversionMismatchException");
	}
}
