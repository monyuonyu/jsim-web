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
import type { Mat4d } from "./Mat4d.ts";
import { MathUtils } from "./MathUtils.ts";
import { Ray } from "./Ray.ts";
import { Transform } from "./Transform.ts";
import { Vec3d } from "./Vec3d.ts";
import { Vec4d } from "./Vec4d.ts";

export class Plane {
/**
 * The normal direction of the plane, should always be of unit length
 */
readonly normal = new Vec3d();
/**
 * The shortest distance from the plane to the origin, by normal direction (affects sign)
 */
private _dist = 0.0;

/**
 * Plane(norm, distance): Create a plane defined by a normal, and a closest distance to the origin
 * This is the storage format and similar to the common mathematical definition for a plane
 * Plane(): By default return the XY plane
 * Plane(p0, p1, p2): Create a plane defined by 3 points
 */
constructor();
constructor(norm: Vec3d | null, distance: number);
constructor(p0: Vec3d, p1: Vec3d, p2: Vec3d);
constructor(a?: Vec3d | null, b?: number | Vec3d, c?: Vec3d) {
	if (arguments.length === 0) {
		this.normal.set3(0.0, 0.0, 1.0);
		this._dist = 0.0;
		return;
	}
	if (typeof b === "number") {
		const norm = a, distance = b;
		if (norm == null) {
			this.normal.set3(0.0, 0.0, 1.0);
			this._dist = distance;
			return;
		}
		this.set(norm, distance);
		return;
	}
	this.set(a!, b!, c!);
}

/**
 * set(norm, distance) / set(p0, p1, p2)
 */
set(norm: Vec3d, distance: number): void;
set(p0: Vec3d, p1: Vec3d, p2: Vec3d): void;
set(a: Vec3d, b: number | Vec3d, c?: Vec3d): void {
	if (typeof b === "number") {
		this.normal.normalize3(a);
		this._dist = b;
		return;
	}
	const p0 = a, p1 = b, p2 = c!;
	const v0 = new Vec3d();
	v0.sub3(p1, p0);

	const v1 = new Vec3d();
	v1.sub3(p2, p1);

	this.normal.cross3(v0, v1);
	this.normal.normalize3();
	this._dist = this.normal.dot3(p0);
}

/**
 * Get the shortest distance from the plane to this point, effectively just a convenient dot product
 * @param point
 */
getNormalDist(point: Vec3d): number {
	const dot = point.dot3(this.normal);
	return dot - this._dist;
}

/**
 * transform(Transform t, Plane p): Transform plane p by the coordinate transform and store the result in 'this'
 * transform(Mat4d mat, Mat4d normalMat, Plane p): Transform plane p by the coordinate transform matrix 'mat'
 * and store the result in 'this'
 * @param mat - the Transform matrix
 * @param normalMat - the normal matrix, should be the inverse transpose of 'mat' or equal to 'mat' if there is no non-uniform scaling
 * @param p - the plane to transform
 */
transform(t: Transform, p: Plane): void;
transform(mat: Mat4d, normalMat: Mat4d, p: Plane): void;
transform(a: Transform | Mat4d, b: Plane | Mat4d, c?: Plane): void {
	if (a instanceof Transform) {
		const t = a;
		this.transform(t.getMat4dRef(), t.getMat4dRef(), b as Plane);
		return;
	}
	const mat = a, normalMat = b as Mat4d, p = c!;

	const closePoint = new Vec3d();

	// The point closest to the origin (need any point on the plane
	closePoint.scale3(p._dist, p.normal);
	// Now close point is the transformed point
	closePoint.multAndTrans3(mat, closePoint);

	this.normal.mult3(normalMat, p.normal);
	this.normal.normalize3();

	this._dist = this.normal.dot3(closePoint);

}

near(p: Plane): boolean {
	return this.normal.near3(p.normal) && MathUtils.near(this._dist, p._dist);
}

equals(o: unknown): boolean {
	if (!(o instanceof Plane)) return false;
	const p = o;
	return this.normal.equals3(p.normal) && MathUtils.near(this._dist, p._dist);
}

hashCode(): number {
	//assert false : "hashCode not designed";
	return 42; // any arbitrary constant will do
}

/**
 * Get the distance along a ray that it collides with this plane, this can return
 * infinity if the ray is parallel
 * @param r
 */
collisionDist(r: Ray): number {

	// cos = plane-Normal dot ray-direction
	const cos = -1 * this.normal.dot3(r.getDirRef());

	if (MathUtils.near(cos, 0.0)) {
		// The ray is nearly parallel to the plane, so no collision
		return Infinity;
	}

	return ( this.normal.dot3(r.getStartRef()) - this._dist ) / cos;

}

// Return the 'ray' resulting from colliding two planes, or null if the planes are parallel
collide(p: Plane): Ray | null {
	const normDot = this.normal.dot3(p.normal);
	if (MathUtils.near(normDot, 1.0) || MathUtils.near(normDot, -1.0)) {
		return null; // These planes are parallel
	}

	// Ray dir is the direction of the new ray
	const rayDir = new Vec3d();
	rayDir.cross3(this.normal, p.normal);
	rayDir.normalize3();

	// Now, we need a point on both planes, so we will find any ray in this plane and intersect it with the other
	const intDir = new Vec3d();
	intDir.cross3(rayDir, this.normal); // Take the cross of our new direction and the normal, this must be in the plane
	intDir.normalize3();
	const intStart = new Vec3d(this.normal);
	intStart.scale3(this._dist); // intStart is in this plane
	const intersectRay = new Ray(new Vec4d(intStart, 1.0),
	                             new Vec4d(intDir, 0.0));
	const intDist = p.collisionDist(intersectRay);
	const intPoint = new Vec3d(intDir);
	intPoint.scale3(intDist);
	intPoint.add3(intStart);

	return new Ray(new Vec4d(intPoint, 1.0),
	               new Vec4d(rayDir, 0.0));
}

/**
 * Returns if ray 'r' collides with the back of the plane
 * @param r
 */
backFaceCollision(r: Ray): boolean {

	return this.normal.dot3(r.getDirRef()) > 0;
}

} // class Plane
