/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2005-2011 Ausenco Engineering Canada Inc.
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
import { tr } from "../internal.ts";
import { IndexOutOfBoundsException, jformat } from "../internal.ts";

/*
 * 移植の注意: Java の ArrayIndexOutOfBoundsException は、lang.ts の IndexOutOfBoundsException（その親）で投げる。
 */

/**
 * This class stores boolean values in an array.
 */
export class BooleanVector {
	private numElements: number;
	private capIncrement: number;
	private storage: boolean[];

	/**
	 * BooleanVector(): Construct an empty vector, size 10, size increment 5.
	 * BooleanVector(int initialCapacity): Construct an empty vector with the given initial capacity and with its
	 * capacity increment equal to one.
	 * BooleanVector(int initialCapacity, int capacityIncrement): Construct an empty vector with the given initial capacity and capacity
	 * increment.
	 */
	constructor(initialCapacity?: number, capacityIncrement?: number) {
		if (initialCapacity === undefined) {
			initialCapacity = 10;
			capacityIncrement = 5;
		}
		else if (capacityIncrement === undefined) {
			capacityIncrement = 1;
		}
		this.storage = new Array<boolean>(initialCapacity).fill(false);
		this.capIncrement = capacityIncrement;
		this.numElements = 0;
	}

	private ensureCapacity(newCapacity: number): void {
		if (this.storage.length >= newCapacity)
			return;

		if (this.storage.length + this.capIncrement >= newCapacity) {
			newCapacity = this.storage.length + this.capIncrement;
		}

		const copy = new Array<boolean>(newCapacity).fill(false);
		for (let i = 0; i < this.storage.length; i++)
			copy[i] = this.storage[i];
		this.storage = copy;
	}

	/**
	 * Remove all of the booleans from this vector.
	 */
	clear(): void {
		this.numElements = 0;
	}

	/**
	 * Return the boolean at the given position in this vector.
	 */
	get(index: number): boolean {
		if (index < 0 || index >= this.numElements)
			throw new IndexOutOfBoundsException(jformat(tr("Invalid index:%d"), index));
		else
			return this.storage[index];
	}

	/**
	 * add(boolean value): Append the specified boolean to the end of the vector.
	 * add(int index, boolean value): insert at the index
	 */
	add(value: boolean): void;
	add(index: number, value: boolean): void;
	add(a: boolean | number, b?: boolean): void {
		if (typeof a === "boolean") {
			this.add(this.numElements, a);
			return;
		}
		const index = a, value = b!;
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
	 * Replaces the element at the specified position in this BooleanVector with the
	 * specified element. Returns the element that was replaced in the BooleanVector.
	 *
	 * @param index index of element to replace
	 * @param value element to be stored at the specified position
	 * @return the element previously at the specified position
	 * @exception ArrayIndexOutOfBoundsException index out of range (index < 0 || index >= size())
	 */
	set(index: number, value: boolean): boolean {
		if (index < 0 || index >= this.numElements) {
			throw new IndexOutOfBoundsException(jformat(tr("Invalid index:%d"), index));
		}

		const old = this.storage[index];
		this.storage[index] = value;
		return old;
	}

	/**
	 * Removes the element at the specified position in this BooleanVector. Shifts any
	 * subsequent elements to the left (subtracts one from their indices). Returns the
	 * element that was removed from the BooleanVector.
	 *
	 * @param index the index of the element to removed
	 * @return element that was removed
	 */
	remove(index: number): boolean {
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
	 * Fill the vector with the given number of entries of the given value.
	 */
	fillWithEntriesOf(entries: number, value: boolean): void {
		this.ensureCapacity(entries);
		this.storage.fill(value);
		this.numElements = entries;
	}

	/**
	 * Return the number of booleans in this vector.
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
	 * Return a string containing the contents of the BooleanVector.
	 */
	toString(): string {
		let out = "{";

		for (let i = 0; i < this.size(); i++) {
			if (i === 0)
				out += " ";
			else
				out += ", ";
			out += this.storage[i] ? "true" : "false";
		}
		out += " }";
		return out;
	}
}
