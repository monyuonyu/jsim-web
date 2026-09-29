/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2002-2011 Ausenco Engineering Canada Inc.
 * Copyright (C) 2016-2025 JaamSim Software Inc.
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
import { jformat } from "../internal.ts";
import { tr } from "../internal.ts";
import { ExpError } from "../internal.ts";
import type { Entity } from "./Entity.ts";

/**
 * Custom exception thrown when a program error is encountered.
 *
 * Java の多重定義のコンストラクタは、1 つのコンストラクタで引数を見て分ける:
 *   (src: string, pos: number, name: string, key: string, ind: number, msg: string, cause)  … 7 個で 2 番目と 5 番目が数
 *   (format: string, ...args)            … 書式（中で tr してから jformat）
 *   (ent, msg: string)
 *   (e: ExpError) / (ent, e: ExpError) / (ent, key, e: ExpError) / (ent, key, i, e: ExpError)
 *   (ent, cause) / (ent, key, cause) / (ent, key, i, cause) / (cause)
 * Entity かどうかは getName を持つ Error でない物かで見る（Entity.ts を実行時に読み込まないため）。
 */
export class ErrorException extends Error {

	public entName: string;
	public keyword: string;
	public index: number;  // index (1, 2, etc.) for list type inputs
	public source: string | null;
	public position: number;
	public override cause: unknown;

	constructor(...args: unknown[]) {
		const p = ErrorException.parseArgs(args);
		super(p.msg ?? "null");
		this.entName = p.name;
		this.keyword = p.key;
		this.index = p.ind;
		this.source = p.src;
		this.position = p.pos;
		this.cause = p.cause;
	}

	private static isEntity(o: unknown): o is Entity {
		return typeof o === "object" && o !== null && !(o instanceof Error)
				&& typeof (o as { getName?: unknown }).getName === "function";
	}

	private static parseArgs(a: unknown[]): { src: string | null; pos: number; name: string; key: string; ind: number; msg: string | null; cause: unknown } {
		// (String src, int pos, String name, String key, int ind, String msg, Throwable cause)
		if (a.length === 7 && typeof a[0] === "string" && typeof a[1] === "number"
				&& typeof a[2] === "string" && typeof a[3] === "string" && typeof a[4] === "number") {
			return { src: a[0], pos: a[1], name: a[2], key: a[3], ind: a[4], msg: a[5] as string | null, cause: a[6] ?? null };
		}

		// (String format, Object... args)
		if (typeof a[0] === "string") {
			return { src: "", pos: -1, name: "", key: "", ind: -1, msg: jformat(tr(a[0]), ...a.slice(1)), cause: null };
		}

		// (ExpError e)
		if (a[0] instanceof ExpError) {
			const e = a[0];
			return { src: e.source, pos: e.pos, name: "", key: "", ind: -1, msg: e.getMessage(), cause: e };
		}

		if (ErrorException.isEntity(a[0])) {
			const ent = a[0];
			// (Entity ent, String msg)
			if (a.length === 2 && typeof a[1] === "string")
				return { src: "", pos: -1, name: ent.getName(), key: "", ind: -1, msg: a[1], cause: null };

			let key = "";
			let ind = -1;
			let cause: unknown;
			if (a.length === 2) {
				cause = a[1];
			}
			else if (a.length === 3) {
				key = a[1] as string;
				cause = a[2];
			}
			else {
				key = a[1] as string;
				ind = a[2] as number;
				cause = a[3];
			}
			if (cause instanceof ExpError)
				return { src: cause.source, pos: cause.pos, name: ent.getName(), key, ind, msg: cause.getMessage(), cause };
			return { src: "", pos: -1, name: ent.getName(), key, ind, msg: ErrorException.messageOf(cause), cause };
		}

		// (Throwable cause)
		return { src: "", pos: -1, name: "", key: "", ind: -1, msg: ErrorException.messageOf(a[0]), cause: a[0] };
	}

	/** Throwable.getMessage() の代わり */
	static messageOf(t: unknown): string | null {
		if (t === null || t === undefined)
			return null;
		if (t instanceof Error) {
			const gm = (t as { getMessage?: () => string | null }).getMessage;
			if (typeof gm === "function")
				return gm.call(t);
			return t.message;
		}
		return String(t);
	}

	getMessage(): string {
		return this.message;
	}

	getCause(): unknown {
		return this.cause;
	}

	getLocalizedMessage(): string {
		let sb = "";
		if (this.entName != null && this.entName.length > 0)
			sb += this.entName;
		if (this.keyword.length > 0)
			sb += jformat(tr(" keyword '%s'"), this.keyword);
		if (this.index > 0)
			sb += jformat(tr(", index (%d)"), this.index);
		if (sb.length > 0)
			sb += ":\n";
		sb += this.getMessage();
		return sb;
	}

	override toString(): string {
		return "com.jaamsim.basicsim.ErrorException: " + this.getLocalizedMessage();
	}

}
