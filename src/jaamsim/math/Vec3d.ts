/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2012 Ausenco Engineering Canada Inc.
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
 * TypeScript への移植 (C) 2026 shota
 */
import { jstr } from "../java/lang.ts";
import type { Mat4d } from "./Mat4d.ts";
import { isMat4d, Vec2d, vecNear } from "./Vec2d.ts";

/*
 * 移植の注意: Java は Input.SEPARATOR を使うが、Input を import すると読み込みの輪
 * （Input → … → Vec4d extends Vec3d）で Vec3d がまだ無い誤りになりうるので、同じ値をここに置いた。
 * MathUtils.near も同じ理由で Vec2d.ts の vecNear を使う。
 */
const INPUT_SEPARATOR = "  "; // Input.SEPARATOR と同じ

export class Vec3d extends Vec2d {

z: number;

/**
 * Construct a Vec3d initialized to (0,0,0);
 * Construct a Vec3d initialized to (v.x, v.y, v.z);
 * Construct a Vec3d initialized to (x, y, z);
 */
constructor();
constructor(v: Vec3d);
constructor(x: number, y: number, z: number);
constructor(a?: Vec3d | number, b?: number, c?: number) {
	super();
	if (a === undefined) {
		this.x = 0.0;
		this.y = 0.0;
		this.z = 0.0;
	}
	else if (typeof a === "number") {
		this.x = a;
		this.y = b!;
		this.z = c!;
	}
	else {
		this.x = a.x;
		this.y = a.y;
		this.z = a.z;
	}
}

/**
 * Returns a string representation of this vec.
 */
override toString(): string {
	let tmp = "";
	tmp += jstr(this.x);
	tmp += INPUT_SEPARATOR + jstr(this.y);
	tmp += INPUT_SEPARATOR + jstr(this.z);
	return tmp;
}

/**
 * Tests the first three components are exactly equal.
 *
 * This returns true if the x,y,z components compare as equal using the ==
 * operator.  Note that NaN will always return false, and -0.0 and 0.0
 * will compare as equal.
 */
equals3(v: Vec3d): boolean {
	return this.x === v.x && this.y === v.y && this.z === v.z;
}

near3(v: Vec3d): boolean {
	return vecNear(this.x, v.x) &&
	       vecNear(this.y, v.y) &&
	       vecNear(this.z, v.z);
}

/**
 * Set this Vec3d with the values (v.x, v.y, v.z);
 * Set this Vec3d with the values (x, y, z);
 */
set3(v: Vec3d): void;
set3(x: number, y: number, z: number): void;
set3(a: Vec3d | number, b?: number, c?: number): void {
	if (typeof a === "number") {
		this.x = a;
		this.y = b!;
		this.z = c!;
		return;
	}
	this.x = a.x;
	this.y = a.y;
	this.z = a.z;
}

/**
 * Add v to this Vec3d: this = this + v
 * Add v1 to v2 into this Vec3d: this = v1 + v2
 */
add3(v: Vec3d): void;
add3(v1: Vec3d, v2: Vec3d): void;
add3(v1: Vec3d, v2?: Vec3d): void {
	if (v2 === undefined) {
		this.x = this.x + v1.x;
		this.y = this.y + v1.y;
		this.z = this.z + v1.z;
		return;
	}
	this.x = v1.x + v2.x;
	this.y = v1.y + v2.y;
	this.z = v1.z + v2.z;
}

/**
 * Subtract v from this Vec3d: this = this - v
 * Subtract v2 from v1 into this Vec3d: this = v1 - v2
 */
sub3(v: Vec3d): void;
sub3(v1: Vec3d, v2: Vec3d): void;
sub3(v1: Vec3d, v2?: Vec3d): void {
	if (v2 === undefined) {
		this.x = this.x - v1.x;
		this.y = this.y - v1.y;
		this.z = this.z - v1.z;
		return;
	}
	this.x = v1.x - v2.x;
	this.y = v1.y - v2.y;
	this.z = v1.z - v2.z;
}

/**
 * Multiply the elements of this Vec3d by v: this = this * v
 * Multiply the elements of v1 and v2 into this Vec3d: this = v1 * v2
 */
mul3(v: Vec3d): void;
mul3(v1: Vec3d, v2: Vec3d): void;
mul3(v1: Vec3d, v2?: Vec3d): void {
	if (v2 === undefined) {
		this.x = this.x * v1.x;
		this.y = this.y * v1.y;
		this.z = this.z * v1.z;
		return;
	}
	this.x = v1.x * v2.x;
	this.y = v1.y * v2.y;
	this.z = v1.z * v2.z;
}

/**
 * Set this Vec3d to the minimum of this and v: this = min(this, v)
 * Set this Vec3d to the minimum of v1 and v2: this = min(v1, v2)
 */
min3(v: Vec3d): void;
min3(v1: Vec3d, v2: Vec3d): void;
min3(v1: Vec3d, v2?: Vec3d): void {
	if (v2 === undefined) {
		this.x = Math.min(this.x, v1.x);
		this.y = Math.min(this.y, v1.y);
		this.z = Math.min(this.z, v1.z);
		return;
	}
	this.x = Math.min(v1.x, v2.x);
	this.y = Math.min(v1.y, v2.y);
	this.z = Math.min(v1.z, v2.z);
}

/**
 * Set this Vec3d to the maximum of this and v: this = max(this, v)
 * Set this Vec3d to the maximum of v1 and v2: this = max(v1, v2)
 */
max3(v: Vec3d): void;
max3(v1: Vec3d, v2: Vec3d): void;
max3(v1: Vec3d, v2?: Vec3d): void {
	if (v2 === undefined) {
		this.x = Math.max(this.x, v1.x);
		this.y = Math.max(this.y, v1.y);
		this.z = Math.max(this.z, v1.z);
		return;
	}
	this.x = Math.max(v1.x, v2.x);
	this.y = Math.max(v1.y, v2.y);
	this.z = Math.max(v1.z, v2.z);
}

/**
 * Return the 3-component dot product of v1 and v2
 * Internal helper to help with dot, mag and magSquared
 */
private _dot3(v1: Vec3d, v2: Vec3d): number {
	let ret: number;
	ret  = v1.x * v2.x;
	ret += v1.y * v2.y;
	ret += v1.z * v2.z;
	return ret;
}

/**
 * Return the 3-component dot product of this Vec3d with v
 */
dot3(v: Vec3d): number {
	return this._dot3(this, v);
}

/**
 * Return the 3-component magnitude of this Vec3d
 */
mag3(): number {
	return Math.sqrt(this._dot3(this, this));
}

/**
 * Return the 3-component magnitude squared of this Vec3d
 */
magSquare3(): number {
	return this._dot3(this, this);
}

private _norm3(v: Vec3d): void {
	let mag = this._dot3(v, v);
	if (Vec2d.nonNormalMag(mag)) {
		this.x = 0.0;
		this.y = 0.0;
		this.z = 1.0;
		return;
	}

	mag = Math.sqrt(mag);
	this.x = v.x / mag;
	this.y = v.y / mag;
	this.z = v.z / mag;
}

/**
 * Normalize the first three components in-place
 * Set the first three components to the normalized values of v
 *
 * If the Vec has a zero magnitude or contains NaN or Inf, this sets
 * all components but the last to zero, the last component is set to one.
 */
normalize3(v?: Vec3d): void {
	this._norm3(v === undefined ? this : v);
}

/**
 * Scale the first three components of this Vec: this = scale * this
 * Scale the first three components of v into this Vec: this = scale * v
 */
scale3(scale: number, v?: Vec3d): void {
	if (v === undefined) {
		this.x = this.x * scale;
		this.y = this.y * scale;
		this.z = this.z * scale;
		return;
	}
	this.x = v.x * scale;
	this.y = v.y * scale;
	this.z = v.z * scale;
}

/**
 * Linearly interpolate between a, b into this Vec: this = (1 - ratio) * a + ratio * b
 */
interpolate3(a: Vec3d, b: Vec3d, ratio: number): void {
	const temp = 1.0 - ratio;
	this.x = temp * a.x + ratio * b.x;
	this.y = temp * a.y + ratio * b.y;
	this.z = temp * a.z + ratio * b.z;
}

/**
 * Spherical linear interpolation between initial and final unit vectors, with the result returned
 * in this vector.
 * @param a - initial vector
 * @param b - final vector
 * @param ratio - fraction between initial and final vectors
 */
slerp(a: Vec3d, b: Vec3d, ratio: number): void {
	let cosTheta = a.dot3(b);
	if (cosTheta > 0.95) {
		this.interpolate3(a, b, ratio);
		this.normalize3();
		return;
	}
	cosTheta = Math.max(Math.min(cosTheta, 1.0), 0.0);
	const theta = Math.acos(cosTheta);
	const sinTheta = Math.sin(theta);
	const weight0 = Math.sin((1.0 - ratio)*theta) / sinTheta;
	const weight1 = Math.sin(ratio*theta) / sinTheta;
	this.x = (weight0 * a.x) + (weight1 * b.x);
	this.y = (weight0 * a.y) + (weight1 * b.y);
	this.z = (weight0 * a.z) + (weight1 * b.z);
}

/**
 * mult3(Mat4d m, Vec3d v): Multiply v by m and store into this Vec: this = m x v
 * mult3(Vec3d v, Mat4d m): Multiply m by v and store into this Vec: this = v x m
 */
mult3(m: Mat4d, v: Vec3d): void;
mult3(v: Vec3d, m: Mat4d): void;
mult3(a: Mat4d | Vec3d, b: Vec3d | Mat4d): void {
	if (isMat4d(a)) {
		const m = a, v = b as Vec3d;
		const _x = m.d00 * v.x + m.d01 * v.y + m.d02 * v.z;
		const _y = m.d10 * v.x + m.d11 * v.y + m.d12 * v.z;
		const _z = m.d20 * v.x + m.d21 * v.y + m.d22 * v.z;

		this.x = _x;
		this.y = _y;
		this.z = _z;
		return;
	}
	const v = a, m = b as Mat4d;
	const _x = v.x * m.d00 + v.y * m.d10 + v.z * m.d20;
	const _y = v.x * m.d01 + v.y * m.d11 + v.z * m.d21;
	const _z = v.x * m.d02 + v.y * m.d12 + v.z * m.d22;

	this.x = _x;
	this.y = _y;
	this.z = _z;
}

/**
 * Like mult3 but includes an implicit w = 1 term to include the translation part of the matrix
 */
multAndTrans3(m: Mat4d, v: Vec3d): void {
	const _x = m.d00 * v.x + m.d01 * v.y + m.d02 * v.z + m.d03;
	const _y = m.d10 * v.x + m.d11 * v.y + m.d12 * v.z + m.d13;
	const _z = m.d20 * v.x + m.d21 * v.y + m.d22 * v.z + m.d23;

	this.x = _x;
	this.y = _y;
	this.z = _z;
}

/**
 * Set this Vec3d to the cross product of this and v: this = this X v
 * Set this Vec3d to the cross product of v1 and v2: this = v1 X v2
 */
cross3(v: Vec3d): void;
cross3(v1: Vec3d, v2: Vec3d): void;
cross3(v1: Vec3d, v2?: Vec3d): void {
	if (v2 === undefined) {
		const v = v1;
		// Use temp vars to deal with this passed in as the argument
		const _x = this.y * v.z - this.z * v.y;
		const _y = this.z * v.x - this.x * v.z;
		const _z = this.x * v.y - this.y * v.x;

		this.x = _x;
		this.y = _y;
		this.z = _z;
		return;
	}
	// Use temp vars to deal with this passed in as the argument
	const _x = v1.y * v2.z - v1.z * v2.y;
	const _y = v1.z * v2.x - v1.x * v2.z;
	const _z = v1.x * v2.y - v1.y * v2.x;

	this.x = _x;
	this.y = _y;
	this.z = _z;
}
}
