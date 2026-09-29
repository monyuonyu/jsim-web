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
import { Plane } from "../internal.ts";
import { Vec3d } from "../internal.ts";

/**
 * A simple geometric representation of a sphere. Internally is just a point and radius
 * @author Matt.Chudleigh
 *
 */
export class Sphere {

readonly center: Vec3d;
radius: number;

constructor(center: Vec3d, radius: number) {
	this.center = new Vec3d(center);
	this.radius = radius;
}

/**
 * getDistance(Vec3d point) / getDistance(Sphere s) / getDistance(Plane p)
 */
getDistance(point: Vec3d): number;
getDistance(s: Sphere): number;
getDistance(p: Plane): number;
getDistance(a: Vec3d | Sphere | Plane): number {
	if (a instanceof Sphere) {
		const s = a;
		const diff = new Vec3d();
		diff.sub3(this.center, s.center);
		const dist = diff.mag3();

		return dist - this.radius - s.radius;
	}
	if (a instanceof Plane) {
		const p = a;
		const dist = p.getNormalDist(this.center);
		return dist - this.radius;
	}
	const point = a;
	const diff = new Vec3d();
	diff.sub3(this.center, point);

	const dist = diff.mag3();
	return dist - this.radius;
}
}
