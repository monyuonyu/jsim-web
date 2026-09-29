/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2020-2023 JaamSim Software Inc.
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
import type { Vec3d } from "../math/Vec3d.ts";
import { AbstractDirectedEntity } from "./AbstractDirectedEntity.ts";
import type { DisplayEntity } from "./DisplayEntity.ts";

export class DirectedEntity extends AbstractDirectedEntity<DisplayEntity> {

	/** Java の (ent) と (ent, dir) の 2 つのコンストラクタ（dir を省くと true） */
	constructor(ent: DisplayEntity, dir: boolean = true) {
		super(ent, dir);
	}

	getSourcePoint(): Vec3d {
		return this.entity.getSourcePoint(this.direction);
	}

	getSinkPoint(): Vec3d {
		return this.entity.getSinkPoint(this.direction);
	}

	static getList(list: DisplayEntity[], dir: boolean): DirectedEntity[] {
		const ret: DirectedEntity[] = [];
		for (const ent of list) {
			ret.push(new DirectedEntity(ent, dir));
		}
		return ret;
	}

}
