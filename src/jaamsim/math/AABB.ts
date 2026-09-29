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
import { MathUtils } from "../internal.ts";
import { Plane } from "../internal.ts";
import type { Ray } from "./Ray.ts";
import { isMat4d } from "../internal.ts";
import { Vec3d } from "../internal.ts";
import { Vec4d } from "../internal.ts";

/*
 * 入れ子の enum PlaneTestResult は、このファイルの AABB_PlaneTestResult にし、AABB.PlaneTestResult からも引けるようにした。
 */
export enum AABB_PlaneTestResult {
	COLLIDES = "COLLIDES", POSITIVE = "POSITIVE", NEGATIVE = "NEGATIVE", EMPTY = "EMPTY",
}

/**
 * AABB (or Axis Aligned Bounding Box) is a coarse level culling
 * @author Matt.Chudleigh
 *
 */
export class AABB {

	static readonly PlaneTestResult = AABB_PlaneTestResult;

	private _isEmpty = false;

	/** The most positive point (MaxX, MaxY, MaxZ) */
	readonly maxPt = new Vec3d();

	/** The most negative point (MinX, MinY, MinZ) */
	readonly minPt = new Vec3d();

	readonly center = new Vec3d();
	readonly radius = new Vec3d();

	/**
	 * AABB(): empty
	 * AABB(AABB other): Copy constructor for defensive copies
	 * AABB(Vec3d posPoint, Vec3d negPoint)
	 * AABB(List points, double fudge): Build an AABB with an expanded area
	 * AABB(List points): Build an AABB that contains all the supplied points
	 * AABB(List points, Mat4d trans): Build an AABB that contains all the supplied points, transformed by trans
	 */
	constructor();
	constructor(other: AABB);
	constructor(posPoint: Vec3d, negPoint: Vec3d);
	constructor(points: Vec3d[], fudge: number);
	constructor(points: Vec3d[]);
	constructor(points: Vec3d[], trans: Mat4d);
	constructor(a?: AABB | Vec3d | Vec3d[], b?: Vec3d | number | Mat4d) {
		if (a === undefined) {
			this._isEmpty = true;
			return;
		}
		if (a instanceof AABB) {
			const other = a;
			this._isEmpty = other._isEmpty;
			this.minPt.set3(other.minPt);
			this.maxPt.set3(other.maxPt);

			this.updateCenterAndRadius();
			return;
		}
		if (!Array.isArray(a)) {
			const posPoint = a, negPoint = b as Vec3d;
			this.maxPt.set3(posPoint);
			this.minPt.set3(negPoint);

			this.updateCenterAndRadius();
			return;
		}
		const points = a;
		if (typeof b === "number") {
			const fudge = b;
			this.initFromPoints(points);  // this(points)
			this.maxPt.x += fudge;
			this.maxPt.y += fudge;
			this.maxPt.z += fudge;

			this.minPt.x -= fudge;
			this.minPt.y -= fudge;
			this.minPt.z -= fudge;

			this.updateCenterAndRadius();
			return;
		}
		if (isMat4d(b)) {
			const trans = b;
			if (points.length === 0) {
				this._isEmpty = true;
				return;
			}

			const p = new Vec3d();
			p.multAndTrans3(trans, points[0]);

			this.maxPt.set3(p);
			this.minPt.set3(p);
			for (const p_orig of points) {
				p.multAndTrans3(trans, p_orig);
				this.maxPt.max3(p);
				this.minPt.min3(p);
			}

			this.updateCenterAndRadius();
			return;
		}
		this.initFromPoints(points);
	}

	/** AABB(List<? extends Vec3d> points) の中身 */
	private initFromPoints(points: Vec3d[]): void {
		if (points.length === 0) {
			this._isEmpty = true;
			return;
		}

		this.maxPt.set3(points[0]);
		this.minPt.set3(points[0]);
		for (const p of points) {
			this.maxPt.max3(p);
			this.minPt.min3(p);
		}

		this.updateCenterAndRadius();

	}

	/**
	 * collides(Vec3d point, double fudge): Check collision, but allow for a fudge factor on the AABB
	 * collides(Vec3d point)
	 * collides(AABB other)
	 * collides(AABB other, double fudge): Check collision, but allow for a fudge factor on the AABB
	 */
	collides(point: Vec3d, fudge?: number): boolean;
	collides(other: AABB, fudge?: number): boolean;
	collides(a: Vec3d | AABB, fudge: number = 0): boolean {
		if (a instanceof AABB) {
			const other = a;
			if (this._isEmpty || other._isEmpty) {
				return false;
			}

			const bX = MathUtils.segOverlap(this.minPt.x, this.maxPt.x, other.minPt.x, other.maxPt.x, fudge);
			const bY = MathUtils.segOverlap(this.minPt.y, this.maxPt.y, other.minPt.y, other.maxPt.y, fudge);
			const bZ = MathUtils.segOverlap(this.minPt.z, this.maxPt.z, other.minPt.z, other.maxPt.z, fudge);
			return bX && bY && bZ;
		}
		const point = a;
		if (this._isEmpty) {
			return false;
		}

		const bX = point.x > this.minPt.x - fudge && point.x < this.maxPt.x + fudge;
		const bY = point.y > this.minPt.y - fudge && point.y < this.maxPt.y + fudge;
		const bZ = point.z > this.minPt.z - fudge && point.z < this.maxPt.z + fudge;
		return bX && bY && bZ;
	}

	setComp(v: Vec4d, i: number, val: number): void {
		if (i === 0) { v.x = val; return; }
		if (i === 1) { v.y = val; return; }
		if (i === 2) { v.z = val; return; }
		if (i === 3) { v.w = val; return; }
		// assert(false);（Java の assert は既定で無効）
		return ;
	}

	private getComp(v: Vec3d, i: number): number {
		if (i === 0) return v.x;
		if (i === 1) return v.y;
		if (i === 2) return v.z;
		// assert(false);
		return 0;
	}

	/**
	 * Get the distance that this ray collides with the AABB, a negative number indicates no collision
	 * @param r
	 */
	collisionDist(r: Ray, fudge: number = 0): number {
		if (this._isEmpty) {
			return -1;
		}

		if (this.collides(r.getStartRef(), fudge)) {
			return 0.0; // The ray starts in the AABB
		}

		const rayDir = r.getDirRef();
		// Iterate over the 3 axes
		for (let axis = 0; axis < 3; ++axis) {
			if (MathUtils.near(this.getComp(rayDir, axis), 0)) {
				continue; // The ray is parallel to the box in this axis
			}

			const faceNorm = new Vec4d(0.0, 0.0, 0.0, 1.0);
			let faceDist = 0;
			if (this.getComp(rayDir, axis) > 0) {
				// Collides with the negative face
				this.setComp(faceNorm, axis, -1.0);
				faceDist = -this.getComp(this.minPt, axis) - fudge;
			} else {
				this.setComp(faceNorm, axis, 1.0);
				faceDist = this.getComp(this.maxPt, axis) + fudge;
			}

			const facePlane = new Plane(faceNorm, faceDist);

			// Get the distance along the ray the ray collides with the plane
			const rayCollisionDist = facePlane.collisionDist(r);
			if (rayCollisionDist === Infinity || rayCollisionDist === -Infinity) {
				continue; // Parallel (but we should have already tested for this)
			}
			if (rayCollisionDist < 0) {
				// Behind the ray
				continue;
			}


			// Finally check if the collision point is actually inside the face we are testing against
			const a1 = (axis + 1) % 3;
			const a2 = (axis + 2) % 3;

			// Figure out the point of contact
			const contactPoint = r.getPointAtDist(rayCollisionDist);

			if (this.getComp(contactPoint, a1) < this.getComp(this.minPt, a1) - fudge ||
			    this.getComp(contactPoint, a1) > this.getComp(this.maxPt, a1) + fudge) {
				continue; // No contact
			}

			if (this.getComp(contactPoint, a2) < this.getComp(this.minPt, a2) - fudge ||
			    this.getComp(contactPoint, a2) > this.getComp(this.maxPt, a2) + fudge) {
				continue; // No contact
			}
			// Collision!
			return rayCollisionDist;
		}

		return -1.0;
	}

	private updateCenterAndRadius(): void {
		this.center.add3(this.maxPt, this.minPt);
		this.center.scale3(0.5);

		this.radius.sub3(this.maxPt, this.minPt);
		this.radius.scale3(0.5);
	}

	isEmpty(): boolean {
		return this._isEmpty;
	}

	/**
	 * Is the AABB completely on one side of this plane, or colliding?
	 * @param p
	 */
	testToPlane(p: Plane): AABB_PlaneTestResult {
		if (this._isEmpty) {
			return AABB_PlaneTestResult.EMPTY;
		}

		// Make sure the radius points in the same direction of the normal
		let effectiveRadius = 0.0;
		effectiveRadius += this.radius.x * Math.abs(p.normal.x);
		effectiveRadius += this.radius.y * Math.abs(p.normal.y);
		effectiveRadius += this.radius.z * Math.abs(p.normal.z);

		const centerDist = p.getNormalDist(this.center);
		// If the effective radius is greater than the distance to the center, we're good
		if (centerDist > effectiveRadius) {
			return AABB_PlaneTestResult.POSITIVE;
		}

		if (centerDist < -effectiveRadius) {
			// Complete
			return AABB_PlaneTestResult.NEGATIVE;
		}

		return AABB_PlaneTestResult.COLLIDES;
	}
}
