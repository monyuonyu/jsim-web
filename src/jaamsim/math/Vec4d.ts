/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2012 Ausenco Engineering Canada Inc.
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
import { jstr } from "../java/lang.ts";
import type { Mat4d } from "./Mat4d.ts";
import { isMat4d, Vec2d, vecNear } from "./Vec2d.ts";
import { Vec3d } from "./Vec3d.ts";

export class Vec4d extends Vec3d {

w: number;

/**
 * Construct a Vec4d initialized to (0,0,0,0);
 * Construct a Vec4d initialized to (v.x, v.y, v.z, v.w);
 * Construct a Vec4d initialized to (v.x, v.y, v.z, w);
 * Construct a Vec4d initialized to (x, y, z, w);
 */
constructor();
constructor(v: Vec4d);
constructor(v: Vec3d, w: number);
constructor(x: number, y: number, z: number, w: number);
constructor(a?: Vec4d | Vec3d | number, b?: number, c?: number, d?: number) {
	super();
	if (a === undefined) {
		this.x = 0.0;
		this.y = 0.0;
		this.z = 0.0;
		this.w = 0.0;
	}
	else if (typeof a === "number") {
		this.x = a;
		this.y = b!;
		this.z = c!;
		this.w = d!;
	}
	else if (b === undefined) {
		const v = a as Vec4d;
		this.x = v.x;
		this.y = v.y;
		this.z = v.z;
		this.w = v.w;
	}
	else {
		this.x = a.x;
		this.y = a.y;
		this.z = a.z;
		this.w = b;
	}
}

override toString(): string {
	let tmp = "(";
	tmp += jstr(this.x);
	tmp += ", " + jstr(this.y);
	tmp += ", " + jstr(this.z);
	tmp += ", " + jstr(this.w);
	tmp += ")";
	return tmp;
}

/**
 * Tests the first four components are exactly equal.
 *
 * This returns true if the x,y,z,w components compare as equal using the ==
 * operator.  Note that NaN will always return false, and -0.0 and 0.0
 * will compare as equal.
 */
equals4(v: Vec4d): boolean {
	return this.x === v.x && this.y === v.y && this.z === v.z && this.w === v.w;
}

near4(v: Vec4d): boolean {
	return vecNear(this.x, v.x) &&
	       vecNear(this.y, v.y) &&
	       vecNear(this.z, v.z) &&
	       vecNear(this.w, v.w);
}

/**
 * Set this Vec4d with the values (v.x, v.y, v.z, v.w);
 * Set this Vec4d with the values (x, y, z, w);
 */
set4(v: Vec4d): void;
set4(x: number, y: number, z: number, w: number): void;
set4(a: Vec4d | number, b?: number, c?: number, d?: number): void {
	if (typeof a === "number") {
		this.x = a;
		this.y = b!;
		this.z = c!;
		this.w = d!;
		return;
	}
	this.x = a.x;
	this.y = a.y;
	this.z = a.z;
	this.w = a.w;
}

/**
 * Add v to this Vec4d: this = this + v
 * Add v1 to v2 into this Vec4d: this = v1 + v2
 */
add4(v: Vec4d): void;
add4(v1: Vec4d, v2: Vec4d): void;
add4(v1: Vec4d, v2?: Vec4d): void {
	if (v2 === undefined) {
		this.x = this.x + v1.x;
		this.y = this.y + v1.y;
		this.z = this.z + v1.z;
		this.w = this.w + v1.w;
		return;
	}
	this.x = v1.x + v2.x;
	this.y = v1.y + v2.y;
	this.z = v1.z + v2.z;
	this.w = v1.w + v2.w;
}

/**
 * Subtract v from this Vec4d: this = this - v
 * Subtract v2 from v1 into this Vec4d: this = v1 - v2
 */
sub4(v: Vec4d): void;
sub4(v1: Vec4d, v2: Vec4d): void;
sub4(v1: Vec4d, v2?: Vec4d): void {
	if (v2 === undefined) {
		this.x = this.x - v1.x;
		this.y = this.y - v1.y;
		this.z = this.z - v1.z;
		this.w = this.w - v1.w;
		return;
	}
	this.x = v1.x - v2.x;
	this.y = v1.y - v2.y;
	this.z = v1.z - v2.z;
	this.w = v1.w - v2.w;
}

/**
 * Multiply the elements of this Vec4d by v: this = this * v
 * Multiply the elements of v1 and v2 into this Vec4d: this = v1 * v2
 */
mul4(v: Vec4d): void;
mul4(v1: Vec4d, v2: Vec4d): void;
mul4(v1: Vec4d, v2?: Vec4d): void {
	if (v2 === undefined) {
		this.x = this.x * v1.x;
		this.y = this.y * v1.y;
		this.z = this.z * v1.z;
		this.w = this.w * v1.w;
		return;
	}
	this.x = v1.x * v2.x;
	this.y = v1.y * v2.y;
	this.z = v1.z * v2.z;
	this.w = v1.w * v2.w;
}

/**
 * Set this Vec4d to the minimum of this and v: this = min(this, v)
 * Set this Vec4d to the minimum of v1 and v2: this = min(v1, v2)
 */
min4(v: Vec4d): void;
min4(v1: Vec4d, v2: Vec4d): void;
min4(v1: Vec4d, v2?: Vec4d): void {
	if (v2 === undefined) {
		this.x = Math.min(this.x, v1.x);
		this.y = Math.min(this.y, v1.y);
		this.z = Math.min(this.z, v1.z);
		this.w = Math.min(this.w, v1.w);
		return;
	}
	this.x = Math.min(v1.x, v2.x);
	this.y = Math.min(v1.y, v2.y);
	this.z = Math.min(v1.z, v2.z);
	this.w = Math.min(v1.w, v2.w);
}

/**
 * Set this Vec4d to the maximum of this and v: this = max(this, v)
 * Set this Vec4d to the maximum of v1 and v2: this = max(v1, v2)
 */
max4(v: Vec4d): void;
max4(v1: Vec4d, v2: Vec4d): void;
max4(v1: Vec4d, v2?: Vec4d): void {
	if (v2 === undefined) {
		this.x = Math.max(this.x, v1.x);
		this.y = Math.max(this.y, v1.y);
		this.z = Math.max(this.z, v1.z);
		this.w = Math.max(this.w, v1.w);
		return;
	}
	this.x = Math.max(v1.x, v2.x);
	this.y = Math.max(v1.y, v2.y);
	this.z = Math.max(v1.z, v2.z);
	this.w = Math.max(v1.w, v2.w);
}

/**
 * Return the 4-component dot product of v1 and v2
 * Internal helper to help with dot, mag and magSquared
 */
private _dot4(v1: Vec4d, v2: Vec4d): number {
	let ret: number;
	ret  = v1.x * v2.x;
	ret += v1.y * v2.y;
	ret += v1.z * v2.z;
	ret += v1.w * v2.w;
	return ret;
}

/**
 * Return the 4-component dot product of this Vec4d with v
 */
dot4(v: Vec4d): number {
	return this._dot4(this, v);
}

/**
 * Return the 4-component magnitude of this Vec4d
 */
mag4(): number {
	return Math.sqrt(this._dot4(this, this));
}

/**
 * Return the 4-component magnitude squared of this Vec4d
 */
magSquare4(): number {
	return this._dot4(this, this);
}

private _norm4(v: Vec4d): void {
	let mag = this._dot4(v, v);
	if (Vec2d.nonNormalMag(mag)) {
		this.x = 0.0;
		this.y = 0.0;
		this.z = 0.0;
		this.w = 1.0;
		return;
	}

	mag = Math.sqrt(mag);
	this.x = v.x / mag;
	this.y = v.y / mag;
	this.z = v.z / mag;
	this.w = v.w / mag;
}

/**
 * Normalize the first four components in-place
 * Set the first four components to the normalized values of v
 *
 * If the Vec has a zero magnitude or contains NaN or Inf, this sets
 * all components but the last to zero, the last component is set to one.
 */
normalize4(v?: Vec4d): void {
	this._norm4(v === undefined ? this : v);
}

/**
 * Scale the first four components of this Vec: this = scale * this
 * Scale the first four components of v into this Vec: this = scale * v
 */
scale4(scale: number, v?: Vec4d): void {
	if (v === undefined) {
		this.x = this.x * scale;
		this.y = this.y * scale;
		this.z = this.z * scale;
		this.w = this.w * scale;
		return;
	}
	this.x = v.x * scale;
	this.y = v.y * scale;
	this.z = v.z * scale;
	this.w = v.w * scale;
}

/**
 * Linearly interpolate between a, b into this Vec: this = (1 - ratio) * a + ratio * b
 */
interpolate4(a: Vec4d, b: Vec4d, ratio: number): void {
	const temp = 1.0 - ratio;
	this.x = temp * a.x + ratio * b.x;
	this.y = temp * a.y + ratio * b.y;
	this.z = temp * a.z + ratio * b.z;
	this.w = temp * a.w + ratio * b.w;
}

/**
 * mult4(Mat4d m, Vec4d v): Multiply v by m and store into this Vec: this = m x v
 * mult4(Vec4d v, Mat4d m): Multiply m by v and store into this Vec: this = v x m
 */
mult4(m: Mat4d, v: Vec4d): void;
mult4(v: Vec4d, m: Mat4d): void;
mult4(a: Mat4d | Vec4d, b: Vec4d | Mat4d): void {
	if (isMat4d(a)) {
		const m = a, v = b as Vec4d;
		const _x = m.d00 * v.x + m.d01 * v.y + m.d02 * v.z + m.d03 * v.w;
		const _y = m.d10 * v.x + m.d11 * v.y + m.d12 * v.z + m.d13 * v.w;
		const _z = m.d20 * v.x + m.d21 * v.y + m.d22 * v.z + m.d23 * v.w;
		const _w = m.d30 * v.x + m.d31 * v.y + m.d32 * v.z + m.d33 * v.w;

		this.x = _x;
		this.y = _y;
		this.z = _z;
		this.w = _w;
		return;
	}
	const v = a, m = b as Mat4d;
	const _x = v.x * m.d00 + v.y * m.d10 + v.z * m.d20 + v.w * m.d30;
	const _y = v.x * m.d01 + v.y * m.d11 + v.z * m.d21 + v.w * m.d31;
	const _z = v.x * m.d02 + v.y * m.d12 + v.z * m.d22 + v.w * m.d32;
	const _w = v.x * m.d03 + v.y * m.d13 + v.z * m.d23 + v.w * m.d33;

	this.x = _x;
	this.y = _y;
	this.z = _z;
	this.w = _w;
}

setByInd(index: number, val: number): void {
	switch (index) {
	case 0:
		this.x = val;
		return;
	case 1:
		this.y = val;
		return;
	case 2:
		this.z = val;
		return;
	case 3:
		this.w = val;
		return;
	}
	// assert(false);（Java の assert は既定で無効）
}

getByInd(index: number): number {
	switch (index) {
	case 0:
		return this.x;
	case 1:
		return this.y;
	case 2:
		return this.z;
	case 3:
		return this.w;
	}
	// assert(false);（Java の assert は既定で無効）
	return 0;
}

}
