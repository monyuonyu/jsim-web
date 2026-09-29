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
 * TypeScript への移植 (C) 2026 shota
 */
import { jstr } from "../internal.ts";
import type { Color4d } from "../math/Color4d.ts";

export class Tag {
	readonly colors: Color4d[] | null;
	readonly sizes: number[] | null;
	readonly visible: boolean;

	constructor(c: Color4d[] | null, s: number[] | null, v: boolean) {
		this.colors = c;
		this.sizes = s;
		this.visible = v;
	}

	colorsMatch(c: Color4d[]): boolean {
		if (this.colors === null || this.colors.length !== c.length) return false;

		for (let i = 0; i < this.colors.length; i++) {
			if (!this.colors[i].equals(c[i])) return false;
		}
		return true;
	}

	sizesMatch(s: number[]): boolean {
		if (this.sizes === null || this.sizes.length !== s.length) return false;

		for (let i = 0; i < this.sizes.length; i++) {
			if (this.sizes[i] !== s[i]) return false;
		}
		return true;
	}

	visMatch(v: boolean): boolean {
		return v === this.visible;
	}

	toString(): string {
		// Arrays.toString の形（null は "null"、要素は ", " でつなぐ）
		const sizesStr = this.sizes === null ? "null" : "[" + this.sizes.map(x => jstr(x)).join(", ") + "]";
		const colorsStr = this.colors === null ? "null" : "[" + this.colors.map(c => String(c)).join(", ") + "]";
		return "(" + sizesStr + ", " + colorsStr + ", " + String(this.visible) + ")";
	}

}
