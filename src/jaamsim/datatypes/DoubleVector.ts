/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2002-2011 Ausenco Engineering Canada Inc.
 * Copyright (C) 2022-2023 JaamSim Software Inc.
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
import { ErrorException } from "../internal.ts";
import { tr } from "../internal.ts";
import { IndexOutOfBoundsException, jformat } from "../internal.ts";

/*
 * 移植の注意:
 * - Java の ArrayIndexOutOfBoundsException は、lang.ts の IndexOutOfBoundsException（その親）で投げる。
 * - コンストラクタ DoubleVector(double... vals) は、DoubleVector(int) と DoubleVector(int, int) と
 *   見分けられないので、DoubleVector.ofValues(...vals) にした（docs/renamed.md）。
 *   ただし、配列（number[]）を 1 つ渡したときは、コンストラクタでも vals として受ける（Java の double[] を渡すのと同じ）。
 */

/** Java の new java.text.DecimalFormat("").format(x)（パターンが空: 桁区切りあり、整数部の最小桁 0、小数は最短の桁まで） */
function formatEmptyPattern(x: number): string {
	if (Number.isNaN(x)) return "NaN";
	if (x === Infinity) return "∞";
	if (x === -Infinity) return "-∞";
	const neg = x < 0 || Object.is(x, -0);
	const ax = Math.abs(x);
	if (ax === 0)
		return (neg ? "-" : "") + "0";
	// 最短の 10 進の桁（Java の Double.toString と同じ桁）
	const [mant, ex] = ax.toExponential().split("e");
	const digits = mant.replace(".", "");
	const exp = Number(ex);
	let intPart: string, frac: string;
	if (exp >= 0) {
		const d = digits.padEnd(exp + 1, "0");
		intPart = d.slice(0, exp + 1);
		frac = d.slice(exp + 1);
	}
	else {
		intPart = "";
		frac = "0".repeat(-exp - 1) + digits;
	}
	frac = frac.replace(/0+$/, "");
	intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
	let s = intPart + (frac === "" ? "" : "." + frac);
	if (intPart === "" && frac === "")
		s = "0";
	return (neg ? "-" : "") + s;
}

/**
 * This class stores double values in an array.
 */
export class DoubleVector {
	private numElements: number;
	private capIncrement: number;
	private storage: number[];

	/**
	 * DoubleVector(): Construct an empty vector, size 10, size increment 5.
	 * DoubleVector(int initialCapacity): Construct an empty vector with the given initial capacity and with its
	 * capacity increment equal to one.
	 * DoubleVector(DoubleVector original)
	 * DoubleVector(double[] vals)（Java の double... に配列を渡したとき）
	 * DoubleVector(int initialCapacity, int capacityIncrement): Construct an empty vector with the given initial capacity and capacity
	 * increment.
	 */
	constructor();
	constructor(initialCapacity: number);
	constructor(original: DoubleVector);
	constructor(vals: number[]);
	constructor(initialCapacity: number, capacityIncrement: number);
	constructor(a?: number | DoubleVector | number[], b?: number) {
		if (a instanceof DoubleVector) {
			const original = a;
			this.numElements = original.numElements;
			this.capIncrement = 1;
			this.storage = new Array<number>(this.numElements).fill(0.0);
			for (let i = 0; i < this.numElements; i++)
				this.storage[i] = original.storage[i];
			return;
		}
		if (Array.isArray(a)) {
			const vals = a;
			// this(vals.length)
			this.storage = new Array<number>(vals.length).fill(0.0);
			this.capIncrement = 1;
			this.numElements = 0;
			this.numElements = vals.length;
			for (let i = 0; i < this.numElements; i++)
				this.storage[i] = vals[i];
			return;
		}
		const initialCapacity = a === undefined ? 10 : a;
		const capacityIncrement = a === undefined ? 5 : b === undefined ? 1 : b;
		this.storage = new Array<number>(initialCapacity).fill(0.0);
		this.capIncrement = capacityIncrement;
		this.numElements = 0;
	}

	/** Java の DoubleVector(double... vals) */
	static ofValues(...vals: number[]): DoubleVector {
		return new DoubleVector(vals);
	}

	private ensureCapacity(newCapacity: number): void {
		if (this.storage.length >= newCapacity)
			return;

		if (this.storage.length + this.capIncrement >= newCapacity) {
			newCapacity = this.storage.length + this.capIncrement;
		}

		const copy = new Array<number>(newCapacity).fill(0.0);
		for (let i = 0; i < this.storage.length; i++)
			copy[i] = this.storage[i];
		this.storage = copy;
	}

	/**
	 * Remove all of the doubles from this vector.
	 */
	clear(): void {
		this.numElements = 0;
	}

	/**
	 * Return the double at the given position in this vector.
	 */
	get(index: number): number {
		if (index < 0 || index >= this.numElements)
			throw new IndexOutOfBoundsException(jformat(tr("Invalid index:%d"), index));
		else
			return this.storage[index];
	}

	/**
	 * Return the last double in this vector.
	 */
	lastElement(): number {
		return this.get(this.size() - 1);
	}

	/**
	 * add(double value): Append the specified double to the end of the vector.
	 * add(int index, double value): insert at the index
	 * add(DoubleVector vec): Add the specified vector to this vector (element by element).
	 */
	add(value: number): void;
	add(index: number, value: number): void;
	add(vec: DoubleVector): void;
	add(a: number | DoubleVector, b?: number): void {
		if (a instanceof DoubleVector) {
			const vec = a;
			if( this.size() !== vec.size() ) {
				throw new ErrorException(tr("Both vectors should have the same size"));
			}
			for( let i = 0; i < this.size(); i++ ) {
				this.addAt( vec.get( i ), i );
			}
			return;
		}
		if (b === undefined) {
			this.add(this.numElements, a);
			return;
		}
		const index = a, value = b;
		if (index < 0 || index > this.numElements) {
			throw new IndexOutOfBoundsException(jformat(tr("Invalid index:%d"), index));
		}
		this.ensureCapacity(this.numElements + 1);
		// If not a simple append, move later entries one further to the right
		if (index !== this.numElements) {
			this.storage.copyWithin(index + 1, index, this.numElements);
		}
		this.storage[index] = value;
		this.numElements++;
	}

	/**
	 * set(int index, double value): Replaces the element at the specified position in this DoubleVector with the
	 * specified element. Returns the element that was replaced in the DoubleVector.
	 * set(DoubleVector original): Copy the specified vector to this vector.
	 *
	 * @param index index of element to replace
	 * @param value element to be stored at the specified position
	 * @return the element previously at the specified position
	 * @exception ArrayIndexOutOfBoundsException index out of range (index < 0 || index >= size())
	 */
	set(index: number, value: number): number;
	set(original: DoubleVector): void;
	set(a: number | DoubleVector, b?: number): number | void {
		if (a instanceof DoubleVector) {
			const original = a;
			this.clear();

			for (let i=0; i<original.size(); i++) {
				this.add(original.get(i));
			}
			return;
		}
		const index = a, value = b!;
		if (index < 0 || index >= this.numElements) {
			throw new IndexOutOfBoundsException(jformat(tr("Invalid index:%d"), index));
		}

		const old = this.storage[index];
		this.storage[index] = value;
		return old;
	}

	/**
	 * Removes the element at the specified position in this DoubleVector. Shifts any
	 * subsequent elements to the left (subtracts one from their indices). Returns the
	 * element that was removed from the DoubleVector.
	 *
	 * @param index the index of the element to removed
	 * @return element that was removed
	 */
	remove( index: number ): number {
		if (index < 0 || index >= this.numElements) {
			throw new IndexOutOfBoundsException(jformat(tr("Invalid index:%d"), index));
		}

		const old = this.storage[index];
		// If not removing last element, shift later elements one to the left
		if (index !== this.numElements - 1) {
			this.storage.copyWithin(index, index + 1, this.numElements);
		}
		this.numElements--;
		return old;
	}

	/**
	 * Add the specified value to the value at the specified index.
	 */
	addAt( value: number, index: number ): void {
		this.set(index, (this.get( index ) + value));
	}

	/**
	 * Subtract the specified value from the value at the specified index.
	 */
	subAt( value: number, index: number ): void {
		this.set(index, (this.get( index ) - value));
	}

	/**
	 * Return the sum of the doubles in this vector.
	 */
	sum(): number {
		// Create a temporary double
		let total = 0.0;

		// Add the double values to the total
		for( let i = 0; i < this.size(); i++ ) {
			total += this.get( i );
		}

		return total;
	}

	/**
	 * Fill the vector with the given number of entries of the given value.
	 */
	fillWithEntriesOf( entries: number, value: number ): void {
		this.ensureCapacity(entries);
		this.storage.fill(value);
		this.numElements = entries;
	}

	/**
	 * Return the number of doubles in this vector.
	 */
	size(): number {
		return this.numElements;
	}

	/**
	 * Return the current capacity of this vector.
	 */
	capacity(): number {
		return this.storage.length;
	}

	/**
	 * toString(String str): Return a string containing the contents of the DoubleVector.
	 * （str は java.text.DecimalFormat のパターン）
	 * toString(): toString("")
	 */
	toString( str: string = "" ): string {

		// TODO(移植): java.text.DecimalFormat は空のパターン（toString() が使う）だけを写した。ほかのパターンも空と同じに書く
		const formatter = { format: (v: number) => formatEmptyPattern(v) };
		void str;

		let x: number;
		let out = "";

		if( this.size() > 0 ) {
			x = this.get( 0 );
			out += "{ ";
			out += formatter.format(x);

			for( let i = 1; i < this.size(); i++ ) {
				x = this.get( i );
				out += ", ";
				out += formatter.format(x);
			}
			out += " }";
		}
		else {
			out += "{ }";
		}
		return out;
	}

	getMin(): number {
		if( this.size() < 1 ) {
			return 0.0;
		}
		else {
			let testValue = this.get( 0 );
			for( let i = 1; i < this.size(); i++ ) {
				testValue = Math.min( testValue, this.get( i ) );
			}
			return testValue;
		}
	}

	getMax(): number {
		if( this.size() < 1 ) {
			return 0.0;
		}
		else {
			let testValue = this.get( 0 );
			for( let i = 1; i < this.size(); i++ ) {
				testValue = Math.max( testValue, this.get( i ) );
			}
			return testValue;
		}
	}

	indexOf( testValue: number ): number {
		for (let i = 0; i < this.numElements; i++) {
			if (this.storage[i] === testValue) {
				return i;
			}
		}
		return -1;
	}

	/**
	 * Reverse the elements position n to 0 and 0 to n
	 */
	reverse(): void {
		const numSwaps = Math.trunc(this.size() / 2);
		let swapIndex = this.size() - 1;

		for (let i = 0; i < numSwaps; i++, swapIndex--) {
			const temp = this.get(swapIndex);
			this.set(swapIndex, this.get(i));
			this.set(i, temp);
		}
	}

	toArray(): number[] {
		return this.storage;
	}

}
