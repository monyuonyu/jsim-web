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
import { jstr } from "../internal.ts";
import type { Mat4d } from "./Mat4d.ts";
import type { Vec3d } from "./Vec3d.ts";

/*
 * 移植の注意: MathUtils.near を import すると、MathUtils → Vec4d → Vec3d → Vec2d の読み込みの輪ができ、
 * 「class Vec3d extends Vec2d」の時点で Vec2d がまだ無い誤りになる。
 * そのため、MathUtils.near と同じ計算をここに写した（vecNear）。Vec3d・Vec4d もこれを使う。
 */
const EPSILON = 0.000000001; // MathUtils.EPSILON と同じ
/** MathUtils.near(a, b) と同じ計算 */
export function vecNear(a: number, b: number): boolean {
	const diff = Math.abs(a - b);
	return diff < EPSILON;
}

/** m が Mat4d か（Mat4d を値として import しないための見分け方） */
export function isMat4d(o: unknown): o is Mat4d {
	return typeof o === "object" && o !== null && "d33" in o;
}

export class Vec2d {

x: number;
y: number;

/**
 * Construct a Vec2d initialized to (0,0);
 * Construct a Vec2d initialized to (v.x, v.y);
 * Construct a Vec2d initialized to (x, y);
 */
constructor();
constructor(v: Vec2d);
constructor(x: number, y: number);
constructor(a?: Vec2d | number, b?: number) {
	if (a === undefined) {
		this.x = 0.0;
		this.y = 0.0;
	}
	else if (typeof a === "number") {
		this.x = a;
		this.y = b!;
	}
	else {
		this.x = a.x;
		this.y = a.y;
	}
}

/**
 * Returns a string representation of this vec.
 */
toString(): string {
	let tmp = "(";
	tmp += jstr(this.x);
	tmp += ", " + jstr(this.y);
	tmp += ")";
	return tmp;
}

/**
 * Tests the first two components are exactly equal.
 *
 * This returns true if the x,y components compare as equal using the ==
 * operator.  Note that NaN will always return false, and -0.0 and 0.0
 * will compare as equal.
 * @throws NullPointerException if v is null
 */
equals2(v: Vec2d): boolean {
	return this.x === v.x && this.y === v.y;
}

near2(v: Vec2d): boolean {
	return vecNear(this.x, v.x) &&
	       vecNear(this.y, v.y);
}

/**
 * Set this Vec2d with the values (v.x, v.y);
 * Set this Vec3d with the values (x, y);
 */
set2(v: Vec3d): void;
set2(x: number, y: number): void;
set2(a: Vec3d | number, b?: number): void {
	if (typeof a === "number") {
		this.x = a;
		this.y = b!;
		return;
	}
	this.x = a.x;
	this.y = a.y;
}

/**
 * Add v to this Vec2d: this = this + v
 * Add v1 to v2 into this Vec2d: this = v1 + v2
 */
add2(v: Vec2d): void;
add2(v1: Vec2d, v2: Vec2d): void;
add2(v1: Vec2d, v2?: Vec2d): void {
	if (v2 === undefined) {
		this.x = this.x + v1.x;
		this.y = this.y + v1.y;
		return;
	}
	this.x = v1.x + v2.x;
	this.y = v1.y + v2.y;
}

/**
 * Subtract v from this Vec2d: this = this - v
 * Subtract v2 from v1 into this Vec2d: this = v1 - v2
 */
sub2(v: Vec2d): void;
sub2(v1: Vec2d, v2: Vec2d): void;
sub2(v1: Vec2d, v2?: Vec2d): void {
	if (v2 === undefined) {
		this.x = this.x - v1.x;
		this.y = this.y - v1.y;
		return;
	}
	this.x = v1.x - v2.x;
	this.y = v1.y - v2.y;
}

/**
 * Multiply the elements of this Vec2d by v: this = this * v
 * Multiply the elements of v1 and v2 into this Vec2d: this = v1 * v2
 */
mul2(v: Vec2d): void;
mul2(v1: Vec2d, v2: Vec2d): void;
mul2(v1: Vec2d, v2?: Vec2d): void {
	if (v2 === undefined) {
		this.x = this.x * v1.x;
		this.y = this.y * v1.y;
		return;
	}
	this.x = v1.x * v2.x;
	this.y = v1.y * v2.y;
}

/**
 * Set this Vec2d to the minimum of this and v: this = min(this, v)
 * Set this Vec2d to the minimum of v1 and v2: this = min(v1, v2)
 */
min2(v: Vec2d): void;
min2(v1: Vec2d, v2: Vec2d): void;
min2(v1: Vec2d, v2?: Vec2d): void {
	if (v2 === undefined) {
		this.x = Math.min(this.x, v1.x);
		this.y = Math.min(this.y, v1.y);
		return;
	}
	this.x = Math.min(v1.x, v2.x);
	this.y = Math.min(v1.y, v2.y);
}

/**
 * Set this Vec2d to the maximum of this and v: this = max(this, v)
 * Set this Vec2d to the maximum of v1 and v2: this = max(v1, v2)
 */
max2(v: Vec2d): void;
max2(v1: Vec2d, v2: Vec2d): void;
max2(v1: Vec2d, v2?: Vec2d): void {
	if (v2 === undefined) {
		this.x = Math.max(this.x, v1.x);
		this.y = Math.max(this.y, v1.y);
		return;
	}
	this.x = Math.max(v1.x, v2.x);
	this.y = Math.max(v1.y, v2.y);
}

/**
 * Return the 2-component dot product of v1 and v2
 * Internal helper to help with dot, mag and magSquared
 */
private _dot2(v1: Vec2d, v2: Vec2d): number {
	let ret: number;
	ret  = v1.x * v2.x;
	ret += v1.y * v2.y;
	return ret;
}

/**
 * Return the 2-component dot product of this Vec2d with v
 */
dot2(v: Vec2d): number {
	return this._dot2(this, v);
}

/**
 * Return the 2-component magnitude of this Vec2d
 */
mag2(): number {
	return Math.sqrt(this._dot2(this, this));
}

/**
 * Return the 2-component magnitude squared of this Vec2d
 */
magSquare2(): number {
	return this._dot2(this, this);
}

/**
 * Returns whether the given magnitude can be used to normalize a Vec
 */
static nonNormalMag(mag: number): boolean {
	return mag === 0.0 || Number.isNaN(mag) || mag === Infinity || mag === -Infinity;
}

private _norm2(v: Vec2d): void {
	let mag = this._dot2(v, v);
	if (Vec2d.nonNormalMag(mag)) {
		this.x = 0.0;
		this.y = 1.0;
		return;
	}

	mag = Math.sqrt(mag);
	this.x = v.x / mag;
	this.y = v.y / mag;
}

/**
 * Normalize the first two components in-place
 * Set the first two components to the normalized values of v
 *
 * If the Vec has a zero magnitude or contains NaN or Inf, this sets
 * all components but the last to zero, the last component is set to one.
 */
normalize2(v?: Vec2d): void {
	this._norm2(v === undefined ? this : v);
}

/**
 * Scale the first two components of this Vec: this = scale * this
 * Scale the first two components of v into this Vec: this = scale * v
 */
scale2(scale: number, v?: Vec2d): void {
	if (v === undefined) {
		this.x = this.x * scale;
		this.y = this.y * scale;
		return;
	}
	this.x = v.x * scale;
	this.y = v.y * scale;
}

/**
 * Linearly interpolate between a, b into this Vec: this = (1 - ratio) * a + ratio * b
 */
interpolate2(a: Vec2d, b: Vec2d, ratio: number): void {
	const temp = 1.0 - ratio;
	this.x = temp * a.x + ratio * b.x;
	this.y = temp * a.y + ratio * b.y;
}

/**
 * mult2(Mat4d m, Vec2d v): Multiply v by m and store into this Vec: this = m x v
 * mult2(Vec2d v, Mat4d m): Multiply m by v and store into this Vec: this = v x m
 */
mult2(m: Mat4d, v: Vec2d): void;
mult2(v: Vec2d, m: Mat4d): void;
mult2(a: Mat4d | Vec2d, b: Vec2d | Mat4d): void {
	if (isMat4d(a)) {
		const m = a, v = b as Vec2d;
		const _x = m.d00 * v.x + m.d01 * v.y;
		const _y = m.d10 * v.x + m.d11 * v.y;

		this.x = _x;
		this.y = _y;
		return;
	}
	const v = a, m = b as Mat4d;
	const _x = v.x * m.d00 + v.y * m.d10;
	const _y = v.x * m.d01 + v.y * m.d11;

	this.x = _x;
	this.y = _y;
}
}
