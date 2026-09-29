/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2012 Ausenco Engineering Canada Inc.
 * Copyright (C) 2023 JaamSim Software Inc.
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
import { IllegalArgumentException, jstr } from "../internal.ts";
import { MathUtils } from "../internal.ts";
import { Vec3d } from "../internal.ts";
import { Vec4d } from "../internal.ts";

/**
 * Quaternion class, stored as an array of 4 doubles
 * @author Matt Chudleigh
 *
 */
export class Quaternion {

x: number;
y: number;
z: number;
w: number;

/**
 * Default returns an identity quaternion (real = 1, imaginary = 0)
 * Quaternion(ix, iy, iz, r): Quaternion constructor with explicit data, may need to be explicitly normalized
 * Quaternion(q): copy
 */
constructor();
constructor(ix: number, iy: number, iz: number, r: number);
constructor(q: Quaternion);
constructor(a?: number | Quaternion, iy?: number, iz?: number, r?: number) {
	if (a === undefined) {
		this.x = 0.0;
		this.y = 0.0;
		this.z = 0.0;
		this.w = 1.0;
	}
	else if (typeof a === "number") {
		this.x = a;
		this.y = iy!;
		this.z = iz!;
		this.w = r!;
	}
	else {
		this.x = a.x;
		this.y = a.y;
		this.z = a.z;
		this.w = a.w;
	}
}

/**
 * Set this Quaternion with the values (q.x, q.y, q.z, q.w);
 * @param q the Quaternion containing the values
 */
set(q: Quaternion): void {
	this.x = q.x;
	this.y = q.y;
	this.z = q.z;
	this.w = q.w;
}

/**
 * Set this Quaternion from Euler angles, specifically the kind of euler angles
 * used by Java3d (which seems to be rotation around global x, then y, then z)
 * @param v the Vec3d containing the x,y,z angles
 */
setEuler3(v: Vec3d): void {
	// This will almost certainly be a performance bottleneck before too long
	const tmp = new Quaternion();
	this.setRotXAxis(v.x);

	tmp.setRotYAxis(v.y);
	this.mult(tmp, this);

	tmp.setRotZAxis(v.z);
	this.mult(tmp, this);
}

/**
 * Returns the Euler angles corresponding to the quaternion.
 * @return Euler angles
 */
getEuler3(): Vec3d {
	const x = this.x, y = this.y, z = this.z, w = this.w;
	const ret = new Vec3d();
	ret.x = Math.atan2(2*(w*x + y*z), 1 - 2*(x*x + y*y));
	const val = 2*(w*y - x*z);
	ret.y = -Math.PI/2 + 2*Math.atan2(Math.sqrt(1 + val), Math.sqrt(1 - val));
	ret.z = Math.atan2(2*(w*z + x*y), 1 - 2*(y*y + z*z));
	return ret;
}

/**
 * Set this Quaternion to a rotation about the X-axis.
 * @param angle the angle to rotate through
 */
setRotXAxis(angle: number): void {
	const halfAngle = 0.5 * angle;
	this.x = Math.sin(halfAngle);
	this.y = 0.0;
	this.z = 0.0;
	this.w = Math.cos(halfAngle);
}

/**
 * Set this Quaternion to a rotation about the Y-axis.
 * @param angle the angle to rotate through
 */
setRotYAxis(angle: number): void {
	const halfAngle = 0.5 * angle;
	this.x = 0.0;
	this.y = Math.sin(halfAngle);
	this.z = 0.0;
	this.w = Math.cos(halfAngle);
}

/**
 * Set this Quaternion to a rotation about the Z-axis.
 * @param angle the angle to rotate through
 */
setRotZAxis(angle: number): void {
	const halfAngle = 0.5 * angle;
	this.x = 0.0;
	this.y = 0.0;
	this.z = Math.sin(halfAngle);
	this.w = Math.cos(halfAngle);
}

/**
 * Set this Quaternion from a rotation in axis-angle form.
 * @param axis the about which to rotate
 * @param angle the angle to rotate through in radians
 */
setAxisAngle(axis: Vec3d, angle: number): void {
	const halfAngle = 0.5 * angle;
	const v = new Vec3d(axis);
	v.normalize3();
	v.scale3(Math.sin(halfAngle));

	this.x = v.x; this.y = v.y; this.z = v.z;
	this.w = Math.cos(halfAngle);
}

/**
 * Factory that returns a Quaternion that would rotate one direction into the other.
 * Only valid for vectors of the same length
 * @param from
 * @param to
 */
static transformVectors(from: Vec4d, to: Vec4d): Quaternion {

	const f = new Vec4d(from);
	const t = new Vec4d(to);

	f.normalize3();
	t.normalize3();

	const cross = new Vec4d(0.0, 0.0, 0.0, 1.0);
	cross.cross3(f, t);

	const angle = Math.asin(cross.mag3());
	cross.normalize3();

	const ret = new Quaternion();
	ret.setAxisAngle(cross, angle);
	return ret;
}

private _dot4(q1: Quaternion, q2: Quaternion): number {
	let ret: number;
	ret  = q1.x * q2.x;
	ret += q1.y * q2.y;
	ret += q1.z * q2.z;
	ret += q1.w * q2.w;
	return ret;
}

magSquared(): number {
	return this._dot4(this, this);
}

mag(): number {
	return Math.sqrt(this._dot4(this, this));
}

private _norm(q: Quaternion): void {
	let mag = this._dot4(q, q);
	if (MathUtils.isSmall(mag)) { // The quaternion is of length 0, simply return an identity
		this.x = 0.0; this.y = 0.0; this.z = 0.0; this.w = 1.0;
		return;
	}

	mag = Math.sqrt(mag);
	this.x = q.x / mag;
	this.y = q.y / mag;
	this.z = q.z / mag;
	this.w = q.w / mag;
}

add(q: Quaternion): void {
	this.x += q.x;
	this.y += q.y;
	this.z += q.z;
	this.w += q.w;
}

scale(scale: number): void {
	this.x *= scale;
	this.y *= scale;
	this.z *= scale;
	this.w *= scale;
}

/**
 * Normalize the quaternion in place
 * （q を渡したとき）Set this quaternion to the normalized value of q
 */
normalize(q?: Quaternion): void {
	this._norm(q === undefined ? this : q);
}

/**
 * Set this Quarternion to its complex conjugate
 * （q を渡したとき）Set this Quarternion to the complex conjugate of q
 */
conjugate(q?: Quaternion): void {
	if (q === undefined) {
		this.x *= -1.0;
		this.y *= -1.0;
		this.z *= -1.0;
		return;
	}
	this.x = q.x * -1.0;
	this.y = q.y * -1.0;
	this.z = q.z * -1.0;
	this.w = q.w;
}

/**
 * Quaternion multiplication, mathematically equivalent to applying both rotations in order.
 * Sets this to a*b
 * @param a
 * @param b
 */
mult(a: Quaternion, b: Quaternion): void {
	const _x = a.w*b.x + a.x*b.w + a.y*b.z - a.z*b.y;
	const _y = a.w*b.y + a.y*b.w + a.z*b.x - a.x*b.z;
	const _z = a.w*b.z + a.z*b.w + a.x*b.y - a.y*b.x;
	const _w = a.w*b.w - a.x*b.x - a.y*b.y - a.z*b.z;

	this.x = _x;
	this.y = _y;
	this.z = _z;
	this.w = _w;
}

isNormal(): boolean {
	const magSquared = this.magSquared();
	return MathUtils.near(magSquared, 1.0);
}

dot(q: Quaternion): number {
	return this._dot4(this, q);
}

/**
 * Weighted linear interpolation between quaternions when
 * weight = 1 -> res = q
 * weight = 0 -> res = this
 * @param q - the other quaternion
 * @param weight - the weight to blend with
 * @param res - the result
 */
lerp(q: Quaternion, weight: number, res: Quaternion): void {
	const weight1 = 1.0 - weight;
	res.x = this.x * weight1 + q.x * weight;
	res.y = this.y * weight1 + q.y * weight;
	res.z = this.z * weight1 + q.z * weight;
	res.w = this.w * weight1 + q.w * weight;
}

/**
 * Spherical linear interpolation between quaternions, look up slerp if you are unsure
 * weight = 1 -> res = q
 * weight = 0 -> res = this
 * @param q - the other quaternion
 * @param weight - the weight to blend with
 * @param res - the result
 */
slerp(q: Quaternion, weight: number, res: Quaternion): void {
	const cosTheta = this.dot(q);
	if (cosTheta > 0.95) { // close enough, just lerp it
		this.lerp(q, weight, res);
		res.normalize();
		return;
	}

	const theta = Math.acos(cosTheta);
	const sinTheta = Math.sin(theta);

	if (MathUtils.isSmall(sinTheta)) {
		// TODO: some kind of decent default as the two quaternions are nearly opposite
		throw new IllegalArgumentException(tr("Cannot slerp two opposite quaternions"));
	}
	const thisScale = Math.sin((1.0 - weight)*theta) / sinTheta;
	const qScale = Math.sin(weight*theta) / sinTheta;

	res.x = this.x * thisScale + q.x * qScale;
	res.y = this.y * thisScale + q.y * qScale;
	res.z = this.z * thisScale + q.z * qScale;
	res.w = this.w * thisScale + q.w * qScale;
}

equals(o: unknown): boolean {
	if (!(o instanceof Quaternion)) return false;
	const q = o;

	return q.x === this.x && q.y === this.y && q.z === this.z && q.w === this.w;
}

near(q: Quaternion): boolean {
	return MathUtils.near(this.x, q.x)
	    && MathUtils.near(this.y, q.y)
	    && MathUtils.near(this.z, q.z)
	    && MathUtils.near(this.w, q.w);
}

hashCode(): number {
	//assert false : "hashCode not designed";
	return 42; // any arbitrary constant will do
}

toString(): string
{
	return "[(" + jstr(this.x) + ", "  + jstr(this.y) + ", "  + jstr(this.z) + ")i, "  + jstr(this.w) + "]";
}

} // class Quaternion
