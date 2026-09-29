/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2017-2025 JaamSim Software Inc.
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
//
// Java の匿名クラス（new UnOpFunc() { ... } など）は、同じ関数を持つオブジェクトにした。
// Java の Collections.sort（sort 関数）は、比べ方が一貫しない（0 を返さない）ので、JS の sort では並びが Java と違いうる。
// そのため Java の TimSort をこのファイルの中に写した（javaListSort）。
// Java の String.format（format 関数）・String.split（split 関数）・String.trim（trim 関数）も、Java と同じ結果になるように書いた。
import type { JClass } from "../java/lang.ts";
import { jformat, jstr, JMath, Double, IllegalArgumentException, IndexOutOfBoundsException } from "../java/lang.ts";
import { ClassRegistry } from "../java/ClassRegistry.ts";
import { tr } from "../i18n/I18n.ts";
import { BetaDistribution } from "../ProbabilityDistributions/BetaDistribution.ts";
import { BinomialDistribution } from "../ProbabilityDistributions/BinomialDistribution.ts";
import { ContinuousDistribution } from "../ProbabilityDistributions/ContinuousDistribution.ts";
import { DiscreteDistribution } from "../ProbabilityDistributions/DiscreteDistribution.ts";
import { DiscreteUniformDistribution } from "../ProbabilityDistributions/DiscreteUniformDistribution.ts";
import { ErlangDistribution } from "../ProbabilityDistributions/ErlangDistribution.ts";
import { ExponentialDistribution } from "../ProbabilityDistributions/ExponentialDistribution.ts";
import { GammaDistribution } from "../ProbabilityDistributions/GammaDistribution.ts";
import { GeometricDistribution } from "../ProbabilityDistributions/GeometricDistribution.ts";
import { LogLogisticDistribution } from "../ProbabilityDistributions/LogLogisticDistribution.ts";
import { LogNormalDistribution } from "../ProbabilityDistributions/LogNormalDistribution.ts";
import { NegativeBinomialDistribution } from "../ProbabilityDistributions/NegativeBinomialDistribution.ts";
import { NormalDistribution } from "../ProbabilityDistributions/NormalDistribution.ts";
import { PoissonDistribution } from "../ProbabilityDistributions/PoissonDistribution.ts";
import { TriangularDistribution } from "../ProbabilityDistributions/TriangularDistribution.ts";
import { UniformDistribution } from "../ProbabilityDistributions/UniformDistribution.ts";
import { WeibullDistribution } from "../ProbabilityDistributions/WeibullDistribution.ts";
import type { Entity } from "../basicsim/Entity.ts";
import type { JaamSimModel } from "../basicsim/JaamSimModel.ts";
import { EventManager } from "../events/EventManager.ts";
import { MathUtils } from "../math/MathUtils.ts";
import type { MRG1999a } from "../rng/MRG1999a.ts";
import { AngleUnit } from "../units/AngleUnit.ts";
import { DimensionlessUnit } from "../units/DimensionlessUnit.ts";
import { TimeUnit } from "../units/TimeUnit.ts";
import type { Unit } from "../units/Unit.ts";
import { ExpCollections } from "./ExpCollections.ts";
import { ExpError } from "./ExpError.ts";
import type { ExpEvaluator_EntityEvalContext } from "./ExpEvaluator.ts";
import { ExpParser } from "./ExpParser.ts";
import type {
	ExpParser_BinOpFunc, ExpParser_CallableFunc, ExpParser_EvalContext, ExpParser_ExpNode,
	ExpParser_LambdaClosure, ExpParser_LazyBinOpFunc, ExpParser_ParseContext, ExpParser_UnOpFunc,
} from "./ExpParser.ts";
import { ExpResType } from "./ExpResType.ts";
import { ExpResult } from "./ExpResult.ts";
import { ExpValResult } from "./ExpValResult.ts";

type UnitClass = JClass<Unit>;
type ParseContext = ExpParser_ParseContext;
type EvalContext = ExpParser_EvalContext;

// ---------------------------------------------------------------------------
// Java の振る舞いを写した小さな部品（移植で足したもの）
// ---------------------------------------------------------------------------

/** Java の (int) x（double → int。0 の方向へ切り捨て、NaN は 0、int の範囲に収める） */
function d2i(x: number): number {
	if (Number.isNaN(x)) return 0;
	if (x >= 2147483647) return 2147483647;
	if (x <= -2147483648) return -2147483648;
	return Math.trunc(x);
}

/** Java の Math.round(double)（long を返す。NaN は 0、-0.4 は 0（-0 にならない）、long の範囲に収める） */
function javaRound(x: number): number {
	if (Number.isNaN(x)) return 0;
	if (x >= 9223372036854775807) return 9223372036854775807;
	if (x <= -9223372036854775808) return -9223372036854775808;
	const r = Math.round(x);
	return r === 0 ? 0 : r;
}

/** クラスの単純な名前（Java の getSimpleName()。null は NullPointerException） */
function simpleName(u: UnitClass | null): string {
	if (u === null)
		throw new TypeError("NullPointerException");
	return ClassRegistry.simpleName(u);
}

/** Java の String.trim()（前後の ' ' 以下の文字を除く） */
function javaTrim(s: string): string {
	let st = 0;
	let len = s.length;
	while (st < len && s.charCodeAt(st) <= 0x20)
		st++;
	while (st < len && s.charCodeAt(len - 1) <= 0x20)
		len--;
	return (st > 0 || len < s.length) ? s.substring(st, len) : s;
}

/** Java の String.split(regex, limit)（Pattern.split と同じ手順） */
function javaSplit(input: string, regex: string, limit: number): string[] {
	let re: RegExp;
	try {
		re = new RegExp(regex, "g");
	}
	catch (e) {
		// TODO(移植): Java の PatternSyntaxException のメッセージとは違う
		throw new IllegalArgumentException(e instanceof Error ? e.message : String(e));
	}
	let index = 0;
	const matchLimited = limit > 0;
	const matchList: string[] = [];
	re.lastIndex = 0;
	let m: RegExpExecArray | null;
	while ((m = re.exec(input)) !== null) {
		const start = m.index;
		const end = start + m[0].length;
		if (end === start)
			re.lastIndex = end + 1;  // 空の一致の次は 1 つ進めて探す（Java の Matcher.find と同じ）
		if (start > input.length)
			break;
		if (!matchLimited || matchList.length < limit - 1) {
			if (index === 0 && index === start && start === end) {
				// no empty leading substring included for zero-width match
				// at the beginning of the input char sequence.
				continue;
			}
			const match = input.substring(index, start);
			matchList.push(match);
			index = end;
		} else if (matchList.length === limit - 1) { // last one
			const match = input.substring(index, input.length);
			matchList.push(match);
			index = end;
		}
	}

	// If no match was found, return this
	if (index === 0)
		return [input];

	// Add remaining segment
	if (!matchLimited || matchList.length < limit)
		matchList.push(input.substring(index, input.length));

	// Construct result
	let resultSize = matchList.length;
	if (limit === 0)
		while (resultSize > 0 && matchList[resultSize - 1] === "")
			resultSize--;
	return matchList.slice(0, resultSize);
}

/** Java の format の失敗（IllegalFormatException など）。メッセージは Java の getMessage() と同じ */
class JavaFormatError extends IllegalArgumentException {}

/**
 * Java の String.format(fmt, args)。args の要素は文字列（Java の String）か数（Java の Double）。
 * 数を %d %x %c に渡したときなど、Java が例外にする所は同じメッセージの JavaFormatError を投げる。
 */
function javaFormatStringsAndDoubles(fmt: string, args: (string | number)[]): string {
	const spec = /%(\d+\$)?([-#+ 0,(<]*)(\d+)?(\.\d+)?([a-zA-Z%])/g;
	let ordinary = 0;
	let last = 0;
	let m: RegExpExecArray | null;
	while ((m = spec.exec(fmt)) !== null) {
		// 書式の間の文字に、読めない % があれば Java は UnknownFormatConversionException
		const gap = fmt.substring(last, m.index);
		const bad = gap.indexOf("%");
		if (bad >= 0)
			throw new JavaFormatError(`Conversion = '${gap.charAt(bad + 1) || "%"}'`);
		last = spec.lastIndex;
		const c = m[5];
		if (c === "%" || c === "n")
			continue;
		if (!"bBhHsScCdoxXeEfgGaA".includes(c) || (m[2].includes("<")))
			throw new JavaFormatError(`Conversion = '${c}'`);  // TODO(移植): %< と %t は写していない
		let argIndex: number;
		if (m[1] !== undefined)
			argIndex = Number(m[1].slice(0, -1)) - 1;
		else
			argIndex = ordinary++;
		if (argIndex < 0 || argIndex >= args.length)
			throw new JavaFormatError(`Format specifier '${m[0]}'`);
		const v = args[argIndex];
		const isDouble = typeof v === "number";
		const typeName = isDouble ? "java.lang.Double" : "java.lang.String";
		if ("doxXcC".includes(c))  // 文字列も Double も、整数・文字の書式には使えない
			throw new JavaFormatError(`${c} != ${typeName}`);
		if ("eEfgGaA".includes(c) && !isDouble)
			throw new JavaFormatError(`${c} != ${typeName}`);
		if (c === "h" || c === "H")
			throw new JavaFormatError(`Conversion = '${c}'`);  // TODO(移植): %h（hashCode）は写していない
	}
	const tail = fmt.substring(last);
	const badTail = tail.indexOf("%");
	if (badTail >= 0)
		throw new JavaFormatError(`Conversion = '${tail.charAt(badTail + 1) || "%"}'`);

	// %s に渡す数は Java の Double.toString と同じ形にする
	const specS = /%(\d+\$)?([-#+ 0,(<]*)(\d+)?(\.\d+)?([a-zA-Z%])/g;
	let ord = 0;
	const out: unknown[] = [];
	let n: RegExpExecArray | null;
	while ((n = specS.exec(fmt)) !== null) {
		const c = n[5];
		if (c === "%" || c === "n")
			continue;
		const idx = n[1] !== undefined ? Number(n[1].slice(0, -1)) - 1 : ord++;
		const v = args[idx];
		out.push((c === "s" || c === "S") && typeof v === "number" ? jstr(v) : v);
	}
	// jformat は引数を順に使うので、%1$s などの番号つきは番号を外して並べ直した書式で呼ぶ
	const plainFmt = fmt.replace(/%(\d+\$)([-#+ 0,(<]*)(\d+)?(\.\d+)?([a-zA-Z%])/g,
			(_all, _p: string, f: string, w: string | undefined, pr: string | undefined, c: string) => `%${f}${w ?? ""}${pr ?? ""}${c}`);
	return jformat(plainFmt, ...out);
}

// ---- Java の TimSort（java.util.TimSort を写したもの。Collections.sort と同じ並びにする） ----

const MIN_MERGE = 32;
const MIN_GALLOP = 7;

/** Java の Collections.sort(list, c)（リストの中身を並べ替える） */
function javaListSort<T>(a: T[], c: (x: T, y: T) => number): void {
	timSort(a, 0, a.length, c);
}

function timSort<T>(a: T[], lo: number, hi: number, c: (x: T, y: T) => number): void {
	let nRemaining = hi - lo;
	if (nRemaining < 2)
		return;  // Arrays of size 0 and 1 are always sorted

	// If array is small, do a "mini-TimSort" with no merges
	if (nRemaining < MIN_MERGE) {
		const initRunLen = countRunAndMakeAscending(a, lo, hi, c);
		binarySort(a, lo, hi, lo + initRunLen, c);
		return;
	}

	const ts = new TimSortState(a, c);
	const minRun = minRunLength(nRemaining);
	do {
		// Identify next run
		let runLen = countRunAndMakeAscending(a, lo, hi, c);

		// If run is short, extend to min(minRun, nRemaining)
		if (runLen < minRun) {
			const force = nRemaining <= minRun ? nRemaining : minRun;
			binarySort(a, lo, lo + force, lo + runLen, c);
			runLen = force;
		}

		// Push run onto pending-run stack, and maybe merge
		ts.pushRun(lo, runLen);
		ts.mergeCollapse();

		// Advance to find next run
		lo += runLen;
		nRemaining -= runLen;
	} while (nRemaining !== 0);

	ts.mergeForceCollapse();
}

function binarySort<T>(a: T[], lo: number, hi: number, start: number, c: (x: T, y: T) => number): void {
	if (start === lo)
		start++;
	for ( ; start < hi; start++) {
		const pivot = a[start];

		// Set left (and right) to the index where a[start] (pivot) belongs
		let left = lo;
		let right = start;
		while (left < right) {
			const mid = (left + right) >>> 1;
			if (c(pivot, a[mid]) < 0)
				right = mid;
			else
				left = mid + 1;
		}
		const n = start - left;  // The number of elements to move
		for (let k = n; k > 0; k--)
			a[left + k] = a[left + k - 1];
		a[left] = pivot;
	}
}

function countRunAndMakeAscending<T>(a: T[], lo: number, hi: number, c: (x: T, y: T) => number): number {
	let runHi = lo + 1;
	if (runHi === hi)
		return 1;

	// Find end of run, and reverse range if descending
	if (c(a[runHi++], a[lo]) < 0) { // Descending
		while (runHi < hi && c(a[runHi], a[runHi - 1]) < 0)
			runHi++;
		reverseRange(a, lo, runHi);
	} else {                              // Ascending
		while (runHi < hi && c(a[runHi], a[runHi - 1]) >= 0)
			runHi++;
	}

	return runHi - lo;
}

function reverseRange<T>(a: T[], lo: number, hi: number): void {
	hi--;
	while (lo < hi) {
		const t = a[lo];
		a[lo++] = a[hi];
		a[hi--] = t;
	}
}

function minRunLength(n: number): number {
	let r = 0;      // Becomes 1 if any 1 bits are shifted off
	while (n >= MIN_MERGE) {
		r |= (n & 1);
		n >>= 1;
	}
	return n + r;
}

/** System.arraycopy（同じ配列の重なりも正しく写す） */
function arraycopy<T>(src: T[], srcPos: number, dest: T[], destPos: number, length: number): void {
	if (src === dest && srcPos < destPos) {
		for (let i = length - 1; i >= 0; i--)
			dest[destPos + i] = src[srcPos + i];
	}
	else {
		for (let i = 0; i < length; i++)
			dest[destPos + i] = src[srcPos + i];
	}
}

function gallopLeft<T>(key: T, a: T[], base: number, len: number, hint: number, c: (x: T, y: T) => number): number {
	let lastOfs = 0;
	let ofs = 1;
	if (c(key, a[base + hint]) > 0) {
		// Gallop right until a[base+hint+lastOfs] < key <= a[base+hint+ofs]
		const maxOfs = len - hint;
		while (ofs < maxOfs && c(key, a[base + hint + ofs]) > 0) {
			lastOfs = ofs;
			ofs = ((ofs << 1) + 1) | 0;
			if (ofs <= 0)   // int overflow
				ofs = maxOfs;
		}
		if (ofs > maxOfs)
			ofs = maxOfs;

		// Make offsets relative to base
		lastOfs += hint;
		ofs += hint;
	} else { // key <= a[base + hint]
		// Gallop left until a[base+hint-ofs] < key <= a[base+hint-lastOfs]
		const maxOfs = hint + 1;
		while (ofs < maxOfs && c(key, a[base + hint - ofs]) <= 0) {
			lastOfs = ofs;
			ofs = ((ofs << 1) + 1) | 0;
			if (ofs <= 0)   // int overflow
				ofs = maxOfs;
		}
		if (ofs > maxOfs)
			ofs = maxOfs;

		// Make offsets relative to base
		const tmp = lastOfs;
		lastOfs = hint - ofs;
		ofs = hint - tmp;
	}

	lastOfs++;
	while (lastOfs < ofs) {
		const m = lastOfs + ((ofs - lastOfs) >>> 1);

		if (c(key, a[base + m]) > 0)
			lastOfs = m + 1;  // a[base + m] < key
		else
			ofs = m;          // key <= a[base + m]
	}
	return ofs;
}

function gallopRight<T>(key: T, a: T[], base: number, len: number, hint: number, c: (x: T, y: T) => number): number {
	let ofs = 1;
	let lastOfs = 0;
	if (c(key, a[base + hint]) < 0) {
		// Gallop left until a[b+hint - ofs] <= key < a[b+hint - lastOfs]
		const maxOfs = hint + 1;
		while (ofs < maxOfs && c(key, a[base + hint - ofs]) < 0) {
			lastOfs = ofs;
			ofs = ((ofs << 1) + 1) | 0;
			if (ofs <= 0)   // int overflow
				ofs = maxOfs;
		}
		if (ofs > maxOfs)
			ofs = maxOfs;

		// Make offsets relative to b
		const tmp = lastOfs;
		lastOfs = hint - ofs;
		ofs = hint - tmp;
	} else { // a[b + hint] <= key
		// Gallop right until a[b+hint + lastOfs] <= key < a[b+hint + ofs]
		const maxOfs = len - hint;
		while (ofs < maxOfs && c(key, a[base + hint + ofs]) >= 0) {
			lastOfs = ofs;
			ofs = ((ofs << 1) + 1) | 0;
			if (ofs <= 0)   // int overflow
				ofs = maxOfs;
		}
		if (ofs > maxOfs)
			ofs = maxOfs;

		// Make offsets relative to b
		lastOfs += hint;
		ofs += hint;
	}

	lastOfs++;
	while (lastOfs < ofs) {
		const m = lastOfs + ((ofs - lastOfs) >>> 1);

		if (c(key, a[base + m]) < 0)
			ofs = m;          // key < a[b + m]
		else
			lastOfs = m + 1;  // a[b + m] <= key
	}
	return ofs;
}

class TimSortState<T> {
	private readonly a: T[];
	private readonly c: (x: T, y: T) => number;
	private minGallop = MIN_GALLOP;
	private stackSize = 0;  // Number of pending runs on stack
	private readonly runBase: number[] = [];
	private readonly runLen: number[] = [];

	constructor(a: T[], c: (x: T, y: T) => number) {
		this.a = a;
		this.c = c;
	}

	pushRun(runBase: number, runLen: number): void {
		this.runBase[this.stackSize] = runBase;
		this.runLen[this.stackSize] = runLen;
		this.stackSize++;
	}

	mergeCollapse(): void {
		const runLen = this.runLen;
		while (this.stackSize > 1) {
			let n = this.stackSize - 2;
			if (n > 0 && runLen[n-1] <= runLen[n] + runLen[n+1] ||
				n > 1 && runLen[n-2] <= runLen[n] + runLen[n-1]) {
				if (runLen[n - 1] < runLen[n + 1])
					n--;
			} else if (n < 0 || runLen[n] > runLen[n + 1]) {
				break; // Invariant is established
			}
			this.mergeAt(n);
		}
	}

	mergeForceCollapse(): void {
		const runLen = this.runLen;
		while (this.stackSize > 1) {
			let n = this.stackSize - 2;
			if (n > 0 && runLen[n - 1] < runLen[n + 1])
				n--;
			this.mergeAt(n);
		}
	}

	private mergeAt(i: number): void {
		const a = this.a;
		const c = this.c;
		let base1 = this.runBase[i];
		let len1 = this.runLen[i];
		const base2 = this.runBase[i + 1];
		let len2 = this.runLen[i + 1];

		this.runLen[i] = len1 + len2;
		if (i === this.stackSize - 3) {
			this.runBase[i + 1] = this.runBase[i + 2];
			this.runLen[i + 1] = this.runLen[i + 2];
		}
		this.stackSize--;

		const k = gallopRight(a[base2], a, base1, len1, 0, c);
		base1 += k;
		len1 -= k;
		if (len1 === 0)
			return;

		len2 = gallopLeft(a[base1 + len1 - 1], a, base2, len2, len2 - 1, c);
		if (len2 === 0)
			return;

		// Merge remaining runs, using tmp array with min(len1, len2) elements
		if (len1 <= len2)
			this.mergeLo(base1, len1, base2, len2);
		else
			this.mergeHi(base1, len1, base2, len2);
	}

	private mergeLo(base1: number, len1: number, base2: number, len2: number): void {
		const a = this.a;
		const tmp: T[] = new Array<T>(len1);
		let cursor1 = 0;       // Indexes into tmp array
		let cursor2 = base2;   // Indexes int a
		let dest = base1;      // Indexes int a
		arraycopy(a, base1, tmp, cursor1, len1);

		// Move first element of second run and deal with degenerate cases
		a[dest++] = a[cursor2++];
		if (--len2 === 0) {
			arraycopy(tmp, cursor1, a, dest, len1);
			return;
		}
		if (len1 === 1) {
			arraycopy(a, cursor2, a, dest, len2);
			a[dest + len2] = tmp[cursor1]; // Last elt of run 1 to end of merge
			return;
		}

		const c = this.c;
		let minGallop = this.minGallop;
		outer:
		while (true) {
			let count1 = 0; // Number of times in a row that first run won
			let count2 = 0; // Number of times in a row that second run won

			do {
				if (c(a[cursor2], tmp[cursor1]) < 0) {
					a[dest++] = a[cursor2++];
					count2++;
					count1 = 0;
					if (--len2 === 0)
						break outer;
				} else {
					a[dest++] = tmp[cursor1++];
					count1++;
					count2 = 0;
					if (--len1 === 1)
						break outer;
				}
			} while ((count1 | count2) < minGallop);

			do {
				count1 = gallopRight(a[cursor2], tmp, cursor1, len1, 0, c);
				if (count1 !== 0) {
					arraycopy(tmp, cursor1, a, dest, count1);
					dest += count1;
					cursor1 += count1;
					len1 -= count1;
					if (len1 <= 1) // len1 == 1 || len1 == 0
						break outer;
				}
				a[dest++] = a[cursor2++];
				if (--len2 === 0)
					break outer;

				count2 = gallopLeft(tmp[cursor1], a, cursor2, len2, 0, c);
				if (count2 !== 0) {
					arraycopy(a, cursor2, a, dest, count2);
					dest += count2;
					cursor2 += count2;
					len2 -= count2;
					if (len2 === 0)
						break outer;
				}
				a[dest++] = tmp[cursor1++];
				if (--len1 === 1)
					break outer;
				minGallop--;
			} while ((count1 >= MIN_GALLOP) || (count2 >= MIN_GALLOP));
			if (minGallop < 0)
				minGallop = 0;
			minGallop += 2;  // Penalize for leaving gallop mode
		}  // End of "outer" loop
		this.minGallop = minGallop < 1 ? 1 : minGallop;  // Write back to field

		if (len1 === 1) {
			arraycopy(a, cursor2, a, dest, len2);
			a[dest + len2] = tmp[cursor1]; //  Last elt of run 1 to end of merge
		} else if (len1 === 0) {
			throw new IllegalArgumentException(
				"Comparison method violates its general contract!");
		} else {
			arraycopy(tmp, cursor1, a, dest, len1);
		}
	}

	private mergeHi(base1: number, len1: number, base2: number, len2: number): void {
		const a = this.a;
		const tmp: T[] = new Array<T>(len2);
		const tmpBase = 0;
		arraycopy(a, base2, tmp, tmpBase, len2);

		let cursor1 = base1 + len1 - 1;  // Indexes into a
		let cursor2 = tmpBase + len2 - 1; // Indexes into tmp array
		let dest = base2 + len2 - 1;     // Indexes into a

		// Move last element of first run and deal with degenerate cases
		a[dest--] = a[cursor1--];
		if (--len1 === 0) {
			arraycopy(tmp, tmpBase, a, dest - (len2 - 1), len2);
			return;
		}
		if (len2 === 1) {
			dest -= len1;
			cursor1 -= len1;
			arraycopy(a, cursor1 + 1, a, dest + 1, len1);
			a[dest] = tmp[cursor2];
			return;
		}

		const c = this.c;
		let minGallop = this.minGallop;
		outer:
		while (true) {
			let count1 = 0; // Number of times in a row that first run won
			let count2 = 0; // Number of times in a row that second run won

			do {
				if (c(tmp[cursor2], a[cursor1]) < 0) {
					a[dest--] = a[cursor1--];
					count1++;
					count2 = 0;
					if (--len1 === 0)
						break outer;
				} else {
					a[dest--] = tmp[cursor2--];
					count2++;
					count1 = 0;
					if (--len2 === 1)
						break outer;
				}
			} while ((count1 | count2) < minGallop);

			do {
				count1 = len1 - gallopRight(tmp[cursor2], a, base1, len1, len1 - 1, c);
				if (count1 !== 0) {
					dest -= count1;
					cursor1 -= count1;
					len1 -= count1;
					arraycopy(a, cursor1 + 1, a, dest + 1, count1);
					if (len1 === 0)
						break outer;
				}
				a[dest--] = tmp[cursor2--];
				if (--len2 === 1)
					break outer;

				count2 = len2 - gallopLeft(a[cursor1], tmp, tmpBase, len2, len2 - 1, c);
				if (count2 !== 0) {
					dest -= count2;
					cursor2 -= count2;
					len2 -= count2;
					arraycopy(tmp, cursor2 + 1, a, dest + 1, count2);
					if (len2 <= 1)  // len2 == 1 || len2 == 0
						break outer;
				}
				a[dest--] = a[cursor1--];
				if (--len1 === 0)
					break outer;
				minGallop--;
			} while ((count1 >= MIN_GALLOP) || (count2 >= MIN_GALLOP));
			if (minGallop < 0)
				minGallop = 0;
			minGallop += 2;  // Penalize for leaving gallop mode
		}  // End of "outer" loop
		this.minGallop = minGallop < 1 ? 1 : minGallop;  // Write back to field

		if (len2 === 1) {
			dest -= len1;
			cursor1 -= len1;
			arraycopy(a, cursor1 + 1, a, dest + 1, len1);
			a[dest] = tmp[cursor2];  // Move first elt of run2 to front of merge
		} else if (len2 === 0) {
			throw new IllegalArgumentException(
				"Comparison method violates its general contract!");
		} else {
			arraycopy(tmp, tmpBase, a, dest - (len2 - 1), len2);
		}
	}
}

/** Java の配列の範囲外（args[i] の i が長さ以上）を、Java と同じく例外にする */
function argAt(args: ExpResult[], i: number): ExpResult {
	if (i >= args.length)
		throw new IndexOutOfBoundsException(`Index ${i} out of bounds for length ${args.length}`);
	return args[i];
}

/** 乱数の関数で使う: 評価の文脈の thisEnt（Java の ((EntityEvalContext) context).thisEnt） */
function thisEntOf(context: EvalContext): Entity {
	return (context as ExpEvaluator_EntityEvalContext).thisEnt;
}

type RngList = MRG1999a[];
function getRngs(simModel: JaamSimModel, key: string, seed: number, n: number): RngList {
	return simModel.getRandomGenerators(key, seed, n) as RngList;
}

export class ExpOperators {

	private static addUnaryOp(symbol: string, bindPower: number, func: ExpParser_UnOpFunc): void {
		ExpParser.addUnaryOp(symbol, bindPower, func);
	}

	private static addBinaryOp(symbol: string, bindPower: number, rAssoc: boolean, func: ExpParser_BinOpFunc): void {
		ExpParser.addBinaryOp(symbol, bindPower, rAssoc, func);
	}

	private static addLazyBinaryOp(symbol: string, bindPower: number, rAssoc: boolean, func: ExpParser_LazyBinOpFunc): void {
		ExpParser.addLazyBinaryOp(symbol, bindPower, rAssoc, func);
	}

	private static addFunction(name: string, numMinArgs: number, numMaxArgs: number, func: ExpParser_CallableFunc): void {
		ExpParser.addFunction(name, numMinArgs, numMaxArgs, func);
	}

	///////////////////////////////////////////////////
	// Operator Utility Functions

	// See if there are any existing errors, or this branch is undecidable
	private static mergeBinaryErrors(lval: ExpValResult, rval: ExpValResult): ExpValResult | null {
		if (	lval.state === ExpValResult.State.ERROR ||
				rval.state === ExpValResult.State.ERROR) {
			// Propagate the error, no further checking
			const errors: ExpError[] = [];
			if (lval.errors !== null)
				errors.push(...lval.errors);
			if (rval.errors !== null)
				errors.push(...rval.errors);
			return ExpValResult.makeErrorRes(errors);
		}

		if (	lval.state === ExpValResult.State.UNDECIDABLE ||
				rval.state === ExpValResult.State.UNDECIDABLE) {
			return ExpValResult.makeUndecidableRes();
		}

		return null;
	}

	private static mergeMultipleErrors(args: ExpValResult[]): ExpValResult | null {

		for (const val of args) {
			if (val.state === ExpValResult.State.ERROR) {
				// We have an error, merge all error results and return
				const errors: ExpError[] = [];
				for (const errVal of args) {
					if (errVal.errors !== null)
						errors.push(...errVal.errors);
				}
				return ExpValResult.makeErrorRes(errors);
			}
		}
		for (const val of args) {
			if (val.state === ExpValResult.State.UNDECIDABLE) {
				// At least one value in undecidable, propagate it
				return ExpValResult.makeUndecidableRes();
			}
		}
		return null;

	}

	/** @throws ExpError */
	private static checkBothNumbers(lval: ExpResult, rval: ExpResult, source: string, pos: number): void {
		if (lval.type !== ExpResType.NUMBER) {
			throw new ExpError(source, pos, tr("Left operand must be a number"));
		}
		if (rval.type !== ExpResType.NUMBER) {
			throw new ExpError(source, pos, tr("Right operand must be a number"));
		}
	}

	private static validateBothNumbers(lval: ExpValResult, rval: ExpValResult, source: string, pos: number): ExpValResult | null {
		if (lval.type !== ExpResType.NUMBER) {
			const error = new ExpError(source, pos, tr("Left operand must be a number"));
			return ExpValResult.makeErrorRes(error);
		}
		if (rval.type !== ExpResType.NUMBER) {
			const error = new ExpError(source, pos, tr("Right operand must be a number"));
			return ExpValResult.makeErrorRes(error);
		}

		return null;
	}

	private static validateComparison(_context: ParseContext, lval: ExpValResult, rval: ExpValResult, source: string, pos: number): ExpValResult {
		// Require both values to be the same unit type and return a dimensionless unit

		// Propagate errors
		const mergedErrors = ExpOperators.mergeBinaryErrors(lval, rval);
		if (mergedErrors !== null) {
			return mergedErrors;
		}

		const numRes = ExpOperators.validateBothNumbers(lval, rval, source, pos);
		if (numRes !== null) {
			return numRes;
		}

		// Both sub values should be valid here
		if (lval.unitType !== rval.unitType) {
			const error = new ExpError(source, pos, ExpOperators.getUnitMismatchString(lval.unitType, rval.unitType));
			return ExpValResult.makeErrorRes(error);
		}

		return ExpValResult.makeValidRes(ExpResType.NUMBER, DimensionlessUnit);
	}

	/** @throws ExpError */
	private static checkTypedComparison(_context: ParseContext, lval: ExpResult,
			rval: ExpResult, source: string, pos: number): void {

		// Check that the types are the same
		if (lval.type !== rval.type) {
			throw new ExpError(source, pos, tr("Can not compare different types. LHS: %s, RHS: %s"),
					ExpValResult.typeString(lval.type),
					ExpValResult.typeString(rval.type));
		}
		if (lval.type === ExpResType.NUMBER) {
			// Also check that the unit types are the same
			if (lval.unitType !== rval.unitType) {
				throw new ExpError(source, pos, tr("Can not compare different unit types. LHS: %s, RHS: %s"),
						simpleName(lval.unitType),
						simpleName(rval.unitType));
			}
		}
	}

	private static evaluteTypedEquality(lval: ExpResult, rval: ExpResult): boolean {
		let equal: boolean;
		switch(lval.type) {
		case ExpResType.ENTITY:
			equal = lval.entVal === rval.entVal;
			break;
		case ExpResType.STRING:
			equal = lval.stringVal === rval.stringVal;
			break;
		case ExpResType.NUMBER:
			equal = lval.value === rval.value;
			break;
		default:
			equal = false;
		}
		return equal;
	}

	private static validateTypedComparison(_context: ParseContext, lval: ExpValResult, rval: ExpValResult, source: string, pos: number): ExpValResult {
		// Propagate errors
		const mergedErrors = ExpOperators.mergeBinaryErrors(lval, rval);
		if (mergedErrors !== null) {
			return mergedErrors;
		}

		// Otherwise, check that the types are the same
		if (lval.type !== rval.type) {
			const err = new ExpError(source, pos, tr("Can not compare different types. LHS: %s, RHS: %s"),
					ExpValResult.typeString(lval.type),
					ExpValResult.typeString(rval.type));
			return ExpValResult.makeErrorRes(err);
		}

		if (lval.type === ExpResType.NUMBER) {
			// Also check that the unit types are the same
			if (lval.unitType !== rval.unitType) {
				const err = new ExpError(source, pos, tr("Can not compare different unit types. LHS: %s, RHS: %s"),
						simpleName(lval.unitType),
						simpleName(rval.unitType));
				return ExpValResult.makeErrorRes(err);
			}
		}
		return ExpValResult.makeValidRes(ExpResType.NUMBER, DimensionlessUnit);
	}


	// Validate with all args using the same units, and a new result returning 'newType' unit type
	private static validateSameUnits(_context: ParseContext, args: ExpValResult[], source: string, pos: number, newType: UnitClass | null): ExpValResult {
		const mergedErrors = ExpOperators.mergeMultipleErrors(args);
		if (mergedErrors !== null)
			return mergedErrors;

		for (let i = 1; i < args.length; ++ i) {
			if (args[i].type !== ExpResType.NUMBER) {
				const error = new ExpError(source, pos, jformat(tr("Argument %d must be a number"), i+1));
				return ExpValResult.makeErrorRes(error);
			}

			if (args[0].unitType !== args[i].unitType) {
				const error = new ExpError(source, pos, ExpOperators.getUnitMismatchString(args[0].unitType, args[i].unitType));
				return ExpValResult.makeErrorRes(error);

			}
		}
		return ExpValResult.makeValidRes(ExpResType.NUMBER, newType);
	}

	// Make sure the single argument is a collection
	private static validateCollection(_context: ParseContext, arg: ExpValResult, source: string, pos: number): ExpValResult {
		if (  arg.state === ExpValResult.State.ERROR ||
		      arg.state === ExpValResult.State.UNDECIDABLE) {
			return arg;
		}
		// Check that the argument is a collection
		if (arg.type !== ExpResType.COLLECTION) {
			const error = new ExpError(source, pos, tr("Expected Collection type argument"));
			return ExpValResult.makeErrorRes(error);
		}

		return ExpValResult.makeUndecidableRes();
	}


	// Check that a single argument is not an error and is a dimensionless unit
	private static validateSingleArgDimensionless(_context: ParseContext, arg: ExpValResult, source: string, pos: number): ExpValResult {
		if (	arg.state === ExpValResult.State.ERROR ||
				arg.state === ExpValResult.State.UNDECIDABLE)
			return arg;
		if (arg.type !== ExpResType.NUMBER) {
			const error = new ExpError(source, pos, tr("Argument must be a number"));
			return ExpValResult.makeErrorRes(error);
		}
		if (arg.unitType !== DimensionlessUnit) {
			const error = new ExpError(source, pos, ExpOperators.getUnitMismatchString(arg.unitType, DimensionlessUnit));
			return ExpValResult.makeErrorRes(error);
		}
		return ExpValResult.makeValidRes(ExpResType.NUMBER, DimensionlessUnit);
	}

	// Check that a single argument is not an error and is a dimensionless unit or angle unit
	private static validateTrigFunction(_context: ParseContext, arg: ExpValResult, source: string, pos: number): ExpValResult {
		if (	arg.state === ExpValResult.State.ERROR ||
				arg.state === ExpValResult.State.UNDECIDABLE)
			return arg;
		if (arg.type !== ExpResType.NUMBER) {
			const error = new ExpError(source, pos, tr("Argument must be a number"));
			return ExpValResult.makeErrorRes(error);
		}
		if (arg.unitType !== DimensionlessUnit && arg.unitType !== AngleUnit) {
			const error = new ExpError(source, pos, ExpOperators.getUnitMismatchString(arg.unitType, DimensionlessUnit));
			return ExpValResult.makeErrorRes(error);
		}
		return ExpValResult.makeValidRes(ExpResType.NUMBER, DimensionlessUnit);
	}

	/** @throws ExpError */
	private static checkStringFunction(arg: ExpResult, source: string, pos: number): void {
		if (arg.type !== ExpResType.STRING) {
			throw new ExpError(source, pos, tr("Argument must be a string"));
		}
	}

	private static validateStringFunction(_context: ParseContext, arg: ExpValResult, source: string, pos: number): ExpValResult {
		if (  arg.state === ExpValResult.State.ERROR ||
		      arg.state === ExpValResult.State.UNDECIDABLE) {
			return arg;
		}
		// Check that the argument is a collection
		if (arg.type !== ExpResType.STRING) {
			const error = new ExpError(source, pos, tr("Argument must be a string"));
			return ExpValResult.makeErrorRes(error);
		}
		return ExpValResult.makeValidRes(ExpResType.STRING, null);
	}

	private static validateRandomFunction(_context: ParseContext, args: ExpValResult[], source: string, pos: number): ExpValResult {
		for (const arg of args) {
			if (  arg.state === ExpValResult.State.ERROR ||
			      arg.state === ExpValResult.State.UNDECIDABLE) {
				return arg;
			}
		}
		// Check that arguments are numbers
		for (const arg of args) {
			if (arg.type !== ExpResType.NUMBER) {
				const error = new ExpError(source, pos, tr("Argument must be a number"));
				return ExpValResult.makeErrorRes(error);
			}
		}
		return ExpValResult.makeValidRes(ExpResType.NUMBER, args[0].unitType);
	}

	private static validateArrayFunction(_context: ParseContext, args: ExpValResult[], source: string, pos: number): ExpValResult {
		for (const arg of args) {
			if (  arg.state === ExpValResult.State.ERROR ||
			      arg.state === ExpValResult.State.UNDECIDABLE) {
				return arg;
			}
		}

		// Count the number of arrays
		let num = 0;
		for (let i = 0; i < args.length; i++) {
			const arg = args[i];
			if (arg.type === ExpResType.COLLECTION) {
				num++;
			}
		}
		if (num !== 2) {
			const error = new ExpError(source, pos, tr("First two inputs must be arrays"));
			return ExpValResult.makeErrorRes(error);
		}
		if (args.length === 3 && args[2].type !== ExpResType.NUMBER) {
			const error = new ExpError(source, pos, tr("Last argument must be a number"));
			return ExpValResult.makeErrorRes(error);
		}
		return ExpValResult.makeUndecidableRes();
	}

	private static unitToString(unit: UnitClass | null): string {
		if (unit === null)
			return "null";
		return ClassRegistry.simpleName(unit);
	}

	/**
	 * Java の getUnitMismatchString(Class, Class) と getUnitMismatchString(String, Class, Class) をまとめたもの
	 * （引数の数で見分ける）。
	 */
	private static getUnitMismatchString(...a: [UnitClass | null, UnitClass | null] | [string, UnitClass | null, UnitClass | null]): string {
		if (a.length === 2) {
			const s0 = ExpOperators.unitToString(a[0]);
			const s1 = ExpOperators.unitToString(a[1]);
			return jformat(tr("Unit mismatch: '%s' and '%s' are not compatible"), s0, s1);
		}
		const str = a[0];
		const s0 = ExpOperators.unitToString(a[1]);
		const s1 = ExpOperators.unitToString(a[2]);
		return jformat(tr("Unit mismatch for binary operator '%s': '%s' and '%s' are not compatible"), str, s0, s1);
	}

	private static getInvalidTrigUnitString(u0: UnitClass | null): string {
		const s0 = ExpOperators.unitToString(u0);
		return jformat(tr("Invalid unit: %s. The input to a trigonometric function must be dimensionless or an angle."), s0);
	}

	private static getInvalidUnitString(u0: UnitClass | null, u1: UnitClass | null): string {
		const s0 = ExpOperators.unitToString(u0);
		const s1 = ExpOperators.unitToString(u1);
		if (u1 === DimensionlessUnit)
			return jformat(tr("Invalid unit: %s. A dimensionless number is required."), s0);

		return jformat(tr("Invalid unit: %s. Units of %s are required."), s0, s1);
	}

	public static InitOperatorsAndFuncs(): void {
		const addUnaryOp = ExpOperators.addUnaryOp;
		const addBinaryOp = ExpOperators.addBinaryOp;
		const addLazyBinaryOp = ExpOperators.addLazyBinaryOp;
		const addFunction = ExpOperators.addFunction;
		const mergeBinaryErrors = ExpOperators.mergeBinaryErrors;
		const mergeMultipleErrors = ExpOperators.mergeMultipleErrors;
		const checkBothNumbers = ExpOperators.checkBothNumbers;
		const validateBothNumbers = ExpOperators.validateBothNumbers;
		const validateComparison = ExpOperators.validateComparison;
		const checkTypedComparison = ExpOperators.checkTypedComparison;
		const evaluteTypedEquality = ExpOperators.evaluteTypedEquality;
		const validateTypedComparison = ExpOperators.validateTypedComparison;
		const validateSameUnits = ExpOperators.validateSameUnits;
		const validateCollection = ExpOperators.validateCollection;
		const validateSingleArgDimensionless = ExpOperators.validateSingleArgDimensionless;
		const validateTrigFunction = ExpOperators.validateTrigFunction;
		const checkStringFunction = ExpOperators.checkStringFunction;
		const validateStringFunction = ExpOperators.validateStringFunction;
		const validateRandomFunction = ExpOperators.validateRandomFunction;
		const validateArrayFunction = ExpOperators.validateArrayFunction;
		const getUnitMismatchString = ExpOperators.getUnitMismatchString;
		const getInvalidTrigUnitString = ExpOperators.getInvalidTrigUnitString;
		const getInvalidUnitString = ExpOperators.getInvalidUnitString;

		///////////////////////////////////////////////////
		// Unary Operators
		addUnaryOp("-", 50, {
			apply(_context: ParseContext, val: ExpResult): ExpResult {
				return ExpResult.makeNumResult(-val.value, val.unitType);
			},
			validate(_context: ParseContext, val: ExpValResult, source: string, pos: number): ExpValResult {
				if (val.state === ExpValResult.State.VALID && val.type !== ExpResType.NUMBER) {
					const err = new ExpError(source, pos, tr("Unary negation only applies to numbers"));
					return ExpValResult.makeErrorRes(err);
				}
				return val;
			},
			checkTypeAndUnits(_context: ParseContext, val: ExpResult, source: string, pos: number): void {
				if (val.type !== ExpResType.NUMBER) {
					throw new ExpError(source, pos, tr("Unary negation only applies to numbers"));
				}
			},
		});

		addUnaryOp("+", 50, {
			apply(_context: ParseContext, val: ExpResult): ExpResult {
				return ExpResult.makeNumResult(val.value, val.unitType);
			},
			validate(_context: ParseContext, val: ExpValResult, source: string, pos: number): ExpValResult {
				if (val.state === ExpValResult.State.VALID && val.type !== ExpResType.NUMBER) {
					const err = new ExpError(source, pos, tr("Unary positive only applies to numbers"));
					return ExpValResult.makeErrorRes(err);
				}
				return val;
			},
			checkTypeAndUnits(_context: ParseContext, val: ExpResult, source: string, pos: number): void {
				if (val.type !== ExpResType.NUMBER) {
					throw new ExpError(source, pos, tr("Unary positive only applies to numbers"));
				}
			},
		});

		addUnaryOp("!", 50, {
			apply(_context: ParseContext, val: ExpResult): ExpResult {
				return ExpResult.makeNumResult(val.value === 0 ? 1 : 0, DimensionlessUnit);
			},
			validate(_context: ParseContext, val: ExpValResult, source: string, pos: number): ExpValResult {
				// If the sub expression result was valid, make it dimensionless, otherwise return the sub expression result
				if (val.state === ExpValResult.State.VALID) {
					if (val.type === ExpResType.NUMBER)
						return ExpValResult.makeValidRes(ExpResType.NUMBER, DimensionlessUnit);

					// The expression is valid, but not a number
					const error = new ExpError(source, pos, tr("Argument must be a number"));
					return ExpValResult.makeErrorRes(error);
				} else {
					return val;
				}
			},
			checkTypeAndUnits(_context: ParseContext, val: ExpResult, source: string, pos: number): void {
				if (val.type !== ExpResType.NUMBER) {
					throw new ExpError(source, pos, tr("Unary not only applies to numbers"));
				}
			},
		});

		///////////////////////////////////////////////////
		// Binary operators
		addBinaryOp("+", 20, false, {
			checkTypeAndUnits(_context: ParseContext, lval: ExpResult,
					rval: ExpResult, source: string, pos: number): void {

				switch(lval.type) {
				case ExpResType.NUMBER:
					if (rval.type !== ExpResType.NUMBER) {
						throw new ExpError(source, pos, tr("Operator '+' can only add numbers to numbers"));
					}
					if (lval.unitType !== rval.unitType) {
						throw new ExpError(source, pos, getUnitMismatchString("+", lval.unitType, rval.unitType));
					}
					return;
				case ExpResType.LAMBDA:
					throw new ExpError(source, pos, tr("Can not add to a function value"));
				case ExpResType.ENTITY:
					throw new ExpError(source, pos, tr("Can not add to an entity value"));
				default:
					return;
				}
			},
			apply(_context: ParseContext, lval: ExpResult, rval: ExpResult, source: string, pos: number): ExpResult {
				switch(lval.type) {
				case ExpResType.NUMBER:
					return ExpResult.makeNumResult(lval.value + rval.value, lval.unitType);
				case ExpResType.STRING:
					return ExpResult.makeStringResult(lval.stringVal!.concat(rval.getFormatString()));
				case ExpResType.COLLECTION:
					if (rval.type === ExpResType.COLLECTION) {
						return ExpCollections.appendCollections(lval.colVal!, rval.colVal!);
					} else {
						return ExpCollections.appendToCollection(lval.colVal!, rval);
					}
				default:
					throw new ExpError(source, pos, tr("Invalid type used in addition"));
				}
			},

			validate(_context: ParseContext, lval: ExpValResult, rval: ExpValResult, source: string, pos: number): ExpValResult {
				const mergedErrors = mergeBinaryErrors(lval, rval);
				if (mergedErrors !== null)
					return mergedErrors;

				switch(lval.type) {
				case ExpResType.NUMBER:
					if (rval.type !== ExpResType.NUMBER) {
						return ExpValResult.makeErrorRes(new ExpError(source, pos, tr("Operator '+' can only add numbers to numbers")));
					}
					if (lval.unitType !== rval.unitType) {
						return ExpValResult.makeErrorRes(new ExpError(source, pos, getUnitMismatchString("+", lval.unitType, rval.unitType)));
					}
					return ExpValResult.makeValidRes(ExpResType.NUMBER, lval.unitType);
				case ExpResType.LAMBDA:
					return ExpValResult.makeErrorRes(new ExpError(source, pos, tr("Can not add to a function value")));
				case ExpResType.ENTITY:
					return ExpValResult.makeErrorRes(new ExpError(source, pos, tr("Can not add to an entity value")));
				case ExpResType.COLLECTION:
					return ExpValResult.makeValidRes(ExpResType.COLLECTION, DimensionlessUnit);
				case ExpResType.STRING:
					return ExpValResult.makeValidRes(ExpResType.STRING, DimensionlessUnit);
				default:
					return ExpValResult.makeUndecidableRes();
				}
			},

		});

		addBinaryOp("-", 20, false, {
			checkTypeAndUnits(_context: ParseContext, lval: ExpResult,
					rval: ExpResult, source: string, pos: number): void {

				checkBothNumbers(lval, rval, source, pos);

				if (lval.unitType !== rval.unitType) {
					throw new ExpError(source, pos, getUnitMismatchString("-", lval.unitType, rval.unitType));
				}
			},
			apply(_context: ParseContext, lval: ExpResult, rval: ExpResult, _source: string, _pos: number): ExpResult {
				return ExpResult.makeNumResult(lval.value - rval.value, lval.unitType);
			},
			validate(_context: ParseContext, lval: ExpValResult, rval: ExpValResult, source: string, pos: number): ExpValResult {
				const mergedErrors = mergeBinaryErrors(lval, rval);
				if (mergedErrors !== null)
					return mergedErrors;

				const numRes = validateBothNumbers(lval, rval, source, pos);
				if (numRes !== null) {
					return numRes;
				}

				if (lval.unitType !== rval.unitType) {
					const error = new ExpError(source, pos, getUnitMismatchString("-", lval.unitType, rval.unitType));
					return ExpValResult.makeErrorRes(error);
				}
				return ExpValResult.makeValidRes(ExpResType.NUMBER, lval.unitType);
			},
		});

		addBinaryOp("*", 30, false, {
			checkTypeAndUnits(context: ParseContext, lval: ExpResult,
					rval: ExpResult, source: string, pos: number): void {

				checkBothNumbers(lval, rval, source, pos);

				const newType = context.multUnitTypes(lval.unitType, rval.unitType);
				if (newType === null) {
					throw new ExpError(source, pos, getUnitMismatchString("*", lval.unitType, rval.unitType));
				}
			},
			apply(context: ParseContext, lval: ExpResult, rval: ExpResult, _source: string, _pos: number): ExpResult {
				const newType = context.multUnitTypes(lval.unitType, rval.unitType);
				return ExpResult.makeNumResult(lval.value * rval.value, newType);
			},
			validate(context: ParseContext, lval: ExpValResult, rval: ExpValResult, source: string, pos: number): ExpValResult {
				const mergedErrors = mergeBinaryErrors(lval, rval);
				if (mergedErrors !== null)
					return mergedErrors;

				const numRes = validateBothNumbers(lval, rval, source, pos);
				if (numRes !== null) {
					return numRes;
				}

				const newType = context.multUnitTypes(lval.unitType, rval.unitType);
				if (newType === null) {
					const error = new ExpError(source, pos, getUnitMismatchString("*", lval.unitType, rval.unitType));
					return ExpValResult.makeErrorRes(error);
				}
				return ExpValResult.makeValidRes(ExpResType.NUMBER, newType);
			},
		});

		addBinaryOp("/", 30, false, {
			checkTypeAndUnits(context: ParseContext, lval: ExpResult,
					rval: ExpResult, source: string, pos: number): void {

				checkBothNumbers(lval, rval, source, pos);

				const newType = context.divUnitTypes(lval.unitType, rval.unitType);
				if (newType === null) {
					throw new ExpError(source, pos, getUnitMismatchString("/", lval.unitType, rval.unitType));
				}
			},
			apply(context: ParseContext, lval: ExpResult, rval: ExpResult, _source: string, _pos: number): ExpResult {
				const newType = context.divUnitTypes(lval.unitType, rval.unitType);
				return ExpResult.makeNumResult(lval.value / rval.value, newType);
			},

			validate(context: ParseContext, lval: ExpValResult, rval: ExpValResult, source: string, pos: number): ExpValResult {
				const mergedErrors = mergeBinaryErrors(lval, rval);
				if (mergedErrors !== null)
					return mergedErrors;

				const numRes = validateBothNumbers(lval, rval, source, pos);
				if (numRes !== null) {
					return numRes;
				}

				const newType = context.divUnitTypes(lval.unitType, rval.unitType);
				if (newType === null) {
					const error = new ExpError(source, pos, getUnitMismatchString("/", lval.unitType, rval.unitType));
					return ExpValResult.makeErrorRes(error);
				}
				return ExpValResult.makeValidRes(ExpResType.NUMBER, newType);
			},
		});

		addBinaryOp("^", 40, true, {
			checkTypeAndUnits(_context: ParseContext, lval: ExpResult,
					rval: ExpResult, source: string, pos: number): void {

				checkBothNumbers(lval, rval, source, pos);

				if (lval.unitType !== DimensionlessUnit ||
				    rval.unitType !== DimensionlessUnit) {

					throw new ExpError(source, pos, getUnitMismatchString("^", lval.unitType, rval.unitType));
				}
			},
			apply(_context: ParseContext, lval: ExpResult, rval: ExpResult, _source: string, _pos: number): ExpResult {
				return ExpResult.makeNumResult(Math.pow(lval.value, rval.value), DimensionlessUnit);
			},
			validate(_context: ParseContext, lval: ExpValResult, rval: ExpValResult, source: string, pos: number): ExpValResult {
				const mergedErrors = mergeBinaryErrors(lval, rval);
				if (mergedErrors !== null)
					return mergedErrors;

				const numRes = validateBothNumbers(lval, rval, source, pos);
				if (numRes !== null) {
					return numRes;
				}

				if (	lval.unitType !== DimensionlessUnit ||
						rval.unitType !== DimensionlessUnit) {
					const error = new ExpError(source, pos, getUnitMismatchString("^", lval.unitType, rval.unitType));
					return ExpValResult.makeErrorRes(error);
				}
				return ExpValResult.makeValidRes(ExpResType.NUMBER, DimensionlessUnit);
			},
		});

		addBinaryOp("%", 30, false, {
			checkTypeAndUnits(_context: ParseContext, lval: ExpResult,
					rval: ExpResult, source: string, pos: number): void {

				checkBothNumbers(lval, rval, source, pos);

				if (lval.unitType !== rval.unitType) {
					throw new ExpError(source, pos, getUnitMismatchString("%", lval.unitType, rval.unitType));
				}
			},
			apply(_context: ParseContext, lval: ExpResult, rval: ExpResult, _source: string, _pos: number): ExpResult {
				return ExpResult.makeNumResult(lval.value % rval.value, lval.unitType);
			},
			validate(_context: ParseContext, lval: ExpValResult, rval: ExpValResult, source: string, pos: number): ExpValResult {
				const mergedErrors = mergeBinaryErrors(lval, rval);
				if (mergedErrors !== null)
					return mergedErrors;

				const numRes = validateBothNumbers(lval, rval, source, pos);
				if (numRes !== null) {
					return numRes;
				}

				if (lval.unitType !== rval.unitType) {
					const error = new ExpError(source, pos, getUnitMismatchString("%", lval.unitType, rval.unitType));
					return ExpValResult.makeErrorRes(error);
				}
				return ExpValResult.makeValidRes(ExpResType.NUMBER, lval.unitType);
			},
		});

		addBinaryOp("==", 10, false, {
			checkTypeAndUnits(context: ParseContext, lval: ExpResult,
					rval: ExpResult, source: string, pos: number): void {
				checkTypedComparison(context, lval, rval, source, pos);
			},

			apply(_context: ParseContext, lval: ExpResult, rval: ExpResult, _source: string, _pos: number): ExpResult {
				const equal = evaluteTypedEquality(lval, rval);
				return ExpResult.makeNumResult(equal ? 1 : 0, DimensionlessUnit);
			},
			validate(context: ParseContext, lval: ExpValResult, rval: ExpValResult, source: string, pos: number): ExpValResult {
				return validateTypedComparison(context, lval, rval, source, pos);
			},
		});

		addBinaryOp("!=", 10, false, {
			checkTypeAndUnits(context: ParseContext, lval: ExpResult,
					rval: ExpResult, source: string, pos: number): void {
				checkTypedComparison(context, lval, rval, source, pos);
			},
			apply(_context: ParseContext, lval: ExpResult, rval: ExpResult, _source: string, _pos: number): ExpResult {
				const equal = evaluteTypedEquality(lval, rval);
				return ExpResult.makeNumResult(!equal ? 1 : 0, DimensionlessUnit);
			},
			validate(context: ParseContext, lval: ExpValResult, rval: ExpValResult, source: string, pos: number): ExpValResult {
				return validateTypedComparison(context, lval, rval, source, pos);
			},
		});

		addLazyBinaryOp("&&", 8, false, {
			apply(_pc: ParseContext, ec: EvalContext | null, lval: ExpParser_ExpNode, rval: ExpParser_ExpNode, source: string, pos: number): ExpResult {
				const lRes = lval.evaluate(ec);
				if (lRes.type !== ExpResType.NUMBER) {
					throw new ExpError(source, pos, tr("Left operand of '&&' must be a number"));
				}
				if (lRes.value === 0)
					return ExpResult.makeNumResult(0, DimensionlessUnit);

				const rRes = rval.evaluate(ec);
				if (rRes.type !== ExpResType.NUMBER) {
					throw new ExpError(source, pos, tr("Right operand of '&&' must be a number"));
				}

				return ExpResult.makeNumResult((rRes.value!==0) ? 1 : 0, DimensionlessUnit);
			},
			validate(context: ParseContext, lval: ExpValResult, rval: ExpValResult, source: string, pos: number): ExpValResult {
				return validateComparison(context, lval, rval, source, pos);
			},
		});

		addLazyBinaryOp("||", 6, false, {
			apply(_pc: ParseContext, ec: EvalContext | null, lval: ExpParser_ExpNode, rval: ExpParser_ExpNode, source: string, pos: number): ExpResult {
				const lRes = lval.evaluate(ec);
				if (lRes.type !== ExpResType.NUMBER) {
					throw new ExpError(source, pos, tr("Left operand of '||' must be a number"));
				}
				if (lRes.value !== 0)
					return ExpResult.makeNumResult(1, DimensionlessUnit);

				const rRes = rval.evaluate(ec);
				if (rRes.type !== ExpResType.NUMBER) {
					throw new ExpError(source, pos, tr("Right operand of '||' must be a number"));
				}

				return ExpResult.makeNumResult((rRes.value!==0) ? 1 : 0, DimensionlessUnit);
			},
			validate(context: ParseContext, lval: ExpValResult, rval: ExpValResult, source: string, pos: number): ExpValResult {
				return validateComparison(context, lval, rval, source, pos);
			},
		});

		addBinaryOp("<", 12, false, {
			checkTypeAndUnits(_context: ParseContext, lval: ExpResult,
					rval: ExpResult, source: string, pos: number): void {
				checkBothNumbers(lval, rval, source, pos);
				if (lval.unitType !== rval.unitType) {
					throw new ExpError(source, pos, getUnitMismatchString("<", lval.unitType, rval.unitType));
				}
			},
			apply(_context: ParseContext, lval: ExpResult, rval: ExpResult, _source: string, _pos: number): ExpResult {
				return ExpResult.makeNumResult(lval.value < rval.value ? 1 : 0, DimensionlessUnit);
			},
			validate(context: ParseContext, lval: ExpValResult, rval: ExpValResult, source: string, pos: number): ExpValResult {
				return validateComparison(context, lval, rval, source, pos);
			},
		});

		addBinaryOp("<=", 12, false, {
			checkTypeAndUnits(_context: ParseContext, lval: ExpResult,
					rval: ExpResult, source: string, pos: number): void {
				checkBothNumbers(lval, rval, source, pos);
				if (lval.unitType !== rval.unitType) {
					throw new ExpError(source, pos, getUnitMismatchString("<=", lval.unitType, rval.unitType));
				}
			},
			apply(_context: ParseContext, lval: ExpResult, rval: ExpResult, _source: string, _pos: number): ExpResult {
				return ExpResult.makeNumResult(lval.value <= rval.value ? 1 : 0, DimensionlessUnit);
			},
			validate(context: ParseContext, lval: ExpValResult, rval: ExpValResult, source: string, pos: number): ExpValResult {
				return validateComparison(context, lval, rval, source, pos);
			},
		});

		addBinaryOp(">", 12, false, {
			checkTypeAndUnits(_context: ParseContext, lval: ExpResult,
					rval: ExpResult, source: string, pos: number): void {
				checkBothNumbers(lval, rval, source, pos);
				if (lval.unitType !== rval.unitType) {
					throw new ExpError(source, pos, getUnitMismatchString(">", lval.unitType, rval.unitType));
				}
			},
			apply(_context: ParseContext, lval: ExpResult, rval: ExpResult, _source: string, _pos: number): ExpResult {
				return ExpResult.makeNumResult(lval.value > rval.value ? 1 : 0, DimensionlessUnit);
			},
			validate(context: ParseContext, lval: ExpValResult, rval: ExpValResult, source: string, pos: number): ExpValResult {
				return validateComparison(context, lval, rval, source, pos);
			},
		});

		addBinaryOp(">=", 12, false, {
			checkTypeAndUnits(_context: ParseContext, lval: ExpResult,
					rval: ExpResult, source: string, pos: number): void {
				checkBothNumbers(lval, rval, source, pos);
				if (lval.unitType !== rval.unitType) {
					throw new ExpError(source, pos, getUnitMismatchString(">=", lval.unitType, rval.unitType));
				}
			},
			apply(_context: ParseContext, lval: ExpResult, rval: ExpResult, _source: string, _pos: number): ExpResult {
				return ExpResult.makeNumResult(lval.value >= rval.value ? 1 : 0, DimensionlessUnit);
			},
			validate(context: ParseContext, lval: ExpValResult, rval: ExpValResult, source: string, pos: number): ExpValResult {
				return validateComparison(context, lval, rval, source, pos);
			},
		});


		////////////////////////////////////////////////////
		// Functions
		addFunction("max", 2, -1, {
			checkUnits(_context: ParseContext, args: ExpResult[],
					source: string, pos: number): void {
				for (let i = 1; i < args.length; ++ i) {
					if (args[0].unitType !== args[i].unitType)
						throw new ExpError(source, pos, getUnitMismatchString(args[0].unitType, args[i].unitType));
				}
			},

			call(_context: EvalContext | null, args: ExpResult[], _source: string, _pos: number): ExpResult {
				let res = args[0];
				for (let i = 1; i < args.length; ++ i) {
					if (args[i].value > res.value)
						res = args[i];
				}
				return res;
			},

			validate(context: ParseContext, args: ExpValResult[], source: string, pos: number): ExpValResult {
				return validateSameUnits(context, args, source, pos, args[0].unitType);
			},
		});

		addFunction("min", 2, -1, {
			checkUnits(_context: ParseContext, args: ExpResult[],
					source: string, pos: number): void {
				for (let i = 1; i < args.length; ++ i) {
					if (args[0].unitType !== args[i].unitType)
						throw new ExpError(source, pos, getUnitMismatchString(args[0].unitType, args[i].unitType));
				}
			},

			call(_context: EvalContext | null, args: ExpResult[], _source: string, _pos: number): ExpResult {
				let res = args[0];
				for (let i = 1; i < args.length; ++ i) {
					if (args[i].value < res.value)
						res = args[i];
				}
				return res;
			},
			validate(context: ParseContext, args: ExpValResult[], source: string, pos: number): ExpValResult {
				return validateSameUnits(context, args, source, pos, args[0].unitType);
			},
		});

		addFunction("maxCol", 1, 1, {
			checkUnits(_context: ParseContext, _args: ExpResult[],
					_source: string, _pos: number): void {
			},

			call(_context: EvalContext | null, args: ExpResult[], source: string, pos: number): ExpResult {
				if (args[0].type !== ExpResType.COLLECTION) {
					throw new ExpError(source, pos, tr("Expected Collection type argument"));
				}

				const col = args[0].colVal!;
				const it = col.getIter();
				if (!it.hasNext()) {
					throw new ExpError(source, pos, tr("Can not get max of empty collection"));
				}
				let ret = col.index(it.nextKey());
				const ut = ret.unitType;
				if (ret.type !== ExpResType.NUMBER) {
					throw new ExpError(source, pos, tr("Can not take max of non-numeric type in collection"));
				}

				while (it.hasNext()) {
					const comp = col.index(it.nextKey());
					if (comp.unitType !== ut) {
						throw new ExpError(source, pos, tr("Unmatched Unit types in collection: %s, %s"),
						                   simpleName(ut), simpleName(comp.unitType));
					}
					if (comp.type !== ExpResType.NUMBER) {
						throw new ExpError(source, pos, tr("Can not take max of non-numeric type in collection"));
					}
					if (comp.value > ret.value) {
						ret = comp;
					}
				}
				return ret;
			},

			validate(context: ParseContext, args: ExpValResult[], source: string, pos: number): ExpValResult {
				return validateCollection(context, args[0], source, pos);
			},
		});

		addFunction("minCol", 1, 1, {
			checkUnits(_context: ParseContext, _args: ExpResult[],
					_source: string, _pos: number): void {
			},

			call(_context: EvalContext | null, args: ExpResult[], source: string, pos: number): ExpResult {
				if (args[0].type !== ExpResType.COLLECTION) {
					throw new ExpError(source, pos, tr("Expected Collection type argument"));
				}

				const col = args[0].colVal!;
				const it = col.getIter();
				if (!it.hasNext()) {
					throw new ExpError(source, pos, tr("Can not get min of empty collection"));
				}
				let ret = col.index(it.nextKey());
				const ut = ret.unitType;
				if (ret.type !== ExpResType.NUMBER) {
					throw new ExpError(source, pos, tr("Can not take min of non-numeric type in collection"));
				}

				while (it.hasNext()) {
					const comp = col.index(it.nextKey());
					if (comp.unitType !== ut) {
						throw new ExpError(source, pos, tr("Unmatched Unit types in collection: %s, %s"),
						                   simpleName(ut), simpleName(comp.unitType));
					}
					if (comp.type !== ExpResType.NUMBER) {
						throw new ExpError(source, pos, tr("Can not take min of non-numeric type in collection"));
					}
					if (comp.value < ret.value) {
						ret = comp;
					}
				}
				return ret;
			},

			validate(context: ParseContext, args: ExpValResult[], source: string, pos: number): ExpValResult {
				return validateCollection(context, args[0], source, pos);
			},
		});

		addFunction("sum", 1, 1, {
			checkUnits(_context: ParseContext, _args: ExpResult[],
					_source: string, _pos: number): void {
			},

			call(_context: EvalContext | null, args: ExpResult[], source: string, pos: number): ExpResult {
				if (args[0].type !== ExpResType.COLLECTION) {
					throw new ExpError(source, pos, tr("Expected Collection type argument"));
				}

				const col = args[0].colVal!;
				const it = col.getIter();
				if (!it.hasNext()) {
					return ExpResult.makeNumResult(0.0, DimensionlessUnit);
				}
				let comp = col.index(it.nextKey());
				const ut = comp.unitType;
				if (comp.type !== ExpResType.NUMBER) {
					throw new ExpError(source, pos, tr("Can not sum non-numeric type in collection"));
				}
				let ret = comp.value;

				while (it.hasNext()) {
					comp = col.index(it.nextKey());
					if (comp.unitType !== ut) {
						throw new ExpError(source, pos, tr("Unmatched Unit types in collection: %s, %s"),
						                   simpleName(ut), simpleName(comp.unitType));
					}
					if (comp.type !== ExpResType.NUMBER) {
						throw new ExpError(source, pos, tr("Can not sum non-numeric type in collection"));
					}
					ret += comp.value;
				}
				return ExpResult.makeNumResult(ret, ut);
			},

			validate(context: ParseContext, args: ExpValResult[], source: string, pos: number): ExpValResult {
				return validateCollection(context, args[0], source, pos);
			},
		});

		addFunction("abs", 1, 1, {
			checkUnits(_context: ParseContext, _args: ExpResult[],
					_source: string, _pos: number): void {
				// N/A
			},

			call(_context: EvalContext | null, args: ExpResult[], _source: string, _pos: number): ExpResult {
				return ExpResult.makeNumResult(Math.abs(args[0].value), args[0].unitType);
			},
			validate(_context: ParseContext, args: ExpValResult[], _source: string, _pos: number): ExpValResult {
				return args[0];
			},
		});

		addFunction("ceil", 1, 1, {
			checkUnits(_context: ParseContext, _args: ExpResult[],
					_source: string, _pos: number): void {
				// N/A
			},
			call(_context: EvalContext | null, args: ExpResult[], _source: string, _pos: number): ExpResult {
				return ExpResult.makeNumResult(Math.ceil(args[0].value), args[0].unitType);
			},
			validate(_context: ParseContext, args: ExpValResult[], _source: string, _pos: number): ExpValResult {
				return args[0];
			},
		});

		addFunction("floor", 1, 1, {
			checkUnits(_context: ParseContext, _args: ExpResult[],
					_source: string, _pos: number): void {
				// N/A
			},
			call(_context: EvalContext | null, args: ExpResult[], _source: string, _pos: number): ExpResult {
				return ExpResult.makeNumResult(Math.floor(args[0].value), args[0].unitType);
			},
			validate(_context: ParseContext, args: ExpValResult[], _source: string, _pos: number): ExpValResult {
				return args[0];
			},
		});

		addFunction("round", 1, 1, {
			checkUnits(_context: ParseContext, _args: ExpResult[],
					_source: string, _pos: number): void {
				// N/A
			},
			call(_context: EvalContext | null, args: ExpResult[], _source: string, _pos: number): ExpResult {
				return ExpResult.makeNumResult(javaRound(args[0].value), args[0].unitType);
			},
			validate(_context: ParseContext, args: ExpValResult[], _source: string, _pos: number): ExpValResult {
				return args[0];
			},
		});

		addFunction("signum", 1, 1, {
			checkUnits(_context: ParseContext, _args: ExpResult[],
					_source: string, _pos: number): void {
				// N/A
			},
			call(_context: EvalContext | null, args: ExpResult[], _source: string, _pos: number): ExpResult {
				return ExpResult.makeNumResult(JMath.signum(args[0].value), DimensionlessUnit);
			},
			validate(_context: ParseContext, args: ExpValResult[], source: string, pos: number): ExpValResult {
				if (args[0].state === ExpValResult.State.VALID) {
					if (args[0].type === ExpResType.NUMBER) {
						return ExpValResult.makeValidRes(ExpResType.NUMBER, DimensionlessUnit);
					}
					const err = new ExpError(source, pos, tr("First parameter must be a number"));
					return ExpValResult.makeErrorRes(err);
				} else {
					return args[0];
				}
			},
		});

		addFunction("sqrt", 1, 1, {
			checkUnits(_context: ParseContext, args: ExpResult[],
					source: string, pos: number): void {
				if (args[0].unitType !== DimensionlessUnit)
					throw new ExpError(source, pos, getInvalidUnitString(args[0].unitType, DimensionlessUnit));
			},
			call(_context: EvalContext | null, args: ExpResult[], _source: string, _pos: number): ExpResult {
				return ExpResult.makeNumResult(Math.sqrt(args[0].value), DimensionlessUnit);
			},
			validate(context: ParseContext, args: ExpValResult[], source: string, pos: number): ExpValResult {
				return validateSingleArgDimensionless(context, args[0], source, pos);
			},
		});

		addFunction("cbrt", 1, 1, {
			checkUnits(_context: ParseContext, args: ExpResult[],
					source: string, pos: number): void {
				if (args[0].unitType !== DimensionlessUnit)
					throw new ExpError(source, pos, getInvalidUnitString(args[0].unitType, DimensionlessUnit));
			},
			call(_context: EvalContext | null, args: ExpResult[], _source: string, _pos: number): ExpResult {
				return ExpResult.makeNumResult(Math.cbrt(args[0].value), DimensionlessUnit);
			},
			validate(context: ParseContext, args: ExpValResult[], source: string, pos: number): ExpValResult {
				return validateSingleArgDimensionless(context, args[0], source, pos);
			},
		});

		addFunction("indexOfMin", 2, -1, {
			checkUnits(_context: ParseContext, args: ExpResult[],
					source: string, pos: number): void {
				for (let i = 1; i < args.length; ++ i) {
					if (args[0].unitType !== args[i].unitType)
						throw new ExpError(source, pos, getUnitMismatchString(args[0].unitType, args[i].unitType));
				}
			},

			call(_context: EvalContext | null, args: ExpResult[], _source: string, _pos: number): ExpResult {
				let res = args[0];
				let index = 0;
				for (let i = 1; i < args.length; ++ i) {
					if (args[i].value < res.value) {
						res = args[i];
						index = i;
					}
				}
				return ExpResult.makeNumResult(index + 1, DimensionlessUnit);
			},
			validate(context: ParseContext, args: ExpValResult[], source: string, pos: number): ExpValResult {
				return validateSameUnits(context, args, source, pos, DimensionlessUnit);
			},
		});

		addFunction("indexOfMax", 2, -1, {
			checkUnits(_context: ParseContext, args: ExpResult[],
					source: string, pos: number): void {
				for (let i = 1; i < args.length; ++ i) {
					if (args[0].unitType !== args[i].unitType)
						throw new ExpError(source, pos, getUnitMismatchString(args[0].unitType, args[i].unitType));
				}
			},

			call(_context: EvalContext | null, args: ExpResult[], _source: string, _pos: number): ExpResult {
				let res = args[0];
				let index = 0;
				for (let i = 1; i < args.length; ++ i) {
					if (args[i].value > res.value) {
						res = args[i];
						index = i;
					}
				}
				return ExpResult.makeNumResult(index + 1, DimensionlessUnit);
			},
			validate(context: ParseContext, args: ExpValResult[], source: string, pos: number): ExpValResult {
				return validateSameUnits(context, args, source, pos, DimensionlessUnit);
			},
		});

		addFunction("indexOfMaxCol", 1, 1, {
			checkUnits(_context: ParseContext, _args: ExpResult[],
					_source: string, _pos: number): void {
			},

			call(_context: EvalContext | null, args: ExpResult[], source: string, pos: number): ExpResult {
				if (args[0].type !== ExpResType.COLLECTION) {
					throw new ExpError(source, pos, tr("Expected Collection type argument"));
				}

				const col = args[0].colVal!;
				const it = col.getIter();
				if (!it.hasNext()) {
					throw new ExpError(source, pos, tr("Can not get max of empty collection"));
				}
				let retKey = it.nextKey();
				let ret = col.index(retKey);
				const ut = ret.unitType;
				if (ret.type !== ExpResType.NUMBER) {
					throw new ExpError(source, pos, tr("Can not take max of non-numeric type in collection"));
				}

				while (it.hasNext()) {
					const compKey = it.nextKey();
					const comp = col.index(compKey);
					if (comp.type !== ExpResType.NUMBER) {
						throw new ExpError(source, pos, tr("Can not take max of non-numeric type in collection"));
					}
					if (comp.unitType !== ut) {
						throw new ExpError(source, pos, tr("Unmatched Unit types in collection: %s, %s"),
						                   simpleName(ut), simpleName(comp.unitType));
					}
					if (comp.value > ret.value) {
						ret = comp;
						retKey = compKey;
					}
				}
				return retKey;
			},

			validate(context: ParseContext, args: ExpValResult[], source: string, pos: number): ExpValResult {
				return validateCollection(context, args[0], source, pos);
			},
		});
		addFunction("indexOfMinCol", 1, 1, {
			checkUnits(_context: ParseContext, _args: ExpResult[],
					_source: string, _pos: number): void {
			},

			call(_context: EvalContext | null, args: ExpResult[], source: string, pos: number): ExpResult {
				if (args[0].type !== ExpResType.COLLECTION) {
					throw new ExpError(source, pos, tr("Expected Collection type argument"));
				}

				const col = args[0].colVal!;
				const it = col.getIter();
				if (!it.hasNext()) {
					throw new ExpError(source, pos, tr("Can not get min of empty collection"));
				}
				let retKey = it.nextKey();
				let ret = col.index(retKey);
				const ut = ret.unitType;
				if (ret.type !== ExpResType.NUMBER) {
					throw new ExpError(source, pos, tr("Can not take min of non-numeric type in collection"));
				}

				while (it.hasNext()) {
					const compKey = it.nextKey();
					const comp = col.index(compKey);
					if (comp.type !== ExpResType.NUMBER) {
						throw new ExpError(source, pos, tr("Can not take min of non-numeric type in collection"));
					}
					if (comp.unitType !== ut) {
						throw new ExpError(source, pos, tr("Unmatched Unit types in collection: %s, %s"),
						                   simpleName(ut), simpleName(comp.unitType));
					}
					if (comp.value < ret.value) {
						ret = comp;
						retKey = compKey;
					}
				}
				return retKey;
			},

			validate(context: ParseContext, args: ExpValResult[], source: string, pos: number): ExpValResult {
				return validateCollection(context, args[0], source, pos);
			},
		});
		addFunction("indexOfNearest", 2, 2, {
			checkUnits(_context: ParseContext, _args: ExpResult[],
					_source: string, _pos: number): void {
			},

			call(_context: EvalContext | null, args: ExpResult[], source: string, pos: number): ExpResult {
				if (args[0].type !== ExpResType.COLLECTION) {
					throw new ExpError(source, pos, tr("Expected Collection type argument as first argument."));
				}
				if (args[1].type !== ExpResType.NUMBER) {
					throw new ExpError(source, pos, tr("Expected numerical argument as second argument."));
				}

				const col = args[0].colVal!;
				const nearPoint = args[1];

				const it = col.getIter();
				if (!it.hasNext()) {
					throw new ExpError(source, pos, tr("Can not get nearest value of empty collection."));
				}

				let nearestDist = Double.MAX_VALUE;
				let retKey: ExpResult | null = null;

				while (it.hasNext()) {
					const compKey = it.nextKey();
					const comp = col.index(compKey);
					if (comp.unitType !== nearPoint.unitType) {
						throw new ExpError(source, pos, tr("Unmatched Unit types when finding nearest: %s, %s"),
						                   simpleName(nearPoint.unitType), simpleName(comp.unitType));
					}
					if (comp.type !== ExpResType.NUMBER) {
						throw new ExpError(source, pos, tr("Can not find nearest value of non-numeric type in collection."));
					}
					const dist = Math.abs(comp.value - nearPoint.value);
					if (dist < nearestDist) {
						nearestDist = dist;
						retKey = compKey;
					}
				}
				return retKey as ExpResult;
			},

			validate(context: ParseContext, args: ExpValResult[], source: string, pos: number): ExpValResult {
				if (args[1].state === ExpValResult.State.ERROR || args[1].state === ExpValResult.State.UNDECIDABLE) {
					return args[1];
				}
				if (args[1].type !== ExpResType.NUMBER) {
					return ExpValResult.makeErrorRes(new ExpError(source, pos, tr("Second argument to 'indexOfNearest' must be a number.")));
				}

				return validateCollection(context, args[0], source, pos);
			},
		});

		addFunction("indexOf", 2, 2, {
			checkUnits(_context: ParseContext, _args: ExpResult[],
					_source: string, _pos: number): void {
			},

			call(_context: EvalContext | null, args: ExpResult[], source: string, pos: number): ExpResult {
				if (args[0].type !== ExpResType.COLLECTION) {
					throw new ExpError(source, pos, tr("Expected Collection type argument as first argument."));
				}

				const col = args[0].colVal!;
				const val = args[1];

				const it = col.getIter();
				if (!it.hasNext()) {
					return ExpResult.makeNumResult(0.0, DimensionlessUnit);
				}

				while (it.hasNext()) {
					const key = it.nextKey();
					const colVal = col.index(key);
					if (colVal.equals(val)) {
						return key;
					}
				}
				return ExpResult.makeNumResult(0.0, DimensionlessUnit);
			},

			validate(context: ParseContext, args: ExpValResult[], source: string, pos: number): ExpValResult {
				if (args[1].state === ExpValResult.State.ERROR || args[1].state === ExpValResult.State.UNDECIDABLE) {
					return args[1];
				}
				return validateCollection(context, args[0], source, pos);
			},
		});

		///////////////////////////////////////////////////
		// Higher Order Functions
		addFunction("map", 2, 2, {
			checkUnits(_context: ParseContext, _args: ExpResult[],
					_source: string, _pos: number): void {
			},

			call(context: EvalContext | null, args: ExpResult[], source: string, pos: number): ExpResult {
				if (args[1].type !== ExpResType.COLLECTION) {
					throw new ExpError(source, pos, tr("Expected Collection type argument as second argument."));
				}
				if (args[0].type !== ExpResType.LAMBDA) {
					throw new ExpError(source, pos, tr("Expected function argument as first argument."));
				}

				const mapFunc: ExpParser_LambdaClosure = args[0].lcVal!;
				const numParams = mapFunc.getNumParams();
				if (numParams !== 1 && numParams !== 2) {
					throw new ExpError(source, pos, tr("Function passed to 'map' must take one or two parameters."));
				}

				const col = args[1].colVal!;
				const it = col.getIter();

				let unitType: UnitClass | null = null;
				const firstVal = true;
				const params: (ExpResult | null)[] = [];

				const results: ExpResult[] = [];
				params.push(null);

				if (numParams === 2)
					params.push(null);

				while (it.hasNext()) {
					const key = it.nextKey();
					const val = col.index(key);
					params[0] = val;

					if (numParams === 2)
						params[1] = key;

					const result = mapFunc.evaluate(context, params);

					const resUnitType = result.type === ExpResType.NUMBER ? result.unitType : null;
					// Java でも firstVal は true のまま（毎回 unitType を置き換える）
					if (firstVal) {
						unitType = resUnitType;
					} else {
						if (unitType !== resUnitType) {
							throw new ExpError(source, pos, tr("All unit types of map results must match"));
						}
					}
					results.push(result);
				}
				return ExpCollections.makeAssignableArrrayCollection(results, false);
			},

			validate(context: ParseContext, args: ExpValResult[], source: string, pos: number): ExpValResult {
				if (args[0].state === ExpValResult.State.ERROR || args[0].state === ExpValResult.State.UNDECIDABLE) {
					return args[0];
				}
				if (args[0].type !== ExpResType.LAMBDA) {
					return ExpValResult.makeErrorRes(new ExpError(source, pos, tr("First argument to 'map' must be a function.")));
				}

				return validateCollection(context, args[1], source, pos);
			},
		});

		addFunction("filter", 2, 2, {
			checkUnits(_context: ParseContext, _args: ExpResult[],
					_source: string, _pos: number): void {
			},

			call(context: EvalContext | null, args: ExpResult[], source: string, pos: number): ExpResult {
				if (args[1].type !== ExpResType.COLLECTION) {
					throw new ExpError(source, pos, tr("Expected Collection type argument as second argument."));
				}
				if (args[0].type !== ExpResType.LAMBDA) {
					throw new ExpError(source, pos, tr("Expected function argument as first argument."));
				}

				const filterFunc = args[0].lcVal!;
				const numParams = filterFunc.getNumParams();
				if (numParams !== 1 && numParams !== 2) {
					throw new ExpError(source, pos, tr("Function passed to 'filter' must take one or two parameters."));
				}

				const col = args[1].colVal!;
				const it = col.getIter();

				const params: (ExpResult | null)[] = [];
				const results: ExpResult[] = [];
				params.push(null);
				if (numParams === 2)
					params.push(null);

				while (it.hasNext()) {
					const key = it.nextKey();
					const val = col.index(key);
					params[0] = val;
					if (numParams === 2)
						params[1] = key;

					const result = filterFunc.evaluate(context, params);
					if (result.type === ExpResType.NUMBER && result.value !== 0) {
						results.push(val);
					}

				}
				return ExpCollections.makeAssignableArrrayCollection(results, false);
			},

			validate(context: ParseContext, args: ExpValResult[], source: string, pos: number): ExpValResult {
				if (args[0].state === ExpValResult.State.ERROR || args[0].state === ExpValResult.State.UNDECIDABLE) {
					return args[0];
				}
				if (args[0].type !== ExpResType.LAMBDA) {
					return ExpValResult.makeErrorRes(new ExpError(source, pos, tr("First argument to 'filter' must be a function.")));
				}

				return validateCollection(context, args[1], source, pos);
			},
		});

		addFunction("reduce", 3, 3, {
			checkUnits(_context: ParseContext, _args: ExpResult[],
					_source: string, _pos: number): void {
			},

			call(context: EvalContext | null, args: ExpResult[], source: string, pos: number): ExpResult {
				if (args[2].type !== ExpResType.COLLECTION) {
					throw new ExpError(source, pos, tr("Expected Collection type argument as first argument."));
				}
				if (args[0].type !== ExpResType.LAMBDA) {
					throw new ExpError(source, pos, tr("Expected function argument as third argument."));
				}

				const reduceFunc = args[0].lcVal!;
				if (reduceFunc.getNumParams() !== 2) {
					throw new ExpError(source, pos, tr("Function passed to 'reduce' must take two parameters."));
				}

				let accum = args[1];

				const col = args[2].colVal!;
				const it = col.getIter();

				const params: (ExpResult | null)[] = [];
				params.push(null);
				params.push(null);

				while (it.hasNext()) {
					const key = it.nextKey();
					const val = col.index(key);
					params[0] = val;
					params[1] = accum;

					accum = reduceFunc.evaluate(context, params);
				}
				return accum;
			},

			validate(context: ParseContext, args: ExpValResult[], source: string, pos: number): ExpValResult {
				if (args[0].state === ExpValResult.State.ERROR || args[0].state === ExpValResult.State.UNDECIDABLE) {
					return args[0];
				}
				if (args[0].type !== ExpResType.LAMBDA) {
					return ExpValResult.makeErrorRes(new ExpError(source, pos, tr("First argument to 'reduce' must be a function.")));
				}

				return validateCollection(context, args[2], source, pos);
			},
		});

		addFunction("sort", 2, 2, {
			checkUnits(_context: ParseContext, _args: ExpResult[],
					_source: string, _pos: number): void {
			},

			call(context: EvalContext | null, args: ExpResult[], source: string, pos: number): ExpResult {
				if (args[1].type !== ExpResType.COLLECTION) {
					throw new ExpError(source, pos, tr("Expected Collection type argument as second argument."));
				}
				if (args[0].type !== ExpResType.LAMBDA) {
					throw new ExpError(source, pos, tr("Expected function argument as first argument."));
				}

				const sortFunc = args[0].lcVal!;
				if (sortFunc.getNumParams() !== 2) {
					throw new ExpError(source, pos, tr("Function passed to 'sort' must take two parameters."));
				}

				const col = args[1].colVal!;
				const it = col.getIter();

				const results: ExpResult[] = [];
				while (it.hasNext()) {
					const key = it.nextKey();
					const val = col.index(key);
					results.push(val);
				}

				const params: (ExpResult | null)[] = [];
				params.push(null);
				params.push(null);

				const cont = context;

				// Java: 比べる関数の中の ExpError は RuntimeException に包んで外で取り出す。JS ではそのまま投げればよい
				const c = (arg0: ExpResult, arg1: ExpResult): number => {
					params[0] = arg0;
					params[1] = arg1;

					const res = sortFunc.evaluate(cont, params);

					return (res.value === 0) ? 1 : -1;
				};

				javaListSort(results, c);
				return ExpCollections.makeAssignableArrrayCollection(results, false);
			},

			validate(context: ParseContext, args: ExpValResult[], source: string, pos: number): ExpValResult {
				if (args[0].state === ExpValResult.State.ERROR || args[0].state === ExpValResult.State.UNDECIDABLE) {
					return args[0];
				}
				if (args[0].type !== ExpResType.LAMBDA) {
					return ExpValResult.makeErrorRes(new ExpError(source, pos, tr("First argument to 'sort' must be a function.")));
				}

				return validateCollection(context, args[1], source, pos);
			},
		});

		addFunction("size", 1, 1, {
			checkUnits(_context: ParseContext, _args: ExpResult[],
					_source: string, _pos: number): void {
			},

			call(_context: EvalContext | null, args: ExpResult[], source: string, pos: number): ExpResult {
				if (args[0].type !== ExpResType.COLLECTION) {
					throw new ExpError(source, pos, tr("Expected Collection type argument. Received: %s"), args[0].type);
				}

				const col = args[0].colVal!;
				return ExpResult.makeNumResult(col.getSize(), DimensionlessUnit);
			},

			validate(context: ParseContext, args: ExpValResult[], source: string, pos: number): ExpValResult {
				return validateCollection(context, args[0], source, pos);
			},
		});

		addFunction("range", 1, 3, {
			checkUnits(_context: ParseContext, args: ExpResult[],
					source: string, pos: number): void {
				for(const arg of args) {
					if (arg.type !== ExpResType.NUMBER) {
						throw new ExpError(source, pos, tr("Only numbers may be passed to 'range'"));
					}
				}
				// Ensure all units are the same
				for (let i = 1; i < args.length; ++i) {
					if (args[0].unitType !== args[1].unitType) {
						throw new ExpError(source, pos, tr("All unit types to 'range' must be the same. %s != %s"),
								simpleName(args[0].unitType), simpleName(args[i].unitType));
					}
				}
			},

			call(_context: EvalContext | null, args: ExpResult[], _source: string, _pos: number): ExpResult {
				let startVal = 1;
				let endVal = 0;
				if (args.length > 1) {
					startVal = args[0].value;
					endVal = args[1].value;
				} else {
					endVal = args[0].value;
				}

				if (startVal > endVal) {
					return ExpCollections.makeAssignableArrrayCollection([], false);
				}

				let inc = 1;
				if (args.length > 2) {
					inc = args[2].value;
				}
				const res: ExpResult[] = [];
				let val = startVal;
				while (val <= endVal) {
					res.push(ExpResult.makeNumResult(val, args[0].unitType));
					val += inc;
				}
				return ExpCollections.makeAssignableArrrayCollection(res, false);

			},

			validate(_context: ParseContext, args: ExpValResult[], source: string, pos: number): ExpValResult {
				const merge = mergeMultipleErrors(args);
				if (merge !== null) {
					return merge;
				}
				for(const arg of args) {
					if (arg.type !== ExpResType.NUMBER) {
						return ExpValResult.makeErrorRes(new ExpError(source, pos, tr("Only numbers may be passed to 'range'")));
					}
				}
				// Ensure all units are the same
				for (let i = 1; i < args.length; ++i) {
					if (args[0].unitType !== args[1].unitType) {
						return ExpValResult.makeErrorRes(new ExpError(source, pos, tr("All unit types to 'range' must be the same. %s != %s"),
								simpleName(args[0].unitType), simpleName(args[i].unitType)));
					}
				}
				return ExpValResult.makeValidRes(ExpResType.COLLECTION, args[0].unitType);
			},
		});

		addFunction("choose", 2, -1, {
			checkUnits(_context: ParseContext, args: ExpResult[],
					source: string, pos: number): void {
				if (args[0].unitType !== DimensionlessUnit)
					throw new ExpError(source, pos, getInvalidUnitString(args[0].unitType, DimensionlessUnit));

				for (let i = 2; i < args.length; ++ i) {
					if (args[1].unitType !== args[i].unitType)
						throw new ExpError(source, pos, getUnitMismatchString(args[1].unitType, args[i].unitType));
				}
			},

			call(_context: EvalContext | null, args: ExpResult[], source: string, pos: number): ExpResult {
				const k = d2i(args[0].value);
				if (k < 1 || k >= args.length)
					throw new ExpError(source, pos,
							jformat(tr("Invalid index: %s. Index must be between 1 and %s."), k, args.length-1));

				return args[k];
			},

			validate(_context: ParseContext, args: ExpValResult[], source: string, pos: number): ExpValResult {
				const mergedErrors = mergeMultipleErrors(args);
				if (mergedErrors !== null)
					return mergedErrors;

				if (args[0].type !== ExpResType.NUMBER) {
					const error = new ExpError(source, pos, tr("Parameter must be a number"));
					return ExpValResult.makeErrorRes(error);
				}
				if (args[0].unitType !== DimensionlessUnit) {
					const error = new ExpError(source, pos, getInvalidUnitString(args[0].unitType, DimensionlessUnit));
					return ExpValResult.makeErrorRes(error);
				}

				if (args.length < 2) {
					const error = new ExpError(source, pos, tr("'choose' function must take at least 2 parameters."));
					return ExpValResult.makeErrorRes(error);
				}
				const valType = args[1].type;
				const valUnitType = args[1].unitType;

				for (let i = 2; i < args.length; ++ i) {
					if (args[i].type !== valType) {
						const error = new ExpError(source, pos, tr("All parameter types to 'choose' must be the same type"));
						return ExpValResult.makeErrorRes(error);
					}

					if (valType === ExpResType.NUMBER && valUnitType !== args[i].unitType) {
						const error = new ExpError(source, pos, getInvalidUnitString(args[0].unitType, DimensionlessUnit));
						return ExpValResult.makeErrorRes(error);
					}
				}
				return ExpValResult.makeValidRes(valType, valUnitType);
			},
		});

		addFunction("format", 1, -1, {
			checkUnits(_context: ParseContext, _args: ExpResult[],
					_source: string, _pos: number): void {
			},

			call(_context: EvalContext | null, args: ExpResult[], source: string, pos: number): ExpResult {
				if (args[0].type !== ExpResType.STRING) {
					throw new ExpError(source, pos, tr("First parameter to 'format' must be a string"));
				}
				// Build up the argument list
				const strArgs: (string | number)[] = new Array<string | number>(args.length-1);
				for (let i = 1; i < args.length; ++i) {
					if (args[i].type !== ExpResType.NUMBER) {
						strArgs[i-1] = args[i].getFormatString();
					}
					else {
						if (args[i].unitType !== DimensionlessUnit) {
							throw new ExpError(source, pos,
									tr("'format' argument %d must be a dimensionless number. "
									+ "Make it so by dividing it by 1 in the desired unit.\n"
									+ "Example: 'format(\"5km is %%f metres\", 5[km]/1[m])'"),
									i + 1);
						}
						strArgs[i-1] = args[i].value;  // Java の Double
					}
				}
				let ret: string | null = null;
				try {
					ret = javaFormatStringsAndDoubles(args[0].stringVal!, strArgs);
				} catch(e) {
					if (!(e instanceof JavaFormatError)) throw e;
					throw new ExpError(source, pos, tr("Error during 'format': %s"), e.message);
				}
				return ExpResult.makeStringResult(ret);
			},

			validate(_context: ParseContext, args: ExpValResult[], source: string, pos: number): ExpValResult {
				const mergedErrors = mergeMultipleErrors(args);
				if (mergedErrors !== null)
					return mergedErrors;

				if (args[0].type !== ExpResType.STRING) {
					const error = new ExpError(source, pos, tr("First parameter to 'format' must be a string"));
					return ExpValResult.makeErrorRes(error);
				}
				return ExpValResult.makeUndecidableRes();
			},
		});


		///////////////////////////////////////////////////
		// Mathematical Constants
		addFunction("E", 0, 0, {
			checkUnits(_context: ParseContext, _args: ExpResult[],
					_source: string, _pos: number): void {
				// N/A
			},
			call(_context: EvalContext | null, _args: ExpResult[], _source: string, _pos: number): ExpResult {
				return ExpResult.makeNumResult(Math.E, DimensionlessUnit);
			},
			validate(_context: ParseContext, _args: ExpValResult[], _source: string, _pos: number): ExpValResult {
				return ExpValResult.makeValidRes(ExpResType.NUMBER, DimensionlessUnit);
			},
		});

		addFunction("PI", 0, 0, {
			checkUnits(_context: ParseContext, _args: ExpResult[],
					_source: string, _pos: number): void {
				// N/A
			},
			call(_context: EvalContext | null, _args: ExpResult[], _source: string, _pos: number): ExpResult {
				return ExpResult.makeNumResult(Math.PI, DimensionlessUnit);
			},
			validate(_context: ParseContext, _args: ExpValResult[], _source: string, _pos: number): ExpValResult {
				return ExpValResult.makeValidRes(ExpResType.NUMBER, DimensionlessUnit);
			},
		});

		///////////////////////////////////////////////////
		// Trigonometric Functions
		addFunction("sin", 1, 1, {
			checkUnits(_context: ParseContext, args: ExpResult[],
					source: string, pos: number): void {
				if (args[0].unitType !== DimensionlessUnit && args[0].unitType !== AngleUnit)
					throw new ExpError(source, pos, getInvalidTrigUnitString(args[0].unitType));
			},
			call(_context: EvalContext | null, args: ExpResult[], _source: string, _pos: number): ExpResult {
				return ExpResult.makeNumResult(Math.sin(args[0].value), DimensionlessUnit);
			},
			validate(context: ParseContext, args: ExpValResult[], source: string, pos: number): ExpValResult {
				return validateTrigFunction(context, args[0], source, pos);
			},
		});

		addFunction("cos", 1, 1, {
			checkUnits(_context: ParseContext, args: ExpResult[],
					source: string, pos: number): void {
				if (args[0].unitType !== DimensionlessUnit && args[0].unitType !== AngleUnit)
					throw new ExpError(source, pos, getInvalidTrigUnitString(args[0].unitType));
			},
			call(_context: EvalContext | null, args: ExpResult[], _source: string, _pos: number): ExpResult {
				return ExpResult.makeNumResult(Math.cos(args[0].value), DimensionlessUnit);
			},
			validate(context: ParseContext, args: ExpValResult[], source: string, pos: number): ExpValResult {
				return validateTrigFunction(context, args[0], source, pos);
			},
		});

		addFunction("tan", 1, 1, {
			checkUnits(_context: ParseContext, args: ExpResult[],
					source: string, pos: number): void {
				if (args[0].unitType !== DimensionlessUnit && args[0].unitType !== AngleUnit)
					throw new ExpError(source, pos, getInvalidTrigUnitString(args[0].unitType));
			},
			call(_context: EvalContext | null, args: ExpResult[], _source: string, _pos: number): ExpResult {
				return ExpResult.makeNumResult(Math.tan(args[0].value), DimensionlessUnit);
			},
			validate(context: ParseContext, args: ExpValResult[], source: string, pos: number): ExpValResult {
				return validateTrigFunction(context, args[0], source, pos);
			},
		});

		///////////////////////////////////////////////////
		// Inverse Trigonometric Functions
		addFunction("asin", 1, 1, {
			checkUnits(_context: ParseContext, args: ExpResult[],
					source: string, pos: number): void {
				if (args[0].unitType !== DimensionlessUnit)
					throw new ExpError(source, pos, getInvalidUnitString(args[0].unitType, DimensionlessUnit));
			},
			call(_context: EvalContext | null, args: ExpResult[], _source: string, _pos: number): ExpResult {
				return ExpResult.makeNumResult(Math.asin(args[0].value), AngleUnit);
			},
			validate(context: ParseContext, args: ExpValResult[], source: string, pos: number): ExpValResult {
				return validateSingleArgDimensionless(context, args[0], source, pos);
			},
		});

		addFunction("acos", 1, 1, {
			checkUnits(_context: ParseContext, args: ExpResult[],
					source: string, pos: number): void {
				if (args[0].unitType !== DimensionlessUnit)
					throw new ExpError(source, pos, getInvalidUnitString(args[0].unitType, DimensionlessUnit));
			},
			call(_context: EvalContext | null, args: ExpResult[], _source: string, _pos: number): ExpResult {
				return ExpResult.makeNumResult(Math.acos(args[0].value), AngleUnit);
			},
			validate(context: ParseContext, args: ExpValResult[], source: string, pos: number): ExpValResult {
				return validateSingleArgDimensionless(context, args[0], source, pos);
			},
		});

		addFunction("atan", 1, 1, {
			checkUnits(_context: ParseContext, args: ExpResult[],
					source: string, pos: number): void {
				if (args[0].unitType !== DimensionlessUnit)
					throw new ExpError(source, pos, getInvalidUnitString(args[0].unitType, DimensionlessUnit));
			},
			call(_context: EvalContext | null, args: ExpResult[], _source: string, _pos: number): ExpResult {
				return ExpResult.makeNumResult(Math.atan(args[0].value), AngleUnit);
			},
			validate(context: ParseContext, args: ExpValResult[], source: string, pos: number): ExpValResult {
				return validateSingleArgDimensionless(context, args[0], source, pos);
			},
		});

		addFunction("atan2", 2, 2, {
			checkUnits(_context: ParseContext, args: ExpResult[],
					source: string, pos: number): void {
				if (args[0].unitType !== DimensionlessUnit)
					throw new ExpError(source, pos, getInvalidUnitString(args[0].unitType, DimensionlessUnit));
				if (args[1].unitType !== DimensionlessUnit)
					throw new ExpError(source, pos, getInvalidUnitString(args[1].unitType, DimensionlessUnit));
			},
			call(_context: EvalContext | null, args: ExpResult[], _source: string, _pos: number): ExpResult {
				return ExpResult.makeNumResult(Math.atan2(args[0].value, args[1].value), AngleUnit);
			},
			validate(_context: ParseContext, args: ExpValResult[], source: string, pos: number): ExpValResult {
				const mergedErrors = mergeMultipleErrors(args);
				if (mergedErrors !== null)
					return mergedErrors;

				if (args[0].type !== ExpResType.NUMBER || args[1].type !== ExpResType.NUMBER ) {
					const error = new ExpError(source, pos, tr("Both parameters must be numbers"));
					return ExpValResult.makeErrorRes(error);
				}

				if (args[0].unitType !== DimensionlessUnit) {
					const error = new ExpError(source, pos, getInvalidUnitString(args[0].unitType, DimensionlessUnit));
					return ExpValResult.makeErrorRes(error);
				}
				if (args[1].unitType !== DimensionlessUnit) {
					const error = new ExpError(source, pos, getInvalidUnitString(args[1].unitType, DimensionlessUnit));
					return ExpValResult.makeErrorRes(error);
				}

				return ExpValResult.makeValidRes(ExpResType.NUMBER, DimensionlessUnit);
			},
		});

		///////////////////////////////////////////////////
		// Exponential Functions
		addFunction("exp", 1, 1, {
			checkUnits(_context: ParseContext, args: ExpResult[],
					source: string, pos: number): void {
				if (args[0].unitType !== DimensionlessUnit)
					throw new ExpError(source, pos, getInvalidUnitString(args[0].unitType, DimensionlessUnit));
			},
			call(_context: EvalContext | null, args: ExpResult[], _source: string, _pos: number): ExpResult {
				return ExpResult.makeNumResult(Math.exp(args[0].value), DimensionlessUnit);
			},
			validate(context: ParseContext, args: ExpValResult[], source: string, pos: number): ExpValResult {
				return validateSingleArgDimensionless(context, args[0], source, pos);
			},
		});

		addFunction("ln", 1, 1, {
			checkUnits(_context: ParseContext, args: ExpResult[],
					source: string, pos: number): void {
				if (args[0].unitType !== DimensionlessUnit)
					throw new ExpError(source, pos, getInvalidUnitString(args[0].unitType, DimensionlessUnit));
			},
			call(_context: EvalContext | null, args: ExpResult[], _source: string, _pos: number): ExpResult {
				return ExpResult.makeNumResult(Math.log(args[0].value), DimensionlessUnit);
			},
			validate(context: ParseContext, args: ExpValResult[], source: string, pos: number): ExpValResult {
				return validateSingleArgDimensionless(context, args[0], source, pos);
			},
		});

		addFunction("log", 1, 1, {
			checkUnits(_context: ParseContext, args: ExpResult[],
					source: string, pos: number): void {
				if (args[0].unitType !== DimensionlessUnit)
					throw new ExpError(source, pos, getInvalidUnitString(args[0].unitType, DimensionlessUnit));
			},
			call(_context: EvalContext | null, args: ExpResult[], _source: string, _pos: number): ExpResult {
				return ExpResult.makeNumResult(Math.log10(args[0].value), DimensionlessUnit);
			},
			validate(context: ParseContext, args: ExpValResult[], source: string, pos: number): ExpValResult {
				return validateSingleArgDimensionless(context, args[0], source, pos);
			},
		});

		addFunction("notNull", 1, 1, {
			checkUnits(_context: ParseContext, args: ExpResult[],
					source: string, pos: number): void {
				if (args[0].type !== ExpResType.ENTITY) {
					throw new ExpError(source, pos, tr("notNull requires entity as argument"));
				}
			},
			call(_context: EvalContext | null, args: ExpResult[], _source: string, _pos: number): ExpResult {

				return ExpResult.makeNumResult(args[0].entVal === null ? 0 : 1, DimensionlessUnit);
			},
			validate(_context: ParseContext, args: ExpValResult[], source: string, pos: number): ExpValResult {
				if (	args[0].state === ExpValResult.State.ERROR ||
						args[0].state === ExpValResult.State.UNDECIDABLE)
					return args[0];
				if (args[0].type !== ExpResType.ENTITY) {
					const error = new ExpError(source, pos, tr("Argument must be an entity"));
					return ExpValResult.makeErrorRes(error);
				}
				return ExpValResult.makeValidRes(ExpResType.NUMBER, DimensionlessUnit);

			},
		});

		///////////////////////////////////////////////////
		// String Functions

		addFunction("parseNumber", 1, 1, {
			checkUnits(_context: ParseContext, args: ExpResult[],
					source: string, pos: number): void {
				if (args[0].type !== ExpResType.STRING) {
					throw new ExpError(source, pos, tr("parseNumber requires string as argument"));
				}
			},
			call(_context: EvalContext | null, args: ExpResult[], _source: string, _pos: number): ExpResult {
				let val: number;
				try {
					val = Double.parseDouble(args[0].stringVal!);
				}
				catch (_e) {
					val = Double.NaN;
				}
				return ExpResult.makeNumResult(val, DimensionlessUnit);
			},
			validate(_context: ParseContext, args: ExpValResult[], source: string, pos: number): ExpValResult {
				if (	args[0].state === ExpValResult.State.ERROR ||
						args[0].state === ExpValResult.State.UNDECIDABLE)
					return args[0];
				if (args[0].type !== ExpResType.STRING) {
					const error = new ExpError(source, pos, tr("Argument must be a string"));
					return ExpValResult.makeErrorRes(error);
				}
				return ExpValResult.makeValidRes(ExpResType.NUMBER, DimensionlessUnit);
			},
		});

		addFunction("substring", 2, 3, {
			checkUnits(_context: ParseContext, args: ExpResult[],
					source: string, pos: number): void {
				if (args[0].type !== ExpResType.STRING) {
					throw new ExpError(source, pos, tr("First parameter must be a string"));
				}
				if (args[1].type !== ExpResType.NUMBER || args[1].unitType !== DimensionlessUnit) {
					throw new ExpError(source, pos, tr("Second parameter must be a dimensionless number"));
				}
				if (args.length === 3 && (args[2].type !== ExpResType.NUMBER || args[2].unitType !== DimensionlessUnit)) {
					throw new ExpError(source, pos, tr("Third parameter must be a dimensionless number"));
				}
			},
			call(_context: EvalContext | null, args: ExpResult[], _source: string, _pos: number): ExpResult {
				const str = args[0].stringVal!;
				const length = str.length;
				let beginIndex = (d2i(args[1].value) - 1) | 0;
				beginIndex = Math.min(length, Math.max(0, beginIndex));
				let endIndex = length;
				if (args.length === 3) {
					endIndex = d2i(args[2].value - 1);
					endIndex = Math.min(length, Math.max(beginIndex, endIndex));
				}
				return ExpResult.makeStringResult(str.substring(beginIndex, endIndex));
			},
			validate(_context: ParseContext, args: ExpValResult[], source: string, pos: number): ExpValResult {
				const mergedErrors = mergeMultipleErrors(args);
				if (mergedErrors !== null)
					return mergedErrors;

				if (args[0].type !== ExpResType.STRING) {
					const error = new ExpError(source, pos, tr("First parameter must be a string"));
					return ExpValResult.makeErrorRes(error);
				}
				if (args[1].type !== ExpResType.NUMBER || args[1].unitType !== DimensionlessUnit) {
					const error = new ExpError(source, pos, tr("Second parameter must be a dimensionless number"));
					return ExpValResult.makeErrorRes(error);
				}
				if (args.length === 3 && (args[2].type !== ExpResType.NUMBER || args[2].unitType !== DimensionlessUnit)) {
					const error = new ExpError(source, pos, tr("Third parameter must be a dimensionless number"));
					return ExpValResult.makeErrorRes(error);
				}
				return ExpValResult.makeValidRes(ExpResType.STRING, null);
			},
		});

		addFunction("indexOfStr", 2, 3, {
			checkUnits(_context: ParseContext, args: ExpResult[],
					source: string, pos: number): void {
				if (args[0].type !== ExpResType.STRING) {
					throw new ExpError(source, pos, tr("First parameter must be a string"));
				}
				if (args[1].type !== ExpResType.STRING) {
					throw new ExpError(source, pos, tr("Second parameter must be a string"));
				}
				if (args.length === 3 && (args[2].type !== ExpResType.NUMBER || args[2].unitType !== DimensionlessUnit)) {
					throw new ExpError(source, pos, tr("Third parameter must be a dimensionless number"));
				}
			},
			call(_context: EvalContext | null, args: ExpResult[], _source: string, _pos: number): ExpResult {
				const str = args[0].stringVal!;
				const subStr = args[1].stringVal!;
				let fromIndex = 0;
				if (args.length === 3)
					fromIndex = d2i(args[2].value - 1);
				return ExpResult.makeNumResult(str.indexOf(subStr, fromIndex) + 1, DimensionlessUnit);
			},
			validate(_context: ParseContext, args: ExpValResult[], source: string, pos: number): ExpValResult {
				const mergedErrors = mergeMultipleErrors(args);
				if (mergedErrors !== null)
					return mergedErrors;

				if (args[0].type !== ExpResType.STRING) {
					const error = new ExpError(source, pos, tr("First parameter must be a string"));
					return ExpValResult.makeErrorRes(error);
				}
				if (args[1].type !== ExpResType.STRING) {
					const error = new ExpError(source, pos, tr("Second parameter must be a string"));
					return ExpValResult.makeErrorRes(error);
				}
				if (args.length === 3 && (args[2].type !== ExpResType.NUMBER || args[2].unitType !== DimensionlessUnit)) {
					const error = new ExpError(source, pos, tr("Third parameter must be a dimensionless number"));
					return ExpValResult.makeErrorRes(error);
				}
				return ExpValResult.makeValidRes(ExpResType.NUMBER, DimensionlessUnit);
			},
		});

		addFunction("toUpperCase", 1, 1, {
			checkUnits(_context: ParseContext, args: ExpResult[], source: string, pos: number): void {
				checkStringFunction(args[0], source, pos);
			},
			call(_context: EvalContext | null, args: ExpResult[], _source: string, _pos: number): ExpResult {
				return ExpResult.makeStringResult(args[0].stringVal!.toUpperCase());
			},
			validate(context: ParseContext, args: ExpValResult[], source: string, pos: number): ExpValResult {
				return validateStringFunction(context, args[0], source, pos);
			},
		});

		addFunction("toLowerCase", 1, 1, {
			checkUnits(_context: ParseContext, args: ExpResult[], source: string, pos: number): void {
				checkStringFunction(args[0], source, pos);
			},
			call(_context: EvalContext | null, args: ExpResult[], _source: string, _pos: number): ExpResult {
				return ExpResult.makeStringResult(args[0].stringVal!.toLowerCase());
			},
			validate(context: ParseContext, args: ExpValResult[], source: string, pos: number): ExpValResult {
				return validateStringFunction(context, args[0], source, pos);
			},
		});

		addFunction("trim", 1, 1, {
			checkUnits(_context: ParseContext, args: ExpResult[], source: string, pos: number): void {
				checkStringFunction(args[0], source, pos);
			},
			call(_context: EvalContext | null, args: ExpResult[], _source: string, _pos: number): ExpResult {
				return ExpResult.makeStringResult(javaTrim(args[0].stringVal!));
			},
			validate(context: ParseContext, args: ExpValResult[], source: string, pos: number): ExpValResult {
				return validateStringFunction(context, args[0], source, pos);
			},
		});

		addFunction("split", 2, 3, {
			checkUnits(_context: ParseContext, args: ExpResult[],
					source: string, pos: number): void {
				if (args[0].type !== ExpResType.STRING) {
					throw new ExpError(source, pos, tr("First parameter must be a string"));
				}
				if (args[1].type !== ExpResType.STRING) {
					throw new ExpError(source, pos, tr("Second parameter must be a string"));
				}
				if (args.length === 3 && (args[2].type !== ExpResType.NUMBER || args[2].unitType !== DimensionlessUnit)) {
					throw new ExpError(source, pos, tr("Third parameter must be a dimensionless number"));
				}
			},
			call(_context: EvalContext | null, args: ExpResult[], source: string, pos: number): ExpResult {
				const str = args[0].stringVal!;
				const regex = args[1].stringVal!;
				let limit = 0;
				if (args.length === 3)
					limit = d2i(args[2].value);
				let array: string[];
				try {
					array = javaSplit(str, regex, limit);
				}
				catch(e) {
					if (!(e instanceof IllegalArgumentException)) throw e;
					throw new ExpError(source, pos, e.message);
				}
				return ExpCollections.wrapCollection(array, null);
			},
			validate(_context: ParseContext, args: ExpValResult[], source: string, pos: number): ExpValResult {
				const mergedErrors = mergeMultipleErrors(args);
				if (mergedErrors !== null)
					return mergedErrors;

				if (args[0].type !== ExpResType.STRING) {
					const error = new ExpError(source, pos, tr("First parameter must be a string"));
					return ExpValResult.makeErrorRes(error);
				}
				if (args[1].type !== ExpResType.STRING) {
					const error = new ExpError(source, pos, tr("Second parameter must be a string"));
					return ExpValResult.makeErrorRes(error);
				}
				if (args.length === 3 && (args[2].type !== ExpResType.NUMBER || args[2].unitType !== DimensionlessUnit)) {
					const error = new ExpError(source, pos, tr("Third parameter must be a dimensionless number"));
					return ExpValResult.makeErrorRes(error);
				}
				return ExpValResult.makeValidRes(ExpResType.COLLECTION, null);
			},
		});

		addFunction("length", 1, 1, {
			checkUnits(_context: ParseContext, args: ExpResult[], source: string, pos: number): void {
				checkStringFunction(args[0], source, pos);
			},
			call(_context: EvalContext | null, args: ExpResult[], _source: string, _pos: number): ExpResult {
				return ExpResult.makeNumResult(args[0].stringVal!.length, DimensionlessUnit);
			},
			validate(_context: ParseContext, args: ExpValResult[], source: string, pos: number): ExpValResult {
				if (	args[0].state === ExpValResult.State.ERROR ||
						args[0].state === ExpValResult.State.UNDECIDABLE)
					return args[0];
				if (args[0].type !== ExpResType.STRING) {
					const error = new ExpError(source, pos, tr("Argument must be a string"));
					return ExpValResult.makeErrorRes(error);
				}
				return ExpValResult.makeValidRes(ExpResType.NUMBER, DimensionlessUnit);
			},
		});

		///////////////////////////////////////////////////
		// Random Distribution Functions
		addFunction("beta", 3, 4, {
			checkUnits(_context: ParseContext, args: ExpResult[], source: string, pos: number): void {
				if (args[0].unitType !== DimensionlessUnit)
					throw new ExpError(source, pos, tr("Input 'alpha' must be dimensionless"));
				if (args[1].unitType !== DimensionlessUnit)
					throw new ExpError(source, pos, tr("Input 'beta' must be dimensionless"));
				if (args.length > 3 && args[3].unitType !== DimensionlessUnit)
					throw new ExpError(source, pos, tr("Input 'seed' must be dimensionless"));
			},
			call(context: EvalContext | null, args: ExpResult[], _source: string, _pos: number): ExpResult | null {
				if (context === null)  // trap call from ConstOptimizer.updateRef
					return null;
				const thisEnt = thisEntOf(context);
				const simModel = thisEnt.getJaamSimModel();
				let seed = -1;
				if (args.length > 3)
					seed = d2i(args[3].value);
				const key = String(seed) + "beta" + String(thisEnt.getEntityNumber());
				const rngs = getRngs(simModel, key, seed, 1);
				let val = 0.0;
				if (EventManager.hasCurrent()) {
					const alpha = args[0].value;
					const beta = args[1].value;
					const scale = args[2].value;
					val = BetaDistribution.getSample(alpha, beta, scale, rngs[0]);
				}
				return ExpResult.makeNumResult(val, args[2].unitType);
			},
			validate(context: ParseContext, args: ExpValResult[], source: string, pos: number): ExpValResult {
				return validateRandomFunction(context, args, source, pos);
			},
		});

		addFunction("binomial", 2, 3, {
			checkUnits(_context: ParseContext, args: ExpResult[], source: string, pos: number): void {
				if (args[0].unitType !== DimensionlessUnit)
					throw new ExpError(source, pos, tr("Input 'numberOfTrials' must be dimensionless"));
				if (args[1].unitType !== DimensionlessUnit)
					throw new ExpError(source, pos, tr("Input 'probability' must be dimensionless"));
				if (args.length > 2 && args[2].unitType !== DimensionlessUnit)
					throw new ExpError(source, pos, tr("Input 'seed' must be dimensionless"));
			},
			call(context: EvalContext | null, args: ExpResult[], _source: string, _pos: number): ExpResult | null {
				if (context === null)  // trap call from ConstOptimizer.updateRef
					return null;
				const thisEnt = thisEntOf(context);
				const simModel = thisEnt.getJaamSimModel();
				let seed = -1;
				if (args.length > 2)
					seed = d2i(args[2].value);
				const key = String(seed) + "binomial" + String(thisEnt.getEntityNumber());
				const rngs = getRngs(simModel, key, seed, 1);
				let val = 0.0;
				if (EventManager.hasCurrent()) {
					const numberOfTrials = d2i(args[0].value);
					const probability = args[1].value;
					val = BinomialDistribution.getSample(numberOfTrials, probability, rngs[0]);
				}
				return ExpResult.makeNumResult(val, DimensionlessUnit);
			},
			validate(context: ParseContext, args: ExpValResult[], source: string, pos: number): ExpValResult {
				return validateRandomFunction(context, args, source, pos);
			},
		});

		addFunction("continuous", 2, 3, {
			checkUnits(_context: ParseContext, args: ExpResult[], source: string, pos: number): void {
				if (args.length > 2 && args[2].unitType !== DimensionlessUnit)
					throw new ExpError(source, pos, tr("Input 'seed' must be dimensionless"));
			},
			call(context: EvalContext | null, args: ExpResult[], source: string, pos: number): ExpResult | null {
				if (context === null)  // trap call from ConstOptimizer.updateRef
					return null;

				const thisEnt = thisEntOf(context);
				const simModel = thisEnt.getJaamSimModel();
				let seed = -1;
				if (args.length > 2)
					seed = d2i(args[2].value);
				const key = String(seed) + "continuous" + String(thisEnt.getEntityNumber());
				const rngs = getRngs(simModel, key, seed, 1);

				let val = 0.0;
				let ut: UnitClass | null = DimensionlessUnit;
				if (EventManager.hasCurrent()) {
					if (args[0].colVal!.getSize() !== args[1].colVal!.getSize()) {
						throw new ExpError(source, pos, tr("The 'values' and 'cumProbs' arrays must have the same number of entries."));
					}
					const n = args[0].colVal!.getSize();
					const cumProbs = new Array<number>(n).fill(0);
					const values = new Array<number>(n).fill(0);
					for (let i = 0; i < n; i++) {
						const indexRes = ExpResult.makeNumResult(i + 1, DimensionlessUnit);
						cumProbs[i] = args[0].colVal!.index(indexRes).value;
						const res = args[1].colVal!.index(indexRes);
						if (i === 0) {
							ut = res.unitType;
						}
						else {
							if (res.unitType !== ut) {
								throw new ExpError(source, pos, tr("The entries in the 'values' array must have the same unit type."));
							}
							if (cumProbs[i] < cumProbs[i - 1]) {
								throw new ExpError(source, pos, tr("The entries in the 'cumProbs' array must increase monotonically."));
							}
						}
						values[i] = res.value;
					}
					// Java: n が 0 なら ArrayIndexOutOfBoundsException
					if (n === 0)
						throw new IndexOutOfBoundsException("Index 0 out of bounds for length 0");
					if (cumProbs[0] !== 0.0) {
						throw new ExpError(source, pos, tr("The first entry in the 'cumProbs' array must be exactly 0.0."));
					}
					if (cumProbs[n - 1] !== 1.0) {
						throw new ExpError(source, pos, tr("The last entry in the 'cumProbs' array must be exactly 1.0."));
					}
					val = ContinuousDistribution.getSample(values, cumProbs, rngs[0]);
				}
				return ExpResult.makeNumResult(val, ut);
			},
			validate(context: ParseContext, args: ExpValResult[], source: string, pos: number): ExpValResult {
				return validateArrayFunction(context, args, source, pos);
			},
		});

		addFunction("discrete", 2, 3, {
			checkUnits(_context: ParseContext, args: ExpResult[], source: string, pos: number): void {
				if (args.length > 2 && args[2].unitType !== DimensionlessUnit)
					throw new ExpError(source, pos, tr("Input 'seed' must be dimensionless"));
			},
			call(context: EvalContext | null, args: ExpResult[], source: string, pos: number): ExpResult | null {
				if (context === null)  // trap call from ConstOptimizer.updateRef
					return null;

				const thisEnt = thisEntOf(context);
				const simModel = thisEnt.getJaamSimModel();
				let seed = -1;
				if (args.length > 2)
					seed = d2i(args[2].value);
				const key = String(seed) + "discrete" + String(thisEnt.getEntityNumber());
				const rngs = getRngs(simModel, key, seed, 1);

				let val = 0.0;
				let ut: UnitClass | null = DimensionlessUnit;
				if (EventManager.hasCurrent()) {
					if (args[0].colVal!.getSize() !== args[1].colVal!.getSize()) {
						throw new ExpError(source, pos, tr("The 'values' and 'probs' arrays must have the same number of entries."));
					}
					const n = args[0].colVal!.getSize();
					const cumProbs = new Array<number>(n).fill(0);
					const values = new Array<number>(n).fill(0);
					let total = 0.0;
					for (let i = 0; i < n; i++) {
						const indexRes = ExpResult.makeNumResult(i + 1, DimensionlessUnit);
						total += args[0].colVal!.index(indexRes).value;
						cumProbs[i] = total;
						const res = args[1].colVal!.index(indexRes);
						if (i === 0) {
							ut = res.unitType;
						}
						else if (res.unitType !== ut) {
							throw new ExpError(source, pos, tr("The entries in the 'values' array must have the same unit type."));
						}
						values[i] = res.value;
					}
					// Java: n が 0 なら ArrayIndexOutOfBoundsException
					if (n === 0)
						throw new IndexOutOfBoundsException("Index -1 out of bounds for length 0");
					if (!MathUtils.near(cumProbs[n - 1], 1.0)) {
						throw new ExpError(source, pos, tr("The entries in the 'probs' array must sum to exactly 1.0."));
					}
					cumProbs[n - 1] = 1.0;
					val = DiscreteDistribution.getSample(values, cumProbs, rngs[0]);
				}
				return ExpResult.makeNumResult(val, ut);
			},
			validate(context: ParseContext, args: ExpValResult[], source: string, pos: number): ExpValResult {
				return validateArrayFunction(context, args, source, pos);
			},
		});

		addFunction("discreteUniform", 2, 3, {
			checkUnits(_context: ParseContext, args: ExpResult[], source: string, pos: number): void {
				if (args[0].unitType !== DimensionlessUnit)
					throw new ExpError(source, pos, tr("Input 'minIndex' must be dimensionless"));
				if (args[1].unitType !== DimensionlessUnit)
					throw new ExpError(source, pos, tr("Input 'maxIndex' must be dimensionless"));
				if (args.length > 2 && args[2].unitType !== DimensionlessUnit)
					throw new ExpError(source, pos, tr("Input 'seed' must be dimensionless"));
			},
			call(context: EvalContext | null, args: ExpResult[], _source: string, _pos: number): ExpResult | null {
				if (context === null)  // trap call from ConstOptimizer.updateRef
					return null;
				const thisEnt = thisEntOf(context);
				const simModel = thisEnt.getJaamSimModel();
				let seed = -1;
				if (args.length > 2)
					seed = d2i(args[2].value);
				const key = String(seed) + "discreteUniform" + String(thisEnt.getEntityNumber());
				const rngs = getRngs(simModel, key, seed, 1);
				let val = 0.0;
				if (EventManager.hasCurrent()) {
					const minIndex = d2i(args[0].value);
					const maxIndex = d2i(args[1].value);
					val = DiscreteUniformDistribution.getSample(minIndex, maxIndex, rngs[0]);
				}
				return ExpResult.makeNumResult(val, DimensionlessUnit);
			},
			validate(context: ParseContext, args: ExpValResult[], source: string, pos: number): ExpValResult {
				return validateRandomFunction(context, args, source, pos);
			},
		});

		addFunction("erlang", 2, 3, {
			checkUnits(_context: ParseContext, args: ExpResult[], source: string, pos: number): void {
				if (args[1].unitType !== DimensionlessUnit)
					throw new ExpError(source, pos, tr("Input 'shape' must be dimensionless"));
				if (args.length > 2 && args[2].unitType !== DimensionlessUnit)
					throw new ExpError(source, pos, tr("Input 'seed' must be dimensionless"));
			},
			call(context: EvalContext | null, args: ExpResult[], _source: string, _pos: number): ExpResult | null {
				if (context === null)  // trap call from ConstOptimizer.updateRef
					return null;
				const thisEnt = thisEntOf(context);
				const simModel = thisEnt.getJaamSimModel();
				let seed = -1;
				if (args.length > 2)
					seed = d2i(args[2].value);
				const key = String(seed) + "erlang" + String(thisEnt.getEntityNumber());
				const rngs = getRngs(simModel, key, seed, 1);
				let val = 0.0;
				if (EventManager.hasCurrent()) {
					const mean = args[0].value;
					const shape = d2i(args[1].value);
					val = ErlangDistribution.getSample(mean, shape, rngs[0]);
				}
				return ExpResult.makeNumResult(val, args[0].unitType);
			},
			validate(context: ParseContext, args: ExpValResult[], source: string, pos: number): ExpValResult {
				return validateRandomFunction(context, args, source, pos);
			},
		});

		addFunction("exponential", 1, 2, {
			checkUnits(_context: ParseContext, args: ExpResult[], source: string, pos: number): void {
				if (args.length > 1 && args[1].unitType !== DimensionlessUnit)
					throw new ExpError(source, pos, tr("Input 'seed' must be dimensionless"));
			},
			call(context: EvalContext | null, args: ExpResult[], _source: string, _pos: number): ExpResult | null {
				if (context === null)  // trap call from ConstOptimizer.updateRef
					return null;
				const thisEnt = thisEntOf(context);
				const simModel = thisEnt.getJaamSimModel();
				let seed = -1;
				if (args.length > 1)
					seed = d2i(args[1].value);
				const key = String(seed) + "exponential" + String(thisEnt.getEntityNumber());
				const rngs = getRngs(simModel, key, seed, 1);
				let val = 0.0;
				if (EventManager.hasCurrent()) {
					const mean = args[0].value;
					val = ExponentialDistribution.getSample(mean, rngs[0]);
				}
				return ExpResult.makeNumResult(val, args[0].unitType);
			},
			validate(context: ParseContext, args: ExpValResult[], source: string, pos: number): ExpValResult {
				return validateRandomFunction(context, args, source, pos);
			},
		});

		addFunction("gamma", 2, 3, {
			checkUnits(_context: ParseContext, args: ExpResult[], source: string, pos: number): void {
				if (args[1].unitType !== DimensionlessUnit)
					throw new ExpError(source, pos, tr("Input 'shape' must be dimensionless"));
				if (args.length > 2 && args[2].unitType !== DimensionlessUnit)
					throw new ExpError(source, pos, tr("Input 'seed' must be dimensionless"));
			},
			call(context: EvalContext | null, args: ExpResult[], _source: string, _pos: number): ExpResult | null {
				if (context === null)  // trap call from ConstOptimizer.updateRef
					return null;
				const thisEnt = thisEntOf(context);
				const simModel = thisEnt.getJaamSimModel();
				let seed = -1;
				if (args.length > 2)
					seed = d2i(args[2].value);
				const key = String(seed) + "gamma" + String(thisEnt.getEntityNumber());
				const rngs = getRngs(simModel, key, seed, 2);
				let val = 0.0;
				if (EventManager.hasCurrent()) {
					const mean = args[0].value;
					const shape = args[1].value;
					val = GammaDistribution.getSample(mean, shape, rngs[0], rngs[1]);
				}
				return ExpResult.makeNumResult(val, args[0].unitType);
			},
			validate(context: ParseContext, args: ExpValResult[], source: string, pos: number): ExpValResult {
				return validateRandomFunction(context, args, source, pos);
			},
		});

		addFunction("geometric", 1, 2, {
			checkUnits(_context: ParseContext, args: ExpResult[], source: string, pos: number): void {
				if (args[0].unitType !== DimensionlessUnit)
					throw new ExpError(source, pos, tr("Input 'probability' must be dimensionless"));
				if (args.length > 1 && args[1].unitType !== DimensionlessUnit)
					throw new ExpError(source, pos, tr("Input 'seed' must be dimensionless"));
			},
			call(context: EvalContext | null, args: ExpResult[], _source: string, _pos: number): ExpResult | null {
				if (context === null)  // trap call from ConstOptimizer.updateRef
					return null;
				const thisEnt = thisEntOf(context);
				const simModel = thisEnt.getJaamSimModel();
				let seed = -1;
				if (args.length > 1)
					seed = d2i(args[1].value);
				const key = String(seed) + "geometric" + String(thisEnt.getEntityNumber());
				const rngs = getRngs(simModel, key, seed, 1);
				let val = 0.0;
				if (EventManager.hasCurrent()) {
					const probability = args[0].value;
					val = GeometricDistribution.getSample(probability, rngs[0]);
				}
				return ExpResult.makeNumResult(val, DimensionlessUnit);
			},
			validate(context: ParseContext, args: ExpValResult[], source: string, pos: number): ExpValResult {
				return validateRandomFunction(context, args, source, pos);
			},
		});

		addFunction("loglogistic", 2, 3, {
			checkUnits(_context: ParseContext, args: ExpResult[], source: string, pos: number): void {
				if (args[1].unitType !== DimensionlessUnit)
					throw new ExpError(source, pos, tr("Input 'shape' must be dimensionless"));
				if (args.length > 2 && args[2].unitType !== DimensionlessUnit)
					throw new ExpError(source, pos, tr("Input 'seed' must be dimensionless"));
			},
			call(context: EvalContext | null, args: ExpResult[], _source: string, _pos: number): ExpResult | null {
				if (context === null)  // trap call from ConstOptimizer.updateRef
					return null;
				const thisEnt = thisEntOf(context);
				const simModel = thisEnt.getJaamSimModel();
				let seed = -1;
				if (args.length > 2)
					seed = d2i(args[2].value);
				const key = String(seed) + "loglogistic" + String(thisEnt.getEntityNumber());
				const rngs = getRngs(simModel, key, seed, 1);
				let val = 0.0;
				if (EventManager.hasCurrent()) {
					const scale = args[0].value;
					const shape = args[1].value;
					val = LogLogisticDistribution.getSample(scale, shape, rngs[0]);
				}
				return ExpResult.makeNumResult(val, args[0].unitType);
			},
			validate(context: ParseContext, args: ExpValResult[], source: string, pos: number): ExpValResult {
				return validateRandomFunction(context, args, source, pos);
			},
		});

		addFunction("lognormal", 3, 4, {
			checkUnits(_context: ParseContext, args: ExpResult[], source: string, pos: number): void {
				if (args[1].unitType !== DimensionlessUnit)
					throw new ExpError(source, pos, tr("Input 'normalMean' must be dimensionless"));
				if (args[2].unitType !== DimensionlessUnit)
					throw new ExpError(source, pos, tr("Input 'normalStandardDeviation' must be dimensionless"));
				if (args.length > 3 && args[3].unitType !== DimensionlessUnit)
					throw new ExpError(source, pos, tr("Input 'seed' must be dimensionless"));
			},
			call(context: EvalContext | null, args: ExpResult[], _source: string, _pos: number): ExpResult | null {
				if (context === null)  // trap call from ConstOptimizer.updateRef
					return null;
				const thisEnt = thisEntOf(context);
				const simModel = thisEnt.getJaamSimModel();
				let seed = -1;
				if (args.length > 3)
					seed = d2i(args[3].value);
				const key = String(seed) + "lognormal" + String(thisEnt.getEntityNumber());
				const rngs = getRngs(simModel, key, seed, 2);
				let val = 0.0;
				if (EventManager.hasCurrent()) {
					const scale = args[0].value;
					const normalMean = args[1].value;
					const normalSD = args[2].value;
					val = scale * LogNormalDistribution.getSample(normalMean, normalSD, rngs[0], rngs[1]);
				}
				return ExpResult.makeNumResult(val, args[0].unitType);
			},
			validate(context: ParseContext, args: ExpValResult[], source: string, pos: number): ExpValResult {
				return validateRandomFunction(context, args, source, pos);
			},
		});

		addFunction("negativeBinomial", 2, 3, {
			checkUnits(_context: ParseContext, args: ExpResult[], source: string, pos: number): void {
				if (args[0].unitType !== DimensionlessUnit)
					throw new ExpError(source, pos, tr("Input 'successfulTrials' must be dimensionless"));
				if (args[1].unitType !== DimensionlessUnit)
					throw new ExpError(source, pos, tr("Input 'probability' must be dimensionless"));
				if (args.length > 2 && args[2].unitType !== DimensionlessUnit)
					throw new ExpError(source, pos, tr("Input 'seed' must be dimensionless"));
			},
			call(context: EvalContext | null, args: ExpResult[], _source: string, _pos: number): ExpResult | null {
				if (context === null)  // trap call from ConstOptimizer.updateRef
					return null;
				const thisEnt = thisEntOf(context);
				const simModel = thisEnt.getJaamSimModel();
				let seed = -1;
				if (args.length > 2)
					seed = d2i(args[2].value);
				const key = String(seed) + "negativeBinomial" + String(thisEnt.getEntityNumber());
				const rngs = getRngs(simModel, key, seed, 1);
				let val = 0.0;
				if (EventManager.hasCurrent()) {
					const successfulTrials = d2i(args[0].value);
					const probability = args[1].value;
					val = NegativeBinomialDistribution.getSample(successfulTrials, probability, rngs[0]);
				}
				return ExpResult.makeNumResult(val, DimensionlessUnit);
			},
			validate(context: ParseContext, args: ExpValResult[], source: string, pos: number): ExpValResult {
				return validateRandomFunction(context, args, source, pos);
			},
		});

		addFunction("normal", 2, 3, {
			checkUnits(_context: ParseContext, args: ExpResult[], source: string, pos: number): void {
				if (args[0].unitType !== args[1].unitType)
					throw new ExpError(source, pos, tr("Standard deviation must have the same units as the Mean"));
				if (args.length > 2 && args[2].unitType !== DimensionlessUnit)
					throw new ExpError(source, pos, tr("Input 'seed' must be dimensionless"));
			},
			call(context: EvalContext | null, args: ExpResult[], _source: string, _pos: number): ExpResult | null {
				if (context === null)  // trap call from ConstOptimizer.updateRef
					return null;
				const thisEnt = thisEntOf(context);
				const simModel = thisEnt.getJaamSimModel();
				let seed = -1;
				if (args.length > 2)
					seed = d2i(args[2].value);
				const key = String(seed) + "normal" + String(thisEnt.getEntityNumber());
				const rngs = getRngs(simModel, key, seed, 2);
				let val = 0.0;
				if (EventManager.hasCurrent()) {
					const mean = args[0].value;
					const sdev = args[1].value;
					val = NormalDistribution.getSample(mean, sdev, rngs[0], rngs[1]);
				}
				return ExpResult.makeNumResult(val, args[0].unitType);
			},
			validate(context: ParseContext, args: ExpValResult[], source: string, pos: number): ExpValResult {
				return validateRandomFunction(context, args, source, pos);
			},
		});

		addFunction("poisson", 1, 2, {
			checkUnits(_context: ParseContext, args: ExpResult[], source: string, pos: number): void {
				if (args[0].unitType !== DimensionlessUnit)
					throw new ExpError(source, pos, tr("Input 'mean' must be dimensionless"));
				if (args.length > 1 && args[1].unitType !== DimensionlessUnit)
					throw new ExpError(source, pos, tr("Input 'seed' must be dimensionless"));
			},
			call(context: EvalContext | null, args: ExpResult[], _source: string, _pos: number): ExpResult | null {
				if (context === null)  // trap call from ConstOptimizer.updateRef
					return null;
				const thisEnt = thisEntOf(context);
				const simModel = thisEnt.getJaamSimModel();
				let seed = -1;
				if (args.length > 1)
					seed = d2i(args[1].value);
				const key = String(seed) + "poisson" + String(thisEnt.getEntityNumber());
				const rngs = getRngs(simModel, key, seed, 1);
				let val = 0.0;
				if (EventManager.hasCurrent()) {
					const mean = args[0].value;
					val = PoissonDistribution.getSample(mean, rngs[0]);
				}
				return ExpResult.makeNumResult(val, DimensionlessUnit);
			},
			validate(context: ParseContext, args: ExpValResult[], source: string, pos: number): ExpValResult {
				return validateRandomFunction(context, args, source, pos);
			},
		});

		addFunction("triangular", 3, 4, {
			checkUnits(_context: ParseContext, args: ExpResult[], source: string, pos: number): void {
				if (args[1].unitType !== args[0].unitType)
					throw new ExpError(source, pos, tr("Input 'mode' must have the same unit type as 'minValue'"));
				if (args[2].unitType !== args[0].unitType)
					throw new ExpError(source, pos, tr("Input 'maxValue' must have the same unit type as 'minValue'"));
				if (args.length > 3 && args[3].unitType !== DimensionlessUnit)
					throw new ExpError(source, pos, tr("Input 'seed' must be dimensionless"));
			},
			call(context: EvalContext | null, args: ExpResult[], _source: string, _pos: number): ExpResult | null {
				if (context === null)  // trap call from ConstOptimizer.updateRef
					return null;
				const thisEnt = thisEntOf(context);
				const simModel = thisEnt.getJaamSimModel();
				let seed = -1;
				if (args.length > 3)
					seed = d2i(args[3].value);
				const key = String(seed) + "triangular" + String(thisEnt.getEntityNumber());
				const rngs = getRngs(simModel, key, seed, 1);
				let val = 0.0;
				if (EventManager.hasCurrent()) {
					const minValue = args[0].value;
					const mode = args[1].value;
					const maxValue = args[2].value;
					val = TriangularDistribution.getSample(minValue, mode, maxValue, rngs[0]);
				}
				return ExpResult.makeNumResult(val, args[0].unitType);
			},
			validate(context: ParseContext, args: ExpValResult[], source: string, pos: number): ExpValResult {
				return validateRandomFunction(context, args, source, pos);
			},
		});

		addFunction("uniform", 2, 3, {
			checkUnits(_context: ParseContext, args: ExpResult[], source: string, pos: number): void {
				if (args[1].unitType !== args[0].unitType)
					throw new ExpError(source, pos, tr("Input 'maxValue' must have the same unit type as 'minValue'"));
				if (args.length > 2 && args[2].unitType !== DimensionlessUnit)
					throw new ExpError(source, pos, tr("Input 'seed' must be dimensionless"));
			},
			call(context: EvalContext | null, args: ExpResult[], _source: string, _pos: number): ExpResult | null {
				if (context === null)  // trap call from ConstOptimizer.updateRef
					return null;
				const thisEnt = thisEntOf(context);
				const simModel = thisEnt.getJaamSimModel();
				let seed = -1;
				if (args.length > 2)
					seed = d2i(args[2].value);
				const key = String(seed) + "uniform" + String(thisEnt.getEntityNumber());
				const rngs = getRngs(simModel, key, seed, 1);
				let val = 0.0;
				if (EventManager.hasCurrent()) {
					const minValue = args[0].value;
					const maxValue = args[1].value;
					val = UniformDistribution.getSample(minValue, maxValue, rngs[0]);
				}
				return ExpResult.makeNumResult(val, args[0].unitType);
			},
			validate(context: ParseContext, args: ExpValResult[], source: string, pos: number): ExpValResult {
				return validateRandomFunction(context, args, source, pos);
			},
		});

		addFunction("weibull", 2, 3, {
			checkUnits(_context: ParseContext, args: ExpResult[], source: string, pos: number): void {
				if (args[1].unitType !== DimensionlessUnit)
					throw new ExpError(source, pos, tr("Input 'shape' must be dimensionless"));
				// Java のまま（引数が 2 つだと args[2] で ArrayIndexOutOfBoundsException になる）
				if (argAt(args, 2).unitType !== args[0].unitType)
					throw new ExpError(source, pos, tr("Input 'location' must have the same unit type as 'scale'"));
				if (args.length > 2 && args[2].unitType !== DimensionlessUnit)
					throw new ExpError(source, pos, tr("Input 'seed' must be dimensionless"));
			},
			call(context: EvalContext | null, args: ExpResult[], _source: string, _pos: number): ExpResult | null {
				if (context === null)  // trap call from ConstOptimizer.updateRef
					return null;
				const thisEnt = thisEntOf(context);
				const simModel = thisEnt.getJaamSimModel();
				let seed = -1;
				if (args.length > 2)
					seed = d2i(args[2].value);
				const key = String(seed) + "weibull" + String(thisEnt.getEntityNumber());
				const rngs = getRngs(simModel, key, seed, 1);
				let val = 0.0;
				if (EventManager.hasCurrent()) {
					const scale = args[0].value;
					const shape = args[1].value;
					val = WeibullDistribution.getSample(scale, shape, rngs[0]);
				}
				return ExpResult.makeNumResult(val, args[0].unitType);
			},
			validate(context: ParseContext, args: ExpValResult[], source: string, pos: number): ExpValResult {
				return validateRandomFunction(context, args, source, pos);
			},
		});

		addFunction("date", 1, 1, {
			checkUnits(_context: ParseContext, args: ExpResult[], source: string, pos: number): void {
				if (args[0].unitType !== TimeUnit)
					throw new ExpError(source, pos, tr("Input 'simTime' must be have units of time"));
			},
			call(context: EvalContext | null, args: ExpResult[], _source: string, _pos: number): ExpResult | null {
				if (context === null)  // trap call from ConstOptimizer.updateRef
					return null;
				const thisEnt = thisEntOf(context);
				const simModel = thisEnt.getJaamSimModel();
				const millis = simModel.simTimeToCalendarMillis(args[0].value);
				const date: number[] = simModel.getSimDate(millis).toArray();
				const list: ExpResult[] = [];
				for (const val of date) {
					list.push( ExpResult.makeNumResult(val, DimensionlessUnit) );
				}
				return ExpCollections.makeAssignableArrrayCollection(list, false);
			},
			validate(_context: ParseContext, args: ExpValResult[], source: string, pos: number): ExpValResult {
				for (const arg of args) {
					if (  arg.state === ExpValResult.State.ERROR ||
					      arg.state === ExpValResult.State.UNDECIDABLE) {
						return arg;
					}
				}
				// Check that arguments are numbers
				for (const arg of args) {
					if (arg.type !== ExpResType.NUMBER) {
						const error = new ExpError(source, pos, tr("Argument must be a number"));
						return ExpValResult.makeErrorRes(error);
					}
				}
				return ExpValResult.makeValidRes(ExpResType.COLLECTION, DimensionlessUnit);
			},
		});

		addFunction("simTimeForDate", 3, 7, {
			checkUnits(_context: ParseContext, args: ExpResult[], source: string, pos: number): void {
				for (const arg of args) {
					if (arg.unitType !== DimensionlessUnit) {
						throw new ExpError(source, pos, tr("All inputs must be dimensionless numbers"));
					}
				}
			},
			call(context: EvalContext | null, args: ExpResult[], _source: string, _pos: number): ExpResult | null {
				if (context === null)  // trap call from ConstOptimizer.updateRef
					return null;
				const thisEnt = thisEntOf(context);
				const simModel = thisEnt.getJaamSimModel();
				const year = d2i(args[0].value);
				const month = d2i(args[1].value);
				const dayOfMonth = d2i(args[2].value);
				const hourOfDay = (args.length > 3) ? d2i(args[3].value) : 0;
				const minute = (args.length > 4) ? d2i(args[4].value) : 0;
				const second = (args.length > 5) ? d2i(args[5].value) : 0;
				const ms = (args.length > 6) ? d2i(args[6].value) : 0;
				const millis = simModel.getCalendarMillis(year, (month - 1) | 0, dayOfMonth, hourOfDay, minute, second, ms);
				const simTime = simModel.calendarMillisToSimTime(millis);
				return ExpResult.makeNumResult(simTime, TimeUnit);
			},
			validate(_context: ParseContext, args: ExpValResult[], source: string, pos: number): ExpValResult {
				for (const arg of args) {
					if (  arg.state === ExpValResult.State.ERROR ||
					      arg.state === ExpValResult.State.UNDECIDABLE) {
						return arg;
					}
				}
				// Check that arguments are numbers
				for (const arg of args) {
					if (arg.type !== ExpResType.NUMBER) {
						const error = new ExpError(source, pos, tr("All inputs must be dimensionless numbers"));
						return ExpValResult.makeErrorRes(error);
					}
				}
				return ExpValResult.makeValidRes(ExpResType.NUMBER, TimeUnit);
			},
		});

		addFunction("typeName", 1, 1, {
			checkUnits(_context: ParseContext, _args: ExpResult[], _source: string, _pos: number): void {},
			call(_context: EvalContext | null, args: ExpResult[], _source: string, _pos: number): ExpResult {
				return ExpResult.makeStringResult(args[0].getTypeName());
			},
			validate(_context: ParseContext, args: ExpValResult[], _source: string, _pos: number): ExpValResult {
				for (const arg of args) {
					if (  arg.state === ExpValResult.State.ERROR ||
					      arg.state === ExpValResult.State.UNDECIDABLE) {
						return arg;
					}
				}
				return ExpValResult.makeValidRes(ExpResType.STRING, null);
			},
		});
	}
}
