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

import { jformat, jstr } from "../java/lang.ts";
import type { JavaHashOrder } from "../ProcessFlow/MappedTreeSet.ts";
import type { JSONValue } from "./JSONValue.ts";

export class JSONWriter {

	static writeJSONValue(val: JSONValue): string {
		const out: string[] = [];
		JSONWriter.writeVal(val, out);
		return out.join("");
	}

	private static getEscapeSeq(c: string): string {
		switch (c) {
		case "\n": return "\\n";
		case "\r": return "\\r";
		case "\t": return "\\t";
		case "\b": return "\\b";
		case "\f": return "\\f";
		case "\"": return "\\\"";
		case "\\": return "\\\\";
		}
		if (c.charCodeAt(0) < 0x1f) {
			// This char is a control code without a short form, use the
			// explicit unicode codepoint format
			return jformat("\\u%04x", c.charCodeAt(0));
		}
		// Java の assert(false)（普段は無効）
		return "";
	}

	private static mustEscapeChar(c: string): boolean {
		const code = c.charCodeAt(0);
		if (code <= 0x1f) return true;
		if (c === "\\") return true;
		if (c === "\"") return true;
		return false;
	}

	private static escapeString(s: string): string {

		let out = "";
		let pos = 0;
		while (pos < s.length) {
			const c = s.charAt(pos++);
			if (JSONWriter.mustEscapeChar(c)) {
				out += JSONWriter.getEscapeSeq(c);
			} else {
				out += c;
			}
		}

		return out;
	}

	private static writeVal(val: JSONValue, out: string[]): void {
		if (val.isNumber()) {
			out.push(jstr(val.numVal));
			return;
		}
		if (val.isKeyword()) {
			if (val.isTrue()) out.push("true");
			if (val.isFalse()) out.push("false");
			if (val.isNull()) out.push("null");
			return;
		}
		if (val.isString()) {
			out.push("\"");
			out.push(JSONWriter.escapeString(val.stringVal));
			out.push("\"");
			return;
		}

		if (val.isList()) {
			JSONWriter.writeList(val.listVal, out);
			return;
		}

		if (val.isMap()) {
			JSONWriter.writeMap(val.mapVal, out);
			return;
		}

		// Java の assert(false)（普段は無効）
	}

	private static writeList(list: JSONValue[], out: string[]): void {
		out.push("[");
		for (let i = 0; i < list.length; i++) {
			const val = list[i];
			JSONWriter.writeVal(val, out);
			if (i + 1 < list.length) {
				out.push(", ");
			}
		}
		out.push("]");
	}
	private static writeMap(map: JavaHashOrder<JSONValue>, out: string[]): void {
		// Java の HashMap の順番（JavaHashOrder.entries）
		const entries = map.entries();
		out.push("{");
		for (let i = 0; i < entries.length; i++) {
			const entry = entries[i];
			out.push("\"");
			out.push(JSONWriter.escapeString(entry[0]));
			out.push("\": ");
			JSONWriter.writeVal(entry[1], out);

			if (i + 1 < entries.length) {
				out.push(", ");
			}
		}
		out.push("}");
	}
}
