/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2012 Ausenco Engineering Canada Inc.
 * Copyright (C) 2018-2020 JaamSim Software Inc.
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
import { ColourInput } from "../input/ColourInput.ts";

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

/**
 * A data structure to hold RGBA color information.
 *
 * 移植の注意: Java には double の (r, g, b[, a]) と int の (r, g, b[, a]) の 2 組のコンストラクタがあり、
 * int の方は 255 で割る。TS では見分けられないので、コンストラクタは double の方だけにし、
 * int の方は Color4d.fromInts(r, g, b[, a]) にした（docs/renamed.md）。
 * Java で整数だけを渡している所（new Color4d(255, 0, 0) や new Color4d(1, 1, 1, 1) など）は fromInts を使うこと。
 */
export class Color4d {

r: number;
g: number;
b: number;
a: number;

constructor();
constructor(col: Color4d);
constructor(r: number, g: number, b: number, a?: number);
constructor(r?: number | Color4d, g?: number, b?: number, a: number = 1.0) {
	if (r === undefined) {
		// this(0.0d, 0.0d, 0.0d, 1.0d)
		this.r = 0.0; this.g = 0.0; this.b = 0.0; this.a = 1.0;
		return;
	}
	if (r instanceof Color4d) {
		const col = r;
		this.r = col.r; this.g = col.g; this.b = col.b; this.a = col.a;
		return;
	}
	this.r = r; this.g = g!; this.b = b!; this.a = a;
}

/** Java の Color4d(int r, int g, int b) と Color4d(int r, int g, int b, int a) */
static fromInts(r: number, g: number, b: number, a: number = 255): Color4d {
	return new Color4d(r/255.0, g/255.0, b/255.0, a/255.0);
}

toFloats(): number[] {
	const ret: number[] = new Array<number>(4).fill(0);
	ret[0] = Math.fround(this.r); ret[1] = Math.fround(this.g); ret[2] = Math.fround(this.b); ret[3] = Math.fround(this.a);
	return ret;
}

/**
 * Tests the first four components are exactly equal.
 *
 * This returns true if the r,g,b,a components compare as equal using the ==
 * operator.  Note that NaN will always return false, and -0.0 and 0.0
 * will compare as equal.
 */
equals4(c: Color4d): boolean {
	return this.r === c.r && this.g === c.g && this.b === c.b && this.a === c.a;
}

/**
 * Checks if all vector components are within EPSILON of each other
 * @param o - the other vector
 */
equals(o: unknown): boolean
{
	if (!(o instanceof Color4d))
		return false;

	const c = o;

	return this.r === c.r && this.g === c.g && this.b === c.b && this.a === c.a;
}

hashCode(): number {
	return (doubleHashCode(this.r) +
	       Math.imul(doubleHashCode(this.g), 7) +
	       Math.imul(doubleHashCode(this.b), 79) +
	       Math.imul(doubleHashCode(this.a), 1239)) | 0;
}

toString(): string {
	return ColourInput.toString(this);
}

}
