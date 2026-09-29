/*
 * Java の標準ライブラリの振る舞いを、TypeScript で同じ結果になるように写したもの（移植の土台）。
 * Copyright (C) 2026 shota
 * Licensed under the Apache License, Version 2.0
 */

// ---- クラスそのもの（Java の Class<T>） ----

/** クラス（コンストラクタ）。抽象クラスも入る */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type JClass<T = unknown> = (abstract new (...args: any[]) => T) | (new (...args: any[]) => T);

/** parent.isAssignableFrom(child)（child が parent か、その子孫か） */
export function jIsAssignableFrom(parent: JClass, child: JClass | null | undefined): boolean {
	for (let c: unknown = child; c; c = Object.getPrototypeOf(c))
		if (c === parent)
			return true;
	return false;
}

// ---- 定数 ----

export const Long = {
	MAX_VALUE: Number.MAX_SAFE_INTEGER,
	MIN_VALUE: Number.MIN_SAFE_INTEGER,
};

export const Integer = {
	MAX_VALUE: 2147483647,
	MIN_VALUE: -2147483648,
	parseInt(s: string): number {
		const t = s.trim() === s ? s : "x";  // Java は前後の空白を許さない
		if (!/^[+-]?\d+$/.test(t))
			throw new NumberFormatException(`For input string: "${s}"`);
		const v = Number(t);
		if (v > Integer.MAX_VALUE || v < Integer.MIN_VALUE)
			throw new NumberFormatException(`For input string: "${s}"`);
		return v;
	},
};

export const Double = {
	MAX_VALUE: Number.MAX_VALUE,
	MIN_VALUE: Number.MIN_VALUE,
	POSITIVE_INFINITY: Number.POSITIVE_INFINITY,
	NEGATIVE_INFINITY: Number.NEGATIVE_INFINITY,
	NaN: Number.NaN,
	isNaN: (x: number) => Number.isNaN(x),
	isInfinite: (x: number) => x === Infinity || x === -Infinity,
	/** Java の Double.parseDouble（前後の空白は許す。16 進や "1d" の d なども受ける） */
	parseDouble(s: string): number {
		const t = s.trim();
		if (/^[+-]?(NaN|Infinity)$/.test(t))
			return Number(t.replace("+", ""));
		const m = /^([+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?)[fFdD]?$/.exec(t);
		if (!m)
			throw new NumberFormatException(`For input string: "${s}"`);
		return Number(m[1]);
	},
	toString: (x: number) => jstr(x),
	compare(a: number, b: number): number {
		if (a < b) return -1;
		if (a > b) return 1;
		// NaN と -0.0 の扱いも Java と同じにする
		const an = Number.isNaN(a), bn = Number.isNaN(b);
		if (an || bn) return an === bn ? 0 : an ? 1 : -1;
		if (a === 0 && b === 0) {
			const ai = Object.is(a, -0), bi = Object.is(b, -0);
			return ai === bi ? 0 : ai ? -1 : 1;
		}
		return 0;
	},
};

export class NumberFormatException extends Error {}
export class IllegalArgumentException extends Error {}
export class IllegalStateException extends Error {}
export class IndexOutOfBoundsException extends Error {}
export class UnsupportedOperationException extends Error {}
export class NullPointerException extends Error {}
export class ArithmeticException extends Error {}

// ---- 数を文字列にする（Java と同じ形） ----

/** 最短の桁（10 進）と指数: x = 0.d1d2d3... × 10^(exp+1) の形で d1... と exp（1.23 なら "123", 0） */
function shortestDigits(x: number): { digits: string; exp: number } {
	let e = Math.abs(x).toExponential();  // 桁を指定しないと、区別に要る最短の桁になる
	// Java は最短が 1 桁のとき、2 桁でいちばん近いものを選ぶ（5e-324 は "4.9E-324"）
	if (!e.includes(".")) {
		const two = Math.abs(x).toExponential(1);
		if (!/^\d\.0e/.test(two))
			e = two;
	}
	const [mant, ex] = e.split("e");
	return { digits: mant.replace(".", ""), exp: Number(ex) };
}

/** Java の Double.toString(x)（"" + x、String.valueOf(x) も同じ） */
export function jstr(x: number): string {
	if (Number.isNaN(x)) return "NaN";
	if (x === Infinity) return "Infinity";
	if (x === -Infinity) return "-Infinity";
	if (x === 0) return Object.is(x, -0) ? "-0.0" : "0.0";
	const sign = x < 0 ? "-" : "";
	const ax = Math.abs(x);
	const { digits, exp } = shortestDigits(ax);
	if (ax >= 1e-3 && ax < 1e7) {
		let intPart: string, frac: string;
		if (exp >= 0) {
			const d = digits.padEnd(exp + 1, "0");
			intPart = d.slice(0, exp + 1);
			frac = d.slice(exp + 1);
		}
		else {
			intPart = "0";
			frac = "0".repeat(-exp - 1) + digits;
		}
		return `${sign}${intPart}.${frac === "" ? "0" : frac}`;
	}
	const frac = digits.slice(1);
	return `${sign}${digits[0]}.${frac === "" ? "0" : frac}E${exp}`;
}

/** 10 進の桁の列を、小数点以下 prec 桁に四捨五入（HALF_UP）する。digits は先頭が最上位、pointPos は小数点の位置 */
function roundDigitsHalfUp(digits: string, pointPos: number, prec: number): { digits: string; pointPos: number } {
	const keep = pointPos + prec;  // 残す桁の数
	if (keep < 0)
		return { digits: "0", pointPos: 1 };
	if (digits.length <= keep)
		return { digits: digits.padEnd(keep, "0"), pointPos };
	const arr = digits.slice(0, keep).split("").map(Number);
	if (Number(digits[keep]) >= 5) {
		let i = arr.length - 1;
		for (; i >= 0; i--) {
			if (arr[i] === 9) { arr[i] = 0; continue; }
			arr[i]++;
			break;
		}
		if (i < 0) {
			arr.unshift(1);
			pointPos++;
		}
	}
	return { digits: arr.join(""), pointPos };
}

/** Java の %.nf（Java は最短の 10 進の桁を HALF_UP で丸める。1.005 を %.2f にすると 1.01） */
export function jfixed(x: number, prec: number): string {
	if (Number.isNaN(x)) return "NaN";
	if (!Number.isFinite(x)) return x > 0 ? "Infinity" : "-Infinity";
	const neg = x < 0 || Object.is(x, -0);
	if (x === 0)
		return (neg ? "-" : "") + (prec > 0 ? "0." + "0".repeat(prec) : "0");
	const { digits, exp } = shortestDigits(Math.abs(x));
	let d = digits, p = exp + 1;
	if (p <= 0) {  // 0.00ddd の形にそろえる
		d = "0".repeat(1 - p) + d;
		p = 1;
	}
	const r = roundDigitsHalfUp(d, p, prec);
	const all = r.digits.padEnd(r.pointPos + prec, "0");
	let intPart = all.slice(0, r.pointPos).replace(/^0+(?=\d)/, "");
	if (intPart === "") intPart = "0";
	const frac = all.slice(r.pointPos, r.pointPos + prec);
	const body = prec > 0 ? `${intPart}.${frac}` : intPart;
	const isZero = /^[0.]*$/.test(body);
	return (neg && !isZero ? "-" : neg && isZero ? "-" : "") + body;
}

/** Java の %.ne（指数は 2 桁以上: 1.500000e+01） */
function jexp(x: number, prec: number, upper: boolean): string {
	if (Number.isNaN(x)) return "NaN";
	if (!Number.isFinite(x)) return x > 0 ? "Infinity" : "-Infinity";
	const neg = x < 0 || Object.is(x, -0);
	let mant: string, e: number;
	if (x === 0) {
		mant = prec > 0 ? "0." + "0".repeat(prec) : "0";
		e = 0;
	}
	else {
		const { digits, exp } = shortestDigits(Math.abs(x));
		const r = roundDigitsHalfUp(digits, 1, prec);
		e = exp + (r.pointPos - 1);
		const d = r.digits.padEnd(1 + prec, "0");
		mant = prec > 0 ? `${d[0]}.${d.slice(1, 1 + prec)}` : d[0];
	}
	const es = (e < 0 ? "-" : "+") + String(Math.abs(e)).padStart(2, "0");
	return (neg ? "-" : "") + mant + (upper ? "E" : "e") + es;
}

function groupThousands(intStr: string): string {
	return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** 値を Java の %s と同じ形の文字列にする（double は呼ぶ側で jstr にしておくこと） */
function toJavaString(v: unknown): string {
	if (v === null || v === undefined) return "null";
	if (typeof v === "string") return v;
	if (typeof v === "number") return String(v);
	if (typeof v === "boolean") return v ? "true" : "false";
	return String(v);
}

/**
 * Java の String.format。対応: %s %S %d %f %e %E %g %G %x %X %c %b %n %% と、フラグ - 0 + , 空白 (、幅、精度、%1$s。
 * 注意: Java で double を %s に渡している所は、呼ぶ側で jstr(x) にしてから渡す（TS では int と double を見分けられない）。
 */
export function jformat(fmt: string, ...args: unknown[]): string {
	let argIdx = 0;
	return fmt.replace(/%(\d+\$)?([-#+ 0,(]*)(\d+)?(\.\d+)?([a-zA-Z%])/g,
		(all, pos: string | undefined, flags: string, width: string | undefined, precStr: string | undefined, conv: string) => {
			if (conv === "%") return "%";
			if (conv === "n") return "\n";
			const v = pos ? args[Number(pos.slice(0, -1)) - 1] : args[argIdx++];
			const prec = precStr !== undefined ? Number(precStr.slice(1)) : undefined;
			let s: string;
			switch (conv) {
			case "s":
			case "S":
				s = toJavaString(v);
				if (prec !== undefined) s = s.slice(0, prec);
				if (conv === "S") s = s.toUpperCase();
				break;
			case "d": {
				const n = typeof v === "bigint" ? v : Math.trunc(Number(v));
				let body = String(n < 0 ? -n : n);
				if (flags.includes(",")) body = groupThousands(body);
				s = (n < 0 ? "-" : flags.includes("+") ? "+" : flags.includes(" ") ? " " : "") + body;
				break;
			}
			case "f": {
				const x = Number(v);
				s = jfixed(x, prec ?? 6);
				if (flags.includes(",")) {
					const neg = s.startsWith("-");
					const [ip, fp] = (neg ? s.slice(1) : s).split(".");
					s = (neg ? "-" : "") + groupThousands(ip) + (fp !== undefined ? "." + fp : "");
				}
				if (flags.includes("+") && !s.startsWith("-") && !Number.isNaN(x)) s = "+" + s;
				break;
			}
			case "e":
			case "E": {
				const x = Number(v);
				s = jexp(x, prec ?? 6, conv === "E");
				if (flags.includes("+") && !s.startsWith("-") && !Number.isNaN(x)) s = "+" + s;
				break;
			}
			case "g":
			case "G": {
				const x = Number(v);
				const p = prec === undefined ? 6 : prec === 0 ? 1 : prec;
				const ax = Math.abs(x);
				if (x !== 0 && Number.isFinite(x)) {
					// Java: 丸めた後の値が 10^-4 以上 10^p 未満なら固定小数点、それ以外は指数
					const rounded = Number(jexp(ax, p - 1, false));
					if (rounded >= 1e-4 && rounded < Math.pow(10, p)) {
						const mag = Math.floor(Math.log10(rounded));
						s = jfixed(x, Math.max(0, p - 1 - mag));
					}
					else {
						s = jexp(x, p - 1, conv === "G");
					}
				}
				else {
					s = x === 0 ? jfixed(x, p - 1) : jexp(x, p - 1, conv === "G");
				}
				break;
			}
			case "x":
			case "X": {
				let n = Number(v);
				if (n < 0) n = n >>> 0;  // int の 2 の補数
				s = n.toString(16);
				if (conv === "X") s = s.toUpperCase();
				break;
			}
			case "c":
				s = typeof v === "number" ? String.fromCharCode(v) : String(v);
				break;
			case "b":
			case "B":
				s = v === null || v === undefined ? "false" : typeof v === "boolean" ? String(v) : "true";
				if (conv === "B") s = s.toUpperCase();
				break;
			default:
				return all;
			}
			if (width !== undefined && s.length < Number(width)) {
				const w = Number(width);
				if (flags.includes("-"))
					s = s.padEnd(w, " ");
				else if (flags.includes("0") && "dfeEgGxX".includes(conv) && /\d/.test(s)) {  // NaN・Infinity は空白で埋める
					const signed = /^[+-]/.test(s);
					s = signed ? s[0] + s.slice(1).padStart(w - 1, "0") : s.padStart(w, "0");
				}
				else
					s = s.padStart(w, " ");
			}
			return s;
		});
}

// ---- 文字列の比べ方 ----

export function jEqualsIgnoreCase(a: string | null | undefined, b: string | null | undefined): boolean {
	if (a == null || b == null) return false;
	return a.length === b.length && a.toUpperCase() === b.toUpperCase() || a.toLowerCase() === b.toLowerCase();
}

/** Java の String.compareTo（UTF-16 の文字の値で比べる） */
export function jCompare(a: string, b: string): number {
	const n = Math.min(a.length, b.length);
	for (let i = 0; i < n; i++) {
		const d = a.charCodeAt(i) - b.charCodeAt(i);
		if (d !== 0) return d;
	}
	return a.length - b.length;
}

export function jCompareIgnoreCase(a: string, b: string): number {
	const n = Math.min(a.length, b.length);
	for (let i = 0; i < n; i++) {
		let c1 = a[i], c2 = b[i];
		if (c1 !== c2) {
			c1 = c1.toUpperCase(); c2 = c2.toUpperCase();
			if (c1 !== c2) {
				c1 = c1.toLowerCase(); c2 = c2.toLowerCase();
				if (c1 !== c2) return c1.charCodeAt(0) - c2.charCodeAt(0);
			}
		}
	}
	return a.length - b.length;
}

// ---- 集まり ----

/** list.remove(Object)（最初の 1 つを消す。消したら true） */
export function jRemove<T>(list: T[], o: T): boolean {
	const i = list.indexOf(o);
	if (i < 0) return false;
	list.splice(i, 1);
	return true;
}

// ---- 文字 ----

export const JChar = {
	isDigit: (c: string) => /\p{Nd}/u.test(c),
	isLetter: (c: string) => /\p{L}/u.test(c),
	isLetterOrDigit: (c: string) => /[\p{L}\p{Nd}]/u.test(c),
	isWhitespace: (c: string) => /[\s\u001c-\u001f]/.test(c) && c !== " " && c !== " " && c !== " ",
	isUpperCase: (c: string) => /\p{Lu}/u.test(c),
	isLowerCase: (c: string) => /\p{Ll}/u.test(c),
	toUpperCase: (c: string) => c.toUpperCase(),
	toLowerCase: (c: string) => c.toLowerCase(),
};

// ---- 数学 ----

export const JMath = {
	signum: (x: number) => (x > 0 ? 1.0 : x < 0 ? -1.0 : x),
	toRadians: (deg: number) => deg / 180.0 * Math.PI,
	toDegrees: (rad: number) => rad * 180.0 / Math.PI,
	floorDiv: (a: number, b: number) => Math.floor(a / b),
	floorMod: (a: number, b: number) => a - Math.floor(a / b) * b,
	ulp: (x: number) => {
		const ax = Math.abs(x);
		if (!Number.isFinite(ax)) return ax;
		if (ax === Number.MAX_VALUE) return Math.pow(2, 971);
		const next = nextUp(ax);
		return next - ax;
	},
	nextUp: (x: number) => nextUp(x),
	hypot: (a: number, b: number) => Math.hypot(a, b),
	/** Java の Math.rint（.5 は偶数へ） */
	rint: (x: number) => {
		const r = Math.round(x);
		return (r - x === 0.5 && r % 2 !== 0) ? r - 1 : r;
	},
	/** int/long の割り算（Java の / と同じく 0 の方向へ切り捨て）。0 で割ると例外 */
	idiv: (a: number, b: number) => {
		if (b === 0) throw new ArithmeticException("/ by zero");
		return Math.trunc(a / b);
	},
};

function nextUp(x: number): number {
	if (Number.isNaN(x) || x === Infinity) return x;
	if (x === 0) return Number.MIN_VALUE;
	const buf = new DataView(new ArrayBuffer(8));
	buf.setFloat64(0, x);
	let bits = buf.getBigInt64(0);
	bits += x > 0 ? 1n : -1n;
	buf.setBigInt64(0, bits);
	return buf.getFloat64(0);
}

/** Java の Integer の箱（文字列にすると "1"。出力を文字列にする所で、中身が整数の集まりに使う） */
export class JInteger {
	constructor(readonly value: number) {}
	toString(): string { return String(this.value); }
	valueOf(): number { return this.value; }
}

/** Java の Objects.equals */
export function jEquals(a: unknown, b: unknown): boolean {
	if (a === b) return true;
	if (a == null || b == null) return false;
	const eq = (a as { equals?: (o: unknown) => boolean }).equals;
	return typeof eq === "function" ? eq.call(a, b) : false;
}

/** Java の (int) x（double から int へ。NaN は 0、範囲の外は端に丸める。0 の方向へ切り捨て） */
export function jint(x: number): number {
	if (Number.isNaN(x)) return 0;
	if (x >= Integer.MAX_VALUE) return Integer.MAX_VALUE;
	if (x <= Integer.MIN_VALUE) return Integer.MIN_VALUE;
	return Math.trunc(x);
}

/** Java の (long) x（NaN は 0、範囲の外は端に丸める。ここでの long の端は 2^53-1） */
export function jlong(x: number): number {
	if (Number.isNaN(x)) return 0;
	if (x >= Long.MAX_VALUE) return Long.MAX_VALUE;
	if (x <= Long.MIN_VALUE) return Long.MIN_VALUE;
	return Math.trunc(x);
}

/** Java の ArrayList.toString（"[a, b]"。要素は toString で。double は呼ぶ側で jstr にしておく） */
export function jlistStr(list: readonly unknown[]): string {
	return "[" + list.map(v => (v === null || v === undefined ? "null" : String(v))).join(", ") + "]";
}
