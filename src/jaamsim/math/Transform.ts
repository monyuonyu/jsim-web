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
import { Mat4d } from "./Mat4d.ts";
import { MathUtils } from "./MathUtils.ts";
import { Quaternion } from "./Quaternion.ts";
import { Vec3d } from "./Vec3d.ts";
import type { Vec4d } from "./Vec4d.ts";

/**
 * The Transform class represents a linear transform consisting of a rotation, scale and translation
 * in 3-space. Internally it stores all 3 as discrete transforms but allows for arbitrary transforms to be chained,
 * collapsed and inverted. The primary limitation is it only allows for uniform (isotropic) scaling
 * @author Matt Chudleigh
 *
 */
export class Transform {

private readonly _rot: Quaternion;
private readonly _trans: Vec3d;
private _scale: number;
private readonly _mat4d = new Mat4d();
private _matrixDirty: boolean;

/*
 * Static Identity transform（Java は static final のフィールド）。
 * 移植の注意: クラスを読み込んだ時点で new Transform() すると、読み込みの輪の途中で
 * Vec3d・Quaternion がまだ無い誤りになりうるので、最初に使われたときに作る。
 */
private static _ident: Transform | null = null;
static get ident(): Transform {
	if (Transform._ident === null)
		Transform._ident = new Transform();
	return Transform._ident;
}

/**
 * Transform(): identity
 * Transform(t): copy
 * Transform(trans, rot, scale)
 * Transform(trans): this(trans, null, 1.0d)
 */
constructor();
constructor(t: Transform);
constructor(trans: Vec3d | null, rot: Quaternion | null, scale: number);
constructor(trans: Vec3d | null);
constructor(a?: Transform | Vec3d | null, rot?: Quaternion | null, scale?: number) {
	if (arguments.length === 0) {
		this._trans = new Vec3d();
		this._rot = new Quaternion(); // Identity
		this._scale = 1;
		this._matrixDirty = false;
		return;
	}
	if (a instanceof Transform) {
		const t = a;
		this._trans = new Vec3d(t._trans);
		this._rot = new Quaternion(t._rot);
		this._scale = t._scale;
		this._matrixDirty = true;
		return;
	}
	if (arguments.length === 1) {
		// this(trans, null, 1.0d)
		rot = null;
		scale = 1.0;
	}
	const trans = a as Vec3d | null;
	if (trans == null)
		this._trans = new Vec3d();
	else
		this._trans = new Vec3d(trans);

	if (rot == null)
		this._rot = new Quaternion();
	else
		this._rot = new Quaternion(rot);
	this._scale = scale!;
	this._matrixDirty = true;
}

copyFrom(t: Transform): void {
	this._trans.set3(t._trans);
	this._rot.set(t._rot);
	this._scale = t._scale;

	if (!t._matrixDirty) {
		this._mat4d.set4(t._mat4d);
	}
	this._matrixDirty = t._matrixDirty;
}

setTrans(trans: Vec3d): void {
	if (this._trans.equals3(trans)) {
		return;
	}
	this._trans.set3(trans);
	this._matrixDirty = true;
}

setRot(q: Quaternion): void {
	if (this._rot.equals(q)) {
		return;
	}
	this._rot.set(q);
	this._matrixDirty = true;
}

setScale(s: number): void {
	if (MathUtils.near(this._scale, s)) {
		return;
	}
	this._scale = s;
	this._matrixDirty = true;
}

getRot(out: Quaternion): void {
	out.set(this._rot);
}

getRotRef(): Quaternion {
	return this._rot;
}

getTransRef(): Vec3d {
	return this._trans;
}

getScale(): number {
	return this._scale;
}

/**
 * Calculated the 4x4 matrix corresponding to this transform
 * @param out - the 4x4 matrix
 */
getMat4d(out: Mat4d): void {
	if (this._matrixDirty) {
		this.updateMatrix();
	}

	out.set4(this._mat4d);

}

getMat4dRef(): Mat4d {
	if (this._matrixDirty) {
		this.updateMatrix();
	}

	return this._mat4d;
}


private updateMatrix(): void {
	// assert(!Double.isNaN(_trans.x)); など（Java の assert は既定で無効）

	this._mat4d.setRot4(this._rot);
	this._mat4d.setTranslate3(this._trans);
	this._mat4d.scale3(this._scale);

	this._matrixDirty = false;

}

/**
 * Populates a transform that is the merging of this and 'rhs'
 * The matrix from this new transform will be the same as if the matrices of both transforms
 * were multiplied (see the unit tests)
 * @param a - the right hand matrix to merge with
 * @param b
 */
merge(a: Transform, b: Transform): void {
	const temp = new Vec3d(a._trans);

	const rotTemp = new Mat4d();
	rotTemp.setRot3(a._rot);

	this._trans.mult3(rotTemp, b._trans);
	this._trans.scale3(a._scale);

	this._trans.add3(temp);
	this._matrixDirty = true;

	this._rot.mult(a._rot, b._rot);

	this._scale = a._scale * b._scale;

}

/**
 * Apply this transform to a vector
 * @param vect - the vector to transform
 * @param out - the transformed vector
 */
apply(vect: Vec4d, out: Vec4d): void {
	if (this._matrixDirty) {
		this.updateMatrix();
	}

	out.mult4(this._mat4d, vect);
}

multAndTrans(vect: Vec3d, out: Vec3d): void {
	if (this._matrixDirty) {
		this.updateMatrix();
	}

	out.multAndTrans3(this._mat4d, vect);
}

/**
 * Returns a transform that is the inverse of this transform, merging the two in any order will
 * result in the identity transform
 * @param out
 */
inverse(out: Transform): void {
	out._scale = 1/this._scale;
	out._rot.conjugate(this._rot);

	out._trans.set3(this._trans);
	out._trans.scale3(-out._scale);

	const rotTemp = new Mat4d();
	rotTemp.setRot3(out._rot);
	out._trans.mult3(rotTemp, out._trans);

	out._matrixDirty = true;
}

equals(o: unknown): boolean {
	if (!(o instanceof Transform)) return false;
	const t = o;

	return this._trans.equals3(t._trans) && this._rot.equals(t._rot) && MathUtils.near(this._scale, t._scale);
}

near(t: Transform): boolean {
	return this._trans.near3(t._trans) && this._rot.equals(t._rot) && MathUtils.near(this._scale, t._scale);
}

hashCode(): number {
	//assert false : "hashCode not designed";
	return 42; // any arbitrary constant will do
}

toString(): string
{
	return "T: " + this._trans.toString() + " R: " + this._rot.toString() + " S: " + jstr(this._scale);
}

} // class
