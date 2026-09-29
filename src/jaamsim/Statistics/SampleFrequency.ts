/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2018-2025 JaamSim Software Inc.
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

// long[]・int[]・double[] は number[]（0 で埋める）。
// Java の配列の範囲外は例外になるので、System.arraycopy と範囲外の読み出しは checkIndex/arraycopy で例外にした。

import { ErrorException } from "../internal.ts";
import { IndexOutOfBoundsException } from "../internal.ts";

/** Java の new long[n] など（0 で埋めた配列。負の長さは例外） */
function newArray(n: number): number[] {
	if (n < 0)
		throw new IndexOutOfBoundsException("NegativeArraySizeException: " + n);
	return new Array<number>(n).fill(0);
}

/** Java の配列の添字の確かめ（範囲外は ArrayIndexOutOfBoundsException） */
function checkIndex(arr: number[], i: number): number {
	if (i < 0 || i >= arr.length)
		throw new IndexOutOfBoundsException("Index " + i + " out of bounds for length " + arr.length);
	return i;
}

/** Java の System.arraycopy（範囲外は例外） */
function arraycopy(src: number[], srcPos: number, dest: number[], destPos: number, length: number): void {
	if (srcPos < 0 || destPos < 0 || length < 0
			|| srcPos + length > src.length || destPos + length > dest.length)
		throw new IndexOutOfBoundsException("arraycopy: last source index " + (srcPos + length)
				+ " out of bounds for length " + src.length);
	for (let i = 0; i < length; i++)
		dest[destPos + i] = src[srcPos + i];
}

export class SampleFrequency {

	private binCounts: number[];  // number of values recorded for each bin
	private firstVal: number;  // value for the first bin
	private minVal: number;  // minimum value recorded
	private maxVal: number;  // maximum value recorded

	/**
	 * Constructs an object that collects frequency statistics on the number of times that
	 * individual integer values are observed. A separate bin is maintained for each integer
	 * in the range of values that are observed.
	 * @param val0 - lowest integer in the initial range of values to record
	 * @param val1 - highest integer in the initial range of values to record
	 */
	constructor(val0: number, val1: number) {
		this.firstVal = val0;
		this.binCounts = newArray(val1 - val0 + 1);
		this.minVal = val0;
		this.maxVal = val0;
	}

	clear(): void {
		this.binCounts.fill(0);
		this.maxVal = this.minVal;
	}

	private resize(val0: number, val1: number): void {
		if (val0 > this.firstVal || val1 < this.firstVal + this.binCounts.length - 1)
			throw new ErrorException("Invalid resizing of bin array.");

		const offset = this.firstVal - val0;
		const num = val1 - val0 + 1;
		const newBinCounts = newArray(num);
		arraycopy(this.binCounts, 0, newBinCounts, offset, this.binCounts.length);
		this.binCounts = newBinCounts;
		this.firstVal = val0;
	}

	private resizeForValue(val: number): void {
		let val0 = this.firstVal;
		let val1 =  this.firstVal + this.binCounts.length - 1;
		if (val >= val0 && val <= val1)
			return;

		if (val < val0) {
			val0 = Math.min(val, val0 - this.binCounts.length);
		}
		else if (val > val1) {
			val1 = Math.max(val, val1 + this.binCounts.length);
		}
		this.resize(val0, val1);
	}

	/**
	 * Records the specified integer value.
	 * @param val - integer value to be recorded
	 */
	addValue(val: number): void {
		this.resizeForValue(val);
		const index = val - this.firstVal;
		this.binCounts[checkIndex(this.binCounts, index)]++;
		this.minVal = Math.min(this.minVal, val);
		this.maxVal = Math.max(this.maxVal, val);
	}

	/**
	 * Returns the total number of times an integer value was recorded.
	 * @return total number of times
	 */
	getCount(): number {
		let sum = 0;
		const start = this.minVal - this.firstVal;
		const end = this.maxVal - this.firstVal;
		for (let i = start; i <= end; i++) {
			sum += this.binCounts[checkIndex(this.binCounts, i)];
		}
		return sum;
	}

	/**
	 * Returns whether any values have been recorded.
	 * @return true if one or more values have been recorded
	 */
	isEmpty(): boolean {
		return this.maxVal === this.minVal && this.getCount() === 0;
	}

	/**
	 * Returns the number of bins in the histogram of values.
	 * @return number of bins in the histogram
	 */
	getNumberOfBins(): number {
		if (this.isEmpty())
			return 0;
		return this.maxVal - this.minVal + 1;
	}

	/**
	 * Returns the minimum integer value that was recorded.
	 * @return minimum integer value
	 */
	getMin(): number {
		return this.minVal;
	}

	/**
	 * Returns the maximum integer value that was recorded.
	 * @return maximum integer value
	 */
	getMax(): number {
		return this.maxVal;
	}

	/**
	 * Returns the total number of times the specified integer value was recorded.
	 * @param val - specified integer value
	 * @return total number of times
	 */
	getBinCount(val: number): number {
		const index = val - this.firstVal;
		return this.binCounts[checkIndex(this.binCounts, index)];
	}

	/**
	 * Returns the total number of times the specified integer value was recorded as a fraction of
	 * the total number of times that any value was recorded.
	 * @param val - specified integer value
	 * @return faction of values recorded
	 */
	getBinFraction(val: number): number {
		return (this.getBinCount(val))/this.getCount();
	}

	/**
	 * Returns an array of the integer values covering the range between the lowest and highest
	 * values that were recorded.
	 * @return array of integer values
	 */
	getBinValues(): number[] {
		const num = this.getNumberOfBins();
		const ret = newArray(num);
		for (let i = 0; i < num; i++) {
			ret[i] = this.minVal + i;
		}
		return ret;
	}

	/**
	 * Returns an array containing the number of times each integer value was recorded, covering
	 * the range between the lowest and highest values.
	 * @return array of bin counts
	 */
	getBinCounts(): number[] {
		const num = this.getNumberOfBins();
		const offset = this.minVal - this.firstVal;
		const ret = newArray(num);
		arraycopy(this.binCounts, offset, ret, 0, num);
		return ret;
	}

	/**
	 * Returns an array containing the fractional number of times each integer value was recorded,
	 * covering the range between the lowest and highest values.
	 * @return array of values between 0 and 1
	 */
	getBinFractions(): number[] {
		const num = this.getNumberOfBins();
		const offset = this.minVal - this.firstVal;
		const total = this.getCount();
		const ret = newArray(num);
		for (let i = 0; i < num; i++) {
			ret[i] = this.binCounts[checkIndex(this.binCounts, i + offset)]/total;
		}
		return ret;
	}

	/**
	 * Returns an array containing the fractional number of times each integer value or less was
	 * recorded, covering the range between the lowest and highest values.
	 * @return array of values between 0 and 1
	 */
	getBinCumulativeFractions(): number[] {
		const num = this.getNumberOfBins();
		const offset = this.minVal - this.firstVal;
		const total = this.getCount();
		const ret = newArray(num);
		if (ret.length > 0)
			ret[0] = this.binCounts[checkIndex(this.binCounts, offset)]/total;
		for (let i = 1; i < num; i++) {
			ret[i] = ret[i - 1] + this.binCounts[checkIndex(this.binCounts, i + offset)]/total;
		}
		return ret;
	}

}
