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

// 入れ子のクラス EntStorage.StorageEntry は、このファイルの EntStorage_StorageEntry にし、
// EntStorage.StorageEntry としても使えるようにした。
// 多重定義 size()/size(String) などは、引数を省くと null（Java の size() は size(null) を呼ぶので同じ）。
// getTypes() は Java の Set<String> の代わりに、Java の HashMap と同じ順番の配列を返す。

import { jformat } from "../internal.ts";
import type { DisplayEntity } from "../Graphics/DisplayEntity.ts";
import { JIterator, MappedTreeSet } from "../internal.ts";

export class EntStorage_StorageEntry {

	readonly entity: DisplayEntity;
	readonly type: string | null;
	readonly priority: number;
	readonly seqNum: number;
	readonly timeAdded: number;

	constructor(ent: DisplayEntity, tp: string | null, pri: number, n: number, t: number) {
		this.entity = ent;
		this.type = tp;
		this.priority = pri;
		this.seqNum = n;
		this.timeAdded = t;
	}

	compareTo(entry: EntStorage_StorageEntry): number {
		const ret = compareNum(this.priority, entry.priority);
		if (ret !== 0)
			return ret;

		return compareNum(this.seqNum, entry.seqNum);
	}

	toString(): string {
		return jformat("(%s, %s, %s, %s)",
				this.entity, this.type, this.priority, this.seqNum);
	}
}

/** Integer.compare・Long.compare */
function compareNum(x: number, y: number): number {
	return (x < y) ? -1 : ((x === y) ? 0 : 1);
}

/**
 * Stores entities in order of priority and insertion sequence. Entities are grouped by type into
 * subclasses that maintained separately for increased efficiency.
 * @author Harry King
 *
 */
export class EntStorage {

	static readonly StorageEntry = EntStorage_StorageEntry;

	private readonly entrySet: MappedTreeSet<string, EntStorage_StorageEntry>;
	private typeWithMaxCount: string | null = null;  // entity type with the largest number of entities
	private countForMaxType = 0;     // largest number of entities for a given entity type

	constructor() {
		this.entrySet = new MappedTreeSet<string, EntStorage_StorageEntry>();
	}

	clear(): void {
		this.entrySet.clear();
		this.typeWithMaxCount = null;
		this.countForMaxType = -1;
	}

	/**
	 * Adds the specified entry to the storage if not present.
	 * @param entry - entry to be added to this storage.
	 * @return true if this storage did not already contain the specified entry.
	 */
	add(entry: EntStorage_StorageEntry): boolean {

		// Add the entity to the storage
		const type = entry.type;
		const bool = this.entrySet.add(type, entry);
		if (!bool)
			return false;

		// Does the entry have a entity type value?
		if (type === null || this.typeWithMaxCount === null)
			return true;

		// Update the maximum count
		if (type === this.typeWithMaxCount) {
			this.countForMaxType++;
		}
		else {
			const n = this.entrySet.size(type);
			if (n > this.countForMaxType) {
				this.typeWithMaxCount = type;
				this.countForMaxType = n;
			}
		}
		return true;
	}

	/**
	 * Removes the specified entry from this storage if present.
	 * @param entry to be removed from this storage.
	 * @return true if this storage contained the specified entry.
	 */
	remove(entry: EntStorage_StorageEntry): boolean {

		// Remove the entity from the storage
		const type = entry.type;
		const found = this.entrySet.remove(type, entry);
		if (!found)
			return false;

		// Does the entry have a entity type value?
		if (type === null || this.typeWithMaxCount === null)
			return true;

		// Update the maximum count
		if (type === this.typeWithMaxCount) {
			this.typeWithMaxCount = null;
			this.countForMaxType = -1;
		}
		return true;
	}

	/**
	 * Returns the number of entities in storage with a specified entity type.
	 * If the specified type is null, then every entity is counted.
	 * @param type - specified entity type.
	 * @return number of entities of the specified type.
	 */
	size(type: string | null = null): number {
		if (type === null)
			return this.entrySet.size();
		return this.entrySet.size(type);
	}

	/**
	 * Returns whether the storage is empty for the specified entity type.
	 * @param type - specified entity type.
	 * @return true if the storage is empty
	 */
	isEmpty(type: string | null = null): boolean {
		if (type === null)
			return this.entrySet.isEmpty();
		return this.entrySet.isEmpty(type);
	}

	/**
	 * Returns the first StorageEntry in the storage with a specified entity type.
	 * If the specified type is null, the first StorageEntry is returned.
	 * @param type - specified entity type.
	 * @return first StorageEntry of the specified type.
	 */
	first(type: string | null = null): EntStorage_StorageEntry | null {
		if (type === null)
			return this.entrySet.first();
		return this.entrySet.first(type);
	}

	iterator(type: string | null = null): JIterator<EntStorage_StorageEntry> | null {
		if (type === null)
			return this.entrySet.iterator();
		return this.entrySet.iterator(type);
	}

	/**
	 * Returns the StorageEntries in storage for the specified entity type.
	 * @param type - specified entity type.
	 * @return StorageEntries in storage.
	 */
	getEntries(type: string | null = null): EntStorage_StorageEntry[] | null {
		if (type === null)
			return this.entrySet.values();
		return this.entrySet.values(type);
	}

	/**
	 * Returns the entity types that are present in the storage.
	 * @return set of entity types.
	 */
	getTypes(): string[] {
		return this.entrySet.keySet();
	}

	/**
	 * Returns the entity type that has the largest number of entities in the storage.
	 * @return entity type with the most entities.
	 */
	getTypeWithMaxCount(): string | null {
		if (this.typeWithMaxCount === null) {
			this.typeWithMaxCount = this.entrySet.maxKey();
			this.countForMaxType = this.entrySet.size(this.typeWithMaxCount);
		}
		return this.typeWithMaxCount;
	}

	/**
	 * Returns the number of entities for the most numerous entity type in storage.
	 * @return number of entities for the most numerous entity type.
	 */
	getCountForMaxType(): number {
		if (this.typeWithMaxCount === null) {
			this.typeWithMaxCount = this.entrySet.maxKey();
			this.countForMaxType = this.entrySet.size(this.typeWithMaxCount);
		}
		return this.countForMaxType;
	}

	/**
	 * Returns the entities in storage for the specified entity type.
	 * @param type - specified entity type
	 * @return entities in storage for the specified type
	 */
	getEntityList(type: string | null = null): DisplayEntity[] {
		const ret: DisplayEntity[] = [];
		const itr = this.iterator(type)!;  // Java と同じく、無い type では失敗する
		while (itr.hasNext()) {
			ret.push(itr.next().entity);
		}
		return ret;
	}

	/**
	 * Returns the priority for each entity in the storage.
	 * @return priority for each entity
	 */
	getPriorityList(): number[] {
		const ret: number[] = [];
		const itr = this.entrySet.iterator()!;
		while (itr.hasNext()) {
			ret.push(itr.next().priority);
		}
		return ret;
	}

	/**
	 * Returns the type for each entity in the storage.
	 * @return type for each entity
	 */
	getTypeList(): string[] {
		const ret: string[] = [];
		const itr = this.entrySet.iterator()!;
		while (itr.hasNext()) {
			const type = itr.next().type;
			if (type !== null) {
				ret.push(type);
			}
		}
		return ret;
	}

	/**
	 * Returns the time each entity has spent in the storage.
	 * @param simTime - present time
	 * @return time in storage for each entity
	 */
	getStorageTimeList(simTime: number): number[] {
		const ret: number[] = [];
		const itr = this.entrySet.iterator()!;
		while (itr.hasNext()) {
			ret.push(simTime - itr.next().timeAdded);
		}
		return ret;
	}

	toString(): string {
		return this.entrySet.toString();
	}

}
