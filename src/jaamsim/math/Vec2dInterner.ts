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
 * TypeScript への移植 (C) 2026 shota
 */
import type { Vec2d } from "./Vec2d.ts";

/*
 * 入れ子のクラス VecWrapper は、このファイルの中だけの class にした。
 * Java の HashMap は「hashCode が同じ」かつ「equals が true」で同じ鍵とみなすので、
 * hashCode（Java と同じ計算）ごとに並べ、その中を equals で探す（Java と同じ振る舞い）。
 */

const hashBuf = new DataView(new ArrayBuffer(8));
/** Java の Double.valueOf(x).hashCode() */
function doubleHashCode(x: number): number {
	if (Number.isNaN(x)) {  // doubleToLongBits は NaN を 0x7ff8000000000000 にそろえる
		hashBuf.setUint32(0, 0x7ff80000);
		hashBuf.setUint32(4, 0);
	}
	else {
		hashBuf.setFloat64(0, x);
	}
	return hashBuf.getInt32(0) ^ hashBuf.getInt32(4);
}

class VecWrapper {
	val: Vec2d;
	index = 0;
	constructor(v: Vec2d) {
		this.val = v;
	}

	equals(o: VecWrapper): boolean {
		const vw = o;
		return this.val.equals2(vw.val);
	}

	hashCode(): number {
		let hash = 0;
		hash ^= doubleHashCode(this.val.x);
		hash ^= Math.imul(doubleHashCode(this.val.y), 3);
		return hash;
	}
}

/**
 * Vec2dInterner is a container type used to 'intern' Vec2d instances hopefully saving space on repeating entries
 */
export class Vec2dInterner {

	private nextIndex = 0;
	private orderedValues: Vec2d[] = [];

	private map = new Map<number, VecWrapper[]>();

	private mapGet(key: VecWrapper): VecWrapper | null {
		const bucket = this.map.get(key.hashCode());
		if (bucket === undefined)
			return null;
		for (const e of bucket)
			if (e.equals(key))
				return e;
		return null;
	}

	private mapPut(key: VecWrapper): void {
		const h = key.hashCode();
		let bucket = this.map.get(h);
		if (bucket === undefined) {
			bucket = [];
			this.map.set(h, bucket);
		}
		bucket.push(key);
	}

	/**
	 * intern will return a pointer to a Vec2d (which may differ from input 'v') that is mathematically equal but
	 * may be a shared object. Any value returned by intern should be defensively copied before being modified
	 */
	intern(v: Vec2d): Vec2d {
		const wrapped = new VecWrapper(v);
		const interned = this.mapGet(wrapped);
		if (interned !== null) {
			return interned.val;
		}

		// This wrapped value will be stored
		wrapped.index = this.nextIndex++;
		this.orderedValues.push(v);
		this.mapPut(wrapped);
		return v;
	}

	getValueForIndex(i: number): Vec2d {
		return this.orderedValues[i];
	}

	getIndexForValue(v: Vec2d): number {
		const wrapped = new VecWrapper(v);
		return this.mapGet(wrapped)!.index;
	}

	getMaxIndex(): number {
		return this.orderedValues.length;
	}

}
