/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2013 Ausenco Engineering Canada Inc.
 * Copyright (C) 2026 JaamSim Software Inc.
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
// 注（移植）: 入れ子の private class Key と KeySorter は、ファイルの中だけのクラス・関数にした。
// getValAtTime(time) と getValAtTime(time, arg) は、arg を省略できる 1 つの関数にした（省略なら 0）。
import { Double } from "../java/lang.ts";

class Key<T> {
	time = 0;
	val: T | null = null;
}

/** Java の KeySorter */
function keySorterCompare<T>(arg0: Key<T>, arg1: Key<T>): number {
	return Double.compare(arg0.time, arg1.time);
}

export abstract class KeyedCurve<T> {

	private keys: Key<T>[];
	private isSorted: boolean;

	constructor() {
		this.keys = [];
		this.isSorted = true;
	}

	addKey(time: number, val: T): void {
		const k = new Key<T>();
		k.time = time;
		k.val = val;
		this.keys.push(k);
		this.isSorted = false;
	}

	getValAtTime(time: number, arg = 0): T | null {
		if (!this.isSorted) {
			this.sortKeys();
		}

		// Treat NaN as negative infinity, as it will at least return a valid number
		if (Double.isNaN(time)) {
			time = Double.NEGATIVE_INFINITY;
		}
		if (this.keys.length === 0) {
			 return null;
		}
		if (this.keys.length === 1) {
			return this.keys[0].val;
		}
		// Are we ahead of the beginning?
		if (time <= this.keys[0].time) {
			return this.keys[0].val;
		}
		// Are we past the end?
		if (time >= this.keys[this.keys.length-1].time) {
			return this.keys[this.keys.length-1].val;
		}

		// Use a binary search to find the segment we want
		let start = 0;
		let end = this.keys.length - 1;
		while (end - start > 1) {
			const pivot = Math.trunc((end + start)/2);
			const pivotTime = this.keys[pivot].time;
			if (pivotTime === time) {
				return this.keys[pivot].val;
			}
			if (pivotTime > time) {
				end = pivot;
			} else {
				start = pivot;
			}
		}

		const startTime = this.keys[start].time;
		const endTime = this.keys[end].time;
		const ratio = (time - startTime) / (endTime - startTime);

		return this.interpVal(this.keys[start].val as T, this.keys[end].val as T, ratio, arg);
	}

	hasKeys(): boolean {
		return this.keys.length !== 0;
	}

	protected abstract interpVal(val0: T, val1: T, ratio: number, arg: number): T;

	private sortKeys(): void {
		this.keys.sort(keySorterCompare);
		this.isSorted = true;
	}
}
