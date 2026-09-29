/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2018-2021 JaamSim Software Inc.
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

// 多重定義 addEntity(DisplayEntity) と addEntity(DisplayEntity, String, int, boolean, double) は、
// 引数の数で見分ける 1 つの関数にした（1 つだけなら何もしない。Java の EntContainer の addEntity の空の実装）。
// iterator() が返す Java の Iterator<DisplayEntity> は JIterator<DisplayEntity>（MappedTreeSet.ts）。
// getEntityTypes() は Java の Set<String> の代わりに string[]（EntStorage.getTypes() と同じく Java の HashMap の順番）。

import { tr } from "../i18n/I18n.ts";
import type { DisplayEntity } from "../Graphics/DisplayEntity.ts";
import { EntContainer } from "./EntContainer.ts";
import { EntStorage, EntStorage_StorageEntry } from "./EntStorage.ts";
import { JIterator } from "./MappedTreeSet.ts";

export class EntContainerDelegate implements EntContainer {

	private storage: EntStorage;
	private lastEntity: DisplayEntity | null = null;
	private initialNumberAdded = 0;
	private initialNumberRemoved = 0;
	private numberAdded = 0;
	private numberRemoved = 0;

	constructor() {
		this.storage = new EntStorage();
	}

	clear(): void {
		this.storage.clear();
		this.lastEntity = null;
		this.initialNumberAdded = 0;
		this.initialNumberRemoved = 0;
		this.numberAdded = 0;
		this.numberRemoved = 0;
	}

	registerEntity(ent: DisplayEntity): void {
		this.lastEntity = ent;
		this.numberAdded++;
	}

	/**
	 * addEntity(ent) は何もしない（Java の EntContainer.addEntity の空の実装）。
	 * addEntity(ent, type, pri, fifo, simTime) は:
	 * Adds the specified entity to the container.
	 * @param ent - entity to be added
	 * @param type - type of entity
	 * @param pri - priority for removal
	 * @param fifo - true if entity stored in FIFO order, false if LIFO order
	 * @param simTime - present simulation time
	 */
	addEntity(ent: DisplayEntity, type?: string | null, pri?: number, fifo?: boolean, simTime?: number): void {
		if (pri === undefined)
			return;

		// Ensure that the entity has been registered
		if (ent !== this.lastEntity)
			ent.error(tr("An entity must be registered by the container before it can be added."));

		// Build the entry for the entity
		let n = this.getTotalNumberAdded();
		if (!fifo) {
			n *= -1;
		}

		const entry = new EntStorage_StorageEntry(ent, type ?? null, pri, n, simTime!);
		this.storage.add(entry);
	}

	removeEntity(type: string | null): DisplayEntity {
		const entry = this.storage.first(type)!;
		this.storage.remove(entry);
		const ent = entry.entity;
		this.numberRemoved++;
		return ent;
	}

	getCount(type: string | null): number {
		return this.storage.size(type);
	}

	isEmpty(type: string | null): boolean {
		return this.storage.isEmpty(type);
	}

	clearStatistics(): void {
		this.initialNumberAdded = this.numberAdded;
		this.initialNumberRemoved = this.numberRemoved;
		this.numberAdded = 0;
		this.numberRemoved = 0;
	}

	iterator(): JIterator<DisplayEntity> {
		const itr = this.storage.iterator()!;
		const src: Iterable<DisplayEntity> = {
			*[Symbol.iterator]() {
				while (itr.hasNext()) {
					yield itr.next().entity;
				}
			},
		};
		return new JIterator<DisplayEntity>(src);
	}

	getTotalNumberAdded(): number {
		return this.initialNumberAdded + this.numberAdded;
	}

	getTotalNumberProcessed(): number {
		return this.initialNumberRemoved + this.numberRemoved;
	}

	getLastEntity(): DisplayEntity | null {
		return this.lastEntity;
	}

	getEntityList(type: string | null): DisplayEntity[] {
		return this.storage.getEntityList(type);
	}

	getPriorityList(): number[] {
		return this.storage.getPriorityList();
	}

	getTypeList(): string[] {
		return this.storage.getTypeList();
	}

	getStorageTimeList(simTime: number): number[] {
		return this.storage.getStorageTimeList(simTime);
	}

	getEntityTypes(): string[] {
		return this.storage.getTypes();
	}

	toString(): string {
		return this.storage.toString();
	}

	// Used stubs for the StateUser methods

	setPresentState(state: string): void {}

	isWorkingState(): boolean {
		return false;
	}

}

EntContainer.register(EntContainerDelegate);
