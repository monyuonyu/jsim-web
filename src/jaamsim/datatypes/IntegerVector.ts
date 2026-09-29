/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2002-2011 Ausenco Engineering Canada Inc.
 * Copyright (C) 2022-2026 JaamSim Software Inc.
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
import { tr } from "../i18n/I18n.ts";
import { IndexOutOfBoundsException, jformat } from "../java/lang.ts";

/*
 * 移植の注意:
 * - Java の ArrayIndexOutOfBoundsException は、lang.ts の IndexOutOfBoundsException（その親）で投げる。
 * - int の足し算・引き算のあふれ（2^31 を越えると負になる）も Java と同じにするため、| 0 で 32 ビットに丸める。
 */

/**
 * This class stores integer values in an array.
 */
export class IntegerVector {
	private numElements: number;
	private capIncrement: number;
	private storage: number[];

	/**
	 * IntegerVector(): Construct an empty vector, size 10, size increment 5.
	 * IntegerVector(int initialCapacity): Construct an empty vector with the given initial capacity and with its
	 * capacity increment equal to one.
	 * IntegerVector(IntegerVector original): Construct a copy of the given Integer Vector
	 * IntegerVector(int initialCapacity, int capacityIncrement): Construct an empty vector with the given initial capacity and capacity
	 * increment.
	 */
	constructor();
	constructor(initialCapacity: number);
	constructor(original: IntegerVector);
	constructor(initialCapacity: number, capacityIncrement: number);
	constructor(a?: number | IntegerVector, b?: number) {
		if (a instanceof IntegerVector) {
			const original = a;
			this.numElements = original.numElements;
			this.capIncrement = 1;
			this.storage = new Array<number>(this.numElements).fill(0);
			for (let i = 0; i < this.numElements; i++)
				this.storage[i] = original.storage[i];
			return;
		}
		const initialCapacity = a === undefined ? 10 : a;
		const capacityIncrement = a === undefined ? 5 : b === undefined ? 1 : b;
		this.storage = new Array<number>(initialCapacity).fill(0);
		this.capIncrement = capacityIncrement;
		this.numElements = 0;
	}

	private ensureCapacity(newCapacity: number): void {
		if (this.storage.length >= newCapacity)
			return;

		if (this.storage.length + this.capIncrement >= newCapacity) {
			newCapacity = this.storage.length + this.capIncrement;
		}

		const copy = new Array<number>(newCapacity).fill(0);
		for (let i = 0; i < this.storage.length; i++)
			copy[i] = this.storage[i];
		this.storage = copy;
	}

	/**
	 * Remove all of the integers from this vector.
	 */
	clear(): void {
		this.numElements = 0;
	}

	/**
	 * Return the integer at the given position in this vector.
	 */
	get(index: number): number {
		if (index < 0 || index >= this.numElements)
			throw new IndexOutOfBoundsException(jformat(tr("Invalid index:%d"), index));
		else
			return this.storage[index];
	}

	/**
	 * add(int value): Append the specified integer to the end of the vector.
	 * add(int index, int value): insert at the index
	 */
	add(value: number): void;
	add(index: number, value: number): void;
	add(a: number, b?: number): void {
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
	 * Set the component at the given index of this vector to be the given
	 * integer.
	 */
	set(index: number, value: number): number {
		if (index < 0 || index >= this.numElements) {
			throw new IndexOutOfBoundsException(jformat(tr("Invalid index:%d"), index));
		}

		const old = this.storage[index];
		this.storage[index] = value;
		return old;
	}

	remove(index: number): number {
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
		this.set( index, (this.get( index ) + value) | 0 );
	}

	/**
	 * Subtract the specified value from the value at the specified index.
	 */
	subAt( value: number, index: number ): void {
		this.set( index, (this.get( index ) - value) | 0 );
	}

	/**
	 * Return the sum of the integers in this vector.
	 */
	sum(): number {
		// Create a temporary int
		let total = 0;

		// Add the int values to the total
		for( let i = 0; i < this.size(); i++ ) {
			total = (total + this.get( i )) | 0;
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
	 * Return the number of ints in this vector.
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
	 * Tests if the specified integer is a component in this vector.
	 */
	contains( value: number ): boolean {
		if (this.indexOf(value) === -1)
			return false;
		else
			return true;
	}

	/**
	 * Return a string containing the contents of the IntegerVector.
	 */
	toString(): string {
		let out = "{";

		for (let i = 0; i < this.size(); i++) {
			if (i > 0)
				out += ", ";
			out += String(this.get(i));
		}
		out += "}";

		return out;
	}

	getMin(): number {
		if( this.size() < 1 ) {
			return 0;
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
			return 0;
		}
		else {
			let testValue = this.get( 0 );
			for( let i = 1; i < this.size(); i++ ) {
				testValue = Math.max( testValue, this.get( i ) );
			}
			return testValue;
		}
	}

	/**
	 * Searches for the first occurence of the given argument, testing for equality using the equals method
	 */
	indexOf(testValue: number): number {
		for (let i = 0; i < this.numElements; i++) {
			if (this.storage[i] === testValue) {
				return i;
			}
		}
		return -1;
	}

    /**
     * Change to the next permutation in lexicographic order
     */
    nextPermutation(): void {

    	let i = this.size() - 1;
    	while( this.get( i - 1 ) >= this.get( i ) ) {
    		i--;
    	}

    	let j = this.size();
    	while( this.get( j - 1 ) <= this.get( i - 1 ) ) {
    		j--;
    	}

    	// Swap values at positions (i-1) and (j-1)
    	let temp = this.get( i - 1 );
    	this.set( i - 1, this.get( j - 1 ) );
    	this.set( j - 1, temp );

    	i++;
    	j = this.size();

    	while( i < j ) {
        	temp = this.get( i - 1 );
        	this.set( i - 1, this.get( j - 1 ) );
        	this.set( j - 1, temp );
		    i++;
		    j--;
    	}
	}

	toArray(): number[] {
		return this.storage;
	}

}
