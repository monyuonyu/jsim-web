/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2013 Ausenco Engineering Canada Inc.
 * Copyright (C) 2026 JaamSim Software Inc.
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
 *
 * TypeScript への移植 (C) 2026 shota
 */
import { Vec3d } from "../math/Vec3d.ts";
import { KeyedCurve } from "./KeyedCurve.ts";

export class KeyedVec3dCurve extends KeyedCurve<Vec3d> {

	protected override interpVal(val0: Vec3d, val1: Vec3d, ratio: number, arg: number): Vec3d {
		const ret = new Vec3d();
		switch (arg) {
		case 0:
			ret.interpolate3(val0, val1, ratio);
			break;
		case 1:
			ret.slerp(val0, val1, ratio);
			break;
		}
		return ret;
	}

}
