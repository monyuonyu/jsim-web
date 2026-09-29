/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2016-2026 JaamSim Software Inc.
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
//
// 入れ子のクラス（ListCollection など）は、このファイルの中だけのクラスにした（Java でも private）。
//
// Java の HashMap<String, ExpResult>（地図の式 {"a" = 1} や、その写し）は、回す順番が結果（sum・map・表示の文字列）に効くので、
// Java の HashMap と同じ順番で回る StringHashMap をこのファイルに作って使う（下のほう）。
import type { JClass } from "../java/lang.ts";
import { jformat, jstr, jIsAssignableFrom } from "../java/lang.ts";
import { tr } from "../i18n/I18n.ts";
import type { JaamSimModel } from "../basicsim/JaamSimModel.ts";
import { DoubleVector } from "../datatypes/DoubleVector.ts";
import { IntegerVector } from "../datatypes/IntegerVector.ts";
import { Vec3d } from "../math/Vec3d.ts";
import { DimensionlessUnit } from "../units/DimensionlessUnit.ts";
import { Unit } from "../units/Unit.ts";
import { ExpError } from "./ExpError.ts";
import { ExpEvaluator } from "./ExpEvaluator.ts";
import { ExpResType } from "./ExpResType.ts";
import { ExpResult } from "./ExpResult.ts";

type UnitClass = JClass<Unit>;
type Iterator = ExpResult.Iterator;

/** Java の (int) x（double → int。0 の方向へ切り捨て、NaN は 0、int の範囲に収める） */
function d2i(x: number): number {
	if (Number.isNaN(x)) return 0;
	if (x >= 2147483647) return 2147483647;
	if (x <= -2147483648) return -2147483648;
	return Math.trunc(x);
}

/** Java の (int)index.value - 1（int の引き算なので、あふれると回り込む） */
function toZeroBasedIndex(value: number): number {
	return (d2i(value) - 1) | 0;
}

/** 読むだけの地図（JS の Map か StringHashMap） */
interface ReadableMap {
	get(key: unknown): unknown;
	keys(): Iterable<unknown>;
	readonly size: number;
}


export class ExpCollections {

	/**
	 * Java の isCollectionClass(Class<?>)。
	 * klass はクラス（Map・Array・DoubleVector・IntegerVector・Vec3d・StringHashMap とその子）か、
	 * 出力の型の名前（OutputRegistry の returnType: "double[]" "ArrayList" "HashMap" など）。
	 */
	public static isCollectionClass(klass: unknown): boolean {
		if (typeof klass === "string") {
			if (klass.endsWith("[]"))
				return true;
			return klass === "DoubleVector" || klass === "IntegerVector" || klass === "Vec3d"
					|| klass === "ArrayList" || klass === "List"
					|| klass === "LinkedHashMap" || klass === "HashMap" || klass === "Map";
		}
		if (typeof klass !== "function")
			return false;
		const c = klass as JClass;
		if (jIsAssignableFrom(Map, c) || jIsAssignableFrom(StringHashMap, c)) {
			return true;
		}
		if (jIsAssignableFrom(Array, c)) {
			return true;
		}
		if (jIsAssignableFrom(DoubleVector, c)) {
			return true;
		}
		if (jIsAssignableFrom(IntegerVector, c)) {
			return true;
		}
		if (jIsAssignableFrom(Vec3d, c)) {
			return true;
		}
		if (c === Float64Array || c === Float32Array || c === Int32Array || c === Int16Array || c === Int8Array) {
			return true;
		}

		return false;
	}

	/** 値が集まり（Java の isCollectionClass(val.getClass())）かどうか */
	public static isCollectionObject(val: unknown): boolean {
		return val instanceof Map || val instanceof StringHashMap || Array.isArray(val) || ArrayBuffer.isView(val)
				|| val instanceof DoubleVector || val instanceof IntegerVector || val instanceof Vec3d;
	}


	/**
	 * Wrap an existing Java collection in an expression collection
	 * @param obj - collection object to be wrapped
	 * @param ut - unit type
	 * @return - Read-only ExpResult representing the collection
	 */
	public static wrapCollection(obj: unknown, ut: UnitClass | null): ExpResult {
		if (obj instanceof Map || obj instanceof StringHashMap) {
			// TODO(順番): JS の Map は足した順に回る。Java の HashMap（出力の戻り値）とは順番が違う。
			// Java と同じ順番にしたい出力は、StringHashMap を返すようにする
			const col = new MapCollection(obj as ReadableMap, ut);
			return ExpResult.makeCollectionResult(col);
		}

		// Java の List と配列は、JS ではどちらも配列になる（配列として扱う）
		if (Array.isArray(obj) || ArrayBuffer.isView(obj)) {
			const col = new ArrayCollection(obj as ArrayLike<unknown>, ut);
			return ExpResult.makeCollectionResult(col);
		}

		if (obj instanceof DoubleVector) {
			const col = new DoubleVectorCollection(obj, ut);
			return ExpResult.makeCollectionResult(col);
		}

		if (obj instanceof IntegerVector) {
			const col = new IntegerVectorCollection(obj, ut);
			return ExpResult.makeCollectionResult(col);
		}

		if (obj instanceof Vec3d) {
			const v = obj;
			const col = new ListCollection([
					ExpResult.makeNumResult(v.x, ut),
					ExpResult.makeNumResult(v.y, ut),
					ExpResult.makeNumResult(v.z, ut)], ut);
			return ExpResult.makeCollectionResult(col);
		}

		return null as unknown as ExpResult;
	}

	/**
	 * Create an expression collection that may be assigned into (aka: written).
	 * This obeys a single level of copy-on-write semantics if the original object is marked as constant
	 * @param vals - The original values for the collection (may be an ArrayList or Map)
	 * @param constExp - Is the original a constant?
	 */
	public static makeAssignableArrrayCollection(vals: ExpResult[], constExp: boolean): ExpResult {
		return ExpResult.makeCollectionResult(new AssignableArrayCollection(vals, constExp));
	}

	/** vals は StringHashMap（Java の HashMap と同じ順番）。JS の Map を渡したときは、その順番で StringHashMap に入れ直す */
	public static makeAssignableMapCollection(vals: StringHashMap<ExpResult> | Map<string, ExpResult>, constExp: boolean): ExpResult {
		let m: StringHashMap<ExpResult>;
		if (vals instanceof StringHashMap) {
			m = vals;
		}
		else {
			// TODO(順番): JS の Map から作ると、Java の HashMap に入れた順番が分からないので、Map の順番で入れる
			m = new StringHashMap<ExpResult>();
			for (const [k, v] of vals)
				m.put(k, v);
		}
		return ExpResult.makeCollectionResult(new AssignableMapCollection(m, constExp));
	}

	/** @throws ExpError */
	public static appendCollections(c0: ExpResult.Collection, c1: ExpResult.Collection): ExpResult {
		const res: ExpResult[] = [];
		let it = c0.getIter();
		while (it.hasNext()) {
			const val = c0.index(it.nextKey());
			res.push(val);
		}
		it = c1.getIter();
		while (it.hasNext()) {
			const val = c1.index(it.nextKey());
			res.push(val);
		}
		return ExpResult.makeCollectionResult(new AssignableArrayCollection(res, false));
	}

	/** @throws ExpError */
	public static appendToCollection(col: ExpResult.Collection, val: ExpResult): ExpResult {
		const res: ExpResult[] = [];
		const it = col.getIter();
		while (it.hasNext()) {
			const v = col.index(it.nextKey());
			res.push(v);
		}
		res.push(val);

		return ExpResult.makeCollectionResult(new AssignableArrayCollection(res, false));
	}
}

/** 番号（1, 2, 3, …）を順に返す Iterator（ListCollection.Iter など、同じ形のものをまとめた） */
class IndexIter implements ExpResult.Iterator {

	private next = 0;
	private readonly sizeOf: () => number;
	constructor(sizeOf: () => number) {
		this.sizeOf = sizeOf;
	}

	public hasNext(): boolean {
		return this.next < this.sizeOf();
	}

	public nextKey(): ExpResult {
		const ret = ExpResult.makeNumResult(this.next + 1, DimensionlessUnit);
		this.next++;
		return ret;
	}
}

class ListCollection implements ExpResult.Collection {

	public getIter(): Iterator {
		const list = this.list;
		return new IndexIter(() => list.length);
	}

	private readonly list: unknown[];
	private readonly unitType: UnitClass | null;

	constructor(l: unknown[], ut: UnitClass | null) {
		this.list = l;
		this.unitType = ut;
	}

	public index(index: ExpResult): ExpResult {
		if (index.type !== ExpResType.NUMBER) {
			throw new ExpError(null, 0, tr("ArrayList  is not being indexed by a number"));
		}

		const indexVal = toZeroBasedIndex(index.value); // Expressions use 1-base arrays

		if (indexVal >= this.list.length  || indexVal < 0) {
			return ExpResult.makeNumResult(0, this.unitType); // TODO: Is this how we want to handle this case?
		}
		const val = this.list[indexVal];

		return ExpEvaluator.getResultFromObject(val, this.unitType);
	}

	public getSize(): number {
		return this.list.length;
	}

	public assign(_key: ExpResult, _value: ExpResult): ExpResult.Collection {
		throw new ExpError(null, 0, tr("Can not assign to built in collection"));
	}

	public getOutputString(simModel: JaamSimModel | null): string {
		try {
			let sb = "";
			sb += "{";
			for (let i = 0; i < this.list.length; ++i) {
				const val = this.index(ExpResult.makeNumResult(i+1, DimensionlessUnit));
				sb += val.getOutputString(simModel);
				if (i < this.list.length -1) {
					sb += ", ";
				}
			}
			sb += "}";
			return sb;

		} catch (err) {
			if (!(err instanceof ExpError)) throw err;
			return jformat(tr("An error occurred: %s"), err.getMessage());
		}
	}
	public getCopy(): ExpResult.Collection {
		return this;
	}
}

/**
 * Java の ArrayCollection（配列を包む）。JS では Java の List も配列なので、List もここで包む。
 * 数・真偽値は Java の基本型の配列と同じに扱い、それ以外は getResultFromObject に渡す。
 */
class ArrayCollection implements ExpResult.Collection {

	private readonly array: ArrayLike<unknown>;
	private readonly unitType: UnitClass | null;

	constructor(a: ArrayLike<unknown>, ut: UnitClass | null) {
		this.array = a;
		this.unitType = ut;
	}

	public getIter(): Iterator {
		const array = this.array;
		return new IndexIter(() => array.length);
	}

	public index(index: ExpResult): ExpResult {
		if (index.type !== ExpResType.NUMBER) {
			throw new ExpError(null, 0, tr("ArrayList  is not being indexed by a number"));
		}

		const indexVal = toZeroBasedIndex(index.value);

		const length = this.array.length;

		if (indexVal >= length  || indexVal < 0) {
			return ExpResult.makeNumResult(0, this.unitType); // TODO: Is this how we want to handle this case?
		}

		const val = this.array[indexVal];

		if (typeof val === "number") {
			// This is a numeric type and should be convertible to double
			return ExpResult.makeNumResult(val, this.unitType);
		}
		if (typeof val === "boolean") {
			// Convert boolean to 1 or 0
			// TODO(移植): Java の List<Boolean> なら getResultFromObject で誤りになる（boolean[] なら 1/0）。JS では見分けられない
			const d = val ? 1.0 : 0.0;
			return ExpResult.makeNumResult(d, this.unitType);
		}

		// This is an object type so we can use the rest of the reflection system as usual
		return ExpEvaluator.getResultFromObject(val, this.unitType);
	}
	public getSize(): number {
		return this.array.length;
	}
	public assign(_key: ExpResult, _value: ExpResult): ExpResult.Collection {
		throw new ExpError(null, 0, tr("Can not assign to built in collection"));
	}

	public getOutputString(simModel: JaamSimModel | null): string {
		try {
			let sb = "";
			sb += "{";
			for (let i = 0; i < this.array.length; ++i) {
				const val = this.index(ExpResult.makeNumResult(i+1, DimensionlessUnit));
				sb += val.getOutputString(simModel);
				if (i < this.array.length -1) {
					sb += ", ";
				}
			}
			sb += "}";
			return sb;

		} catch (err) {
			if (!(err instanceof ExpError)) throw err;
			return jformat(tr("An error occurred: %s"), err.getMessage());
		}
	}
	public getCopy(): ExpResult.Collection {
		return this;
	}

}

class DoubleVectorCollection implements ExpResult.Collection {

	private readonly vector: DoubleVector;
	private readonly unitType: UnitClass | null;

	constructor(v: DoubleVector, ut: UnitClass | null) {
		this.vector = v;
		this.unitType = ut;
	}

	public getIter(): Iterator {
		const vector = this.vector;
		return new IndexIter(() => vector.size());
	}

	public index(index: ExpResult): ExpResult {

		if (index.type !== ExpResType.NUMBER) {
			throw new ExpError(null, 0, tr("DoubleVector is not being indexed by a number"));
		}

		const indexVal = toZeroBasedIndex(index.value); // Expressions use 1-base arrays

		if (indexVal >= this.vector.size() || indexVal < 0) {
			return ExpResult.makeNumResult(0, this.unitType); // TODO: Is this how we want to handle this case?
		}

		const value = this.vector.get(indexVal);
		return ExpResult.makeNumResult(value, this.unitType);
	}
	public getSize(): number {
		return this.vector.size();
	}
	public assign(_key: ExpResult, _value: ExpResult): ExpResult.Collection {
		throw new ExpError(null, 0, tr("Can not assign to built in collection"));
	}

	public getOutputString(simModel: JaamSimModel | null): string {
		let factor = 1.0;
		let unitStr = Unit.getSIUnit(this.unitType);
		if (simModel !== null) {
			factor = simModel.getDisplayedUnitFactor(this.unitType!);
			unitStr = simModel.getDisplayedUnit(this.unitType!);
		}
		if (unitStr !== "") {
			unitStr = "[" + unitStr + "]";
		}
		let sb = "";
		sb += "{";
		for (let i = 0; i < this.vector.size(); ++i) {
			sb += jstr(this.vector.get(i)/factor);
			sb += unitStr;
			if (i < this.vector.size() - 1) {
				sb += ", ";
			}
		}
		sb += "}";
		return sb;
	}

	public getCopy(): ExpResult.Collection {
		return this;
	}
}

class IntegerVectorCollection implements ExpResult.Collection {

	private readonly vector: IntegerVector;
	private readonly unitType: UnitClass | null;

	constructor(v: IntegerVector, ut: UnitClass | null) {
		this.vector = v;
		this.unitType = ut;
	}

	public getIter(): Iterator {
		const vector = this.vector;
		return new IndexIter(() => vector.size());
	}

	public index(index: ExpResult): ExpResult {

		if (index.type !== ExpResType.NUMBER) {
			throw new ExpError(null, 0, tr("IntegerVector is not being indexed by a number"));
		}

		const indexVal = toZeroBasedIndex(index.value); // Expressions use 1-base arrays

		if (indexVal >= this.vector.size() || indexVal < 0) {
			return ExpResult.makeNumResult(0, this.unitType); // TODO: Is this how we want to handle this case?
		}

		const value = this.vector.get(indexVal);
		return ExpResult.makeNumResult(value, this.unitType);
	}
	public getSize(): number {
		return this.vector.size();
	}
	public assign(_key: ExpResult, _value: ExpResult): ExpResult.Collection {
		throw new ExpError(null, 0, tr("Can not assign to built in collection"));
	}

	public getOutputString(simModel: JaamSimModel | null): string {
		let factor = 1.0;
		let unitStr = Unit.getSIUnit(this.unitType);
		if (simModel !== null) {
			factor = simModel.getDisplayedUnitFactor(this.unitType!);
			unitStr = simModel.getDisplayedUnit(this.unitType!);
		}
		if (unitStr !== "") {
			unitStr = "[" + unitStr + "]";
		}
		let sb = "";
		sb += "{";
		for (let i = 0; i < this.vector.size(); ++i) {
			sb += jstr(this.vector.get(i)/factor);  // int / double は double
			sb += unitStr;
			if (i < this.vector.size() - 1) {
				sb += ", ";
			}
		}
		sb += "}";
		return sb;
	}

	public getCopy(): ExpResult.Collection {
		return this;
	}
}

/** 地図の鍵を順に返す Iterator（Java の MapCollection.Iter と AssignableMapCollection.Iter） */
class MapKeyIter implements ExpResult.Iterator {

	private readonly keys: unknown[];
	private pos = 0;
	constructor(map: ReadableMap) {
		this.keys = [...map.keys()];
	}

	public hasNext(): boolean {
		return this.pos < this.keys.length;
	}

	public nextKey(): ExpResult {
		const mapKey = this.keys[this.pos++];

		return ExpEvaluator.getResultFromObject(mapKey, DimensionlessUnit);
	}
}

class MapCollection implements ExpResult.Collection {

	private readonly map: ReadableMap;
	private readonly unitType: UnitClass | null;

	constructor(m: ReadableMap, ut: UnitClass | null) {
		this.map = m;
		this.unitType = ut;
	}

	public getIter(): Iterator {
		return new MapKeyIter(this.map);
	}

	public index(index: ExpResult): ExpResult {
		let key: unknown;
		switch (index.type) {
		case ExpResType.ENTITY:
			if (index.entVal === null) {
				throw new ExpError(null, 0, tr("Trying use a null entity as a key"));
			}

			key = index.entVal;
			break;
		case ExpResType.NUMBER:
			// TODO(移植): Java は Double の鍵で引く（Integer の鍵の地図は引けない）。JS の Map は数ならどちらでも引ける
			key = index.value;
			break;
		case ExpResType.STRING:
			key = index.stringVal;
			break;
		case ExpResType.COLLECTION:
			throw new ExpError(null, 0, tr("Can not index with a collection"));
		default:
			key = null;
			break;
		}
		const val = this.map.get(key);
		if (val === null || val === undefined) {
			return ExpResult.makeNumResult(0, this.unitType); // TODO: Is this how we want to handle this case?
		}
		return ExpEvaluator.getResultFromObject(val, this.unitType);
	}
	public getSize(): number {
		return this.map.size;
	}
	public assign(_key: ExpResult, _value: ExpResult): ExpResult.Collection {
		throw new ExpError(null, 0, tr("Can not assign to built in collection"));
	}
	public getOutputString(simModel: JaamSimModel | null): string {
		try {
			let sb = "";
			sb += "{";
			const it = this.getIter();
			while(it.hasNext()) {
				const index = it.nextKey();
				sb += index.getOutputString(simModel);
				sb += " = ";
				sb += this.index(index).getOutputString(simModel);
				if (it.hasNext()) {
					sb += ", ";
				}
			}
			sb += "}";
			return sb;

		} catch (err) {
			if (!(err instanceof ExpError)) throw err;
			return jformat(tr("An error occurred: %s"), err.getMessage());
		}
	}

	public getCopy(): ExpResult.Collection {
		return this;
	}
}
class AssignableArrayCollection implements ExpResult.Collection {

	private readonly list: ExpResult[];
	private readonly isConstExp: boolean;

	constructor(vals: ExpResult[], constExp: boolean) {
		this.isConstExp = constExp;
		if (this.isConstExp) {
			this.list = vals;
		} else {
			this.list = vals.slice();
		}
	}

	public index(index: ExpResult): ExpResult {
		if (index.type !== ExpResType.NUMBER) {
			throw new ExpError(null, 0, tr("ArrayList is not being indexed by a number"));
		}

		const indexVal = toZeroBasedIndex(index.value); // Expressions use 1-base arrays

		if (indexVal >= this.list.length  || indexVal < 0) {
			return ExpResult.makeNumResult(0, DimensionlessUnit); // TODO: Is this how we want to handle this case?
		}
		return this.list[indexVal];
	}

	public assign(index: ExpResult, value: ExpResult): ExpResult.Collection {

		if (this.isConstExp) {
			// This version is a constant, and therefore shareable. Create a new modifiable copy.
			const copy = this.getCopy();
			return copy.assign(index,  value);
		}

		if (index.type !== ExpResType.NUMBER) {
			throw new ExpError(null, 0, tr("Assignment is not being indexed by a number"));
		}
		const indexVal = toZeroBasedIndex(index.value); // Expressions use 1-base arrays
		if (indexVal < 0) {
			throw new ExpError(null, 0, tr("Attempting to assign to a negative number: %d"), indexVal);
		}
		if (indexVal >= this.list.length) {
			// This is a dynamically expanding list, so fill in until we get to the index
			const filler = ExpResult.makeNumResult(0, DimensionlessUnit);
			for (let i = this.list.length; i <= indexVal; ++i) {
				this.list.push(filler);
			}
		}
		this.list[indexVal] = value;
		return this;
	}

	public getIter(): Iterator {
		const list = this.list;
		return new IndexIter(() => list.length);
	}

	public getSize(): number {
		return this.list.length;
	}
	public getOutputString(simModel: JaamSimModel | null): string {
		try {
			let sb = "";
			sb += "{";
			for (let i = 0; i < this.list.length; ++i) {
				const val = this.index(ExpResult.makeNumResult(i+1, DimensionlessUnit));
				sb += val.getOutputString(simModel);
				if (i < this.list.length -1) {
					sb += ", ";
				}
			}
			sb += "}";
			return sb;

		} catch (err) {
			if (!(err instanceof ExpError)) throw err;
			return jformat(tr("An error occurred: %s"), err.getMessage());
		}
	}

	public getCopy(): ExpResult.Collection {
		return new AssignableArrayCollection(this.list, false);
	}

}
class AssignableMapCollection implements ExpResult.Collection {

	private readonly map: StringHashMap<ExpResult>;
	private readonly isConstExp: boolean;

	constructor(initMap: StringHashMap<ExpResult>, constExp: boolean) {
		this.isConstExp = constExp;
		if (this.isConstExp) {
			this.map = initMap;
		} else {
			this.map = StringHashMap.copyOf(initMap);
		}
	}

	public index(index: ExpResult): ExpResult {
		if (index.type !== ExpResType.STRING) {
			throw new ExpError(null, 0, tr("Map is not being indexed by a string"));
		}

		const indexVal = index.stringVal!;

		const res = this.map.get(indexVal);

		if (res === null || res === undefined) {
			return ExpResult.makeNumResult(0, DimensionlessUnit); // TODO: Is this how we want to handle this case?
		}
		return res;
	}

	public assign(index: ExpResult, value: ExpResult): ExpResult.Collection {

		if (this.isConstExp) {
			// This version is a constant, and therefore shareable. Create a new modifiable copy.
			const copy = this.getCopy();
			return copy.assign(index,  value);
		}

		if (index.type !== ExpResType.STRING) {
			throw new ExpError(null, 0, tr("Assignment is not being indexed by a string"));
		}

		const indexVal = index.stringVal!;

		this.map.put(indexVal, value);
		return this;
	}

	public getIter(): Iterator {
		return new MapKeyIter(this.map);
	}

	public getSize(): number {
		return this.map.size;
	}
	public getOutputString(simModel: JaamSimModel | null): string {
		try {
			let sb = "";
			sb += "{";
			const it = this.getIter();
			while(it.hasNext()) {
				const index = it.nextKey();
				sb += index.getOutputString(simModel);
				sb += " = ";
				sb += this.index(index).getOutputString(simModel);
				if (it.hasNext()) {
					sb += ", ";
				}
			}
			sb += "}";
			return sb;

		} catch (err) {
			if (!(err instanceof ExpError)) throw err;
			return jformat(tr("An error occurred: %s"), err.getMessage());
		}
	}

	public getCopy(): ExpResult.Collection {
		return new AssignableMapCollection(this.map, false);
	}

}

// ---------------------------------------------------------------------------
// Java の HashMap<String, V> と同じ順番で回る地図（移植で足したもの。Java には無い）
// ---------------------------------------------------------------------------

/** Java の String.hashCode() */
function javaStringHash(s: string): number {
	let h = 0;
	for (let i = 0; i < s.length; i++)
		h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
	return h;
}

/** Java の HashMap.hash(key) = h ^ (h >>> 16) */
function javaSpreadHash(s: string): number {
	const h = javaStringHash(s);
	return h ^ (h >>> 16);
}

/** Java の HashMap.tableSizeFor(cap) */
function tableSizeFor(cap: number): number {
	let n = 1;
	while (n < cap)
		n *= 2;
	return Math.min(n, 1 << 30);
}

/**
 * 鍵が文字列の Java の HashMap の代わり（消すことは無い前提）。
 * 回す順番は Java と同じ: 表の大きさ（capacity）で決まる箱の番号の順、同じ箱の中は入れた順。
 * 表の大きさは Java と同じく、既定 16・要素が 0.75 倍を超えたら 2 倍、1 つの箱が 8 個を超えたら（64 未満のとき）2 倍。
 */
export class StringHashMap<V> {
	private readonly vals = new Map<string, V>();
	/** 入れた順（同じ箱の中の順番を決める） */
	private readonly order: string[] = [];
	private capacity = 0;   // 0 は表がまだ無い
	private threshold = 0;
	private sorted: string[] | null = null;

	/** Java の new HashMap<>(m)（m の回る順に入れる。JDK 19 以降の大きさの決め方） */
	public static copyOf<V>(m: StringHashMap<V>): StringHashMap<V> {
		const ret = new StringHashMap<V>();
		const s = m.size;
		if (s > 0) {
			const dt = Math.ceil(s / 0.75);
			const t = dt < (1 << 30) ? Math.trunc(dt) : (1 << 30);
			if (t > ret.threshold)
				ret.threshold = tableSizeFor(t);
		}
		for (const k of m.keys())
			ret.put(k, m.get(k) as V);
		return ret;
	}

	get size(): number {
		return this.vals.size;
	}

	get(key: unknown): V | undefined {
		return typeof key === "string" ? this.vals.get(key) : undefined;
	}

	has(key: string): boolean {
		return this.vals.has(key);
	}

	/** Java の put(key, value) */
	put(key: string, value: V): void {
		if (this.vals.has(key)) {
			this.vals.set(key, value);  // 置き換え（順番は変わらない）
			return;
		}
		if (this.capacity === 0)
			this.resize();
		// 同じ箱にすでに 8 個以上あれば treeifyBin（表が 64 未満なら大きくする）
		const bin = javaSpreadHash(key) & (this.capacity - 1);
		let n = 0;
		for (const k of this.order)
			if ((javaSpreadHash(k) & (this.capacity - 1)) === bin)
				n++;
		if (n >= 8 && this.capacity < 64)
			this.resize();
		// TODO(順番): 表が 64 以上で 1 つの箱が 8 個を超えると、Java は木にして順番が少し変わる（まず起きないので写していない）
		this.vals.set(key, value);
		this.order.push(key);
		this.sorted = null;
		if (this.vals.size > this.threshold)
			this.resize();
	}

	/** Java の HashMap.resize() の大きさの計算 */
	private resize(): void {
		const oldCap = this.capacity;
		const oldThr = this.threshold;
		let newCap: number, newThr: number;
		if (oldCap > 0) {
			newCap = oldCap * 2;
			newThr = oldCap >= 16 ? oldThr * 2 : Math.trunc(newCap * 0.75);
		}
		else if (oldThr > 0) {
			newCap = oldThr;
			newThr = Math.trunc(newCap * 0.75);
		}
		else {
			newCap = 16;
			newThr = 12;
		}
		this.capacity = newCap;
		this.threshold = newThr;
		this.sorted = null;
	}

	/** Java の keySet() の順番 */
	keys(): string[] {
		if (this.sorted === null) {
			const cap = this.capacity;
			const withBin = this.order.map((k, i) => ({ k, i, b: javaSpreadHash(k) & (cap - 1) }));
			withBin.sort((a, b) => a.b - b.b || a.i - b.i);
			this.sorted = withBin.map(e => e.k);
		}
		return this.sorted.slice();
	}

	/** Java の entrySet() の順番 */
	entries(): [string, V][] {
		return this.keys().map(k => [k, this.vals.get(k) as V]);
	}
}
