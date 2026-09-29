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
import { Transform } from "../internal.ts";
import { Vec3d } from "../internal.ts";
import { Vec4d } from "../internal.ts";

/**
 * A simple representation of a Ray in 3 space. Like all rays, it's a position and direction.
 * @author Matt Chudleigh
 *
 */
export class Ray {

	private _start: Vec4d;
	private _direction: Vec4d;

	constructor();
	constructor(start: Vec4d, dir: Vec4d);
	constructor(start?: Vec4d, dir?: Vec4d) {
		if (start === undefined) {
			this._start = new Vec4d(0, 0, 0, 1.0);
			this._direction = new Vec4d(1, 0 ,0, 0);
			return;
		}
		this._start = new Vec4d(start);
		this._direction = new Vec4d(dir!);
		this._direction.normalize3();
		this._direction.w = 0; // Direction is a direction...
	}

	getStartRef(): Vec4d {
		return this._start;
	}

	getDirRef(): Vec4d {
		return this._direction;
	}

	/**
	 * transform(Transform trans): Returns a new Ray as though this was passed through the Transform trans
	 * transform(Mat4d mat): Returns a new Ray as though this was passed through the Matrix mat
	 */
	transform(trans: Transform): Ray;
	transform(mat: Mat4d): Ray;
	transform(a: Transform | Mat4d): Ray {
		if (a instanceof Transform) {
			return this.transform(a.getMat4dRef());
		}
		const mat = a;
		const startTransed = new Vec4d(0.0, 0.0, 0.0, 1.0);
		startTransed.mult4(mat, this._start);

		const dirTransed = new Vec4d(0.0, 0.0, 0.0, 1.0);
		dirTransed.mult4(mat, this._direction);
		dirTransed.normalize3();

		return new Ray(startTransed, dirTransed);
	}

	/**
	 * Returns a new vector4d representing the point 'dist' distance along this ray
	 * @param dist
	 */
	getPointAtDist(dist: number): Vec3d {
		const ret = new Vec3d(this._direction);
		ret.scale3(dist);
		ret.add3(this._start);
		return ret;
	}

	/**
	 * Returns the distance along the ray to the point on the ray closest to given point, this
	 * can be negative if the point given is effectively behind the ray
	 * @param point
	 */
	getDistAlongRay(point: Vec3d): number {
		const diff = new Vec3d(point);
		diff.sub3(this._start);
		return diff.dot3(this._direction);
	}

	toString(): string {
		return "Orig: " + this._start.toString() + " Dir: " + this._direction.toString();
	}
}
