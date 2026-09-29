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
import { DataBlock } from "../MeshFiles/DataBlock.ts";
import { tr } from "../i18n/I18n.ts";
import { Double } from "../java/lang.ts";
import { AABB } from "./AABB.ts";
import type { Mat4d } from "./Mat4d.ts";
import { MathUtils } from "./MathUtils.ts";
import { Plane } from "./Plane.ts";
import type { Ray } from "./Ray.ts";
import { Transform } from "./Transform.ts";
import { Vec3d } from "./Vec3d.ts";
import type { Vec3dInterner } from "./Vec3dInterner.ts";
import type { Vec4d } from "./Vec4d.ts";

/*
 * 入れ子のクラス: 公開の HullFace は ConvexHull_HullFace にし、ConvexHull.HullFace からも引けるようにした。
 * 非公開の TempHullFace・HullEdge は、このファイルの中だけの class にした。
 * com.jaamsim.render（RenderUtils・RenderException）は移さないので、RenderException はこのファイルの中の class にした。
 */

/** com.jaamsim.render.RenderException の代わり（render は移さない） */
class RenderException extends Error {}

/**
 * The main hull face storage class, simply a list of indices
 * @author Matt.Chudleigh
 *
 */
export class ConvexHull_HullFace {
	readonly indices: number[] = [0, 0, 0];
}

/**
 * A class that represents a single face of the hull during hull construction. The 'points' member is the list of external
 * points not yet encompasses by the hull and are visible by this temporary face
 * @author Matt.Chudleigh
 *
 */
class TempHullFace {
	readonly indices: number[] = [0, 0, 0];
	readonly plane: Plane;
	furthestDist = 0;
	furthestInd = 0;
	readonly points: number[] = [];

	constructor(i0: number, i1: number, i2: number, verts: Vec3d[]) {
		this.indices[0] = i0;
		this.indices[1] = i1;
		this.indices[2] = i2;
		this.plane = new Plane(verts[this.indices[0]],
		                       verts[this.indices[1]],
		                       verts[this.indices[2]]);

	}
	addPoint(ind: number, verts: Vec3d[]): void {
		const v = verts[ind];
		const dist = this.plane.getNormalDist(v);
		if (dist >= this.furthestDist) {
			this.furthestDist = dist;
			this.furthestInd = ind;
		}
		// assert(dist > -0.000001);（Java の assert は既定で無効）
		this.points.push(ind);
	}

	// Return the sine of the angle from the plane to the nearest point
	getPointAngle(pt: Vec3d, verts: Vec3d[]): number {
		let nearDistSq = Double.MAX_VALUE;
		for (let i = 0; i < 3; ++i) {
			const vert = verts[this.indices[i]];
			const distSq = MathUtils.vecDistSq3(pt, vert);
			nearDistSq = Math.min(distSq, nearDistSq);
		}
		const nearDist = Math.sqrt(nearDistSq);
		const dist = this.plane.getNormalDist(pt);
		return dist/nearDist;
	}

}

// A really dumb class to store edges
class HullEdge {
	readonly ind0: number;
	readonly ind1: number;
	constructor(i0: number, i1: number) {
		this.ind0 = i0; this.ind1 = i1;
	}
}

const COMP = (v0: Vec3d, v1: Vec3d): number => {
	let comp: number;
	comp = Double.compare(v0.x, v1.x);
	if (comp !== 0)
		return comp;

	comp = Double.compare(v0.y, v1.y);
	if (comp !== 0)
		return comp;

	return Double.compare(v0.z, v1.z);

};

/**
 * A convex hull that is initialized by a set of points
 * @author Matt.Chudleigh
 *
 */
export class ConvexHull {
	static readonly HullFace = ConvexHull_HullFace;

	private _verts: Vec3d[] = [];

	private _isDegenerate = false;

	private _faces: ConvexHull_HullFace[] = [];

	static TryBuildHull(verts: Vec3d[], numAttempts: number, maxNumPoints: number, interner: Vec3dInterner | null): ConvexHull {

		const baseVerts = ConvexHull.removeDoubles(verts);

		// assert(numAttempts > 0);

		// bad input indicates a hull that will naturally be degenerate, just return the first attempt
		const badInput = baseVerts.length < 3;

		let ret: ConvexHull | null = null;
		for (let i = 0; i < numAttempts; ++i) {
			const seed = (i/numAttempts);

			ret = new ConvexHull(baseVerts, seed, maxNumPoints, interner);
			if (!ret._isDegenerate || badInput) {
				return ret;
			}
			// The mesh was degenerate, loop and try again
		}

		// We fell through, so return the last degenerate attempt
		return ret!;
	}

	/**
	 * Initialize this hull from the vertices provided. This is an implementation of the QuickHull algorithm (or close enough to it)
	 * （引数なしは Java の private ConvexHull()。fromDataBlock だけが使う）
	 */
	constructor();
	constructor(baseVerts: Vec3d[], seed: number, maxNumPoints: number, interner: Vec3dInterner | null);
	constructor(baseVerts?: Vec3d[], seed?: number, maxNumPoints?: number, interner?: Vec3dInterner | null) {
		if (baseVerts === undefined)
			return;
		seed = seed!;
		maxNumPoints = maxNumPoints!;
		interner = interner ?? null;

		// assert(seed >= 0);
		// assert(seed < 1);

		if (baseVerts.length < 3) {
			// This mesh is too small, so just create an empty Hull... or should we throw?
			this.makeDegenerate(baseVerts);
			return;
		}

		// Start by finding 3 points to build the original faces, this may have a problem if there is only
		// 3 points and all are in a line
		const tempFaces: TempHullFace[] = [];
		const unclaimedPoints: number[] = [];

		// Create two starting faces (both use the same verts but are wound backwards to face in both directions)

		const ind0 = Math.trunc(baseVerts.length * seed);
		const v0 = baseVerts[ind0];
		let bestDist = 0;
		let ind1 = 0;
		const temp = new Vec3d();
		for (let i = 0; i < baseVerts.length; ++i) {
			if (i === ind0) continue;

			// Ind1 is the farthest vertex from ind0
			temp.sub3(v0, baseVerts[i]);
			const dist = temp.mag3();
			if (dist > bestDist) {
				bestDist = dist;
				ind1 = i;
			}
		}
		// Now ind2 is the vertex farthest from the line of the above two
		bestDist = 0;
		const dir = new Vec3d();
		dir.sub3(v0, baseVerts[ind1]);
		dir.normalize3();
		let ind2 = 0;
		for (let i = 1; i < baseVerts.length; ++i) {
			if (i === ind0) continue;
			if (i === ind1) continue;

			temp.sub3(v0, baseVerts[i]);
			temp.cross3(dir, temp);
			const dist = temp.mag3();
			if (dist > bestDist) {
				bestDist = dist;
				ind2 = i;
			}
		}

		if (ind1 === ind0 ||
		    ind2 === ind0 ||
		    ind1 === ind2 ||
			bestDist < 0.00001) {
			this.makeDegenerate(baseVerts);
			return;
		}

		const f0 = new TempHullFace(ind0, ind1, ind2, baseVerts);
		const f1 = new TempHullFace(ind0, ind2, ind1, baseVerts);
		tempFaces.push(f0);
		tempFaces.push(f1);

		let planar = true;

		// Assign all the remaining points to either of the faces if that face can 'see' the vertex
		for (let i = 0; i < baseVerts.length; ++i) {
			const dist = f0.plane.getNormalDist(baseVerts[i]);

			if (dist > 0.000001) {
				f0.addPoint(i, baseVerts);
				planar = false;
			} else if (dist < -0.000001){
				f1.addPoint(i, baseVerts);
				planar = false;
			} else {
				unclaimedPoints.push(i);
			}
		}

		if (planar) {
			// Damn... for now fall back to a degenerate hull
			this.makeDegenerate(baseVerts);
			return;
		}

		let numPoints = 3; // We start with 3 points

		// Initialization is complete, start the core loop
		while (true) {
			// Find any faces with points assigned to it
			let f: TempHullFace | null = null;
			bestDist = 0.001; // A non zero value to quick out if the closest points aren't that far
			for (const ft of tempFaces) {
				if (ft.points.length !== 0 && ft.furthestDist > bestDist) {
					f = ft;
					bestDist = ft.furthestDist;
				}
			}
			if (f === null) {
				// There's no remaining points unassigned, we're done.
				break;
			}

			// Find the point assigned to this face that is the furthest away
			const farInd = f.furthestInd;

			// Remove any faces that can see this point and orphan any points owned by these faces
			const farVert = baseVerts[farInd];

			const deadFaces: TempHullFace[] = [];

			for (let k = 0; k < tempFaces.length; ) {
				const tempFace = tempFaces[k];

				if (tempFace.getPointAngle(farVert, baseVerts) > -0.00001) { // Non zero to allow a bit of floating point round off and avoid degenerate faces
					// This face can see this point, and is therefore not part of the hull
					deadFaces.push(tempFace);
					tempFaces.splice(k, 1);  // it.remove()
					continue;
				}
				k++;
			}

			// The points that are no longer associated with a face
			const orphanedPoints: number[] = [];
			orphanedPoints.push(...unclaimedPoints);
			unclaimedPoints.length = 0;

			// Find all the open edges left by removing these faces
			const edges: HullEdge[] = [];
			for (const df of deadFaces) {
				orphanedPoints.push(...df.points);

				edges.push(new HullEdge(df.indices[0], df.indices[1]));
				edges.push(new HullEdge(df.indices[1], df.indices[2]));
				edges.push(new HullEdge(df.indices[2], df.indices[0]));
			}

			// Remove double edges (to make sure we have a single loop)
			this.pruneEdges(edges);

			// Scan the loop to make sure it's a single loop
//			if (!scanEdges(edges)) {
//				// This hull diverged
//				makeDegenerate(baseVerts);
//				return;
//			}

			const newFaces: TempHullFace[] = [];

			// Build new faces from the remaining edges and assign all remaining points
			for (const e of edges) {
				const newFace = new TempHullFace(e.ind0, e.ind1, farInd, baseVerts);
				tempFaces.push(newFace);

				newFaces.push(newFace);

			} // end of building new faces

			// Add each orphaned point to the new face it is the furthest away from (by normal distance)
			let deadPoints = 0;
			for (const ind of orphanedPoints) {

				let bestFace: TempHullFace | null = null;
				bestDist = -1;

				for (const tf of newFaces) {
					const dist = tf.plane.getNormalDist(baseVerts[ind]);
					if (dist > 0.000001 && dist > bestDist) {
						bestFace = tf;
						bestDist = dist;
					}
				}
				if (bestFace !== null) {
					bestFace.addPoint(ind, baseVerts);
				} else {
					++deadPoints;
				}
			}

			// This is the end of the main loop, check that at least one point has been claimed

			if (deadPoints === 0) {
				// We have run out of points, so let's just call this good enough
				break;
			}
			if (++numPoints > maxNumPoints && maxNumPoints > 0) {
				// We've looped and built up a hull of the maximum number of points
				break;
			}

		} // End of main loop

		// Now that we have all the faces we can create a real subset of points we care about
		const realVerts: Vec3d[] = [];
		for (const tf of tempFaces) {
			const realFace = new ConvexHull_HullFace();
			for (let i = 0; i < 3; ++i) {

				const oldVert = baseVerts[tf.indices[i]];

				let newInd = realVerts.length;

				for (let j = 0; j < realVerts.length; ++j) {
					if (oldVert.equals3(realVerts[j])) {
						// This vertex has already be included in the final list
						newInd = j;
					}
				}
				if (newInd === realVerts.length) {
					// This vertex isn't in the new list, so add it and update the radius
					if (interner != null)
						realVerts.push(interner.intern(oldVert));
					else
						realVerts.push(oldVert);
				}
				realFace.indices[i] = newInd;
			}

			this._faces.push(realFace);
		}

		// swap out our vertex list to the real one
		this._verts = realVerts;
	} // End of ConvexHull() Constructor

	/**
	 * Remove any doubles from the list and return a new, possibly shorter list
	 * @param orig
	 * @return
	 */
	private static removeDoubles(orig: Vec3d[]): Vec3d[] {
		const ret: Vec3d[] = [];
		if (orig.length === 0) {
			return ret;
		}

		const copy: Vec3d[] = [...orig];

		copy.sort(COMP);  // Collections.sort と同じく、安定な並べ替え

		ret.push(copy[0]);
		let outIndex = 0; // An updated index of the last element of the returned set, this may be
		for (let index = 1;index < copy.length; ++index) {
			if (!copy[index].near3(ret[outIndex])) {
				// We have not seen this vector before
				ret.push(copy[index]);
				++outIndex;
			}
		}

		return ret;
	}

	// Remove any edge that is back tracked over, alter 'edges' in place
	private pruneEdges(edges: HullEdge[]): void {
		for (let i = 0; i < edges.length; ) {

			const e0 = edges[i];
			let keepEdge = true;

			for (let j = i;  j < edges.length; ++j) {

				const e1 = edges[j];

				if (e0.ind0 === e1.ind1 && e0.ind1 === e1.ind0) {
					keepEdge = false;
					edges.splice(j, 1); // Remove j, which is always higher than i so this should be safe
					break;
				}
			}

			if (keepEdge) {
				++i;
			} else {
				edges.splice(i, 1);
			}
		}
	}

	// This is used for sanity checking the generation code, but it too slow to leave in
	// 使われていない（Java でも @SuppressWarnings("unused")）
	private scanEdges(edges: HullEdge[]): boolean {
		const seenIndices: number[] = new Array<number>(edges.length*2).fill(0);
		let numSeen = 0;

		//ArrayList<Integer> seenIndices = new ArrayList<Integer>();

		for (const e of edges) {
			let seen = false;
			for (let i = 0; i < numSeen; ++i) { if (seenIndices[i] === e.ind0) seen = true; }
			if (!seen)
				seenIndices[numSeen++] = e.ind0;

			for (let i = 0; i < numSeen; ++i) { if (seenIndices[i] === e.ind1) seen = true; }
			if (!seen)
				seenIndices[numSeen++] = e.ind1;
		}

		return numSeen === edges.length;

	}

	/**
	 * Return the list of faces (a list of triplets of indices into the vertices) for this mesh
	 */
	getFaces(): ConvexHull_HullFace[] {
		return this._faces;
	}

	getVertices(): Vec3d[] {

		return this._verts;
	}

	collides(point: Vec4d, trans: Transform): boolean {
		// Simply use the AABB formed from the points for the degenerate cases
		if (this._isDegenerate) {
			const aabb = this.getAABB(trans.getMat4dRef());
			return aabb.collides(point);
		}

		const inv = new Transform();
		trans.inverse(inv);

		// P is the point in hull space
		const p = new Vec3d();
		inv.multAndTrans(point, p);

		const plane = new Plane();
		for (const f of this._faces) {
			this.faceToPlane(f, plane);
			const dist = plane.getNormalDist(p);
			if (dist > 0) {
				// This point is outside at least one plane, so there is not intersection
				return false;
			}
		}
		return true;
	}

	private static _ONES: Vec3d | null = null;
	private static get ONES(): Vec3d {
		if (ConvexHull._ONES === null)
			ConvexHull._ONES = new Vec3d(1.0, 1.0, 1.0);
		return ConvexHull._ONES;
	}

	/**
	 * Check for collision with the provided ray, will return the distance to a collision, with a negative number being returned for no collsion
	 * @param r
	 * @param trans
	 * @return - distance to collision, or -1 if no collision
	 */
	collisionDistance(r: Ray, trans: Transform, scale: Vec3d = ConvexHull.ONES): number {
		// 描画: 省略（three.js の画面を作るときに）
		// TODO(移植): RenderUtils.mergeTransAndScale・getInverseWithScale（com.jaamsim.render）を使うので移していない。常に「当たり無し」(-1) を返す
		// 元の Java:
		// return collisionDistanceByMatrix(r,
		// 		RenderUtils.mergeTransAndScale(trans, scale),
		// 		RenderUtils.getInverseWithScale(trans, scale));
		void r; void trans; void scale;
		return -1.0;
	}

	collisionDistanceByMatrix(r: Ray, mat: Mat4d, invMat: Mat4d): number {

		if (this._isDegenerate) {
			const aabb = this.getAABB(mat);
			return aabb.collisionDist(r);
		}

		// hullRay is the point in hull space
		const hullRay = r.transform(invMat);

		let back = Double.MAX_VALUE;
		let front = -Double.MAX_VALUE;

		const plane = new Plane();
		for (const f of this._faces) {
			this.faceToPlane(f, plane);

			const bBackFace = plane.backFaceCollision(hullRay);

			const dist = plane.collisionDist(hullRay);

			if (dist === Infinity || dist === -Infinity) {
				continue; // Parallel ray and plane
			}

			if ( bBackFace && dist <  back) {  back = dist; }
			if (!bBackFace && dist > front) { front = dist; }
		}

		// We now know the extreme points and can figure out if this collides or not
		if (back < front) { return -1.0; } // No collision

		if (back < 0 && front < 0) { return -1.0; } // Collision behind the start of the ray

		if (front < 0) {
			// The ray starts from inside the object
			return 0.0;
		}

		// Scale the distance back to global coords
		const collisionPoint = hullRay.getPointAtDist(front);
		// Convert to global space
		collisionPoint.multAndTrans3(mat, collisionPoint);
		const diff = new Vec3d();
		diff.sub3(r.getStartRef(), collisionPoint);

		return diff.mag3();
	}

	private faceToPlane(f: ConvexHull_HullFace, p: Plane): void {
		p.set(this._verts[f.indices[0]],
		      this._verts[f.indices[1]],
		      this._verts[f.indices[2]]);
	}

	private makeDegenerate(vs: Vec3d[]): void {
		this._isDegenerate = true;
		this._verts = vs;
		this._faces = [];
		// Figure out a radius
	}

	isDegenerate(): boolean {
		return this._isDegenerate;
	}

	/**
	 * Get an world space AABB if this hull were transformed by 't'
	 * @param mat
	 */
	getAABB(mat: Mat4d): AABB {
		return new AABB(this._verts, mat);
	}

	getAABBCenter(): Vec3d {
		const tmp = new AABB(this._verts);
		return new Vec3d(tmp.center);
	}

	toDataBlock(interner: Vec3dInterner): DataBlock {
		const topBlock = new DataBlock("ConvexHull", 0);

		const vertsBlock = new DataBlock("Vertices", this._verts.length * 4);
		for (const v of this._verts) {
			vertsBlock.writeInt(interner.getIndexForValue(v));
		}

		const facesBlock = new DataBlock("Faces", this._faces.length * 4*3);
		for (const f of this._faces) {
			facesBlock.writeInt(f.indices[0]);
			facesBlock.writeInt(f.indices[1]);
			facesBlock.writeInt(f.indices[2]);
		}

		topBlock.addChildBlock(vertsBlock);
		topBlock.addChildBlock(facesBlock);
		return topBlock;
	}

	static fromDataBlock(topBlock: DataBlock, vecs: Vec3d[]): ConvexHull {
		if (topBlock.getName() !== "ConvexHull") {
			throw new RenderException(tr("ConvexHull block not found"));
		}

		const ret = new ConvexHull();

		const vertsBlock = topBlock.findChildByName("Vertices");
		const facesBlock = topBlock.findChildByName("Faces");

		if (vertsBlock == null) throw new RenderException(tr("Missing vertices in ConvexHull"));
		if (facesBlock == null) throw new RenderException(tr("Missing faces in ConvexHull"));

		const numVerts = Math.trunc(vertsBlock.getDataSize() / 4);
		ret._verts = [];
		for (let i = 0; i < numVerts; ++i) {
			const index = vertsBlock.readInt();
			ret._verts.push(vecs[index]);
		}

		const numFaces = Math.trunc(facesBlock.getDataSize() / (4*3));
		ret._faces = [];
		for (let i = 0; i < numFaces; ++i) {
			const f = new ConvexHull_HullFace();
			f.indices[0] = facesBlock.readInt();
			f.indices[1] = facesBlock.readInt();
			f.indices[2] = facesBlock.readInt();
			ret._faces.push(f);
		}

		ret._isDegenerate = (numFaces === 0);

		return ret;
	}
}
