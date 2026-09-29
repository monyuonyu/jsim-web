/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2014 Ausenco Engineering Canada Inc.
 * Copyright (C) 2020-2021 JaamSim Software Inc.
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
// 注: Java の java.net.URI の代わり（URI・URISyntaxException）も、このファイルに置く（ParseContext が URI を持つため）。
// TODO(移植): URI は、入力の仕組みで使う所（解決・正規化・相対化・%XX の符号化）だけを写したもの。共通の場所へ移すかは、まとめ役が決める。

/** Java の java.net.URISyntaxException */
export class URISyntaxException extends Error {
	constructor(input: string, reason: string, index = -1) {
		super(`${reason}${index > -1 ? " at index " + index : ""}: ${input}`);
	}
	getMessage(): string {
		return this.message;
	}
}

// 符号化しなくてよい文字（RFC 2396 の unreserved・punct と / @、それと非 ASCII の文字）
const LEGAL_PATH = /[A-Za-z0-9_\-!.~'()*,;:$&+=/@]/;

function quote(s: string, allowQuery: boolean): string {
	let ret = "";
	for (const ch of s) {
		const code = ch.codePointAt(0)!;
		if (LEGAL_PATH.test(ch) || (allowQuery && ch === "?")) {
			ret += ch;
			continue;
		}
		// 非 ASCII で、空白や制御文字でないもの（Java の "other"）は、そのまま
		if (code > 0x7f && !/[\s\p{Cc}]/u.test(ch)) {
			ret += ch;
			continue;
		}
		for (const b of new TextEncoder().encode(ch))
			ret += "%" + b.toString(16).toUpperCase().padStart(2, "0");
	}
	return ret;
}

function decode(s: string | null): string | null {
	if (s === null)
		return null;
	if (!s.includes("%"))
		return s;
	try {
		return decodeURIComponent(s);
	}
	catch {
		return s;
	}
}

/** RFC 2396 の 5.2 の手順 6（"." と ".." の段を除く） */
function normalizePath(path: string): string {
	if (path === "")
		return path;
	const abs = path.startsWith("/");
	const segs = (abs ? path.substring(1) : path).split("/");
	const out: string[] = [];
	for (let i = 0; i < segs.length; i++) {
		const s = segs[i];
		const last = i === segs.length - 1;
		if (s === ".") {
			if (last)
				out.push("");
			continue;
		}
		if (s === "..") {
			if (out.length > 0 && out[out.length - 1] !== "..") {
				out.pop();
				if (last)
					out.push("");
				continue;
			}
			// 戻れないときは ".." を残す（Java と同じ）
			out.push("..");
			continue;
		}
		if (s === "" && !last && i > 0)
			continue;  // "//" は 1 つにまとめる
		out.push(s);
	}
	let ret = (abs ? "/" : "") + out.join("/");
	// 相対の道の最初の段に ":" があるなら "./" を付ける（Java と同じ）
	if (!abs && out.length > 0 && out[0].includes(":"))
		ret = "./" + ret;
	return ret;
}

/**
 * Java の java.net.URI（入力の仕組みで使う所だけ）。
 * 文字列は符号化した形（toString）で持ち、getPath などは復号した形を返す。
 */
export class URI {
	private readonly scheme: string | null;
	private readonly ssp: string;           // 符号化した scheme-specific part
	private readonly authority: string | null;
	private readonly path: string | null;   // 符号化した道（opaque なら null）
	private readonly query: string | null;
	private readonly fragment: string | null;
	private readonly str: string;

	/**
	 * new URI(str)（1 つ）と new URI(scheme, ssp, fragment)（3 つ）の両方。
	 * 3 つの形では、URI に使えない文字を %XX に符号化する。
	 */
	constructor(str: string);
	constructor(scheme: string | null, ssp: string, fragment: string | null);
	constructor(a: string | null, b?: string, c?: string | null) {
		let s: string;
		if (b === undefined) {
			s = a as string;
			const bad = /[\s"<>\\^`{|}]/.exec(s.replace(/%[0-9A-Fa-f]{2}/g, "xxx"));
			if (bad !== null)
				throw new URISyntaxException(s, "Illegal character in path", bad.index);
			if (/%(?![0-9A-Fa-f]{2})/.test(s))
				throw new URISyntaxException(s, "Malformed escape pair", s.search(/%(?![0-9A-Fa-f]{2})/));
		}
		else {
			s = "";
			if (a !== null)
				s += a + ":";
			s += quote(b, true);
			if (c !== null && c !== undefined)
				s += "#" + quote(c, true);
		}
		this.str = s;

		// 分ける
		let rest = s;
		let frag: string | null = null;
		const hash = rest.indexOf("#");
		if (hash >= 0) {
			frag = rest.substring(hash + 1);
			rest = rest.substring(0, hash);
		}
		let sch: string | null = null;
		const m = /^([A-Za-z][A-Za-z0-9+.-]*):/.exec(rest);
		if (m !== null) {
			sch = m[1];
			rest = rest.substring(m[0].length);
		}
		this.scheme = sch;
		this.fragment = frag;
		this.ssp = rest;
		if (sch !== null && !rest.startsWith("/")) {
			// opaque
			this.authority = null;
			this.path = null;
			this.query = null;
			return;
		}
		let q: string | null = null;
		const qi = rest.indexOf("?");
		if (qi >= 0) {
			q = rest.substring(qi + 1);
			rest = rest.substring(0, qi);
		}
		let auth: string | null = null;
		if (rest.startsWith("//")) {
			const end = rest.indexOf("/", 2);
			auth = end < 0 ? rest.substring(2) : rest.substring(2, end);
			rest = end < 0 ? "" : rest.substring(end);
			if (auth === "")
				auth = null;
		}
		this.authority = auth;
		this.path = rest;
		this.query = q;
	}

	/** 部品から作る（符号化した形のまま） */
	private static build(scheme: string | null, authority: string | null, path: string | null, query: string | null, fragment: string | null): URI {
		let s = "";
		if (scheme !== null)
			s += scheme + ":";
		if (authority !== null)
			s += "//" + authority;
		if (path !== null)
			s += path;
		if (query !== null)
			s += "?" + query;
		if (fragment !== null)
			s += "#" + fragment;
		return new URI(s);
	}

	getScheme(): string | null {
		return this.scheme;
	}

	isOpaque(): boolean {
		return this.path === null;
	}

	isAbsolute(): boolean {
		return this.scheme !== null;
	}

	/** 復号した道（opaque なら null） */
	getPath(): string | null {
		return decode(this.path);
	}

	getRawPath(): string | null {
		return this.path;
	}

	getSchemeSpecificPart(): string {
		return decode(this.ssp) as string;
	}

	getRawSchemeSpecificPart(): string {
		return this.ssp;
	}

	getAuthority(): string | null {
		return decode(this.authority);
	}

	getQuery(): string | null {
		return decode(this.query);
	}

	getFragment(): string | null {
		return decode(this.fragment);
	}

	normalize(): URI {
		if (this.isOpaque() || this.path === null || this.path === "")
			return this;
		const np = normalizePath(this.path);
		if (np === this.path)
			return this;
		return URI.build(this.scheme, this.authority, np, this.query, this.fragment);
	}

	/** RFC 2396 の 5.2 による解決（Java の URI.resolve と同じ） */
	resolve(child: URI): URI {
		if (child.isOpaque() || this.isOpaque())
			return child;

		// 5.2 (2): 断片だけの参照
		if (child.scheme === null && child.authority === null && child.path === ""
				&& child.fragment !== null && child.query === null) {
			if (this.fragment !== null && child.fragment === this.fragment)
				return this;
			return URI.build(this.scheme, this.authority, this.path, this.query, child.fragment);
		}

		// 5.2 (3): 子が絶対
		if (child.scheme !== null)
			return child;

		// 5.2 (4): 子に authority がある
		if (child.authority !== null)
			return URI.build(this.scheme, child.authority, child.path, child.query, child.fragment);

		const cp = child.path ?? "";
		let path: string;
		if (cp.length > 0 && cp.charAt(0) === "/") {
			// 5.2 (5): 子の道が絶対
			path = cp;
		}
		else {
			// 5.2 (6): 道をつなげて正規化する
			const bp = this.path ?? "";
			const i = bp.lastIndexOf("/");
			path = normalizePath((i >= 0 ? bp.substring(0, i + 1) : "") + cp);
		}
		return URI.build(this.scheme, this.authority, path, child.query, child.fragment);
	}

	/** Java の URI.relativize */
	relativize(child: URI): URI {
		if (child.isOpaque() || this.isOpaque())
			return child;
		if (!jEqIgnoreCaseNullable(this.scheme, child.scheme) || this.authority !== child.authority)
			return child;
		let bp = normalizePath(this.path ?? "");
		const cp = normalizePath(child.path ?? "");
		if (bp !== cp) {
			if (!bp.endsWith("/"))
				bp = bp + "/";
			if (!cp.startsWith(bp))
				return child;
		}
		return URI.build(null, null, cp.substring(bp.length), child.query, child.fragment);
	}

	equals(o: unknown): boolean {
		if (this === o)
			return true;
		if (!(o instanceof URI))
			return false;
		return this.str === o.str;
	}

	toString(): string {
		return this.str;
	}
}

function jEqIgnoreCaseNullable(a: string | null, b: string | null): boolean {
	if (a === null || b === null)
		return a === b;
	return a.toLowerCase() === b.toLowerCase();
}

export class ParseContext {
	readonly context: URI;
	readonly jail: string | null;  // null は制限なし

	constructor(ctxt: URI, jail: string | null) {
		this.context = ctxt;
		this.jail = jail;
	}

	equals(obj: unknown): boolean {
		if (this === obj) {
			return true;
		}
		if (!(obj instanceof ParseContext))
			return false;

		const pc = obj;
		// Java は context・jail が null のとき NullPointerException になる
		return this.context.equals(pc.context) && this.jail === pc.jail;
	}

}
