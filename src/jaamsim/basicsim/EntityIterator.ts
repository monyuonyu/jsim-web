/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2014 Ausenco Engineering Canada Inc.
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
import { UnsupportedOperationException } from "../java/lang.ts";
import type { JClass } from "../java/lang.ts";
import type { Entity } from "./Entity.ts";
import type { EntityListNode } from "./EntityListNode.ts";
import type { JaamSimModel } from "./JaamSimModel.ts";

/** Java の java.util.NoSuchElementException（java/lang.ts に無いのでここに置いた） */
export class NoSuchElementException extends Error {}

/**
 * Java の Iterable と Iterator の両方。TS では for-of で回せるように [Symbol.iterator] も持つ。
 * matches は Java ではクラスだけを見るが、interface を実行時に調べられないため、
 * ClonesOfIterableInterface のために実体（ent）も渡す。
 */
export abstract class EntityIterator<T extends Entity> implements Iterable<T>, Iterator<T> {
	private needAdvance = true;
	protected readonly entClass: JClass<T>;
	private curNode: EntityListNode | null;
	private endNode: EntityListNode;

	constructor(simModel: JaamSimModel, aClass: JClass<T>) {
		this.endNode = simModel.getEntityList();
		this.curNode = this.endNode;
		this.entClass = aClass;
	}

	abstract matches(entklass: JClass | null, ent: Entity): boolean;

	// Advance the current pointer past any dead entities, or entities that do not match
	private advance(): void {
		if (!this.needAdvance) {
			return;
		}
		this.curNode = this.curNode!.next;
		this.needAdvance = false;

		while (true) {
			if (this.curNode === this.endNode) {
				return;
			}
			if (this.curNode === null) {
				// This is likely a race condition but unrecoverable
				// Terminate iteration
				return;
			}

			if (this.curNode.ent !== null && this.matches(this.curNode.entClass, this.curNode.ent)) {
				return;
			}
			this.curNode = this.curNode.next;
		}
	}

	hasNext(): boolean {
		this.advance();
		return this.curNode !== null && this.curNode !== this.endNode;
	}

	/** Java の next()。TS の Iterator の next() と名前がぶつかるので、Java の next は nextEnt にした */
	nextEnt(): T {
		this.advance();
		const nextEnt = this.curNode!.ent;
		if (nextEnt === null || this.curNode === this.endNode) {
			throw new NoSuchElementException();
		}

		this.needAdvance = true;
		return nextEnt as T;
	}

	/** TS の Iterator の next() */
	next(): IteratorResult<T> {
		if (!this.hasNext())
			return { done: true, value: undefined };
		return { done: false, value: this.nextEnt() };
	}

	remove(): void {
		throw new UnsupportedOperationException();
	}

	iterator(): Iterator<T> {
		return this;
	}

	[Symbol.iterator](): Iterator<T> {
		return this;
	}
}
