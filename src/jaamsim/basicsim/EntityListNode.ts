/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2019 JaamSim Software Inc.
 * TypeScript への移植 (C) 2026 shota
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
 */
import type { JClass } from "../java/lang.ts";
import type { Entity } from "./Entity.ts";

/**
 * Simple struct-like class to handle the doubly linked loop of entities
 * @author Matt Chudleigh
 *
 * Java の 2 つのコンストラクタ（引数なし・Entity）は、引数の有無で見分ける。
 */
export class EntityListNode {

	public next: EntityListNode;
	public prev: EntityListNode;

	// This is a minor optimization, caching entClass prevents needing to dereference ent during
	// iteration of the entity list
	public entClass: JClass<Entity> | null = null;

	public ent: Entity | null = null;

	// Initialize to a closed loop
	constructor(e?: Entity) {
		this.next = this;
		this.prev = this;
		if (e !== undefined) {
			this.ent = e;
			e.listNode = this;
			this.entClass = e.constructor as JClass<Entity>;
		}
	}
}
