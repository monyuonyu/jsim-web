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
import { tr } from "../internal.ts";
import { IllegalArgumentException } from "../internal.ts";
import { MathUtils } from "../internal.ts";
import type { Quaternion } from "./Quaternion.ts";
import type { Vec2d } from "./Vec2d.ts";
import type { Vec3d } from "./Vec3d.ts";
import type { Vec4d } from "./Vec4d.ts";

export class Mat4d {

d00 = 0.0; d01 = 0.0; d02 = 0.0; d03 = 0.0;
d10 = 0.0; d11 = 0.0; d12 = 0.0; d13 = 0.0;
d20 = 0.0; d21 = 0.0; d22 = 0.0; d23 = 0.0;
d30 = 0.0; d31 = 0.0; d32 = 0.0; d33 = 0.0;

/**
 * Construct a Mat4d initialized to the identity matrix
 * Construct a Mat4d from the given Matrix
 * Construct a Mat4d from the given array (row-major order)
 * @throws IllegalArgumentException if mat has fewer than 16 elements
 */
constructor();
constructor(mat: Mat4d);
constructor(...mat: number[]);
constructor(mat: number[]);
constructor(...args: (Mat4d | number | number[])[]) {
	if (args.length === 0) {
		this._identity();
		return;
	}
	if (args.length === 1 && args[0] instanceof Mat4d) {
		const mat = args[0];
		this.d00 = mat.d00; this.d01 = mat.d01; this.d02 = mat.d02; this.d03 = mat.d03;
		this.d10 = mat.d10; this.d11 = mat.d11; this.d12 = mat.d12; this.d13 = mat.d13;
		this.d20 = mat.d20; this.d21 = mat.d21; this.d22 = mat.d22; this.d23 = mat.d23;
		this.d30 = mat.d30; this.d31 = mat.d31; this.d32 = mat.d32; this.d33 = mat.d33;
		return;
	}
	// double... mat（配列をそのまま渡した場合も同じ）
	const mat = (args.length === 1 && Array.isArray(args[0]) ? args[0] : args) as number[];
	if (mat.length < 16)
		throw new IllegalArgumentException(tr("Fewer than 16 elements in argument"));

	this.d00 = mat[ 0]; this.d01 = mat[ 1]; this.d02 = mat[ 2]; this.d03 = mat[ 3];
	this.d10 = mat[ 4]; this.d11 = mat[ 5]; this.d12 = mat[ 6]; this.d13 = mat[ 7];
	this.d20 = mat[ 8]; this.d21 = mat[ 9]; this.d22 = mat[10]; this.d23 = mat[11];
	this.d30 = mat[12]; this.d31 = mat[13]; this.d32 = mat[14]; this.d33 = mat[15];
}

/**
 * Internal helper to set the values to the identity matrix
 */
private _identity(): void {
	this.d00 = 1.0; this.d01 = 0.0; this.d02 = 0.0; this.d03 = 0.0;
	this.d10 = 0.0; this.d11 = 1.0; this.d12 = 0.0; this.d13 = 0.0;
	this.d20 = 0.0; this.d21 = 0.0; this.d22 = 1.0; this.d23 = 0.0;
	this.d30 = 0.0; this.d31 = 0.0; this.d32 = 0.0; this.d33 = 1.0;
}

/**
 * Internal helper to zero the entire matrix
 */
private _zero(): void {
	this.d00 = 0.0; this.d01 = 0.0; this.d02 = 0.0; this.d03 = 0.0;
	this.d10 = 0.0; this.d11 = 0.0; this.d12 = 0.0; this.d13 = 0.0;
	this.d20 = 0.0; this.d21 = 0.0; this.d22 = 0.0; this.d23 = 0.0;
	this.d30 = 0.0; this.d31 = 0.0; this.d32 = 0.0; this.d33 = 0.0;
}

/**
 * Set all values in the matrix to zero
 */
zero(): void {
	this._zero();
}

/**
 * Set all values in the matrix to the identity matrix
 */
identity(): void {
	this._identity();
}

/**
 * Set all elements of this matrix to m.
 * @throws NullPointerException if m is null
 */
set4(m: Mat4d): void {
	this.d00 = m.d00; this.d01 = m.d01; this.d02 = m.d02; this.d03 = m.d03;
	this.d10 = m.d10; this.d11 = m.d11; this.d12 = m.d12; this.d13 = m.d13;
	this.d20 = m.d20; this.d21 = m.d21; this.d22 = m.d22; this.d23 = m.d23;
	this.d30 = m.d30; this.d31 = m.d31; this.d32 = m.d32; this.d33 = m.d33;
}

/**
 * Transpose this matrix in-place
 * （m を渡したとき）Set this matrix to the transpose of the given matrix
 */
transpose4(m?: Mat4d): void {
	if (m === undefined) {
		let tmp: number;

		tmp = this.d01; this.d01 = this.d10; this.d10 = tmp;
		tmp = this.d02; this.d02 = this.d20; this.d20 = tmp;
		tmp = this.d03; this.d03 = this.d30; this.d30 = tmp;
		tmp = this.d12; this.d12 = this.d21; this.d21 = tmp;
		tmp = this.d13; this.d13 = this.d31; this.d31 = tmp;
		tmp = this.d23; this.d23 = this.d32; this.d32 = tmp;
		return;
	}

	// We can safely set the diagonal, even if m is 'this'
	this.d00 = m.d00; this.d11 = m.d11; this.d22 = m.d22; this.d33 = m.d33;

	// Be careful in case this was passed to itself
	let tmp: number;
	tmp = m.d01; this.d01 = m.d10; this.d10 = tmp;
	tmp = m.d02; this.d02 = m.d20; this.d20 = tmp;
	tmp = m.d03; this.d03 = m.d30; this.d30 = tmp;
	tmp = m.d12; this.d12 = m.d21; this.d21 = tmp;
	tmp = m.d13; this.d13 = m.d31; this.d31 = tmp;
	tmp = m.d23; this.d23 = m.d32; this.d32 = tmp;
}

/**
 * Sets the upper 3x3 of this matrix by multiplying m1 with m2: this = m1 x m2
 * @throws NullPointerException if m1 or m2 are null
 */
private _mult3(m1: Mat4d, m2: Mat4d): void {
	// Do everything in temp vars in case m1 or m2 === this
	let _d00: number, _d01: number, _d02: number;
	_d00 = m1.d00 * m2.d00 + m1.d01 * m2.d10 + m1.d02 * m2.d20;
	_d01 = m1.d00 * m2.d01 + m1.d01 * m2.d11 + m1.d02 * m2.d21;
	_d02 = m1.d00 * m2.d02 + m1.d01 * m2.d12 + m1.d02 * m2.d22;

	let _d10: number, _d11: number, _d12: number;
	_d10 = m1.d10 * m2.d00 + m1.d11 * m2.d10 + m1.d12 * m2.d20;
	_d11 = m1.d10 * m2.d01 + m1.d11 * m2.d11 + m1.d12 * m2.d21;
	_d12 = m1.d10 * m2.d02 + m1.d11 * m2.d12 + m1.d12 * m2.d22;

	let _d20: number, _d21: number, _d22: number;
	_d20 = m1.d20 * m2.d00 + m1.d21 * m2.d10 + m1.d22 * m2.d20;
	_d21 = m1.d20 * m2.d01 + m1.d21 * m2.d11 + m1.d22 * m2.d21;
	_d22 = m1.d20 * m2.d02 + m1.d21 * m2.d12 + m1.d22 * m2.d22;

	this.d00 = _d00; this.d01 = _d01; this.d02 = _d02;
	this.d10 = _d10; this.d11 = _d11; this.d12 = _d12;
	this.d20 = _d20; this.d21 = _d21; this.d22 = _d22;
}

/**
 * Sets the upper 3x3 of this matrix by multiplying this with m: this = this x m
 * Sets the upper 3x3 of this matrix by multiplying m1 with m2: this = m1 x m2
 */
mult3(m: Mat4d): void;
mult3(m1: Mat4d, m2: Mat4d): void;
mult3(m1: Mat4d, m2?: Mat4d): void {
	if (m2 === undefined) {
		this._mult3(this, m1);
		return;
	}
	this._mult3(m1, m2);
}

/**
 * Sets the matrix by multiplying m1 with m2: this = m1 x m2
 * @throws NullPointerException if m1 or m2 are null
 */
private _mult4(m1: Mat4d, m2: Mat4d): void {
	let _d00: number, _d01: number, _d02: number, _d03: number;
	_d00 = m1.d00 * m2.d00 + m1.d01 * m2.d10 + m1.d02 * m2.d20 + m1.d03 * m2.d30;
	_d01 = m1.d00 * m2.d01 + m1.d01 * m2.d11 + m1.d02 * m2.d21 + m1.d03 * m2.d31;
	_d02 = m1.d00 * m2.d02 + m1.d01 * m2.d12 + m1.d02 * m2.d22 + m1.d03 * m2.d32;
	_d03 = m1.d00 * m2.d03 + m1.d01 * m2.d13 + m1.d02 * m2.d23 + m1.d03 * m2.d33;

	let _d10: number, _d11: number, _d12: number, _d13: number;
	_d10 = m1.d10 * m2.d00 + m1.d11 * m2.d10 + m1.d12 * m2.d20 + m1.d13 * m2.d30;
	_d11 = m1.d10 * m2.d01 + m1.d11 * m2.d11 + m1.d12 * m2.d21 + m1.d13 * m2.d31;
	_d12 = m1.d10 * m2.d02 + m1.d11 * m2.d12 + m1.d12 * m2.d22 + m1.d13 * m2.d32;
	_d13 = m1.d10 * m2.d03 + m1.d11 * m2.d13 + m1.d12 * m2.d23 + m1.d13 * m2.d33;

	let _d20: number, _d21: number, _d22: number, _d23: number;
	_d20 = m1.d20 * m2.d00 + m1.d21 * m2.d10 + m1.d22 * m2.d20 + m1.d23 * m2.d30;
	_d21 = m1.d20 * m2.d01 + m1.d21 * m2.d11 + m1.d22 * m2.d21 + m1.d23 * m2.d31;
	_d22 = m1.d20 * m2.d02 + m1.d21 * m2.d12 + m1.d22 * m2.d22 + m1.d23 * m2.d32;
	_d23 = m1.d20 * m2.d03 + m1.d21 * m2.d13 + m1.d22 * m2.d23 + m1.d23 * m2.d33;

	let _d30: number, _d31: number, _d32: number, _d33: number;
	_d30 = m1.d30 * m2.d00 + m1.d31 * m2.d10 + m1.d32 * m2.d20 + m1.d33 * m2.d30;
	_d31 = m1.d30 * m2.d01 + m1.d31 * m2.d11 + m1.d32 * m2.d21 + m1.d33 * m2.d31;
	_d32 = m1.d30 * m2.d02 + m1.d31 * m2.d12 + m1.d32 * m2.d22 + m1.d33 * m2.d32;
	_d33 = m1.d30 * m2.d03 + m1.d31 * m2.d13 + m1.d32 * m2.d23 + m1.d33 * m2.d33;

	this.d00 = _d00; this.d01 = _d01; this.d02 = _d02; this.d03 = _d03;
	this.d10 = _d10; this.d11 = _d11; this.d12 = _d12; this.d13 = _d13;
	this.d20 = _d20; this.d21 = _d21; this.d22 = _d22; this.d23 = _d23;
	this.d30 = _d30; this.d31 = _d31; this.d32 = _d32; this.d33 = _d33;
}

/**
 * Sets the matrix by multiplying this with m: this = this x m
 * Sets the matrix by multiplying m1 with m2: this = m1 x m2
 */
mult4(m: Mat4d): void;
mult4(m1: Mat4d, m2: Mat4d): void;
mult4(m1: Mat4d, m2?: Mat4d): void {
	if (m2 === undefined) {
		this._mult4(this, m1);
		return;
	}
	this._mult4(m1, m2);
}

/**
 * Fill the upper 3x3 with a rotation represented by the Quaternion q
 * @throws NullPointerException if q is null
 */
private _rot3(q: Quaternion): void {
	let xsq = q.x * q.x;
	let ysq = q.y * q.y;
	let zsq = q.z * q.z;
	let wsq = q.w * q.w;

	this.d00 = wsq + xsq - ysq - zsq;
	this.d01 = 2.0 * (q.y * q.x - q.w * q.z);
	this.d02 = 2.0 * (q.z * q.x + q.w * q.y);

	this.d10 = 2.0 * (q.x * q.y + q.w * q.z);
	this.d11 = wsq - xsq + ysq - zsq;
	this.d12 = 2.0 * (q.z * q.y - q.w * q.x);

	this.d20 = 2.0 * (q.x * q.z - q.w * q.y);
	this.d21 = 2.0 * (q.y * q.z + q.w * q.x);
	this.d22 = wsq - xsq - ysq + zsq;
}

/**
 * Sets the upper 3x3 the the rotation represented by the Quaternion q
 * @throws NullPointerException if q is null
 */
setRot3(q: Quaternion): void {
	this._rot3(q);
}

/**
 * Sets the upper 3x3 the the rotation represented by the Quaternion q
 *
 * Clears the remaining elements to the identity matrix
 * @throws NullPointerException if q is null
 */
setRot4(q: Quaternion): void {
	this._rot3(q);
	this.d03 = 0.0; this.d13 = 0.0; this.d23 = 0.0;
	this.d30 = 0.0; this.d31 = 0.0; this.d32 = 0.0;
	this.d33 = 1.0;
}

/**
 * Fill the upper 3x3 with a rotation specified as 3 independent euler
 * rotations.
 * @throws NullPointerException if v is null
 */
private _euler3(v: Vec3d): void {
	let sinx = Math.sin(v.x);
	let siny = Math.sin(v.y);
	let sinz = Math.sin(v.z);
	let cosx = Math.cos(v.x);
	let cosy = Math.cos(v.y);
	let cosz = Math.cos(v.z);

	// Calculate a 3x3 rotation matrix
	this.d00 = cosy * cosz;
	this.d01 = -(cosx * sinz) + (sinx * siny * cosz);
	this.d02 = (sinx * sinz) + (cosx * siny * cosz);

	this.d10 = cosy * sinz;
	this.d11 = (cosx * cosz) + (sinx * siny * sinz);
	this.d12 = -(sinx * cosz) + (cosx * siny * sinz);

	this.d20 = -siny;
	this.d21 = sinx * cosy;
	this.d22 = cosx * cosy;
}

/**
 * Set the upper 3x3 with a rotation specified as 3 independent euler
 * rotations.
 * @throws NullPointerException if v is null
 */
setEuler3(v: Vec3d): void {
	this._euler3(v);
}

/**
 * Set the upper 3x3 with a rotation specified as 3 independent euler
 * rotations.
 *
 * Clears the remaining elements to the identity matrix
 * @throws NullPointerException if v is null
 */
setEuler4(v: Vec3d): void {
	this._euler3(v);
	this.d03 = 0.0; this.d13 = 0.0; this.d23 = 0.0;
	this.d30 = 0.0; this.d31 = 0.0; this.d32 = 0.0;
	this.d33 = 1.0;
}

/**
 * Sets the 3 translation components without modifying any other components
 * @throws NullPointerException if v is null
 */
setTranslate3(v: Vec3d): void {
	this.d03 = v.x;
	this.d13 = v.y;
	this.d23 = v.z;
}

/**
 * Scale the upper 2x2 by the given value
 * @throws NullPointerException if v is null
 */
scale2(scale: number): void {
	this.d00 *= scale; this.d01 *= scale;
	this.d10 *= scale; this.d11 *= scale;
}

/**
 * Scale the upper 3x3 by the given value
 * @throws NullPointerException if v is null
 */
scale3(scale: number): void {
	this.d00 *= scale; this.d01 *= scale; this.d02 *= scale;
	this.d10 *= scale; this.d11 *= scale; this.d12 *= scale;
	this.d20 *= scale; this.d21 *= scale; this.d22 *= scale;
}

/**
 * Scale the upper 4x4 by the given value
 * @throws NullPointerException if v is null
 */
scale4(scale: number): void {
	this.d00 *= scale; this.d01 *= scale; this.d02 *= scale; this.d03 *= scale;
	this.d10 *= scale; this.d11 *= scale; this.d12 *= scale; this.d13 *= scale;
	this.d20 *= scale; this.d21 *= scale; this.d22 *= scale; this.d23 *= scale;
	this.d30 *= scale; this.d31 *= scale; this.d32 *= scale; this.d33 *= scale;
}

/**
 * Scale the first two rows by the given vector values
 * @throws NullPointerException if v is null
 */
scaleRows2(v: Vec2d): void {
	this.d00 *= v.x; this.d01 *= v.x; this.d02 *= v.x; this.d03 *= v.x;
	this.d10 *= v.y; this.d11 *= v.y; this.d12 *= v.y; this.d13 *= v.y;
}

/**
 * Scale the first three rows by the given vector values
 * @throws NullPointerException if v is null
 */
scaleRows3(v: Vec3d): void {
	this.d00 *= v.x; this.d01 *= v.x; this.d02 *= v.x; this.d03 *= v.x;
	this.d10 *= v.y; this.d11 *= v.y; this.d12 *= v.y; this.d13 *= v.y;
	this.d20 *= v.z; this.d21 *= v.z; this.d22 *= v.z; this.d23 *= v.z;
}

/**
 * Scale the first four rows by the given vector values
 * @throws NullPointerException if v is null
 */
scaleRows4(v: Vec4d): void {
	this.d00 *= v.x; this.d01 *= v.x; this.d02 *= v.x; this.d03 *= v.x;
	this.d10 *= v.y; this.d11 *= v.y; this.d12 *= v.y; this.d13 *= v.y;
	this.d20 *= v.z; this.d21 *= v.z; this.d22 *= v.z; this.d23 *= v.z;
	this.d30 *= v.w; this.d31 *= v.w; this.d32 *= v.w; this.d33 *= v.w;
}

/**
 * Scale the first two columns by the given vector values
 * @throws NullPointerException if v is null
 */
scaleCols2(v: Vec2d): void {
	this.d00 *= v.x; this.d01 *= v.y;
	this.d10 *= v.x; this.d11 *= v.y;
	this.d20 *= v.x; this.d21 *= v.y;
	this.d30 *= v.x; this.d31 *= v.y;
}

/**
 * Scale the first three columns by the given vector values
 * @throws NullPointerException if v is null
 */
scaleCols3(v: Vec3d): void {
	this.d00 *= v.x; this.d01 *= v.y; this.d02 *= v.z;
	this.d10 *= v.x; this.d11 *= v.y; this.d12 *= v.z;
	this.d20 *= v.x; this.d21 *= v.y; this.d22 *= v.z;
	this.d30 *= v.x; this.d31 *= v.y; this.d32 *= v.z;
}

/**
 * Scale the first four columns by the given vector values
 * @throws NullPointerException if v is null
 */
scaleCols4(v: Vec4d): void {
	this.d00 *= v.x; this.d01 *= v.y; this.d02 *= v.z; this.d03 *= v.w;
	this.d10 *= v.x; this.d11 *= v.y; this.d12 *= v.z; this.d13 *= v.w;
	this.d20 *= v.x; this.d21 *= v.y; this.d22 *= v.z; this.d23 *= v.w;
	this.d30 *= v.x; this.d31 *= v.y; this.d32 *= v.z; this.d33 *= v.w;
}

/**
 * Add the values of m to this
 * @throws NullPointerException if v is null
 */
add4(m: Mat4d): void {
	this.d00 += m.d00;
	this.d01 += m.d01;
	this.d02 += m.d02;
	this.d03 += m.d03;

	this.d10 += m.d10;
	this.d11 += m.d11;
	this.d12 += m.d12;
	this.d13 += m.d13;

	this.d20 += m.d20;
	this.d21 += m.d21;
	this.d22 += m.d22;
	this.d23 += m.d23;

	this.d30 += m.d30;
	this.d31 += m.d31;
	this.d32 += m.d32;
	this.d33 += m.d33;
}

/**
 * Return the determinant of the matrix.
 */
determinant(): number {
	// As the final row tends to be 0,0,0,1, calculate the cofactor
	// expansion along that row with fastpath for zeros.
	let det = 0.0;
	if (this.d30 !== 0.0) {
		det -= this.d30*(this.d01*this.d12*this.d23 + this.d02*this.d13*this.d21 + this.d03*this.d11*this.d22 -
		            this.d01*this.d13*this.d22 - this.d02*this.d11*this.d23 - this.d03*this.d12*this.d21);
	}

	if (this.d31 !== 0.0) {
		det += this.d31*(this.d00*this.d12*this.d23 + this.d02*this.d13*this.d20 + this.d03*this.d10*this.d22 -
		            this.d00*this.d13*this.d22 - this.d02*this.d10*this.d23 - this.d03*this.d12*this.d20);
	}

	if (this.d32 !== 0.0) {
		det -= this.d32*(this.d00*this.d11*this.d23 + this.d01*this.d13*this.d20 + this.d03*this.d10*this.d21 -
		            this.d00*this.d13*this.d21 - this.d01*this.d10*this.d23 - this.d03*this.d11*this.d20);
	}

	if (this.d33 !== 0.0) {
		det += this.d33*(this.d00*this.d11*this.d22 + this.d01*this.d12*this.d20 + this.d02*this.d10*this.d21 -
		            this.d00*this.d12*this.d21 - this.d01*this.d10*this.d22 - this.d02*this.d11*this.d20);
	}

	return det;
}

/**
 * Returns the inverse of this matrix, or null if the matrix is not invertible
 */
inverse(): Mat4d | null {
	let det = this.determinant();

	if (det === 0.0) {
		return null;
	}

	let invDet = 1 / det;

	let ret = new Mat4d();
	let data = this.toCMDataArray();
	const scratch: number[] = new Array<number>(9).fill(0.0);
	ret.d00 = invDet * this.cofactor(0, 0, data, scratch);
	ret.d01 = invDet * this.cofactor(0, 1, data, scratch);
	ret.d02 = invDet * this.cofactor(0, 2, data, scratch);
	ret.d03 = invDet * this.cofactor(0, 3, data, scratch);

	ret.d10 = invDet * this.cofactor(1, 0, data, scratch);
	ret.d11 = invDet * this.cofactor(1, 1, data, scratch);
	ret.d12 = invDet * this.cofactor(1, 2, data, scratch);
	ret.d13 = invDet * this.cofactor(1, 3, data, scratch);

	ret.d20 = invDet * this.cofactor(2, 0, data, scratch);
	ret.d21 = invDet * this.cofactor(2, 1, data, scratch);
	ret.d22 = invDet * this.cofactor(2, 2, data, scratch);
	ret.d23 = invDet * this.cofactor(2, 3, data, scratch);

	ret.d30 = invDet * this.cofactor(3, 0, data, scratch);
	ret.d31 = invDet * this.cofactor(3, 1, data, scratch);
	ret.d32 = invDet * this.cofactor(3, 2, data, scratch);
	ret.d33 = invDet * this.cofactor(3, 3, data, scratch);

	return ret;
}

private cofactor(x: number, y: number, data: number[], sub: number[]): number {
	let nextVal = 0;
	for (let row = 0; row < 4; ++row) {
		if (row === x) continue;
		for (let col = 0; col < 4; ++col) {
			if (col === y) continue;

			sub[nextVal++] = data[row*4 + col];
		}
	}
	// Now determine the determinant of the submat
	let ret = 0;
	ret += sub[0] * sub[4] * sub[8];
	ret += sub[1] * sub[5] * sub[6];
	ret += sub[2] * sub[3] * sub[7];

	ret -= sub[2] * sub[4] * sub[6];
	ret -= sub[1] * sub[3] * sub[8];
	ret -= sub[0] * sub[5] * sub[7];

	if ((x+y) % 2 !== 0) {
		ret *= -1;
	}
	return ret;
}

/**
 * Returns a column major (for historical reasons) array of the elements of this matrix
 */
toCMDataArray(): number[] {
	const ret: number[] = new Array<number>(16).fill(0.0);
	ret[ 0] = this.d00;
	ret[ 1] = this.d10;
	ret[ 2] = this.d20;
	ret[ 3] = this.d30;

	ret[ 4] = this.d01;
	ret[ 5] = this.d11;
	ret[ 6] = this.d21;
	ret[ 7] = this.d31;

	ret[ 8] = this.d02;
	ret[ 9] = this.d12;
	ret[10] = this.d22;
	ret[11] = this.d32;

	ret[12] = this.d03;
	ret[13] = this.d13;
	ret[14] = this.d23;
	ret[15] = this.d33;

	return ret;
}

/**
 * Debugging feature. Check that this matrix is very close to the identity matrix
 */
nearIdentity(): boolean {
	return this.nearIdentityThresh(0.0001);
}

nearIdentityThresh(threshold: number): boolean {
	let ret = true;
	ret = ret && (Math.abs(this.d00 - 1) < threshold);
	ret = ret && (Math.abs(this.d11 - 1) < threshold);
	ret = ret && (Math.abs(this.d22 - 1) < threshold);
	ret = ret && (Math.abs(this.d33 - 1) < threshold);

	ret = ret && (Math.abs(this.d01 - 0) < threshold);
	ret = ret && (Math.abs(this.d02 - 0) < threshold);
	ret = ret && (Math.abs(this.d03 - 0) < threshold);

	ret = ret && (Math.abs(this.d10 - 0) < threshold);
	ret = ret && (Math.abs(this.d12 - 0) < threshold);
	ret = ret && (Math.abs(this.d13 - 0) < threshold);

	ret = ret && (Math.abs(this.d20 - 0) < threshold);
	ret = ret && (Math.abs(this.d21 - 0) < threshold);
	ret = ret && (Math.abs(this.d23 - 0) < threshold);

	ret = ret && (Math.abs(this.d30 - 0) < threshold);
	ret = ret && (Math.abs(this.d31 - 0) < threshold);
	ret = ret && (Math.abs(this.d32 - 0) < threshold);

	return ret;

}

/**
 * Debugging feature. Check that this matrix is very close to the identity matrix
 */
nearIdentity3(): boolean {
	return this.nearIdentityThresh3(0.0001);
}

nearIdentityThresh3(threshold: number): boolean {
	let ret = true;
	ret = ret && (Math.abs(this.d00 - 1) < threshold);
	ret = ret && (Math.abs(this.d11 - 1) < threshold);
	ret = ret && (Math.abs(this.d22 - 1) < threshold);

	ret = ret && (Math.abs(this.d01 - 0) < threshold);
	ret = ret && (Math.abs(this.d02 - 0) < threshold);

	ret = ret && (Math.abs(this.d10 - 0) < threshold);
	ret = ret && (Math.abs(this.d12 - 0) < threshold);

	ret = ret && (Math.abs(this.d20 - 0) < threshold);
	ret = ret && (Math.abs(this.d21 - 0) < threshold);


	return ret;

}

near4(m: Mat4d): boolean {
	return MathUtils.near(this.d00, m.d00) &&
	       MathUtils.near(this.d01, m.d01) &&
	       MathUtils.near(this.d02, m.d02) &&
	       MathUtils.near(this.d03, m.d03) &&

	       MathUtils.near(this.d10, m.d10) &&
	       MathUtils.near(this.d11, m.d11) &&
	       MathUtils.near(this.d12, m.d12) &&
	       MathUtils.near(this.d13, m.d13) &&

	       MathUtils.near(this.d20, m.d20) &&
	       MathUtils.near(this.d21, m.d21) &&
	       MathUtils.near(this.d22, m.d22) &&
	       MathUtils.near(this.d23, m.d23) &&

	       MathUtils.near(this.d30, m.d30) &&
	       MathUtils.near(this.d31, m.d31) &&
	       MathUtils.near(this.d32, m.d32) &&
	       MathUtils.near(this.d33, m.d33);
}

}
