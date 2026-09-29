/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2012 Ausenco Engineering Canada Inc.
 * Copyright (C) 2019-2026 JaamSim Software Inc.
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
import { Mat4d } from "./Mat4d.ts";
import { Plane } from "./Plane.ts";
import type { Quaternion } from "./Quaternion.ts";
import type { Ray } from "./Ray.ts";
import { Transform } from "./Transform.ts";
import { Vec3d } from "./Vec3d.ts";
import { Vec4d } from "./Vec4d.ts";

/**
 * Some handy static methods to make life easier else where
 * @author Matt Chudleigh
 *
 */
export class MathUtils {
	static readonly EPSILON = 0.000000001; // one billionth


/**
 * Test whether a double value is zero within a tolerance
 * @param a - double value to be tested
 * @return true if a == 0 within a tolerance of EPSILON
 */
static isSmall(a: number): boolean {
	return a < MathUtils.EPSILON;
}

/**
 * Compares two doubles for equality within a tolerance.
 * @param a - first double
 * @param b - second double
 * @return true if a == b within a tolerance of EPSILON
 *
 * near(double[] a, double[] b) も同じ名前で受ける（配列なら要素ごと）
 */
static near(a: number, b: number): boolean;
static near(a: number[], b: number[]): boolean;
static near(a: number | number[], b: number | number[]): boolean {
	if (typeof a === "number") {
		const diff = Math.abs(a - (b as number));
		return MathUtils.isSmall(diff);
	}
	const bb = b as number[];
	if (a.length !== bb.length)
		return false;
	for (let i = 0; i < a.length; i++) {
		if (!MathUtils.near(a[i], bb[i]))
			return false;
	}
	return true;
}

/**
 * Performs a greater-than-or-equal-to comparison of two doubles within a tolerance.
 * @param a - first double
 * @param b - second double
 * @return true if a >= b within a tolerance of EPSILON
 */
static nearGT(a: number, b: number): boolean {
	return a+MathUtils.EPSILON > b;
}

/**
 * Performs a less-than-or-equal-to comparison of two doubles within a tolerance.
 * @param a - first double
 * @param b - second double
 * @return true if a <= b within a tolerance of EPSILON
 */
static nearLT(a: number, b: number): boolean {
	return a < b+MathUtils.EPSILON;
}

/**
 * Performs a greater-than comparison of two doubles within a tolerance.
 * @param a - first double
 * @param b - second double
 * @return true if a > b within a tolerance of EPSILON
 */
static strictGT(a: number, b: number): boolean {
	return !MathUtils.nearLT(a,b);
}

/**
 * Performs a less-than comparison of two doubles within a tolerance.
 * @param a - first double
 * @param b - second double
 * @return true if a < b within a tolerance of EPSILON
 */
static strictLT(a: number, b: number): boolean {
	return !MathUtils.nearGT(a,b);
}

/**
 * Checks for line segment overlap
 * （fudge を渡したとき）Checks for line segment overlap, with a fudge factor
 * @param a0
 * @param a1
 * @param b0
 * @param b1
 * @param fudge - The fudge factor to allow
 */
static segOverlap(a0: number, a1: number, b0: number, b1: number, fudge?: number): boolean {
	if (fudge === undefined) {
		if (a0 === b0) return true;

		if (a0 < b0) {
			return b0 <= a1;
		}
		return a0 <= b1;
	}
	if (a0 === b0) return true;

	if (a0 < b0) {
		return b0 <= a1 + fudge;
	}
	return a0 <= b1 + fudge;
}

/**
 * Perform a bounds check on val, returns something in the range [min, max]
 * @param val
 * @param min
 * @param max
 */
static bound(val: number, min: number, max: number): number {
	//assert(min <= max);

	if (val < min) { return min; }
	if (val > max) { return max; }
	return val;
}

static vecDistSq3(a: Vec3d, b: Vec3d): number {
	const dx = a.x - b.x;
	const dy = a.y - b.y;
	const dz = a.z - b.z;
	return dx*dx + dy*dy + dz*dz;
}

/**
 * Return a matrix that rotates points and projects them onto the ray's view plane.
 * IE: the new coordinate system has the ray pointing in the +Z direction from the origin.
 * This is useful for ray-line collisions and ray-point collisions
 */
static RaySpace(r: Ray): Mat4d {

	// Create a new orthonormal basis starting with the y-axis, if the ray is
	// nearly parallel to Y, build our new basis from X instead
	const t = new Vec3d(0.0, 1.0, 0.0);
	const dist = Math.abs(t.dot3(r.getDirRef()));
	if (MathUtils.near(dist, 1.0))
		t.set3(1.0, 0.0, 0.0);

	const ret = new Mat4d();

	// Calculate a new basis to populate the rows of the return matrix
	t.cross3(r.getDirRef(), t);
	t.normalize3();
	ret.d00 = t.x; ret.d01 = t.y; ret.d02 = t.z;

	t.cross3(r.getDirRef(), t);
	t.normalize3();
	ret.d10 = t.x; ret.d11 = t.y; ret.d12 = t.z;

	t.set3(r.getDirRef());
	ret.d20 = t.x; ret.d21 = t.y; ret.d22 = t.z;

	// Now use this rotation matrix to calculate the rotated translation part
	t.mult3(ret, r.getStartRef());
	ret.d03 = -t.x; ret.d13 = -t.y; ret.d23 = -t.z;

	return ret;
}

/**
 * Returns a Transform representing a rotation around a non-origin point
 * @param rot - the rotation (in world coordinates) to apply
 * @param point - the point to rotate around
 */
static rotateAroundPoint(rot: Quaternion, point: Vec3d): Mat4d {
	const negPoint = new Vec3d(point);
	negPoint.scale3(-1);

	const ret = new Transform(point, rot, 1);
	ret.merge(ret, new Transform(negPoint));

	return ret.getMat4dRef();
}

/**
 * Java には Vec3d[] と List<Vec3d> の 2 つがあるが、TS ではどちらも配列なので 1 つにした。
 * 配列の版は new Plane(p0, p1, p2)、List の版は new Plane() の後に set(p0, p1, p2) だが、
 * Plane(p0, p1, p2) も中で set を呼ぶだけなので、結果は同じ。
 */
static collisionDistPoly(r: Ray, points: Vec3d[]): number {
	if (points.length < 3) {
		return -1; // Should this be an error?
	}
	// Check that this is actually inside the polygon, this assumes the points are co-planar
	const p = new Plane(points[0], points[1], points[2]);
	const dist = p.collisionDist(r);

	if (dist < 0) { return dist; } // Behind the start of the ray

	// This is the potential collision point, if it's inside the polygon
	const collisionPoint = r.getPointAtDist(dist);

	const a = new Vec3d();
	const b = new Vec3d();
	const cross = new Vec3d();
	let firstPos = false;

	for (let i = 0; i < points.length; ++i) {
		// Check that the collision point is on the same winding side of all the
		const p0 = points[i];
		const p1 = points[(i + 1) % points.length];
		a.sub3(p0, collisionPoint);
		b.sub3(p1, p0);
		cross.cross3(a, b);

		const triple = cross.dot3(r.getDirRef());
		// This point is inside the polygon if all triple products have the same sign
		if (i === 0) {
			// First iteration sets the sign
			firstPos = triple > 0;
		}

		if (firstPos !== (triple > 0)) {
			return -1;
		}
	}
	return dist; // This must be valid then

}

/**
 * Determine line collision
 * @param rayMat - the rayspace matrix
 * @param lines - pairs of vertices, each pair defining a line segment (this is not a line strip or line loop)
 * @param collisionAngle - the angle of the collision cone in radians
 */
static collisionDistLines(rayMat: Mat4d, lines: Vec4d[], collisionAngle: number): number {
	// 描画: 省略（three.js の画面を作るときに）
	// TODO(移植): RenderUtils.rayClosePoint（com.jaamsim.render）を使うので移していない。画面での選び取りにだけ使う。常に「当たり無し」(-1) を返す
	// 元の Java（RenderUtils を移したら戻す）:
	// double shortDist = Double.POSITIVE_INFINITY;
	// for (int i = 0; i < lines.length; i+=2) {
	// 	Vec4d nearPoint = RenderUtils.rayClosePoint(rayMat, lines[i], lines[i+1]);
	// 	Vec4d raySpaceNear = new Vec4d(0.0d, 0.0d, 0.0d, 1.0d);
	// 	raySpaceNear.mult4(rayMat, nearPoint);
	// 	double angle = Math.atan2(raySpaceNear.mag2(), raySpaceNear.z);
	// 	if (angle >= 0.0d && angle < collisionAngle && raySpaceNear.z < shortDist) {
	// 		shortDist = raySpaceNear.z;
	// 	}
	// }
	// if (shortDist == Double.POSITIVE_INFINITY) {
	// 	return -1; // No collision
	// }
	// return shortDist;
	void rayMat; void lines; void collisionAngle;
	return -1; // No collision
}

/**
 * Get the point where 3 planes intersect, or null if any are parallel
 * @param p0
 * @param p1
 * @param p2
 */
static collidePlanes(p0: Plane, p1: Plane, p2: Plane): Vec3d | null {
	const r = p0.collide(p1);
	if (r == null)
		return null;

		const dist = p2.collisionDist(r);
	if (dist === Infinity || dist === -Infinity)
		return null;

	const ret = new Vec3d(r.getDirRef());
	ret.scale3(dist);
	ret.add3(r.getStartRef());
	return ret;
}

static getMidpointPlane(p0: Vec3d, p1: Vec3d): Plane {
	const mid = new Vec3d(p0);
	mid.add3(p1);
	mid.scale3(0.5);

	const normal =  new Vec4d(p1, 0);
	normal.sub3(p0);
	normal.normalize3();

	const dist = normal.dot3(mid);

	return new Plane(normal, dist);
}

} // class
