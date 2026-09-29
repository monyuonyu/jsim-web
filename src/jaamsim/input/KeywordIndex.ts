/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2014 Ausenco Engineering Canada Inc.
 * Copyright (C) 2019-2020 JaamSim Software Inc.
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
// 注: コンストラクタの多重定義（Java の 4 つ）は、引数の型と数で見分ける:
//   new KeywordIndex(word, arg, ctxt)            … arg の全部
//   new KeywordIndex(kw, s)                      … kw の s 番目から
//   new KeywordIndex(kw, s, e)                   … kw の s 番目から e 番目の前まで
//   new KeywordIndex(word, inp, s, e, ctxt)      … inp の s 番目から e 番目の前まで
// formatInput の多重定義（2 つと 3 つ）は、引数の数で見分ける。
import { jstr, IndexOutOfBoundsException } from "../internal.ts";
import type { JClass } from "../java/lang.ts";
import type { Entity } from "../basicsim/Entity.ts";
import type { Vec3d } from "../math/Vec3d.ts";
import { DistanceUnit } from "../internal.ts";
import { Unit } from "../internal.ts";
import { Input } from "../internal.ts";
import type { ParseContext } from "./ParseContext.ts";
import { Parser } from "../internal.ts";

export class KeywordIndex {
	private readonly input: string[];
	readonly keyword: string;
	private readonly start: number;
	private readonly end: number;
	readonly context: ParseContext | null;

	constructor(word: string, arg: string[], ctxt: ParseContext | null);
	constructor(kw: KeywordIndex, s: number, e?: number);
	constructor(word: string, inp: string[], s: number, e: number, ctxt: ParseContext | null);
	constructor(a: string | KeywordIndex, b: string[] | number, c?: ParseContext | null | number, d?: number, e?: ParseContext | null) {
		if (a instanceof KeywordIndex) {
			const kw = a;
			const s = b as number;
			this.keyword = kw.keyword;
			this.input = kw.input;
			this.start = kw.start + s;
			this.end = (c === undefined) ? kw.end : kw.start + (c as number);
			this.context = kw.context;
			return;
		}
		const inp = b as string[];
		this.keyword = a;
		this.input = inp;
		if (d === undefined) {
			this.start = 0;
			this.end = inp.length;
			this.context = (c as ParseContext | null | undefined) ?? null;
		}
		else {
			this.start = c as number;
			this.end = d;
			this.context = e ?? null;
		}
	}

	numArgs(): number {
		return this.end - this.start;
	}

	argString(): string {
		const tokens = [...this.getArgArray()];
		return Input.getValueString(tokens, false);
	}

	getArgArray(): string[] {
		const ret: string[] = new Array(this.end - this.start);
		for (let i = this.start; i < this.end; i++) {
			ret[i - this.start] = this.input[i];
		}
		return ret;
	}

	getArg(index: number): string {
		if (index < 0 || index >= this.numArgs())
			throw new IndexOutOfBoundsException("Index out of range:" + index);
		return this.input[this.start + index];
	}

	getSubArgs(): KeywordIndex[] {
		Input.assertBracesMatch(this);
		const subArgs: KeywordIndex[] = [];
		for (let i = 0; i < this.numArgs(); i++) {
			//skip over opening brace if present
			if (this.getArg(i) === "{")
				i++;

			//iterate until closing brace, or end of entry
			const subArgStart = i;
			let subArgEnd = i;
			for (let j = i; j < this.numArgs(); j++, i++) {
				if (this.getArg(j) === "}") {
					break;
				}

				subArgEnd++;
			}

			const subArg = new KeywordIndex(this.keyword, this.input, subArgStart + this.start, subArgEnd + this.start, this.context);
			subArgs.push(subArg);
		}

		return subArgs;
	}

	equals(obj: unknown): boolean {
		if (this === obj) {
			return true;
		}
		if (!(obj instanceof KeywordIndex))
			return false;

		const kw = obj;
		if (this.context === null && kw.context !== null)
			return false;
		if (this.context !== null && !this.context.equals(kw.context))
			return false;

		return listEquals(this.input, kw.input) && this.keyword === kw.keyword
				&& this.start === kw.start && this.end === kw.end;
	}

	toString(): string {
		return "[" + this.input.slice(this.start, this.end).join(", ") + "]";
	}

	static formatVec3dInput(ent: Entity, keyword: string, point: Vec3d, ut: JClass<Unit>): KeywordIndex {
		let factor = 1.0;
		let unitStr = Unit.getSIUnit(ut);
		const u = ent.getJaamSimModel().getPreferredUnit(ut);
		if (u !== null) {
			factor = u.getConversionFactorToSI();
			unitStr = u.getName();
		}
		const tokens: string[] = [];
		tokens.push(coordFormat(point.x/factor));
		tokens.push(coordFormat(point.y/factor));
		tokens.push(coordFormat(point.z/factor));
		if (unitStr.length > 0) {
			tokens.push(unitStr);
		}
		return new KeywordIndex(keyword, tokens, null);
	}

	static formatPointsInputs(ent: Entity, keyword: string, points: Vec3d[], offset: Vec3d): KeywordIndex {
		let factor = 1.0;
		let unitStr = Unit.getSIUnit(DistanceUnit);
		const u = ent.getJaamSimModel().getPreferredUnit(DistanceUnit);
		if (u !== null) {
			factor = u.getConversionFactorToSI();
			unitStr = u.getName();
		}
		const tokens: string[] = [];
		for (const v of points) {
			tokens.push("{");
			tokens.push(coordFormat((v.x + offset.x)/factor));
			tokens.push(coordFormat((v.y + offset.y)/factor));
			tokens.push(coordFormat((v.z + offset.z)/factor));
			tokens.push(unitStr);
			tokens.push("}");
		}
		return new KeywordIndex(keyword, tokens, null);
	}

	static formatInput(keyword: string, str: string, pc: ParseContext | null = null): KeywordIndex {
		const tokens: string[] = [];
		Parser.tokenize(tokens, str, true);
		return new KeywordIndex(keyword, tokens, pc);
	}

	static formatArgs(keyword: string, ...args: string[]): KeywordIndex {
		const tokens: string[] = [];
		for (const each of args) {
			tokens.push(each);
		}
		return new KeywordIndex(keyword, tokens, null);
	}

	static formatBoolean(keyword: string, bool: boolean): KeywordIndex {
		let str = "FALSE";
		if (bool)
			str = "TRUE";
		return KeywordIndex.formatArgs(keyword, str);
	}

	static formatIntegers(keyword: string, ...args: number[]): KeywordIndex {
		const tokens: string[] = [];
		for (const each of args) {
			tokens.push(String(each));
		}
		return new KeywordIndex(keyword, tokens, null);
	}

	static formatValue(keyword: string, val: number, unit: string | null): KeywordIndex {
		const tokens: string[] = [];
		tokens.push(jstr(val));
		if (unit !== null && unit.length > 0)
			tokens.push(unit);
		return new KeywordIndex(keyword, tokens, null);
	}

}

function listEquals(a: string[], b: string[]): boolean {
	if (a === b)
		return true;
	if (a.length !== b.length)
		return false;
	for (let i = 0; i < a.length; i++)
		if (a[i] !== b[i])
			return false;
	return true;
}

/**
 * Java の DecimalFormat("0.0#####")（Locale.US）の format。
 * 小数点以下 1 桁から 6 桁。丸めは HALF_EVEN（2 進の値そのものに対して）。負の数が 0 に丸まったときも "-" を残す。
 */
export function coordFormat(x: number): string {
	if (Number.isNaN(x))
		return "NaN";  // TODO(移植): Java の DecimalFormat は NaN を "�" にする
	if (!Number.isFinite(x))
		return (x < 0 ? "-" : "") + "∞";
	const neg = x < 0 || Object.is(x, -0);
	const ax = Math.abs(x);
	let s: string;
	if (Number.isInteger(ax * 256) && ax < 1e15) {
		// 2 進の小数が 8 桁以下なので、小数点以下 8 桁で正確に表せる。ちょうど半分のときは偶数へ
		const t = ax.toFixed(8);
		const dot = t.indexOf(".");
		const keep = t.substring(0, dot + 7);
		const rest = t.substring(dot + 7);
		const lastDigit = Number(keep.charAt(keep.length - 1));
		let up = false;
		if (rest > "50") up = true;
		else if (rest === "50") up = lastDigit % 2 === 1;
		s = up ? addUlpAt6(keep) : keep;
	}
	else {
		// ちょうど半分にはならない（toFixed は 2 進の値そのものを丸める）
		s = ax.toFixed(6);
	}
	// 末尾の 0 を除く（小数点以下は 1 桁以上残す）
	let [ip, fp] = s.split(".");
	fp = fp.replace(/0+$/, "");
	if (fp === "")
		fp = "0";
	return (neg ? "-" : "") + ip + "." + fp;
}

/** "123.456789" の最後の桁に 1 を足す（繰り上がりも） */
function addUlpAt6(s: string): string {
	const digits = s.replace(".", "").split("").map(Number);
	let i = digits.length - 1;
	for (; i >= 0; i--) {
		if (digits[i] === 9) { digits[i] = 0; continue; }
		digits[i]++;
		break;
	}
	if (i < 0)
		digits.unshift(1);
	const d = digits.join("");
	return d.substring(0, d.length - 6) + "." + d.substring(d.length - 6);
}
