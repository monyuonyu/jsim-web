/*
 * Java の TreeMap・TreeSet（並び順つき）の代わり。
 * Copyright (C) 2026 shota
 * Licensed under the Apache License, Version 2.0
 *
 * 要素の数が多くない所で使う前提の、並べた配列による簡単なもの（追加は O(n)）。
 */
export type Comparator<K> = (a: K, b: K) => number;

function defaultCompare<K>(a: K, b: K): number {
	return a < b ? -1 : a > b ? 1 : 0;
}

export class TreeMap<K, V> {
	private keys: K[] = [];
	private vals: V[] = [];
	constructor(private cmp: Comparator<K> = defaultCompare) {}

	private find(k: K): { i: number; found: boolean } {
		let lo = 0, hi = this.keys.length;
		while (lo < hi) {
			const mid = (lo + hi) >> 1;
			const c = this.cmp(this.keys[mid], k);
			if (c === 0) return { i: mid, found: true };
			if (c < 0) lo = mid + 1; else hi = mid;
		}
		return { i: lo, found: false };
	}

	get size(): number { return this.keys.length; }
	get(k: K): V | undefined { const r = this.find(k); return r.found ? this.vals[r.i] : undefined; }
	has(k: K): boolean { return this.find(k).found; }
	set(k: K, v: V): this {
		const r = this.find(k);
		if (r.found) this.vals[r.i] = v;
		else { this.keys.splice(r.i, 0, k); this.vals.splice(r.i, 0, v); }
		return this;
	}
	delete(k: K): boolean {
		const r = this.find(k);
		if (!r.found) return false;
		this.keys.splice(r.i, 1); this.vals.splice(r.i, 1);
		return true;
	}
	clear(): void { this.keys = []; this.vals = []; }
	firstKey(): K | undefined { return this.keys[0]; }
	lastKey(): K | undefined { return this.keys[this.keys.length - 1]; }
	/** k 以下で最大のキー（floorKey） */
	floorKey(k: K): K | undefined { const r = this.find(k); return r.found ? this.keys[r.i] : this.keys[r.i - 1]; }
	/** k 以上で最小のキー（ceilingKey） */
	ceilingKey(k: K): K | undefined { return this.keys[this.find(k).i]; }
	*entries(): IterableIterator<[K, V]> { for (let i = 0; i < this.keys.length; i++) yield [this.keys[i], this.vals[i]]; }
	*keysIter(): IterableIterator<K> { yield* this.keys; }
	*values(): IterableIterator<V> { yield* this.vals; }
	[Symbol.iterator](): IterableIterator<[K, V]> { return this.entries(); }
}

export class TreeSet<K> {
	private map: TreeMap<K, true>;
	constructor(cmp?: Comparator<K>) { this.map = new TreeMap<K, true>(cmp); }
	get size(): number { return this.map.size; }
	add(k: K): boolean { if (this.map.has(k)) return false; this.map.set(k, true); return true; }
	has(k: K): boolean { return this.map.has(k); }
	delete(k: K): boolean { return this.map.delete(k); }
	clear(): void { this.map.clear(); }
	first(): K | undefined { return this.map.firstKey(); }
	last(): K | undefined { return this.map.lastKey(); }
	[Symbol.iterator](): IterableIterator<K> { return this.map.keysIter(); }
}
