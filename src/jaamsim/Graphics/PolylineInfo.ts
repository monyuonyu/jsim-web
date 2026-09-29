/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2015 Ausenco Engineering Canada Inc.
 * Copyright (C) 2019-2023 JaamSim Software Inc.
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
import { ErrorException } from "../internal.ts";
import { Double } from "../internal.ts";
import type { Color4d } from "../math/Color4d.ts";
import { MathUtils } from "../internal.ts";
import { Plane } from "../internal.ts";
import { Vec3d } from "../internal.ts";
import { jint, jListEquals } from "../internal.ts";

/*
 * 移植の注意:
 * - 入れ子の enum PolylineInfo.CurveType は、このファイルの enum PolylineInfo_CurveType にし、
 *   PolylineInfo.CurveType（static）からも引けるようにした。値は名前と同じ文字列（name() と同じ）。
 * - Arrays.binarySearch(double[], key) は、同じ手順の binarySearch をこのファイルに書いた
 *   （同じ値が並ぶときに、どれを見つけるかまで Java と同じにするため）。
 */

export enum PolylineInfo_CurveType {
	LINEAR = "LINEAR",
	BEZIER = "BEZIER",
	SPLINE = "SPLINE",
	CIRCULAR_ARC = "CIRCULAR_ARC",
}

/** java.util.Arrays.binarySearch(double[], double) と同じ手順 */
function binarySearch(a: number[], key: number): number {
	let low = 0;
	let high = a.length - 1;
	while (low <= high) {
		const mid = (low + high) >>> 1;
		const midVal = a[mid];
		if (midVal < key)
			low = mid + 1;
		else if (midVal > key)
			high = mid - 1;
		else {
			// -0.0 と 0.0、NaN の扱い（Double.doubleToLongBits の比べ方と同じ）
			const c = Double.compare(midVal, key);
			if (c === 0)
				return mid;
			else if (c < 0)
				low = mid + 1;
			else
				high = mid - 1;
		}
	}
	return -(low + 1);
}

export class PolylineInfo {
	static readonly CurveType = PolylineInfo_CurveType;

	private readonly curvePoints: Vec3d[];
	private readonly color: Color4d | null;
	private readonly width: number; // Line width in pixels
	private readonly polylineWidth: number; // Line width in metres

	constructor(pts: Vec3d[], col: Color4d | null, w: number, pw: number) {
		this.color = col;
		this.width = w;
		this.polylineWidth = pw;
		this.curvePoints = pts;
	}

	equals(o: unknown): boolean {
		if (o === this) return true;
		if (!(o instanceof PolylineInfo)) return false;

		const pi = o;

		return this.curvePoints !== null && jListEquals(this.curvePoints, pi.curvePoints)
		       && this.color !== null && this.color.equals(pi.color)
		       && this.width === pi.width
		       && this.polylineWidth === pi.polylineWidth;
	}

	getCurvePoints(): Vec3d[] {
		return this.curvePoints;
	}

	getColor(): Color4d | null {
		return this.color;
	}

	getWidth(): number {
		return this.width;
	}

	getPolylineWidth(): number {
		return this.polylineWidth;
	}

	toString(): string {
		// ArrayList.toString の形
		return "[" + this.curvePoints.map(p => String(p)).join(", ") + "]";
	}

	static getBezierPoints(ps: Vec3d[]): Vec3d[] {
		const ret: Vec3d[] = [];

		// The total number of segments in this curve
		const NUM_POINTS = 32;

		const tInc = 1.0/NUM_POINTS;
		for (let i = 0; i < NUM_POINTS; ++i) {
			ret.push(PolylineInfo.solveBezier(i*tInc, 0, ps.length-1, ps));
		}
		ret.push(ps[ps.length-1]);
		return ret;
	}

	static getSplinePoints(ps: Vec3d[]): Vec3d[] {
		// This spline fitting algorithm is a bit of a custom creation. It is loosely based on the finte differences method described
		// in this article: https://en.wikipedia.org/wiki/Cubic_Hermite_spline (assuming it hasn't changed since).
		// The major changes are:
		// * All segments are solved in Bezier form (this is more stylist than a change in algorithm)
		// * The end two segments are quadratic Bezier curves (not cubic) and as such the end tangent is un-constrained.
		// * The internal control points are scaled down proportional to segment length to avoid kinks and self intersection within a segment

		// If there's too few points, just return the existing line
		if (ps.length <= 2) {
			return ps;
		}

		// The number of segments between each control point
		const NUM_SEGMENTS = 16;

		const temp = new Vec3d();

		// Generate tangents for internal points only
		const tangents: Vec3d[] = [];
		for (let i = 1; i < ps.length-1; ++i) {
			const pMin = ps[i-1];
			const p = ps[i];
			const pPlus = ps[i+1];

			temp.sub3(p, pMin);
			const l0 = temp.mag3();

			temp.sub3(p, pPlus);
			const l1 = temp.mag3();

			const tan = new Vec3d();
			tan.sub3(pPlus, pMin);
			tan.scale3(1.0/(l0 + l1));
			tangents.push(tan);
		}

		const tInc = 1.0/NUM_SEGMENTS;

		const ret: Vec3d[] = [];

		const scaledTanTemp = new Vec3d();
		const segDiffTemp = new Vec3d();

		// Start with a quadratic segment
		{
			const p0 = ps[0];
			const p1 = ps[1];

			segDiffTemp.sub3(p0, p1);
			const segLength = segDiffTemp.mag3();

			const c = new Vec3d(p1);
			scaledTanTemp.scale3(segLength/2.0, tangents[0]);
			c.sub3(scaledTanTemp);

			for (let t = 0; t < NUM_SEGMENTS; ++t) {
				const curvePoint = PolylineInfo.solveQuadraticBezier(t*tInc, p0, p1, c);
				ret.push(curvePoint);
			}
		}

		// Internal segments are cubic
		for (let i = 2; i < ps.length-1; ++i) {
			const p0 = ps[i-1];
			const p1 = ps[i];

			segDiffTemp.sub3(p0, p1);
			const segLength = segDiffTemp.mag3();

			const c0 = new Vec3d(p0);
			scaledTanTemp.scale3(segLength/3.0, tangents[i-2]);
			c0.add3(scaledTanTemp);

			const c1 = new Vec3d(p1);
			scaledTanTemp.scale3(segLength/3.0, tangents[i-1]);
			c1.sub3(scaledTanTemp);

			for (let t = 0; t < NUM_SEGMENTS; ++t) {
				const curvePoint = PolylineInfo.solveCubicBezier(t*tInc, p0, p1, c0, c1);
				ret.push(curvePoint);
			}
		}

		// End with another quadratic segment
		{
			const p0 = ps[ps.length-2];
			const p1 = ps[ps.length-1];

			segDiffTemp.sub3(p0, p1);
			const segLength = segDiffTemp.mag3();

			const c = new Vec3d(p0);
			scaledTanTemp.scale3(segLength/2.0, tangents[tangents.length-1]);
			c.add3(scaledTanTemp);

			for (let t = 0; t < NUM_SEGMENTS; ++t) {
				const curvePoint = PolylineInfo.solveQuadraticBezier(t*tInc, p0, p1, c);
				ret.push(curvePoint);
			}
		}

		ret.push(ps[ps.length-1]);

		return ret;
	}

	static getCircularArcPoints(ps: Vec3d[]): Vec3d[] {
		if (ps.length <= 2) {
			return ps;
		}

		const start = new Vec3d(ps[0]);
		const mid = new Vec3d(ps[1]);
		const end = new Vec3d(ps[ps.length-1]);

		const circlePlane = new Plane(start, mid, end);
		const midPlane0 = MathUtils.getMidpointPlane(start, mid);
		const midPlane1 = MathUtils.getMidpointPlane(mid, end);
		const center = MathUtils.collidePlanes(circlePlane, midPlane0, midPlane1);
		if (center === null) {
			return ps;
		}

		const temp = new Vec3d(center);
		temp.sub3(start);
		const radius = temp.mag3();

		// Create the two orthogonal components of our circle (the equivalent of x and y)
		const xComp = new Vec3d(start);
		xComp.sub3(center);

		const yComp = new Vec3d();
		yComp.cross3(circlePlane.normal, xComp);
		yComp.normalize3();
		yComp.scale3(radius);

		// Find the end arc value
		temp.sub3(end, center);
		const xVal = temp.dot3(xComp);
		const yVal = temp.dot3(yComp);
		let arcAngle = Math.atan2(yVal, xVal);
		if (arcAngle < 0) {
			arcAngle += 2*Math.PI;
		}

		// Find the number of segments to draw, 60 for a full circle
		let numSegments = jint(arcAngle*60/(2*Math.PI));
		if (numSegments < 2)
			numSegments = 2;

		// Build the arc
		const ret: Vec3d[] = [];
		for (let i = 0; i <= numSegments; ++i) {
			const theta = arcAngle*i/numSegments;

			const point = new Vec3d(center);

			temp.scale3(Math.cos(theta), xComp);
			point.add3(temp);

			temp.scale3(Math.sin(theta), yComp);
			point.add3(temp);

			ret.push(point);
		}
		return ret;
	}


	// Solve a generic bezier with arbitrary control points
	private static solveBezier(t: number, start: number, end: number, controls: Vec3d[]): Vec3d {
		// Termination case
		if (start === end) {
			return new Vec3d(controls[start]);
		}
		const a = PolylineInfo.solveBezier(t, start, end-1, controls);
		const b = PolylineInfo.solveBezier(t, start+1, end, controls);

		a.scale3(1-t);
		b.scale3(t);
		a.add3(b);

		return a;
	}

	// Solve a cubic bezier with explicit control points
	private static solveCubicBezier(s: number, p0: Vec3d, p1: Vec3d, c0: Vec3d, c1: Vec3d): Vec3d {

		const oneMinS = 1 - s;
		const coeffP0 = oneMinS*oneMinS*oneMinS;
		const coeffC0 = 3*s*oneMinS*oneMinS;
		const coeffC1 = 3*s*s*oneMinS;
		const coeffP1 = s*s*s;

		const lp0 = new Vec3d(p0);
		lp0.scale3(coeffP0);

		const lp1 = new Vec3d(p1);
		lp1.scale3(coeffP1);

		const lc0 = new Vec3d(c0);
		lc0.scale3(coeffC0);

		const lc1 = new Vec3d(c1);
		lc1.scale3(coeffC1);

		const ret = new Vec3d();
		ret.add3(lp0);
		ret.add3(lp1);
		ret.add3(lc0);
		ret.add3(lc1);

		return ret;
	}

	// Solve a quadratic bezier with an explicit control point
	private static solveQuadraticBezier(s: number, p0: Vec3d, p1: Vec3d, c: Vec3d): Vec3d {

		const oneMinS = 1 - s;

		const coeffP0 = oneMinS*oneMinS;
		const coeffC = 2*s*oneMinS;
		const coeffP1 = s*s;

		const lp0 = new Vec3d(p0);
		lp0.scale3(coeffP0);

		const lp1 = new Vec3d(p1);
		lp1.scale3(coeffP1);

		const lc = new Vec3d(c);
		lc.scale3(coeffC);

		const ret = new Vec3d();
		ret.add3(lp0);
		ret.add3(lp1);
		ret.add3(lc);

		return ret;
	}

	/**
	 * Returns the local coordinates for a specified fractional distance along a polyline.
	 * @param pts - points for the polyline
	 * @param frac - fraction of the total graphical length of the polyline
	 * @return local coordinates for the specified position
	 */
	static getPositionOnPolyline(pts: Vec3d[], frac: number): Vec3d {

		if (pts.length === 0)
			return new Vec3d();

		// Calculate the cumulative graphical lengths along the polyline
		const cumLengthList = PolylineInfo.getCumulativeLengths(pts);

		// Find the insertion point by binary search
		const dist = frac * cumLengthList[cumLengthList.length-1];
		const k = binarySearch(cumLengthList, dist);

		// Exact match
		if (k >= 0)
			return pts[k];

		// Error condition
		if (k === -1)
			return new Vec3d();

		// Insertion index = -k-1
		const index = -k - 1;

		// Interpolate the final position between the two points
		if (index === cumLengthList.length) {
			return new Vec3d(pts[index-1]);
		}
		const fracInSegment = (dist - cumLengthList[index-1]) /
				(cumLengthList[index] - cumLengthList[index-1]);
		const vec = new Vec3d();
		vec.interpolate3(pts[index-1],
				pts[index],
				fracInSegment);
		return vec;
	}

	static getOrientationOnPolyline(pts: Vec3d[], frac: number): Vec3d {

		if (pts.length === 0)
			return new Vec3d();

		// Calculate the cumulative graphical lengths along the polyline
		const cumLengthList = PolylineInfo.getCumulativeLengths(pts);

		// Find the insertion point by binary search
		const dist = frac * cumLengthList[cumLengthList.length-1];
		const k = binarySearch(cumLengthList, dist);

		// Error condition
		if (k === -1)
			return new Vec3d();

		// Insertion index
		let index = k;
		if (k < 0)
			index = -k - 1;
		index = Math.max(index, 1);
		index = Math.min(index, pts.length - 1);

		// Calculate the direction vector
		const vec = new Vec3d(pts[index]);
		vec.sub3(pts[index - 1]);
		vec.normalize3();

		// Return the Euler angles
		const ret = new Vec3d();
		ret.z = Math.atan2(vec.y, vec.x);
		ret.y = Math.asin(-vec.z);
		return ret;
	}

	/**
	 * Returns the local coordinates for a sub-section of the polyline specified by a first and
	 * last fractional distance.
	 * @param pts - points for the polyline
	 * @param frac0 - fractional distance for the start of the sub-polyline
	 * @param frac1 - fractional distance for the end of the sub-polyline
	 * @return array of local coordinates for the sub-polyline
	 */
	static getSubPolyline(pts: Vec3d[], frac0: number, frac1: number): Vec3d[] {

		const ret: Vec3d[] = [];
		if (pts.length === 0)
			return ret;

		// Calculate the cumulative graphical lengths along the polyline
		const cumLengthList = PolylineInfo.getCumulativeLengths(pts);

		// Find the insertion point for the first distance using binary search
		const dist0 = frac0 * cumLengthList[cumLengthList.length-1];
		const k = binarySearch(cumLengthList, dist0);
		if (k === -1)
			throw new ErrorException("Unable to find position in polyline using binary search.");

		const lastPt = pts[pts.length-1];

		// Interpolate the position of the first node
		let index: number;
		if (k >= 0) {
			ret.push(pts[k]);
			index = k + 1;
			if (index === cumLengthList.length) {
				ret.push(lastPt);
				return ret;
			}
		}
		else {
			index = -k - 1;
			if (index === cumLengthList.length) {
				ret.push(lastPt);
				ret.push(lastPt);
				return ret;
			}
			const fracInSegment = (dist0 - cumLengthList[index-1]) /
					(cumLengthList[index] - cumLengthList[index-1]);
			const vec = new Vec3d();
			vec.interpolate3(pts[index-1],
					pts[index],
					fracInSegment);
			ret.push(vec);
		}

		// Loop through the indices following the insertion point
		const dist1 = frac1 * cumLengthList[cumLengthList.length-1];
		while (index < cumLengthList.length && cumLengthList[index] < dist1) {
			ret.push(pts[index]);
			index++;
		}
		if (index === cumLengthList.length) {
			ret.push(lastPt);
			return ret;
		}

		// Interpolate the position of the last node
		const vec = new Vec3d();
		const fracInSegment = (dist1 - cumLengthList[index-1]) /
                (cumLengthList[index] - cumLengthList[index-1]);
		vec.interpolate3(pts[index-1],
                 pts[index],
                 fracInSegment);
		ret.push(vec);
		return ret;
	}

	/**
	 * Returns the cumulative graphics lengths for the nodes along the polyline.
	 * @param pts - points for the polyline
	 * @return array of cumulative graphical lengths
	 */
	static getCumulativeLengths(pts: Vec3d[]): number[] {
		const cumLengthList: number[] = new Array<number>(pts.length).fill(0.0);
		if (pts.length === 0)  // Java: 長さ 0 の配列なら ArrayIndexOutOfBoundsException
			throw new RangeError("Index 0 out of bounds for length 0");
		cumLengthList[0] = 0.0;
		for (let i = 1; i < pts.length; i++) {
			const vec = new Vec3d();
			vec.sub3(pts[i], pts[i-1]);
			cumLengthList[i] = cumLengthList[i-1] + vec.mag3();
		}
		return cumLengthList;
	}

	/**
	 * Returns the total graphics length for a polyline.
	 * @param pts - points for the polyline
	 * @return total length
	 */
	static getLength(pts: Vec3d[]): number {
		let ret = 0.0;
		for (let i = 1; i < pts.length; i++) {
			const vec = new Vec3d();
			vec.sub3(pts[i], pts[i-1]);
			ret += vec.mag3();
		}
		return ret;
	}

	/**
	 * Returns the fractional position along a polyline for the location that is closest to the
	 * specified point.
	 * @param pts - coordinates for the polyline's nodes
	 * @param point - specified point
	 * @return fraction of the polyline's length
	 */
	static getNearestPosition(pts: Vec3d[], point: Vec3d): number {

		// Distance to the first node in the polyline
		let vec0 = new Vec3d(point);  // vector from the node to the point
		vec0.sub3(pts[0]);
		let dist = vec0.mag3();
		let totalLength = 0.0;
		let pos = 0.0;

		// Loop through each segment of the polyline
		for (let i = 1; i < pts.length; i++) {
			const vec1 = new Vec3d(pts[i]);  // vector along the segment
			vec1.sub3(pts[i - 1]);
			const length = vec1.mag3();  // length of the segment

			// Is there an intermediate point that is closest?
			const subLength = vec0.dot3(vec1)/length;
			if (subLength > 0.0 && subLength < length) {
				const pt = new Vec3d();
				pt.interpolate3(pts[i - 1], pts[i], subLength/length);
				pt.sub3(point);
				const newDist = pt.mag3();
				if (newDist < dist) {
					dist = newDist;
					pos = totalLength + subLength;
				}
			}

			// Try the node at end of the segment
			totalLength += length;
			vec0 = new Vec3d(point);
			vec0.sub3(pts[i]);
			const newDist = vec0.mag3();
			if (newDist < dist) {
				dist = newDist;
				pos = totalLength;
			}
		}
		return pos/totalLength;
	}

	/**
	 * Returns the index in a polyline at which to insert a new point that is located near the
	 * polyline's path.
	 * @param pts - coordinates for the polyline's nodes
	 * @param point - specified point
	 * @return insersion index
	 */
	static getInsertionIndex(pts: Vec3d[], point: Vec3d): number {
		const cumLengthList = PolylineInfo.getCumulativeLengths(pts);
		const length = cumLengthList[cumLengthList.length - 1];
		const frac = PolylineInfo.getNearestPosition(pts, point);
		const k = binarySearch(cumLengthList, frac * length);
		if (k === -1)
			throw new ErrorException("Unable to find position in polyline using binary search.");
		if (k >= 0)
			return k;
		return -k - 1;
	}

}
