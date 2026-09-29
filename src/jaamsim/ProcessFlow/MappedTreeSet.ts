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

// 移植の注意:
// - Java の TreeSet<V>（V は Comparable）は java/collections.ts の TreeSet に compareTo を渡して使う。
// - Java の HashMap<K, TreeSet<V>> は、回す順番（keySet() と maxKey() の同点のとき）が結果に効く
//   （AbstractCombine が getEntityTypes() を順に回して match 値を選ぶ）。そこで、キーが文字列のときは
//   Java の HashMap と同じ順番になるように JavaHashOrder で順番を再現する（String.hashCode と表の大きさから）。
// - Java の Iterator は、ここの JIterator（hasNext・next）にした。
// - 多重定義 size()/size(K)、isEmpty()/isEmpty(K)、iterator()/iterator(K)、first()/first(K)、last()/last(K)、
//   values()/values(K) は、引数の有無で見分ける 1 つの関数にした（引数に null を渡すのは「キーが null」の意味。
//   引数を省いたときだけ、全体が対象になる）。

import { TreeSet } from "../java/collections.ts";

/** Java の Iterator の代わり（hasNext・next）。for-of でも回せる */
export class JIterator<T> implements Iterable<T> {
	private readonly it: Iterator<T>;
	private nextRes: IteratorResult<T>;

	constructor(src: Iterable<T>) {
		this.it = src[Symbol.iterator]();
		this.nextRes = this.it.next();
	}

	hasNext(): boolean {
		return !this.nextRes.done;
	}

	next(): T {
		const ret = this.nextRes;
		if (ret.done)
			throw new Error("NoSuchElementException");
		this.nextRes = this.it.next();
		return ret.value;
	}

	*[Symbol.iterator](): Iterator<T> {
		while (this.hasNext())
			yield this.next();
	}
}

/** Java の String.hashCode() */
export function javaStringHashCode(s: string): number {
	let h = 0;
	for (let i = 0; i < s.length; i++)
		h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
	return h;
}

/**
 * Java の HashMap<String, V>（既定のコンストラクタ）を回す順番を再現する表。
 * 順番: 表の添え字（hash ^ (hash >>> 16)）&（表の大きさ - 1）の小さい順、同じ添え字の中では入れた順。
 * 表の大きさは 16 から始まり、要素の数が 0.75 倍を超えると 2 倍になる（clear しても小さくならない）。
 * 同じ添え字に 8 個以上たまったときの扱い（表が 64 未満なら 2 倍にする）も写した。
 */
export class JavaHashOrder<V> {
	private readonly map = new Map<string, { value: V; seq: number }>();
	private cap = 0;
	private seqCounter = 0;
	private treeified = false;

	private static bucketIndex(key: string, cap: number): number {
		const h = javaStringHashCode(key);
		return ((h ^ (h >>> 16)) & (cap - 1)) >>> 0;
	}

	get size(): number {
		return this.map.size;
	}

	get(key: string): V | undefined {
		return this.map.get(key)?.value;
	}

	has(key: string): boolean {
		return this.map.has(key);
	}

	set(key: string, value: V): void {
		const old = this.map.get(key);
		if (old !== undefined) {
			old.value = value;
			return;
		}
		if (this.cap === 0)
			this.cap = 16;

		// 同じ添え字にある物の数（8 個以上なら treeifyBin）
		const idx = JavaHashOrder.bucketIndex(key, this.cap);
		let binCount = 0;
		for (const k of this.map.keys())
			if (JavaHashOrder.bucketIndex(k, this.cap) === idx)
				binCount++;
		this.map.set(key, { value, seq: this.seqCounter++ });
		if (binCount >= 8) {
			if (this.cap < 64)
				this.cap *= 2;
			else
				this.treeified = true;  // TODO(順番): 木になった入れ物の順番は再現していない（同じ添え字に 9 個以上。まず起きない）
		}
		if (this.map.size > this.cap * 0.75)
			this.cap *= 2;
	}

	delete(key: string): boolean {
		return this.map.delete(key);
	}

	clear(): void {
		this.map.clear();
	}

	/** Java の HashMap と同じ順番のキー */
	keys(): string[] {
		const cap = this.cap;
		const list = [...this.map.entries()];
		list.sort((a, b) => {
			const d = JavaHashOrder.bucketIndex(a[0], cap) - JavaHashOrder.bucketIndex(b[0], cap);
			if (d !== 0)
				return d;
			return a[1].seq - b[1].seq;
		});
		return list.map(e => e[0]);
	}

	/** Java の HashMap と同じ順番の [キー, 値] */
	entries(): [string, V][] {
		return this.keys().map(k => [k, this.map.get(k)!.value]);
	}
}

interface Comparable<V> {
	compareTo(o: V): number;
}

/**
 * Stores a set of unique objects in an order determined by the object's comparator.
 * The objects are grouped into subsets by the value of a key, which is normally a
 * property of the object.
 * @author Harry King
 *
 * @param <K> - key（この移植では文字列だけ）
 * @param <V> - object
 */
export class MappedTreeSet<K extends string, V extends Comparable<V>> {

	private readonly objSet: TreeSet<V>;  // contains all the objects
	private readonly subsetMap: JavaHashOrder<TreeSet<V>>;  // maps a key to sub-sets of the objects

	constructor() {
		this.objSet = MappedTreeSet.newTreeSet<V>();
		this.subsetMap = new JavaHashOrder<TreeSet<V>>();
	}

	private static newTreeSet<V extends Comparable<V>>(): TreeSet<V> {
		return new TreeSet<V>((a, b) => a.compareTo(b));
	}

	clear(): void {
		this.objSet.clear();
		this.subsetMap.clear();
	}

	/**
	 * Adds the specified element to the set if it is not already present.
	 * If the key is not null, the element is added to both the set of all elements and to
	 * the subset for that key.
	 * @param key - property used to group the stored elements into subsets.
	 * @param e - element to be added to this set.
	 * @return true if this set did not already contain the specified element.
	 */
	add(key: K | null, e: V): boolean {

		// Add the object to the complete set
		let ret = this.objSet.add(e);
		if (!ret)
			return false;

		// If there is a key for this object, add it to its subset
		if (key === null)
			return true;

		// If this is the first object for its key, create a new subset
		let subSet = this.subsetMap.get(key);
		if (subSet === undefined) {
			subSet = MappedTreeSet.newTreeSet<V>();
			this.subsetMap.set(key, subSet);
		}
		ret = subSet.add(e);
		return ret;
	}

	/**
	 * Removes the specified element from this set if it is present.
	 * If the key is not null, the element is removed from both the set of all elements and from
	 * the subset for that key.
	 * @param key - property used to group the stored elements into subsets.
	 * @param o - object to be removed from this set if present.
	 * @return true if this set contained the specified element.
	 */
	remove(key: K | null, o: V): boolean {

		// Remove the object from the complete set
		let found = this.objSet.delete(o);
		if (!found)
			return false;

		// If there a key for this object, remove it from its subset
		if (key === null)
			return true;

		const subSet = this.subsetMap.get(key);
		if (subSet === undefined)
			return false;

		found = subSet.delete(o);
		if (!found)
			return false;

		// Delete the subset if it is now empty
		if (subSet.size === 0) {
			this.subsetMap.delete(key);
		}
		return true;
	}

	/** size() と size(K key) */
	size(...args: [] | [K | null]): number {
		if (args.length === 0)
			return this.objSet.size;
		const subSet = this.getSubset(args[0]);
		if (subSet === undefined)
			return 0;
		return subSet.size;
	}

	/** isEmpty() と isEmpty(K key) */
	isEmpty(...args: [] | [K | null]): boolean {
		if (args.length === 0)
			return this.objSet.size === 0;
		const subSet = this.getSubset(args[0]);
		return subSet === undefined || subSet.size === 0;
	}

	contains(o: V): boolean {
		return this.objSet.has(o);
	}

	/** iterator() と iterator(K key)（キーの組が無ければ null） */
	iterator(...args: [] | [K | null]): JIterator<V> | null {
		if (args.length === 0)
			return new JIterator<V>(this.objSet);
		const subSet = this.getSubset(args[0]);
		if (subSet === undefined)
			return null;
		return new JIterator<V>(subSet);
	}

	toArray(): V[] {
		return [...this.objSet];
	}

	containsKey(key: K | null): boolean {
		return key !== null && this.subsetMap.has(key);
	}

	/** first() と first(Object key) */
	first(...args: [] | [K | null]): V | null {
		if (args.length === 0) {
			if (this.objSet.size === 0)
				return null;
			return this.objSet.first()!;
		}
		const subSet = this.getSubset(args[0]);
		if (subSet === undefined)
			return null;
		return this.subsetFirst(subSet);
	}

	/** last() と last(Object key) */
	last(...args: [] | [K | null]): V | null {
		if (args.length === 0) {
			if (this.objSet.size === 0)
				return null;
			return this.objSet.last()!;
		}
		const subSet = this.getSubset(args[0]);
		if (subSet === undefined)
			return null;
		return this.subsetLast(subSet);
	}

	/** Java の TreeSet.first()（空なら NoSuchElementException） */
	private subsetFirst(subSet: TreeSet<V>): V {
		if (subSet.size === 0)
			throw new Error("NoSuchElementException");
		return subSet.first()!;
	}

	private subsetLast(subSet: TreeSet<V>): V {
		if (subSet.size === 0)
			throw new Error("NoSuchElementException");
		return subSet.last()!;
	}

	/** Java の HashMap の keySet()（同じ順番） */
	keySet(): K[] {
		return this.subsetMap.keys() as K[];
	}

	/** values()（全体）と values(Object key)（キーの組。無ければ null） */
	values(...args: [] | [K | null]): V[] | null {
		if (args.length === 0)
			return [...this.objSet];
		const subSet = this.getSubset(args[0]);
		if (subSet === undefined)
			return null;
		return [...subSet];
	}

	/**
	 * Returns the key for the subset that has the greatest number of elements.
	 * @return key with the most elements.
	 */
	maxKey(): K | null {
		let ret: K | null = null;
		let n = 0;
		for (const [key, value] of this.subsetMap.entries()) {
			if (ret === null || value.size > n) {
				ret = key as K;
				n = value.size;
			}
		}
		return ret;
	}

	private getSubset(key: K | null): TreeSet<V> | undefined {
		if (key === null)
			return undefined;  // Java の HashMap は null のキーも持てるが、add は null のキーを入れない
		return this.subsetMap.get(key);
	}

	toString(): string {
		return "[" + [...this.objSet].map(v => String(v)).join(", ") + "]";
	}

}
